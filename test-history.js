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
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
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
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: responseData });
        }
      });
    });
    
    req.on('error', (e) => {
      reject(e);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

// Функция для отправки POST запроса (для подготовки тестовых данных)
function sendPostRequest(data) {
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

// Функция для чтения базы данных напрямую
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
    return null;
  }
}

// Сохранение резервной копии данных
let backupData = null;

function backupDatabase() {
  backupData = readDatabase();
  log('💾 Резервная копия базы данных создана', 'blue');
}

function restoreDatabase() {
  if (backupData !== null) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(backupData, null, 2));
    log('💾 База данных восстановлена из резервной копии', 'blue');
  }
}

// ============================================
// ТЕСТЫ
// ============================================

// Тест 1: Чтение пустой базы данных
async function testEmptyDatabase() {
  log('\n=== Тест 1: Чтение пустой базы данных ===', 'cyan');
  
  try {
    // Очищаем базу для теста
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
    
    const response = await sendGetRequest('/history');
    
    if (response.status !== 200) {
      log(`❌ Статус код: ${response.status} (ожидался 200)`, 'red');
      return false;
    }
    
    // Проверка структуры ответа
    const data = response.data;
    const hasTotal = typeof data.total === 'number';
    const hasCount = typeof data.count === 'number';
    const hasData = Array.isArray(data.data);
    
    log(`  Структура ответа:`, 'blue');
    log(`    - total: ${hasTotal ? '✅' : '❌'} (${data.total})`, hasTotal ? 'green' : 'red');
    log(`    - count: ${hasCount ? '✅' : '❌'} (${data.count})`, hasCount ? 'green' : 'red');
    log(`    - data: ${hasData ? '✅' : '❌'} (массив из ${data.data?.length || 0} элементов)`, hasData ? 'green' : 'red');
    
    // Проверка значений
    const correctValues = data.total === 0 && data.count === 0 && Array.isArray(data.data) && data.data.length === 0;
    log(`  Значения:`, 'blue');
    log(`    - total === 0: ${data.total === 0 ? '✅' : '❌'}`, data.total === 0 ? 'green' : 'red');
    log(`    - count === 0: ${data.count === 0 ? '✅' : '❌'}`, data.count === 0 ? 'green' : 'red');
    log(`    - data.length === 0: ${data.data.length === 0 ? '✅' : '❌'}`, data.data.length === 0 ? 'green' : 'red');
    
    const success = hasTotal && hasCount && hasData && correctValues;
    log(`\n  Результат: ${success ? '✅ ПРОЙДЕН' : '❌ ПРОВАЛЕН'}`, success ? 'green' : 'red');
    
    return success;
  } catch (error) {
    log(`❌ Ошибка: ${error.message}`, 'red');
    return false;
  }
}

