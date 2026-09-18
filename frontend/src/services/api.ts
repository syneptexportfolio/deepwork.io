export interface Task {
  id: string;
  title: string;
  type: 'daily' | 'goal';
  duration_minutes: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  energy_level: 'deep_focus' | 'light';
  status: 'pending' | 'done' | 'skipped' | 'missed';
  scheduled_start: string | null;
  scheduled_end: string | null;
  category: string | null;
  goal_id: string | null;
  column_bucket: 'now' | 'up_next' | 'later';
  task_date?: string | null;
  created_at: string;
}

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

export function getTimeBucket(timeStr?: string | null): 'now' | 'up_next' | 'later' {
  if (!timeStr || !timeStr.includes(':')) return 'now';
  const clean = timeStr.trim().slice(0, 5);
  if (clean >= '17:00') return 'later';     // 5:00 PM onwards -> Evening
  if (clean >= '12:00') return 'up_next';   // 12:00 PM to 4:59 PM -> Afternoon
  return 'now';                             // Before 12:00 PM -> Morning
}

export type HabitType = 'timed' | 'check_off' | 'target';
export type FrequencyType = 'days' | 'interval' | 'weekly_target';

export interface YearlyPointItem {
  monthIndex: number;
  monthStr: string;
  label: string;
  points: number;
  totalTasks?: number;
  activeDays: number;
  daysInMonth: number;
  percentage?: number;
}

export interface Habit {
  id: string;
  title: string;
  duration_minutes: number;
  anchor: 'morning' | 'floating' | 'evening';
  energy_level: 'deep_focus' | 'light';
  streak_count: number;
  active_days: string[];
  is_active: number;
  created_at?: string;
  habit_type?: HabitType;
  target_value?: string;
  target_unit?: string;
  last_completed_date?: string;
  frequency_type?: FrequencyType;
  frequency_value?: number;
  month?: string;
}

export interface WeeklyGoal {
  id: string;
  title: string;
  target_units: number;
  completed_units: number;
  unit_label: string;
  week_start: string;
  week_end: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  energy_level: 'deep_focus' | 'light';
  goal_id: string | null;
  category?: string;
  daysLeft?: number;
  remainingUnits?: number;
  unitsPerDay?: number;
  progressPercent?: number;
  isBehindPace?: boolean;
  created_at?: string;
}

export interface SyllabusTopic {
  id: string;
  name: string;
  status: 'COVERED' | 'DUE TODAY' | 'NEXT UP' | 'HIGH WEIGHT' | 'UNTOUCHED';
  covered: boolean;
  weight: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface Milestone {
  date: string;
  label: string;
  icon: string;
}

export interface Goal {
  id: string;
  title: string;
  category?: string;
  target_date: string;
  syllabus: SyllabusTopic[];
  milestones: Milestone[];
  recommendation: string;
  unit_label: string;
  total_units: number;
  covered_units: number;
  created_at: string;
}

export interface LongTermGoalDailyConfig {
  goal_id: string;
  topic_id?: string;
  task_title: string;
  duration_minutes: number;
  energy_level?: 'deep_focus' | 'light';
}

export type BlockSource = 'habit' | 'weekly_goal' | 'daily_todo' | 'break' | 'long_term_goal';

export interface ScheduleBlock {
  id: string;
  task_id: string | null;
  topic_id?: string | null;
  goal_id?: string | null;
  title: string;
  start_time: string;
  end_time: string;
  duration: number;
  type: 'deep_focus' | 'light' | 'break';
  block_source?: BlockSource;
  category: string;
  status: 'pending' | 'done' | 'skipped' | 'missed';
  reasoning: string;
  target_label?: string;
  is_untimed?: boolean;
}

export function isBreakOrRestBlock(block?: {
  type?: string;
  block_source?: string;
  category?: string | null;
  title?: string;
} | null): boolean {
  if (!block) return false;
  if (block.type === 'break' || block.block_source === 'break') return true;

  const cat = (block.category || '').toLowerCase().trim();
  if (cat === 'rest & hydration' || cat === 'break' || cat === 'lunch' || cat === 'rest') {
    return true;
  }

  const title = (block.title || '').toLowerCase().trim();
  if (
    title.includes('lunch') ||
    title.includes('recharge') ||
    title.includes('coffee break') ||
    title.includes('tea break') ||
    title.includes('step away') ||
    title.includes('power nap') ||
    title === 'break' ||
    title === 'brake' ||
    title === 'rest' ||
    title === 'nap' ||
    title.startsWith('break:') ||
    title.startsWith('rest:')
  ) {
    return true;
  }

  return false;
}

export interface WeekDaySchedule {
  date: string;
  dayName: string;
  dayCode: string;
  isToday: boolean;
  isShaped: boolean;
  blocks: ScheduleBlock[];
  totalFocusMinutes: number;
  focusHours: number;
  completedBlocks: number;
  totalBlocks: number;
}

export interface QuestionnaireAnswers {
  available_hours: number;
  wake_time: string;
  sleep_time: string;
  work_start_time?: string;
  work_end_time?: string;
  lunch_start_time?: string;
  lunch_duration_minutes?: number;
  energy_level: 'deep_focus' | 'light';
  top_priority: string;
  fixed_commitments?: string;
  focus_preference?: string;
  selected_habit_ids?: string[];
  selected_task_ids?: string[];
  selected_weekly_goal_ids?: string[];
  selected_long_term_goal_ids?: string[];
  long_term_goal_configs?: LongTermGoalDailyConfig[];
  morning_todos?: Array<{ title: string; duration_minutes: number }>;
}

export interface StatsResponse {
  protectedFocus: {
    formatted: string;
    difference: string;
    totalMinutes: number;
  };
  promisesKept: {
    formatted: string;
    nextSession: string;
    done: number;
    total: number;
  };
  weeklyRhythm: {
    rate: number;
    diff: string;
  };
  weeklyCapacity: {
    currentHours: number;
    maxHours: number;
    percentage: number;
  };
  weeklyPatternDays: Array<{ day: string; heightPercent: number; hours: number }>;
  patterns: {
    morningPercent: number;
    afternoonPercent: number;
    insight: string;
    heatmap: Array<{ period: string; days: number[] }>;
    trendPoints: Array<{ date: string; value: number }>;
  };
}

const PASSCODE_STORAGE_KEY = 'luma_passcode';

const PRODUCTION_API_URL = 'https://deepwork-backend.syneptexportfolio.workers.dev';

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? PRODUCTION_API_URL
    : '')
).replace(/\/$/, '');

