-- SQL скрипт для настройки таблицы в Supabase
-- Выполните этот скрипт в SQL Editor вашего проекта Supabase

-- Создание таблицы для данных датчиков
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
    v BOOLEAN DEFAULT false
);

-- Создание индекса для быстрого поиска по времени
CREATE INDEX IF NOT EXISTS idx_sensor_data_timestamp ON sensor_data(timestamp DESC);

-- Создание индекса для поиска по IP
CREATE INDEX IF NOT EXISTS idx_sensor_data_ip ON sensor_data(ip);

-- Включение Row Level Security (RLS) для безопасности
ALTER TABLE sensor_data ENABLE ROW LEVEL SECURITY;

-- Политика: разрешить чтение всем (для API)
CREATE POLICY "Allow public read access" ON sensor_data
    FOR SELECT
    USING (true);

-- Политика: разрешить вставку всем (для ESP8266)
CREATE POLICY "Allow public insert" ON sensor_data
    FOR INSERT
    WITH CHECK (true);

-- Политика: разрешить удаление всем (для очистки через API)
CREATE POLICY "Allow public delete" ON sensor_data
    FOR DELETE
    USING (true);

