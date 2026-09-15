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

-- Seed initial monthly habits
INSERT INTO habits (id, title, duration_minutes, anchor, energy_level, streak_count, active_days, is_active) VALUES
('hab-1', 'Morning planning & mindset', 15, 'morning', 'light', 14, '["M","T","W","T","F","S","S"]', 1),
('hab-2', 'Organic chemistry & formula flashcards', 25, 'floating', 'light', 9, '["M","T","W","T","F","S","S"]', 1),
('hab-3', 'Night review & reading', 30, 'evening', 'light', 21, '["M","T","W","T","F","S","S"]', 1);

-- Seed initial weekly goals for current week
INSERT INTO weekly_goals (id, title, target_units, completed_units, unit_label, week_start, week_end, priority, energy_level, goal_id) VALUES
('wg-1', 'Calculus: 6 Integration topics', 6, 3, 'topics', '2026-09-08', '2026-09-14', 'HIGH', 'deep_focus', 'goal-jee'),
('wg-2', 'Physics: 40 EM field problems', 40, 24, 'problems', '2026-09-08', '2026-09-14', 'HIGH', 'deep_focus', 'goal-jee'),
('wg-3', 'Data Structures: 4 Linked list algorithms', 4, 2, 'algorithms', '2026-09-08', '2026-09-14', 'MEDIUM', 'deep_focus', 'goal-ds');
