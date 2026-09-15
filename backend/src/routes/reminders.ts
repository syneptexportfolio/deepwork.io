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

  // Get current time in IST (UTC+5:30)
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const ist = new Date(utc + (3600000 * 5.5));
  const currentMinutes = ist.getHours() * 60 + ist.getMinutes();

  // Find tasks that have scheduled_start
  const { results: tasks } = await env.DB.prepare(
    'SELECT * FROM tasks WHERE status = "pending" AND scheduled_start IS NOT NULL'
  ).all<Task>();

  const results: Array<{ taskId: string; title: string; success: boolean; error?: string }> = [];
  let sentCount = 0;

  for (const task of (tasks || [])) {
    if (!task.scheduled_start) continue;

    // Parse "HH:MM"
    const parts = task.scheduled_start.split(':');
    if (parts.length < 2) continue;
    const taskStartMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);

    // Check if task starts between now and (now + leadMinutes)
    const diffMinutes = taskStartMinutes - currentMinutes;

    // Trigger reminder if starting within lead window (e.g., 0 to 10 minutes from now)
    if (diffMinutes >= 0 && diffMinutes <= leadMinutes) {
      // Check if reminder was already sent today for this task
      const alreadySent = await env.DB.prepare(
        'SELECT * FROM reminders_sent WHERE task_id = ? AND date(sent_at) = date("now")'
      ).bind(task.id).first();

      if (!alreadySent) {
        if (!token || !chatId) {
          results.push({
            taskId: task.id,
            title: task.title,
            success: false,
            error: 'Telegram secrets not configured in environment'
          });
          continue;
        }

        const msg = formatTaskReminder(task.title, task.scheduled_start, task.duration_minutes, task.category);
        const sendRes = await sendTelegramMessage(token, chatId, msg);

        if (sendRes.success) {
          const reminderId = `rem-${Date.now()}-${task.id}`;
          await env.DB.prepare(
            'INSERT INTO reminders_sent (id, task_id) VALUES (?, ?)'
          ).bind(reminderId, task.id).run();

          sentCount++;
          results.push({ taskId: task.id, title: task.title, success: true });
        } else {
          results.push({ taskId: task.id, title: task.title, success: false, error: sendRes.error });
        }
      }
    }
  }

  return { checked: (tasks || []).length, sent: sentCount, results };
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

    const testMsg = `🌟 <b>Luma Telegram Integration Connected!</b>\n\n` +
      `Your automated task reminders are active.\n` +
      `You will receive timely focus notifications 10 minutes before each scheduled session.\n\n` +
      `<i>"Make today count."</i>`;

    const res = await sendTelegramMessage(token, chatId, testMsg);
    if (!res.success) {
      return c.json({ success: false, error: res.error }, 502);
    }

    return c.json({ success: true, message: 'Test notification sent to Telegram successfully!', result: res.result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});
