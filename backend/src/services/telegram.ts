export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string
): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    if (!token || !chatId) {
      return { success: false, error: 'Telegram bot token or chat ID is missing' };
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });

    const data = (await response.json()) as any;
    if (!response.ok || !data.ok) {
      return {
        success: false,
        error: data.description || `Telegram API responded with HTTP ${response.status}`
      };
    }

    return { success: true, result: data.result };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Unknown network error sending Telegram message' };
  }
}

export function formatBlockReminder(
  title: string,
  startTime: string,
  durationMinutes: number,
  type?: string,
  category?: string | null
): string {
  const normTitle = (title || '').toLowerCase();
  const isLunch = type === 'break' && (normTitle.includes('lunch') || normTitle.includes('meal') || normTitle.includes('food'));
  const isBreak = type === 'break' && !isLunch;
  const durText = durationMinutes > 0 ? `${durationMinutes} mins` : 'Action item';

  if (isLunch) {
    return `🍱 <b>Hi! Assistant JUGNU DAS this side.</b>\n` +
           `Quick heads-up — your midday lunch break starts in 5 minutes:\n\n` +
           `🍽️ <b>${title}</b>\n` +
           `⏰ Starts at <b>${startTime}</b> (${durText})\n\n` +
           `📊 Track your progress: https://deepwork-io.pages.dev`;
  }

  if (isBreak) {
    return `☕ <b>Hi! Assistant JUGNU DAS this side.</b>\n` +
           `Quick heads-up — your recovery break starts in 5 minutes:\n\n` +
           `🌿 <b>${title}</b>\n` +
           `⏰ Starts at <b>${startTime}</b> (${durText})\n\n` +
           `📊 Track your progress: https://deepwork-io.pages.dev`;
  }

  const cat = category ? ` • <i>${category}</i>` : '';
  const icon = type === 'deep_focus' ? '⚡' : '🎯';
  const label = type === 'deep_focus' ? 'Deep Focus Session' : 'Scheduled Commitment';

  return `👋 <b>Hi! Assistant JUGNU DAS this side.</b>\n` +
         `Here is your 5-minute reminder for your next session:\n\n` +
         `${icon} <b>${label}</b>\n` +
         `🎯 <b>${title}</b>${cat}\n` +
         `⏰ Starts at <b>${startTime}</b> (${durText})\n\n` +
         `📊 Track your progress: https://deepwork-io.pages.dev`;
}

export function formatTaskReminder(
  taskTitle: string,
  startTime: string,
  durationMinutes: number,
  category?: string | null
): string {
  return formatBlockReminder(taskTitle, startTime, durationMinutes, 'task', category);
}
