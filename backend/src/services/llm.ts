import { Goal, Habit, QuestionnaireAnswers, ScheduleBlock, Task, WeeklyGoal, isBreakOrRestBlock } from '../types';

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
  apiKey?: string,
  modelName: string = 'gemini-1.5-flash'
): Promise<{ blocks: ScheduleBlock[]; rawText?: string }> {
  // If API key is not configured, gracefully fallback to the smart deterministic timetable generator
  if (!apiKey || apiKey.trim() === '' || apiKey === 'YOUR_GEMINI_API_KEY') {
    return { blocks: generateSmartFallbackSchedule(tasks, goals, answers, habits, weeklyGoals) };
  }

  const prompt = buildGeminiPrompt(tasks, goals, answers, habits, weeklyGoals);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Gemini API error (HTTP ${response.status}): ${errorText}. Falling back to smart scheduler.`);
      return { blocks: generateSmartFallbackSchedule(tasks, goals, answers, habits, weeklyGoals) };
    }

    const data = (await response.json()) as any;
    const jsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!jsonText) {
      return { blocks: generateSmartFallbackSchedule(tasks, goals, answers, habits, weeklyGoals) };
    }

    const parsed = JSON.parse(jsonText);
    const rawBlocks: ScheduleBlock[] = Array.isArray(parsed) ? parsed : (parsed.schedule || parsed.blocks || []);
    
    // Habits that are check_off or target must not be in the hourly work timetable (handled in Daily Anchors card)
    const anchorHabitTitles = new Set(
      habits
        .filter(h => h.habit_type === 'check_off' || h.habit_type === 'target')
        .map(h => h.title.toLowerCase().trim())
    );

    // Deduplicate by title and exclude anchor/target habits
    const seen = new Set<string>();
    const deduplicatedBlocks: ScheduleBlock[] = [];
    for (const b of rawBlocks) {
      const norm = (b.title || '').toLowerCase().trim();
      if (!isBreakOrRestBlock(b)) {
        if (anchorHabitTitles.has(norm)) continue;
        if (seen.has(norm)) continue;
        seen.add(norm);
      }
      deduplicatedBlocks.push(b);
    }

    // Sort chronologically by start_time
    deduplicatedBlocks.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

    return { blocks: sanitizeScheduleBreaks(deduplicatedBlocks), rawText: jsonText };
  } catch (err: any) {
    console.error('Error invoking Gemini Flash API:', err);
    return { blocks: generateSmartFallbackSchedule(tasks, goals, answers, habits, weeklyGoals) };
  }
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

function buildGeminiPrompt(
  tasks: Task[],
  goals: Goal[],
  answers: QuestionnaireAnswers,
  habits: Habit[],
  weeklyGoals: WeeklyGoal[]
): string {
  // Filter active habits or selected habits
  const selectedHabits = answers.selected_habit_ids && answers.selected_habit_ids.length > 0
    ? habits.filter(h => answers.selected_habit_ids!.includes(h.id))
    : habits.filter(h => h.is_active);

  // Filter selected weekly goals
  const selectedWeeklyGoals = answers.selected_weekly_goal_ids && answers.selected_weekly_goal_ids.length > 0
    ? weeklyGoals.filter(w => answers.selected_weekly_goal_ids!.includes(w.id))
    : weeklyGoals;

  // Filter selected long-term goals
  const selectedLongTermGoals = answers.selected_long_term_goal_ids && answers.selected_long_term_goal_ids.length > 0
    ? goals.filter(g => answers.selected_long_term_goal_ids!.includes(g.id))
    : goals;

  // Filter selected tasks
  const selectedTasks = answers.selected_task_ids && answers.selected_task_ids.length > 0
    ? tasks.filter(t => answers.selected_task_ids!.includes(t.id))
    : tasks;

  return `You are Asst. JUGNU DAS, an elite personal AI timetable and cognitive rhythm architect.
Your goal is to build an optimal, sustainable daily schedule for a user in IST timezone.

THE 3-TIER COGNITIVE HIERARCHY TO MERGE TODAY:
1. DAILY HABITS (Set monthly, repeating daily anchors):
${JSON.stringify(selectedHabits.map(h => ({ 
  id: h.id, 
  title: h.title, 
  type: h.habit_type || (h.duration_minutes > 0 ? 'timed' : 'check_off'),
  target: h.target_value ? `${h.target_value} ${h.target_unit || ''}`.trim() : undefined,
  duration_minutes: h.duration_minutes, 
  anchor: h.anchor, 
  energy: h.energy_level 
})), null, 2)}

2. LONG-TERM GOALS & ROADMAPS (Multi-month learning paths / career masteries to advance):
${JSON.stringify(selectedLongTermGoals.map(g => {
  const cfg = answers.long_term_goal_configs?.find(c => c.goal_id === g.id);
  const nextPendingTopic = g.syllabus?.find((s: any) => s.id === cfg?.topic_id)?.name 
    || g.syllabus?.find((s: any) => !s.covered)?.name 
    || 'Curriculum Progress';
  return {
    id: g.id,
    title: g.title,
    category: g.category,
    topic_id: cfg?.topic_id || g.syllabus?.find((s: any) => !s.covered)?.id || null,
    next_milestone_topic: nextPendingTopic,
    today_task_title: cfg?.task_title || `${g.title}: ${nextPendingTopic}`,
    duration_minutes: cfg?.duration_minutes || 60,
    energy: cfg?.energy_level || 'deep_focus',
    progress: `${g.covered_units || 0}/${g.total_units || (g.syllabus?.length || 10)} units`
  };
}), null, 2)}

3. DAILY TASKS & TO-DOS (Explicitly organized into Morning, Afternoon, and Evening buckets):
${JSON.stringify([
  ...selectedTasks.map(t => {
    const detectedTime = t.scheduled_start || extractTimeFromText(t.title);
    return {
      id: t.id as string | null,
      title: t.title,
      time_bucket: t.column_bucket === 'now' ? 'Morning' : t.column_bucket === 'up_next' ? 'Afternoon' : 'Evening',
      scheduled_time: detectedTime || null,
      duration_minutes: t.duration_minutes === 0 ? 'untimed / meeting / call' : t.duration_minutes,
      priority: t.priority,
      energy: t.energy_level
    };
  }),
  ...(answers.morning_todos || []).map(td => ({
    id: null as string | null,
    title: td.title,
    time_bucket: 'Morning',
    scheduled_time: extractTimeFromText(td.title) || null,
    duration_minutes: td.duration_minutes || 20,
    priority: 'MEDIUM' as const,
    energy: 'light' as const
  }))
], null, 2)}

QUESTIONNAIRE RESPONSES:
- Available focus hours today: ${answers.available_hours} hours
- Wake time: ${answers.wake_time}
- Sleep time: ${answers.sleep_time}
- Core Working Hours: ${answers.work_start_time || '09:00'} to ${answers.work_end_time || '17:00'}
- Midday Lunch Break: ${answers.lunch_start_time ? `${answers.lunch_start_time} (${answers.lunch_duration_minutes || 45} mins)` : 'None'}
- Energy level: ${answers.energy_level}
- Top priority for today: "${answers.top_priority}"
- Fixed commitments: "${answers.fixed_commitments || 'None'}"
- Style preference: "${answers.focus_preference || 'Deep work early, lighter review later'}"

SCHEDULING RULES:
1. WORKDAY TIMEFRAME BOUNDARIES (FOR FLEXIBLE WORK & DAYTIME HABITS):
   - The core workday begins at ${answers.work_start_time || '09:00'}.
   - ALL flexible work tasks, long-term roadmap study goals, daytime habits, and work breaks MUST strictly conclude at or before ${answers.work_end_time || '17:00'}.
   - NEVER schedule flexible work blocks outside ${answers.work_start_time || '09:00'} to ${answers.work_end_time || '17:00'}.
2. TIME-SPECIFIC COMMITMENTS & EVENTS (MANDATORY, INCLUDING OUTSIDE WORK HOURS):
   - Any task with a scheduled_time (e.g. "20:00", meetings, appointments, calls, dinner, party at 8:00pm, evening events, early morning workouts) or mentioned in fixed commitments MUST be scheduled at that exact designated start time.
   - CRITICAL: If a task has an explicit scheduled_time outside core working hours (e.g. "Party at 8:00pm" / 20:00, or a 07:00 workout), YOU MUST SCHEDULE IT on the daily timetable at that exact hour anywhere within the user's active waking day (${answers.wake_time} to ${answers.sleep_time}). Do NOT omit, discard, or clamp time-specific events into work hours!
   - Mark outside-work-hours evening social/personal events with category="Personal & Social" and appropriate reasoning.
3. NO DUPLICATES: Every task, habit, and to-do must appear at most once in the timetable. Never schedule the same item twice.
4. CHRONOLOGICAL TIME-OF-DAY BUCKET CONTRACT:
   - MORNING WINDOW (${answers.work_start_time || '09:00'} → ${answers.lunch_start_time || '13:00'}):
     - Reserved for tasks in the 'Morning' bucket, morning quick to-dos, and top priorities.
     - Prime 60-75m morning focus block (e.g. 09:00-10:15) MUST be assigned to the user's top_priority or the highest-priority task from the 'Morning' bucket.
   - MIDDAY LUNCH BREAK (${answers.lunch_start_time || '13:00'} for ${answers.lunch_duration_minutes || 45} mins):
     - Insert a protected "Lunch & recharge" break (block_source="break", category="Rest & Hydration").
   - AFTERNOON WINDOW (Lunch End → Late Afternoon):
     - Reserved for tasks in the 'Afternoon' bucket (calls, meetings, outreach, action items).
   - EVENING WINDOW (Late Afternoon → ${answers.work_end_time || '17:00'}, PLUS any fixed evening commitments at their exact time):
     - Work tasks in the 'Evening' bucket must wrap up before ${answers.work_end_time || '17:00'}.
     - Any fixed evening events (e.g. party, social dinner) are placed at their exact designated start time (e.g. 20:00).
5. INTERLEAVE LONG-TERM GOALS (DO NOT CLUSTER SEQUENTIALLY):
   - Do NOT cluster long-term roadmap goals back-to-back in a single rigid block.
   - Interleave and distribute long-term roadmap goals flexibly among the daily tasks within the workday timeframe (for example, 1 goal block in the morning alternating with a morning task, and 1 goal block in the afternoon alternating with an afternoon task).
6. HARD CEILING AT ${answers.work_end_time || '17:00'} FOR FLEXIBLE WORK:
   - Flexible work and study tasks must never overflow past ${answers.work_end_time || '17:00'}. Only fixed-time commitments with explicit scheduled_time can be placed after ${answers.work_end_time || '17:00'}.
7. HABIT RULES: 
   - Only schedule habits on the hourly timetable if they are TIMED focus sessions (e.g. "Morning planning", "Daily Review" where type='timed' and duration > 0).
   - Do NOT insert check-off milestones ("Wake up early") or all-day metric targets ("Drink 3L Water", "Walk 10,000+ Steps") as work blocks on the timetable—those are managed in the dedicated Daily Anchors panel.
8. ZERO OVERLAPS & CHRONOLOGICAL ORDER:
   - Ensure no two blocks overlap in time. Each block's start_time must be greater than or equal to the previous block's end_time.
   - Return blocks in ascending chronological sequence.
9. UNTIMED TASKS: For untimed tasks (duration 0, meetings, calls, errands), schedule them with "is_untimed": true and "target_label": "⚡ Action item" or "🕒 HH:MM".
10. RECHARGE BREAKS: Insert 10-15 minute "Step away & recharge" breaks between deep work sessions. CRITICAL: Breaks/rest periods CANNOT be scheduled one after another or consecutively. Every break MUST be preceded and followed by a work/focus session. Never place two breaks adjacent to each other.
11. ASSIGN TASK IDs: For any block created from an existing task in the list, set "task_id" to that task's id; otherwise set null.
12. TIME FORMAT: 24-hour "HH:MM".
13. BLOCK SOURCE: One of: "habit", "long_term_goal", "daily_todo", "break".

OUTPUT FORMAT:
Return a valid JSON array of ScheduleBlock objects conforming strictly to this schema:
[
  {
    "id": "block-1",
    "task_id": "string or null",
    "title": "Task or habit title",
    "start_time": "08:30",
    "end_time": "09:00",
    "duration": 30,
    "type": "deep_focus" | "light" | "break",
    "block_source": "habit" | "long_term_goal" | "daily_todo" | "break",
    "category": "category name",
    "status": "pending",
    "reasoning": "Reasoning for cognitive placement",
    "target_label": "string or undefined",
    "is_untimed": true or false
  }
]`;
}

function getHabitDisplayMeta(hab: Habit): { target_label?: string; is_untimed: boolean; duration: number } {
  if (hab.habit_type === 'check_off') {
    return {
      target_label: hab.target_value ? `⚡ ${hab.target_value}` : '⚡ Ritual',
      is_untimed: true,
      duration: 5,
    };
  }
  if (hab.habit_type === 'target') {
    return {
      target_label: `🎯 ${hab.target_value || ''} ${hab.target_unit || ''}`.trim(),
      is_untimed: true,
      duration: 5,
    };
  }
  return {
    target_label: undefined,
    is_untimed: false,
    duration: hab.duration_minutes > 0 ? hab.duration_minutes : 15,
  };
}

export function generateSmartFallbackSchedule(
  tasks: Task[],
  goals: Goal[],
  answers: QuestionnaireAnswers,
  habits: Habit[] = [],
  weeklyGoals: WeeklyGoal[] = []
): ScheduleBlock[] {
  const blocks: ScheduleBlock[] = [];
  const scheduledTitles = new Set<string>();

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

  const wakeMin = parseTime(answers.wake_time, 7 * 60 + 30);
  const sleepMin = parseTime(answers.sleep_time, 23 * 60 + 30);
  const workStartMin = parseTime(answers.work_start_time || '09:00', 9 * 60);
  const workEndMin = parseTime(answers.work_end_time || '17:00', 17 * 60);
  const lunchStartMin = answers.lunch_start_time ? parseTime(answers.lunch_start_time, 13 * 60) : 13 * 60;
  const lunchDur = answers.lunch_duration_minutes !== undefined ? answers.lunch_duration_minutes : 45;

  // 1. Filter active/selected items
  const activeHabits = answers.selected_habit_ids && answers.selected_habit_ids.length > 0
    ? habits.filter(h => answers.selected_habit_ids!.includes(h.id))
    : habits.filter(h => h.is_active);

  const activeWeeklyGoals = answers.selected_weekly_goal_ids && answers.selected_weekly_goal_ids.length > 0
    ? weeklyGoals.filter(w => answers.selected_weekly_goal_ids!.includes(w.id))
    : weeklyGoals;

  const activeLongTermGoals = answers.selected_long_term_goal_ids && answers.selected_long_term_goal_ids.length > 0
    ? goals.filter(g => answers.selected_long_term_goal_ids!.includes(g.id))
    : (answers.selected_long_term_goal_ids !== undefined ? [] : goals);

  const eligibleTasks = answers.selected_task_ids && answers.selected_task_ids.length > 0
    ? tasks.filter(t => answers.selected_task_ids!.includes(t.id))
    : tasks;

  // Separate tasks into fixed scheduled vs buckets (supporting explicit scheduled_start and times in title)
  const fixedTasks = eligibleTasks.filter(t => Boolean(t.scheduled_start || extractTimeFromText(t.title)));
  const unfixedTasks = eligibleTasks.filter(t => !t.scheduled_start && !extractTimeFromText(t.title));

  const morningTasks = unfixedTasks.filter(t => t.column_bucket === 'now');
  const afternoonTasks = unfixedTasks.filter(t => t.column_bucket === 'up_next');
  const eveningTasks = unfixedTasks.filter(t => t.column_bucket === 'later');

  // Prepare Long-Term Goals queue for flexible interleaving across the day
  const ltgQueue = activeLongTermGoals.map(ltg => {
    const cfg = answers.long_term_goal_configs?.find(c => c.goal_id === ltg.id);
    const selectedTopic = ltg.syllabus?.find((s: any) => s.id === cfg?.topic_id) 
      || ltg.syllabus?.find((s: any) => !s.covered) 
      || ltg.syllabus?.[0];
    const fallbackTitle = selectedTopic ? `${ltg.title}: ${selectedTopic.name}` : `${ltg.title}: Roadmap Milestone`;
    const ltgTitle = cfg?.task_title?.trim() || fallbackTitle;
    const dur = cfg?.duration_minutes && cfg.duration_minutes > 0 ? cfg.duration_minutes : 60;
    const energyType = cfg?.energy_level || 'deep_focus';
    return { ltg, selectedTopic, ltgTitle, dur, energyType };
  });

  // 1. Build fixed commitments (anchors both inside and outside core workday window)
  const scheduledFixedBlocks: ScheduleBlock[] = [];
  for (const ft of fixedTasks) {
    if (scheduledTitles.has(ft.title.toLowerCase().trim())) continue;
    const timeStr = ft.scheduled_start || extractTimeFromText(ft.title) || '';
    const fStart = parseTime(timeStr, workStartMin);
    const isUntimed = ft.duration_minutes === 0;
    const fDur = isUntimed ? 30 : (ft.duration_minutes > 0 ? ft.duration_minutes : 60);
    const fEnd = fStart + fDur;

    if (fStart >= 0 && fEnd <= 24 * 60) {
      const isOutsideWork = fStart >= workEndMin || fEnd <= workStartMin;
      scheduledFixedBlocks.push({
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
          ? (fStart >= workEndMin
            ? 'Evening personal commitment scheduled at designated time outside work hours.'
            : 'Early morning commitment scheduled at designated time before workday start.')
          : 'Fixed schedule anchor locked to designated start time.',
        target_label: isUntimed ? `🕒 ${timeStr}` : undefined,
        is_untimed: isUntimed
      });
      scheduledTitles.add(ft.title.toLowerCase().trim());
    }
  }

  // START STRICTLY AT workStartMin (e.g. 09:00 AM)
  let currentMinutes = workStartMin;

  function advancePastWorkdayFixed(fromMin: number, neededDur: number): number {
    let cur = fromMin;
    for (const fb of scheduledFixedBlocks) {
      const fbStart = parseTime(fb.start_time, 0);
      const fbEnd = parseTime(fb.end_time, 0);
      if (fbStart >= workStartMin && fbStart < workEndMin) {
        if (cur >= fbStart && cur < fbEnd) {
          cur = fbEnd;
        } else if (cur < fbStart && cur + neededDur > fbStart) {
          cur = fbEnd;
        }
      }
    }
    return cur;
  }

  function canFit(duration: number): boolean {
    const nextStart = advancePastWorkdayFixed(currentMinutes, duration);
    return nextStart + duration <= workEndMin;
  }

  // --- MORNING PHASE (workStartMin → Lunch) ---
  // A. Optional timed morning planning habit (if type is timed)
  const morningTimedHabit = activeHabits.find(h => h.anchor === 'morning' && h.habit_type !== 'check_off' && h.habit_type !== 'target');
  if (morningTimedHabit && canFit(morningTimedHabit.duration_minutes || 15)) {
    const meta = getHabitDisplayMeta(morningTimedHabit);
    const s = formatTime(currentMinutes);
    currentMinutes += meta.duration;
    const e = formatTime(currentMinutes);
    blocks.push({
      id: `block-${blocks.length + 1}`,
      task_id: null,
      title: morningTimedHabit.title,
      start_time: s,
      end_time: e,
      duration: meta.duration,
      type: morningTimedHabit.energy_level || 'light',
      block_source: 'habit',
      category: 'Daily Habit',
      status: 'pending',
      reasoning: 'Morning alignment & planning at the start of the workday.',
      target_label: meta.target_label,
      is_untimed: meta.is_untimed
    });
    scheduledTitles.add(morningTimedHabit.title.toLowerCase().trim());
  }

  // B. Prime Morning Deep Focus Block (from morningTasks or top priority)
  const primaryMorningTask = morningTasks.find(t => t.priority === 'HIGH' && !scheduledTitles.has(t.title.toLowerCase().trim()))
    || morningTasks.find(t => !scheduledTitles.has(t.title.toLowerCase().trim()))
    || (morningTasks.length === 0 ? unfixedTasks.find(t => t.priority === 'HIGH' && !scheduledTitles.has(t.title.toLowerCase().trim())) : null);

  const dur1 = answers.energy_level === 'light' ? 60 : 75;
  if (canFit(dur1)) {
    const s1 = formatTime(currentMinutes);
    currentMinutes += dur1;
    const e1 = formatTime(currentMinutes);

    const primaryTitle = answers.top_priority && answers.top_priority.trim() !== '' && answers.top_priority !== 'Core daily priorities'
      ? answers.top_priority.trim()
      : (primaryMorningTask ? primaryMorningTask.title : 'Morning Deep Focus Sprint');

    blocks.push({
      id: `block-${blocks.length + 1}`,
      task_id: primaryMorningTask?.id || null,
      title: primaryTitle,
      start_time: s1,
      end_time: e1,
      duration: dur1,
      type: 'deep_focus',
      block_source: 'daily_todo',
      category: primaryMorningTask?.category || 'Morning Focus',
      status: 'pending',
      reasoning: 'Prime morning cognitive peak allocated to main priority.'
    });
    scheduledTitles.add(primaryTitle.toLowerCase().trim());
    if (primaryMorningTask) scheduledTitles.add(primaryMorningTask.title.toLowerCase().trim());

    // Recharge Break
    if (canFit(15)) {
      const bs1 = formatTime(currentMinutes);
      currentMinutes += 15;
      const be1 = formatTime(currentMinutes);
      blocks.push({
        id: `block-${blocks.length + 1}`,
        task_id: null,
        title: 'Step away & recharge',
        start_time: bs1,
        end_time: be1,
        duration: 15,
        type: 'break',
        block_source: 'break',
        category: 'Rest & Hydration',
        status: 'pending',
        reasoning: 'Screen-free mental break to consolidate deep work.'
      });
    }
  }

  // C. Interleave 1 Long-Term Goal in the Morning (if one exists and fits before lunch)
  const morningCeiling = lunchDur > 0 ? lunchStartMin : workEndMin;
  if (ltgQueue.length > 0) {
    const nextLtg = ltgQueue[0];
    if (currentMinutes + nextLtg.dur <= morningCeiling && canFit(nextLtg.dur)) {
      ltgQueue.shift(); // Dequeue
      const s = formatTime(currentMinutes);
      currentMinutes += nextLtg.dur;
      const e = formatTime(currentMinutes);

      blocks.push({
        id: `block-${blocks.length + 1}`,
        task_id: null,
        topic_id: nextLtg.selectedTopic?.id || null,
        goal_id: nextLtg.ltg.id,
        title: nextLtg.ltgTitle,
        start_time: s,
        end_time: e,
        duration: nextLtg.dur,
        type: nextLtg.energyType,
        block_source: 'long_term_goal',
        category: nextLtg.ltg.category || 'Learning Path',
        status: 'pending',
        reasoning: `Interleaved milestone study block for "${nextLtg.ltg.title}".`
      });
      scheduledTitles.add(nextLtg.ltg.title.toLowerCase().trim());
      scheduledTitles.add(nextLtg.ltgTitle.toLowerCase().trim());
    }
  }

  // D. Remaining Morning Tasks before lunch
  for (const t of morningTasks) {
    if (scheduledTitles.has(t.title.toLowerCase().trim())) continue;
    const isUntimed = t.duration_minutes === 0;
    const dur = isUntimed ? 25 : t.duration_minutes;

    if (currentMinutes + dur > morningCeiling || !canFit(dur)) break;

    const s = formatTime(currentMinutes);
    currentMinutes += dur;
    const e = formatTime(currentMinutes);

    blocks.push({
      id: `block-${blocks.length + 1}`,
      task_id: t.id,
      title: t.title,
      start_time: s,
      end_time: e,
      duration: dur,
      type: t.energy_level || 'light',
      block_source: 'daily_todo',
      category: t.category || 'Morning Focus',
      status: 'pending',
      reasoning: 'Morning task scheduled in morning focus window.',
      target_label: isUntimed ? '⚡ Action item' : undefined,
      is_untimed: isUntimed
    });
    scheduledTitles.add(t.title.toLowerCase().trim());
  }

  // E. Quick Morning To-Dos Brain Dump
  if (answers.morning_todos && answers.morning_todos.length > 0) {
    for (const td of answers.morning_todos) {
      if (!td.title || scheduledTitles.has(td.title.toLowerCase().trim())) continue;
      const dur = td.duration_minutes || 20;
      if (currentMinutes + dur > morningCeiling || !canFit(dur)) break;

      const s = formatTime(currentMinutes);
      currentMinutes += dur;
      const e = formatTime(currentMinutes);

      blocks.push({
        id: `block-${blocks.length + 1}`,
        task_id: null,
        title: td.title,
        start_time: s,
        end_time: e,
        duration: dur,
        type: 'light',
        block_source: 'daily_todo',
        category: 'Quick To-Do',
        status: 'pending',
        reasoning: 'Spontaneous morning action item.'
      });
      scheduledTitles.add(td.title.toLowerCase().trim());
    }
  }

  // F. Fill remaining open morning window before lunch with pending tasks
  for (const at of afternoonTasks) {
    if (scheduledTitles.has(at.title.toLowerCase().trim())) continue;
    const isUntimed = at.duration_minutes === 0;
    const dur = isUntimed ? 30 : at.duration_minutes;
    if (currentMinutes + dur > morningCeiling || !canFit(dur)) break;

    const s = formatTime(currentMinutes);
    currentMinutes += dur;
    const e = formatTime(currentMinutes);

    blocks.push({
      id: `block-${blocks.length + 1}`,
      task_id: at.id,
      title: at.title,
      start_time: s,
      end_time: e,
      duration: dur,
      type: at.energy_level || 'light',
      block_source: 'daily_todo',
      category: at.category || 'Focus Task',
      status: 'pending',
      reasoning: 'Productive execution block scheduled into open morning focus window.',
      target_label: isUntimed ? '⚡ Action item' : undefined,
      is_untimed: isUntimed
    });
    scheduledTitles.add(at.title.toLowerCase().trim());
  }

  // --- MIDDAY LUNCH BREAK ---
  if (lunchDur > 0 && canFit(lunchDur)) {
    const lStart = Math.max(currentMinutes, lunchStartMin);
    if (lStart + lunchDur <= workEndMin) {
      currentMinutes = lStart;
      const lEnd = currentMinutes + lunchDur;
      blocks.push({
        id: `block-${blocks.length + 1}`,
        task_id: null,
        title: 'Lunch & recharge',
        start_time: formatTime(currentMinutes),
        end_time: formatTime(lEnd),
        duration: lunchDur,
        type: 'break',
        block_source: 'break',
        category: 'Rest & Hydration',
        status: 'pending',
        reasoning: 'Protected midday meal and cognitive recovery break.'
      });
      currentMinutes = lEnd;
    }
  }

  // --- AFTERNOON PHASE ---
  // Sort afternoon tasks by priority
  const sortedAfternoonTasks = [...afternoonTasks].sort((a, b) => {
    const pOrder: Record<string, number> = { HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (pOrder[a.priority || 'MEDIUM'] ?? 2) - (pOrder[b.priority || 'MEDIUM'] ?? 2);
  });

  // Schedule first afternoon task
  if (sortedAfternoonTasks.length > 0) {
    const at = sortedAfternoonTasks[0];
    if (!scheduledTitles.has(at.title.toLowerCase().trim())) {
      const isUntimed = at.duration_minutes === 0;
      const dur = isUntimed ? 30 : at.duration_minutes;
      if (canFit(dur)) {
        const s = formatTime(currentMinutes);
        currentMinutes += dur;
        const e = formatTime(currentMinutes);
        blocks.push({
          id: `block-${blocks.length + 1}`,
          task_id: at.id,
          title: at.title,
          start_time: s,
          end_time: e,
          duration: dur,
          type: at.energy_level || 'light',
          block_source: 'daily_todo',
          category: at.category || 'Afternoon Work',
          status: 'pending',
          reasoning: 'Afternoon execution block scheduled within afternoon hours.',
          target_label: isUntimed ? '⚡ Action item' : undefined,
          is_untimed: isUntimed
        });
        scheduledTitles.add(at.title.toLowerCase().trim());
      }
    }
  }

  // Interleave another Long-Term Goal in the Afternoon (if queue has items)
  if (ltgQueue.length > 0) {
    const nextLtg = ltgQueue.shift()!;
    if (canFit(nextLtg.dur)) {
      const s = formatTime(currentMinutes);
      currentMinutes += nextLtg.dur;
      const e = formatTime(currentMinutes);

      blocks.push({
        id: `block-${blocks.length + 1}`,
        task_id: null,
        topic_id: nextLtg.selectedTopic?.id || null,
        goal_id: nextLtg.ltg.id,
        title: nextLtg.ltgTitle,
        start_time: s,
        end_time: e,
        duration: nextLtg.dur,
        type: nextLtg.energyType,
        block_source: 'long_term_goal',
        category: nextLtg.ltg.category || 'Learning Path',
        status: 'pending',
        reasoning: `Interleaved milestone study block for "${nextLtg.ltg.title}".`
      });
      scheduledTitles.add(nextLtg.ltg.title.toLowerCase().trim());
      scheduledTitles.add(nextLtg.ltgTitle.toLowerCase().trim());
    }
  }

  // Remaining Afternoon Tasks
  for (const at of sortedAfternoonTasks.slice(1)) {
    if (scheduledTitles.has(at.title.toLowerCase().trim())) continue;
    const isUntimed = at.duration_minutes === 0;
    const dur = isUntimed ? 30 : at.duration_minutes;
    const eveningReserve = eveningTasks.length > 0 ? 45 : 0;
    if (currentMinutes + dur > workEndMin - eveningReserve || !canFit(dur)) break;

    const s = formatTime(currentMinutes);
    currentMinutes += dur;
    const e = formatTime(currentMinutes);

    blocks.push({
      id: `block-${blocks.length + 1}`,
      task_id: at.id,
      title: at.title,
      start_time: s,
      end_time: e,
      duration: dur,
      type: at.energy_level || 'light',
      block_source: 'daily_todo',
      category: at.category || 'Afternoon Work',
      status: 'pending',
      reasoning: 'Afternoon execution block scheduled within afternoon hours.',
      target_label: isUntimed ? '⚡ Action item' : undefined,
      is_untimed: isUntimed
    });
    scheduledTitles.add(at.title.toLowerCase().trim());
  }

  // Floating habits if time permits
  const floatingHabits = activeHabits.filter(h => h.anchor === 'floating');
  for (const fHab of floatingHabits) {
    if (fHab.habit_type === 'check_off' || fHab.habit_type === 'target') continue;
    if (scheduledTitles.has(fHab.title.toLowerCase().trim())) continue;

    const meta = getHabitDisplayMeta(fHab);
    const eveningReserve = eveningTasks.length > 0 ? 45 : 0;
    if (currentMinutes + meta.duration > workEndMin - eveningReserve || !canFit(meta.duration)) break;

    const s = formatTime(currentMinutes);
    currentMinutes += meta.duration;
    const e = formatTime(currentMinutes);

    blocks.push({
      id: `block-${blocks.length + 1}`,
      task_id: null,
      title: fHab.title,
      start_time: s,
      end_time: e,
      duration: meta.duration,
      type: 'light',
      block_source: 'habit',
      category: 'Daily Habit',
      status: 'pending',
      reasoning: 'Midday floating timed habit.',
      target_label: meta.target_label,
      is_untimed: meta.is_untimed
    });
    scheduledTitles.add(fHab.title.toLowerCase().trim());
  }

  // --- EVENING / WORKDAY WRAP-UP PHASE (Before workEndMin) ---
  const sortedEveningTasks = [...eveningTasks].sort((a, b) => {
    const pOrder: Record<string, number> = { HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (pOrder[a.priority || 'MEDIUM'] ?? 2) - (pOrder[b.priority || 'MEDIUM'] ?? 2);
  });

  for (const et of sortedEveningTasks) {
    if (scheduledTitles.has(et.title.toLowerCase().trim())) continue;

    const isUntimed = et.duration_minutes === 0;
    const dur = isUntimed ? 25 : (et.duration_minutes > 0 ? et.duration_minutes : 30);

    if (!canFit(dur)) break; // HARD STOP at workEndMin

    const s = formatTime(currentMinutes);
    currentMinutes += dur;
    const e = formatTime(currentMinutes);

    blocks.push({
      id: `block-${blocks.length + 1}`,
      task_id: et.id,
      title: et.title,
      start_time: s,
      end_time: e,
      duration: dur,
      type: et.energy_level || 'light',
      block_source: 'daily_todo',
      category: et.category || 'Evening Wrap-Up',
      status: 'pending',
      reasoning: 'Evening priority task scheduled in dedicated wrap-up block before workday end.',
      target_label: isUntimed ? '⚡ Action item' : undefined,
      is_untimed: isUntimed
    });
    scheduledTitles.add(et.title.toLowerCase().trim());
  }

  // Optional evening habit (shutdown ritual)
  const eveningTimedHabit = activeHabits.find(h => h.anchor === 'evening' && h.habit_type !== 'check_off' && h.habit_type !== 'target');
  if (eveningTimedHabit && !scheduledTitles.has(eveningTimedHabit.title.toLowerCase().trim())) {
    const meta = getHabitDisplayMeta(eveningTimedHabit);
    if (canFit(meta.duration)) {
      const s = formatTime(currentMinutes);
      currentMinutes += meta.duration;
      const e = formatTime(currentMinutes);

      blocks.push({
        id: `block-${blocks.length + 1}`,
        task_id: null,
        title: eveningTimedHabit.title,
        start_time: s,
        end_time: e,
        duration: meta.duration,
        type: eveningTimedHabit.energy_level || 'light',
        block_source: 'habit',
        category: 'Daily Habit',
        status: 'pending',
        reasoning: 'Evening shutdown & daily review ritual before workday conclusion.',
        target_label: meta.target_label,
        is_untimed: meta.is_untimed
      });
      scheduledTitles.add(eveningTimedHabit.title.toLowerCase().trim());
    }
  }

  // Merge flexible workday blocks with fixed blocks (both daytime anchors and outside-work commitments)
  const allBlocks = [...blocks, ...scheduledFixedBlocks];

  // Sort blocks by start_time so timetable flows strictly chronologically
  allBlocks.sort((a, b) => a.start_time.localeCompare(b.start_time));

  // Sanitize to strictly eliminate consecutive breaks
  const sanitizedBlocks = sanitizeScheduleBreaks(allBlocks);

  // Re-index IDs sequentially
  return sanitizedBlocks.map((b, idx) => ({
    ...b,
    id: `block-${idx + 1}`
  }));
}
