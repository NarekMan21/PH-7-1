#include <ESP8266WiFi.h>
#include <ESP8266WiFiMulti.h>
#include <ESP8266WebServer.h>
#include <ESP8266HTTPClient.h>
#include "DHT.h"

// ---------- НАСТРОЙКИ WiFi ----------
#define WIFI_SSID1      "COMFAST_F8EB_2G"
#define WIFI_PASSWORD1  "15210625"
#define WIFI_SSID2      "Keenetic-1733"
#define WIFI_PASSWORD2  "m2HZ4Ceb"

// ---------- НАСТРОЙКИ БЭКЕНДА ----------
// Для локального бэкенда (раскомментируйте и закомментируйте Vercel URL):
// #define BACKEND_URL     "http://192.168.0.31:3000/save"
// Для Vercel (production):
#define BACKEND_URL     "https://71-ebon.vercel.app/save"

// Интервалы
#define WIFI_RECONNECT_INTERVAL 30000
#define PUBLISH_INTERVAL        30000  // Отправка данных каждые 30 секунд
#define READ_INTERVAL           2000   // Чтение с датчиков каждые 2 секунды

ESP8266WiFiMulti wifiMulti;
ESP8266WebServer server(80);
WiFiClient wifiClient;

// Пины датчиков
const byte dhtPin = D2;        // DHT11 датчик на D2
const byte rainPin = D5;       // Датчик дождя на D5
const byte windSpeedPin = D7;  // Анемометр (скорость ветра) на D7
const byte windDirPin = A0;    // Датчик направления ветра на A0

// Настройка DHT11
#define DHTTYPE DHT11
DHT dht(dhtPin, DHTTYPE);

// Глобальные переменные
volatile unsigned int windcnt = 0;
volatile unsigned int raincnt = 0;
unsigned long lastWifiCheck = 0;
unsigned long lastPublishTime = 0;
unsigned long lastReadTime = 0;

// Структура данных датчиков
struct SensorData {
  float temperature;
  float humidity;
  float windspeed;
  String winddirection;
  float rain;
  bool valid;
} sensorData;

// Структура для сопоставления направлений и калибровочного напряжения
struct WindDir {
  const char* direction;
  float voltage;
};

// Калибровочные значения (установлены по примеру – их можно подстроить под вашу установку)
WindDir directions[] = {
  { "N", 2.50 },
  { "NE", 1.50 },
  { "E", 0.35 },
  { "SE", 0.65 },
  { "S", 0.93 },
  { "SW", 2.125 },
  { "NW", 2.88 },
  { "W", 3.175 }
};

// Прототипы функций
void ICACHE_RAM_ATTR cntWindSpeed();
void ICACHE_RAM_ATTR cntRain();
void readSensorData();
void sendToBackend();
void setupWiFi();
void ensureWiFi();

// Функции-обработчики прерываний
void ICACHE_RAM_ATTR cntWindSpeed() {
  windcnt++;
}

void ICACHE_RAM_ATTR cntRain() {
  raincnt++;
}

// Чтение данных со всех датчиков
void readSensorData() {
  // Чтение данных с DHT11
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("⚠️ Ошибка чтения DHT11");
    sensorData.valid = false;
    return;
  }

  // Чтение данных ветра и дождя
  float ws = (windcnt / (float)READ_INTERVAL) * 2.4;  // Примерное вычисление скорости ветра (км/ч)
  windcnt = 0;

  float r = (raincnt / 2.0) * 0.2794;  // Примерное вычисление осадков (мм)
  raincnt = 0;

  // Чтение направления ветра
  int rawValue = analogRead(windDirPin);
  float voltage = rawValue * (3.3 / 1023.0);

  // Поиск ближайшего калибровочного значения
  String wd = "";
  float minDiff = 100.0;
  for (int i = 0; i < 8; i++) {
    float diff = fabs(voltage - directions[i].voltage);
    if (diff < minDiff) {
      minDiff = diff;
      wd = directions[i].direction;
    }
  }

  // Сохранение данных
  sensorData.temperature = temperature;
  sensorData.humidity = humidity;
  sensorData.windspeed = ws;
  sensorData.winddirection = wd;
  sensorData.rain = r;
  sensorData.valid = true;

  // Вывод показаний в Serial Monitor
  Serial.println("\n========== ПОКАЗАНИЯ МЕТЕОСТАНЦИИ ==========");
  Serial.printf("Температура:     %.1f°C\n", sensorData.temperature);
  Serial.printf("Влажность:       %.1f%%\n", sensorData.humidity);
  Serial.printf("Скорость ветра:  %.2f км/ч\n", sensorData.windspeed);
  Serial.printf("Направление:    %s\n", sensorData.winddirection.c_str());
  Serial.printf("Осадки:          %.2f мм\n", sensorData.rain);
  Serial.println("==========================================\n");
}

