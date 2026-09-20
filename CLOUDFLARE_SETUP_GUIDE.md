# 🚀 Complete Cloudflare Setup Guide for Personal Use

A beginner-friendly, step-by-step guide to hosting your own instance of **deepwork.io** on Cloudflare for **$0/month** (100% Free Tier).

Most steps are done directly inside the **[Cloudflare Dashboard](https://dash.cloudflare.com)** with clicks and copy-paste.

---

## 📋 What You Need Before Starting (Takes ~3 mins)

1. **Cloudflare Account**: [Sign up for free](https://dash.cloudflare.com/sign-up) if you don't have one.
2. **Google Gemini API Key (Free)**:
   - Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
   - Click **Create API Key** and copy it (used for AI timetable generation).
3. **App Passcode**:
   - Choose any 4-digit PIN or password (e.g., `1234` or `mysecretpin`).
4. **(Optional) Telegram Bot for Notifications**:
   - **Bot Token**: Message [@BotFather](https://t.me/botfather) on Telegram, type `/newbot`, and copy the token.
   - **Chat ID**: Message [@userinfobot](https://t.me/userinfobot) on Telegram to get your numeric ID.

---

## 🏗️ Architecture Overview

| Component | Cloudflare Service | What it does |
| :--- | :--- | :--- |
| **Database** | **Cloudflare D1** | Free serverless SQLite database storing your tasks, habits, and schedules |
| **Backend API** | **Cloudflare Worker** | Fast serverless API running Hono, AI prompts, and automated 5-minute reminder cron |
| **Frontend UI** | **Cloudflare Pages** | Modern React + Vite web dashboard accessible from desktop and mobile browser |

---

## Step 1: Create Database in Cloudflare (100% in Dashboard)

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com).
2. In the left navigation menu, click **Storage & Databases** ➔ **D1 SQL Database**.
3. Click **Create Database**.
   - Database name: `deepwork-db`
   - Click **Create**.
4. Click on your newly created `deepwork-db`, then open the **Console** tab.
5. Copy the complete SQL code below, paste it into the query box, and click **Execute**:

```sql
-- 1. Tasks Table
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
    task_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Goals Table
CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    target_date TEXT NOT NULL,
    syllabus TEXT NOT NULL,
    milestones TEXT,
    recommendation TEXT,
    category TEXT DEFAULT 'Exam Preparation',
    unit_label TEXT DEFAULT 'topics',
    total_units INTEGER DEFAULT 100,
    covered_units INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Habits Table
CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 15,
    anchor TEXT CHECK(anchor IN ('morning', 'floating', 'evening')) NOT NULL DEFAULT 'morning',
    energy_level TEXT CHECK(energy_level IN ('deep_focus', 'light')) NOT NULL DEFAULT 'light',
    streak_count INTEGER NOT NULL DEFAULT 0,
    active_days TEXT DEFAULT '["M","T","W","T","F","S","S"]',
    habit_type TEXT DEFAULT 'timed',
    target_value TEXT,
    target_unit TEXT,
    last_completed_date TEXT,
    frequency_type TEXT DEFAULT 'days',
    frequency_value INTEGER,
    month TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. Habit Daily Completions Table
CREATE TABLE IF NOT EXISTS habit_completions (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(habit_id, date)
);

-- 5. Weekly Goals Table
CREATE TABLE IF NOT EXISTS weekly_goals (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    target_units INTEGER NOT NULL DEFAULT 5,
    completed_units INTEGER NOT NULL DEFAULT 0,
    unit_label TEXT DEFAULT 'topics',
    week_start TEXT NOT NULL,
    week_end TEXT NOT NULL,
    category TEXT DEFAULT 'Project',
    priority TEXT CHECK(priority IN ('LOW', 'MEDIUM', 'HIGH')) NOT NULL DEFAULT 'HIGH',
    energy_level TEXT CHECK(energy_level IN ('deep_focus', 'light')) NOT NULL DEFAULT 'deep_focus',
    goal_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 6. Questionnaire Responses Table
CREATE TABLE IF NOT EXISTS questionnaire_responses (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    answers TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 7. Schedules Table
CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    generated_plan TEXT NOT NULL,
    source_questionnaire_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 8. Reminders Log Table
CREATE TABLE IF NOT EXISTS reminders_sent (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    sent_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(task_id) REFERENCES tasks(id)
);
```

6. In the database overview page, copy the **Database ID** (a UUID like `a9b0b7f6-3fd5-43af-a522-28a9b1b651e1`). You will need it in Step 2.

*(Optional)*: If you want starter sample habits and tasks, you can also paste and run the SQL from `backend/seeds/seed_data.sql` in the same Console.

---

## Step 2: Deploy Backend Worker

You can deploy the backend in one of two ways:

### Option A: 2-Minute Command (Simplest)
1. Open a terminal in the `backend` folder:
   ```bash
   cd backend
   npm install
   ```
2. Open `wrangler.toml` and replace `database_id` with your database ID from Step 1:
   ```toml
   database_id = "PASTE_YOUR_D1_DATABASE_ID_HERE"
   ```
3. Deploy the worker:
   ```bash
   npx wrangler login
   npm run deploy
   ```
4. Configure your secrets (terminal will prompt you for the value):
   ```bash
   npx wrangler secret put PASSCODE
   npx wrangler secret put GEMINI_API_KEY
   # Optional:
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   npx wrangler secret put TELEGRAM_CHAT_ID
   ```
5. Copy your live worker URL from terminal output (e.g., `https://deepwork-backend.<your-subdomain>.workers.dev`).

---

### Option B: Cloudflare Dashboard (Via GitHub)
If you have the code pushed to your GitHub:
1. In Cloudflare Dashboard, go to **Compute (Workers & Pages)** ➔ **Create** ➔ **Worker** ➔ **Connect to Git**.
2. Select your repository.
3. In Build settings:
   - Root directory: `backend`
   - Build command: `npx wrangler deploy`
4. Go to Worker **Settings** ➔ **Bindings**:
   - Click **Add binding** ➔ **D1 database**
   - Variable name: `DB`
   - D1 Database: Select `deepwork-db`
5. Go to Worker **Settings** ➔ **Variables and Secrets**:
   - Click **Add**:
     - `PASSCODE`: your private PIN (encrypt/secret)
     - `GEMINI_API_KEY`: your Google Gemini API key (encrypt/secret)
     - `ENVIRONMENT`: `production` (plain text)
     - `ALLOWED_ORIGIN`: `*` (plain text)
     - `DEFAULT_LEAD_TIME_MINUTES`: `5` (plain text)
     - `GEMINI_MODEL`: `gemini-1.5-flash` (plain text)
     - *(Optional)* `TELEGRAM_BOT_TOKEN` & `TELEGRAM_CHAT_ID`
6. Go to Worker **Settings** ➔ **Triggers**:
   - Under **Cron Triggers**, click **Add Trigger**:
   - Cron Expression: `*/5 * * * *` (Every 5 minutes for reminders).
7. Note down your worker URL (e.g. `https://deepwork-backend.<user>.workers.dev`).

---

## Step 3: Deploy Frontend on Cloudflare Pages (100% in Dashboard)

1. In Cloudflare Dashboard, go to **Compute (Workers & Pages)**.
2. Click **Create** ➔ **Pages** tab ➔ **Connect to Git**.
3. Select your GitHub repository.
4. Set up the build configuration:
   - **Project name**: `deepwork-io` (or any name you like)
   - **Production branch**: `main`
   - **Framework preset**: `Vite`
   - **Root directory**: `frontend`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Expand **Environment variables (advanced)** and click **Add variable**:
   - Variable name: `VITE_API_URL`
   - Value: `https://deepwork-backend.<your-subdomain>.workers.dev` *(your worker URL from Step 2)*
6. Click **Save and Deploy**.
7. Cloudflare will build the React app and give you a live URL like:
   `https://deepwork-io.pages.dev`

---

## Step 4: Access and Use Your App! 🎉

1. Open your live Pages URL (`https://your-project.pages.dev`) in any browser (or mobile phone).
2. If you set a `PASSCODE`, enter your passcode on the lock screen to unlock the app.
3. Test your setup:
   - **Tasks**: Create a new task (e.g. "Review system architecture @ 4:00 PM").
   - **Habits**: Mark habits complete and watch streak increments.
   - **Shape My Day**: Click the AI button to test Gemini schedule generation.
   - **Telegram Reminders**: If configured, send a test reminder from Settings or wait for the 5-minute cron.

---

## 🔒 Security Best Practices for Personal Use

- **Passcode**: Setting a `PASSCODE` secret protects your timetable and API endpoints from unauthorized visitors.
- **Custom Domain (Optional)**: In Cloudflare Pages and Workers, you can bind your own custom domain (e.g., `tracker.yourdomain.com`) with 1 click under **Custom Domains**.
- **CORS Lock (Optional)**: Once your Pages site is live, you can change `ALLOWED_ORIGIN` in the backend worker variables from `*` to `https://your-app.pages.dev`.

---

## ❓ Troubleshooting

| Issue | Quick Fix |
| :--- | :--- |
| **"Invalid Passcode" / Locked out** | Check the `PASSCODE` variable in Cloudflare Worker Settings ➔ Variables. |
| **Tasks not saving / 500 error** | Ensure the D1 binding variable is named exactly `DB` and points to `deepwork-db`. |
| **AI scheduling doesn't trigger** | Verify that `GEMINI_API_KEY` is added to Worker Secrets and is valid on [Google AI Studio](https://aistudio.google.com). |
| **Telegram reminders not arriving** | Make sure you initiated a conversation with your bot first by pressing `/start` in Telegram. |
