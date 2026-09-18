# deepwork.io — Personal Task & Timetable Assistant

A single-user personal task & timetable assistant built on Cloudflare's free-tier stack:
- **Frontend**: React + Vite + Tailwind CSS (Deployed on **Cloudflare Pages**)
- **Backend API**: Cloudflare Worker with Hono routing & scheduled Cron Triggers
- **Database**: Cloudflare D1 (SQLite)
- **AI Scheduling**: Google Gemini API (Flash model via Google AI Studio) with smart cognitive rhythm fallback
- **Reminders**: Telegram Bot API triggered every 5 minutes by Cloudflare Cron Triggers

---

## Design System & Mockup Alignment

The frontend is faithfully designed according to the core Luma design system:
1. **Overview**: Executive pulse metrics, 7-day timetable matrix, and synchronized dual monthly performance curves (Habit Points & Timetable Task Points).
2. **Daily plan**: Interactive weekday strip, chronologically sorted timetable sequence with timeline spine, hero spotlight card with focus timer, and unified Execution Horizons radar hub.
3. **Tasks**: Streamlined Today's To-Dos, Monthly Habits, and Weekly Sprint Target Goals with compact filter rows and 1-click rollover.
4. **Learning paths**: Donut progress ring, syllabus topic checklist (`COVERED`, `NEXT UP`), roadmap milestones, and curriculum navigation.
5. **Shape my day modal**: AI timetable synthesis with core working hours (`09:00 - 17:00`), lunch break protection, and outside-work-hours commitment scheduling.

---

## Local Development

### 1. Backend (Cloudflare Worker + Local D1)

```bash
cd backend
npm install

# Run D1 migrations locally (creates SQLite database in .wrangler)
npm run d1:migrate
npm run d1:seed

# Start the worker dev server on port 8787
npm run dev
```

### 2. Frontend (React + Vite)

In a separate terminal:

```bash
cd frontend
npm install

# Start Vite dev server on port 5173 (proxies /api to http://127.0.0.1:8787)
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## Cloudflare Deployment Steps

### 1. Cloudflare D1 Database Setup

Create the remote D1 database:

```bash
cd backend
npx wrangler d1 create luma-db
```

Wrangler will output the `database_id`. Update `backend/wrangler.toml` with this ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "luma-db"
database_id = "<YOUR_D1_DATABASE_ID>"
migrations_dir = "migrations"
```

Apply migrations to production D1:

```bash
npm run d1:migrate:prod
npm run d1:seed:prod
```

### 2. Set Worker Environment Secrets

Set your Google Gemini API key (from Google AI Studio) and Telegram credentials:

```bash
npx wrangler secret put GEMINI_API_KEY
# Enter your Gemini Flash API key

npx wrangler secret put TELEGRAM_BOT_TOKEN
# Enter token from @BotFather (e.g. 123456789:ABCdef...)

npx wrangler secret put TELEGRAM_CHAT_ID
# Enter your Telegram user chat ID (e.g. 987654321)

npx wrangler secret put PASSCODE
# Enter your single-user personal passcode (optional, leaves app open if unset)
```

### 3. Deploy the Cloudflare Worker

```bash
npm run deploy
```

This deploys:
- The REST API to `https://luma-backend.<your-subdomain>.workers.dev`
- The Cloudflare Cron Trigger running every 5 minutes (`*/5 * * * *`)

### 4. Deploy Frontend to Cloudflare Pages

#### Option A: Direct Git integration via Cloudflare Dashboard
1. Go to **Cloudflare Dashboard** > **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
2. Set **Root directory**: `frontend`
3. Set **Build command**: `npm run build`
4. Set **Build output directory**: `dist`
5. In **Environment Variables**, add:
   - `VITE_API_URL`: `https://luma-backend.<your-subdomain>.workers.dev` (or configure a Pages `_routes.json` or proxy rule).

#### Option B: Direct CLI deploy via Wrangler
```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name luma-assistant
```

---

## Database Schema Reference (`0001_initial_schema.sql`)

```sql
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
    syllabus TEXT NOT NULL,
    milestones TEXT,
    recommendation TEXT,
    unit_label TEXT DEFAULT 'topics',
    total_units INTEGER DEFAULT 100,
    covered_units INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS questionnaire_responses (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    answers TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    generated_plan TEXT NOT NULL,
    source_questionnaire_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reminders_sent (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    sent_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(task_id) REFERENCES tasks(id)
);
```

---

## Telegram & Cron Reminders Architecture

1. Cloudflare Cron Trigger triggers `scheduled()` in `src/index.ts` every 5 minutes (`*/5 * * * *`).
2. Queries all tasks starting within the next 10 minutes in IST.
3. Queries `reminders_sent` table to prevent sending duplicate notifications for the same task.
4. Dispatches HTML-formatted message via Telegram Bot API `sendMessage`.
5. Logs execution in `reminders_sent`.
6. You can also test Telegram integration anytime via the **Settings modal** in the app using the "Send Test Alert" or "Trigger Cron Check Now" buttons.
