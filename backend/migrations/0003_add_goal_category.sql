-- Cloudflare D1 Migration: 0004_add_goal_category.sql
ALTER TABLE goals ADD COLUMN category TEXT DEFAULT 'Exam Preparation';
