-- Cloudflare D1 Migration: 0003_habits_and_weekly_goals.sql

CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 15,
    anchor TEXT CHECK(anchor IN ('morning', 'floating', 'evening')) NOT NULL DEFAULT 'morning',
    energy_level TEXT CHECK(energy_level IN ('deep_focus', 'light')) NOT NULL DEFAULT 'light',
    streak_count INTEGER NOT NULL DEFAULT 0,
    active_days TEXT DEFAULT '["M","T","W","T","F","S","S"]',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS weekly_goals (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    target_units INTEGER NOT NULL DEFAULT 5,
    completed_units INTEGER NOT NULL DEFAULT 0,
    unit_label TEXT DEFAULT 'topics',
    week_start TEXT NOT NULL,
    week_end TEXT NOT NULL,
    priority TEXT CHECK(priority IN ('LOW', 'MEDIUM', 'HIGH')) NOT NULL DEFAULT 'HIGH',
    energy_level TEXT CHECK(energy_level IN ('deep_focus', 'light')) NOT NULL DEFAULT 'deep_focus',
    goal_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
