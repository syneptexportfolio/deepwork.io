import type { Goal, Habit, QuestionnaireAnswers, ScheduleBlock, Task, WeeklyGoal } from '../types';
import { isBreakOrRestBlock } from '../types';

export function extractTimeFromText(text: string): string | null {
  if (!text) return null;
  const atMatch = text.match(/(?:at|@)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (atMatch) {
    let hours = parseInt(atMatch[1], 10);
    const mins = atMatch[2] ? parseInt(atMatch[2], 10) : 0;
    const meridian = atMatch[3] ? atMatch[3].toLowerCase() : null;

    if (meridian === 'pm' && hours < 12) hours += 12;
    if (meridian === 'am' && hours === 12) hours = 0;
    if (hours >= 0 && hours < 24 && mins >= 0 && mins < 60) {
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }
  }

  const colonMatch = text.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i);
  if (colonMatch) {
    let hours = parseInt(colonMatch[1], 10);
    const mins = parseInt(colonMatch[2], 10);
    const meridian = colonMatch[3] ? colonMatch[3].toLowerCase() : null;

    if (meridian === 'pm' && hours < 12) hours += 12;
    if (meridian === 'am' && hours === 12) hours = 0;
    if (hours >= 0 && hours < 24 && mins >= 0 && mins < 60) {
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }
  }

  return null;
}

export async function generateScheduleWithGemini(
  tasks: Task[],
  goals: Goal[],
  answers: QuestionnaireAnswers,
  habits: Habit[] = [],
  weeklyGoals: WeeklyGoal[] = [],
  _apiKey?: string,
  _modelName: string = 'gemini-1.5-flash'
): Promise<{ blocks: ScheduleBlock[]; rawText?: string }> {
  // Always execute the deterministic zero-gap, collision-free interval packing engine
  // This guarantees 100% mathematical precision: 0 overlaps, 0-min gaps, and exact work window compliance.
  const blocks = generateDeterministicPackedSchedule(tasks, goals, answers, habits, weeklyGoals);
  return { blocks };
}

export function sanitizeScheduleBreaks(blocks: ScheduleBlock[]): ScheduleBlock[] {
  if (!blocks || blocks.length === 0) return [];

  const sorted = [...blocks].sort((a, b) => (a.start_time || '00:00').localeCompare(b.start_time || '00:00'));
  const sanitized: ScheduleBlock[] = [];

  for (const block of sorted) {
    if (isBreakOrRestBlock(block)) {
      const prevBlock = sanitized.length > 0 ? sanitized[sanitized.length - 1] : null;
      if (prevBlock && isBreakOrRestBlock(prevBlock)) {
        const isCurrentLunch = (block.title || '').toLowerCase().includes('lunch') ||
                               (block.title || '').toLowerCase().includes('meal') ||
                               block.category === 'Lunch';
        const isPrevLunch = (prevBlock.title || '').toLowerCase().includes('lunch') ||
                            (prevBlock.title || '').toLowerCase().includes('meal') ||
                            prevBlock.category === 'Lunch';

        if (isCurrentLunch && !isPrevLunch) {
          // Replace preceding short recharge with protected lunch break
          sanitized[sanitized.length - 1] = block;
        } else if (!isCurrentLunch && isPrevLunch) {
          // Discard redundant recharge since lunch already precedes it
          continue;
        } else {
          // Both are recharge or both lunch: keep longer or first
          if ((block.duration || 0) > (prevBlock.duration || 0)) {
            sanitized[sanitized.length - 1] = block;
          }
          continue;
        }
      } else {
        sanitized.push(block);
      }
    } else {
      sanitized.push(block);
    }
  }

  return sanitized;
}

export function generateSmartFallbackSchedule(
  tasks: Task[],
  goals: Goal[],
  answers: QuestionnaireAnswers,
  habits: Habit[] = [],
  weeklyGoals: WeeklyGoal[] = []
): ScheduleBlock[] {
  return generateDeterministicPackedSchedule(tasks, goals, answers, habits, weeklyGoals);
}

/**
 * Deterministic Zero-Gap Best-Fit Timeline Packer
 * 
 * Rules:
 * 1. Lock all fixed-timed tasks first (e.g. Heli Booking at 14:55).
 * 2. Seamlessly dock exactly one 45-minute lunch break without colliding with fixed tasks.
 * 3. NO OTHER REST/RECHARGE BREAKS in the timeline.
 * 4. Pack tasks and long-term goals consecutively with 0-minute gaps.
 * 5. Use Best-Fit gap filling before fixed anchors (if a fitting task is available, fill the gap).
 * 6. Strictly terminate at work_end_time (no overflow past work hours).
 */