// Тест 2: Чтение данных с данными
async function testReadWithData() {
  log('\n=== Тест 2: Чтение данных (с данными) ===', 'cyan');
  
  try {
    // Подготавливаем тестовые данные
    log('  Подготовка тестовых данных...', 'blue');
    const testRecords = [];
    for (let i = 0; i < 10; i++) {
      const record = {
        t: 20 + i * 0.5,
        h: 50 + i * 2,
        ec: 1000 + i * 100,
        ph: 6.0 + i * 0.1,
        n: 100 + i * 10,
        p: 50 + i * 5,
        k: 150 + i * 15,
        v: true
      };
      await sendPostRequest(record);
      testRecords.push(record);
      await new Promise(resolve => setTimeout(resolve, 50)); // Небольшая задержка для разных timestamp
    }
    
    log(`  Создано ${testRecords.length} тестовых записей`, 'green');
    
    // Получаем историю
    const response = await sendGetRequest('/history');
    
    if (response.status !== 200) {
      log(`❌ Статус код: ${response.status} (ожидался 200)`, 'red');
      return false;
    }
    
    const data = response.data;
    let allChecksPassed = true;
    
    // Проверка структуры
    log(`\n  Проверка структуры ответа:`, 'blue');
    const hasTotal = typeof data.total === 'number';
    const hasCount = typeof data.count === 'number';
    const hasData = Array.isArray(data.data);
    
    log(`    - total (number): ${hasTotal ? '✅' : '❌'}`, hasTotal ? 'green' : 'red');
    log(`    - count (number): ${hasCount ? '✅' : '❌'}`, hasCount ? 'green' : 'red');
    log(`    - data (array): ${hasData ? '✅' : '❌'}`, hasData ? 'green' : 'red');
    
    if (!hasTotal || !hasCount || !hasData) {
      allChecksPassed = false;
    }
    
    // Проверка логической согласованности
    if (hasTotal && hasCount && hasData) {
      log(`\n  Проверка логической согласованности:`, 'blue');
      const totalMatches = data.total === data.data.length;
      const countMatches = data.count === data.data.length;
      
      log(`    - total === data.length: ${totalMatches ? '✅' : '❌'} (${data.total} === ${data.data.length})`, totalMatches ? 'green' : 'red');
      log(`    - count === data.length: ${countMatches ? '✅' : '❌'} (${data.count} === ${data.data.length})`, countMatches ? 'green' : 'red');
      
      if (!totalMatches || !countMatches) {
        allChecksPassed = false;
      }
    }
    
    // Проверка формата записей
    if (hasData && data.data.length > 0) {
      log(`\n  Проверка формата записей:`, 'blue');
      const firstRecord = data.data[0];
      const requiredFields = ['timestamp', 'date', 'ip', 't', 'h', 'ec', 'ph', 'n', 'p', 'k', 'v'];
      const missingFields = requiredFields.filter(field => !(field in firstRecord));
      
      if (missingFields.length === 0) {
        log(`    - Все обязательные поля присутствуют ✅`, 'green');
      } else {
        log(`    - Отсутствуют поля: ${missingFields.join(', ')} ❌`, 'red');
        allChecksPassed = false;
      }
      
      // Проверка типов данных
      log(`\n  Проверка типов данных:`, 'blue');
      const typeChecks = [
        { field: 'timestamp', type: 'string', value: firstRecord.timestamp },
        { field: 'date', type: 'string', value: firstRecord.date },
        { field: 'ip', type: 'string', value: firstRecord.ip },
        { field: 't', type: 'number', value: firstRecord.t },
        { field: 'h', type: 'number', value: firstRecord.h },
        { field: 'ec', type: 'number', value: firstRecord.ec },
        { field: 'ph', type: 'number', value: firstRecord.ph },
        { field: 'n', type: 'number', value: firstRecord.n },
        { field: 'p', type: 'number', value: firstRecord.p },
        { field: 'k', type: 'number', value: firstRecord.k },
        { field: 'v', type: 'boolean', value: firstRecord.v }
      ];
      
      typeChecks.forEach(check => {
        const isValid = typeof check.value === check.type;
        log(`    - ${check.field} (${check.type}): ${isValid ? '✅' : '❌'} ${isValid ? '' : `(получен: ${typeof check.value})`}`, isValid ? 'green' : 'red');
        if (!isValid) {
          allChecksPassed = false;
        }
      });
      
      // Проверка валидности timestamp
      log(`\n  Проверка валидности timestamp:`, 'blue');
      try {
        const timestamp = new Date(firstRecord.timestamp);
        const isValidDate = !isNaN(timestamp.getTime());
        log(`    - timestamp валиден: ${isValidDate ? '✅' : '❌'} (${firstRecord.timestamp})`, isValidDate ? 'green' : 'red');
        if (!isValidDate) {
          allChecksPassed = false;
        }
      } catch (e) {
        log(`    - timestamp валиден: ❌ (ошибка: ${e.message})`, 'red');
        allChecksPassed = false;
      }
    }
    
    log(`\n  Результат: ${allChecksPassed ? '✅ ПРОЙДЕН' : '❌ ПРОВАЛЕН'}`, allChecksPassed ? 'green' : 'red');
    
    return allChecksPassed;
  } catch (error) {
    log(`❌ Ошибка: ${error.message}`, 'red');
    return false;
  }
}

