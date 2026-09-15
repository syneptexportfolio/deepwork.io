import { Hono } from 'hono';
import { Env, Goal, QuestionnaireAnswers, ScheduleBlock, Task } from '../types';
import { generateScheduleWithGemini } from '../services/llm';

export const scheduleRouter = new Hono<{ Bindings: Env }>();

export function getTodayIST(): string {
  // Hardcoded IST date (UTC+5:30)
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istTime = new Date(utc + (3600000 * 5.5));
  return istTime.toISOString().split('T')[0];
}

export async function pruneOrResetSchedule(db: any, date: string): Promise<ScheduleBlock[]> {
  const { results: tasks } = await db.prepare('SELECT id, title FROM tasks').all();
  const { results: habits } = await db.prepare('SELECT id, title, habit_type FROM habits').all();
  const { results: weeklyGoals } = await db.prepare('SELECT id, title FROM weekly_goals').all();

  const allTasks: any[] = tasks || [];
  const allHabits: any[] = habits || [];
  const allWeeklyGoals: any[] = weeklyGoals || [];

  // If literally no tasks, habits, or weekly goals exist, schedule MUST be completely cleared
  if (allTasks.length === 0 && allHabits.length === 0 && allWeeklyGoals.length === 0) {
    await db.prepare('DELETE FROM schedules').run();
    return [];
  }

  // Get current schedule row strictly for the requested date
  const row: any = await db.prepare('SELECT * FROM schedules WHERE date = ?').bind(date).first();

  if (!row || !row.generated_plan) {
    return [];
  }

  try {
    const blocks: ScheduleBlock[] = JSON.parse(row.generated_plan);
    const validTaskIds = new Set(allTasks.map((t: any) => t.id));
    const habitTitles: string[] = allHabits.map((h: any) => h.title.toLowerCase());
    const anchorHabitTitles: string[] = allHabits
      .filter((h: any) => h.habit_type === 'check_off' || h.habit_type === 'target')
      .map((h: any) => h.title.toLowerCase().trim());
    const weeklyGoalTitles: string[] = allWeeklyGoals.map((w: any) => w.title.toLowerCase());

    const filteredBlocks = blocks.filter((b: any) => {
      if (b.type === 'break') return true;

      // Filter out check_off rituals and target metrics (they belong in Daily Anchors card)
      const normTitle = (b.title || '').toLowerCase().trim();
      if (anchorHabitTitles.some((at: string) => normTitle.includes(at) || at.includes(normTitle))) {
        return false;
      }

      if (b.task_id) {
        return validTaskIds.has(b.task_id);
      }
      if (b.block_source === 'habit') {
        return habitTitles.some((ht: string) => b.title.toLowerCase().includes(ht) || ht.includes(b.title.toLowerCase()));
      }
      if (b.block_source === 'weekly_goal') {
        return weeklyGoalTitles.some((wt: string) => b.title.toLowerCase().includes(wt) || wt.includes(b.title.toLowerCase()));
      }
      if (b.block_source === 'daily_todo') {
        return allTasks.some((t: any) => t.title.toLowerCase().includes(b.title.toLowerCase()));
      }
      return true;
    });

    const nonBreakBlocks = filteredBlocks.filter(b => b.type !== 'break');
    if (nonBreakBlocks.length === 0) {
      await db.prepare('DELETE FROM schedules WHERE id = ?').bind(row.id).run();
      return [];
    }

    if (filteredBlocks.length !== blocks.length) {
      await db.prepare('UPDATE schedules SET generated_plan = ? WHERE id = ?')
        .bind(JSON.stringify(filteredBlocks), row.id).run();
    }

    return filteredBlocks;
  } catch {
    return [];
  }
}

