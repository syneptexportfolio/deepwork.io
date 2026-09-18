import { Hono } from 'hono';
import { Env, Goal, QuestionnaireAnswers, ScheduleBlock, Task } from '../types';
import { generateScheduleWithGemini, sanitizeScheduleBreaks } from '../services/llm';

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

    const sanitizedBlocks = sanitizeScheduleBreaks(filteredBlocks);
    const nonBreakBlocks = sanitizedBlocks.filter(b => b.type !== 'break');
    if (nonBreakBlocks.length === 0) {
      await db.prepare('DELETE FROM schedules WHERE id = ?').bind(row.id).run();
      return [];
    }

    if (sanitizedBlocks.length !== blocks.length || JSON.stringify(sanitizedBlocks) !== row.generated_plan) {
      await db.prepare('UPDATE schedules SET generated_plan = ? WHERE id = ?')
        .bind(JSON.stringify(sanitizedBlocks), row.id).run();
    }

    return sanitizedBlocks;
  } catch {
    return [];
  }
}

// GET /api/schedule?date=YYYY-MM-DD
scheduleRouter.get('/', async (c) => {
  try {
    const queryDate = c.req.query('date');
    const targetDate = queryDate && queryDate.trim() !== '' ? queryDate.trim() : getTodayIST();
    const blocks = await pruneOrResetSchedule(c.env.DB, targetDate);
    return c.json({
      success: true,
      date: targetDate,
      cached: blocks.length > 0,
      schedule: blocks
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

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

// GET /api/schedule/week?startDate=YYYY-MM-DD
scheduleRouter.get('/week', async (c) => {
  try {
    const todayIST = getTodayIST();
    const queryStart = c.req.query('startDate');

    // Determine Monday of the target week in IST
    let mondayDate: Date;
    if (queryStart && queryStart.trim() !== '') {
      mondayDate = new Date(`${queryStart}T00:00:00Z`);
    } else {
      const nowUtc = new Date();
      const nowIst = new Date(nowUtc.getTime() + (nowUtc.getTimezoneOffset() * 60000) + (3600000 * 5.5));
      const dayOfWeek = nowIst.getDay();
      const distToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      mondayDate = new Date(nowIst);
      mondayDate.setDate(nowIst.getDate() + distToMonday);
    }

    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayCodes = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

    const weekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(mondayDate);
      d.setDate(mondayDate.getDate() + i);
      weekDates.push(d.toISOString().split('T')[0]);
    }

    const placeholders = weekDates.map(() => '?').join(',');
    const { results } = await c.env.DB.prepare(
      `SELECT date, generated_plan FROM schedules WHERE date IN (${placeholders})`
    ).bind(...weekDates).all<any>();

    const scheduleMap = new Map<string, any[]>();
    for (const row of (results || [])) {
      try {
        scheduleMap.set(row.date, JSON.parse(row.generated_plan || '[]'));
      } catch {}
    }

    let totalWeekFocusMinutes = 0;
    const days = weekDates.map((dateStr, idx) => {
      const rawBlocks = scheduleMap.get(dateStr) || [];
      const blocks: ScheduleBlock[] = Array.isArray(rawBlocks) ? rawBlocks : [];
      const nonBreak = blocks.filter(b => b.type !== 'break');
      const focusMinutes = blocks
        .filter(b => b.type === 'deep_focus')
        .reduce((acc, b) => acc + (b.duration || 0), 0);
      const doneBlocks = nonBreak.filter(b => b.status === 'done').length;

      totalWeekFocusMinutes += focusMinutes;

      return {
        date: dateStr,
        dayName: dayNames[idx],
        dayCode: dayCodes[idx],
        isToday: dateStr === todayIST,
        isShaped: nonBreak.length > 0,
        blocks,
        totalFocusMinutes: focusMinutes,
        focusHours: Math.round((focusMinutes / 60) * 10) / 10,
        completedBlocks: doneBlocks,
        totalBlocks: nonBreak.length,
      };
    });

    return c.json({
      success: true,
      weekStart: weekDates[0],
      weekEnd: weekDates[6],
      totalWeekFocusMinutes,
      totalWeekFocusHours: Math.round((totalWeekFocusMinutes / 60) * 10) / 10,
      days
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/schedule/active-dates
scheduleRouter.get('/active-dates', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT date, generated_plan FROM schedules ORDER BY date ASC'
    ).all<any>();
    const activeDates: string[] = [];
    for (const r of (results || [])) {
      try {
        const blocks = JSON.parse(r.generated_plan || '[]');
        if (Array.isArray(blocks) && blocks.filter((b: any) => b.type !== 'break').length > 0) {
          activeDates.push(r.date);
        }
      } catch {}
    }
    return c.json({ success: true, dates: activeDates });
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

// DELETE /api/schedule/by-date/:date
scheduleRouter.delete('/by-date/:date', async (c) => {
  try {
    const targetDate = c.req.param('date');
    await c.env.DB.prepare('DELETE FROM schedules WHERE date = ?').bind(targetDate).run();
    return c.json({ success: true, message: `Schedule for ${targetDate} cleared` });
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
    const body = await c.req.json().catch(() => ({}));
    const targetDate = body.date && body.date.trim() !== '' ? body.date.trim() : getTodayIST();
    const today = getTodayIST();

    if (targetDate < today) {
      return c.json({
        success: false,
        error: 'Cannot generate or shape schedules for past dates.'
      }, 400);
    }

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

    // 4. Generate merged schedule with Gemini (weekly goals are decoupled from daily timetable)
    const apiKey = c.env.GEMINI_API_KEY;
    const model = c.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const { blocks } = await generateScheduleWithGemini(tasks, goals, answers, habits, [], apiKey, model);

    // 5. Save generated schedule strictly under targetDate
    const scheduleId = `sched-${targetDate}`;
    const planJson = JSON.stringify(blocks);

    await c.env.DB.prepare(`
      INSERT INTO schedules (id, date, generated_plan, source_questionnaire_id)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        generated_plan = excluded.generated_plan,
        source_questionnaire_id = excluded.source_questionnaire_id,
        created_at = datetime('now')
    `).bind(scheduleId, targetDate, planJson, questionnaireId).run();

    return c.json({
      success: true,
      date: targetDate,
      cached: false,
      schedule: blocks,
      modelUsed: apiKey ? model : 'smart-local-rhythm-engine'
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/schedule/custom-block
scheduleRouter.post('/custom-block', async (c) => {
  try {
    const body = await c.req.json();
    const { date, updatedSchedule, task } = body;
    const targetDate = date && date.trim() !== '' ? date.trim() : getTodayIST();

    if (!Array.isArray(updatedSchedule)) {
      return c.json({ success: false, error: 'updatedSchedule must be an array of blocks' }, 400);
    }

    const sanitizedSchedule = sanitizeScheduleBreaks(updatedSchedule);

    // 1. If task data is provided, persist it in the tasks table to protect it from pruning & support cross-view tracking
    if (task && task.id && task.title) {
      let bucket = task.column_bucket;
      if (!bucket && task.scheduled_start) {
        bucket = task.scheduled_start >= '17:00' ? 'later' : task.scheduled_start >= '12:00' ? 'up_next' : 'now';
      }
      if (!bucket) bucket = 'now';

      const existingTask = await c.env.DB.prepare('SELECT id FROM tasks WHERE id = ?').bind(task.id).first();
      if (existingTask) {
        await c.env.DB.prepare(`
          UPDATE tasks SET
            title = ?,
            duration_minutes = ?,
            priority = ?,
            energy_level = ?,
            status = ?,
            scheduled_start = ?,
            scheduled_end = ?,
            category = ?,
            column_bucket = ?,
            task_date = ?
          WHERE id = ?
        `).bind(
          task.title,
          task.duration_minutes || 0,
          task.priority || 'MEDIUM',
          task.energy_level || 'deep_focus',
          task.status || 'pending',
          task.scheduled_start || null,
          task.scheduled_end || null,
          task.category || 'General',
          bucket,
          targetDate,
          task.id
        ).run();
      } else {
        await c.env.DB.prepare(`
          INSERT INTO tasks (id, title, type, duration_minutes, priority, energy_level, status, scheduled_start, scheduled_end, category, goal_id, column_bucket, task_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          task.id,
          task.title,
          'daily',
          task.duration_minutes || 0,
          task.priority || 'MEDIUM',
          task.energy_level || 'deep_focus',
          task.status || 'pending',
          task.scheduled_start || null,
          task.scheduled_end || null,
          task.category || 'General',
          null,
          bucket,
          targetDate
        ).run();
      }
    }

    // 2. Persist updated schedule plan strictly under targetDate
    const scheduleId = `sched-${targetDate}`;
    const planJson = JSON.stringify(sanitizedSchedule);

    await c.env.DB.prepare(`
      INSERT INTO schedules (id, date, generated_plan)
      VALUES (?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        generated_plan = excluded.generated_plan
    `).bind(scheduleId, targetDate, planJson).run();

    return c.json({
      success: true,
      date: targetDate,
      schedule: sanitizedSchedule,
      task: task || null
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
    const targetDate = body.date && body.date.trim() !== '' ? body.date.trim() : getTodayIST();

    // Look for targetDate schedule first
    let row = await c.env.DB.prepare(
      'SELECT * FROM schedules WHERE date = ?'
    ).bind(targetDate).first<any>();

    // Fallback: look for any schedule containing this blockId
    if (!row || !row.generated_plan || !row.generated_plan.includes(blockId)) {
      const allRows = await c.env.DB.prepare('SELECT * FROM schedules').all<any>();
      for (const r of (allRows.results || [])) {
        if (r.generated_plan && r.generated_plan.includes(blockId)) {
          row = r;
          break;
        }
      }
    }

    if (!row || !row.generated_plan) {
      return c.json({ success: false, error: 'No schedule found containing this block' }, 404);
    }

    const blocks: ScheduleBlock[] = JSON.parse(row.generated_plan);
    const targetBlock = blocks.find(b => b.id === blockId);

    if (targetBlock) {
      const previousStatus = targetBlock.status;
      if (previousStatus === status) {
        return c.json({ success: true, schedule: blocks });
      }

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

      // If source is weekly_goal: handle increment or decrement
      if (targetBlock.block_source === 'weekly_goal') {
        const wg = await c.env.DB.prepare(
          'SELECT * FROM weekly_goals WHERE title = ? OR title LIKE ?'
        ).bind(targetBlock.title, `%${targetBlock.title}%`).first<any>();

        if (wg) {
          if (status === 'done' && previousStatus !== 'done') {
            await c.env.DB.prepare(
              'UPDATE weekly_goals SET completed_units = MIN(target_units, completed_units + 1) WHERE id = ?'
            ).bind(wg.id).run();
          } else if (status !== 'done' && previousStatus === 'done') {
            await c.env.DB.prepare(
              'UPDATE weekly_goals SET completed_units = MAX(0, completed_units - 1) WHERE id = ?'
            ).bind(wg.id).run();
          }
        }
      }

      // If source is habit: handle streak increment/decrement and habit_completions tracking
      if (targetBlock.block_source === 'habit') {
        const hab = await c.env.DB.prepare(
          'SELECT * FROM habits WHERE title = ? OR title LIKE ?'
        ).bind(targetBlock.title, `%${targetBlock.title}%`).first<any>();

        if (hab) {
          const todayIST = getTodayIST();
          if (status === 'done' && previousStatus !== 'done') {
            await c.env.DB.prepare(
              'UPDATE habits SET streak_count = streak_count + 1, last_completed_date = ? WHERE id = ?'
            ).bind(todayIST, hab.id).run();

            await c.env.DB.prepare(
              'INSERT OR REPLACE INTO habit_completions (id, habit_id, date) VALUES (?, ?, ?)'
            ).bind(`hc-${hab.id}-${todayIST}`, hab.id, todayIST).run();
          } else if (status !== 'done' && previousStatus === 'done') {
            await c.env.DB.prepare(
              'UPDATE habits SET streak_count = MAX(0, streak_count - 1), last_completed_date = CASE WHEN last_completed_date = ? THEN NULL ELSE last_completed_date END WHERE id = ?'
            ).bind(todayIST, hab.id).run();

            await c.env.DB.prepare(
              'DELETE FROM habit_completions WHERE habit_id = ? AND date = ?'
            ).bind(hab.id, todayIST).run();
          }
        }
      }

      // If source is long_term_goal: handle syllabus topic coverage and unit counters
      if (targetBlock.block_source === 'long_term_goal') {
        let goalRow: any = null;
        if (targetBlock.goal_id) {
          goalRow = await c.env.DB.prepare('SELECT * FROM goals WHERE id = ?').bind(targetBlock.goal_id).first();
        }
        if (!goalRow) {
          const allG = await c.env.DB.prepare('SELECT * FROM goals').all<any>();
          goalRow = (allG.results || []).find((g: any) => 
            targetBlock.title.toLowerCase().includes(g.title.toLowerCase()) || 
            g.title.toLowerCase().includes(targetBlock.title.toLowerCase())
          );
        }

        if (goalRow) {
          let syllabus: any[] = typeof goalRow.syllabus === 'string' ? JSON.parse(goalRow.syllabus) : goalRow.syllabus || [];

          if (status === 'done' && previousStatus !== 'done') {
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

            if (!topicMarked) {
              const uncov = syllabus.find((t: any) => !t.covered);
              if (uncov) {
                uncov.covered = true;
                uncov.status = 'COVERED';
              }
            }
          } else if (status !== 'done' && previousStatus === 'done') {
            let topicUnmarked = false;
            if (targetBlock.topic_id) {
              syllabus = syllabus.map((t: any) => {
                if (t.id === targetBlock.topic_id) {
                  topicUnmarked = true;
                  return { ...t, covered: false, status: 'UNTOUCHED' };
                }
                return t;
              });
            }

            if (!topicUnmarked) {
              const lastCov = [...syllabus].reverse().find((t: any) => t.covered);
              if (lastCov) {
                lastCov.covered = false;
                lastCov.status = 'UNTOUCHED';
              }
            }
          }

          const coveredCount = syllabus.filter((t: any) => t.covered).length;
          const totalUnits = Math.max(goalRow.total_units || 0, syllabus.length, 1);
          const coveredUnits = syllabus.length > 0
            ? (syllabus.length === totalUnits ? coveredCount : Math.round((coveredCount / syllabus.length) * totalUnits))
            : 0;
          await c.env.DB.prepare(
            'UPDATE goals SET syllabus = ?, covered_units = ?, total_units = ? WHERE id = ?'
          ).bind(JSON.stringify(syllabus), coveredUnits, totalUnits, goalRow.id).run();
        }
      }
    }

    return c.json({ success: true, schedule: blocks });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/schedule/monthly-task-points?month=YYYY-MM
scheduleRouter.get('/monthly-task-points', async (c) => {
  try {
    const todayIST = getTodayIST();
    const monthParam = c.req.query('month') || todayIST.slice(0, 7);
    const [yStr, mStr] = monthParam.split('-');
    const year = Number(yStr);
    const month = Number(mStr);
    const daysInMonth = new Date(year, month, 0).getDate();

    const { results } = await c.env.DB.prepare(
      'SELECT date, generated_plan FROM schedules WHERE date LIKE ?'
    ).bind(`${monthParam}-%`).all<any>();

    const map: Record<string, { completed: number; total: number }> = {};
    for (const row of (results || [])) {
      try {
        const blocks: ScheduleBlock[] = JSON.parse(row.generated_plan || '[]');
        const activeBlocks = blocks.filter(b => b.type !== 'break');
        const completed = activeBlocks.filter(b => b.status === 'done').length;
        map[row.date] = { completed, total: activeBlocks.length };
      } catch {
        map[row.date] = { completed: 0, total: 0 };
      }
    }

    const points = Array.from({ length: daysInMonth }, (_, idx) => {
      const day = idx + 1;
      const dateStr = `${monthParam}-${String(day).padStart(2, '0')}`;
      const data = map[dateStr] || { completed: 0, total: 0 };
      return {
        day,
        date: dateStr,
        points: data.completed,
        totalTasks: data.total,
        percentage: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      };
    });

    return c.json({
      success: true,
      month: monthParam,
      points,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/schedule/yearly-task-points?year=YYYY
scheduleRouter.get('/yearly-task-points', async (c) => {
  try {
    const todayIST = getTodayIST();
    const yearParam = c.req.query('year') || todayIST.slice(0, 4);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const { results } = await c.env.DB.prepare(
      'SELECT date, generated_plan FROM schedules WHERE date LIKE ?'
    ).bind(`${yearParam}-%`).all<any>();

    const map: Record<string, { completed: number; total: number; activeDays: Set<string> }> = {};
    for (let m = 1; m <= 12; m++) {
      const mStr = `${yearParam}-${String(m).padStart(2, '0')}`;
      map[mStr] = { completed: 0, total: 0, activeDays: new Set() };
    }

    for (const row of (results || [])) {
      const mStr = row.date.slice(0, 7);
      if (!map[mStr]) {
        map[mStr] = { completed: 0, total: 0, activeDays: new Set() };
      }
      try {
        const blocks: ScheduleBlock[] = JSON.parse(row.generated_plan || '[]');
        const activeBlocks = blocks.filter(b => b.type !== 'break');
        const completed = activeBlocks.filter(b => b.status === 'done').length;
        map[mStr].completed += completed;
        map[mStr].total += activeBlocks.length;
        if (completed > 0) {
          map[mStr].activeDays.add(row.date);
        }
      } catch {
        // ignore JSON errors
      }
    }

    const points = monthNames.map((label, idx) => {
      const monthNum = idx + 1;
      const monthStr = `${yearParam}-${String(monthNum).padStart(2, '0')}`;
      const data = map[monthStr] || { completed: 0, total: 0, activeDays: new Set() };
      const daysInMonth = new Date(Number(yearParam), monthNum, 0).getDate();
      return {
        monthIndex: monthNum,
        monthStr,
        label,
        points: data.completed,
        totalTasks: data.total,
        activeDays: data.activeDays.size,
        daysInMonth,
        percentage: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      };
    });

    return c.json({
      success: true,
      year: yearParam,
      points,
    });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});


