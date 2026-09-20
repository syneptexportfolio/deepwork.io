# deepwork.io — Personal Task & Timetable Assistant

A single-user personal task & timetable assistant with AI cognitive rhythm scheduling, habit tracking, and Telegram reminders.

* **Frontend**: React + Vite + Tailwind CSS (Cloudflare Pages: `deepwork-io.pages.dev`)
* **Backend**: Cloudflare Worker + Hono (`deepwork-backend.syneptexportfolio.workers.dev`)
* **Database**: Cloudflare D1 (SQLite)
* **AI Scheduler**: Google Gemini 1.5 Flash (with smart local fallback engine)

> 📖 **Deploying for personal use?** Follow the step-by-step [Cloudflare Setup Guide](file:///e:/SYNEPTEX%20PORTFOLIO/Tracker/CLOUDFLARE_SETUP_GUIDE.md) to set it up with your own credentials on Cloudflare for $0/mo.

---

## ⚡ Quick Start (Run Locally in 2 Steps)

### Step 1: Start Backend (Terminal 1)
```bash
cd backend
npm install
npm run d1:migrate   # Setup local SQLite database
npm run dev          # Starts worker on http://127.0.0.1:8787
```

### Step 2: Start Frontend (Terminal 2)
```bash
cd frontend
npm install
npm run dev          # Starts app on http://localhost:5173
```

👉 Open **[http://localhost:5173](http://localhost:5173)** in your browser. Done!

---

## 🚀 Deploy to Cloudflare

Deploy updates to live production in just two commands:

### 1. Deploy Backend Worker
```bash
cd backend
npm run deploy
```
*Live Worker:* `https://deepwork-backend.syneptexportfolio.workers.dev`

### 2. Deploy Frontend Pages
```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name deepwork-io
```
*Live App:* `https://deepwork-io.pages.dev`

---

## 🔑 Optional Configuration & Secrets

Add these optional secrets to your worker anytime:

```bash
cd backend

# 1. AI Timetable Generation (Gemini 1.5 Flash key from Google AI Studio)
npx wrangler secret put GEMINI_API_KEY

# 2. Telegram Reminders (from @BotFather and your Telegram chat ID)
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID

# 3. App Passcode (Locks app with a pin screen; leave unset for open access)
npx wrangler secret put PASSCODE
```

---

## 🛠️ Helpful Commands

| Action | Command (from `backend`) | Description |
| :--- | :--- | :--- |
| **Run local worker** | `npm run dev` | Local API server with local D1 database |
| **Deploy worker** | `npm run deploy` | Push backend updates to Cloudflare Workers |
| **Apply local DB migrations** | `npm run d1:migrate` | Updates local SQLite database schema |
| **Seed local demo data** | `npm run d1:seed` | Populates sample tasks, habits & roadmaps |
| **Apply production DB migrations** | `npm run d1:migrate:prod` | Runs migrations on live Cloudflare D1 |

| Action | Command (from `frontend`) | Description |
| :--- | :--- | :--- |
| **Run local web app** | `npm run dev` | Starts Vite dev server on port 5173 |
| **Build for production** | `npm run build` | Compiles type-checked bundle into `/dist` |
| **Deploy to Pages** | `npx wrangler pages deploy dist --project-name deepwork-io` | Deploys `/dist` to Cloudflare Pages |

