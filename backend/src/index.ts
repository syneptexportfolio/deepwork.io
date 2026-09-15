import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types';
import { tasksRouter } from './routes/tasks';
import { goalsRouter } from './routes/goals';
import { scheduleRouter } from './routes/schedule';
import { remindersRouter, checkAndSendReminders } from './routes/reminders';
import { statsRouter } from './routes/stats';
import { habitsRouter } from './routes/habits';
import { weeklyGoalsRouter } from './routes/weekly_goals';
import { passcodeAuth } from './middleware/auth';

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for frontend
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'X-Passcode', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']
}));

// Public Health Check & Config Status
app.get('/api/health', (c) => {
  const now = new Date();
  return c.json({
    status: 'ok',
    app: 'Luma Personal Task & Timetable Assistant',
    environment: c.env.ENVIRONMENT || 'development',
    timeIST: now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
    dateIST: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now),
    hasPasscode: Boolean(c.env.PASSCODE && c.env.PASSCODE.trim() !== ''),
    hasGeminiKey: Boolean(c.env.GEMINI_API_KEY && c.env.GEMINI_API_KEY.trim() !== ''),
    hasTelegramConfig: Boolean(c.env.TELEGRAM_BOT_TOKEN && c.env.TELEGRAM_CHAT_ID)
  });
});

// Passcode Verification Endpoint
app.post('/api/auth/verify', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const entered = body.passcode;
  const configured = c.env.PASSCODE;

  if (!configured || configured.trim() === '') {
    return c.json({ success: true, required: false });
  }

  if (entered === configured) {
    return c.json({ success: true, required: true });
  }

  return c.json({ success: false, required: true, error: 'Invalid passcode' }, 401);
});

// Protected API Routes
app.use('/api/*', passcodeAuth);

app.route('/api/tasks', tasksRouter);
app.route('/api/goals', goalsRouter);
app.route('/api/habits', habitsRouter);
app.route('/api/weekly-goals', weeklyGoalsRouter);
app.route('/api/schedule', scheduleRouter);
app.route('/api/reminders', remindersRouter);
app.route('/api/stats', statsRouter);

export default {
  fetch: app.fetch,

  // Cloudflare Cron Trigger (Runs every 5 minutes)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`[Luma Cron Trigger] Fired at ${event.cron} (${new Date().toISOString()})`);
    ctx.waitUntil(
      checkAndSendReminders(env).then((summary) => {
        console.log(`[Luma Cron Trigger] Reminders evaluated: ${summary.checked}, Sent: ${summary.sent}`);
      }).catch((err) => {
        console.error('[Luma Cron Trigger] Error running reminder job:', err);
      })
    );
  }
};
