-- Упрощенный SQL скрипт для настройки таблицы в Supabase
-- Выполните этот скрипт, если предыдущий выдал ошибки о существующих политиках

-- Создание таблицы (если еще не создана)
CREATE TABLE IF NOT EXISTS sensor_data (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date TEXT NOT NULL,
    ip TEXT NOT NULL,
    t REAL,
    h REAL,
    ec REAL,
    ph REAL,
    n REAL,
    p REAL,
    k REAL,
    ws REAL,
    wd TEXT,
    rain REAL,
    v BOOLEAN DEFAULT false
);

-- Создание индексов (если еще не созданы)
CREATE INDEX IF NOT EXISTS idx_sensor_data_timestamp ON sensor_data(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sensor_data_ip ON sensor_data(ip);

-- Включение RLS
ALTER TABLE sensor_data ENABLE ROW LEVEL SECURITY;

-- Удаление старых политик (безопасно, даже если их нет)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow public read access" ON sensor_data;
    DROP POLICY IF EXISTS "Allow public insert" ON sensor_data;
    DROP POLICY IF EXISTS "Allow public delete" ON sensor_data;
END $$;

-- Создание новых политик
CREATE POLICY "Allow public read access" ON sensor_data
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON sensor_data
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public delete" ON sensor_data
    FOR DELETE USING (true);