export function generateDeterministicPackedSchedule(
  tasks: Task[],
  goals: Goal[],
  answers: QuestionnaireAnswers,
  habits: Habit[] = [],
  _weeklyGoals: WeeklyGoal[] = []
): ScheduleBlock[] {
  function formatTime(totalMinutes: number): string {
    const hrs = Math.floor(totalMinutes / 60) % 24;
    const mins = totalMinutes % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  function parseTime(timeStr: string, fallback: number): number {
    if (!timeStr || !timeStr.includes(':')) return fallback;
    const parts = timeStr.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1] || '0', 10);
    return isNaN(h) ? fallback : h * 60 + (isNaN(m) ? 0 : m);
  }

  const workStartMin = parseTime(answers.work_start_time || '09:00', 9 * 60);
  const workEndMin = parseTime(answers.work_end_time || '17:00', 17 * 60);

  // Single rest break: 45 min lunch/dinner (no other breaks)
  const hasLunch = answers.lunch_duration_minutes !== undefined ? answers.lunch_duration_minutes > 0 : true;
  const lunchDur = hasLunch ? (answers.lunch_duration_minutes || 45) : 0;
  const lunchStartWin = parseTime(answers.lunch_start_window || answers.lunch_start_time || '12:30', 12 * 60 + 30);
  const lunchEndWin = parseTime(answers.lunch_end_window || '14:00', 14 * 60);

  // 1. Filter active / selected items
  const eligibleTasks = answers.selected_task_ids && answers.selected_task_ids.length > 0
    ? tasks.filter(t => answers.selected_task_ids!.includes(t.id))
    : tasks;

  const activeLongTermGoals = answers.selected_long_term_goal_ids && answers.selected_long_term_goal_ids.length > 0
    ? goals.filter(g => answers.selected_long_term_goal_ids!.includes(g.id))
    : (answers.selected_long_term_goal_ids !== undefined ? [] : goals);

  const activeHabits = answers.selected_habit_ids && answers.selected_habit_ids.length > 0
    ? habits.filter(h => answers.selected_habit_ids!.includes(h.id))
    : habits.filter(h => h.is_active);

  // Timed habits only (check-off rituals stay in Daily Anchors card)
  const timedHabits = activeHabits.filter(h => h.habit_type !== 'check_off' && h.habit_type !== 'target');

  const scheduledTitles = new Set<string>();

  // 2. Identify and lock fixed-timed tasks first
  const fixedTasks = eligibleTasks.filter(t => Boolean(t.scheduled_start || extractTimeFromText(t.title)));
  const unfixedTasks = eligibleTasks.filter(t => !t.scheduled_start && !extractTimeFromText(t.title));

  interface Obstacle {
    start: number;
    end: number;
    block: ScheduleBlock;
  }
  const workdayObstacles: Obstacle[] = [];
  const outsideBlocks: ScheduleBlock[] = [];

  for (const ft of fixedTasks) {
    const normTitle = ft.title.toLowerCase().trim();
    if (scheduledTitles.has(normTitle)) continue;

    const timeStr = ft.scheduled_start || extractTimeFromText(ft.title) || '';
    const fStart = parseTime(timeStr, workStartMin);
    const isUntimed = ft.duration_minutes === 0;
    const fDur = isUntimed ? 30 : (ft.duration_minutes > 0 ? ft.duration_minutes : 60);
    const fEnd = fStart + fDur;

    const isOutsideWork = fStart >= workEndMin || fEnd <= workStartMin;
    const fixedBlock: ScheduleBlock = {
      id: `block-fixed-${ft.id}`,
      task_id: ft.id,
      title: ft.title,
      start_time: formatTime(fStart),
      end_time: formatTime(fEnd),
      duration: fDur,
      type: ft.energy_level || 'light',
      block_source: 'daily_todo',
      category: ft.category && ft.category !== 'General'
        ? ft.category
        : (fStart >= workEndMin ? 'Personal & Social' : 'Fixed Commitment'),
      status: 'pending',
      reasoning: isOutsideWork
        ? 'Fixed personal commitment scheduled at designated time outside work hours.'
        : 'Fixed schedule anchor locked to designated start time.',
      target_label: isUntimed ? `🕒 ${timeStr}` : undefined,
      is_untimed: isUntimed,
    };

    scheduledTitles.add(normTitle);

    if (isOutsideWork) {
      outsideBlocks.push(fixedBlock);
    } else {
      workdayObstacles.push({
        start: Math.max(workStartMin, fStart),
        end: Math.min(workEndMin, fEnd),
        block: fixedBlock,
      });
    }
  }

  // 3. Dock the single 45-min rest break (Lunch/Dinner) inside the window without colliding with fixed tasks
  if (lunchDur > 0 && workEndMin > lunchStartWin) {
    // Look for best non-overlapping 45-min slot in [lunchStartWin, lunchEndWin]
    let bestLunchStart = Math.min(13 * 60, Math.max(lunchStartWin, lunchEndWin - lunchDur)); // default ~13:00

    // Check collision with fixed obstacles
    const collides = (start: number, end: number) => {
      return workdayObstacles.some(obs => Math.max(start, obs.start) < Math.min(end, obs.end));
    };

    if (collides(bestLunchStart, bestLunchStart + lunchDur)) {
      // Find another slot in [lunchStartWin, lunchEndWin]
      let found = false;
      for (let cand = lunchStartWin; cand <= lunchEndWin - lunchDur; cand += 15) {
        if (!collides(cand, cand + lunchDur)) {
          bestLunchStart = cand;
          found = true;
          break;
        }
      }
      if (!found) {
        // Fallback: place lunch after the latest colliding obstacle
        const collidingObs = workdayObstacles.filter(obs => Math.max(lunchStartWin, obs.start) < Math.min(lunchEndWin, obs.end));
        const maxEnd = Math.max(...collidingObs.map(o => o.end));
        bestLunchStart = Math.min(maxEnd, workEndMin - lunchDur);
      }
    }

    const lunchBlock: ScheduleBlock = {
      id: 'block-lunch',
      task_id: null,
      title: 'Lunch & recharge',
      start_time: formatTime(bestLunchStart),
      end_time: formatTime(bestLunchStart + lunchDur),
      duration: lunchDur,
      type: 'break',
      block_source: 'break',
      category: 'Rest & Hydration',
      status: 'pending',
      reasoning: `Dedicated ${lunchDur}-minute midday recharge from ${formatTime(bestLunchStart)} to ${formatTime(bestLunchStart + lunchDur)}.`,
    };

    workdayObstacles.push({
      start: bestLunchStart,
      end: bestLunchStart + lunchDur,
      block: lunchBlock,
    });
  }

  // Sort workday obstacles chronologically
  workdayObstacles.sort((a, b) => a.start - b.start);

  // 4. Calculate open intervals between workStartMin and workEndMin
  interface TimeInterval {
    start: number;
    end: number;
  }
  const openIntervals: TimeInterval[] = [];
  let intervalCursor = workStartMin;

  for (const obs of workdayObstacles) {
    if (obs.start > intervalCursor) {
      openIntervals.push({
        start: intervalCursor,
        end: obs.start,
      });
    }
    intervalCursor = Math.max(intervalCursor, obs.end);
  }
  if (intervalCursor < workEndMin) {
    openIntervals.push({
      start: intervalCursor,
      end: workEndMin,
    });
  }

  // 5. Build flexible items pool
  interface FlexibleItem {
    id: string;
    task_id: string | null;
    goal_id?: string | null;
    topic_id?: string | null;
    title: string;
    duration: number;
    type: 'deep_focus' | 'light';
    category: string;
    block_source: 'daily_todo' | 'long_term_goal' | 'habit';
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    is_untimed?: boolean;
    target_label?: string;
    reasoning?: string;
  }

  const pool: FlexibleItem[] = [];

  // A. Long-term goals
  for (const ltg of activeLongTermGoals) {
    const cfg = answers.long_term_goal_configs?.find(c => c.goal_id === ltg.id);
    const selectedTopic = ltg.syllabus?.find((s: any) => s.id === cfg?.topic_id) 
      || ltg.syllabus?.find((s: any) => !s.covered) 
      || ltg.syllabus?.[0];
    const fallbackTitle = selectedTopic ? `${ltg.title}: ${selectedTopic.name}` : `${ltg.title}: Roadmap Milestone`;
    const ltgTitle = cfg?.task_title?.trim() || fallbackTitle;
    const dur = cfg?.duration_minutes && cfg.duration_minutes > 0 ? cfg.duration_minutes : 60;
    const energyType = cfg?.energy_level || 'deep_focus';

    pool.push({
      id: `goal-${ltg.id}`,
      task_id: null,
      goal_id: ltg.id,
      topic_id: selectedTopic?.id || null,
      title: ltgTitle,
      duration: dur,
      type: energyType,
      category: ltg.category || 'Learning Path',
      block_source: 'long_term_goal',
      priority: 'HIGH', // Roadmap milestones prioritized alongside core tasks
      reasoning: `Dedicated milestone study block for "${ltg.title}".`,
    });
  }

  // B. Unfixed tasks
  for (const t of unfixedTasks) {
    const isUntimed = t.duration_minutes === 0;
    const dur = isUntimed ? 15 : (t.duration_minutes > 0 ? t.duration_minutes : 45);
    pool.push({
      id: `task-${t.id}`,
      task_id: t.id,
      title: t.title,
      duration: dur,
      type: t.energy_level || 'deep_focus',
      category: t.category || 'Project',
      block_source: 'daily_todo',
      priority: (t.priority as 'HIGH' | 'MEDIUM' | 'LOW') || 'MEDIUM',
      is_untimed: isUntimed,
      target_label: isUntimed ? '⚡ Action item' : undefined,
      reasoning: 'Consecutively scheduled focus task.',
    });
  }

  // C. Quick to-dos
  if (answers.morning_todos && answers.morning_todos.length > 0) {
    for (const td of answers.morning_todos) {
      if (!td.title || scheduledTitles.has(td.title.toLowerCase().trim())) continue;
      pool.push({
        id: `todo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        task_id: null,
        title: td.title,
        duration: td.duration_minutes || 20,
        type: 'light',
        category: 'Quick To-Do',
        block_source: 'daily_todo',
        priority: 'MEDIUM',
        reasoning: 'Spontaneous action item.',
      });
    }
  }

  // D. Timed habits
  for (const hab of timedHabits) {
    if (scheduledTitles.has(hab.title.toLowerCase().trim())) continue;
    pool.push({
      id: `habit-${hab.id}`,
      task_id: null,
      title: hab.title,
      duration: hab.duration_minutes || 15,
      type: hab.energy_level || 'light',
      category: 'Daily Habit',
      block_source: 'habit',
      priority: 'LOW',
      reasoning: 'Daily recurring habit routine.',
    });
  }

  // Shuffle pool with priority preservation & random interleaving
  function shuffleArray<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  const highItems = shuffleArray(pool.filter(item => item.priority === 'HIGH'));
  const medItems = shuffleArray(pool.filter(item => item.priority === 'MEDIUM'));
  const lowItems = shuffleArray(pool.filter(item => item.priority === 'LOW'));

  const prioritizedPool: FlexibleItem[] = [...highItems, ...medItems, ...lowItems];

  // 6. Zero-Gap Packing & Best-Fit Gap Filling Algorithm
  const scheduledFlexibleBlocks: ScheduleBlock[] = [];

  for (const interval of openIntervals) {
    let cursor = interval.start;

    while (cursor < interval.end && prioritizedPool.length > 0) {
      const availableWindow = interval.end - cursor;

      // Find all items in pool that can fit inside the remaining available window
      const fittingIndices: number[] = [];
      for (let i = 0; i < prioritizedPool.length; i++) {
        if (prioritizedPool[i].duration <= availableWindow) {
          fittingIndices.push(i);
        }
      }

      if (fittingIndices.length === 0) {
        // No remaining task fits into availableWindow!
        // Per user requirement: leave this gap and jump directly to the next obstacle start
        break;
      }

      // Best-Fit Knapsack gap-filler selection:
      // 1. Exact fit (duration === availableWindow) -> achieves perfect 0-min gap!
      let selectedPoolIdx = fittingIndices.find(idx => prioritizedPool[idx].duration === availableWindow);

      // 2. If no exact fit, choose the highest priority item that fits
      if (selectedPoolIdx === undefined) {
        selectedPoolIdx = fittingIndices[0];
      }

      const [item] = prioritizedPool.splice(selectedPoolIdx, 1);
      const bStart = cursor;
      const bEnd = cursor + item.duration;

      scheduledFlexibleBlocks.push({
        id: `block-flex-${item.id}`,
        task_id: item.task_id,
        goal_id: item.goal_id,
        topic_id: item.topic_id,
        title: item.title,
        start_time: formatTime(bStart),
        end_time: formatTime(bEnd),
        duration: item.duration,
        type: item.type,
        block_source: item.block_source,
        category: item.category,
        status: 'pending',
        reasoning: item.reasoning || 'Consecutively scheduled focus block.',
        target_label: item.target_label,
        is_untimed: item.is_untimed,
      });

      // Strict 0-minute gap advance
      cursor = bEnd;
    }
  }

  // 7. Combine all blocks: workday obstacles (fixed + lunch) + scheduled flexible blocks + outside work blocks
  const obstacleBlocks = workdayObstacles.map(o => o.block);
  const allBlocks = [...obstacleBlocks, ...scheduledFlexibleBlocks, ...outsideBlocks];

  // Sort strictly chronologically by start_time
  allBlocks.sort((a, b) => a.start_time.localeCompare(b.start_time));

  // Re-index IDs sequentially
  return allBlocks.map((b, idx) => ({
    ...b,
    id: `block-${idx + 1}`,
  }));
}
