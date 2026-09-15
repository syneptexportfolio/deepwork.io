-- Cloudflare D1 Migration: 0006_custom_habit_frequency.sql
ALTER TABLE habits ADD COLUMN frequency_type TEXT DEFAULT 'days';
ALTER TABLE habits ADD COLUMN frequency_value INTEGER;
