export interface Env {
  DB: D1Database;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  PASSCODE?: string;
  DEFAULT_LEAD_TIME_MINUTES?: string;
  ENVIRONMENT?: string;
  ALLOWED_ORIGIN?: string;
}

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type TaskEnergy = 'deep_focus' | 'light';
export type TaskStatus = 'pending' | 'done' | 'skipped' | 'missed';
export type TaskType = 'daily' | 'goal';
export type ColumnBucket = 'now' | 'up_next' | 'later';

export interface Task {
  id: string;
  title: string;
  type: TaskType;
  duration_minutes: number;
  priority: TaskPriority;
  energy_level: TaskEnergy;
  status: TaskStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  category: string | null;
  goal_id: string | null;
  column_bucket: ColumnBucket;
  task_date?: string | null;
  created_at: string;
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

export type HabitType = 'timed' | 'check_off' | 'target';
export type FrequencyType = 'days' | 'interval' | 'weekly_target';

export interface Habit {
  id: string;
  title: string;
  duration_minutes: number;
  anchor: 'morning' | 'floating' | 'evening';
  energy_level: TaskEnergy;
  streak_count: number;
  active_days: string[]; // e.g. ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  is_active: number;     // 1 = active this month
  created_at: string;
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
  priority: TaskPriority;
  energy_level: TaskEnergy;
  goal_id: string | null;
  category?: string;
  created_at: string;
}

export interface LongTermGoalDailyConfig {
  goal_id: string;
  topic_id?: string;
  task_title: string;
  duration_minutes: number;
  energy_level?: TaskEnergy;
}

export interface QuestionnaireAnswers {
  available_hours: number;
  wake_time: string;
  sleep_time: string;
  work_start_time?: string;
  work_end_time?: string;
  lunch_start_time?: string;
  lunch_duration_minutes?: number;
  energy_level: TaskEnergy;
  top_priority: string;
  fixed_commitments?: string;
  focus_preference?: string;
  selected_habit_ids?: string[]; // which monthly habits are included today
  selected_task_ids?: string[]; // which daily tasks are included today
  selected_weekly_goal_ids?: string[]; // which weekly goals are included today
  selected_long_term_goal_ids?: string[]; // which long term goals/learning paths are included today
  long_term_goal_configs?: LongTermGoalDailyConfig[]; // daily tasks & topics customized for long term goals
  morning_todos?: Array<{ title: string; duration_minutes: number }>; // quick daily to-dos added this morning
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
  block_source: BlockSource;
  category: string;
  status: TaskStatus;
  reasoning: string;
  target_label?: string;
  is_untimed?: boolean;
}

