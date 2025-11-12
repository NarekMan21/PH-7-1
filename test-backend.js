const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'sensor_data.json');

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Функция для отправки POST запроса
function sendPostRequest(data, ip = null) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: '/save',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    // Если указан IP, добавляем заголовок
    if (ip) {
      options.headers['X-Forwarded-For'] = ip;
    }
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });
    
    req.on('error', (e) => {
      reject(e);
    });
    
    req.write(postData);
    req.end();
  });
}

// Функция для отправки GET запроса
function sendGetRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: 'GET'
    };
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });
    
    req.on('error', (e) => {
      reject(e);
    });
    
    req.end();
  });
}

// Функция для чтения файла базы данных
function readDatabase() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return [];
    }
    const content = fs.readFileSync(DATA_FILE, 'utf8').trim();
    if (!content) {
      return [];
    }
    return JSON.parse(content);
  } catch (e) {
    log(`Ошибка чтения базы данных: ${e.message}`, 'red');
    return null;
  }
}

// Тест 1: Сохранение данных
async function testSaveData() {
  log('\n=== Тест 1: Сохранение данных ===', 'cyan');
  
  const testData = {
    t: 25.5,
    h: 60.0,
    ec: 1200,
    ph: 6.5,
    n: 150,
    p: 80,
    k: 200,
    v: true
  };
  
  try {
    const beforeCount = readDatabase().length;
    log(`Записей в базе до отправки: ${beforeCount}`, 'blue');
    
    const response = await sendPostRequest(testData, '192.168.0.34');
    
    if (response.status === 200 && response.data.success) {
      log(`✅ POST /save успешно: ${response.data.count} записей в базе`, 'green');
      
      // Проверяем файл
      const afterData = readDatabase();
      const afterCount = afterData.length;
      
      if (afterCount === beforeCount + 1) {
        log(`✅ Запись добавлена в базу (было ${beforeCount}, стало ${afterCount})`, 'green');
        
        // Проверяем последнюю запись
        const lastRecord = afterData[afterData.length - 1];
        const hasTimestamp = !!lastRecord.timestamp;
        const hasDate = !!lastRecord.date;
        const hasIp = !!lastRecord.ip;
        const hasData = lastRecord.t === testData.t && lastRecord.h === testData.h;
        
        log(`  - timestamp: ${hasTimestamp ? '✅' : '❌'}`, hasTimestamp ? 'green' : 'red');
        log(`  - date: ${hasDate ? '✅' : '❌'}`, hasDate ? 'green' : 'red');
        log(`  - ip: ${hasIp ? '✅' : '❌'} (${lastRecord.ip || 'отсутствует'})`, hasIp ? 'green' : 'red');
        log(`  - данные: ${hasData ? '✅' : '❌'}`, hasData ? 'green' : 'red');
        
        return hasTimestamp && hasDate && hasIp && hasData;
      } else {
        log(`❌ Количество записей не изменилось`, 'red');
        return false;
      }
    } else {
      log(`❌ POST /save вернул ошибку: ${JSON.stringify(response)}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка при тестировании: ${error.message}`, 'red');
    return false;
  }
}

// Тест 2: Сохранение данных с разными IP
async function testSaveMultipleIPs() {
  log('\n=== Тест 2: Сохранение данных с разными IP ===', 'cyan');
  
  const testIPs = ['192.168.0.34', '192.168.0.35', '192.168.0.22'];
  const results = [];
  
  for (const ip of testIPs) {
    const testData = {
      t: 20 + Math.random() * 10,
      h: 50 + Math.random() * 20,
      ec: 1000 + Math.random() * 500,
      ph: 5 + Math.random() * 3,
      n: 100 + Math.random() * 100,
      p: 50 + Math.random() * 50,
      k: 150 + Math.random() * 100,
      v: true
    };
    
    try {
      const response = await sendPostRequest(testData, ip);
      if (response.status === 200 && response.data.success) {
        log(`✅ Данные сохранены для IP ${ip}`, 'green');
        results.push({ ip, success: true });
      } else {
        log(`❌ Ошибка сохранения для IP ${ip}`, 'red');
        results.push({ ip, success: false });
      }
    } catch (error) {
      log(`❌ Ошибка для IP ${ip}: ${error.message}`, 'red');
      results.push({ ip, success: false });
    }
    
    // Небольшая задержка между запросами
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Проверяем, что все IP сохранены
  const dbData = readDatabase();
  const savedIPs = [...new Set(dbData.map(r => r.ip).filter(ip => ip))];
  log(`\nIP-адреса в базе: ${savedIPs.join(', ')}`, 'blue');
  
  const allSaved = testIPs.every(ip => savedIPs.includes(ip));
  if (allSaved) {
    log(`✅ Все IP-адреса сохранены в базу`, 'green');
  } else {
    log(`❌ Не все IP-адреса найдены в базе`, 'red');
  }
  
  return allSaved;
}

// Тест 3: Чтение истории
async function testReadHistory() {
  log('\n=== Тест 3: Чтение истории ===', 'cyan');
  
  try {
    const response = await sendGetRequest('/history');
    
    if (response.status === 200) {
      const data = response.data;
      
      // Проверяем формат ответа
      const hasTotal = typeof data.total === 'number';
      const hasCount = typeof data.count === 'number';
      const hasData = Array.isArray(data.data);
      
      log(`✅ GET /history успешно`, 'green');
      log(`  - total: ${hasTotal ? '✅' : '❌'} (${data.total})`, hasTotal ? 'green' : 'red');
      log(`  - count: ${hasCount ? '✅' : '❌'} (${data.count})`, hasCount ? 'green' : 'red');
      log(`  - data: ${hasData ? '✅' : '❌'} (${data.data.length} записей)`, hasData ? 'green' : 'red');
      
      if (hasData && data.data.length > 0) {
        const firstRecord = data.data[0];
        const requiredFields = ['timestamp', 'date', 'ip', 't', 'h', 'ph', 'v'];
        const missingFields = requiredFields.filter(field => !(field in firstRecord));
        
        if (missingFields.length === 0) {
          log(`  - Все обязательные поля присутствуют ✅`, 'green');
        } else {
          log(`  - Отсутствуют поля: ${missingFields.join(', ')} ❌`, 'red');
        }
      }
      
      return hasTotal && hasCount && hasData;
    } else {
      log(`❌ GET /history вернул ошибку: ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка при чтении истории: ${error.message}`, 'red');
    return false;
  }
}

// Тест 4: Фильтрация по limit и offset
async function testHistoryFiltering() {
  log('\n=== Тест 4: Фильтрация истории ===', 'cyan');
  
  try {
    // Получаем все данные
    const allResponse = await sendGetRequest('/history');
    const totalRecords = allResponse.data.total || 0;
    
    if (totalRecords === 0) {
      log(`⚠️ Нет данных для тестирования фильтрации`, 'yellow');
      return true;
    }
    
    // Тестируем limit
    const limitResponse = await sendGetRequest('/history?limit=5');
    if (limitResponse.data.count <= 5 && limitResponse.data.count <= totalRecords) {
      log(`✅ Фильтрация по limit работает (limit=5, получено ${limitResponse.data.count})`, 'green');
    } else {
      log(`❌ Фильтрация по limit не работает`, 'red');
      return false;
    }
    
    // Тестируем offset
    const offsetResponse = await sendGetRequest('/history?offset=2&limit=3');
    if (offsetResponse.data.count <= 3) {
      log(`✅ Фильтрация по offset работает (offset=2, limit=3, получено ${offsetResponse.data.count})`, 'green');
    } else {
      log(`❌ Фильтрация по offset не работает`, 'red');
      return false;
    }
    
    return true;
  } catch (error) {
    log(`❌ Ошибка при тестировании фильтрации: ${error.message}`, 'red');
    return false;
  }
}

// Тест 5: Обработка ошибок
async function testErrorHandling() {
  log('\n=== Тест 5: Обработка ошибок ===', 'cyan');
  
  // Тест пустых данных
  try {
    const emptyResponse = await sendPostRequest({});
    log(`Тест пустых данных: ${emptyResponse.status === 200 ? '✅' : '❌'}`, emptyResponse.status === 200 ? 'green' : 'yellow');
  } catch (error) {
    log(`Тест пустых данных: ❌ ${error.message}`, 'red');
  }
  
  // Тест невалидных данных
  try {
    const invalidResponse = await sendPostRequest({ invalid: 'data' });
    log(`Тест невалидных данных: ${invalidResponse.status === 200 ? '✅' : '❌'}`, invalidResponse.status === 200 ? 'green' : 'yellow');
  } catch (error) {
    log(`Тест невалидных данных: ❌ ${error.message}`, 'red');
  }
  
  return true;
}

// Тест 6: Проверка целостности данных
async function testDataIntegrity() {
  log('\n=== Тест 6: Целостность данных ===', 'cyan');
  
  const dbData = readDatabase();
  
  if (!dbData || dbData.length === 0) {
    log(`⚠️ Нет данных для проверки целостности`, 'yellow');
    return true;
  }
  
  const requiredFields = ['timestamp', 'date', 'ip', 't', 'h', 'ec', 'ph', 'n', 'p', 'k', 'v'];
  let allValid = true;
  
  dbData.forEach((record, index) => {
    const missingFields = requiredFields.filter(field => !(field in record));
    if (missingFields.length > 0) {
      log(`❌ Запись ${index + 1}: отсутствуют поля ${missingFields.join(', ')}`, 'red');
      allValid = false;
    }
    
    // Проверка типов
    if (typeof record.t !== 'number' || typeof record.h !== 'number' || typeof record.ph !== 'number') {
      log(`❌ Запись ${index + 1}: неверные типы данных`, 'red');
      allValid = false;
    }
  });
  
  if (allValid) {
    log(`✅ Все ${dbData.length} записей имеют правильный формат`, 'green');
  }
  
  return allValid;
}

// Главная функция тестирования
async function runTests() {
  log('\n' + '='.repeat(50), 'cyan');
  log('НАЧАЛО ТЕСТИРОВАНИЯ БЭКЕНДА', 'cyan');
  log('='.repeat(50), 'cyan');
  
  // Проверяем, запущен ли сервер
  try {
    await sendGetRequest('/stats');
    log('✅ Сервер доступен', 'green');
  } catch (error) {
    log('❌ Сервер не доступен. Убедитесь, что backend.js запущен (npm start)', 'red');
    process.exit(1);
  }
  
  const results = [];
  
  // Запускаем тесты
  results.push(await testSaveData());
  results.push(await testSaveMultipleIPs());
  results.push(await testReadHistory());
  results.push(await testHistoryFiltering());
  results.push(await testErrorHandling());
  results.push(await testDataIntegrity());
  
  // Итоги
  log('\n' + '='.repeat(50), 'cyan');
  log('ИТОГИ ТЕСТИРОВАНИЯ', 'cyan');
  log('='.repeat(50), 'cyan');
  
  const passed = results.filter(r => r === true).length;
  const total = results.length;
  
  log(`\nПройдено тестов: ${passed}/${total}`, passed === total ? 'green' : 'yellow');
  
  if (passed === total) {
    log('\n✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ УСПЕШНО!', 'green');
    process.exit(0);
  } else {
    log('\n❌ НЕКОТОРЫЕ ТЕСТЫ НЕ ПРОЙДЕНЫ', 'red');
    process.exit(1);
  }
}

// Запуск тестов
runTests().catch(error => {
  log(`\n❌ Критическая ошибка: ${error.message}`, 'red');
  process.exit(1);
});