// Отправка данных на бэкенд
void sendToBackend() {
  if (!sensorData.valid) {
    return;
  }
  
  if (millis() - lastPublishTime < PUBLISH_INTERVAL) {
    return;
  }
  lastPublishTime = millis();
  
  HTTPClient http;
  http.begin(wifiClient, BACKEND_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);  // Таймаут 10 секунд
  
  // Формируем JSON в формате проекта
  // Для метеостанции отправляем только температуру и влажность
  // Остальные поля (ec, ph, n, p, k) устанавливаем в 0
  String json = "{";
  json += "\"t\":" + String(sensorData.temperature, 1) + ",";
  json += "\"h\":" + String(sensorData.humidity, 1) + ",";
  json += "\"ec\":0,";  // Электропроводность не применима для метеостанции
  json += "\"ph\":0,";  // pH не применим для метеостанции
  json += "\"n\":0,";   // Азот не применим для метеостанции
  json += "\"p\":0,";   // Фосфор не применим для метеостанции
  json += "\"k\":0,";   // Калий не применим для метеостанции
  json += "\"v\":true";
  json += "}";
  
  int httpCode = http.POST(json);
  
  if (httpCode > 0) {
    if (httpCode == HTTP_CODE_OK) {
      String response = http.getString();
      Serial.println("✅ Данные отправлены на бэкенд");
      Serial.printf("   Ответ: %s\n", response.c_str());
    } else {
      Serial.printf("⚠️ Бэкенд вернул код: %d\n", httpCode);
      String response = http.getString();
      Serial.printf("   Ответ: %s\n", response.c_str());
    }
  } else {
    Serial.printf("❌ Ошибка отправки на бэкенд: %s\n", http.errorToString(httpCode).c_str());
  }
  
  http.end();
}

void setupWiFi() {
  wifiMulti.addAP(WIFI_SSID1, WIFI_PASSWORD1);
  wifiMulti.addAP(WIFI_SSID2, WIFI_PASSWORD2);
  Serial.print("📶 WiFi подключение");
  while (wifiMulti.run() != WL_CONNECTED) {
    Serial.print(".");
    delay(500);
  }
  Serial.println();
  Serial.print("✅ WiFi подключен! IP адрес: ");
  Serial.println(WiFi.localIP());
}

void ensureWiFi() {
  if (millis() - lastWifiCheck > WIFI_RECONNECT_INTERVAL) {
    lastWifiCheck = millis();
    if (wifiMulti.run() != WL_CONNECTED) {
      Serial.println("❌ WiFi упал, переподключаюсь...");
      setupWiFi();
    }
  }
}

