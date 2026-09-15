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
  created_at: string;
}

export type HabitType = 'timed' | 'check_off' | 'target';
export type FrequencyType = 'days' | 'interval' | 'weekly_target';

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

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

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
  getTasks: () => request<{ success: boolean; tasks: Task[] }>('/api/tasks'),

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
  getHabits: () => request<{ success: boolean; habits: Habit[] }>('/api/habits'),

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
  getWeeklyGoals: () => request<{ success: boolean; weeklyGoals: WeeklyGoal[] }>('/api/weekly-goals'),

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

  submitQuestionnaire: (answers: QuestionnaireAnswers) =>
    request<{ success: boolean; id: string; date: string }>('/api/schedule/questionnaire', {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),

  generateSchedule: (answers?: QuestionnaireAnswers) =>
    request<{ success: boolean; date: string; cached: boolean; schedule: ScheduleBlock[]; modelUsed?: string }>(
      '/api/schedule/generate',
      {
        method: 'POST',
        body: JSON.stringify({ answers }),
      }
    ),

  updateScheduleBlock: (blockId: string, status: 'pending' | 'done') =>
    request<{ success: boolean; schedule: ScheduleBlock[] }>(`/api/schedule/block/${blockId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

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
