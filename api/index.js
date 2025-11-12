// Vercel Serverless Function - точка входа для всех API запросов
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const db = require('../lib/db');

const app = express();
const DATA_FILE = path.join('/tmp', 'sensor_data.json');

// Проверяем, используется ли Supabase
const USE_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);

// Middleware
app.use(cors());
app.use(express.json());
app.set('trust proxy', true);

// Статические файлы - обслуживаем через Express на Vercel
app.use(express.static(path.join(__dirname, '..'), {
  index: ['index.html'],
  extensions: ['html', 'js', 'css', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico']
}));

// Инициализация файла данных (fallback для локальной разработки)
if (!USE_SUPABASE) {
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
}

// Инициализация Supabase
if (USE_SUPABASE) {
  db.initSupabase();
  console.log('✅ Используется Supabase для хранения данных');
} else {
  console.log('⚠️ Используется файловое хранилище (fallback)');
}

// Вспомогательная функция для чтения из файла (fallback)
function readFromFile() {
  if (!fs.existsSync(DATA_FILE)) {
    return [];
  }
  try {
    const fileContent = fs.readFileSync(DATA_FILE, 'utf8').trim();
    if (!fileContent) {
      return [];
    }
    const data = JSON.parse(fileContent);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('⚠️ Ошибка чтения файла:', error.message);
    return [];
  }
}

// Вспомогательная функция для записи в файл (fallback)
function writeToFile(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('⚠️ Ошибка записи файла:', error.message);
    return false;
  }
}

// Сохранение данных от ESP8266
app.post('/save', async (req, res) => {
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
    
    if (USE_SUPABASE) {
      // Сохраняем в Supabase
      const success = await db.saveRecord(record);
      if (!success) {
        return res.status(500).json({ success: false, error: 'Ошибка сохранения в базу данных' });
      }
      
      const count = await db.getRecordsCount();
      console.log(`✅ Данные сохранены в Supabase. Всего записей: ${count}`);
      res.json({ success: true, count });
    } else {
      // Fallback: сохраняем в файл
      let history = readFromFile();
      history.push(record);
      
      // Ограничиваем историю до 10000 записей
      if (history.length > 10000) {
        history = history.slice(-10000);
      }
      
      writeToFile(history);
      console.log(`✅ Данные сохранены в файл. Всего записей: ${history.length}`);
      res.json({ success: true, count: history.length });
    }
  } catch (error) {
    console.error('❌ Ошибка сохранения:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Получение текущих данных (последняя запись)
app.get('/api', async (req, res) => {
  try {
    let lastRecord = null;
    
    if (USE_SUPABASE) {
      lastRecord = await db.getLastRecord();
    } else {
      const history = readFromFile();
      if (history.length > 0) {
        lastRecord = history[history.length - 1];
      }
    }
    
    if (!lastRecord) {
      console.log('⚠️ История данных пуста');
      return res.json({ v: false, error: 'История данных пуста' });
    }
    
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
      ip: lastRecord.ip || 'localhost'
    };
    
    console.log('✅ Отправка данных:', response);
    res.json(response);
  } catch (error) {
    console.error('❌ Ошибка получения текущих данных:', error);
    res.status(500).json({ v: false, error: error.message });
  }
});

// Получение истории данных
app.get('/history', async (req, res) => {
  try {
    let history = [];
    let total = 0;
    
    if (USE_SUPABASE) {
      // Опциональные параметры фильтрации
      const limitParam = parseInt(req.query.limit);
      const offsetParam = parseInt(req.query.offset);
      
      const limit = (isNaN(limitParam) || limitParam <= 0) ? 0 : limitParam;
      const offset = (isNaN(offsetParam) || offsetParam < 0) ? 0 : offsetParam;
      
      total = await db.getRecordsCount();
      history = await db.getRecords(limit || total, offset);
    } else {
      history = readFromFile();
      total = history.length;
      
      // Опциональные параметры фильтрации
      const limitParam = parseInt(req.query.limit);
      const offsetParam = parseInt(req.query.offset);
      
      const limit = (isNaN(limitParam) || limitParam <= 0) ? history.length : limitParam;
      const offset = (isNaN(offsetParam) || offsetParam < 0) ? 0 : offsetParam;
      
      history = history.slice(offset, offset + limit);
    }
    
    res.json({
      total,
      count: history.length,
      data: history
    });
  } catch (error) {
    console.error('❌ Ошибка чтения истории:', error);
    res.status(500).json({ error: error.message });
  }
});

// Экспорт в CSV
app.get('/export/csv', async (req, res) => {
  try {
    let history = [];
    
    if (USE_SUPABASE) {
      history = await db.getAllRecords();
    } else {
      history = readFromFile();
    }
    
    if (history.length === 0) {
      return res.status(404).send('Нет данных для экспорта');
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
app.get('/export/json', async (req, res) => {
  try {
    let history = [];
    
    if (USE_SUPABASE) {
      history = await db.getAllRecords();
    } else {
      history = readFromFile();
    }
    
    if (history.length === 0) {
      return res.status(404).json({ error: 'Нет данных для экспорта' });
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
app.get('/stats', async (req, res) => {
  try {
    let stats = { total: 0, first: null, last: null };
    
    if (USE_SUPABASE) {
      stats = await db.getStats();
    } else {
      const history = readFromFile();
      stats = {
        total: history.length,
        first: history.length > 0 ? history[0].date : null,
        last: history.length > 0 ? history[history.length - 1].date : null
      };
    }
    
    res.json(stats);
  } catch (error) {
    console.error('❌ Ошибка получения статистики:', error);
    res.status(500).json({ error: error.message });
  }
});

// Очистка данных
app.delete('/clear', async (req, res) => {
  try {
    if (USE_SUPABASE) {
      const success = await db.clearAllRecords();
      if (!success) {
        return res.status(500).json({ error: 'Ошибка очистки базы данных' });
      }
      console.log('🗑️ Данные очищены из Supabase');
    } else {
      writeToFile([]);
      console.log('🗑️ Данные очищены из файла');
    }
    
    res.json({ success: true, message: 'Данные очищены' });
  } catch (error) {
    console.error('❌ Ошибка очистки:', error);
    res.status(500).json({ error: error.message });
  }
});

// Экспорт для Vercel Serverless Function
module.exports = app;
