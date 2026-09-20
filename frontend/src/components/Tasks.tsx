import React, { useState, useMemo } from 'react';
import { Plus, Minus, Flame, Sun, Waves, Moon, CheckCircle2, ArrowRight, Trash2, Pencil, RotateCcw, Target, Clock, Trophy, Calendar } from 'lucide-react';
import { Habit, Task, WeeklyGoal, getTimeBucket } from '../services/api';

import { normalizeHabitDays, WEEK_DAYS_CONFIG } from './modals/HabitModal';

interface TasksProps {
  tasks: Task[];
  habits: Habit[];
  weeklyGoals: WeeklyGoal[];
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
  onToggleStatus?: (id: string) => void;
  onAddHabit: () => void;
  onEditHabit: (habit: Habit) => void;
  onCheckHabitStreak?: (id: string) => void;
  onDeleteHabit: (id: string) => Promise<void>;
  onAddWeeklyGoal: () => void;
  onEditWeeklyGoal: (goal: WeeklyGoal) => void;
  onDeleteWeeklyGoal: (id: string) => Promise<void>;
  onQuickAddTodo: (title: string) => Promise<void>;
  onIncrementWeeklyGoal?: (id: string, currentCompleted: number) => Promise<void>;
  onUpdateWeeklyGoalProgress?: (id: string, newUnits: number) => Promise<void> | void;
  onCopyPreviousHabits?: () => Promise<void>;
  onCopyPreviousWeeklyGoals?: () => Promise<void>;
  onOpenShapeMyDay?: () => void;
}

type SectionTab = 'todos' | 'habits' | 'weekly';

