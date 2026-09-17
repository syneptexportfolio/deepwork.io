-- Cloudflare D1 Migration: 0008_month_and_week_scoping.sql

ALTER TABLE habits ADD COLUMN month TEXT;

UPDATE habits SET month = substr(created_at, 1, 7) WHERE month IS NULL;
