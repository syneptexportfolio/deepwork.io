import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Sparkles, Clock, Zap, Sun, Moon, Check, Plus, Minus, Trash2, 
  AlertCircle, AlertTriangle, CheckCircle2, Layers, Briefcase, Coffee, Compass,
  BookOpen, Flame
} from 'lucide-react';
import { Habit, QuestionnaireAnswers, Task, WeeklyGoal, Goal, LongTermGoalDailyConfig, extractTimeFromText } from '../../services/api';

export interface GoalDailyConfigState {
  topicId: string;
  taskTitle: string;
  durationMinutes: number;
  energyLevel: 'deep_focus' | 'light';
  customHoursText?: string;
}

export function formatDurationHoursDisplay(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return hours % 1 === 0 ? `${hours} hr${hours > 1 ? 's' : ''}` : `${hours.toFixed(1)} hrs`;
}

export function saveGoalDurationPreference(goalId: string, durationMinutes: number): void {
  try {
    const raw = localStorage.getItem('luma_goal_custom_durations');
    const existing = raw ? JSON.parse(raw) : {};
    existing[goalId] = durationMinutes;
    localStorage.setItem('luma_goal_custom_durations', JSON.stringify(existing));
  } catch {}
}

export interface DomainActionPreset {
  label: string;
  prefix: string;
}

export interface DomainTheme {
  border: string;
  activeBg: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  chipBg: string;
  chipHoverBg: string;
  chipBorder: string;
  chipText: string;
  presets: DomainActionPreset[];
}

export const DOMAIN_CONFIGS: Record<string, DomainTheme> = {
  'Exam / Academic': {
    border: 'border-amber-500/40',
    activeBg: 'bg-[#221a14]',
    badgeBg: 'bg-amber-500/10',
    badgeText: 'text-amber-400',
    badgeBorder: 'border-amber-500/30',
    chipBg: 'bg-[#261d15]',
    chipHoverBg: 'hover:bg-amber-500/25',
    chipBorder: 'border-amber-500/30',
    chipText: 'text-amber-300',
    presets: [
      { label: '📖 Study Concepts', prefix: 'Study & Concept Notes:' },
      { label: '✍️ Practice Questions', prefix: 'Practice 20 Questions on:' },
      { label: '📝 Timed Mock Quiz', prefix: 'Timed Quiz & Error Review:' },
      { label: '🔄 Formula Revision', prefix: 'Formula & Summary Revision:' },
    ]
  },
  'Project / Build': {
    border: 'border-emerald-500/40',
    activeBg: 'bg-[#122219]',
    badgeBg: 'bg-emerald-500/10',
    badgeText: 'text-emerald-400',
    badgeBorder: 'border-emerald-500/30',
    chipBg: 'bg-[#15271e]',
    chipHoverBg: 'hover:bg-emerald-500/25',
    chipBorder: 'border-emerald-500/30',
    chipText: 'text-emerald-300',
    presets: [
      { label: '💻 Build & Code', prefix: 'Build & Implement:' },
      { label: '🐞 Debug & Refactor', prefix: 'Debug & Refactor:' },
      { label: '📐 System Design', prefix: 'Architecture & Spec Design:' },
      { label: '🧪 Test & Deploy', prefix: 'Testing & Deployment:' },
    ]
  },
  'Job / Business': {
    border: 'border-blue-500/40',
    activeBg: 'bg-[#121c2d]',
    badgeBg: 'bg-blue-500/10',
    badgeText: 'text-blue-400',
    badgeBorder: 'border-blue-500/30',
    chipBg: 'bg-[#152136]',
    chipHoverBg: 'hover:bg-blue-500/25',
    chipBorder: 'border-blue-500/30',
    chipText: 'text-blue-300',
    presets: [
      { label: '📊 Ship Deliverable', prefix: 'Execute Deliverable:' },
      { label: '🤝 Client / Outreach', prefix: 'Client Outreach & Calls for:' },
      { label: '📈 Review & Metrics', prefix: 'Performance & KPI Review:' },
      { label: '📝 Strategy & Docs', prefix: 'Draft Strategy & Deck for:' },
    ]
  },
  'Skill / Mastery': {
    border: 'border-purple-500/40',
    activeBg: 'bg-[#1f162c]',
    badgeBg: 'bg-purple-500/10',
    badgeText: 'text-purple-400',
    badgeBorder: 'border-purple-500/30',
    chipBg: 'bg-[#261838]',
    chipHoverBg: 'hover:bg-purple-500/25',
    chipBorder: 'border-purple-500/30',
    chipText: 'text-purple-300',
    presets: [
      { label: '🎯 Practice Drills', prefix: 'Deliberate Practice Drills:' },
      { label: '📚 Learn Technique', prefix: 'Technique & Theory Study:' },
      { label: '🎬 Hands-on Session', prefix: 'Practical Application Session:' },
      { label: '🔍 Critique & Review', prefix: 'Self-Critique & Error Analysis:' },
    ]
  }
};

export const DEFAULT_DOMAIN_THEME: DomainTheme = {
  border: 'border-sky-500/40',
  activeBg: 'bg-[#131d2b]',
  badgeBg: 'bg-sky-500/10',
  badgeText: 'text-sky-400',
  badgeBorder: 'border-sky-500/30',
  chipBg: 'bg-[#162336]',
  chipHoverBg: 'hover:bg-sky-500/25',
  chipBorder: 'border-sky-500/30',
  chipText: 'text-sky-300',
  presets: [
    { label: '⚡ Deep Focus Sprint', prefix: 'Core Focus Session on:' },
    { label: '📋 Execute Milestone', prefix: 'Milestone Execution:' },
    { label: '🔄 Review & Plan', prefix: 'Review & Next Steps for:' },
  ]
};

export function getDomainTheme(category?: string): DomainTheme {
  if (!category) return DEFAULT_DOMAIN_THEME;
  for (const [key, theme] of Object.entries(DOMAIN_CONFIGS)) {
    if (category.toLowerCase().includes(key.split('/')[0].trim().toLowerCase())) {
      return theme;
    }
  }
  return DEFAULT_DOMAIN_THEME;
}

interface ShapeMyDayModalProps {
  isOpen: boolean;
  targetDate?: string;
  habits?: Habit[];
  weeklyGoals?: WeeklyGoal[];
  tasks?: Task[];
  goals?: Goal[];
  onClose: () => void;
  onSubmit: (answers: QuestionnaireAnswers, targetDate?: string) => Promise<void>;
}