export function getStoredPasscode(): string {
  return localStorage.getItem(PASSCODE_STORAGE_KEY) || '';
}

export function setStoredPasscode(code: string): void {
  localStorage.setItem(PASSCODE_STORAGE_KEY, code);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const passcode = getStoredPasscode();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (passcode) {
    headers.set('X-Passcode', passcode);
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}: Request failed`);
  }

  return data as T;
}

export const api = {
  // Health & Auth
  checkHealth: () => request<{
    status: string;
    hasPasscode: boolean;
    hasGeminiKey: boolean;
    hasTelegramConfig: boolean;
  }>('/api/health'),

  verifyPasscode: (passcode: string) =>
    request<{ success: boolean; required: boolean }>('/api/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ passcode }),
    }),

  // Tasks (Daily To-Dos)
  getTasks: (date?: string, all?: boolean) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (all) params.append('all', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<{ success: boolean; tasks: Task[] }>(`/api/tasks${query}`);
  },

  createTask: (task: Partial<Task>) =>
    request<{ success: boolean; task: Task }>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    }),

  updateTask: (id: string, updates: Partial<Task>) =>
    request<{ success: boolean; task: Task }>(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  deleteTask: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/tasks/${id}`, {
      method: 'DELETE',
    }),

  // Monthly Habits
  getHabits: (month?: string) => {
    const query = month ? `?month=${month}` : '';
    return request<{ success: boolean; habits: Habit[]; month: string }>(`/api/habits${query}`);
  },

  getHabitHeatmap: (month?: string) => {
    const query = month ? `?month=${month}` : '';
    return request<{ success: boolean; month: string; completions: Record<string, number> }>(`/api/habits/heatmap${query}`);
  },

  getMonthlyHabitPoints: (month?: string) => {
    const query = month ? `?month=${month}` : '';
    return request<{
      success: boolean;
      month: string;
      totalHabits: number;
      points: { day: number; date: string; points: number; maxPoints: number; percentage: number }[];
    }>(`/api/habits/monthly-points${query}`);
  },

  getYearlyHabitPoints: (year?: string) => {
    const query = year ? `?year=${year}` : '';
    return request<{
      success: boolean;
      year: string;
      points: YearlyPointItem[];
    }>(`/api/habits/yearly-points${query}`);
  },

  copyPreviousHabits: () =>
    request<{ success: boolean; habits: Habit[]; count: number }>('/api/habits/copy-previous', {
      method: 'POST',
    }),

  createHabit: (habit: Partial<Habit>) =>
    request<{ success: boolean; habit: Habit }>('/api/habits', {
      method: 'POST',
      body: JSON.stringify(habit),
    }),

  updateHabit: (id: string, updates: Partial<Habit>) =>
    request<{ success: boolean; habit: Habit }>(`/api/habits/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  checkHabitStreak: (id: string) =>
    request<{ success: boolean; habit: Habit }>(`/api/habits/${id}/check`, {
      method: 'POST',
    }),

  deleteHabit: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/habits/${id}`, {
      method: 'DELETE',
    }),

  // Weekly Goals
  getWeeklyGoals: (weekStart?: string) => {
    const query = weekStart ? `?week_start=${weekStart}` : '';
    return request<{ success: boolean; weeklyGoals: WeeklyGoal[]; weekStart: string; weekEnd: string }>(`/api/weekly-goals${query}`);
  },

  copyPreviousWeeklyGoals: () =>
    request<{ success: boolean; weeklyGoals: WeeklyGoal[]; count: number }>('/api/weekly-goals/copy-previous', {
      method: 'POST',
    }),

  createWeeklyGoal: (goal: Partial<WeeklyGoal>) =>
    request<{ success: boolean; weeklyGoal: WeeklyGoal }>('/api/weekly-goals', {
      method: 'POST',
      body: JSON.stringify(goal),
    }),

  updateWeeklyGoal: (id: string, updates: Partial<WeeklyGoal>) =>
    request<{ success: boolean; weeklyGoal: WeeklyGoal }>(`/api/weekly-goals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  deleteWeeklyGoal: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/weekly-goals/${id}`, {
      method: 'DELETE',
    }),

  // Long-Term Goals
  getGoals: () => request<{ success: boolean; goals: Goal[] }>('/api/goals'),

  createGoal: (goal: Partial<Goal>) =>
    request<{ success: boolean; goal: Goal }>('/api/goals', {
      method: 'POST',
      body: JSON.stringify(goal),
    }),

  updateGoal: (id: string, updates: Partial<Goal>) =>
    request<{ success: boolean; goal: Goal }>(`/api/goals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  toggleGoalTopic: (goalId: string, topicId: string) =>
    request<{ success: boolean; goal: Goal }>(`/api/goals/${goalId}/toggle-topic`, {
      method: 'POST',
      body: JSON.stringify({ topicId }),
    }),

  deleteGoal: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/goals/${id}`, {
      method: 'DELETE',
    }),

  // Schedule & Questionnaire
  getTodaySchedule: () =>
    request<{ success: boolean; date: string; cached: boolean; schedule: ScheduleBlock[] }>('/api/schedule/today'),

  getScheduleByDate: (date: string) =>
    request<{ success: boolean; date: string; cached: boolean; schedule: ScheduleBlock[] }>(`/api/schedule?date=${encodeURIComponent(date)}`),

  getActiveScheduleDates: () =>
    request<{ success: boolean; dates: string[] }>('/api/schedule/active-dates'),

  getWeeklySchedule: (startDate?: string) =>
    request<{
      success: boolean;
      weekStart: string;
      weekEnd: string;
      totalWeekFocusMinutes: number;
      totalWeekFocusHours: number;
      days: WeekDaySchedule[];
    }>(`/api/schedule/week${startDate ? `?startDate=${encodeURIComponent(startDate)}` : ''}`),

  submitQuestionnaire: (answers: QuestionnaireAnswers) =>
    request<{ success: boolean; id: string; date: string }>('/api/schedule/questionnaire', {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),

  generateSchedule: (answers?: QuestionnaireAnswers, date?: string) =>
    request<{ success: boolean; date: string; cached: boolean; schedule: ScheduleBlock[]; modelUsed?: string }>(
      '/api/schedule/generate',
      {
        method: 'POST',
        body: JSON.stringify({ answers, date }),
      }
    ),

  updateScheduleBlock: (blockId: string, status: 'pending' | 'done', date?: string) =>
    request<{ success: boolean; schedule: ScheduleBlock[] }>(`/api/schedule/block/${blockId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, date }),
    }),

  addCustomScheduleBlock: (date: string, updatedSchedule: ScheduleBlock[], task?: Partial<Task>) =>
    request<{ success: boolean; date: string; schedule: ScheduleBlock[]; task?: Task }>('/api/schedule/custom-block', {
      method: 'POST',
      body: JSON.stringify({ date, updatedSchedule, task }),
    }),

  getMonthlyTaskPoints: (month?: string) => {
    const query = month ? `?month=${month}` : '';
    return request<{
      success: boolean;
      month: string;
      points: { day: number; date: string; points: number; totalTasks: number; percentage: number }[];
    }>(`/api/schedule/monthly-task-points${query}`);
  },

  getYearlyTaskPoints: (year?: string) => {
    const query = year ? `?year=${year}` : '';
    return request<{
      success: boolean;
      year: string;
      points: YearlyPointItem[];
    }>(`/api/schedule/yearly-task-points${query}`);
  },

  // Stats
  getStats: () => request<{ success: boolean; stats: StatsResponse }>('/api/stats'),

  // Telegram Reminders
  testTelegram: (token?: string, chatId?: string) =>
    request<{ success: boolean; message: string }>('/api/reminders/test', {
      method: 'POST',
      body: JSON.stringify({ token, chatId }),
    }),

  triggerReminderCheck: () =>
    request<{ success: boolean; summary: any }>('/api/reminders/trigger-check', {
      method: 'POST',
    }),
};

// Real-time time synchronization utilities
export const normalizeTime = (timeStr?: string): string => {
  if (!timeStr) return '00:00';
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return timeStr;
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
};

export const isTimeWithinBlock = (currentTime: string, startTime?: string, endTime?: string): boolean => {
  if (!startTime || !endTime) return false;
  const curr = normalizeTime(currentTime);
  const start = normalizeTime(startTime);
  const end = normalizeTime(endTime);
  return start <= curr && curr < end;
};