// Тест 3: Фильтрация по limit
async function testLimitFilter() {
  log('\n=== Тест 3: Фильтрация по limit ===', 'cyan');
  
  try {
    // Получаем общее количество записей
    const allResponse = await sendGetRequest('/history');
    const totalRecords = allResponse.data.total || 0;
    
    if (totalRecords === 0) {
      log('  ⚠️ Нет данных для тестирования фильтрации', 'yellow');
      return true;
    }
    
    log(`  Всего записей в базе: ${totalRecords}`, 'blue');
    
    const testCases = [
      { limit: 1, description: 'limit=1' },
      { limit: 5, description: 'limit=5' },
      { limit: 10, description: 'limit=10' },
      { limit: 100, description: 'limit=100 (больше чем записей)' },
      { limit: 0, description: 'limit=0' },
      { limit: -5, description: 'limit=-5 (отрицательное)' }
    ];
    
    let allPassed = true;
    
    for (const testCase of testCases) {
      const response = await sendGetRequest(`/history?limit=${testCase.limit}`);
      
      if (response.status !== 200) {
        log(`  ❌ ${testCase.description}: статус ${response.status}`, 'red');
        allPassed = false;
        continue;
      }
      
      const data = response.data;
      const expectedCount = testCase.limit <= 0 ? totalRecords : Math.min(testCase.limit, totalRecords);
      const actualCount = data.count;
      const dataLength = data.data.length;
      
      const passed = actualCount === expectedCount && dataLength === expectedCount && data.total === totalRecords;
      
      log(`  ${testCase.description}:`, 'blue');
      log(`    - Ожидалось: ${expectedCount} записей`, 'blue');
      log(`    - Получено: ${actualCount} записей (data.length: ${dataLength})`, 'blue');
      log(`    - total: ${data.total} (должно быть ${totalRecords})`, 'blue');
      log(`    - Результат: ${passed ? '✅' : '❌'}`, passed ? 'green' : 'red');
      
      if (!passed) {
        allPassed = false;
      }
    }
    
    log(`\n  Результат: ${allPassed ? '✅ ПРОЙДЕН' : '❌ ПРОВАЛЕН'}`, allPassed ? 'green' : 'red');
    
    return allPassed;
  } catch (error) {
    log(`❌ Ошибка: ${error.message}`, 'red');
    return false;
  }
}

// Тест 4: Фильтрация по offset
async function testOffsetFilter() {
  log('\n=== Тест 4: Фильтрация по offset ===', 'cyan');
  
  try {
    const allResponse = await sendGetRequest('/history');
    const totalRecords = allResponse.data.total || 0;
    
    if (totalRecords < 5) {
      log('  ⚠️ Недостаточно данных для тестирования offset (нужно минимум 5 записей)', 'yellow');
      return true;
    }
    
    log(`  Всего записей в базе: ${totalRecords}`, 'blue');
    
    const testCases = [
      { offset: 0, limit: 3, description: 'offset=0, limit=3' },
      { offset: 2, limit: 3, description: 'offset=2, limit=3' },
      { offset: 5, limit: 10, description: 'offset=5, limit=10' },
      { offset: totalRecords - 2, limit: 5, description: `offset=${totalRecords - 2}, limit=5 (близко к концу)` },
      { offset: totalRecords, limit: 5, description: `offset=${totalRecords}, limit=5 (за пределами)` },
      { offset: -2, limit: 5, description: 'offset=-2, limit=5 (отрицательное)' }
    ];
    
    let allPassed = true;
    
    for (const testCase of testCases) {
      const response = await sendGetRequest(`/history?offset=${testCase.offset}&limit=${testCase.limit}`);
      
      if (response.status !== 200) {
        log(`  ❌ ${testCase.description}: статус ${response.status}`, 'red');
        allPassed = false;
        continue;
      }
      
      const data = response.data;
      const validOffset = Math.max(0, testCase.offset);
      const maxAvailable = Math.max(0, totalRecords - validOffset);
      const expectedCount = Math.min(testCase.limit, maxAvailable);
      const actualCount = data.count;
      const dataLength = data.data.length;
      
      const passed = actualCount === expectedCount && 
                     dataLength === expectedCount && 
                     data.total === totalRecords &&
                     (expectedCount === 0 || data.data.length > 0);
      
      log(`  ${testCase.description}:`, 'blue');
      log(`    - Ожидалось: ${expectedCount} записей`, 'blue');
      log(`    - Получено: ${actualCount} записей (data.length: ${dataLength})`, 'blue');
      log(`    - total: ${data.total}`, 'blue');
      log(`    - Результат: ${passed ? '✅' : '❌'}`, passed ? 'green' : 'red');
      
      if (!passed) {
        allPassed = false;
      }
    }
    
    log(`\n  Результат: ${allPassed ? '✅ ПРОЙДЕН' : '❌ ПРОВАЛЕН'}`, allPassed ? 'green' : 'red');
    
    return allPassed;
  } catch (error) {
    log(`❌ Ошибка: ${error.message}`, 'red');
    return false;
  }
}