// HTML страница для локального просмотра
const char htmlPage[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Метеостанция ESP8266</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff; min-height: 100vh; padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header {
            text-align: center; margin-bottom: 30px; padding: 20px;
            background: rgba(255, 255, 255, 0.1); border-radius: 15px; backdrop-filter: blur(10px);
        }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3); }
        .header p { opacity: 0.9; font-size: 1.1em; }
        .status {
            display: inline-block; padding: 8px 16px; border-radius: 20px;
            font-size: 0.9em; font-weight: 600; margin-top: 10px;
        }
        .status.online { background: #4caf50; color: #fff; }
        .status.offline { background: #f44336; color: #fff; }
        .grid {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px; margin-bottom: 30px;
        }
        .card {
            background: rgba(255, 255, 255, 0.15); border-radius: 15px; padding: 25px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2); transition: transform 0.3s, box-shadow 0.3s;
        }
        .card:hover { transform: translateY(-5px); box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2); }
        .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; }
        .card-title { font-size: 1.1em; font-weight: 600; color: #fff; }
        .card-icon { font-size: 2em; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(255, 255, 255, 0.2); }
        .card-value { font-size: 2.5em; font-weight: 700; margin: 15px 0; color: #fff; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2); }
        .card-unit { font-size: 0.5em; opacity: 0.8; margin-left: 5px; }
        .card-footer { font-size: 0.85em; opacity: 0.7; margin-top: 10px; display: flex; justify-content: space-between; align-items: center; }
        .footer { text-align: center; padding: 20px; opacity: 0.8; font-size: 0.9em; }
        .loading { text-align: center; padding: 40px; font-size: 1.2em; animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @media (max-width: 768px) {
            .header h1 { font-size: 2em; }
            .card-value { font-size: 2em; }
            .grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌤️ Метеостанция ESP8266</h1>
            <p>Мониторинг погодных условий в реальном времени</p>
            <div id="status" class="status offline">ОФЛАЙН</div>
        </div>
        <div id="content"><div class="loading">Загрузка данных...</div></div>
        <div class="footer">ESP8266 Weather Station | <span id="ip">--</span> | Обновлено: <span id="lastUpdate">--</span></div>
    </div>
    <script>
        function formatTime(timestamp) {
            const date = new Date(timestamp);
            return date.toLocaleTimeString('ru-RU');
        }
        function updateData() {
            fetch('/api')
                .then(response => response.json())
                .then(data => {
                    const content = document.getElementById('content');
                    const status = document.getElementById('status');
                    const lastUpdate = document.getElementById('lastUpdate');
                    if (data.v && data.v === true) {
                        status.textContent = 'ОНЛАЙН';
                        status.className = 'status online';
                        let html = '<div class="grid">';
                        html += '<div class="card"><div class="card-header"><span class="card-title">Температура</span><div class="card-icon">🌡️</div></div><div class="card-value">' + data.t.toFixed(1) + '<span class="card-unit">°C</span></div><div class="card-footer"><span>Обновлено: только что</span></div></div>';
                        html += '<div class="card"><div class="card-header"><span class="card-title">Влажность</span><div class="card-icon">💧</div></div><div class="card-value">' + data.h.toFixed(1) + '<span class="card-unit">%</span></div><div class="card-footer"><span>Обновлено: только что</span></div></div>';
                        if (data.ws !== undefined) {
                            html += '<div class="card"><div class="card-header"><span class="card-title">Скорость ветра</span><div class="card-icon">💨</div></div><div class="card-value">' + data.ws.toFixed(2) + '<span class="card-unit">км/ч</span></div><div class="card-footer"><span>Обновлено: только что</span></div></div>';
                        }
                        if (data.wd !== undefined) {
                            html += '<div class="card"><div class="card-header"><span class="card-title">Направление ветра</span><div class="card-icon">🧭</div></div><div class="card-value">' + data.wd + '<span class="card-unit"></span></div><div class="card-footer"><span>Обновлено: только что</span></div></div>';
                        }
                        if (data.rain !== undefined) {
                            html += '<div class="card"><div class="card-header"><span class="card-title">Осадки</span><div class="card-icon">🌧️</div></div><div class="card-value">' + data.rain.toFixed(2) + '<span class="card-unit">мм</span></div><div class="card-footer"><span>Обновлено: только что</span></div></div>';
                        }
                        html += '</div>';
                        content.innerHTML = html;
                        lastUpdate.textContent = formatTime(Date.now());
                        if (data.ip) document.getElementById('ip').textContent = data.ip;
                    } else {
                        status.textContent = 'ОФЛАЙН';
                        status.className = 'status offline';
                        content.innerHTML = '<div class="card"><div class="card-header"><span class="card-title">Нет данных</span><div class="card-icon">⚠️</div></div><div class="card-value">--<span class="card-unit"></span></div><div class="card-footer"><span>Ожидание данных с датчиков</span></div></div>';
                    }
                })
                .catch(error => {
                    console.error('Ошибка получения данных:', error);
                    const status = document.getElementById('status');
                    status.textContent = 'ОШИБКА';
                    status.className = 'status offline';
                });
        }
        setInterval(updateData, 2000);
        updateData();
    </script>
</body>
</html>
)rawliteral";

void handleRoot() {
  server.send(200, "text/html; charset=utf-8", htmlPage);
}

void handleAPI() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  if (!sensorData.valid) {
    server.send(200, "application/json", "{\"v\":false,\"error\":\"Нет данных\"}");
    return;
  }
  String json = "{";
  json += "\"t\":" + String(sensorData.temperature, 1) + ",";
  json += "\"h\":" + String(sensorData.humidity, 1) + ",";
  json += "\"ws\":" + String(sensorData.windspeed, 2) + ",";
  json += "\"wd\":\"" + sensorData.winddirection + "\",";
  json += "\"rain\":" + String(sensorData.rain, 2) + ",";
  json += "\"v\":true,";
  json += "\"ip\":\"" + WiFi.localIP().toString() + "\"";
  json += "}";
  server.send(200, "application/json", json);
}

void setup() {
  Serial.begin(115200);
  delay(10);
  Serial.println("\n\n=======================================");
  Serial.println("    Метеостанция ESP8266");
  Serial.println("    (Адаптировано для HTTP бэкенда)");
  Serial.println("=======================================\n");
  
  // Инициализация DHT11
  dht.begin();
  Serial.println("✅ DHT11 инициализирован");

  // Настройка пинов для ветра и дождя
  pinMode(windSpeedPin, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(windSpeedPin), cntWindSpeed, RISING);

  pinMode(rainPin, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(rainPin), cntRain, RISING);

  pinMode(windDirPin, INPUT);
  Serial.println("✅ Датчики ветра и дождя инициализированы");
  
  sensorData.valid = false;
  
  // Настройка WiFi
  setupWiFi();
  
  // Настройка веб-сервера
  server.on("/", handleRoot);
  server.on("/api", handleAPI);
  server.begin();
  Serial.println("🌐 HTTP веб-сервер запущен");
  Serial.print("   Веб-интерфейс: http://");
  Serial.println(WiFi.localIP());
  Serial.print("   JSON API: http://");
  Serial.print(WiFi.localIP());
  Serial.println("/api");
  Serial.print("   Бэкенд: ");
  Serial.println(BACKEND_URL);
  
  lastPublishTime = millis() - PUBLISH_INTERVAL;
  lastReadTime = millis();
  
  Serial.println("\nСистема запущена. Ожидание данных с датчиков...\n");
}

void loop() {
  // Проверка и поддержание WiFi соединения
  ensureWiFi();
  
  // Обработка веб-сервера
  server.handleClient();
  
  // Чтение данных с датчиков
  if (millis() - lastReadTime >= READ_INTERVAL) {
    lastReadTime = millis();
    readSensorData();
    if (sensorData.valid) {
      // Отправка данных на бэкенд
      sendToBackend();
    }
  }
  
  delay(10);
}
