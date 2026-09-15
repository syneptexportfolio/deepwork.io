-- Cloudflare D1 Migration: 0001_initial_schema.sql

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT CHECK(type IN ('daily', 'goal')) NOT NULL DEFAULT 'daily',
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    priority TEXT CHECK(priority IN ('LOW', 'MEDIUM', 'HIGH')) NOT NULL DEFAULT 'MEDIUM',
    energy_level TEXT CHECK(energy_level IN ('deep_focus', 'light')) NOT NULL DEFAULT 'deep_focus',
    status TEXT CHECK(status IN ('pending', 'done', 'skipped', 'missed')) NOT NULL DEFAULT 'pending',
    scheduled_start TEXT,
    scheduled_end TEXT,
    category TEXT,
    goal_id TEXT,
    column_bucket TEXT CHECK(column_bucket IN ('now', 'up_next', 'later')) DEFAULT 'now',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    target_date TEXT NOT NULL,
    syllabus TEXT NOT NULL, -- JSON array of topics
    milestones TEXT,       -- JSON array of milestones
    recommendation TEXT,   -- AI advice text
    unit_label TEXT DEFAULT 'topics',
    total_units INTEGER DEFAULT 100,
    covered_units INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS questionnaire_responses (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    answers TEXT NOT NULL, -- JSON string
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    generated_plan TEXT NOT NULL, -- JSON string
    source_questionnaire_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reminders_sent (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    sent_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(task_id) REFERENCES tasks(id)
);
