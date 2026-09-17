import { Hono } from 'hono';
import { Env, WeeklyGoal } from '../types';
import { getTodayIST, pruneOrResetSchedule } from './schedule';

export const weeklyGoalsRouter = new Hono<{ Bindings: Env }>();

function getCurrentWeekBoundaries(todayStr: string): { weekStart: string; weekEnd: string } {
  const [y, m, d] = todayStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay(); // 0 is Sun, 1 is Mon, ... 6 is Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  return {
    weekStart: monday.toISOString().split('T')[0],
    weekEnd: sunday.toISOString().split('T')[0]
  };
}

function formatGoalWithPacing(g: WeeklyGoal) {
  const now = new Date();
  const end = new Date(g.week_end).getTime();
  const daysLeft = Math.max(1, Math.ceil((end - now.getTime()) / (1000 * 60 * 60 * 24)));
  const remainingUnits = Math.max(0, g.target_units - g.completed_units);
  const unitsPerDay = Number((remainingUnits / daysLeft).toFixed(1));
  const progressPercent = Math.min(100, Math.round((g.completed_units / Math.max(g.target_units, 1)) * 100));

  return {
    ...g,
    daysLeft,
    remainingUnits,
    unitsPerDay,
    progressPercent,
    isBehindPace: unitsPerDay > (g.target_units / 7) * 1.3
  };
}

// GET /api/weekly-goals
weeklyGoalsRouter.get('/', async (c) => {
  try {
    const todayIST = getTodayIST();
    const { weekStart, weekEnd } = getCurrentWeekBoundaries(todayIST);
    const targetWeekStart = c.req.query('week_start') || weekStart;

    const { results } = await c.env.DB.prepare(
      'SELECT * FROM weekly_goals WHERE week_start = ? OR (week_start >= ? AND week_start <= ?) OR (week_start IS NULL AND week_end >= ?) ORDER BY priority DESC, created_at ASC'
    ).bind(targetWeekStart, weekStart, weekEnd, todayIST).all<WeeklyGoal>();

    const goalsWithPacing = (results || []).map(formatGoalWithPacing);
    return c.json({ success: true, weeklyGoals: goalsWithPacing, weekStart, weekEnd });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/weekly-goals/copy-previous (Copy goals from previous week into current week)
weeklyGoalsRouter.post('/copy-previous', async (c) => {
  try {
    const todayIST = getTodayIST();
    const { weekStart, weekEnd } = getCurrentWeekBoundaries(todayIST);

    // Calculate previous week's Monday
    const [y, m, d] = weekStart.split('-').map(Number);
    const prevMon = new Date(Date.UTC(y, m - 1, d));
    prevMon.setUTCDate(prevMon.getUTCDate() - 7);
    const prevWeekStart = prevMon.toISOString().split('T')[0];

    const { results } = await c.env.DB.prepare(
      'SELECT * FROM weekly_goals WHERE week_start = ? ORDER BY created_at ASC'
    ).bind(prevWeekStart).all<any>();

    const prevGoals = results || [];
    if (prevGoals.length === 0) {
      return c.json({ success: false, error: `No goals found for previous week (${prevWeekStart}) to copy` }, 404);
    }

    const copiedGoals: WeeklyGoal[] = [];
    for (let i = 0; i < prevGoals.length; i++) {
      const pg = prevGoals[i];
      const newId = `wg-${Date.now()}-${i}`;
      await c.env.DB.prepare(
        `INSERT INTO weekly_goals (id, title, target_units, completed_units, unit_label, week_start, week_end, priority, energy_level, goal_id, category)
         VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        newId, pg.title, pg.target_units, pg.unit_label || 'topics',
        weekStart, weekEnd, pg.priority || 'HIGH', pg.energy_level || 'deep_focus',
        pg.goal_id || null, pg.category || 'Project'
      ).run();

      const inserted = await c.env.DB.prepare('SELECT * FROM weekly_goals WHERE id = ?').bind(newId).first<WeeklyGoal>();
      if (inserted) copiedGoals.push(formatGoalWithPacing(inserted));
    }

    return c.json({ success: true, weeklyGoals: copiedGoals, count: copiedGoals.length });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/weekly-goals
weeklyGoalsRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || `wg-${Date.now()}`;
    const title = body.title;
    if (!title) return c.json({ success: false, error: 'Title is required' }, 400);

    const todayIST = getTodayIST();
    const { weekStart, weekEnd } = getCurrentWeekBoundaries(todayIST);

    const target_units = body.target_units || 5;
    const completed_units = body.completed_units || 0;
    const unit_label = body.unit_label || 'topics';
    const week_start = body.week_start || weekStart;
    const week_end = body.week_end || weekEnd;
    const priority = body.priority || 'HIGH';
    const energy_level = body.energy_level || 'deep_focus';
    const goal_id = body.goal_id || null;
    const category = body.category || 'Project';

    await c.env.DB.prepare(
      `INSERT INTO weekly_goals (id, title, target_units, completed_units, unit_label, week_start, week_end, priority, energy_level, goal_id, category)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, title, target_units, completed_units, unit_label, week_start, week_end, priority, energy_level, goal_id, category).run();

    const created = await c.env.DB.prepare('SELECT * FROM weekly_goals WHERE id = ?').bind(id).first<WeeklyGoal>();
    return c.json({ success: true, weeklyGoal: created ? formatGoalWithPacing(created) : null }, 201);
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// PATCH /api/weekly-goals/:id
weeklyGoalsRouter.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();

    const current = await c.env.DB.prepare('SELECT * FROM weekly_goals WHERE id = ?').bind(id).first<WeeklyGoal>();
    if (!current) return c.json({ success: false, error: 'Weekly goal not found' }, 404);

    const title = body.title !== undefined ? body.title : current.title;
    const target_units = body.target_units !== undefined ? body.target_units : current.target_units;
    const completed_units = body.completed_units !== undefined
      ? Math.max(0, Math.min(target_units, body.completed_units))
      : current.completed_units;
    const unit_label = body.unit_label !== undefined ? body.unit_label : current.unit_label;
    const priority = body.priority !== undefined ? body.priority : current.priority;
    const energy_level = body.energy_level !== undefined ? body.energy_level : current.energy_level;
    const goal_id = body.goal_id !== undefined ? body.goal_id : current.goal_id;
    const category = body.category !== undefined ? body.category : (current.category || 'Project');

    await c.env.DB.prepare(
      `UPDATE weekly_goals SET title = ?, target_units = ?, completed_units = ?, unit_label = ?, priority = ?, energy_level = ?, goal_id = ?, category = ? WHERE id = ?`
    ).bind(title, target_units, completed_units, unit_label, priority, energy_level, goal_id, category, id).run();

    const updated = await c.env.DB.prepare('SELECT * FROM weekly_goals WHERE id = ?').bind(id).first<WeeklyGoal>();
    return c.json({ success: true, weeklyGoal: updated ? formatGoalWithPacing(updated) : null });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// DELETE /api/weekly-goals/:id
weeklyGoalsRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM weekly_goals WHERE id = ?').bind(id).run();
    await pruneOrResetSchedule(c.env.DB, getTodayIST());
    return c.json({ success: true, message: 'Weekly goal deleted' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});