// GET /api/schedule/today
scheduleRouter.get('/today', async (c) => {
  try {
    const today = getTodayIST();
    const blocks = await pruneOrResetSchedule(c.env.DB, today);
    return c.json({
      success: true,
      date: today,
      cached: blocks.length > 0,
      schedule: blocks
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// DELETE /api/schedule/today
scheduleRouter.delete('/today', async (c) => {
  try {
    const today = getTodayIST();
    await c.env.DB.prepare('DELETE FROM schedules WHERE date = ?').bind(today).run();
    return c.json({ success: true, message: 'Schedule cleared', schedule: [] });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/questionnaire
scheduleRouter.post('/questionnaire', async (c) => {
  try {
    const body = await c.req.json();
    const id = `qr-${Date.now()}`;
    const today = getTodayIST();
    const answers = JSON.stringify(body.answers || body);

    await c.env.DB.prepare(
      'INSERT INTO questionnaire_responses (id, date, answers) VALUES (?, ?, ?)'
    ).bind(id, today, answers).run();

    return c.json({ success: true, id, date: today });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/schedule/generate
scheduleRouter.post('/generate', async (c) => {
  try {
    const today = getTodayIST();
    const body = await c.req.json().catch(() => ({}));

    // 1. Get answers from request body or last questionnaire response
    let answers: QuestionnaireAnswers = body.answers;
    let questionnaireId = body.questionnaireId || null;

    if (!answers) {
      const qr = await c.env.DB.prepare(
        'SELECT * FROM questionnaire_responses ORDER BY created_at DESC LIMIT 1'
      ).first<any>();
      if (qr) {
        answers = JSON.parse(qr.answers);
        questionnaireId = qr.id;
      } else {
        answers = {
          available_hours: 6,
          wake_time: '07:30',
          sleep_time: '23:30',
          energy_level: 'deep_focus',
          top_priority: 'Core syllabus revision',
          fixed_commitments: 'None'
        };
      }
    }

    // 2. Fetch pending tasks
    const { results: taskRows } = await c.env.DB.prepare(
      'SELECT * FROM tasks WHERE status = "pending" ORDER BY created_at ASC'
    ).all<Task>();
    let tasks = taskRows || [];

    // Filter by selected_task_ids if provided
    if (answers.selected_task_ids && Array.isArray(answers.selected_task_ids)) {
      tasks = tasks.filter(t => answers.selected_task_ids!.includes(t.id));
    }

    // 2b. If morning_todos are provided, save any new ones to tasks table
    if (answers.morning_todos && answers.morning_todos.length > 0) {
      for (const td of answers.morning_todos) {
        if (td.title && td.title.trim() !== '') {
          const tid = `task-todo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          await c.env.DB.prepare(
            `INSERT INTO tasks (id, title, type, duration_minutes, priority, energy_level, status, category, column_bucket)
             VALUES (?, ?, 'daily', ?, 'MEDIUM', 'light', 'pending', 'Daily To-Do', 'now')`
          ).bind(tid, td.title.trim(), td.duration_minutes || 20).run();
        }
      }
    }

    // 3. Fetch active goals
    const { results: goalRows } = await c.env.DB.prepare(
      'SELECT * FROM goals ORDER BY created_at ASC'
    ).all<any>();
    let goals: Goal[] = (goalRows || []).map((r: any) => ({
      ...r,
      syllabus: typeof r.syllabus === 'string' ? JSON.parse(r.syllabus) : r.syllabus || [],
      milestones: typeof r.milestones === 'string' ? JSON.parse(r.milestones) : r.milestones || []
    }));

    // Filter by selected_long_term_goal_ids if provided
    if (answers.selected_long_term_goal_ids && Array.isArray(answers.selected_long_term_goal_ids)) {
      goals = goals.filter(g => answers.selected_long_term_goal_ids!.includes(g.id));
    }

    // 3b. Fetch active monthly habits
    const { results: habitRows } = await c.env.DB.prepare(
      'SELECT * FROM habits WHERE is_active = 1 ORDER BY anchor ASC'
    ).all<any>();
    let habits = (habitRows || []).map((h: any) => ({
      ...h,
      active_days: typeof h.active_days === 'string' ? JSON.parse(h.active_days) : h.active_days || []
    }));

    // Filter by selected_habit_ids if provided
    if (answers.selected_habit_ids && Array.isArray(answers.selected_habit_ids)) {
      habits = habits.filter(h => answers.selected_habit_ids!.includes(h.id));
    }

    // 3c. Fetch active weekly goals
    const { results: weeklyGoalRows } = await c.env.DB.prepare(
      'SELECT * FROM weekly_goals ORDER BY priority DESC'
    ).all<any>();
    let weeklyGoals = weeklyGoalRows || [];

    // Filter by selected_weekly_goal_ids if provided
    if (answers.selected_weekly_goal_ids && Array.isArray(answers.selected_weekly_goal_ids)) {
      weeklyGoals = weeklyGoals.filter(wg => answers.selected_weekly_goal_ids!.includes(wg.id));
    }

    // 4. Generate merged schedule with Gemini (or smart fallback if key is not configured)
    const apiKey = c.env.GEMINI_API_KEY;
    const model = c.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const { blocks } = await generateScheduleWithGemini(tasks, goals, answers, habits, weeklyGoals, apiKey, model);

    // 5. Cache/persist schedule in D1
    const scheduleId = `sched-${today}`;
    const planJson = JSON.stringify(blocks);

    // Upsert into schedules
    await c.env.DB.prepare(`
      INSERT INTO schedules (id, date, generated_plan, source_questionnaire_id)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        generated_plan = excluded.generated_plan,
        source_questionnaire_id = excluded.source_questionnaire_id,
        created_at = datetime('now')
    `).bind(scheduleId, today, planJson, questionnaireId).run();


    return c.json({
      success: true,
      date: today,
      cached: false,
      schedule: blocks,
      modelUsed: apiKey ? model : 'smart-local-rhythm-engine'
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// PATCH /api/schedule/block/:blockId
scheduleRouter.patch('/block/:blockId', async (c) => {
  try {
    const blockId = c.req.param('blockId');
    const body = await c.req.json().catch(() => ({}));
    const status = body.status || 'done';
    const today = getTodayIST();

    // Check today's schedule row strictly
    const row = await c.env.DB.prepare(
      'SELECT * FROM schedules WHERE date = ?'
    ).bind(today).first<any>();

    if (!row || !row.generated_plan) {
      return c.json({ success: false, error: 'No schedule found for today' }, 404);
    }

    const blocks: ScheduleBlock[] = JSON.parse(row.generated_plan);
    const targetBlock = blocks.find(b => b.id === blockId);

    if (targetBlock) {
      targetBlock.status = status;

      // Persist updated plan in D1
      await c.env.DB.prepare(
        'UPDATE schedules SET generated_plan = ? WHERE id = ?'
      ).bind(JSON.stringify(blocks), row.id).run();

      // If tied to a task, update tasks table
      if (targetBlock.task_id) {
        await c.env.DB.prepare(
          'UPDATE tasks SET status = ? WHERE id = ?'
        ).bind(status, targetBlock.task_id).run();
      }

      // If source is weekly_goal and marked done, increment progress
      if (targetBlock.block_source === 'weekly_goal' && status === 'done') {
        await c.env.DB.prepare(
          `UPDATE weekly_goals 
           SET completed_units = MIN(target_units, completed_units + 1)
           WHERE title = ? OR title LIKE ?`
        ).bind(targetBlock.title, `%${targetBlock.title}%`).run();
      }

      // If source is habit and marked done, increment streak and update last_completed_date
      if (targetBlock.block_source === 'habit' && status === 'done') {
        const todayIST = getTodayIST();
        await c.env.DB.prepare(
          `UPDATE habits 
           SET streak_count = streak_count + 1, last_completed_date = ? 
           WHERE title = ? OR title LIKE ?`
        ).bind(todayIST, targetBlock.title, `%${targetBlock.title}%`).run();
      }

      // If source is long_term_goal and marked done, mark topic covered in syllabus and update covered_units
      if (targetBlock.block_source === 'long_term_goal' && status === 'done') {
        let goalRow: any = null;
        if (targetBlock.goal_id) {
          goalRow = await c.env.DB.prepare('SELECT * FROM goals WHERE id = ?').bind(targetBlock.goal_id).first();
        }
        if (!goalRow) {
          // Fallback: match by title or prefix
          const allG = await c.env.DB.prepare('SELECT * FROM goals').all<any>();
          goalRow = (allG.results || []).find((g: any) => targetBlock.title.toLowerCase().includes(g.title.toLowerCase()));
        }

        if (goalRow) {
          let syllabus: any[] = typeof goalRow.syllabus === 'string' ? JSON.parse(goalRow.syllabus) : goalRow.syllabus || [];
          let topicMarked = false;

          if (targetBlock.topic_id) {
            syllabus = syllabus.map((t: any) => {
              if (t.id === targetBlock.topic_id) {
                topicMarked = true;
                return { ...t, covered: true, status: 'COVERED' };
              }
              return t;
            });
          }

          // If topic wasn't found by id, try matching by name or pick first uncovered topic
          if (!topicMarked) {
            const uncov = syllabus.find((t: any) => !t.covered);
            if (uncov) {
              uncov.covered = true;
              uncov.status = 'COVERED';
            }
          }

          const coveredCount = syllabus.filter((t: any) => t.covered).length;
          await c.env.DB.prepare(
            'UPDATE goals SET syllabus = ?, covered_units = ? WHERE id = ?'
          ).bind(JSON.stringify(syllabus), coveredCount, goalRow.id).run();
        }
      }
    }

    return c.json({ success: true, schedule: blocks });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

