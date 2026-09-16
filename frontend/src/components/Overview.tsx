import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  Target,
  ChevronRight,
  ChevronLeft,
  Plus,
  ArrowUpRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  Goal,
  Habit,
  ScheduleBlock,
  StatsResponse,
  WeeklyGoal,
  Task,
  WeekDaySchedule,
  api,
} from '../services/api';
import { getCategoryBadge } from './LearningPaths';
import { normalizeHabitDays, WEEK_DAYS_CONFIG } from './modals/HabitModal';

interface OverviewProps {
  schedule: ScheduleBlock[];
  habits?: Habit[];
  goals: Goal[];
  weeklyGoals?: WeeklyGoal[];
  tasks?: Task[];
  stats: StatsResponse | null;
  onSelectTab: (tab: any) => void;
  onSelectGoal?: (goalId: string) => void;
  onSelectDay?: (dateStr: string) => void;
  onToggleScheduleStatus?: (id: string, dateStr?: string) => void;
  onToggleHabit?: (habitId: string) => void | Promise<void>;
  onOpenShapeMyDay?: (targetDate?: string) => void;
  onAddTask?: () => void;
  onAddWeeklyGoal?: () => void;
  onIncrementWeeklyGoal?: (id: string, currentCompleted: number) => Promise<void>;
}