export const Tasks: React.FC<TasksProps> = ({
  tasks,
  habits,
  weeklyGoals,
  onAddTask,
  onEditTask,
  onToggleStatus,
  onAddHabit,
  onEditHabit,
  onCheckHabitStreak: _onCheckHabitStreak,
  onDeleteHabit,
  onAddWeeklyGoal,
  onEditWeeklyGoal,
  onDeleteWeeklyGoal,
  onQuickAddTodo,
  onIncrementWeeklyGoal: _onIncrementWeeklyGoal,
  onUpdateWeeklyGoalProgress,
  onCopyPreviousHabits,
  onCopyPreviousWeeklyGoals,
  onOpenShapeMyDay: _onOpenShapeMyDay,
}) => {
  const [activeSection, setActiveSection] = useState<SectionTab>('todos');
  const [isCopyingHabits, setIsCopyingHabits] = useState(false);
  const [isCopyingWeeklyGoals, setIsCopyingWeeklyGoals] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [confirmingHabitId, setConfirmingHabitId] = useState<string | null>(null);
  const [confirmingWeeklyGoalId, setConfirmingWeeklyGoalId] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState<string>('all');
  const [weeklyCategoryFilter, setWeeklyCategoryFilter] = useState<string>('all');

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (taskFilter === 'deep_focus') return t.energy_level === 'deep_focus';
      if (taskFilter === 'light') return t.energy_level === 'light';
      if (taskFilter === 'pending') return t.status === 'pending';
      if (taskFilter === 'done') return t.status === 'done';
      return true;
    });
  }, [tasks, taskFilter]);

  const filteredWeeklyGoals = useMemo(() => {
    if (weeklyCategoryFilter === 'all') return weeklyGoals;
    return weeklyGoals.filter((wg) => (wg.category || 'Project').toLowerCase() === weeklyCategoryFilter.toLowerCase());
  }, [weeklyGoals, weeklyCategoryFilter]);

  const weeklyCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    weeklyGoals.forEach((g) => {
      const cat = g.category || 'Project';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [weeklyGoals]);

  const getTaskBucket = (task: Task): 'now' | 'up_next' | 'later' => {
    if (task.scheduled_start) {
      return getTimeBucket(task.scheduled_start);
    }
    return task.column_bucket || 'now';
  };

  const morningTasks = filteredTasks.filter(t => getTaskBucket(t) === 'now');
  const afternoonTasks = filteredTasks.filter(t => getTaskBucket(t) === 'up_next');
  const eveningTasks = filteredTasks.filter(t => getTaskBucket(t) === 'later');

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    setIsAdding(true);
    try {
      await onQuickAddTodo(quickTitle.trim());
      setQuickTitle('');
    } finally {
      setIsAdding(false);
    }
  };

  const renderTaskCard = (task: Task) => {
    const isHigh = task.priority === 'HIGH';
    const isMedium = task.priority === 'MEDIUM';
    const isDone = task.status === 'done';

    const accentBorder = task.energy_level === 'deep_focus'
      ? 'border-l-[#7b6ef6]'
      : 'border-l-[#d4f938]';

    return (
      <div
        key={task.id}
        onClick={() => onEditTask(task)}
        className={`bg-luma-card border border-luma-card-border hover:border-white/20 rounded-2xl p-4 transition-all hover:translate-y-[-1px] cursor-pointer relative border-l-4 ${accentBorder}`}
      >
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h4 className={`text-sm font-semibold text-white leading-snug transition-all ${isDone ? 'line-through opacity-50' : ''}`}>
            {task.title}
          </h4>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleStatus?.(task.id);
            }}
            title={isDone ? 'Mark as pending' : 'Mark as done'}
            className="group/btn p-0.5 rounded-md hover:bg-white/10 transition-colors shrink-0"
          >
            {isDone ? (
              <span className="text-[10px] font-mono font-semibold text-luma-lime bg-luma-lime/10 px-2 py-0.5 rounded-md border border-luma-lime/25 flex items-center gap-1 shrink-0 group-hover/btn:brightness-125">
                <CheckCircle2 className="w-3 h-3 text-luma-lime" />
                <span>Done</span>
              </span>
            ) : (
              <span className="w-5 h-5 rounded-full border border-white/20 hover:border-luma-lime hover:bg-luma-lime/10 flex items-center justify-center text-xs text-white/30 hover:text-luma-lime transition-all shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-transparent group-hover/btn:bg-luma-lime transition-colors" />
              </span>
            )}
          </button>
        </div>

        <div className="text-xs text-luma-text-muted mb-4">
          {task.category || 'General'}
        </div>

        <div className="flex items-center justify-between pt-1 text-[11px] font-mono">
          <div>
            {task.scheduled_start ? (
              <span className="text-luma-lime font-semibold flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-luma-lime/10 border border-luma-lime/25">
                <Clock className="w-3 h-3 text-luma-lime" />
                <span>{task.scheduled_start}</span>
                {task.duration_minutes > 0 && (
                  <span className="text-luma-text-dim text-[10px]">({task.duration_minutes}m)</span>
                )}
              </span>
            ) : task.duration_minutes > 0 ? (
              <span className="text-luma-purple font-semibold">{task.duration_minutes} MIN</span>
            ) : (
              <span className="text-luma-text-dim flex items-center gap-1">
                <span>⚡</span>
                <span>Action item</span>
              </span>
            )}
          </div>
          <span
            className={`font-semibold tracking-wider ${
              isHigh ? 'text-[#8b7eff]' : isMedium ? 'text-[#44c7b8]' : 'text-luma-text-dim'
            }`}
          >
            {task.priority}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
        <div>
          <div className="text-[10px] xs:text-[11px] font-mono tracking-widest uppercase text-luma-text-dim mb-1">
            Commitments, Not Clutter
          </div>
          <h1 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-serif text-white tracking-tight mb-1.5 xs:mb-2">
            Tasks & Cadence
          </h1>
          <p className="text-xs sm:text-sm text-luma-text-muted">
            Manage daily to-dos, monthly habits, and weekly target pacing.
          </p>
        </div>

        {/* Dynamic Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {activeSection === 'todos' && (
            <button
              onClick={onAddTask}
              className="flex items-center gap-1.5 xs:gap-2 bg-luma-lime hover:bg-luma-lime-hover text-black px-3 xs:px-4 py-2 xs:py-2.5 rounded-xl font-semibold text-xs sm:text-sm shadow-lime-glow active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 xs:w-4 xs:h-4 stroke-[2.5]" />
              <span>Add to-do</span>
            </button>
          )}
          {activeSection === 'habits' && (
            <button
              onClick={onAddHabit}
              className="flex items-center gap-1.5 xs:gap-2 bg-luma-purple hover:bg-luma-purple-glow text-white px-3 xs:px-4 py-2 xs:py-2.5 rounded-xl font-semibold text-xs sm:text-sm shadow-purple-glow active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 xs:w-4 xs:h-4 stroke-[2.5]" />
              <span>Add habit</span>
            </button>
          )}
          {activeSection === 'weekly' && (
            <button
              onClick={onAddWeeklyGoal}
              className="flex items-center gap-1.5 xs:gap-2 bg-luma-lime hover:bg-luma-lime-hover text-black px-3 xs:px-4 py-2 xs:py-2.5 rounded-xl font-semibold text-xs sm:text-sm shadow-lime-glow active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 xs:w-4 xs:h-4 stroke-[2.5]" />
              <span>New weekly goal</span>
            </button>
          )}
        </div>
      </div>

      {/* 3-Tier Horizon Switcher */}
      <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 border-b border-white/[0.06] pb-2.5 xs:pb-3 sm:pb-4 overflow-x-auto scrollbar-none flex-nowrap">
        <button
          onClick={() => setActiveSection('todos')}
          className={`shrink-0 flex items-center gap-1.5 xs:gap-2 px-2.5 xs:px-3.5 sm:px-5 py-1.5 xs:py-2 sm:py-2.5 rounded-xl xs:rounded-2xl text-[11px] xs:text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeSection === 'todos'
              ? 'bg-luma-cream text-luma-cream-text shadow-sm'
              : 'text-luma-text-muted hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <span>🟢 Today's To-Dos</span>
          <span className="text-[10px] xs:text-[11px] font-mono opacity-60">({tasks.length})</span>
        </button>

        <button
          onClick={() => setActiveSection('habits')}
          className={`shrink-0 flex items-center gap-1.5 xs:gap-2 px-2.5 xs:px-3.5 sm:px-5 py-1.5 xs:py-2 sm:py-2.5 rounded-xl xs:rounded-2xl text-[11px] xs:text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeSection === 'habits'
              ? 'bg-luma-cream text-luma-cream-text shadow-sm'
              : 'text-luma-text-muted hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <span>🟣 Daily Habits</span>
          <span className="text-[10px] xs:text-[11px] font-mono opacity-60">({habits.length})</span>
        </button>

        <button
          onClick={() => setActiveSection('weekly')}
          className={`shrink-0 flex items-center gap-1.5 xs:gap-2 px-2.5 xs:px-3.5 sm:px-5 py-1.5 xs:py-2 sm:py-2.5 rounded-xl xs:rounded-2xl text-[11px] xs:text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeSection === 'weekly'
              ? 'bg-luma-cream text-luma-cream-text shadow-sm'
              : 'text-luma-text-muted hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <span>⚡ Weekly Goals</span>
          <span className="text-[10px] xs:text-[11px] font-mono opacity-60">({weeklyGoals.length})</span>
        </button>
      </div>

      {/* SECTION 1: DAILY TO-DOS */}
      {activeSection === 'todos' && (
        <div className="space-y-6">
          {/* Rapid Morning Brain Dump Input Bar */}
          <form onSubmit={handleQuickSubmit} className="flex items-center gap-2 xs:gap-3">
            <input
              type="text"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="Quick add today's to-do (e.g. Reply to emails 20m)..."
              className="flex-1 bg-luma-card border border-luma-card-border focus:border-luma-lime rounded-xl xs:rounded-2xl px-3.5 xs:px-5 py-2.5 xs:py-3 text-xs sm:text-sm text-white placeholder:text-luma-text-dim focus:outline-none transition-all shadow-inner min-w-0"
            />
            <button
              type="submit"
              disabled={isAdding || !quickTitle.trim()}
              className="bg-[#242824] hover:bg-luma-lime hover:text-black text-white px-3.5 xs:px-5 py-2.5 xs:py-3 rounded-xl xs:rounded-2xl text-xs font-semibold transition-all disabled:opacity-40 shrink-0"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Minimal Filter Row */}
          <div className="flex items-center justify-between flex-wrap gap-2 px-0.5 xs:px-1">
            <div className="flex items-center gap-1.5 xs:gap-2 flex-wrap">
              <span className="text-[10px] xs:text-[11px] font-mono uppercase text-luma-text-dim tracking-wider">
                Filter:
              </span>
              <div className="flex items-center gap-1 xs:gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setTaskFilter('all')}
                  className={`px-2 xs:px-3 py-1 rounded-lg xs:rounded-xl text-[10px] xs:text-xs font-mono transition-all ${
                    taskFilter === 'all'
                      ? 'bg-white text-black font-semibold shadow-sm'
                      : 'bg-white/[0.04] text-luma-text-muted hover:text-white hover:bg-white/[0.08]'
                  }`}
                >
                  All ({tasks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTaskFilter('deep_focus')}
                  className={`px-2 xs:px-3 py-1 rounded-lg xs:rounded-xl text-[10px] xs:text-xs font-mono transition-all flex items-center gap-1 xs:gap-1.5 ${
                    taskFilter === 'deep_focus'
                      ? 'bg-luma-purple text-white font-semibold shadow-purple-glow'
                      : 'bg-white/[0.04] text-luma-purple hover:bg-luma-purple/20'
                  }`}
                >
                  <span>🟣 Deep</span>
                  <span className="opacity-70 text-[9px] xs:text-[10px]">
                    ({tasks.filter(t => t.energy_level === 'deep_focus').length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setTaskFilter('light')}
                  className={`px-2 xs:px-3 py-1 rounded-lg xs:rounded-xl text-[10px] xs:text-xs font-mono transition-all flex items-center gap-1 xs:gap-1.5 ${
                    taskFilter === 'light'
                      ? 'bg-luma-lime text-black font-semibold shadow-lime-glow'
                      : 'bg-white/[0.04] text-luma-lime hover:bg-luma-lime/20'
                  }`}
                >
                  <span>🟢 Light</span>
                  <span className="opacity-70 text-[9px] xs:text-[10px]">
                    ({tasks.filter(t => t.energy_level === 'light').length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setTaskFilter('pending')}
                  className={`px-2 xs:px-3 py-1 rounded-lg xs:rounded-xl text-[10px] xs:text-xs font-mono transition-all ${
                    taskFilter === 'pending'
                      ? 'bg-amber-400 text-black font-semibold shadow-sm'
                      : 'bg-white/[0.04] text-amber-300 hover:bg-amber-400/20'
                  }`}
                >
                  Pending ({tasks.filter(t => t.status === 'pending').length})
                </button>
                <button
                  type="button"
                  onClick={() => setTaskFilter('done')}
                  className={`px-2 xs:px-3 py-1 rounded-lg xs:rounded-xl text-[10px] xs:text-xs font-mono transition-all ${
                    taskFilter === 'done'
                      ? 'bg-emerald-400 text-black font-semibold shadow-sm'
                      : 'bg-white/[0.04] text-emerald-300 hover:bg-emerald-400/20'
                  }`}
                >
                  Done ({tasks.filter(t => t.status === 'done').length})
                </button>
              </div>
            </div>
          </div>

          {/* 3 Time-of-Day Columns: Morning, Afternoon, Evening */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <span className="text-xs font-mono tracking-widest uppercase text-luma-lime font-bold px-1 flex items-center gap-1.5">
                <span>🌅 MORNING</span>
                <span className="text-luma-text-dim font-normal">· {morningTasks.length}</span>
              </span>
              <div className="space-y-3">
                {morningTasks.map(renderTaskCard)}
                {morningTasks.length === 0 && (
                  <div className="p-8 rounded-2xl border border-dashed border-[#262826] text-center text-xs text-luma-text-dim">
                    No tasks for Morning
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <span className="text-xs font-mono tracking-widest uppercase text-amber-400 font-bold px-1 flex items-center gap-1.5">
                <span>☀️ AFTERNOON</span>
                <span className="text-luma-text-dim font-normal">· {afternoonTasks.length}</span>
              </span>
              <div className="space-y-3">
                {afternoonTasks.map(renderTaskCard)}
                {afternoonTasks.length === 0 && (
                  <div className="p-8 rounded-2xl border border-dashed border-[#262826] text-center text-xs text-luma-text-dim">
                    No tasks for Afternoon
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <span className="text-xs font-mono tracking-widest uppercase text-purple-400 font-bold px-1 flex items-center gap-1.5">
                <span>🌙 EVENING</span>
                <span className="text-luma-text-dim font-normal">· {eveningTasks.length}</span>
              </span>
              <div className="space-y-3">
                {eveningTasks.map(renderTaskCard)}
                {eveningTasks.length === 0 && (
                  <div className="p-8 rounded-2xl border border-dashed border-[#262826] text-center text-xs text-luma-text-dim">
                    No tasks for Evening
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: DAILY HABITS */}
      {activeSection === 'habits' && (
        <div className="space-y-6">

          <div className="bg-luma-card border border-luma-card-border rounded-3xl p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-white mb-1">Monthly Habit Routines</h3>
              <p className="text-xs text-luma-text-muted">
                Configured once a month. These repeat automatically and anchor into every daily schedule generated.
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <span className="text-xs font-mono text-luma-purple bg-luma-purple-dim px-3 py-1.5 rounded-full">
                {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date())}
              </span>
              <span className="text-xs font-mono text-luma-purple bg-luma-purple-dim px-3 py-1.5 rounded-full">
                {habits.filter(h => h.is_active).length} Active Daily
              </span>
              {onCopyPreviousHabits && (
                <button
                  type="button"
                  disabled={isCopyingHabits}
                  onClick={async () => {
                    setIsCopyingHabits(true);
                    try {
                      await onCopyPreviousHabits();
                    } finally {
                      setIsCopyingHabits(false);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-xs border border-white/10 transition-all cursor-pointer"
                  title="Copy habits from last month"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isCopyingHabits ? 'animate-spin' : ''}`} />
                  <span>{isCopyingHabits ? 'Copying...' : 'Copy Last Month'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={onAddHabit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-luma-lime hover:bg-luma-lime-hover text-black font-semibold text-xs shadow-lime-glow transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Habit</span>
              </button>
            </div>
          </div>

          {habits.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border border-dashed border-white/10 bg-[#161716]/60 flex flex-col items-center justify-center my-2">
              <div className="w-12 h-12 rounded-2xl bg-luma-purple/10 border border-luma-purple/20 flex items-center justify-center text-luma-purple mb-3">
                <Flame className="w-6 h-6 stroke-[1.5]" />
              </div>
              <h4 className="text-base font-semibold text-white mb-1">No daily habits configured for this month</h4>
              <p className="text-xs text-luma-text-muted max-w-sm mb-5 leading-relaxed">
                Build consistent momentum by defining recurring morning anchors, deep focus rituals, or evening wind-downs.
              </p>
              <div className="flex items-center gap-3">
                {onCopyPreviousHabits && (
                  <button
                    type="button"
                    disabled={isCopyingHabits}
                    onClick={async () => {
                      setIsCopyingHabits(true);
                      try {
                        await onCopyPreviousHabits();
                      } finally {
                        setIsCopyingHabits(false);
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/10 transition-all active:scale-95 cursor-pointer"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isCopyingHabits ? 'animate-spin' : ''}`} />
                    <span>{isCopyingHabits ? 'Copying...' : "Copy last month's habits"}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onAddHabit}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-luma-purple hover:bg-luma-purple-glow text-white text-xs font-semibold shadow-purple-glow transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Add your first habit</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {habits.map((habit) => {
              const AnchorIcon = habit.anchor === 'morning' ? Sun : habit.anchor === 'floating' ? Waves : Moon;
              const anchorColor = habit.anchor === 'morning' ? 'text-amber-400' : habit.anchor === 'floating' ? 'text-[#4287f5]' : 'text-luma-purple';
              const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
              const isCompletedToday = habit.last_completed_date === todayIST;

              return (
                <div
                  key={habit.id}
                  onClick={() => onEditHabit(habit)}
                  className="bg-luma-card border border-luma-card-border hover:border-white/20 rounded-2xl xs:rounded-3xl p-3.5 xs:p-5 sm:p-6 transition-all relative flex flex-col justify-between cursor-pointer group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5 text-xs font-mono capitalize">
                        <AnchorIcon className={`w-4 h-4 ${anchorColor}`} />
                        <span className="text-luma-text-muted">{habit.anchor} Anchor</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {habit.habit_type === 'check_off' ? (
                          <span className="text-[11px] font-mono text-amber-300 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-lg">
                            {habit.target_value ? `⚡ ${habit.target_value}` : '⚡ RITUAL'}
                          </span>
                        ) : habit.habit_type === 'target' ? (
                          <span className="text-[11px] font-mono text-cyan-300 bg-cyan-400/10 border border-cyan-400/20 px-2 py-0.5 rounded-lg">
                            🎯 {habit.target_value} {habit.target_unit || ''}
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono text-luma-purple bg-luma-purple/10 border border-luma-purple/20 px-2 py-0.5 rounded-lg font-semibold">
                            ⏱️ {habit.duration_minutes} MIN
                          </span>
                        )}

                        <button
                          type="button"
                          title="Edit habit"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditHabit(habit);
                          }}
                          className="text-luma-text-dim hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {confirmingHabitId === habit.id ? (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 bg-[#2a1717] border border-red-500/30 px-2 py-0.5 rounded-lg animate-fadeIn"
                          >
                            <span className="text-[10px] text-red-300">Delete?</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteHabit(habit.id);
                                setConfirmingHabitId(null);
                              }}
                              className="bg-red-500 hover:bg-red-600 text-white px-1.5 py-0.5 rounded text-[9px] font-semibold"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmingHabitId(null);
                              }}
                              className="text-luma-text-muted hover:text-white px-1 text-[9px]"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            title="Delete habit"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmingHabitId(habit.id);
                            }}
                            className="text-luma-text-dim hover:text-red-400 p-1 rounded-lg hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <h4 className="text-base font-semibold text-white mb-2 group-hover:text-luma-lime transition-colors">
                      {habit.title}
                    </h4>

                    {/* Repeating Frequency indicator */}
                    <div className="mb-4">
                      {habit.frequency_type === 'interval' ? (
                        <div className="flex items-center gap-1.5 text-xs font-mono text-[#4287f5] bg-[#1e2638] border border-[#4287f5]/20 px-2.5 py-1 rounded-xl w-fit">
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Every {habit.frequency_value || 2} days</span>
                        </div>
                      ) : habit.frequency_type === 'weekly_target' ? (
                        <div className="flex items-center gap-1.5 text-xs font-mono text-amber-300 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-xl w-fit">
                          <Target className="w-3.5 h-3.5" />
                          <span>{habit.frequency_value || 3}x / week</span>
                        </div>
                      ) : (
                        (() => {
                          const normalized = normalizeHabitDays(habit.active_days);
                          const isDaily = normalized.length === 7;
                          const isWeekdays = normalized.length === 5 && !normalized.includes('Sat') && !normalized.includes('Sun');
                          const isWeekends = normalized.length === 2 && normalized.includes('Sat') && normalized.includes('Sun');
                          const cadenceLabel = isDaily ? 'Daily' : isWeekdays ? 'Weekdays' : isWeekends ? 'Weekends' : `${normalized.length}d/wk`;

                          return (
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                {WEEK_DAYS_CONFIG.map((dayItem) => {
                                  const isActiveDay = normalized.includes(dayItem.key);
                                  return (
                                    <span
                                      key={dayItem.key}
                                      title={dayItem.name}
                                      className={`w-5 h-5 rounded-md text-[9px] font-mono flex items-center justify-center font-bold ${
                                        isActiveDay ? 'bg-white/15 text-white' : 'text-white/20'
                                      }`}
                                    >
                                      {dayItem.label}
                                    </span>
                                  );
                                })}
                              </div>
                              <span className="text-[10px] font-mono text-luma-text-dim">
                                {cadenceLabel}
                              </span>
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/[0.04] flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-mono text-[#f08a5d]">
                      <Flame className="w-4 h-4 fill-[#f08a5d]" />
                      <span>{habit.streak_count} day streak</span>
                    </div>

                    {isCompletedToday ? (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-luma-lime/10 border border-luma-lime/30 text-luma-lime shadow-sm">
                        <CheckCircle2 className="w-3.5 h-3.5 fill-luma-lime text-black" />
                        <span>Done Today</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-luma-text-dim/60 bg-white/[0.03] px-2.5 py-1 rounded-lg border border-white/5" title="Habits are completed via the Daily Plan page">
                        Track in Daily Plan
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* SECTION 3: WEEKLY GOALS */}
      {activeSection === 'weekly' && (
        <div className="space-y-6">

          <div className="bg-luma-card border border-luma-card-border rounded-3xl p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-white mb-1">Weekly Target Goals</h3>
              <p className="text-xs text-luma-text-muted">
                7-day cumulative milestone targets. Track your weekly pacing and review completed outcomes at the end of each week.
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <span className="text-xs font-mono text-luma-lime bg-[#212b10] px-3 py-1.5 rounded-full">
                Weekly Cadence Active
              </span>
              {onCopyPreviousWeeklyGoals && (
                <button
                  type="button"
                  disabled={isCopyingWeeklyGoals}
                  onClick={async () => {
                    setIsCopyingWeeklyGoals(true);
                    try {
                      await onCopyPreviousWeeklyGoals();
                    } finally {
                      setIsCopyingWeeklyGoals(false);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-xs border border-white/10 transition-all cursor-pointer"
                  title="Copy weekly goals from last week"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isCopyingWeeklyGoals ? 'animate-spin' : ''}`} />
                  <span>{isCopyingWeeklyGoals ? 'Copying...' : 'Copy Last Week'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={onAddWeeklyGoal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-luma-lime hover:bg-luma-lime-hover text-black font-semibold text-xs shadow-lime-glow transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Weekly Goal</span>
              </button>
            </div>
          </div>

          {/* Minimal Domain Category Filter Row */}
          {weeklyGoals.length > 0 && (
            <div className="flex items-center gap-2 px-1 flex-wrap">
              <span className="text-[11px] font-mono uppercase text-luma-text-dim tracking-wider">
                Domain Focus:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setWeeklyCategoryFilter('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-mono transition-all ${
                    weeklyCategoryFilter === 'all'
                      ? 'bg-luma-lime text-black font-semibold shadow-lime-glow'
                      : 'bg-white/[0.04] text-luma-text-muted hover:text-white hover:bg-white/[0.08]'
                  }`}
                >
                  All Goals ({weeklyGoals.length})
                </button>
                {weeklyCategories.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setWeeklyCategoryFilter(c.name)}
                    className={`px-3 py-1 rounded-xl text-xs font-mono transition-all ${
                      weeklyCategoryFilter.toLowerCase() === c.name.toLowerCase()
                        ? 'bg-white text-black font-semibold shadow-sm'
                        : 'bg-white/[0.04] text-luma-text-muted hover:text-white hover:bg-white/[0.08]'
                    }`}
                  >
                    {c.name} ({c.count})
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredWeeklyGoals.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border border-dashed border-white/10 bg-[#161716]/60 flex flex-col items-center justify-center my-2">
              <div className="w-12 h-12 rounded-2xl bg-luma-lime/10 border border-luma-lime/20 flex items-center justify-center text-luma-lime mb-3">
                <Target className="w-6 h-6 stroke-[1.5]" />
              </div>
              <h4 className="text-base font-semibold text-white mb-1">
                {weeklyCategoryFilter !== 'all' ? `No ${weeklyCategoryFilter} weekly goals` : 'No weekly target goals set'}
              </h4>
              <p className="text-xs text-luma-text-muted max-w-sm mb-5 leading-relaxed">
                Set high-leverage weekly targets for your projects, exams, or craft. The timetable scheduler will automatically protect focus blocks to keep you on pace.
              </p>
              <div className="flex items-center gap-3">
                {onCopyPreviousWeeklyGoals && (
                  <button
                    type="button"
                    disabled={isCopyingWeeklyGoals}
                    onClick={async () => {
                      setIsCopyingWeeklyGoals(true);
                      try {
                        await onCopyPreviousWeeklyGoals();
                      } finally {
                        setIsCopyingWeeklyGoals(false);
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/10 transition-all active:scale-95 cursor-pointer"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isCopyingWeeklyGoals ? 'animate-spin' : ''}`} />
                    <span>{isCopyingWeeklyGoals ? 'Copying...' : "Copy previous week's goals"}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onAddWeeklyGoal}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-luma-lime hover:bg-luma-lime-hover text-black text-xs font-semibold shadow-lime-glow transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>New weekly goal</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredWeeklyGoals.map((wg) => {
              const progress = wg.progressPercent || Math.round((wg.completed_units / Math.max(wg.target_units, 1)) * 100);
              const cat = (wg.category || 'Project').toLowerCase();
              let badgeStyle = { label: 'PROJECT', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
              if (cat.includes('business') || cat.includes('job') || cat.includes('work')) {
                badgeStyle = { label: 'BUSINESS', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
              } else if (cat.includes('exam') || cat.includes('study') || cat.includes('academic')) {
                badgeStyle = { label: 'STUDY', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
              } else if (cat.includes('fit') || cat.includes('health')) {
                badgeStyle = { label: 'FITNESS', color: 'bg-lime-500/10 text-lime-400 border-lime-500/30' };
              } else if (cat.includes('creative') || cat.includes('personal')) {
                badgeStyle = { label: 'CREATIVE', color: 'bg-pink-500/10 text-pink-400 border-pink-500/30' };
              }

              const isAchieved = wg.completed_units >= wg.target_units;
              const now = new Date();
              const currentDay = now.getDay();
              const daysUntilSunday = currentDay === 0 ? 0 : 7 - currentDay;
              const sundayReviewText = daysUntilSunday === 0 ? 'Sunday review today' : `Sunday review in ${daysUntilSunday}d`;

              return (
                <div
                  key={wg.id}
                  onClick={() => onEditWeeklyGoal(wg)}
                  className={`bg-luma-card border rounded-2xl xs:rounded-3xl p-3.5 xs:p-5 sm:p-6 transition-all cursor-pointer group ${
                    isAchieved
                      ? 'border-emerald-500/30 hover:border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.08)]'
                      : 'border-luma-card-border hover:border-white/20'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-1.5 xs:gap-2 mb-1.5 flex-wrap">
                        <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-md border tracking-wider uppercase ${badgeStyle.color}`}>
                          {badgeStyle.label}
                        </span>
                        {isAchieved ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-bold">
                            <Trophy className="w-3 h-3 text-emerald-400" />
                            <span>GOAL ACHIEVED</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.04] text-luma-text-muted border border-white/10 flex items-center gap-1">
                            <span>⏳</span>
                            <span>IN PROGRESS</span>
                          </span>
                        )}
                        <span className="text-[10px] font-mono tracking-wider uppercase text-luma-text-dim">
                          {wg.priority} PRIORITY
                        </span>
                      </div>
                      <h4 className="text-sm xs:text-base font-semibold text-white group-hover:text-luma-lime transition-colors">
                        {wg.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5 xs:gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-white/[0.04]">
                      {/* Stepper Controls */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 bg-[#1a1c1a] border border-white/[0.08] rounded-xl px-1.5 xs:px-2 py-1 shadow-sm shrink-0"
                      >
                        <button
                          type="button"
                          disabled={wg.completed_units <= 0}
                          onClick={() => {
                            onUpdateWeeklyGoalProgress?.(wg.id, Math.max(0, wg.completed_units - 1));
                          }}
                          className="w-6 h-6 sm:w-5 sm:h-5 rounded-lg bg-white/5 hover:bg-white/15 disabled:opacity-20 disabled:pointer-events-none flex items-center justify-center text-white/70 hover:text-white transition-all text-xs active:scale-90 cursor-pointer"
                          title="Decrease 1 unit"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>

                        <span
                          className="font-semibold text-white px-1.5 text-xs cursor-pointer hover:text-luma-lime transition-colors"
                          title="Click to manually set completed units"
                          onClick={() => {
                            const val = prompt(`Set completed ${wg.unit_label || 'units'} (target: ${wg.target_units}):`, String(wg.completed_units));
                            if (val !== null) {
                              const parsed = parseInt(val.trim(), 10);
                              if (!isNaN(parsed)) {
                                onUpdateWeeklyGoalProgress?.(wg.id, Math.max(0, Math.min(wg.target_units, parsed)));
                              }
                            }
                          }}
                        >
                          {wg.completed_units}
                        </span>
                        <span className="text-luma-text-dim text-[11px] pr-0.5">/ {wg.target_units} {wg.unit_label}</span>

                        <button
                          type="button"
                          disabled={wg.completed_units >= wg.target_units}
                          onClick={() => {
                            onUpdateWeeklyGoalProgress?.(wg.id, Math.min(wg.target_units, wg.completed_units + 1));
                          }}
                          className="w-6 h-6 sm:w-5 sm:h-5 rounded-lg bg-luma-lime/15 hover:bg-luma-lime/25 text-luma-lime disabled:opacity-20 disabled:pointer-events-none flex items-center justify-center transition-all text-xs font-bold active:scale-90 shadow-sm cursor-pointer"
                          title="Add 1 unit"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {isAchieved ? (
                        <span className="text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-xl font-medium select-none flex items-center gap-1">
                          ✓ Done
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateWeeklyGoalProgress?.(wg.id, Math.min(wg.target_units, wg.completed_units + 1));
                          }}
                          className="px-2.5 py-1 rounded-xl bg-luma-lime/10 hover:bg-luma-lime/20 text-luma-lime border border-luma-lime/25 text-xs font-bold font-mono transition-all hover:scale-105 active:scale-95 shadow-sm"
                          title={`Log +1 ${wg.unit_label || 'unit'}`}
                        >
                          +1
                        </button>
                      )}

                      <button
                        type="button"
                        title="Edit weekly goal"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditWeeklyGoal(wg);
                        }}
                        className="text-luma-text-dim hover:text-white p-1.5 rounded-xl hover:bg-white/5 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      {confirmingWeeklyGoalId === wg.id ? (
                        <div
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          className="flex items-center gap-1.5 bg-[#2a1717] border border-red-500/30 px-2 py-1 rounded-xl animate-fadeIn"
                        >
                          <span className="text-[10px] text-red-300 font-medium">Delete?</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onDeleteWeeklyGoal(wg.id);
                              setConfirmingWeeklyGoalId(null);
                            }}
                            className="bg-red-500 hover:bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-semibold transition-all active:scale-95"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setConfirmingWeeklyGoalId(null);
                            }}
                            className="text-luma-text-muted hover:text-white px-1 text-[10px]"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          title="Delete weekly goal"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setConfirmingWeeklyGoalId(wg.id);
                          }}
                          className="text-luma-text-dim hover:text-red-400 p-1.5 rounded-xl hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-[#252825] rounded-full overflow-hidden my-3">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isAchieved
                          ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]'
                          : 'bg-luma-lime shadow-[0_0_10px_rgba(212,249,56,0.4)]'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono text-luma-text-muted pt-1">
                    <span className={isAchieved ? 'text-emerald-400 font-semibold' : ''}>
                      {wg.completed_units} of {wg.target_units} {wg.unit_label} complete ({progress}%)
                    </span>
                    <span className="text-luma-text-dim text-[11px] flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-luma-text-dim" />
                      <span>{sundayReviewText}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}
    </div>
  );
};
