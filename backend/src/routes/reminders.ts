import { Hono } from 'hono';
import { Env, Task } from '../types';
import { formatTaskReminder, sendTelegramMessage } from '../services/telegram';

export const remindersRouter = new Hono<{ Bindings: Env }>();

export async function checkAndSendReminders(env: Env): Promise<{
  checked: number;
  sent: number;
  results: Array<{ taskId: string; title: string; success: boolean; error?: string }>;
}> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  const leadMinutes = parseInt(env.DEFAULT_LEAD_TIME_MINUTES || '10', 10);

  // Get current date & time in IST (UTC+5:30)
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const ist = new Date(utc + (3600000 * 5.5));
  const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
  const currentMinutes = ist.getHours() * 60 + ist.getMinutes();

  // Candidate items to check for reminders
  interface ReminderCandidate {
    id: string;
    title: string;
    startTime: string;
    durationMinutes: number;
    category?: string | null;
  }

  const candidateMap = new Map<string, ReminderCandidate>();

  // 1. Check tasks table with scheduled_start
  const { results: tasks } = await env.DB.prepare(
    'SELECT * FROM tasks WHERE status = "pending" AND scheduled_start IS NOT NULL'
  ).all<Task>();

  for (const t of (tasks || [])) {
    if (t.scheduled_start) {
      candidateMap.set(t.id, {
        id: t.id,
        title: t.title,
        startTime: t.scheduled_start,
        durationMinutes: t.duration_minutes || 30,
        category: t.category
      });
    }
  }

  // 2. Check today's AI-generated schedule timetable
  try {
    const schedRow = await env.DB.prepare(
      'SELECT generated_plan FROM schedules WHERE date = ?'
    ).bind(todayIST).first<any>();

    if (schedRow && schedRow.generated_plan) {
      const blocks: any[] = JSON.parse(schedRow.generated_plan);
      for (const b of blocks) {
        if (b.status === 'pending' && b.type !== 'break' && b.start_time) {
          const id = b.task_id || b.id;
          if (!candidateMap.has(id)) {
            candidateMap.set(id, {
              id,
              title: b.title,
              startTime: b.start_time,
              durationMinutes: b.duration || 30,
              category: b.category
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('[Reminders] Failed to read schedule blocks for reminders:', err);
  }

  const candidates = Array.from(candidateMap.values());
  const results: Array<{ taskId: string; title: string; success: boolean; error?: string }> = [];
  let sentCount = 0;

  for (const item of candidates) {
    // Parse "HH:MM"
    const parts = item.startTime.split(':');
    if (parts.length < 2) continue;
    const itemStartMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);

    // Check if task starts between now and (now + leadMinutes)
    const diffMinutes = itemStartMinutes - currentMinutes;

    if (diffMinutes >= 0 && diffMinutes <= leadMinutes) {
      // Check if reminder was already sent today for this item (IST date check)
      const alreadySent = await env.DB.prepare(
        'SELECT * FROM reminders_sent WHERE task_id = ? AND date(sent_at, "+05:30") = ?'
      ).bind(item.id, todayIST).first();

      if (!alreadySent) {
        if (!token || !chatId) {
          results.push({
            taskId: item.id,
            title: item.title,
            success: false,
            error: 'Telegram secrets not configured in environment'
          });
          continue;
        }

        const msg = formatTaskReminder(item.title, item.startTime, item.durationMinutes, item.category);
        const sendRes = await sendTelegramMessage(token, chatId, msg);

        if (sendRes.success) {
          const reminderId = `rem-${Date.now()}-${item.id}`;
          await env.DB.prepare(
            'INSERT INTO reminders_sent (id, task_id) VALUES (?, ?)'
          ).bind(reminderId, item.id).run();

          sentCount++;
          results.push({ taskId: item.id, title: item.title, success: true });
        } else {
          results.push({ taskId: item.id, title: item.title, success: false, error: sendRes.error });
        }
      }
    }
  }

  return { checked: candidates.length, sent: sentCount, results };
}

// POST /api/reminders/trigger-check (Manual trigger or test run)
remindersRouter.post('/trigger-check', async (c) => {
  try {
    const summary = await checkAndSendReminders(c.env);
    return c.json({ success: true, summary });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/reminders/test (Test sending a custom/sample Telegram notification)
remindersRouter.post('/test', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const token = body.token || c.env.TELEGRAM_BOT_TOKEN;
    const chatId = body.chatId || c.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return c.json({
        success: false,
        error: 'Telegram Bot Token and Chat ID are required. Please provide them in the request or configure them in Worker secrets.'
      }, 400);
    }

    const testMsg = `🌟 <b>deepwork.io Telegram Integration Connected!</b>\n\n` +
      `Your automated task reminders are active.\n` +
      `You will receive timely focus notifications 10 minutes before each scheduled session.\n\n` +
      `<i>"One clear commitment at a time. Protect your rhythm."</i>`;

    const res = await sendTelegramMessage(token, chatId, testMsg);
    if (!res.success) {
      return c.json({ success: false, error: res.error }, 502);
    }

    return c.json({ success: true, message: 'Test notification sent to Telegram successfully!', result: res.result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});
