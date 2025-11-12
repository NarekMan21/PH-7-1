// Vercel Serverless Function - точка входа для всех API запросов
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const DATA_FILE = path.join('/tmp', 'sensor_data.json');

// Middleware
app.use(cors());
app.use(express.json());
app.set('trust proxy', true);
// Статические файлы обслуживаются Vercel автоматически, но оставляем для совместимости
if (process.env.VERCEL) {
  // На Vercel статические файлы обслуживаются через vercel.json routes
  // Здесь только API endpoints
} else {
  app.use(express.static(path.join(__dirname, '..')));
}

// Инициализация файла данных
if (!fs.existsSync('/tmp')) {
  try {
    fs.mkdirSync('/tmp', { recursive: true });
  } catch (e) {
    console.error('Не удалось создать /tmp:', e.message);
  }
}
if (!fs.existsSync(DATA_FILE)) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
  } catch (e) {
    console.error('Не удалось создать файл данных:', e.message);
  }
}

// Сохранение данных от ESP8266
app.post('/save', (req, res) => {
  try {
    const data = req.body;
    
    // Получаем IP-адрес отправителя
    const clientIp = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    // Убираем префикс ::ffff: если это IPv4 через IPv6
    const cleanIp = clientIp.replace(/^::ffff:/, '').split(',')[0].trim();
    
    console.log('📥 Получены данные от ESP8266:', JSON.stringify(data));
    console.log('   IP отправителя:', cleanIp);
    
    // Добавляем timestamp и IP
    const record = {
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleString('ru-RU'),
      ip: cleanIp,
      ...data
    };
    
    // Читаем существующие данные
    let history = [];
    if (fs.existsSync(DATA_FILE)) {
      try {
        const fileContent = fs.readFileSync(DATA_FILE, 'utf8').trim();
        if (fileContent) {
          history = JSON.parse(fileContent);
        }
      } catch (parseError) {
        console.error('⚠️ Ошибка парсинга файла данных, инициализируем пустым массивом:', parseError.message);
        history = [];
        fs.writeFileSync(DATA_FILE, JSON.stringify([]));
      }
    }
    
    // Добавляем новую запись
    history.push(record);
    
    // Ограничиваем историю до 10000 записей
    if (history.length > 10000) {
      history = history.slice(-10000);
    }
    
    // Сохраняем обратно
    fs.writeFileSync(DATA_FILE, JSON.stringify(history, null, 2));
    
    console.log(`✅ Данные сохранены. Всего записей: ${history.length}`);
    res.json({ success: true, count: history.length });
  } catch (error) {
    console.error('❌ Ошибка сохранения:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получение текущих данных (последняя запись)
app.get('/api', (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      console.log('⚠️ Файл данных не найден');
      return res.json({ v: false, error: 'Файл данных не найден' });
    }
    
    const fileContent = fs.readFileSync(DATA_FILE, 'utf8').trim();
    let history = [];
    
    if (fileContent) {
      try {
        history = JSON.parse(fileContent);
        if (!Array.isArray(history)) {
          history = [];
        }
      } catch (parseError) {
        console.error('⚠️ Ошибка парсинга файла данных:', parseError.message);
        history = [];
      }
    }
    
    if (history.length === 0) {
      console.log('⚠️ История данных пуста');
      return res.json({ v: false, error: 'История данных пуста' });
    }
    
    // Возвращаем последнюю запись
    const lastRecord = history[history.length - 1];
    
    console.log('📊 Последняя запись:', {
      timestamp: lastRecord.timestamp || lastRecord.date,
      v: lastRecord.v,
      t: lastRecord.t,
      h: lastRecord.h,
      ph: lastRecord.ph
    });
    
    // Форматируем в том же формате, что и ESP8266
    const response = {
      t: lastRecord.t !== undefined ? lastRecord.t : 0,
      h: lastRecord.h !== undefined ? lastRecord.h : 0,
      ec: lastRecord.ec !== undefined ? lastRecord.ec : 0,
      ph: lastRecord.ph !== undefined ? lastRecord.ph : 0,
      n: lastRecord.n !== undefined ? lastRecord.n : 0,
      p: lastRecord.p !== undefined ? lastRecord.p : 0,
      k: lastRecord.k !== undefined ? lastRecord.k : 0,
      v: lastRecord.v === true,
      ip: 'localhost'
    };
    
    console.log('✅ Отправка данных:', response);
    res.json(response);
  } catch (error) {
    console.error('❌ Ошибка получения текущих данных:', error);
    res.status(500).json({ v: false, error: error.message });
  }
});

// Получение истории данных
app.get('/history', (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.json({ total: 0, count: 0, data: [] });
    }
    
    const fileContent = fs.readFileSync(DATA_FILE, 'utf8').trim();
    let history = [];
    
    if (fileContent) {
      try {
        history = JSON.parse(fileContent);
        if (!Array.isArray(history)) {
          console.error('⚠️ Файл данных не является массивом, инициализируем пустым массивом');
          history = [];
          fs.writeFileSync(DATA_FILE, JSON.stringify([]));
        }
      } catch (parseError) {
        console.error('⚠️ Ошибка парсинга файла данных:', parseError.message);
        history = [];
        fs.writeFileSync(DATA_FILE, JSON.stringify([]));
      }
    }
    
    // Опциональные параметры фильтрации
    const limitParam = parseInt(req.query.limit);
    const offsetParam = parseInt(req.query.offset);
    
    // Обрабатываем отрицательные и невалидные значения
    const limit = (isNaN(limitParam) || limitParam <= 0) ? history.length : limitParam;
    const offset = (isNaN(offsetParam) || offsetParam < 0) ? 0 : offsetParam;
    
    const filtered = history.slice(offset, offset + limit);
    
    res.json({
      total: history.length,
      count: filtered.length,
      data: filtered
    });
  } catch (error) {
    console.error('❌ Ошибка чтения истории:', error);
    res.status(500).json({ error: error.message });
  }
});

