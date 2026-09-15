-- Cloudflare D1 Migration: 0005_enhance_habits.sql
ALTER TABLE habits ADD COLUMN habit_type TEXT DEFAULT 'timed';
ALTER TABLE habits ADD COLUMN target_value TEXT;
ALTER TABLE habits ADD COLUMN target_unit TEXT;
ALTER TABLE habits ADD COLUMN last_completed_date TEXT;