export const ShapeMyDayModal: React.FC<ShapeMyDayModalProps> = ({
  isOpen,
  targetDate,
  habits = [],
  weeklyGoals: _weeklyGoals = [],
  tasks = [],
  goals = [],
  onClose,
  onSubmit,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOvercapacityNoticeOpen, setIsOvercapacityNoticeOpen] = useState(false);

  const isPastTarget = useMemo(() => {
    if (!targetDate) return false;
    const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    return targetDate < todayIST;
  }, [targetDate]);

  // Section 1: Rhythm, Working Hours & Energy
  const [wakeTime, setWakeTime] = useState('07:30');
  const [sleepTime, setSleepTime] = useState('23:30');
  const [workStartTime, setWorkStartTime] = useState('09:00');
  const [workEndTime, setWorkEndTime] = useState('17:00');
  const [hasLunchBreak, setHasLunchBreak] = useState(true);
  const [lunchStartWindow, setLunchStartWindow] = useState('12:30');
  const [lunchEndWindow, setLunchEndWindow] = useState('14:00');
  const [lunchDuration, setLunchDuration] = useState(45);
  const [selectedLunchPreset, setSelectedLunchPreset] = useState<string>('standard');
  const [selectedPreset, setSelectedPreset] = useState<string>('9-5');
  const [energy, setEnergy] = useState<'deep_focus' | 'light'>('deep_focus');
  const [preference, setPreference] = useState('Continuous focused flow across the workday');

  // Section 3: Selections
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectedHabitIds, setSelectedHabitIds] = useState<string[]>([]);
  const [selectedLongTermGoalIds, setSelectedLongTermGoalIds] = useState<string[]>([]);
  const [goalConfigs, setGoalConfigs] = useState<Record<string, GoalDailyConfigState>>({});
  const [morningTodos, setMorningTodos] = useState<Array<{ title: string; duration_minutes: number }>>([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [newTodoDuration, setNewTodoDuration] = useState(25);

  // Tab state for Section 3
  const [activeTab, setActiveTab] = useState<'tasks' | 'habits' | 'long_term_goals' | 'todos'>('tasks');

  // Auto-detect fixed commitments (tasks with scheduled_start or time in title)
  const detectedAnchors = useMemo(() => {
    return tasks.filter(t => (t.scheduled_start || extractTimeFromText(t.title)) && t.status === 'pending');
  }, [tasks]);

  // Initial setup when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);

      // 1. Initial selection: all pending tasks
      const pendingTasks = tasks.filter(t => t.status === 'pending');
      setSelectedTaskIds(pendingTasks.map(t => t.id));

      // 2. Active habits
      setSelectedHabitIds(habits.filter(h => h.is_active).map(h => h.id));

      // 3. Active long-term goals / learning paths
      setSelectedLongTermGoalIds(goals.map(g => g.id));
      const initialConfigs: Record<string, GoalDailyConfigState> = {};
      let savedGoalDurations: Record<string, number> = {};
      try {
        const raw = localStorage.getItem('luma_goal_custom_durations');
        if (raw) savedGoalDurations = JSON.parse(raw);
      } catch {}

      for (const g of goals) {
        const nextTopic = g.syllabus?.find((s: any) => !s.covered) || g.syllabus?.[0];
        const dur = savedGoalDurations[g.id] && savedGoalDurations[g.id] > 0 ? savedGoalDurations[g.id] : 60;
        initialConfigs[g.id] = {
          topicId: nextTopic?.id || '',
          taskTitle: nextTopic ? `${g.title}: ${nextTopic.name}` : `${g.title}: Roadmap Milestone`,
          durationMinutes: dur,
          energyLevel: 'deep_focus',
          customHoursText: (dur / 60).toString(),
        };
      }
      setGoalConfigs(prev => ({ ...initialConfigs, ...prev }));

      // 4. Load saved work hours preference if available
      try {
        const saved = localStorage.getItem('luma_default_work_hours');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.workStartTime) setWorkStartTime(parsed.workStartTime);
          if (parsed.workEndTime) setWorkEndTime(parsed.workEndTime);
          if (parsed.hasLunchBreak !== undefined) setHasLunchBreak(parsed.hasLunchBreak);
          if (parsed.lunchStartWindow) setLunchStartWindow(parsed.lunchStartWindow);
          else if (parsed.lunchStartTime) setLunchStartWindow(parsed.lunchStartTime);
          if (parsed.lunchEndWindow) setLunchEndWindow(parsed.lunchEndWindow);
          if (parsed.lunchDuration) setLunchDuration(parsed.lunchDuration);
          if (parsed.selectedPreset) setSelectedPreset(parsed.selectedPreset);
          if (parsed.selectedLunchPreset) setSelectedLunchPreset(parsed.selectedLunchPreset);
        }
      } catch {}
    }
  }, [isOpen]);

  // Working window minutes calculation
  const workWindowMinutes = useMemo(() => {
    try {
      const [sH, sM] = workStartTime.split(':').map(Number);
      const [eH, eM] = workEndTime.split(':').map(Number);
      let diff = (eH * 60 + eM) - (sH * 60 + sM);
      if (diff < 0) diff += 24 * 60;
      return diff;
    } catch {
      return 9 * 60;
    }
  }, [workStartTime, workEndTime]);

  // Net available focus capacity (Work window minus protected lunch)
  const netFocusMinutes = useMemo(() => {
    const lunch = hasLunchBreak ? lunchDuration : 0;
    return Math.max(60, workWindowMinutes - lunch);
  }, [workWindowMinutes, hasLunchBreak, lunchDuration]);

  const availableHours = useMemo(() => {
    return Math.max(1, Math.round((netFocusMinutes / 60) * 10) / 10);
  }, [netFocusMinutes]);

  const availableHoursFormatted = useMemo(() => {
    const h = Math.floor(netFocusMinutes / 60);
    const m = netFocusMinutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }, [netFocusMinutes]);

  // Toggle helpers
  const toggleTask = (id: string) => {
    setSelectedTaskIds(prev => prev.includes(id) ? prev.filter(tId => tId !== id) : [...prev, id]);
  };

  const toggleAllTasks = (select: boolean) => {
    const pending = tasks.filter(t => t.status === 'pending');
    setSelectedTaskIds(select ? pending.map(t => t.id) : []);
  };

  const toggleHabit = (id: string) => {
    setSelectedHabitIds(prev => prev.includes(id) ? prev.filter(hId => hId !== id) : [...prev, id]);
  };

  const toggleAllHabits = (select: boolean) => {
    setSelectedHabitIds(select ? habits.filter(h => h.is_active).map(h => h.id) : []);
  };

  const toggleLongTermGoal = (id: string) => {
    setSelectedLongTermGoalIds(prev => prev.includes(id) ? prev.filter(gId => gId !== id) : [...prev, id]);
  };

  const toggleAllLongTermGoals = (select: boolean) => {
    setSelectedLongTermGoalIds(select ? goals.map(g => g.id) : []);
  };

  const handleAddQuickTodo = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTodoText.trim()) return;
    setMorningTodos(prev => [...prev, { title: newTodoText.trim(), duration_minutes: newTodoDuration }]);
    setNewTodoText('');
  };

  const handleRemoveTodo = (index: number) => {
    setMorningTodos(prev => prev.filter((_, i) => i !== index));
  };

  // Pending tasks for today
  const pendingTasks = useMemo(() => tasks.filter(t => t.status === 'pending'), [tasks]);

  // Workload vs Available Hours Calculation (Hooks must run unconditionally on every render)
  const totalPlannedMinutes = useMemo(() => {
    let mins = 0;
    const [sH, sM] = workStartTime.split(':').map(Number);
    const [eH, eM] = workEndTime.split(':').map(Number);
    const sMins = (sH || 0) * 60 + (sM || 0);
    const eMins = (eH || 0) * 60 + (eM || 0);

    // Selected tasks
    const selTasks = tasks.filter(t => selectedTaskIds.includes(t.id));
    for (const t of selTasks) {
      const timeStr = t.scheduled_start || extractTimeFromText(t.title);
      if (timeStr && timeStr.includes(':')) {
        const [tH, tM] = timeStr.split(':').map(Number);
        const tMins = (tH || 0) * 60 + (tM || 0);
        // If explicitly scheduled outside the daytime work window, do not count against daytime capacity
        if (tMins < sMins || tMins >= eMins) {
          continue;
        }
      }
      mins += t.duration_minutes > 0 ? t.duration_minutes : 20; // estimate 20m for untimed action items
    }
    // Selected habits (timed habits only)
    const selHabits = habits.filter(h => selectedHabitIds.includes(h.id));
    for (const h of selHabits) {
      if (h.habit_type === 'check_off' || h.habit_type === 'target') continue;
      mins += h.duration_minutes > 0 ? h.duration_minutes : 15;
    }
    // Selected long-term goals (uses custom duration per goal)
    for (const gId of selectedLongTermGoalIds) {
      const cfg = goalConfigs[gId];
      mins += cfg?.durationMinutes || 60;
    }
    // Morning quick to-dos
    for (const td of morningTodos) {
      mins += td.duration_minutes || 20;
    }
    return mins;
  }, [tasks, selectedTaskIds, habits, selectedHabitIds, selectedLongTermGoalIds, goalConfigs, morningTodos, workStartTime, workEndTime]);

  const plannedHours = (totalPlannedMinutes / 60).toFixed(1);
  const capacityPercent = Math.min(Math.round((totalPlannedMinutes / netFocusMinutes) * 100), 160);

  // Recommended work end time when overcapacity
  const recommendedWorkEndTime = useMemo(() => {
    try {
      const [sH, sM] = workStartTime.split(':').map(Number);
      const sMins = (sH || 0) * 60 + (sM || 0);
      const lunchMins = hasLunchBreak ? lunchDuration : 0;
      const totalNeeded = sMins + totalPlannedMinutes + lunchMins;
      // Round up to nearest 15 minutes
      const roundedMins = Math.ceil(totalNeeded / 15) * 15;
      const cappedMins = Math.min(23 * 60 + 45, roundedMins);
      const endH = Math.floor(cappedMins / 60);
      const endM = cappedMins % 60;
      return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    } catch {
      return '19:00';
    }
  }, [workStartTime, totalPlannedMinutes, hasLunchBreak, lunchDuration]);

  const handleAutoExtendWorkHours = () => {
    setWorkEndTime(recommendedWorkEndTime);
    setSelectedPreset('custom');
    setIsOvercapacityNoticeOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPastTarget) {
      setErrorMessage('Past days cannot be shaped. Please select today or an upcoming day.');
      return;
    }
    if (totalPlannedMinutes > netFocusMinutes) {
      setIsOvercapacityNoticeOpen(true);
      return;
    }
    setErrorMessage(null);
    setLoading(true);
    try {
      // Save work hours preference
      localStorage.setItem('luma_default_work_hours', JSON.stringify({
        workStartTime,
        workEndTime,
        hasLunchBreak,
        lunchStartWindow,
        lunchEndWindow,
        lunchDuration,
        selectedPreset,
        selectedLunchPreset,
      }));

      const longTermConfigsPayload: LongTermGoalDailyConfig[] = selectedLongTermGoalIds.map(id => {
        const g = goals.find(goal => goal.id === id);
        const cfg = goalConfigs[id];
        const nextTopic = g?.syllabus?.find((s: any) => !s.covered) || g?.syllabus?.[0];
        return {
          goal_id: id,
          topic_id: cfg?.topicId || nextTopic?.id,
          task_title: cfg?.taskTitle?.trim() || (g && nextTopic ? `${g.title}: ${nextTopic.name}` : `${g?.title || 'Goal'}: Daily Milestone`),
          duration_minutes: cfg?.durationMinutes || 60,
          energy_level: cfg?.energyLevel || 'deep_focus'
        };
      });

      await onSubmit({
        available_hours: availableHours,
        wake_time: wakeTime,
        sleep_time: sleepTime,
        work_start_time: workStartTime,
        work_end_time: workEndTime,
        lunch_start_time: hasLunchBreak ? lunchStartWindow : undefined,
        lunch_start_window: hasLunchBreak ? lunchStartWindow : undefined,
        lunch_end_window: hasLunchBreak ? lunchEndWindow : undefined,
        lunch_duration_minutes: hasLunchBreak ? lunchDuration : 0,
        energy_level: energy,
        top_priority: undefined,
        fixed_commitments: undefined,
        focus_preference: preference.trim() || undefined,
        selected_task_ids: selectedTaskIds,
        selected_habit_ids: selectedHabitIds,
        selected_weekly_goal_ids: [],
        selected_long_term_goal_ids: selectedLongTermGoalIds,
        long_term_goal_configs: longTermConfigsPayload,
        morning_todos: morningTodos,
      }, targetDate);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to synthesize timetable. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Unconditional render guard placed AFTER all hooks
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full sm:max-w-2xl max-h-[94vh] sm:max-h-[92vh] bg-luma-card border-t sm:border border-luma-card-border rounded-t-3xl sm:rounded-3xl shadow-2xl relative flex flex-col overflow-hidden">
        
        {/* 1. FIXED HEADER */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-white/[0.06] flex items-start justify-between shrink-0 bg-[#161716]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#2a3015] border border-luma-lime/30 flex items-center justify-center shrink-0 shadow-lime-glow">
              <Sparkles className="w-4 h-4 text-luma-lime" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-serif font-bold text-white tracking-tight flex items-center gap-2 flex-wrap">
                <span>
                  {targetDate ? (() => {
                    const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
                    if (targetDate === todayIST) return 'Shape My Day';
                    const d = new Date(targetDate + 'T00:00:00');
                    return `Shape ${d.toLocaleDateString('en-US', { weekday: 'long' })}`;
                  })() : 'Shape My Day'}
                </span>
                <span className="text-[11px] font-sans font-normal px-2 py-0.5 rounded-full bg-luma-lime/10 text-luma-lime border border-luma-lime/20">
                  AI Rhythm Architect
                </span>
              </h2>
              <p className="text-xs text-luma-text-muted mt-0.5">
                {targetDate ? (() => {
                  const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
                  if (targetDate === todayIST) return "Merge today's tasks, monthly habits, and weekly goals into a conflict-free, sustainable schedule.";
                  const d = new Date(targetDate + 'T00:00:00');
                  const dayName = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
                  return `Design a customized timetable for ${dayName}.`;
                })() : "Merge today's tasks, monthly habits, and weekly goals into a conflict-free, sustainable schedule."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/5 text-luma-text-muted hover:text-white transition-colors shrink-0 -mr-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ERROR NOTIFICATION BANNER */}
        {isPastTarget && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="flex-1">This day has already passed. Past days are archived and cannot be shaped.</span>
          </div>
        )}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="flex-1">{errorMessage}</span>
            <button 
              type="button" 
              onClick={() => setErrorMessage(null)} 
              className="text-red-400 hover:text-red-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 2. SCROLLABLE FORM BODY */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="px-6 py-4 overflow-y-auto space-y-6 flex-1 custom-scrollbar">

            {/* SECTION 1: DAILY WINDOW & ENERGY PROFILE */}
            <div id="working-hours-section" className="p-4 rounded-2xl bg-[#1b1d1b] border border-luma-card-border space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-2.5">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-luma-lime" />
                  <span className="text-xs font-mono uppercase tracking-wider text-white font-semibold">
                    1. Daily Rhythm & Energy
                  </span>
                </div>
                <span className="text-[11px] font-mono text-luma-text-muted">
                  Awake window: {wakeTime} → {sleepTime}
                </span>
              </div>

              {/* Wake / Sleep Time Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-luma-text-dim mb-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    Wake Time
                  </label>
                  <input
                    type="time"
                    value={wakeTime}
                    onChange={(e) => setWakeTime(e.target.value)}
                    className="w-full bg-[#141514] border border-luma-card-border rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-luma-lime"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-luma-text-dim mb-1.5">
                    <Moon className="w-3.5 h-3.5 text-luma-purple" />
                    Sleep Time
                  </label>
                  <input
                    type="time"
                    value={sleepTime}
                    onChange={(e) => setSleepTime(e.target.value)}
                    className="w-full bg-[#141514] border border-luma-card-border rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-luma-lime"
                  />
                </div>
              </div>

              {/* Working Hours Presets & Window */}
              <div className="pt-2 border-t border-white/[0.04] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-luma-lime font-semibold">
                    <Briefcase className="w-3.5 h-3.5 text-luma-lime" />
                    Core Working Hours Window
                  </label>
                  <span className="text-[10px] font-mono text-luma-text-dim">
                    Tasks schedule strictly inside this window
                  </span>
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: '9-5', label: '9:00 - 17:00', name: 'Standard', start: '09:00', end: '17:00', lunchStart: '12:30', lunchEnd: '14:00' },
                    { id: 'full_day', label: '9:30 - 18:30', name: 'Full Day', start: '09:30', end: '18:30', lunchStart: '13:00', lunchEnd: '14:30' },
                    { id: 'early', label: '8:00 - 16:00', name: 'Early Bird', start: '08:00', end: '16:00', lunchStart: '12:00', lunchEnd: '13:30' },
                    { id: 'late', label: '11:00 - 20:00', name: 'Flexible', start: '11:00', end: '20:00', lunchStart: '14:00', lunchEnd: '15:30' },
                  ].map((p) => {
                    const isSelected = selectedPreset === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPreset(p.id);
                          setWorkStartTime(p.start);
                          setWorkEndTime(p.end);
                          setLunchStartWindow(p.lunchStart);
                          setLunchEndWindow(p.lunchEnd);
                        }}
                        className={`px-3 py-2 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-[#252818] border-luma-lime text-white shadow-sm'
                            : 'bg-[#141514] border-luma-card-border text-luma-text-muted hover:border-white/20'
                        }`}
                      >
                        <div className="text-[11px] font-semibold text-white truncate">{p.name}</div>
                        <div className="text-[10px] font-mono text-luma-lime">{p.label}</div>
                      </button>
                    );
                  })}
                </div>

                {/* Exact Work Start / End Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-luma-text-dim block mb-1">
                      Work Starts (Morning)
                    </label>
                    <input
                      type="time"
                      value={workStartTime}
                      onChange={(e) => {
                        setWorkStartTime(e.target.value);
                        setSelectedPreset('custom');
                      }}
                      className="w-full bg-[#141514] border border-luma-card-border rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-luma-lime"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-luma-text-dim block mb-1">
                      Work Concludes (Evening)
                    </label>
                    <input
                      type="time"
                      value={workEndTime}
                      onChange={(e) => {
                        setWorkEndTime(e.target.value);
                        setSelectedPreset('custom');
                      }}
                      className="w-full bg-[#141514] border border-luma-card-border rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-luma-lime"
                    />
                  </div>
                </div>

                {/* Midday Lunch / Protected Dynamic Lunch Window */}
                <div className="p-3.5 rounded-xl bg-[#141514] border border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                      <input
                        type="checkbox"
                        checked={hasLunchBreak}
                        onChange={(e) => setHasLunchBreak(e.target.checked)}
                        className="rounded border-luma-card-border accent-luma-lime w-3.5 h-3.5"
                      />
                      <Coffee className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-semibold text-xs text-white">Protected Lunch Window (Dynamic Placement)</span>
                    </label>
                    {hasLunchBreak && (
                      <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-md border border-amber-400/20 font-medium">
                        {lunchDuration}m break • {lunchStartWindow} → {lunchEndWindow}
                      </span>
                    )}
                  </div>

                  {hasLunchBreak && (
                    <div className="space-y-2.5 pt-1">
                      {/* Window Presets */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {[
                          { id: 'standard', label: '12:30 - 14:00', name: 'Standard', start: '12:30', end: '14:00' },
                          { id: 'early', label: '12:00 - 13:30', name: 'Early', start: '12:00', end: '13:30' },
                          { id: 'late', label: '13:00 - 14:30', name: 'Late', start: '13:00', end: '14:30' },
                          { id: 'custom', label: 'Custom Range', name: 'Custom', start: lunchStartWindow, end: lunchEndWindow },
                        ].map((lp) => {
                          const isSel = selectedLunchPreset === lp.id;
                          return (
                            <button
                              key={lp.id}
                              type="button"
                              onClick={() => {
                                setSelectedLunchPreset(lp.id);
                                if (lp.id !== 'custom') {
                                  setLunchStartWindow(lp.start);
                                  setLunchEndWindow(lp.end);
                                }
                              }}
                              className={`px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                                isSel
                                  ? 'bg-[#292218] border-amber-500/50 text-white'
                                  : 'bg-[#181a18] border-white/[0.04] text-luma-text-muted hover:border-white/20'
                              }`}
                            >
                              <div className="text-[10px] font-medium text-white">{lp.name}</div>
                              <div className="text-[9px] font-mono text-amber-400/90">{lp.label}</div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Window Time Pickers & Duration */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                        <div>
                          <span className="text-[10px] font-mono text-luma-text-dim block mb-1">
                            Earliest Start
                          </span>
                          <input
                            type="time"
                            value={lunchStartWindow}
                            onChange={(e) => {
                              setLunchStartWindow(e.target.value);
                              setSelectedLunchPreset('custom');
                            }}
                            className="w-full bg-[#1b1d1b] border border-luma-card-border rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-luma-lime"
                          />
                        </div>

                        <div>
                          <span className="text-[10px] font-mono text-luma-text-dim block mb-1">
                            Latest Finish
                          </span>
                          <input
                            type="time"
                            value={lunchEndWindow}
                            onChange={(e) => {
                              setLunchEndWindow(e.target.value);
                              setSelectedLunchPreset('custom');
                            }}
                            className="w-full bg-[#1b1d1b] border border-luma-card-border rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-luma-lime"
                          />
                        </div>

                        <div>
                          <span className="text-[10px] font-mono text-luma-text-dim block mb-1">
                            Break Duration
                          </span>
                          <select
                            value={lunchDuration}
                            onChange={(e) => setLunchDuration(Number(e.target.value))}
                            className="w-full bg-[#1b1d1b] border border-luma-card-border rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-luma-lime"
                          >
                            <option value={30}>30 minutes</option>
                            <option value={45}>45 minutes</option>
                            <option value={60}>60 minutes (1 hr)</option>
                          </select>
                        </div>
                      </div>

                      <p className="text-[10px] text-luma-text-dim/80 italic">
                        💡 Lunch slides dynamically within this window to align with natural task completion.
                      </p>
                    </div>
                  )}
                </div>

                {/* Live Work Window Pill */}
                <div className="flex items-center justify-between text-[11px] font-mono px-3.5 py-2.5 rounded-xl bg-[#212421] text-luma-text-dim border border-white/[0.06]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-luma-lime shadow-[0_0_8px_#d4f938]"></span>
                    <span className="text-white font-medium">Work Window: {workStartTime} → {workEndTime}</span>
                  </div>
                  <span className="text-luma-lime font-semibold">
                    {availableHoursFormatted} focus capacity {hasLunchBreak && `(excl. ${lunchDuration}m lunch)`}
                  </span>
                </div>
              </div>

              {/* Energy Level Toggle */}
              <div className="pt-1">
                <label className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-luma-text-dim mb-2">
                  <Zap className="w-3.5 h-3.5 text-luma-lime" />
                  Cognitive Energy Profile
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEnergy('deep_focus')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      energy === 'deep_focus'
                        ? 'bg-[#201d36] border-luma-purple text-white shadow-purple-glow'
                        : 'bg-[#141514] border-luma-card-border text-luma-text-muted hover:text-white'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center justify-between mb-0.5">
                      <span>High / Deep Focus</span>
                      {energy === 'deep_focus' && <CheckCircle2 className="w-3.5 h-3.5 text-luma-purple" />}
                    </div>
                    <div className="text-[10px] text-luma-text-muted">
                      Prime 75-90m morning focus blocks for key goals
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEnergy('light')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      energy === 'light'
                        ? 'bg-[#291e17] border-[#d9822b] text-white shadow-md'
                        : 'bg-[#141514] border-luma-card-border text-luma-text-muted hover:text-white'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center justify-between mb-0.5">
                      <span>Moderate / Light Flow</span>
                      {energy === 'light' && <CheckCircle2 className="w-3.5 h-3.5 text-[#d9822b]" />}
                    </div>
                    <div className="text-[10px] text-luma-text-muted">
                      Gentle 40-50m intervals with review & quick wins
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* AUTO-LOCKED ANCHORS PREVIEW & RHYTHM PREFERENCE */}
            <div className="p-4 rounded-2xl bg-[#1b1d1b] border border-luma-card-border space-y-3.5">
              {/* Detected Anchors if available */}
              {detectedAnchors.length > 0 && (
                <div className="p-3 rounded-xl bg-[#21231a] border border-amber-500/25 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      Auto-Locked Time Anchors ({detectedAnchors.length})
                    </span>
                    <span className="text-[10px] text-amber-300/80 font-mono">
                      Pinned strictly to designated hours
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {detectedAnchors.map(a => (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2b2d20] border border-amber-500/30 text-amber-200 text-[11px] font-mono shadow-sm"
                      >
                        <span className="font-bold text-amber-400">{a.scheduled_start || extractTimeFromText(a.title)}</span>
                        <span className="text-white/90 font-sans truncate max-w-[180px]">{a.title}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Rhythm Preference with Quick Presets */}
              <div>
                <label className="text-[11px] font-mono uppercase tracking-wider text-luma-text-dim block mb-1.5">
                  Cognitive Rhythm Flow Preference
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    'Continuous focused flow across the workday',
                    'Alternating learning goals with daily to-dos',
                    'High priority tasks first, lighter tasks later'
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPreference(preset)}
                      className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                        preference === preset
                          ? 'bg-[#252238] border-luma-purple text-white font-medium'
                          : 'bg-[#141514] border-white/[0.06] text-luma-text-dim hover:text-white'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={preference}
                  onChange={(e) => setPreference(e.target.value)}
                  placeholder="Custom scheduling style preference..."
                  className="w-full bg-[#141514] border border-luma-card-border rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-luma-text-dim/50 focus:outline-none focus:border-luma-lime font-mono"
                />
              </div>
            </div>

            {/* SECTION 2: ITEMS TO MERGE TODAY */}
            <div id="items-to-merge-section" className="p-4 rounded-2xl bg-[#1b1d1b] border border-luma-card-border space-y-3.5">
              
              {/* Header + Segmented Tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.04] pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-luma-lime" />
                  <span className="text-xs font-mono uppercase tracking-wider text-white font-semibold">
                    2. Items to Merge Today
                  </span>
                </div>

                {/* Sub-Tabs Switcher */}
                <div className="flex items-center bg-[#141514] p-1 rounded-xl border border-white/[0.06] text-xs font-mono flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('tasks')}
                    className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                      activeTab === 'tasks'
                        ? 'bg-luma-card-border text-white font-semibold shadow-sm'
                        : 'text-luma-text-dim hover:text-white'
                    }`}
                  >
                    <span>Tasks</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10">
                      {selectedTaskIds.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('habits')}
                    className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                      activeTab === 'habits'
                        ? 'bg-luma-card-border text-white font-semibold shadow-sm'
                        : 'text-luma-text-dim hover:text-white'
                    }`}
                  >
                    <span>Habits</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10">
                      {selectedHabitIds.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('long_term_goals')}
                    className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                      activeTab === 'long_term_goals'
                        ? 'bg-luma-card-border text-white font-semibold shadow-sm'
                        : 'text-luma-text-dim hover:text-white'
                    }`}
                  >
                    <Compass className="w-3 h-3 text-[#60a5fa]" />
                    <span>Long-Term</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#3b82f6]/20 text-[#60a5fa]">
                      {selectedLongTermGoalIds.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('todos')}
                    className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                      activeTab === 'todos'
                        ? 'bg-luma-card-border text-white font-semibold shadow-sm'
                        : 'text-luma-text-dim hover:text-white'
                    }`}
                  >
                    <span>Quick To-Dos</span>
                    {morningTodos.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-luma-lime/20 text-luma-lime">
                        {morningTodos.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* TAB CONTENT: TASKS */}
              {activeTab === 'tasks' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-luma-text-dim">
                    <span>Select which pending tasks to schedule today:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleAllTasks(true)}
                        className="text-luma-lime hover:underline font-mono"
                      >
                        Select All
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => toggleAllTasks(false)}
                        className="hover:text-white font-mono"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {tasks.filter(t => t.status === 'pending').length === 0 ? (
                    <div className="p-6 text-center text-xs text-luma-text-dim bg-[#141514] rounded-xl border border-white/[0.04]">
                      No pending tasks found. Add tasks on the Tasks board or use Quick Brain-Dump!
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                      {pendingTasks.map(t => {
                        const isChecked = selectedTaskIds.includes(t.id);
                        return (
                          <div
                            key={t.id}
                            onClick={() => toggleTask(t.id)}
                            className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all text-xs ${
                              isChecked
                                ? 'bg-[#1f211c] border-luma-lime/40 text-white'
                                : 'bg-[#141514] border-white/[0.04] text-luma-text-dim opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                                isChecked ? 'bg-luma-lime border-luma-lime text-black' : 'border-luma-text-dim'
                              }`}>
                                {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <span className="truncate font-medium">{t.title}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 font-mono text-[10px]">
                              {(t.scheduled_start || extractTimeFromText(t.title)) && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-500/20">
                                  🕒 {t.scheduled_start || extractTimeFromText(t.title)}
                                </span>
                              )}
                              <span className="text-luma-text-dim">
                                {t.duration_minutes > 0 ? `${t.duration_minutes}m` : '⚡ Untimed'}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                                t.priority === 'HIGH' ? 'bg-red-500/20 text-red-300' :
                                t.priority === 'LOW' ? 'bg-blue-500/20 text-blue-300' :
                                'bg-white/5 text-luma-text-dim'
                              }`}>
                                {t.priority}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB CONTENT: HABITS */}
              {activeTab === 'habits' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-luma-text-dim">
                    <span>Monthly repeating daily anchor habits:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleAllHabits(true)}
                        className="text-luma-purple hover:underline font-mono"
                      >
                        Select All
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => toggleAllHabits(false)}
                        className="hover:text-white font-mono"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {habits.length === 0 ? (
                    <div className="p-6 text-center text-xs text-luma-text-dim bg-[#141514] rounded-xl border border-white/[0.04]">
                      No active monthly habits. Add habits in the Habits section!
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                      {habits.map((h) => {
                        const isChecked = selectedHabitIds.includes(h.id);
                        return (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => toggleHabit(h.id)}
                            className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs text-left transition-all ${
                              isChecked
                                ? 'bg-[#252238] border-luma-purple text-white'
                                : 'bg-[#141514] border-luma-card-border text-luma-text-dim opacity-60'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                              isChecked ? 'bg-luma-purple border-luma-purple' : 'border-luma-text-dim'
                            }`}>
                              {isChecked && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="truncate font-medium">{h.title}</span>
                              <div className="flex items-center gap-1.5 text-[10px] font-mono text-luma-text-dim mt-0.5">
                                <span className="capitalize">{h.anchor}</span>
                                <span>•</span>
                                <span>
                                  {h.habit_type === 'check_off' ? (
                                    h.target_value ? `⚡ ${h.target_value}` : '⚡ Ritual'
                                  ) : h.habit_type === 'target' ? (
                                    `🎯 ${h.target_value} ${h.target_unit || ''}`
                                  ) : (
                                    `⏱️ ${h.duration_minutes}m`
                                  )}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB CONTENT: LONG-TERM GOALS & LEARNING ROADMAPS */}
              {activeTab === 'long_term_goals' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] text-luma-text-dim">
                    <span>Long-term learning roadmaps & career masteries to advance:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleAllLongTermGoals(true)}
                        className="text-[#60a5fa] hover:underline font-mono"
                      >
                        Select All
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => toggleAllLongTermGoals(false)}
                        className="hover:text-white font-mono"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {goals.length === 0 ? (
                    <div className="p-6 text-center text-xs text-luma-text-dim bg-[#141514] rounded-xl border border-white/[0.04]">
                      No long-term learning roadmaps found. Create one in the Learning Paths tab!
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                      {goals.map((goal) => {
                        const isChecked = selectedLongTermGoalIds.includes(goal.id);
                        const nextPendingTopic = goal.syllabus?.find((s: any) => !s.covered)?.name || 'Curriculum Progress';
                        const totalTopics = goal.syllabus?.length || goal.total_units || 0;
                        const coveredTopics = goal.syllabus?.filter((s: any) => s.covered)?.length ?? (goal.covered_units || 0);
                        const pct = totalTopics > 0 ? Math.round((coveredTopics / totalTopics) * 100) : 0;

                        // Pacing calculation
                        const targetTime = goal.target_date ? new Date(goal.target_date).getTime() : 0;
                        const daysRemaining = targetTime > 0 ? Math.max(0, Math.ceil((targetTime - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
                        const remainingTopics = Math.max(0, totalTopics - coveredTopics);
                        const daysPerTopic = remainingTopics > 0 && daysRemaining > 0 ? Math.max(1, Math.round(daysRemaining / remainingTopics)) : 7;

                        const cfg = goalConfigs[goal.id] || {
                          topicId: goal.syllabus?.find((s: any) => !s.covered)?.id || goal.syllabus?.[0]?.id || '',
                          taskTitle: `${goal.title}: ${nextPendingTopic}`,
                          durationMinutes: 60,
                          energyLevel: 'deep_focus'
                        };

                        const domainTheme = getDomainTheme(goal.category);
                        const currentTopicObj = goal.syllabus?.find(s => s.id === cfg.topicId) || goal.syllabus?.[0];

                        return (
                          <div
                            key={goal.id}
                            className={`rounded-2xl border transition-all text-xs overflow-hidden ${
                              isChecked
                                ? `${domainTheme.activeBg} ${domainTheme.border} shadow-md`
                                : 'bg-[#141514] border-white/[0.04] opacity-65 hover:opacity-100'
                            }`}
                          >
                            {/* Card Header */}
                            <div 
                              onClick={() => toggleLongTermGoal(goal.id)}
                              className="p-3.5 cursor-pointer flex items-start justify-between gap-3 select-none"
                            >
                              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                                  isChecked ? 'bg-[#3b82f6] border-[#3b82f6] text-white' : 'border-luma-text-dim'
                                }`}>
                                  {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-white truncate text-sm">{goal.title}</span>
                                    {goal.category && (
                                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md ${domainTheme.badgeBg} ${domainTheme.badgeText} border ${domainTheme.badgeBorder}`}>
                                        {goal.category}
                                      </span>
                                    )}
                                    {daysRemaining > 0 && (
                                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-[#251e18] text-amber-300 border border-amber-500/20 flex items-center gap-1">
                                        <Flame className="w-2.5 h-2.5 text-amber-400" />
                                        <span>Pacing: 1 topic / {daysPerTopic}d ({daysRemaining}d left)</span>
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] font-mono text-luma-text-muted mt-1">
                                    <span className="text-[#60a5fa] font-medium truncate">
                                      🎯 Selected: {currentTopicObj?.name || nextPendingTopic}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="font-mono text-xs text-[#60a5fa] font-semibold block">
                                  {coveredTopics}/{totalTopics} units ({pct}%)
                                </span>
                                <span className="text-[10px] font-mono text-luma-text-dim">
                                  ~{formatDurationHoursDisplay(cfg.durationMinutes)} study block
                                </span>
                              </div>
                            </div>

                            {/* Expanded Configuration Section when Checked */}
                            {isChecked && (
                              <div 
                                onClick={(e) => e.stopPropagation()}
                                className="px-3.5 pb-3.5 pt-2.5 border-t border-white/[0.06] bg-[#0c1420]/80 space-y-3 cursor-default"
                              >
                                {/* 1. Syllabus Topic Selector */}
                                {goal.syllabus && goal.syllabus.length > 0 && (
                                  <div>
                                    <div className="flex items-center justify-between text-[10px] font-mono text-luma-text-dim mb-1">
                                      <span className="uppercase tracking-wider text-luma-text-dim flex items-center gap-1">
                                        <BookOpen className="w-3 h-3 text-[#60a5fa]" />
                                        Roadmap Topic for Today:
                                      </span>
                                      <span className="text-[#60a5fa]">
                                        {goal.syllabus.filter((s: any) => !s.covered).length} topics remaining
                                      </span>
                                    </div>
                                    <select
                                      value={cfg.topicId}
                                      onChange={(e) => {
                                        const newTopicId = e.target.value;
                                        const sel = goal.syllabus?.find((s: any) => s.id === newTopicId);
                                        setGoalConfigs(prev => ({
                                          ...prev,
                                          [goal.id]: {
                                            ...cfg,
                                            topicId: newTopicId,
                                            taskTitle: sel ? `${goal.title}: ${sel.name}` : cfg.taskTitle
                                          }
                                        }));
                                      }}
                                      className="w-full bg-[#131c2b] border border-[#3b82f6]/30 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#60a5fa]"
                                    >
                                      {goal.syllabus.map((top: any) => (
                                        <option key={top.id} value={top.id}>
                                          {top.covered ? '✓ ' : '○ '} {top.name} {top.weight === 'HIGH' ? '⭐ (High Yield)' : ''}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}

                                {/* 2. 1-Click Action Presets (Tailored to Domain) */}
                                <div>
                                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-luma-text-dim mb-1.5">
                                    <span>Quick Action Presets:</span>
                                    <span className={domainTheme.badgeText}>{goal.category || 'General Track'}</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {domainTheme.presets.map(preset => (
                                      <button
                                        key={preset.label}
                                        type="button"
                                        onClick={() => {
                                          const topName = currentTopicObj?.name || nextPendingTopic;
                                          setGoalConfigs(prev => ({
                                            ...prev,
                                            [goal.id]: {
                                              ...cfg,
                                              taskTitle: `${goal.title}: ${preset.prefix} ${topName}`
                                            }
                                          }));
                                        }}
                                        className={`px-2.5 py-1 rounded-lg ${domainTheme.chipBg} ${domainTheme.chipHoverBg} border ${domainTheme.chipBorder} ${domainTheme.chipText} hover:text-white text-[10px] font-mono transition-all active:scale-95 shadow-sm`}
                                      >
                                        {preset.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                {/* 3. Editable Task Input */}
                                <div>
                                  <label className="text-[10px] font-mono uppercase tracking-wider text-luma-text-dim block mb-1">
                                    Today's Custom Task / Objective:
                                  </label>
                                  <input
                                    type="text"
                                    value={cfg.taskTitle}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setGoalConfigs(prev => ({
                                        ...prev,
                                        [goal.id]: {
                                          ...cfg,
                                          taskTitle: val
                                        }
                                      }));
                                    }}
                                    placeholder={`e.g. ${goal.title}: Action on ${currentTopicObj?.name || 'Milestone'}`}
                                    className="w-full bg-[#131c2b] border border-[#3b82f6]/30 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-luma-text-dim/50 focus:outline-none focus:border-[#60a5fa]"
                                  />
                                </div>

                                {/* 4. Duration (in Hours) & Energy Level Selectors */}
                                <div className="pt-2 border-t border-white/[0.04] space-y-2">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[10px] font-mono text-luma-text-dim flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-[#60a5fa]" />
                                        Timing (hrs):
                                      </span>
                                      {[
                                        { label: '45m', mins: 45, hrs: '0.75' },
                                        { label: '1h', mins: 60, hrs: '1' },
                                        { label: '1.5h', mins: 90, hrs: '1.5' },
                                        { label: '2h', mins: 120, hrs: '2' },
                                        { label: '3h', mins: 180, hrs: '3' },
                                      ].map(preset => {
                                        const isSelected = cfg.durationMinutes === preset.mins;
                                        return (
                                          <button
                                            key={preset.label}
                                            type="button"
                                            onClick={() => {
                                              setGoalConfigs(prev => ({
                                                ...prev,
                                                [goal.id]: {
                                                  ...cfg,
                                                  durationMinutes: preset.mins,
                                                  customHoursText: preset.hrs
                                                }
                                              }));
                                              saveGoalDurationPreference(goal.id, preset.mins);
                                            }}
                                            className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-all ${
                                              isSelected
                                                ? 'bg-[#3b82f6] text-white font-bold shadow-sm'
                                                : 'bg-[#141514] text-luma-text-dim border border-white/10 hover:text-white hover:border-white/20'
                                            }`}
                                          >
                                            {preset.label}
                                          </button>
                                        );
                                      })}

                                      {/* Custom Hours Stepper & Direct Input */}
                                      <div className="flex items-center gap-1 bg-[#131c2b] border border-[#3b82f6]/40 rounded-lg px-1.5 py-0.5 ml-0.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const currentHours = cfg.durationMinutes / 60;
                                            const newHours = Math.max(0.5, Math.round((currentHours - 0.5) * 2) / 2);
                                            const newMins = Math.round(newHours * 60);
                                            setGoalConfigs(prev => ({
                                              ...prev,
                                              [goal.id]: {
                                                ...cfg,
                                                durationMinutes: newMins,
                                                customHoursText: newHours.toString()
                                              }
                                            }));
                                            saveGoalDurationPreference(goal.id, newMins);
                                          }}
                                          disabled={cfg.durationMinutes <= 30}
                                          className="w-4 h-4 flex items-center justify-center text-luma-text-dim hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-xs font-mono"
                                          title="Decrease by 0.5 hr"
                                        >
                                          <Minus className="w-3 h-3 stroke-[2.5]" />
                                        </button>

                                        <input
                                          type="number"
                                          step="0.5"
                                          min="0.25"
                                          max="8"
                                          value={cfg.customHoursText !== undefined ? cfg.customHoursText : (cfg.durationMinutes / 60).toString()}
                                          onChange={(e) => {
                                            const rawVal = e.target.value;
                                            const parsed = parseFloat(rawVal);
                                            const validHours = isNaN(parsed) || parsed <= 0 ? 0.5 : Math.min(8, parsed);
                                            const newMins = Math.round(validHours * 60);
                                            setGoalConfigs(prev => ({
                                              ...prev,
                                              [goal.id]: {
                                                ...cfg,
                                                durationMinutes: newMins,
                                                customHoursText: rawVal
                                              }
                                            }));
                                            saveGoalDurationPreference(goal.id, newMins);
                                          }}
                                          placeholder="hrs"
                                          className="w-9 bg-transparent text-center text-white text-xs font-mono focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-semibold text-[#60a5fa]"
                                        />
                                        <span className="text-[10px] font-mono text-luma-text-dim pr-0.5">hrs</span>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            const currentHours = cfg.durationMinutes / 60;
                                            const newHours = Math.min(8, Math.round((currentHours + 0.5) * 2) / 2);
                                            const newMins = Math.round(newHours * 60);
                                            setGoalConfigs(prev => ({
                                              ...prev,
                                              [goal.id]: {
                                                ...cfg,
                                                durationMinutes: newMins,
                                                customHoursText: newHours.toString()
                                              }
                                            }));
                                            saveGoalDurationPreference(goal.id, newMins);
                                          }}
                                          disabled={cfg.durationMinutes >= 480}
                                          className="w-4 h-4 flex items-center justify-center text-luma-text-dim hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-xs font-mono"
                                          title="Increase by 0.5 hr"
                                        >
                                          <Plus className="w-3 h-3 stroke-[2.5]" />
                                        </button>
                                      </div>

                                      <span className="text-[9px] font-mono text-[#60a5fa]/75">
                                        ({cfg.durationMinutes}m)
                                      </span>
                                    </div>

                                    {/* Energy Level Toggle */}
                                    <div className="flex items-center gap-1 shrink-0 ml-auto">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setGoalConfigs(prev => ({
                                            ...prev,
                                            [goal.id]: {
                                              ...cfg,
                                              energyLevel: 'deep_focus'
                                            }
                                          }));
                                        }}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all ${
                                          cfg.energyLevel === 'deep_focus'
                                            ? 'bg-purple-950/70 text-purple-200 border border-purple-500/40 shadow-sm'
                                            : 'text-luma-text-dim hover:text-white bg-[#141514] border border-white/5'
                                        }`}
                                      >
                                        ⚡ Deep Focus
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setGoalConfigs(prev => ({
                                            ...prev,
                                            [goal.id]: {
                                              ...cfg,
                                              energyLevel: 'light'
                                            }
                                          }));
                                        }}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all ${
                                          cfg.energyLevel === 'light'
                                            ? 'bg-amber-950/70 text-amber-200 border border-amber-500/40 shadow-sm'
                                            : 'text-luma-text-dim hover:text-white bg-[#141514] border border-white/5'
                                        }`}
                                      >
                                        ☕ Light
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB CONTENT: QUICK TO-DOS */}
              {activeTab === 'todos' && (
                <div className="space-y-3">
                  <div className="text-[11px] text-luma-text-dim">
                    Rapidly brain-dump quick action items for today without creating full task cards:
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTodoText}
                      onChange={(e) => setNewTodoText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddQuickTodo(e); }}
                      placeholder="Add spontaneous to-do (e.g. Call accountant, send proposal)..."
                      className="flex-1 bg-[#141514] border border-luma-card-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-luma-lime"
                    />

                    {/* Duration selector */}
                    <select
                      value={newTodoDuration}
                      onChange={(e) => setNewTodoDuration(Number(e.target.value))}
                      className="bg-[#141514] border border-luma-card-border rounded-xl px-2 py-2 text-xs text-white font-mono focus:outline-none"
                    >
                      <option value={15}>15m</option>
                      <option value={20}>20m</option>
                      <option value={30}>30m</option>
                      <option value={45}>45m</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => handleAddQuickTodo()}
                      className="bg-[#242824] hover:bg-luma-lime hover:text-black text-white px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-1 transition-all shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>

                  {morningTodos.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {morningTodos.map((todo, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-[#141514] px-3 py-2 rounded-xl border border-white/[0.04] text-xs"
                        >
                          <span className="text-white truncate mr-2">{todo.title}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-[10px] text-luma-text-dim px-2 py-0.5 rounded bg-white/5">
                              {todo.duration_minutes}m
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTodo(idx)}
                              className="text-luma-text-dim hover:text-red-400 p-1 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-xs text-luma-text-dim bg-[#141514] rounded-xl border border-white/[0.04]">
                      No extra to-dos added yet. Type above and press Add!
                    </div>
                  )}
                </div>
              )}

              {/* LIVE WORKLOAD VS AVAILABILITY METER */}
              <div className="pt-2 border-t border-white/[0.04]">
                <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-luma-text-dim">Planned Workload:</span>
                    <span className="text-white font-bold">~{plannedHours}h</span>
                    <span className="text-luma-text-muted">/ {availableHoursFormatted} target</span>
                  </div>

                  <div>
                    {capacityPercent <= 85 ? (
                      <span className="text-luma-lime flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="w-3 h-3" /> Balanced Rhythm
                      </span>
                    ) : capacityPercent <= 105 ? (
                      <span className="text-amber-400 flex items-center gap-1 text-[11px]">
                        ⚡ Full Capacity
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-1 text-[11px]">
                        ⚠️ Overbooked ({capacityPercent}%)
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-[#141514] h-1.5 rounded-full overflow-hidden border border-white/[0.04]">
                  <div
                    className={`h-full transition-all duration-300 ${
                      capacityPercent <= 85
                        ? 'bg-luma-lime'
                        : capacityPercent <= 105
                        ? 'bg-amber-400'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(capacityPercent, 100)}%` }}
                  />
                </div>
              </div>

            </div>

          </div>

          {/* 3. STICKY FOOTER */}
          <div
            className="px-4 sm:px-6 py-3 sm:py-3.5 border-t border-white/[0.06] bg-[#141514] flex items-center justify-between gap-2 sm:gap-3 shrink-0"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="px-3 sm:px-4 py-2 rounded-xl text-xs text-luma-text-muted hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-[11px] font-mono text-luma-text-dim hidden md:inline">
                {selectedTaskIds.length} tasks • {selectedHabitIds.length} habits • {selectedLongTermGoalIds.length} roadmaps
              </span>

              <button
                type="submit"
                disabled={loading || isPastTarget}
                onClick={(e) => {
                  if (totalPlannedMinutes > netFocusMinutes) {
                    e.preventDefault();
                    setIsOvercapacityNoticeOpen(true);
                  }
                }}
                className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl font-semibold text-xs shadow-lime-glow active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap ${
                  totalPlannedMinutes > netFocusMinutes
                    ? 'bg-amber-400 hover:bg-amber-300 text-black shadow-amber-glow'
                    : 'bg-luma-lime hover:bg-luma-lime-hover text-black'
                }`}
              >
                {totalPlannedMinutes > netFocusMinutes ? (
                  <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
                )}
                <span>
                  {loading
                    ? 'Synthesizing...'
                    : isPastTarget
                    ? 'Cannot Shape Past'
                    : totalPlannedMinutes > netFocusMinutes
                    ? 'Review Overcapacity'
                    : 'Generate Timetable'}
                </span>
              </button>
            </div>
          </div>
        </form>

        {/* OVERCAPACITY NOTICE MODAL POPUP */}
        {isOvercapacityNoticeOpen && (
          <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
            <div className="w-full max-w-md bg-[#181a18] border border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">Workload Exceeds Working Hours</h3>
                    <p className="text-xs text-amber-400/90 font-mono">Overcapacity Notice</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOvercapacityNoticeOpen(false)}
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Stats Card */}
              <div className="p-3.5 rounded-2xl bg-[#141514] border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-luma-text-muted">Total Task Workload:</span>
                  <span className="font-mono font-bold text-white">
                    {Math.floor(totalPlannedMinutes / 60)}h {totalPlannedMinutes % 60}m
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-luma-text-muted">Available Working Time:</span>
                  <span className="font-mono text-luma-text-dim">
                    {Math.floor(netFocusMinutes / 60)}h {netFocusMinutes % 60}m ({workStartTime} – {workEndTime})
                  </span>
                </div>
                <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs font-semibold">
                  <span className="text-rose-400">Deficit:</span>
                  <span className="font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                    +{Math.floor((totalPlannedMinutes - netFocusMinutes) / 60)}h {(totalPlannedMinutes - netFocusMinutes) % 60}m over capacity
                  </span>
                </div>
              </div>

              <p className="text-xs text-luma-text-muted leading-relaxed">
                Your selected to-do tasks and study goals require more time than your configured workday window. Please expand your working hours or deselect/trim some tasks to build a realistic timeline.
              </p>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleAutoExtendWorkHours}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-luma-lime hover:bg-luma-lime-hover text-black font-semibold text-xs transition-all shadow-lime-glow cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto-Extend Work End to {recommendedWorkEndTime}</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOvercapacityNoticeOpen(false);
                      const el = document.getElementById('working-hours-section');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium transition-colors cursor-pointer text-center"
                  >
                    Adjust Hours
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOvercapacityNoticeOpen(false);
                      const el = document.getElementById('items-to-merge-section');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium transition-colors cursor-pointer text-center"
                  >
                    Trim Tasks
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
