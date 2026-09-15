import { Goal, Habit, QuestionnaireAnswers, ScheduleBlock, Task, WeeklyGoal } from '../types';

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
      if (b.type !== 'break') {
        if (anchorHabitTitles.has(norm)) continue;
        if (seen.has(norm)) continue;
        seen.add(norm);
      }
      deduplicatedBlocks.push(b);
    }

    return { blocks: deduplicatedBlocks, rawText: jsonText };
  } catch (err: any) {
    console.error('Error invoking Gemini Flash API:', err);
    return { blocks: generateSmartFallbackSchedule(tasks, goals, answers, habits, weeklyGoals) };
  }
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

  return `You are Luma, an elite personal AI timetable and cognitive rhythm architect.
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
  ...selectedTasks.map(t => ({
    id: t.id as string | null,
    title: t.title,
    time_bucket: t.column_bucket === 'now' ? 'Morning' : t.column_bucket === 'up_next' ? 'Afternoon' : 'Evening',
    scheduled_time: t.scheduled_start || null,
    duration_minutes: t.duration_minutes === 0 ? 'untimed / meeting / call' : t.duration_minutes,
    priority: t.priority,
    energy: t.energy_level
  })),
  ...(answers.morning_todos || []).map(td => ({
    id: null as string | null,
    title: td.title,
    time_bucket: 'Morning',
    scheduled_time: null,
    duration_minutes: td.duration_minutes || 20,
    priority: 'MEDIUM' as const,
    energy: 'light' as const
  }))
], null, 2)}

QUESTIONNAIRE RESPONSES:
- Available focus hours today: ${answers.available_hours} hours
- Wake time: ${answers.wake_time}
- Sleep time: ${answers.sleep_time}
- Core Working Hours: ${answers.work_start_time || '09:00'} to ${answers.work_end_time || '18:00'}
- Midday Lunch Break: ${answers.lunch_start_time ? `${answers.lunch_start_time} (${answers.lunch_duration_minutes || 45} mins)` : 'None'}
- Energy level: ${answers.energy_level}
- Top priority for today: "${answers.top_priority}"
- Fixed commitments: "${answers.fixed_commitments || 'None'}"
- Style preference: "${answers.focus_preference || 'Deep work early, lighter review later'}"

SCHEDULING RULES:
1. FIXED ANCHORS: Any task with a scheduled_time (e.g. meetings, calls, appointments) or mentioned in fixed commitments MUST be locked to that exact start time.
2. NO DUPLICATES: Every task, habit, and to-do must appear at most once in the timetable. Never schedule the same item twice.
3. CHRONOLOGICAL TIME-OF-DAY BUCKET CONTRACT (STRICT):
   - MORNING WINDOW (${answers.work_start_time || '09:00'} → ${answers.lunch_start_time || '13:00'}):
     - Reserved STRICTLY for tasks in the 'Morning' bucket, morning quick to-dos, and top priorities.
     - Prime 75-90m morning focus block (e.g. 09:00-10:30) MUST be assigned to the user's top_priority or the highest-priority task from the 'Morning' bucket (e.g. "High-yield concept review").
     - NEVER schedule Afternoon or Evening tasks into the Morning window.
   - MIDDAY LUNCH BREAK (${answers.lunch_start_time || '13:00'} for ${answers.lunch_duration_minutes || 45} mins):
     - Insert a protected "Lunch & recharge" break (block_source="break", category="Rest & Hydration").
   - AFTERNOON WINDOW (Lunch End → ${answers.work_end_time || '18:00'}):
     - Allocate dedicated 60m focus blocks for any selected Long-Term Goal / Roadmap (block_source="long_term_goal", titled "[Goal Title]: [Next Topic]"). Early afternoon (e.g. 14:00) is the ideal slot for curriculum / roadmap advancement.
     - Schedule tasks in the 'Afternoon' bucket (calls, meetings, outreach, action items).
     - NEVER schedule Evening tasks into the afternoon unless all afternoon tasks are complete and time allows.
   - EVENING WINDOW (${answers.work_end_time || '18:00'} → ${answers.sleep_time}):
     - Schedule tasks from the 'Evening' bucket (e.g. "Ship feature component & tests", personal project shipping, evening study).
     - Schedule evening lifestyle habits (e.g. workouts, reading, wind-down).
4. HABIT RULES: 
   - Only schedule habits on the hourly timetable if they are TIMED focus sessions (e.g. "Morning planning", "Meditation", "Workout" where type='timed' and duration > 0).
   - Do NOT insert check-off milestones ("Wake up early") or all-day metric targets ("Drink 3L Water", "Walk 10,000+ Steps") as work blocks on the timetable—those are managed in the dedicated Daily Anchors panel.
5. ZERO OVERLAPS: Ensure no two blocks overlap in time. Each block's start_time must be greater than or equal to the previous block's end_time.
6. UNTIMED TASKS: For untimed tasks (duration 0, meetings, calls, errands), schedule them with "is_untimed": true and "target_label": "⚡ Action item" or "🕒 HH:MM".
7. RECHARGE BREAKS: Insert 10-15 minute "Step away & recharge" breaks between deep work sessions.
8. ASSIGN TASK IDs: For any block created from an existing task in the list, set "task_id" to that task's id; otherwise set null.
9. TIME FORMAT: 24-hour "HH:MM".
10. BLOCK SOURCE: One of: "habit", "long_term_goal", "daily_todo", "break".

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
  const workStartMin = parseTime(answers.work_start_time || '09:30', 9 * 60 + 30);
  const workEndMin = parseTime(answers.work_end_time || '18:30', 18 * 60 + 30);
  const lunchStartMin = answers.lunch_start_time ? parseTime(answers.lunch_start_time, 13 * 60) : 13 * 60;
  const lunchDur = answers.lunch_duration_minutes !== undefined ? answers.lunch_duration_minutes : 45;

  // 1. Filter active/selected items
  const activeHabits = answers.selected_habit_ids && answers.selected_habit_ids.length > 0
    ? habits.filter(h => answers.selected_habit_ids!.includes(h.id))
    : habits.filter(h => h.is_active);

  const morningHabits = activeHabits.filter(h => h.anchor === 'morning');
  const floatingHabits = activeHabits.filter(h => h.anchor === 'floating');
  const eveningHabits = activeHabits.filter(h => h.anchor === 'evening');

  const activeWeeklyGoals = answers.selected_weekly_goal_ids && answers.selected_weekly_goal_ids.length > 0
    ? weeklyGoals.filter(w => answers.selected_weekly_goal_ids!.includes(w.id))
    : weeklyGoals;

  const activeLongTermGoals = answers.selected_long_term_goal_ids && answers.selected_long_term_goal_ids.length > 0
    ? goals.filter(g => answers.selected_long_term_goal_ids!.includes(g.id))
    : (answers.selected_long_term_goal_ids !== undefined ? [] : goals);

  const eligibleTasks = answers.selected_task_ids && answers.selected_task_ids.length > 0
    ? tasks.filter(t => answers.selected_task_ids!.includes(t.id))
    : tasks;

  // Separate tasks into fixed scheduled vs buckets
  const fixedTasks = eligibleTasks.filter(t => t.scheduled_start);
  const unfixedTasks = eligibleTasks.filter(t => !t.scheduled_start);

  const morningTasks = unfixedTasks.filter(t => t.column_bucket === 'now');
  const afternoonTasks = unfixedTasks.filter(t => t.column_bucket === 'up_next');
  const eveningTasks = unfixedTasks.filter(t => t.column_bucket === 'later');

  let currentMinutes = wakeMin;

  // --- MORNING PHASE ---
  // A. Morning Habits (Only schedule TIMED focus habits on timetable; milestones live in Daily Anchors)
  for (const hab of morningHabits) {
    if (hab.habit_type === 'check_off' || hab.habit_type === 'target') continue;

    const meta = getHabitDisplayMeta(hab);
    const s = formatTime(currentMinutes);
    currentMinutes += meta.duration;
    const e = formatTime(currentMinutes);

    blocks.push({
      id: `block-${blocks.length + 1}`,
      task_id: null,
      title: hab.title,
      start_time: s,
      end_time: e,
      duration: meta.duration,
      type: hab.energy_level || 'light',
      block_source: 'habit',
      category: 'Daily Habit',
      status: 'pending',
      reasoning: 'Morning timed session scheduled directly after waking.',
      target_label: meta.target_label,
      is_untimed: meta.is_untimed
    });
    scheduledTitles.add(hab.title.toLowerCase().trim());
  }

  // Transition to Core Work Window: work begins strictly at workStartMin (e.g. 09:00 AM)
  currentMinutes = Math.max(currentMinutes, workStartMin);

  // --- PRIME FOCUS PHASE (STARTS AT workStartMin) ---
  // B. Prime Morning Deep Focus Block (Stated main priority or top morning task)
  const primaryMorningTask = morningTasks.find(t => t.priority === 'HIGH' && !scheduledTitles.has(t.title.toLowerCase().trim()))
    || morningTasks.find(t => !scheduledTitles.has(t.title.toLowerCase().trim()))
    || (morningTasks.length === 0 ? unfixedTasks.find(t => t.priority === 'HIGH' && !scheduledTitles.has(t.title.toLowerCase().trim())) : null);

  const dur1 = answers.energy_level === 'light' ? 60 : 90;
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
    reasoning: 'Prime morning cognitive peak allocated to main priority advancement.'
  });
  scheduledTitles.add(primaryTitle.toLowerCase().trim());
  if (primaryMorningTask) scheduledTitles.add(primaryMorningTask.title.toLowerCase().trim());

  // C. Recharge Break
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
    reasoning: 'Screen-free mental break to consolidate deep work learning.'
  });

  // D. Remaining Morning Tasks (from Morning bucket ONLY, before lunch)
  for (const t of morningTasks) {
    if (scheduledTitles.has(t.title.toLowerCase().trim())) continue;

    const isUntimed = t.duration_minutes === 0;
    const dur = isUntimed ? 25 : t.duration_minutes;
    if (lunchDur > 0 && currentMinutes + dur > lunchStartMin) break;

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
      reasoning: 'Morning priority work task scheduled during focused morning hours.',
      target_label: isUntimed ? '⚡ Action item' : undefined,
      is_untimed: isUntimed
    });
    scheduledTitles.add(t.title.toLowerCase().trim());
  }

  // E. Quick Morning To-Dos Brain Dump (inside morning work hours)
  if (answers.morning_todos && answers.morning_todos.length > 0) {
    for (const td of answers.morning_todos) {
      if (!td.title || scheduledTitles.has(td.title.toLowerCase().trim())) continue;

      const dur = td.duration_minutes || 20;
      if (lunchDur > 0 && currentMinutes + dur > lunchStartMin) break;

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

  // --- MIDDAY / FIXED ANCHORS ---
  // F. Fixed Scheduled Tasks (meetings, appointments with scheduled_start)
  for (const ft of fixedTasks) {
    if (scheduledTitles.has(ft.title.toLowerCase().trim())) continue;

    const fStart = parseTime(ft.scheduled_start || '', currentMinutes);
    const isUntimed = ft.duration_minutes === 0;
    const fDur = isUntimed ? 30 : ft.duration_minutes;
    const fEnd = fStart + fDur;

    blocks.push({
      id: `block-${blocks.length + 1}`,
      task_id: ft.id,
      title: ft.title,
      start_time: formatTime(fStart),
      end_time: formatTime(fEnd),
      duration: fDur,
      type: 'light',
      block_source: 'daily_todo',
      category: ft.category || 'Fixed Commitment',
      status: 'pending',
      reasoning: 'Fixed schedule anchor locked to designated start time.',
      target_label: isUntimed ? `🕒 ${ft.scheduled_start}` : undefined,
      is_untimed: isUntimed
    });
    scheduledTitles.add(ft.title.toLowerCase().trim());
  }

  // --- MIDDAY LUNCH BREAK ---
  if (lunchDur > 0) {
    const lStart = Math.max(currentMinutes, lunchStartMin);
    const lEnd = lStart + lunchDur;
    blocks.push({
      id: `block-${blocks.length + 1}`,
      task_id: null,
      title: 'Lunch & recharge',
      start_time: formatTime(lStart),
      end_time: formatTime(lEnd),
      duration: lunchDur,
      type: 'break',
      block_source: 'break',
      category: 'Rest & Hydration',
      status: 'pending',
      reasoning: 'Protected midday meal and cognitive recovery break.'
    });
    currentMinutes = lEnd;
  } else {
    currentMinutes = Math.max(currentMinutes + 30, 14 * 60);
  }

  // --- AFTERNOON PHASE (Post-Lunch Focus & Afternoon Tasks) ---
  // G0. Long-Term Goal / Roadmap Dedicated Study Block
  for (const ltg of activeLongTermGoals.slice(0, 2)) {
    if (scheduledTitles.has(ltg.title.toLowerCase().trim())) continue;

    const cfg = answers.long_term_goal_configs?.find(c => c.goal_id === ltg.id);
    const selectedTopic = ltg.syllabus?.find((s: any) => s.id === cfg?.topic_id) 
      || ltg.syllabus?.find((s: any) => !s.covered) 
      || ltg.syllabus?.[0];
    const fallbackTitle = selectedTopic ? `${ltg.title}: ${selectedTopic.name}` : `${ltg.title}: Roadmap Milestone`;
    const ltgTitle = cfg?.task_title?.trim() || fallbackTitle;
    const dur = cfg?.duration_minutes && cfg.duration_minutes > 0 ? cfg.duration_minutes : 60;
    const energyType = cfg?.energy_level || 'deep_focus';

    if (currentMinutes + dur <= workEndMin) {
      const s = formatTime(currentMinutes);
      currentMinutes += dur;
      const e = formatTime(currentMinutes);

      blocks.push({
        id: `block-${blocks.length + 1}`,
        task_id: null,
        topic_id: selectedTopic?.id || null,
        goal_id: ltg.id,
        title: ltgTitle,
        start_time: s,
        end_time: e,
        duration: dur,
        type: energyType,
        block_source: 'long_term_goal',
        category: ltg.category || 'Learning Path',
        status: 'pending',
        reasoning: `Dedicated milestone study block for long-term roadmap "${ltg.title}".`
      });
      scheduledTitles.add(ltg.title.toLowerCase().trim());
      scheduledTitles.add(ltgTitle.toLowerCase().trim());
    }
  }

  // G. Floating Habits (Timed focus habits)
  for (const fHab of floatingHabits.slice(0, 2)) {
    if (fHab.habit_type === 'check_off' || fHab.habit_type === 'target') continue;
    if (scheduledTitles.has(fHab.title.toLowerCase().trim())) continue;

    const meta = getHabitDisplayMeta(fHab);
    if (currentMinutes + meta.duration <= workEndMin) {
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
  }

  // H. Afternoon Tasks (from Afternoon bucket: up_next)
  const sortedAfternoonTasks = [...afternoonTasks].sort((a, b) => {
    const pOrder: Record<string, number> = { HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (pOrder[a.priority || 'MEDIUM'] ?? 2) - (pOrder[b.priority || 'MEDIUM'] ?? 2);
  });

  for (const at of sortedAfternoonTasks) {
    if (scheduledTitles.has(at.title.toLowerCase().trim())) continue;

    const isUntimed = at.duration_minutes === 0;
    const dur = isUntimed ? 30 : at.duration_minutes;

    if (currentMinutes + dur > workEndMin) {
      break; // Workday afternoon capacity reached
    }

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

  // --- EVENING PHASE (Evening Tasks & Wind-Down Habits) ---
  // I. Evening Tasks (from Evening bucket: later)
  const sortedEveningTasks = [...eveningTasks].sort((a, b) => {
    const pOrder: Record<string, number> = { HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (pOrder[a.priority || 'MEDIUM'] ?? 2) - (pOrder[b.priority || 'MEDIUM'] ?? 2);
  });

  // Start evening phase at either currentMinutes or workEndMin
  currentMinutes = Math.max(currentMinutes, workEndMin);

  for (const et of sortedEveningTasks) {
    if (scheduledTitles.has(et.title.toLowerCase().trim())) continue;

    const isUntimed = et.duration_minutes === 0;
    const dur = isUntimed ? 30 : (et.duration_minutes > 0 ? et.duration_minutes : 45);

    if (currentMinutes + dur > sleepMin - 30) {
      break; // Reached bedtime threshold
    }

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
      category: et.category || 'Evening Focus',
      status: 'pending',
      reasoning: 'Evening priority task scheduled in dedicated evening block.',
      target_label: isUntimed ? '⚡ Action item' : undefined,
      is_untimed: isUntimed
    });
    scheduledTitles.add(et.title.toLowerCase().trim());
  }

  // J. Evening Habits (Timed fitness/workouts or wind-down)
  for (const evHab of eveningHabits) {
    if (evHab.habit_type === 'check_off' || evHab.habit_type === 'target') continue;
    if (scheduledTitles.has(evHab.title.toLowerCase().trim())) continue;

    const meta = getHabitDisplayMeta(evHab);
    // If it is a longer active habit (e.g. workout >= 30m), place right after work/evening tasks
    // If it is a short wind-down habit, place shortly before sleep
    let evStart = currentMinutes;
    if (meta.duration <= 30 && sleepMin - meta.duration - 15 > currentMinutes) {
      evStart = sleepMin - meta.duration - 15;
    }

    if (evStart + meta.duration <= sleepMin) {
      blocks.push({
        id: `block-${blocks.length + 1}`,
        task_id: null,
        title: evHab.title,
        start_time: formatTime(evStart),
        end_time: formatTime(evStart + meta.duration),
        duration: meta.duration,
        type: evHab.energy_level || 'light',
        block_source: 'habit',
        category: 'Daily Habit',
        status: 'pending',
        reasoning: 'Evening habit or wind-down ritual.',
        target_label: meta.target_label,
        is_untimed: meta.is_untimed
      });
      scheduledTitles.add(evHab.title.toLowerCase().trim());
      currentMinutes = Math.max(currentMinutes, evStart + meta.duration);
    }
  }

  // Sort blocks by start_time so timetable flows chronologically
  blocks.sort((a, b) => a.start_time.localeCompare(b.start_time));

  // Re-index IDs sequentially
  return blocks.map((b, idx) => ({
    ...b,
    id: `block-${idx + 1}`
  }));
}
