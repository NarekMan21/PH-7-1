// Модуль для работы с Supabase
const { createClient } = require('@supabase/supabase-js');

// Инициализация Supabase клиента
let supabase = null;

function initSupabase() {
  if (!supabase && process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    console.log('✅ Supabase клиент инициализирован');
  }
  return supabase;
}

// Получить все записи
async function getAllRecords() {
  const client = initSupabase();
  if (!client) {
    return [];
  }

  try {
    const allRecords = [];
    let offset = 0;
    const pageSize = 1000; // Supabase ограничивает до 1000 записей за запрос
    let hasMore = true;

    console.log('📥 Начинаю загрузку всех записей из Supabase...');

    while (hasMore) {
      const { data, error } = await client
        .from('sensor_data')
        .select('*')
        .order('timestamp', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error('❌ Ошибка получения данных из Supabase:', error);
        break;
      }

      if (data && data.length > 0) {
        allRecords.push(...data);
        offset += pageSize;
        console.log(`   Загружено ${allRecords.length} записей...`);
        
        // Если получили меньше записей, чем запрашивали, значит это последняя страница
        if (data.length < pageSize) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`✅ Всего загружено ${allRecords.length} записей из Supabase`);
    return allRecords;
  } catch (error) {
    console.error('❌ Исключение при получении данных:', error);
    return [];
  }
}

// Получить записи с фильтрацией
async function getRecords(limit, offset) {
  const client = initSupabase();
  if (!client) {
    return [];
  }

  try {
    // Если limit = 0 или не указан, получаем все записи через пагинацию
    if (limit === 0 || !limit) {
      return await getAllRecords();
    }

    let query = client
      .from('sensor_data')
      .select('*')
      .order('timestamp', { ascending: true });

    if (offset > 0) {
      query = query.range(offset, offset + limit - 1);
    } else if (limit > 0) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Ошибка получения данных из Supabase:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Исключение при получении данных:', error);
    return [];
  }
}

// Получить количество записей
async function getRecordsCount() {
  const client = initSupabase();
  if (!client) {
    return 0;
  }

  try {
    const { count, error } = await client
      .from('sensor_data')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('❌ Ошибка подсчета записей:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('❌ Исключение при подсчете записей:', error);
    return 0;
  }
}

// Сохранить новую запись
async function saveRecord(record) {
  const client = initSupabase();
  if (!client) {
    return false;
  }

  try {
    const { data, error } = await client
      .from('sensor_data')
      .insert([record])
      .select();

    if (error) {
      console.error('❌ Ошибка сохранения в Supabase:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Исключение при сохранении:', error);
    return false;
  }
}

// Получить последнюю запись
async function getLastRecord() {
  const client = initSupabase();
  if (!client) {
    return null;
  }

  try {
    const { data, error } = await client
      .from('sensor_data')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Нет записей
        return null;
      }
      console.error('❌ Ошибка получения последней записи:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ Исключение при получении последней записи:', error);
    return null;
  }
}

// Очистить все записи
async function clearAllRecords() {
  const client = initSupabase();
  if (!client) {
    return false;
  }

  try {
    const { error } = await client
      .from('sensor_data')
      .delete()
      .neq('id', 0); // Удалить все записи

    if (error) {
      console.error('❌ Ошибка очистки данных:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Исключение при очистке данных:', error);
    return false;
  }
}

// Получить статистику
async function getStats() {
  const client = initSupabase();
  if (!client) {
    return { total: 0, first: null, last: null };
  }

  try {
    const { count, error: countError } = await client
      .from('sensor_data')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Ошибка подсчета:', countError);
      return { total: 0, first: null, last: null };
    }

    // Получаем первую запись
    const { data: firstData, error: firstError } = await client
      .from('sensor_data')
      .select('date')
      .order('timestamp', { ascending: true })
      .limit(1)
      .single();

    // Получаем последнюю запись
    const { data: lastData, error: lastError } = await client
      .from('sensor_data')
      .select('date')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    return {
      total: count || 0,
      first: firstData?.date || null,
      last: lastData?.date || null
    };
  } catch (error) {
    console.error('❌ Исключение при получении статистики:', error);
    return { total: 0, first: null, last: null };
  }
}

module.exports = {
  initSupabase,
  getAllRecords,
  getRecords,
  getRecordsCount,
  saveRecord,
  getLastRecord,
  clearAllRecords,
  getStats
};

