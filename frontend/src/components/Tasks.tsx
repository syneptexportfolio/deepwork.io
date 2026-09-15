import React, { useState, useMemo } from 'react';
import { Plus, Flame, Sun, Waves, Moon, CheckCircle2, ArrowRight, Trash2, Pencil, RotateCcw, Target, Clock, Sparkles } from 'lucide-react';
import { Habit, Task, WeeklyGoal } from '../services/api';
import { DailyTaskVisualizer } from './visualizers/DailyTaskVisualizer';
import { WeeklyGoalVisualizer } from './visualizers/WeeklyGoalVisualizer';
import { MonthlyHabitVisualizer } from './visualizers/MonthlyHabitVisualizer';

interface TasksProps {
  tasks: Task[];
  habits: Habit[];
  weeklyGoals: WeeklyGoal[];
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
  onToggleStatus: (id: string) => void;
  onAddHabit: () => void;
  onEditHabit: (habit: Habit) => void;
  onCheckHabitStreak: (id: string) => void;
  onDeleteHabit: (id: string) => Promise<void>;
  onAddWeeklyGoal: () => void;
  onEditWeeklyGoal: (goal: WeeklyGoal) => void;
  onDeleteWeeklyGoal: (id: string) => Promise<void>;
  onQuickAddTodo: (title: string) => Promise<void>;
  onIncrementWeeklyGoal: (id: string, currentCompleted: number) => Promise<void>;
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
  onCheckHabitStreak,
  onDeleteHabit,
  onAddWeeklyGoal,
  onEditWeeklyGoal,
  onDeleteWeeklyGoal,
  onQuickAddTodo,
  onIncrementWeeklyGoal,
  onOpenShapeMyDay,
}) => {
  const [activeSection, setActiveSection] = useState<SectionTab>('todos');
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

  const morningTasks = filteredTasks.filter(t => t.column_bucket === 'now' || (t as any).column_bucket === 'morning');
  const afternoonTasks = filteredTasks.filter(t => t.column_bucket === 'up_next' || (t as any).column_bucket === 'afternoon');
  const eveningTasks = filteredTasks.filter(t => t.column_bucket === 'later' || (t as any).column_bucket === 'evening');

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
          <h4 className={`text-sm font-semibold text-white leading-snug ${isDone ? 'line-through opacity-50' : ''}`}>
            {task.title}
          </h4>
          <button
            type="button"
            title={isDone ? 'Mark Pending' : 'Mark Done'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleStatus(task.id);
            }}
            className="text-xs text-luma-text-dim hover:text-luma-lime transition-colors"
          >
            {isDone ? '✓' : '○'}
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
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="text-[11px] font-mono tracking-widest uppercase text-luma-text-dim mb-1">
            Commitments, Not Clutter
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-white tracking-tight mb-2">
            Tasks & Cadence
          </h1>
          <p className="text-sm text-luma-text-muted">
            Manage daily to-dos, monthly habits, and weekly target pacing.
          </p>
        </div>

        {/* Dynamic Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          {onOpenShapeMyDay && (
            <button
              onClick={onOpenShapeMyDay}
              className="flex items-center gap-2 bg-[#202518] hover:bg-[#2b3320] border border-luma-lime/30 text-luma-lime px-4 py-2.5 rounded-xl font-semibold text-sm shadow-sm active:scale-95 transition-all"
            >
              <Sparkles className="w-4 h-4 stroke-[2.2]" />
              <span>Shape my day</span>
            </button>
          )}

          {activeSection === 'todos' && (
            <button
              onClick={onAddTask}
              className="flex items-center gap-2 bg-luma-lime hover:bg-luma-lime-hover text-black px-4 py-2.5 rounded-xl font-semibold text-sm shadow-lime-glow active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add to-do</span>
            </button>
          )}
          {activeSection === 'habits' && (
            <button
              onClick={onAddHabit}
              className="flex items-center gap-2 bg-luma-purple hover:bg-luma-purple-glow text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-purple-glow active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add habit</span>
            </button>
          )}
          {activeSection === 'weekly' && (
            <button
              onClick={onAddWeeklyGoal}
              className="flex items-center gap-2 bg-luma-lime hover:bg-luma-lime-hover text-black px-4 py-2.5 rounded-xl font-semibold text-sm shadow-lime-glow active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>New weekly goal</span>
            </button>
          )}
        </div>
      </div>

      {/* 3-Tier Horizon Switcher */}
      <div className="flex items-center gap-3 border-b border-white/[0.06] pb-4">
        <button
          onClick={() => setActiveSection('todos')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
            activeSection === 'todos'
              ? 'bg-luma-cream text-luma-cream-text shadow-sm'
              : 'text-luma-text-muted hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <span>🟢 Today's To-Dos</span>
          <span className="text-[11px] font-mono opacity-60">({tasks.length})</span>
        </button>

        <button
          onClick={() => setActiveSection('habits')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
            activeSection === 'habits'
              ? 'bg-luma-cream text-luma-cream-text shadow-sm'
              : 'text-luma-text-muted hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <span>🟣 Daily Habits</span>
          <span className="text-[11px] font-mono opacity-60">({habits.length})</span>
        </button>

        <button
          onClick={() => setActiveSection('weekly')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
            activeSection === 'weekly'
              ? 'bg-luma-cream text-luma-cream-text shadow-sm'
              : 'text-luma-text-muted hover:text-white hover:bg-white/[0.03]'
          }`}
        >
          <span>⚡ Weekly Goals</span>
          <span className="text-[11px] font-mono opacity-60">({weeklyGoals.length})</span>
        </button>
      </div>

      {/* SECTION 1: DAILY TO-DOS */}
      {activeSection === 'todos' && (
        <div className="space-y-6">
          {/* Graphical Visualization: Daily Completion Ring & Daylight Velocity */}
          <DailyTaskVisualizer
            tasks={tasks}
            activeFilter={taskFilter}
            onSelectFilter={setTaskFilter}
          />

          {/* Rapid Morning Brain Dump Input Bar */}
          <form onSubmit={handleQuickSubmit} className="flex items-center gap-3">
            <input
              type="text"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="Quick add today's to-do (e.g. Reply to emails 20m) & press Enter..."
              className="flex-1 bg-luma-card border border-luma-card-border focus:border-luma-lime rounded-2xl px-5 py-3 text-sm text-white placeholder:text-luma-text-dim focus:outline-none transition-all shadow-inner"
            />
            <button
              type="submit"
              disabled={isAdding || !quickTitle.trim()}
              className="bg-[#242824] hover:bg-luma-lime hover:text-black text-white px-5 py-3 rounded-2xl text-xs font-semibold transition-all disabled:opacity-40"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

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
          {/* Graphical Visualization: Monthly Habit Consistency & 30-Day Heatmap */}
          <MonthlyHabitVisualizer habits={habits} />
          <div className="bg-luma-card border border-luma-card-border rounded-3xl p-6 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white mb-1">Monthly Habit Routines</h3>
              <p className="text-xs text-luma-text-muted">
                Configured once a month. These repeat automatically and anchor into every daily schedule generated.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-luma-purple bg-luma-purple-dim px-3 py-1.5 rounded-full">
                {habits.filter(h => h.is_active).length} Active Daily
              </span>
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
              <h4 className="text-base font-semibold text-white mb-1">No daily habits configured</h4>
              <p className="text-xs text-luma-text-muted max-w-sm mb-5 leading-relaxed">
                Build consistent momentum by defining recurring morning anchors, deep focus rituals, or evening wind-downs.
              </p>
              <button
                type="button"
                onClick={onAddHabit}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-luma-purple hover:bg-luma-purple-glow text-white text-xs font-semibold shadow-purple-glow transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Add your first habit</span>
              </button>
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
                  className="bg-luma-card border border-luma-card-border hover:border-white/20 rounded-3xl p-6 transition-all relative flex flex-col justify-between cursor-pointer group"
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
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, dIdx) => {
                              const isActiveDay = habit.active_days && habit.active_days.includes(day);
                              return (
                                <span
                                  key={dIdx}
                                  className={`w-5 h-5 rounded-md text-[9px] font-mono flex items-center justify-center font-bold ${
                                    isActiveDay ? 'bg-white/15 text-white' : 'text-white/20'
                                  }`}
                                >
                                  {day}
                                </span>
                              );
                            })}
                          </div>
                          <span className="text-[10px] font-mono text-luma-text-dim">
                            {habit.active_days?.length === 7
                              ? 'Daily'
                              : habit.active_days?.length === 5 && !habit.active_days.includes('S')
                              ? 'Weekdays'
                              : habit.active_days?.length === 2 && habit.active_days.every(d => d === 'S')
                              ? 'Weekends'
                              : `${habit.active_days?.length || 0}d/wk`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/[0.04] flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-mono text-[#f08a5d]">
                      <Flame className="w-4 h-4 fill-[#f08a5d]" />
                      <span>{habit.streak_count} day streak</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCheckHabitStreak(habit.id);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                        isCompletedToday
                          ? 'bg-luma-lime/20 border border-luma-lime/40 text-luma-lime hover:bg-luma-lime/30 shadow-sm'
                          : 'bg-[#222522] hover:bg-luma-lime hover:text-black text-luma-lime'
                      }`}
                      title={isCompletedToday ? 'Completed today! Click to toggle off' : 'Mark completed for today (+1 Streak)'}
                    >
                      <CheckCircle2 className={`w-3.5 h-3.5 ${isCompletedToday ? 'fill-luma-lime text-black' : ''}`} />
                      <span>{isCompletedToday ? 'Done Today' : '+1 Today'}</span>
                    </button>
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
          {/* Graphical Visualization: Weekly Velocity & Pacing Trajectory */}
          <WeeklyGoalVisualizer
            weeklyGoals={weeklyGoals}
            activeCategoryFilter={weeklyCategoryFilter}
            onSelectCategoryFilter={setWeeklyCategoryFilter}
          />
          <div className="bg-luma-card border border-luma-card-border rounded-3xl p-6 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white mb-1">Weekly Target Goals</h3>
              <p className="text-xs text-luma-text-muted">
                Set once a week. The timetable scheduler allocates daily deep blocks based on your remaining days & pace deficit.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-luma-lime bg-[#212b10] px-3 py-1.5 rounded-full">
                Current Week Active
              </span>
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
              <button
                type="button"
                onClick={onAddWeeklyGoal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-luma-lime hover:bg-luma-lime-hover text-black text-xs font-semibold shadow-lime-glow transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>New weekly goal</span>
              </button>
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

              return (
                <div
                  key={wg.id}
                  onClick={() => onEditWeeklyGoal(wg)}
                  className="bg-luma-card border border-luma-card-border hover:border-white/20 rounded-3xl p-6 transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-md border tracking-wider uppercase ${badgeStyle.color}`}>
                          {badgeStyle.label}
                        </span>
                        <span className="text-[10px] font-mono tracking-wider uppercase text-luma-text-dim">
                          {wg.priority} PRIORITY · {wg.energy_level === 'deep_focus' ? 'DEEP WORK' : 'LIGHT'}
                        </span>
                      </div>
                      <h4 className="text-base font-semibold text-white group-hover:text-luma-lime transition-colors">
                        {wg.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onIncrementWeeklyGoal(wg.id, wg.completed_units);
                        }}
                        className="text-xs font-mono bg-luma-lime/10 hover:bg-luma-lime hover:text-black text-luma-lime px-3 py-1.5 rounded-xl transition-all font-medium"
                      >
                        +1 {wg.unit_label}
                      </button>

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
                      className="h-full bg-luma-lime shadow-[0_0_10px_rgba(212,249,56,0.4)] rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono text-luma-text-muted pt-1">
                    <span>
                      {wg.completed_units} of {wg.target_units} {wg.unit_label} complete ({progress}%)
                    </span>
                    <span className="text-white font-medium">
                      Pacing: {wg.unitsPerDay || 1.0} / day
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
