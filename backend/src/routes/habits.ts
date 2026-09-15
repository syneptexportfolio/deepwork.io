import { Hono } from 'hono';
import { Env, Habit } from '../types';
import { getTodayIST, pruneOrResetSchedule } from './schedule';

export const habitsRouter = new Hono<{ Bindings: Env }>();

function parseHabit(row: any): Habit {
  return {
    ...row,
    duration_minutes: Number(row.duration_minutes !== undefined && row.duration_minutes !== null ? row.duration_minutes : 0),
    active_days: typeof row.active_days === 'string' ? JSON.parse(row.active_days) : row.active_days || ['M','T','W','T','F','S','S'],
    is_active: Number(row.is_active),
    habit_type: row.habit_type || (row.duration_minutes > 0 ? 'timed' : 'check_off'),
    target_value: row.target_value || undefined,
    target_unit: row.target_unit || undefined,
    last_completed_date: row.last_completed_date || undefined,
    frequency_type: row.frequency_type || 'days',
    frequency_value: row.frequency_value !== null && row.frequency_value !== undefined ? Number(row.frequency_value) : undefined
  };
}

// GET /api/habits
habitsRouter.get('/', async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM habits ORDER BY anchor ASC, created_at ASC').all();
    return c.json({ success: true, habits: (results || []).map(parseHabit) });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/habits
habitsRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || `hab-${Date.now()}`;
    const title = body.title;
    if (!title) {
      return c.json({ success: false, error: 'Habit title is required' }, 400);
    }
    const habitType = body.habit_type || (body.duration_minutes && Number(body.duration_minutes) > 0 ? 'timed' : 'check_off');
    const duration = habitType === 'timed'
      ? (body.duration_minutes !== undefined && body.duration_minutes !== null ? Number(body.duration_minutes) : 15)
      : (body.duration_minutes !== undefined && body.duration_minutes !== null ? Number(body.duration_minutes) : 0);
    const targetValue = body.target_value ? String(body.target_value) : null;
    const targetUnit = body.target_unit ? String(body.target_unit) : null;
    const anchor = body.anchor || 'morning';
    const energy = body.energy_level || 'light';
    const activeDays = JSON.stringify(body.active_days || ['M','T','W','T','F','S','S']);
    const isActive = body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1;
    const frequencyType = body.frequency_type || 'days';
    const frequencyValue = body.frequency_value !== undefined && body.frequency_value !== null ? Number(body.frequency_value) : null;

    await c.env.DB.prepare(
      `INSERT INTO habits (id, title, duration_minutes, anchor, energy_level, streak_count, active_days, is_active, habit_type, target_value, target_unit, frequency_type, frequency_value)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, title, duration, anchor, energy, activeDays, isActive, habitType, targetValue, targetUnit, frequencyType, frequencyValue).run();

    const row = await c.env.DB.prepare('SELECT * FROM habits WHERE id = ?').bind(id).first();
    return c.json({ success: true, habit: parseHabit(row) }, 201);
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// PATCH /api/habits/:id
habitsRouter.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();

    const current = await c.env.DB.prepare('SELECT * FROM habits WHERE id = ?').bind(id).first<any>();
    if (!current) return c.json({ success: false, error: 'Habit not found' }, 404);

    const title = body.title !== undefined ? body.title : current.title;
    const habitType = body.habit_type !== undefined ? body.habit_type : (current.habit_type || (current.duration_minutes > 0 ? 'timed' : 'check_off'));
    const duration = body.duration_minutes !== undefined ? Number(body.duration_minutes) : current.duration_minutes;
    const targetValue = body.target_value !== undefined ? (body.target_value ? String(body.target_value) : null) : current.target_value;
    const targetUnit = body.target_unit !== undefined ? (body.target_unit ? String(body.target_unit) : null) : current.target_unit;
    const anchor = body.anchor !== undefined ? body.anchor : current.anchor;
    const energy = body.energy_level !== undefined ? body.energy_level : current.energy_level;
    const streak = body.streak_count !== undefined ? Number(body.streak_count) : current.streak_count;
    const activeDays = body.active_days !== undefined ? JSON.stringify(body.active_days) : current.active_days;
    const isActive = body.is_active !== undefined ? (body.is_active ? 1 : 0) : current.is_active;
    const lastCompletedDate = body.last_completed_date !== undefined ? body.last_completed_date : current.last_completed_date;
    const frequencyType = body.frequency_type !== undefined ? body.frequency_type : (current.frequency_type || 'days');
    const frequencyValue = body.frequency_value !== undefined ? (body.frequency_value !== null ? Number(body.frequency_value) : null) : current.frequency_value;

    await c.env.DB.prepare(
      `UPDATE habits SET 
        title = ?, 
        duration_minutes = ?, 
        anchor = ?, 
        energy_level = ?, 
        streak_count = ?, 
        active_days = ?, 
        is_active = ?,
        habit_type = ?,
        target_value = ?,
        target_unit = ?,
        last_completed_date = ?,
        frequency_type = ?,
        frequency_value = ?
       WHERE id = ?`
    ).bind(title, duration, anchor, energy, streak, activeDays, isActive, habitType, targetValue, targetUnit, lastCompletedDate, frequencyType, frequencyValue, id).run();

    const updated = await c.env.DB.prepare('SELECT * FROM habits WHERE id = ?').bind(id).first();
    return c.json({ success: true, habit: parseHabit(updated) });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/habits/:id/check (Toggles streak & today's completion status)
habitsRouter.post('/:id/check', async (c) => {
  try {
    const id = c.req.param('id');
    const current = await c.env.DB.prepare('SELECT * FROM habits WHERE id = ?').bind(id).first<any>();
    if (!current) return c.json({ success: false, error: 'Habit not found' }, 404);

    const todayIST = getTodayIST();
    const isAlreadyDoneToday = current.last_completed_date === todayIST;

    if (isAlreadyDoneToday) {
      // Toggle off: decrement streak and reset last_completed_date
      const newStreak = Math.max(0, (current.streak_count || 1) - 1);
      await c.env.DB.prepare(
        'UPDATE habits SET streak_count = ?, last_completed_date = NULL WHERE id = ?'
      ).bind(newStreak, id).run();
    } else {
      // Mark done today: increment streak and record last_completed_date
      const newStreak = (current.streak_count || 0) + 1;
      await c.env.DB.prepare(
        'UPDATE habits SET streak_count = ?, last_completed_date = ? WHERE id = ?'
      ).bind(newStreak, todayIST, id).run();
    }

    const updated = await c.env.DB.prepare('SELECT * FROM habits WHERE id = ?').bind(id).first();
    return c.json({ success: true, habit: parseHabit(updated) });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// DELETE /api/habits/:id
habitsRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM habits WHERE id = ?').bind(id).run();
    await pruneOrResetSchedule(c.env.DB, getTodayIST());
    return c.json({ success: true, message: 'Habit deleted' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});
