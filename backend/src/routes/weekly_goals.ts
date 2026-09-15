import { Hono } from 'hono';
import { Env, WeeklyGoal } from '../types';
import { getTodayIST, pruneOrResetSchedule } from './schedule';

export const weeklyGoalsRouter = new Hono<{ Bindings: Env }>();

// GET /api/weekly-goals
weeklyGoalsRouter.get('/', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM weekly_goals ORDER BY priority DESC, created_at ASC'
    ).all<WeeklyGoal>();

    const now = new Date();
    const goalsWithPacing = (results || []).map((g) => {
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
    });

    return c.json({ success: true, weeklyGoals: goalsWithPacing });
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

    const target_units = body.target_units || 5;
    const completed_units = body.completed_units || 0;
    const unit_label = body.unit_label || 'topics';
    const week_start = body.week_start || new Date().toISOString().split('T')[0];
    const week_end = body.week_end || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const priority = body.priority || 'HIGH';
    const energy_level = body.energy_level || 'deep_focus';
    const goal_id = body.goal_id || null;
    const category = body.category || 'Project';

    await c.env.DB.prepare(
      `INSERT INTO weekly_goals (id, title, target_units, completed_units, unit_label, week_start, week_end, priority, energy_level, goal_id, category)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, title, target_units, completed_units, unit_label, week_start, week_end, priority, energy_level, goal_id, category).run();

    const created = await c.env.DB.prepare('SELECT * FROM weekly_goals WHERE id = ?').bind(id).first<WeeklyGoal>();
    return c.json({ success: true, weeklyGoal: created }, 201);
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
    const completed_units = body.completed_units !== undefined ? body.completed_units : current.completed_units;
    const unit_label = body.unit_label !== undefined ? body.unit_label : current.unit_label;
    const priority = body.priority !== undefined ? body.priority : current.priority;
    const energy_level = body.energy_level !== undefined ? body.energy_level : current.energy_level;
    const goal_id = body.goal_id !== undefined ? body.goal_id : current.goal_id;
    const category = body.category !== undefined ? body.category : (current.category || 'Project');

    await c.env.DB.prepare(
      `UPDATE weekly_goals SET title = ?, target_units = ?, completed_units = ?, unit_label = ?, priority = ?, energy_level = ?, goal_id = ?, category = ? WHERE id = ?`
    ).bind(title, target_units, completed_units, unit_label, priority, energy_level, goal_id, category, id).run();

    const updated = await c.env.DB.prepare('SELECT * FROM weekly_goals WHERE id = ?').bind(id).first<WeeklyGoal>();
    return c.json({ success: true, weeklyGoal: updated });
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