// Тест 5: Комбинированная фильтрация (limit + offset)
async function testCombinedFilter() {
  log('\n=== Тест 5: Комбинированная фильтрация (limit + offset) ===', 'cyan');
  
  try {
    const allResponse = await sendGetRequest('/history');
    const totalRecords = allResponse.data.total || 0;
    
    if (totalRecords < 10) {
      log('  ⚠️ Недостаточно данных для тестирования (нужно минимум 10 записей)', 'yellow');
      return true;
    }
    
    log(`  Всего записей в базе: ${totalRecords}`, 'blue');
    
    // Получаем все записи для сравнения
    const allData = allResponse.data.data;
    
    const testCases = [
      { offset: 0, limit: 5, description: 'offset=0, limit=5 (первые 5)' },
      { offset: 3, limit: 4, description: 'offset=3, limit=4 (средние записи)' },
      { offset: totalRecords - 3, limit: 3, description: 'offset=total-3, limit=3 (последние 3)' }
    ];
    
    let allPassed = true;
    
    for (const testCase of testCases) {
      const response = await sendGetRequest(`/history?offset=${testCase.offset}&limit=${testCase.limit}`);
      
      if (response.status !== 200) {
        log(`  ❌ ${testCase.description}: статус ${response.status}`, 'red');
        allPassed = false;
        continue;
      }
      
      const data = response.data;
      const expectedData = allData.slice(testCase.offset, testCase.offset + testCase.limit);
      
      // Проверяем, что данные совпадают
      const dataMatches = JSON.stringify(data.data) === JSON.stringify(expectedData);
      const countMatches = data.count === expectedData.length;
      const totalMatches = data.total === totalRecords;
      
      log(`  ${testCase.description}:`, 'blue');
      log(`    - Ожидалось: ${expectedData.length} записей`, 'blue');
      log(`    - Получено: ${data.count} записей`, 'blue');
      log(`    - Данные совпадают: ${dataMatches ? '✅' : '❌'}`, dataMatches ? 'green' : 'red');
      log(`    - count совпадает: ${countMatches ? '✅' : '❌'}`, countMatches ? 'green' : 'red');
      log(`    - total совпадает: ${totalMatches ? '✅' : '❌'}`, totalMatches ? 'green' : 'red');
      
      const passed = dataMatches && countMatches && totalMatches;
      log(`    - Результат: ${passed ? '✅' : '❌'}`, passed ? 'green' : 'red');
      
      if (!passed) {
        allPassed = false;
      }
    }
    
    log(`\n  Результат: ${allPassed ? '✅ ПРОЙДЕН' : '❌ ПРОВАЛЕН'}`, allPassed ? 'green' : 'red');
    
    return allPassed;
  } catch (error) {
    log(`❌ Ошибка: ${error.message}`, 'red');
    return false;
  }
}

// Тест 6: Формат ответа (Content-Type, структура JSON)
async function testResponseFormat() {
  log('\n=== Тест 6: Формат ответа ===', 'cyan');
  
  try {
    const response = await sendGetRequest('/history');
    
    // Проверка статус кода
    const statusOk = response.status === 200;
    log(`  Статус код: ${response.status} ${statusOk ? '✅' : '❌'}`, statusOk ? 'green' : 'red');
    
    // Проверка Content-Type
    const contentType = response.headers['content-type'] || '';
    const isJson = contentType.includes('application/json') || contentType.includes('json');
    log(`  Content-Type: ${contentType} ${isJson ? '✅' : '❌'}`, isJson ? 'green' : 'yellow');
    
    // Проверка структуры JSON
    const isObject = typeof response.data === 'object' && response.data !== null;
    const hasRequiredFields = isObject && 
                              'total' in response.data && 
                              'count' in response.data && 
                              'data' in response.data;
    
    log(`  Структура JSON:`, 'blue');
    log(`    - Это объект: ${isObject ? '✅' : '❌'}`, isObject ? 'green' : 'red');
    log(`    - Есть поле 'total': ${isObject && 'total' in response.data ? '✅' : '❌'}`, isObject && 'total' in response.data ? 'green' : 'red');
    log(`    - Есть поле 'count': ${isObject && 'count' in response.data ? '✅' : '❌'}`, isObject && 'count' in response.data ? 'green' : 'red');
    log(`    - Есть поле 'data': ${isObject && 'data' in response.data ? '✅' : '❌'}`, isObject && 'data' in response.data ? 'green' : 'red');
    
    // Проверка валидности JSON (не должно быть ошибок парсинга)
    let jsonValid = true;
    try {
      JSON.stringify(response.data);
    } catch (e) {
      jsonValid = false;
      log(`    - JSON валиден: ❌ (ошибка: ${e.message})`, 'red');
    }
    
    if (jsonValid) {
      log(`    - JSON валиден: ✅`, 'green');
    }
    
    const allPassed = statusOk && hasRequiredFields && jsonValid;
    log(`\n  Результат: ${allPassed ? '✅ ПРОЙДЕН' : '❌ ПРОВАЛЕН'}`, allPassed ? 'green' : 'red');
    
    return allPassed;
  } catch (error) {
    log(`❌ Ошибка: ${error.message}`, 'red');
    return false;
  }
}

