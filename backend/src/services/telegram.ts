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

export function formatTaskReminder(
  taskTitle: string,
  startTime: string,
  durationMinutes: number,
  category?: string | null
): string {
  const cat = category ? ` • <i>${category}</i>` : '';
  return `⚡ <b>Luma Focus Reminder</b>\n\n` +
         `🎯 <b>${taskTitle}</b>${cat}\n` +
         `⏰ Starting at <b>${startTime}</b> (${durationMinutes} mins)\n\n` +
         `<i>"One clear commitment at a time. Protect your rhythm."</i>`;
}
