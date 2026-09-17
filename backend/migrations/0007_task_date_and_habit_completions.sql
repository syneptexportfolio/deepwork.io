-- Cloudflare D1 Migration: 0007_task_date_and_habit_completions.sql

ALTER TABLE tasks ADD COLUMN task_date TEXT;

UPDATE tasks SET task_date = substr(created_at, 1, 10) WHERE task_date IS NULL;

CREATE TABLE IF NOT EXISTS habit_completions (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(habit_id, date)
);
