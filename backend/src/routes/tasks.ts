import { Hono } from 'hono';
import { Env, Task } from '../types';
import { getTodayIST, pruneOrResetSchedule } from './schedule';

export const tasksRouter = new Hono<{ Bindings: Env }>();

// GET /api/tasks
tasksRouter.get('/', async (c) => {
  try {
    const dateParam = c.req.query('date');
    const allParam = c.req.query('all');
    const todayIST = getTodayIST();

    let results: Task[];
    if (allParam === 'true') {
      const res = await c.env.DB.prepare(
        'SELECT * FROM tasks ORDER BY created_at ASC'
      ).all<Task>();
      results = res.results || [];
    } else {
      const targetDate = dateParam || todayIST;
      const res = await c.env.DB.prepare(
        'SELECT * FROM tasks WHERE task_date = ? OR (task_date IS NULL AND date(created_at) = ?) ORDER BY created_at ASC'
      ).bind(targetDate, targetDate).all<Task>();
      results = res.results || [];
    }

    return c.json({ success: true, tasks: results });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/tasks
tasksRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || `task-${Date.now()}`;
    const title = body.title;
    if (!title) {
      return c.json({ success: false, error: 'Task title is required' }, 400);
    }

    const type = body.type || 'daily';
    const duration_minutes = body.duration_minutes !== undefined ? Number(body.duration_minutes) : 30;
    const priority = body.priority || 'MEDIUM';
    const energy_level = body.energy_level || 'deep_focus';
    const status = body.status || 'pending';
    const scheduled_start = body.scheduled_start || null;
    const scheduled_end = body.scheduled_end || null;
    const category = body.category || 'General';
    const goal_id = body.goal_id || null;
    const column_bucket = body.column_bucket || 'now';
    const task_date = body.task_date || getTodayIST();

    await c.env.DB.prepare(
      `INSERT INTO tasks (id, title, type, duration_minutes, priority, energy_level, status, scheduled_start, scheduled_end, category, goal_id, column_bucket, task_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, title, type, duration_minutes, priority, energy_level, status,
      scheduled_start, scheduled_end, category, goal_id, column_bucket, task_date
    ).run();

    const task = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first<Task>();
    return c.json({ success: true, task }, 201);
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// PATCH /api/tasks/:id
tasksRouter.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();

    const current = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first<Task>();
    if (!current) {
      return c.json({ success: false, error: 'Task not found' }, 404);
    }

    const title = body.title !== undefined ? body.title : current.title;
    const type = body.type !== undefined ? body.type : current.type;
    const duration_minutes = body.duration_minutes !== undefined ? body.duration_minutes : current.duration_minutes;
    const priority = body.priority !== undefined ? body.priority : current.priority;
    const energy_level = body.energy_level !== undefined ? body.energy_level : current.energy_level;
    const status = body.status !== undefined ? body.status : current.status;
    const scheduled_start = body.scheduled_start !== undefined ? body.scheduled_start : current.scheduled_start;
    const scheduled_end = body.scheduled_end !== undefined ? body.scheduled_end : current.scheduled_end;
    const category = body.category !== undefined ? body.category : current.category;
    const goal_id = body.goal_id !== undefined ? body.goal_id : current.goal_id;
    const column_bucket = body.column_bucket !== undefined ? body.column_bucket : current.column_bucket;
    const task_date = body.task_date !== undefined ? body.task_date : current.task_date;

    await c.env.DB.prepare(
      `UPDATE tasks SET
        title = ?, type = ?, duration_minutes = ?, priority = ?, energy_level = ?,
        status = ?, scheduled_start = ?, scheduled_end = ?, category = ?, goal_id = ?, column_bucket = ?, task_date = ?
       WHERE id = ?`
    ).bind(
      title, type, duration_minutes, priority, energy_level,
      status, scheduled_start, scheduled_end, category, goal_id, column_bucket, task_date, id
    ).run();

    const updated = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first<Task>();
    return c.json({ success: true, task: updated });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// DELETE /api/tasks/:id
tasksRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
    await pruneOrResetSchedule(c.env.DB, getTodayIST());
    return c.json({ success: true, message: 'Task deleted' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});