// Экспорт в CSV
app.get('/export/csv', (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.status(404).send('Нет данных для экспорта');
    }
    
    const fileContent = fs.readFileSync(DATA_FILE, 'utf8').trim();
    let history = [];
    
    if (fileContent) {
      try {
        history = JSON.parse(fileContent);
        if (!Array.isArray(history)) {
          history = [];
        }
      } catch (parseError) {
        console.error('⚠️ Ошибка парсинга файла данных:', parseError.message);
        history = [];
      }
    }
    
    // Заголовки CSV
    let csv = '\ufeffДата и время,Температура (°C),Влажность (%),Электропроводность (µS/cm),pH,Азот (mg/kg),Фосфор (mg/kg),Калий (mg/kg)\n';
    
    // Данные
    history.forEach(record => {
      if (record.v && record.v === true) {
        csv += `${record.date},${record.t.toFixed(1)},${record.h.toFixed(1)},${Math.round(record.ec)},${record.ph.toFixed(1)},${Math.round(record.n)},${Math.round(record.p)},${Math.round(record.k)}\n`;
      }
    });
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=sensor_data.csv');
    res.send(csv);
  } catch (error) {
    console.error('❌ Ошибка экспорта CSV:', error);
    res.status(500).json({ error: error.message });
  }
});

// Экспорт в JSON
app.get('/export/json', (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.status(404).json({ error: 'Нет данных для экспорта' });
    }
    
    const fileContent = fs.readFileSync(DATA_FILE, 'utf8').trim();
    let history = [];
    
    if (fileContent) {
      try {
        history = JSON.parse(fileContent);
        if (!Array.isArray(history)) {
          history = [];
        }
      } catch (parseError) {
        console.error('⚠️ Ошибка парсинга файла данных:', parseError.message);
        history = [];
      }
    }
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=sensor_data.json');
    res.json(history);
  } catch (error) {
    console.error('❌ Ошибка экспорта JSON:', error);
    res.status(500).json({ error: error.message });
  }
});

// Статистика
app.get('/stats', (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.json({ total: 0, first: null, last: null });
    }
    
    const fileContent = fs.readFileSync(DATA_FILE, 'utf8').trim();
    let history = [];
    
    if (fileContent) {
      try {
        history = JSON.parse(fileContent);
        if (!Array.isArray(history)) {
          history = [];
        }
      } catch (parseError) {
        console.error('⚠️ Ошибка парсинга файла данных:', parseError.message);
        history = [];
      }
    }
    
    res.json({
      total: history.length,
      first: history.length > 0 ? history[0].date : null,
      last: history.length > 0 ? history[history.length - 1].date : null
    });
  } catch (error) {
    console.error('❌ Ошибка получения статистики:', error);
    res.status(500).json({ error: error.message });
  }
});

// Очистка данных
app.delete('/clear', (req, res) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
    console.log('🗑️ Данные очищены');
    res.json({ success: true, message: 'Данные очищены' });
  } catch (error) {
    console.error('❌ Ошибка очистки:', error);
    res.status(500).json({ error: error.message });
  }
});

// Экспорт для Vercel Serverless Function
module.exports = app;