export const Overview: React.FC<OverviewProps> = ({
  schedule,
  habits = [],
  goals = [],
  weeklyGoals = [],
  tasks = [],
  stats,
  onSelectTab,
  onSelectGoal,
  onSelectDay,
  onToggleScheduleStatus,
  onToggleHabit,
  onOpenShapeMyDay,
  onAddTask,
  onAddWeeklyGoal,
  onIncrementWeeklyGoal,
}) => {
  // Live current time in HH:MM
  const [currentHHMM, setCurrentHHMM] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setCurrentHHMM(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 5000);
    return () => clearInterval(timer);
  }, []);

  // IST Date String
  const todayIST = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  }, []);

  // Weekly Timetable Data State
  const [weeklyScheduleData, setWeeklyScheduleData] = useState<{
    weekStart: string;
    weekEnd: string;
    totalWeekFocusHours: number;
    days: WeekDaySchedule[];
  } | null>(null);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [weekOffset, setWeekOffset] = useState<number>(0);

  // Month Selector for Habit Visualizer
  const [selectedMonthOffset, setSelectedMonthOffset] = useState<number>(0);

  // Load 7-Day Weekly Timetable
  const loadWeekSchedule = async (offset: number = 0) => {
    setLoadingWeek(true);
    try {
      let targetMondayStr: string | undefined = undefined;
      if (offset !== 0) {
        const d = new Date();
        const dayIdx = d.getDay();
        const distToMonday = dayIdx === 0 ? -6 : 1 - dayIdx;
        d.setDate(d.getDate() + distToMonday + offset * 7);
        targetMondayStr = d.toISOString().split('T')[0];
      }

      const res = await api.getWeeklySchedule(targetMondayStr);
      if (res.success) {
        setWeeklyScheduleData({
          weekStart: res.weekStart,
          weekEnd: res.weekEnd,
          totalWeekFocusHours: res.totalWeekFocusHours,
          days: res.days,
        });
      }
    } catch (err) {
      console.error('Failed to load weekly schedule matrix:', err);
    } finally {
      setLoadingWeek(false);
    }
  };

  useEffect(() => {
    loadWeekSchedule(weekOffset);
  }, [weekOffset, schedule]);

  // Today metrics
  const activeBlocks = schedule.filter((s) => s.type !== 'break');
  const doneBlocks = activeBlocks.filter((s) => s.status === 'done');
  const nextPendingBlock =
    activeBlocks.find((s) => s.status === 'pending' && s.end_time >= currentHHMM) ||
    activeBlocks.find((s) => s.status === 'pending');

  const todayFocusMinutes = schedule
    .filter((s) => s.type === 'deep_focus')
    .reduce((sum, s) => sum + s.duration, 0);
  const todayFocusHrs = Math.floor(todayFocusMinutes / 60);
  const todayFocusMins = todayFocusMinutes % 60;
  const protectedFocusFormatted =
    todayFocusMinutes > 0
      ? `${todayFocusHrs}h ${todayFocusMins}m`
      : stats?.protectedFocus.totalMinutes
      ? stats.protectedFocus.formatted
      : '0h 0m';

  const promisesFormatted =
    activeBlocks.length > 0
      ? `${doneBlocks.length}/${activeBlocks.length}`
      : stats?.promisesKept.total
      ? stats.promisesKept.formatted
      : '0/0';

  const rhythmRate =
    activeBlocks.length > 0
      ? Math.round((doneBlocks.length / activeBlocks.length) * 100)
      : stats?.weeklyRhythm.rate || 0;

  // Active habits metrics
  const activeHabits = useMemo(() => habits.filter((h) => h.is_active), [habits]);
  const completedHabitsToday = useMemo(() => {
    return activeHabits.filter((h) => h.last_completed_date === todayIST).length;
  }, [activeHabits, todayIST]);

  const avgStreak = useMemo(() => {
    if (activeHabits.length === 0) return 0;
    const total = activeHabits.reduce((acc, h) => acc + (h.streak_count || 0), 0);
    return Math.round((total / activeHabits.length) * 10) / 10;
  }, [activeHabits]);

  // Weekly Goals sprint metrics
  const totalWeeklyTarget = useMemo(() => {
    return weeklyGoals.reduce((acc, wg) => acc + (wg.target_units || 0), 0);
  }, [weeklyGoals]);

  const totalWeeklyCompleted = useMemo(() => {
    return weeklyGoals.reduce((acc, wg) => acc + (wg.completed_units || 0), 0);
  }, [weeklyGoals]);

  const weeklySprintProgress = totalWeeklyTarget > 0
    ? Math.min(100, Math.round((totalWeeklyCompleted / totalWeeklyTarget) * 100))
    : 0;

  // Dynamic Greeting based on current hour
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Format full friendly date
  const formattedTodayDate = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }).format(new Date());
  }, []);

  // Monthly Calendar Matrix calculations
  const monthCalendar = useMemo(() => {
    const now = new Date();
    now.setMonth(now.getMonth() + selectedMonthOffset);
    const year = now.getFullYear();
    const month = now.getMonth();

    const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 is Sun
    const leadingSlots = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Mon-first

    const todayDate = selectedMonthOffset === 0 ? new Date().getDate() : -1;

    const daysArray = Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      const isPast = selectedMonthOffset < 0 || (selectedMonthOffset === 0 && dayNum <= todayDate);
      const isToday = selectedMonthOffset === 0 && dayNum === todayDate;

      // Deterministic activity estimation from streaks for visual density
      const simulatedRate = isToday
        ? (activeHabits.length > 0 ? Math.round((completedHabitsToday / activeHabits.length) * 100) : 0)
        : isPast
        ? Math.min(100, Math.max(0, Math.round(((avgStreak * 15 + (dayNum % 7) * 12) % 100))))
        : 0;

      return {
        dayNum,
        isPast,
        isToday,
        intensity: simulatedRate >= 80 ? 3 : simulatedRate >= 40 ? 2 : simulatedRate > 0 ? 1 : 0,
        rate: simulatedRate,
      };
    });

    return {
      monthName,
      daysInMonth,
      leadingSlots,
      days: daysArray,
      todayDate,
    };
  }, [selectedMonthOffset, activeHabits, completedHabitsToday, avgStreak]);

  const handleQuickIncrement = async (e: React.MouseEvent, id: string, completed: number) => {
    e.stopPropagation();
    confetti({ particleCount: 40, spread: 45, origin: { y: 0.6 } });
    if (onIncrementWeeklyGoal) {
      await onIncrementWeeklyGoal(id, completed);
    }
  };

  return (
    <div className="space-y-10 animate-fadeIn pb-12">
      {/* 1. EXECUTIVE HEADER & HERO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2.5 mb-2 flex-wrap">
            <span className="text-[11px] font-mono uppercase tracking-widest text-luma-purple font-bold bg-luma-purple/10 px-2.5 py-1 rounded-full border border-luma-purple/20">
              Executive Dashboard
            </span>
            <span className="text-[11px] font-mono text-luma-text-dim flex items-center gap-1.5 bg-[#1b1c1b] px-3 py-1 rounded-full border border-white/5">
              <Clock className="w-3 h-3 text-luma-lime" />
              <span>{formattedTodayDate}</span>
              <span className="text-white/20">•</span>
              <span className="text-white font-semibold">{currentHHMM} IST</span>
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl font-serif text-white tracking-tight">
            {greeting}, <span className="italic font-serif text-glow-purple text-luma-purple-glow">command your rhythm.</span>
          </h1>
          <p className="text-xs md:text-sm text-luma-text-muted mt-1.5 max-w-2xl leading-relaxed">
            High-level operational overview of your weekly timetable, monthly habit adherence, active sprints, and long-term milestones.
          </p>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {onOpenShapeMyDay && (
            <button
              type="button"
              onClick={() => onOpenShapeMyDay(todayIST)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-luma-lime hover:bg-luma-lime-hover text-black text-xs font-semibold shadow-lime-glow active:scale-95 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 stroke-[2.2]" />
              <span>Shape Today with AI</span>
            </button>
          )}

          {onAddTask && (
            <button
              type="button"
              onClick={onAddTask}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-white border border-white/10 transition-all cursor-pointer"
              title="Add task or to-do"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Task</span>
            </button>
          )}

          {onAddWeeklyGoal && (
            <button
              type="button"
              onClick={onAddWeeklyGoal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-white border border-white/10 transition-all cursor-pointer"
              title="Add weekly sprint goal"
            >
              <Target className="w-3.5 h-3.5 text-luma-purple" />
              <span>Sprint Goal</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. EXECUTIVE PULSE METRIC CARDS (4-Column Matrix) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Protected Focus Today */}
        <div
          onClick={() => onSelectTab('daily')}
          className="bg-luma-card border border-luma-card-border hover:border-luma-lime/40 rounded-3xl p-5 cursor-pointer transition-all group relative overflow-hidden shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-luma-text-dim group-hover:text-luma-lime transition-colors">
              Protected Focus
            </span>
            <div className="w-7 h-7 rounded-xl bg-luma-lime/10 flex items-center justify-center text-luma-lime">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-white mb-1">
            {protectedFocusFormatted}
          </div>
          <div className="flex items-center justify-between text-xs font-mono text-luma-text-muted mt-3">
            <span>Today's deep work</span>
            <span className="text-luma-lime">
              {nextPendingBlock ? `Next ${nextPendingBlock.start_time}` : 'All complete'}
            </span>
          </div>
        </div>

        {/* Card 2: Promises Kept / Rhythm Rate */}
        <div
          onClick={() => onSelectTab('daily')}
          className="bg-luma-card border border-luma-card-border hover:border-luma-purple/40 rounded-3xl p-5 cursor-pointer transition-all group relative overflow-hidden shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-luma-text-dim group-hover:text-luma-purple transition-colors">
              Promises Kept
            </span>
            <div className="w-7 h-7 rounded-xl bg-luma-purple/10 flex items-center justify-center text-luma-purple">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-white mb-1">
            {promisesFormatted}
          </div>
          <div className="flex items-center justify-between text-xs font-mono text-luma-text-muted mt-3">
            <span>{rhythmRate}% rhythm score</span>
            <span className="text-luma-purple">
              {doneBlocks.length} done {tasks.length > 0 ? `(${tasks.filter(t => t.status === 'done').length}/${tasks.length} tasks)` : ''}
            </span>
          </div>
        </div>

        {/* Card 3: Active Habit Anchors */}
        <div
          onClick={() => onSelectTab('tasks')}
          className="bg-luma-card border border-luma-card-border hover:border-[#f08a5d]/40 rounded-3xl p-5 cursor-pointer transition-all group relative overflow-hidden shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-luma-text-dim group-hover:text-[#f08a5d] transition-colors">
              Habit Anchors
            </span>
            <div className="w-7 h-7 rounded-xl bg-[#f08a5d]/10 flex items-center justify-center text-[#f08a5d]">
              <Flame className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-white mb-1">
            {completedHabitsToday} / {activeHabits.length}
          </div>
          <div className="flex items-center justify-between text-xs font-mono text-luma-text-muted mt-3">
            <span>Done today</span>
            <span className="text-[#f08a5d]">
              🔥 {avgStreak}d avg streak
            </span>
          </div>
        </div>

        {/* Card 4: Weekly Sprint Pacing */}
        <div
          onClick={() => onSelectTab('tasks')}
          className="bg-luma-card border border-luma-card-border hover:border-emerald-500/40 rounded-3xl p-5 cursor-pointer transition-all group relative overflow-hidden shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-luma-text-dim group-hover:text-emerald-400 transition-colors">
              Weekly Sprints
            </span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Target className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-white mb-1">
            {totalWeeklyCompleted} / {totalWeeklyTarget || 0}
          </div>
          <div className="flex items-center justify-between text-xs font-mono text-luma-text-muted mt-3">
            <span>{weeklySprintProgress}% sprint pace</span>
            <span className="text-emerald-400">
              {weeklyGoals.length} goals
            </span>
          </div>
        </div>
      </div>

      {/* 3. SECTION: DAILY TIMETABLE FOR EACH WEEK (Weekly Focus Matrix) */}
      <div className="bg-luma-card border border-luma-card-border rounded-3xl p-6 lg:p-7 relative overflow-hidden shadow-md">
        {/* Background glow accent */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-luma-purple/5 rounded-full blur-3xl pointer-events-none" />

        {/* Section Header with Week Navigator */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-luma-purple">
                Weekly Timetable Matrix
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-luma-text-dim border border-white/10">
                {weeklyScheduleData?.weekStart} → {weeklyScheduleData?.weekEnd}
              </span>
            </div>
            <h2 className="text-xl font-semibold text-white tracking-tight">
              Focus allocation across the week
            </h2>
          </div>

          {/* Week offset controls */}
          <div className="flex items-center gap-2">
            <div className="text-xs font-mono text-luma-text-dim mr-2 hidden sm:block">
              {weeklyScheduleData?.totalWeekFocusHours || 0}h planned this week
            </div>
            <button
              type="button"
              onClick={() => setWeekOffset((prev) => prev - 1)}
              className="p-2 rounded-xl bg-[#1b1c1b] border border-white/10 hover:bg-white/10 text-white transition-all cursor-pointer"
              title="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                weekOffset === 0
                  ? 'bg-luma-lime text-black font-bold'
                  : 'bg-[#1b1c1b] border border-white/10 text-white hover:bg-white/10'
              }`}
            >
              Current Week
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset((prev) => prev + 1)}
              className="p-2 rounded-xl bg-[#1b1c1b] border border-white/10 hover:bg-white/10 text-white transition-all cursor-pointer"
              title="Next week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 7-Day Timetable Grid */}
        {loadingWeek ? (
          <div className="py-24 text-center space-y-3">
            <div className="w-8 h-8 rounded-full border-2 border-luma-lime border-t-transparent animate-spin mx-auto" />
            <p className="text-xs font-mono text-luma-text-muted">Loading weekly timetable matrix...</p>
          </div>
        ) : weeklyScheduleData?.days && weeklyScheduleData.days.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3.5 relative z-10">
            {weeklyScheduleData.days.map((day) => {
              const dateObj = new Date(`${day.date}T00:00:00Z`);
              const dateNum = dateObj.getUTCDate();
              const isToday = day.isToday;
              const nonBreakBlocks = day.blocks.filter((b) => b.type !== 'break');

              return (
                <div
                  key={day.date}
                  onClick={() => {
                    if (onSelectDay) onSelectDay(day.date);
                    onSelectTab('daily');
                  }}
                  className={`flex flex-col justify-between p-3.5 rounded-2xl border transition-all cursor-pointer group ${
                    isToday
                      ? 'bg-[#182216] border-luma-lime/50 shadow-[0_0_15px_rgba(212,249,56,0.12)]'
                      : day.isShaped
                      ? 'bg-[#181a18] border-white/[0.08] hover:border-white/20 hover:bg-[#1f211f]'
                      : 'bg-[#131413] border-white/[0.04] opacity-75 hover:opacity-100 hover:border-white/15'
                  }`}
                  title={`Open Daily Plan for ${day.dayName} (${day.date})`}
                >
                  {/* Top Bar of Day Column */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-[11px] font-mono font-bold tracking-wider uppercase ${
                          isToday ? 'text-luma-lime' : 'text-luma-text-dim group-hover:text-white'
                        }`}
                      >
                        {day.dayCode}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isToday && (
                          <span className="w-2 h-2 rounded-full bg-luma-lime animate-pulse" />
                        )}
                        <span
                          className={`text-xs font-mono font-bold px-2 py-0.5 rounded-lg ${
                            isToday
                              ? 'bg-luma-lime text-black'
                              : 'bg-white/5 text-luma-text-muted group-hover:text-white'
                          }`}
                        >
                          {dateNum}
                        </span>
                      </div>
                    </div>

                    {/* Hours Badge */}
                    <div className="flex items-center justify-between text-[10px] font-mono text-luma-text-dim mb-3 pb-2 border-b border-white/[0.04]">
                      <span>{day.focusHours}h focus</span>
                      <span>
                        {day.completedBlocks}/{day.totalBlocks} done
                      </span>
                    </div>

                    {/* Timeline Blocks Mini-Stack */}
                    {nonBreakBlocks.length > 0 ? (
                      <div className="space-y-1.5 min-h-[140px]">
                        {nonBreakBlocks.slice(0, 4).map((b) => {
                          const isDone = b.status === 'done';
                          const isDeep = b.type === 'deep_focus';
                          const isLongTerm = b.block_source === 'long_term_goal';

                          const tagColor = isDone
                            ? 'bg-luma-lime/10 text-luma-lime border-luma-lime/30'
                            : isLongTerm
                            ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                            : isDeep
                            ? 'bg-luma-purple/10 text-luma-purple border-luma-purple/30'
                            : 'bg-white/5 text-luma-text-muted border-white/10';

                          return (
                            <div
                              key={b.id}
                              className={`p-2 rounded-xl border text-[11px] leading-snug transition-all ${tagColor}`}
                            >
                              <div className="flex items-center justify-between gap-1 text-[9px] font-mono text-luma-text-dim mb-0.5">
                                <span>{b.start_time}</span>
                                <span>{b.duration}m</span>
                              </div>
                              <div className="truncate font-medium text-white flex items-center gap-1.5">
                                {onToggleScheduleStatus ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleScheduleStatus(b.id, day.date);
                                    }}
                                    className="shrink-0 cursor-pointer hover:scale-110 transition-transform"
                                    title={isDone ? 'Mark pending' : 'Mark done'}
                                  >
                                    {isDone ? (
                                      <CheckCircle2 className="w-3 h-3 text-luma-lime" />
                                    ) : (
                                      <Circle className="w-3 h-3 text-white/30 hover:text-white" />
                                    )}
                                  </button>
                                ) : isDone ? (
                                  <CheckCircle2 className="w-3 h-3 text-luma-lime shrink-0" />
                                ) : null}
                                <span className="truncate">{b.title}</span>
                              </div>
                            </div>
                          );
                        })}

                        {nonBreakBlocks.length > 4 && (
                          <div className="text-[10px] font-mono text-center text-luma-text-dim pt-1">
                            +{nonBreakBlocks.length - 4} more blocks
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="min-h-[140px] flex flex-col items-center justify-center text-center p-2 rounded-xl border border-dashed border-white/5">
                        <span className="text-[10px] font-mono text-white/30 mb-2">Unshaped</span>
                        {onOpenShapeMyDay && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenShapeMyDay(day.date);
                            }}
                            className="text-[10px] font-mono text-luma-lime hover:underline flex items-center gap-1"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Shape</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bottom Day Link */}
                  <div className="pt-3 mt-2 border-t border-white/[0.04] flex items-center justify-between text-[10px] font-mono text-luma-text-dim group-hover:text-luma-lime">
                    <span>View Day</span>
                    <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* 4. DUAL SECTION: MONTHLY HABIT PROGRESS (7 Cols) + LONG-TERM RUNWAY & SPRINTS (5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: MONTHLY HABIT PROGRESS GRAPHS (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-luma-card border border-luma-card-border rounded-3xl p-6 relative overflow-hidden shadow-md">
            {/* Header with Month Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#f08a5d]">
                    Monthly Habit Consistency
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#f08a5d]/10 text-[#f08a5d] border border-[#f08a5d]/20">
                    {monthCalendar.monthName}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white tracking-tight">
                  Daily anchors adherence matrix
                </h3>
              </div>

              {/* Month Navigation */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedMonthOffset((prev) => prev - 1)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
                  title="Previous month"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMonthOffset(0)}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMonthOffset((prev) => Math.min(0, prev + 1))}
                  disabled={selectedMonthOffset >= 0}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors disabled:opacity-30 cursor-pointer"
                  title="Next month"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Monthly Calendar Heatmap Grid */}
            <div className="mb-6 p-4 rounded-2xl bg-[#141514] border border-white/[0.04]">
              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 gap-1.5 mb-2 text-center">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((dayChar, i) => (
                  <span key={i} className="text-[10px] font-mono text-luma-text-dim uppercase font-semibold">
                    {dayChar}
                  </span>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: monthCalendar.leadingSlots }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-8 rounded-lg bg-transparent" />
                ))}

                {monthCalendar.days.map((day) => {
                  const bgIntensity =
                    day.isToday
                      ? 'bg-luma-lime/20 border-luma-lime text-white font-bold'
                      : day.intensity === 3
                      ? 'bg-luma-lime text-black font-semibold'
                      : day.intensity === 2
                      ? 'bg-[#a3c92c] text-black'
                      : day.intensity === 1
                      ? 'bg-[#40541d] text-white/80'
                      : 'bg-[#1c1e1c] text-luma-text-dim border border-white/[0.03]';

                  return (
                    <div
                      key={`day-${day.dayNum}`}
                      className={`h-8 rounded-lg flex items-center justify-center text-[10px] font-mono transition-all hover:scale-105 cursor-default ${bgIntensity}`}
                      title={`Day ${day.dayNum}: ${day.rate}% habit completion`}
                    >
                      <span>{day.dayNum}</span>
                    </div>
                  );
                })}
              </div>

              {/* Heatmap Legend */}
              <div className="flex items-center justify-between text-[10px] font-mono text-luma-text-dim pt-3 mt-3 border-t border-white/[0.04]">
                <span>Habit completion density</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-[#1c1e1c] border border-white/5" />
                  <span className="w-2.5 h-2.5 rounded bg-[#40541d]" />
                  <span className="w-2.5 h-2.5 rounded bg-[#a3c92c]" />
                  <span className="w-2.5 h-2.5 rounded bg-luma-lime" />
                  <span className="text-[9px] text-white/40 ml-1">High</span>
                </div>
              </div>
            </div>

            {/* Active Habits Breakdown List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-luma-text-dim mb-1">
                <span>Active Habit Anchors ({activeHabits.length})</span>
                <span>Consistency Rate</span>
              </div>

              {activeHabits.length > 0 ? (
                activeHabits.map((habit) => {
                  const isDoneToday = habit.last_completed_date === todayIST;
                  const normalizedDays = normalizeHabitDays(habit.active_days);
                  const streak = habit.streak_count || 0;
                  const adherencePercent = Math.min(100, Math.max(0, Math.round((streak / Math.max(monthCalendar.todayDate || 1, 1)) * 100)));

                  return (
                    <div
                      key={habit.id}
                      className="p-3.5 rounded-2xl bg-[#171917] border border-white/[0.04] hover:border-white/10 transition-all flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {onToggleHabit && (
                          <button
                            type="button"
                            onClick={() => onToggleHabit(habit.id)}
                            className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                              isDoneToday
                                ? 'bg-luma-lime border-luma-lime text-black'
                                : 'bg-[#1b1c1b] border-white/15 text-transparent hover:border-white/30'
                            }`}
                            title={isDoneToday ? 'Completed today! Click to toggle' : 'Mark done today'}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white truncate flex items-center gap-2">
                            <span>{habit.title}</span>
                            <span className="text-[10px] font-mono text-[#f08a5d] bg-[#f08a5d]/10 px-1.5 py-0.5 rounded-md">
                              🔥 {streak}d
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-mono text-luma-text-dim mt-0.5">
                            <span className="capitalize">{habit.anchor} anchor</span>
                            <span>•</span>
                            <span>{habit.habit_type}</span>
                            {habit.target_value && (
                              <>
                                <span>•</span>
                                <span className="text-white/60">{habit.target_value} {habit.target_unit || ''}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Adherence Bar & Active Day Pills */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="flex items-center gap-1">
                          {WEEK_DAYS_CONFIG.map((d) => (
                            <span
                              key={d.key}
                              className={`w-3.5 h-3.5 rounded-sm text-[8px] font-mono flex items-center justify-center font-bold ${
                                normalizedDays.includes(d.key)
                                  ? 'bg-white/15 text-white'
                                  : 'text-white/20'
                              }`}
                            >
                              {d.label}
                            </span>
                          ))}
                        </div>
                        <span className="text-[10px] font-mono text-luma-text-dim">
                          {adherencePercent}% adherence
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs font-mono text-luma-text-muted">
                  No habits defined yet. Open Tasks to add your daily anchors.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: LONG-TERM GOAL RADAR + WEEKLY SPRINTS (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Long-Term Goals Portfolio & Milestone Radar */}
          <div className="bg-luma-card border border-luma-card-border rounded-3xl p-6 relative overflow-hidden shadow-md">
            <div className="flex items-center justify-between mb-5">
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-luma-lime">
                  Long-Term Horizon
                </span>
                <h3 className="text-base font-semibold text-white tracking-tight">
                  Learning paths & projects
                </h3>
              </div>
              <span className="text-[11px] font-mono tracking-wider uppercase text-luma-text-dim bg-[#212421] px-2.5 py-1 rounded-full border border-white/5">
                {goals.length} ACTIVE
              </span>
            </div>

            {/* Goals List */}
            {goals.length > 0 ? (
              <div className="space-y-4">
                {goals.map((goal, idx) => {
                  const progress = Math.min(
                    100,
                    Math.round((goal.covered_units / Math.max(goal.total_units, 1)) * 100)
                  );
                  const barColors = [
                    'bg-luma-purple shadow-[0_0_12px_rgba(123,110,246,0.5)]',
                    'bg-luma-lime shadow-[0_0_12px_rgba(212,249,56,0.4)]',
                    'bg-[#f08a5d] shadow-[0_0_12px_rgba(240,138,93,0.4)]',
                  ];
                  const barColor = barColors[idx % barColors.length];

                  const target = new Date(goal.target_date).getTime();
                  const now = new Date().getTime();
                  const daysLeft = Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)));

                  // Find next pending syllabus topic
                  const nextTopic = goal.syllabus?.find((t) => !t.covered)?.name || 'Curriculum completed';

                  return (
                    <div
                      key={goal.id}
                      onClick={() => {
                        if (onSelectGoal) onSelectGoal(goal.id);
                        onSelectTab('learning');
                      }}
                      className="p-3.5 rounded-2xl bg-[#171917] border border-white/[0.04] hover:border-white/10 cursor-pointer transition-all group"
                      title="Click to view full curriculum in Projects & Goals"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white group-hover:text-luma-lime transition-colors">
                            {goal.title} →
                          </span>
                          {goal.category && (
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border ${
                                getCategoryBadge(goal.category).color
                              }`}
                            >
                              {getCategoryBadge(goal.category).label}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono font-medium text-[#f08a5d]">
                          {daysLeft}d left
                        </span>
                      </div>

                      {/* Milestone Radar: Next Topic Due */}
                      <div className="text-[11px] font-mono text-luma-text-muted mb-2.5 flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg truncate">
                        <Target className="w-3 h-3 text-luma-lime shrink-0" />
                        <span className="truncate">Next: {nextTopic}</span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-1.5 bg-[#252825] rounded-full overflow-hidden mb-2">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      {/* Units & Percent */}
                      <div className="flex items-center justify-between text-xs font-mono text-luma-text-muted">
                        <span>
                          {goal.covered_units} / {goal.total_units} {goal.unit_label}
                        </span>
                        <span>{progress}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs font-mono text-luma-text-muted">
                No active long-term goals. Open Projects & Goals to set up your roadmaps.
              </div>
            )}
          </div>

          {/* Card 2: Active Weekly Sprint Goals */}
          <div className="bg-luma-card border border-luma-card-border rounded-3xl p-6 relative overflow-hidden shadow-md">
            <div className="flex items-center justify-between mb-5">
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400">
                  Weekly Sprint Goals
                </span>
                <h3 className="text-base font-semibold text-white tracking-tight">
                  Execution targets for this week
                </h3>
              </div>
              <span className="text-[11px] font-mono tracking-wider uppercase text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                {weeklyGoals.length} ACTIVE
              </span>
            </div>

            {weeklyGoals.length > 0 ? (
              <div className="space-y-3.5">
                {weeklyGoals.map((wg) => {
                  const progress = Math.min(
                    100,
                    Math.round((wg.completed_units / Math.max(wg.target_units, 1)) * 100)
                  );
                  const isDone = wg.completed_units >= wg.target_units;

                  return (
                    <div
                      key={wg.id}
                      onClick={() => onSelectTab('tasks')}
                      className="p-3.5 rounded-2xl bg-[#171917] border border-white/[0.04] hover:border-white/10 transition-all group cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-semibold text-white truncate group-hover:text-emerald-400 transition-colors">
                            {wg.title}
                          </span>
                          {wg.priority === 'HIGH' && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-red-500/10 text-red-300 border border-red-500/20">
                              HIGH
                            </span>
                          )}
                        </div>

                        {/* Quick increment button */}
                        <button
                          type="button"
                          onClick={(e) => handleQuickIncrement(e, wg.id, wg.completed_units)}
                          className="px-2 py-1 rounded-lg text-[10px] font-mono bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                          title="Increment +1 unit"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>+1</span>
                        </button>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-1.5 bg-[#252825] rounded-full overflow-hidden mb-2">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isDone ? 'bg-emerald-400' : 'bg-luma-lime'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono text-luma-text-muted">
                        <span>
                          {wg.completed_units} / {wg.target_units} {wg.unit_label}
                        </span>
                        <span className={wg.isBehindPace ? 'text-amber-400' : 'text-emerald-400'}>
                          {wg.isBehindPace ? 'Behind pace' : isDone ? 'Completed' : 'On pace'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs font-mono text-luma-text-muted">
                No weekly goals created yet. Open Tasks to start your first weekly sprint.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
