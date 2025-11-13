-- Миграционный SQL скрипт для добавления полей метеостанции
-- Выполните этот скрипт в SQL Editor вашего проекта Supabase
-- Безопасно для повторного выполнения (использует IF NOT EXISTS)

-- Добавление полей для метеостанции к существующей таблице
ALTER TABLE sensor_data 
ADD COLUMN IF NOT EXISTS ws REAL,
ADD COLUMN IF NOT EXISTS wd TEXT,
ADD COLUMN IF NOT EXISTS rain REAL;

-- Комментарии к полям
COMMENT ON COLUMN sensor_data.ws IS 'Скорость ветра (км/ч)';
COMMENT ON COLUMN sensor_data.wd IS 'Направление ветра (N, NE, E, SE, S, SW, NW, W)';
COMMENT ON COLUMN sensor_data.rain IS 'Осадки (мм)';

