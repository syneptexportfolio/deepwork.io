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
    frequency_value: row.frequency_value !== null && row.frequency_value !== undefined ? Number(row.frequency_value) : undefined,
    month: row.month || undefined,
  };
}

function getYesterdayIST(todayIST: string): string {
  const [y, m, d] = todayIST.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().split('T')[0];
}

// GET /api/habits
habitsRouter.get('/', async (c) => {
  try {
    const todayIST = getTodayIST();
    const yesterdayIST = getYesterdayIST(todayIST);
    const targetMonth = c.req.query('month') || todayIST.slice(0, 7);

    const { results } = await c.env.DB.prepare(
      'SELECT * FROM habits WHERE month = ? OR (month IS NULL AND substr(created_at, 1, 7) = ?) ORDER BY anchor ASC, created_at ASC'
    ).bind(targetMonth, targetMonth).all();
    const rawHabits: any[] = results || [];

    // Streak auto-break check:
    // If last_completed_date is strictly before yesterdayIST and streak_count > 0, streak is broken
    const habits: any[] = [];
    for (const h of rawHabits) {
      if (h.streak_count > 0 && h.last_completed_date && h.last_completed_date < yesterdayIST) {
        await c.env.DB.prepare('UPDATE habits SET streak_count = 0 WHERE id = ?').bind(h.id).run();
        habits.push({ ...h, streak_count: 0 });
      } else {
        habits.push(h);
      }
    }

    return c.json({ success: true, habits: habits.map(parseHabit), month: targetMonth });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/habits/copy-previous (Copy habits from previous month into current month)
habitsRouter.post('/copy-previous', async (c) => {
  try {
    const todayIST = getTodayIST();
    const currentMonth = todayIST.slice(0, 7);

    // Calculate previous month string (YYYY-MM)
    const [y, m] = currentMonth.split('-').map(Number);
    const prevD = new Date(Date.UTC(y, m - 2, 1));
    const prevMonthStr = prevD.toISOString().slice(0, 7);

    const { results } = await c.env.DB.prepare(
      'SELECT * FROM habits WHERE month = ? OR (month IS NULL AND substr(created_at, 1, 7) = ?) ORDER BY anchor ASC, created_at ASC'
    ).bind(prevMonthStr, prevMonthStr).all<any>();

    const prevHabits = results || [];
    if (prevHabits.length === 0) {
      return c.json({ success: false, error: `No habits found in previous month (${prevMonthStr}) to copy` }, 404);
    }

    const copiedHabits: Habit[] = [];
    for (let i = 0; i < prevHabits.length; i++) {
      const ph = prevHabits[i];
      const newId = `hab-${Date.now()}-${i}`;
      await c.env.DB.prepare(
        `INSERT INTO habits (id, title, duration_minutes, anchor, energy_level, streak_count, active_days, is_active, habit_type, target_value, target_unit, frequency_type, frequency_value, month)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        newId, ph.title, ph.duration_minutes, ph.anchor, ph.energy_level,
        typeof ph.active_days === 'string' ? ph.active_days : JSON.stringify(ph.active_days || ['M','T','W','T','F','S','S']),
        ph.is_active !== undefined ? ph.is_active : 1,
        ph.habit_type || 'check_off',
        ph.target_value || null,
        ph.target_unit || null,
        ph.frequency_type || 'days',
        ph.frequency_value !== undefined ? ph.frequency_value : null,
        currentMonth
      ).run();

      const inserted = await c.env.DB.prepare('SELECT * FROM habits WHERE id = ?').bind(newId).first();
      if (inserted) copiedHabits.push(parseHabit(inserted));
    }

    return c.json({ success: true, habits: copiedHabits, count: copiedHabits.length });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/habits/monthly-points?month=YYYY-MM
habitsRouter.get('/monthly-points', async (c) => {
  try {
    const todayIST = getTodayIST();
    const monthParam = c.req.query('month') || todayIST.slice(0, 7); // 'YYYY-MM'
    const [yStr, mStr] = monthParam.split('-');
    const year = Number(yStr);
    const month = Number(mStr);
    const daysInMonth = new Date(year, month, 0).getDate();

    // Get active habits for this month
    const habitsRes = await c.env.DB.prepare(
      'SELECT * FROM habits WHERE (month = ? OR (month IS NULL AND substr(created_at, 1, 7) = ?)) AND is_active = 1'
    ).bind(monthParam, monthParam).all();
    const activeHabits = (habitsRes.results || []).map(parseHabit);
    const totalHabits = activeHabits.length;

    // Get completions by date
    const completionsRes = await c.env.DB.prepare(
      'SELECT date, COUNT(*) as count FROM habit_completions WHERE date LIKE ? GROUP BY date'
    ).bind(`${monthParam}-%`).all<{ date: string; count: number }>();

    const completionMap: Record<string, number> = {};
    for (const row of (completionsRes.results || [])) {
      completionMap[row.date] = Number(row.count);
    }

    const points = Array.from({ length: daysInMonth }, (_, idx) => {
      const day = idx + 1;
      const dateStr = `${monthParam}-${String(day).padStart(2, '0')}`;
      const pts = completionMap[dateStr] || 0;
      const cappedPoints = totalHabits > 0 ? Math.min(totalHabits, pts) : pts;
      const percentage = totalHabits > 0 ? Math.round((cappedPoints / totalHabits) * 100) : 0;
      return {
        day,
        date: dateStr,
        points: cappedPoints,
        maxPoints: totalHabits,
        percentage,
      };
    });

    return c.json({
      success: true,
      month: monthParam,
      totalHabits,
      points,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/habits/heatmap?month=YYYY-MM
habitsRouter.get('/heatmap', async (c) => {
  try {
    const todayIST = getTodayIST();
    const monthParam = c.req.query('month') || todayIST.slice(0, 7); // 'YYYY-MM'

    const { results } = await c.env.DB.prepare(
      'SELECT date, COUNT(*) as count FROM habit_completions WHERE date LIKE ? GROUP BY date'
    ).bind(`${monthParam}-%`).all<{ date: string; count: number }>();

    const completions: Record<string, number> = {};
    for (const row of (results || [])) {
      completions[row.date] = Number(row.count);
    }

    return c.json({ success: true, month: monthParam, completions });
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
    const month = body.month || getTodayIST().slice(0, 7);

    await c.env.DB.prepare(
      `INSERT INTO habits (id, title, duration_minutes, anchor, energy_level, streak_count, active_days, is_active, habit_type, target_value, target_unit, frequency_type, frequency_value, month)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, title, duration, anchor, energy, activeDays, isActive, habitType, targetValue, targetUnit, frequencyType, frequencyValue, month).run();

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

      await c.env.DB.prepare(
        'DELETE FROM habit_completions WHERE habit_id = ? AND date = ?'
      ).bind(id, todayIST).run();
    } else {
      // Mark done today: increment streak and record last_completed_date
      const newStreak = (current.streak_count || 0) + 1;
      await c.env.DB.prepare(
        'UPDATE habits SET streak_count = ?, last_completed_date = ? WHERE id = ?'
      ).bind(newStreak, todayIST, id).run();

      await c.env.DB.prepare(
        'INSERT OR REPLACE INTO habit_completions (id, habit_id, date) VALUES (?, ?, ?)'
      ).bind(`hc-${id}-${todayIST}`, id, todayIST).run();
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
