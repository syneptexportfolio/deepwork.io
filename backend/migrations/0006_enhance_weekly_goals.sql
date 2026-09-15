-- Cloudflare D1 Migration: 0007_enhance_weekly_goals.sql
ALTER TABLE weekly_goals ADD COLUMN category TEXT DEFAULT 'Project';
