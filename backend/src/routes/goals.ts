import { Hono } from 'hono';
import { Env, Goal, SyllabusTopic } from '../types';

export const goalsRouter = new Hono<{ Bindings: Env }>();

function parseGoalRow(row: any): Goal {
  return {
    ...row,
    syllabus: typeof row.syllabus === 'string' ? JSON.parse(row.syllabus) : row.syllabus || [],
    milestones: typeof row.milestones === 'string' ? JSON.parse(row.milestones) : row.milestones || []
  };
}

// GET /api/goals
goalsRouter.get('/', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM goals ORDER BY created_at ASC'
    ).all();
    const goals = (results || []).map(parseGoalRow);
    return c.json({ success: true, goals });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/goals
goalsRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id || `goal-${Date.now()}`;
    const title = body.title;
    if (!title) {
      return c.json({ success: false, error: 'Goal title is required' }, 400);
    }

    const target_date = body.target_date || new Date(Date.now() + 86 * 86400000).toISOString().split('T')[0];
    const category = body.category || 'Exam Preparation';
    const syllabus = JSON.stringify(body.syllabus || []);
    const milestones = JSON.stringify(body.milestones || []);
    const recommendation = body.recommendation || 'Stay consistent with daily focused sessions.';
    const unit_label = body.unit_label || 'topics';
    const total_units = body.total_units || 100;
    const covered_units = body.covered_units || 0;

    await c.env.DB.prepare(
      `INSERT INTO goals (id, title, category, target_date, syllabus, milestones, recommendation, unit_label, total_units, covered_units)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, title, category, target_date, syllabus, milestones, recommendation, unit_label, total_units, covered_units
    ).run();

    const row = await c.env.DB.prepare('SELECT * FROM goals WHERE id = ?').bind(id).first();
    return c.json({ success: true, goal: parseGoalRow(row) }, 201);
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// PATCH /api/goals/:id
goalsRouter.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();

    const currentRaw = await c.env.DB.prepare('SELECT * FROM goals WHERE id = ?').bind(id).first();
    if (!currentRaw) {
      return c.json({ success: false, error: 'Goal not found' }, 404);
    }
    const current = parseGoalRow(currentRaw);

    const title = body.title !== undefined ? body.title : current.title;
    const category = body.category !== undefined ? body.category : (current.category || 'Exam Preparation');
    const target_date = body.target_date !== undefined ? body.target_date : current.target_date;
    const syllabus = body.syllabus !== undefined ? JSON.stringify(body.syllabus) : JSON.stringify(current.syllabus);
    const milestones = body.milestones !== undefined ? JSON.stringify(body.milestones) : JSON.stringify(current.milestones);
    const recommendation = body.recommendation !== undefined ? body.recommendation : current.recommendation;
    const unit_label = body.unit_label !== undefined ? body.unit_label : current.unit_label;
    const total_units = body.total_units !== undefined ? body.total_units : current.total_units;
    const covered_units = body.covered_units !== undefined ? body.covered_units : current.covered_units;

    await c.env.DB.prepare(
      `UPDATE goals SET
        title = ?, category = ?, target_date = ?, syllabus = ?, milestones = ?,
        recommendation = ?, unit_label = ?, total_units = ?, covered_units = ?
       WHERE id = ?`
    ).bind(
      title, category, target_date, syllabus, milestones, recommendation, unit_label, total_units, covered_units, id
    ).run();

    const updatedRaw = await c.env.DB.prepare('SELECT * FROM goals WHERE id = ?').bind(id).first();
    return c.json({ success: true, goal: parseGoalRow(updatedRaw) });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/goals/:id/toggle-topic
goalsRouter.post('/:id/toggle-topic', async (c) => {
  try {
    const id = c.req.param('id');
    const { topicId } = await c.req.json();

    const row = await c.env.DB.prepare('SELECT * FROM goals WHERE id = ?').bind(id).first();
    if (!row) {
      return c.json({ success: false, error: 'Goal not found' }, 404);
    }
    const goal = parseGoalRow(row);
    const topic = goal.syllabus.find((t: SyllabusTopic) => t.id === topicId);
    if (!topic) {
      return c.json({ success: false, error: 'Topic not found' }, 404);
    }

    topic.covered = !topic.covered;
    topic.status = topic.covered ? 'COVERED' : 'NEXT UP';

    const coveredCount = goal.syllabus.filter((t: SyllabusTopic) => t.covered).length;
    // calculate scaled covered_units
    const coveredUnits = Math.max(goal.covered_units, Math.round((coveredCount / Math.max(goal.syllabus.length, 1)) * goal.total_units));

    await c.env.DB.prepare(
      'UPDATE goals SET syllabus = ?, covered_units = ? WHERE id = ?'
    ).bind(JSON.stringify(goal.syllabus), coveredUnits, id).run();

    const updatedRaw = await c.env.DB.prepare('SELECT * FROM goals WHERE id = ?').bind(id).first();
    return c.json({ success: true, goal: parseGoalRow(updatedRaw) });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// DELETE /api/goals/:id
goalsRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM goals WHERE id = ?').bind(id).run();
    return c.json({ success: true, message: 'Goal deleted' });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});