// Тест 7: Граничные случаи
async function testEdgeCases() {
  log('\n=== Тест 7: Граничные случаи ===', 'cyan');
  
  try {
    const allResponse = await sendGetRequest('/history');
    const totalRecords = allResponse.data.total || 0;
    
    log(`  Всего записей в базе: ${totalRecords}`, 'blue');
    
    const testCases = [
      { query: '?limit=abc', description: 'limit=abc (не число)', expectError: false },
      { query: '?offset=xyz', description: 'offset=xyz (не число)', expectError: false },
      { query: '?limit=1&offset=999999', description: 'offset за пределами данных', expectError: false },
      { query: '?limit=0&offset=0', description: 'limit=0, offset=0', expectError: false },
      { query: '?limit=&offset=', description: 'пустые параметры', expectError: false }
    ];
    
    let allPassed = true;
    
    for (const testCase of testCases) {
      try {
        const response = await sendGetRequest(`/history${testCase.query}`);
        
        const statusOk = response.status === 200;
        const hasStructure = response.data && 
                            typeof response.data.total === 'number' && 
                            typeof response.data.count === 'number' && 
                            Array.isArray(response.data.data);
        
        log(`  ${testCase.description}:`, 'blue');
        log(`    - Статус: ${response.status} ${statusOk ? '✅' : '❌'}`, statusOk ? 'green' : 'red');
        log(`    - Структура ответа: ${hasStructure ? '✅' : '❌'}`, hasStructure ? 'green' : 'red');
        
        if (!statusOk || !hasStructure) {
          allPassed = false;
        }
      } catch (error) {
        if (testCase.expectError) {
          log(`  ${testCase.description}: ✅ (ожидалась ошибка)`, 'green');
        } else {
          log(`  ${testCase.description}: ❌ (неожиданная ошибка: ${error.message})`, 'red');
          allPassed = false;
        }
      }
    }
    
    log(`\n  Результат: ${allPassed ? '✅ ПРОЙДЕН' : '❌ ПРОВАЛЕН'}`, allPassed ? 'green' : 'red');
    
    return allPassed;
  } catch (error) {
    log(`❌ Ошибка: ${error.message}`, 'red');
    return false;
  }
}

// Главная функция тестирования
async function runTests() {
  log('\n' + '='.repeat(60), 'cyan');
  log('ТЕСТИРОВАНИЕ GET /history', 'cyan');
  log('='.repeat(60), 'cyan');
  
  // Проверяем, запущен ли сервер
  try {
    await sendGetRequest('/stats');
    log('\n✅ Сервер доступен', 'green');
  } catch (error) {
    log('\n❌ Сервер не доступен. Убедитесь, что backend.js запущен (npm start)', 'red');
    process.exit(1);
  }
  
  // Создаем резервную копию
  backupDatabase();
  
  const results = [];
  
  // Запускаем тесты
  results.push(await testEmptyDatabase());
  results.push(await testReadWithData());
  results.push(await testLimitFilter());
  results.push(await testOffsetFilter());
  results.push(await testCombinedFilter());
  results.push(await testResponseFormat());
  results.push(await testEdgeCases());
  
  // Восстанавливаем базу данных
  restoreDatabase();
  
  // Итоги
  log('\n' + '='.repeat(60), 'cyan');
  log('ИТОГИ ТЕСТИРОВАНИЯ', 'cyan');
  log('='.repeat(60), 'cyan');
  
  const passed = results.filter(r => r === true).length;
  const total = results.length;
  
  log(`\n📊 Пройдено тестов: ${passed}/${total}`, passed === total ? 'green' : 'yellow');
  
  log(`\n📋 Детали:`, 'blue');
  const testNames = [
    '1. Чтение пустой базы данных',
    '2. Чтение данных (с данными)',
    '3. Фильтрация по limit',
    '4. Фильтрация по offset',
    '5. Комбинированная фильтрация',
    '6. Формат ответа',
    '7. Граничные случаи'
  ];
  
  testNames.forEach((name, index) => {
    const result = results[index];
    log(`  ${result ? '✅' : '❌'} ${name}`, result ? 'green' : 'red');
  });
  
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
  log(error.stack, 'red');
  process.exit(1);
});

