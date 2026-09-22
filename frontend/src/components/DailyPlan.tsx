import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Circle,
  Play,
  Sparkles,
  Calendar,
  Briefcase,
  History,
  Compass,
  Target,
  Zap,
  Flame,
  Sun,
  Moon,
  Waves,
  Plus,
  Minus,
  Coffee,
} from 'lucide-react';
import { api, Habit, WeeklyGoal, ScheduleBlock, isTimeWithinBlock, Goal, Task, getTimeBucket, isBreakOrRestBlock } from '../services/api';
import { getCategoryBadge } from './LearningPaths';
import { AddTimelineTaskModal, insertAndReflowSchedule } from './modals/AddTimelineTaskModal';

type DayCode = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

const dayNames: DayCode[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const fullDayNames: Record<DayCode, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday',
};

export interface WeekDayItem {
  day: DayCode;
  date: string;
  dateStr: string; // YYYY-MM-DD
  isToday: boolean;
  hasDot: boolean;
  fullDate: Date;
}

// Compute dynamic current week starting from Monday
export const computeCurrentWeekDays = (_activeDates: string[] = []): WeekDayItem[] => {
  const now = new Date();
  const dayIdx = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const distToMonday = dayIdx === 0 ? -6 : 1 - dayIdx;
  const monday = new Date(now);
  monday.setDate(now.getDate() + distToMonday);

  return dayNames.map((code, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);
    const dateNum = String(d.getDate()).padStart(2, '0');

    // Format local YYYY-MM-DD
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const isToday = d.toDateString() === now.toDateString();
    const hasDot = isToday;

    return {
      day: code,
      date: dateNum,
      dateStr,
      isToday,
      hasDot,
      fullDate: d,
    };
  });
};

interface DailyPlanProps {
  schedule: ScheduleBlock[];
  habits?: Habit[];
  weeklyGoals?: WeeklyGoal[];
  goals?: Goal[];
  tasks?: Task[];
  onToggleStatus: (id: string, dateStr?: string) => void;
  onToggleHabit?: (habitId: string) => void | Promise<void>;
  onStartFocus: (taskTitle: string, durationMinutes: number, blockId?: string) => void;
  onAdjustCapacity: () => void;
  onOpenShapeMyDay?: (targetDate?: string) => void;
  onSelectGoal?: (goalId: string) => void;
  onSelectTab?: (tab: any) => void;
  onUpdateWeeklyGoalProgress?: (id: string, newUnits: number) => Promise<void> | void;
  initialDateStr?: string;
  onTaskCreated?: (task: Task) => void;
  onScheduleUpdated?: (newSchedule: ScheduleBlock[], dateStr: string) => void;
}

export const DailyPlan: React.FC<DailyPlanProps> = ({
  schedule,
  habits = [],
  weeklyGoals = [],
  goals = [],
  tasks = [],
  onToggleStatus,
  onToggleHabit,
  onStartFocus,
  onAdjustCapacity,
  onOpenShapeMyDay,
  onSelectGoal,
  onSelectTab,
  onUpdateWeeklyGoalProgress,
  initialDateStr,
  onTaskCreated,
  onScheduleUpdated,
}) => {
  const savedWorkHours = useMemo(() => {
    try {
      const raw = localStorage.getItem('luma_default_work_hours');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  // Today in IST
  const todayDateStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  }, []);

  // Date selection state
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => initialDateStr || todayDateStr);

  type HorizonTab = 'anchors' | 'weekly' | 'long';
  const [activeHorizonTab, setActiveHorizonTab] = useState<HorizonTab>('anchors');
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);

  const activeHabits = useMemo(() => habits.filter(h => h.is_active), [habits]);
  const completedHabitsCount = useMemo(() => {
    return activeHabits.filter(h => h.last_completed_date === todayDateStr).length;
  }, [activeHabits, todayDateStr]);
  const habitProgressPercent = activeHabits.length > 0
    ? Math.round((completedHabitsCount / activeHabits.length) * 100)
    : 0;

  useEffect(() => {
    if (initialDateStr) {
      setSelectedDateStr(initialDateStr);
    }
  }, [initialDateStr]);

  const [scheduleMap, setScheduleMap] = useState<Record<string, ScheduleBlock[]>>({});
  const [activeDates, setActiveDates] = useState<string[]>([]);
  const [loadingDay, setLoadingDay] = useState(false);

  // Sync today's schedule from prop into scheduleMap whenever schedule prop updates
  useEffect(() => {
    if (schedule && schedule.length > 0) {
      setScheduleMap(prev => ({
        ...prev,
        [todayDateStr]: schedule,
      }));
    }
  }, [schedule, todayDateStr]);

  // Load active dates from backend once on mount
  const loadActiveDates = async () => {
    try {
      const res = await api.getActiveScheduleDates();
      if (res.dates) {
        setActiveDates(res.dates);
      }
    } catch {}
  };

  useEffect(() => {
    loadActiveDates();
  }, []);

  // Fetch schedule whenever selectedDateStr changes
  useEffect(() => {
    const fetchDaySchedule = async () => {
      // If we already have a cached schedule for this date, use it
      if (scheduleMap[selectedDateStr] !== undefined) {
        return;
      }

      // If viewing today and today's schedule is provided via props
      if (selectedDateStr === todayDateStr && schedule && schedule.length > 0) {
        setScheduleMap(prev => ({ ...prev, [todayDateStr]: schedule }));
        return;
      }

      setLoadingDay(true);
      try {
        const res = await api.getScheduleByDate(selectedDateStr);
        const dayBlocks = res.schedule || [];
        setScheduleMap(prev => ({ ...prev, [selectedDateStr]: dayBlocks }));
        if (dayBlocks.length > 0 && !activeDates.includes(selectedDateStr)) {
          setActiveDates(prev => [...prev, selectedDateStr]);
        }
      } catch {
        setScheduleMap(prev => ({ ...prev, [selectedDateStr]: [] }));
      } finally {
        setLoadingDay(false);
      }
    };

    fetchDaySchedule();
  }, [selectedDateStr, todayDateStr, schedule]);

  // Track live current time (HH:MM) to highlight active block in real-time
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
    const timer = setInterval(updateTime, 5000); // 5-second heartbeat
    return () => clearInterval(timer);
  }, []);

  const weekDays = useMemo(() => computeCurrentWeekDays(activeDates), [activeDates]);

  // Active day schedule
  const activeDaySchedule = scheduleMap[selectedDateStr] ?? (selectedDateStr === todayDateStr ? schedule : []);

  const isSelectedToday = selectedDateStr === todayDateStr;
  const isPastDate = selectedDateStr < todayDateStr;
  const selectedDayItem = weekDays.find(w => w.dateStr === selectedDateStr) || weekDays.find(w => w.isToday) || weekDays[0];
  const selectedDayCode = selectedDayItem.day;

  // Dynamic protected focus calculation for the active day (strictly deep focus work)
  const focusMinutes = activeDaySchedule
    .filter(s => s.type === 'deep_focus' && !isBreakOrRestBlock(s))
    .reduce((sum, s) => sum + s.duration, 0);
  const focusHrs = Math.floor(focusMinutes / 60);
  const focusMins = focusMinutes % 60;
  const totalProtectedText = focusMinutes > 0 ? `${focusHrs}H ${focusMins}M PROTECTED` : '0H 0M PROTECTED';

  // Next pending focus block based on real time (strictly excluding breaks, rest & lunch)
  const pendingWorkBlocks = activeDaySchedule.filter(s => !isBreakOrRestBlock(s) && s.status === 'pending');
  const nextBlock = activeDaySchedule.length > 0 ? (
    (isSelectedToday
      ? pendingWorkBlocks.find(s => s.type === 'deep_focus' && s.end_time >= currentHHMM) || pendingWorkBlocks.find(s => s.end_time >= currentHHMM)
      : null) ||
    pendingWorkBlocks.find(s => s.type === 'deep_focus') ||
    pendingWorkBlocks[0] ||
    null
  ) : null;

  const sequenceTitle = isSelectedToday
    ? "Today's sequence"
    : isPastDate
    ? `${fullDayNames[selectedDayCode]}'s sequence (Archived)`
    : `${fullDayNames[selectedDayCode]}'s sequence (Advance View)`;

  // Identify any pending tasks for today that aren't on the timetable
  const unscheduledTasks = useMemo(() => {
    if (!isSelectedToday || !tasks || tasks.length === 0) return [];
    return tasks.filter(t => {
      if (t.status === 'done') return false;
      const tNorm = (t.title || '').toLowerCase().trim();
      const inSchedule = activeDaySchedule.some(b => {
        if (b.task_id && b.task_id === t.id) return true;
        const bNorm = (b.title || '').toLowerCase().trim();
        return bNorm === tNorm || (bNorm.length > 3 && (bNorm.includes(tNorm) || tNorm.includes(bNorm)));
      });
      return !inSchedule;
    });
  }, [isSelectedToday, tasks, activeDaySchedule]);

  // Toggle schedule status handler
  const handleToggleBlock = (blockId: string) => {
    if (isPastDate) return;
    const targetBlock = (scheduleMap[selectedDateStr] || activeDaySchedule).find(b => b.id === blockId);
    if (targetBlock && isBreakOrRestBlock(targetBlock)) {
      return; // Breaks/rest/lunch cannot be marked as tasks
    }
    // Optimistic update
    setScheduleMap(prev => {
      const list = prev[selectedDateStr] || activeDaySchedule;
      const updated = list.map(b => {
        if (b.id === blockId) {
          const nextStatus: 'pending' | 'done' = b.status === 'done' ? 'pending' : 'done';
          return { ...b, status: nextStatus };
        }
        return b;
      });
      return { ...prev, [selectedDateStr]: updated };
    });
    onToggleStatus(blockId, selectedDateStr);
  };

  // Add task directly to timeline handler with intelligent reflow
  const handleAddTaskToTimeline = async ({
    title,
    duration,
    startTime,
    category,
    priority,
    isUntimed,
  }: {
    title: string;
    duration: number;
    startTime?: string;
    category: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    isUntimed: boolean;
  }) => {
    const taskId = `task-${Date.now()}`;
    const blockId = `block-${Date.now()}`;

    const updatedSchedule = insertAndReflowSchedule({
      currentBlocks: activeDaySchedule,
      newTask: {
        title,
        duration,
        startTime,
        category,
        priority,
        isUntimed,
        taskId,
        blockId,
      },
      workHours: savedWorkHours,
      selectedDateStr,
      isToday: isSelectedToday,
      currentHHMM,
    });

    const placedBlock = updatedSchedule.find(b => b.id === blockId);
    const finalStartTime = startTime || placedBlock?.start_time || null;
    const computedBucket = getTimeBucket(finalStartTime);

    const taskRecord: Partial<Task> = {
      id: taskId,
      title,
      duration_minutes: isUntimed ? 0 : duration,
      priority,
      category,
      energy_level: (finalStartTime && finalStartTime >= '17:00') || category === 'Personal & Social' ? 'light' : 'deep_focus',
      status: 'pending',
      scheduled_start: finalStartTime,
      column_bucket: computedBucket,
    };

    // 1. Optimistically update local scheduleMap
    setScheduleMap(prev => ({
      ...prev,
      [selectedDateStr]: updatedSchedule,
    }));

    if (!activeDates.includes(selectedDateStr)) {
      setActiveDates(prev => [...prev, selectedDateStr]);
    }

    // 2. Notify parent if today
    if (isSelectedToday && onScheduleUpdated) {
      onScheduleUpdated(updatedSchedule, selectedDateStr);
    }

    // 3. Persist to backend
    try {
      const res = await api.addCustomScheduleBlock(selectedDateStr, updatedSchedule, taskRecord);
      if (res.task && onTaskCreated) {
        onTaskCreated(res.task);
      }
    } catch (err) {
      console.error('Failed to save task to schedule:', err);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
        <div>
          <div className="text-[10px] xs:text-[11px] font-mono tracking-widest uppercase text-luma-text-dim mb-1">
            Your Focused Week
          </div>
          <h1 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl font-serif text-white tracking-tight mb-1.5 xs:mb-2">
            Daily plan
          </h1>
          <p className="text-xs sm:text-sm text-luma-text-muted">
            One clear commitment at a time.
          </p>
        </div>

        {/* Action Buttons: Only show Reshape button when day is already shaped; unshaped days use the empty state CTA */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {isPastDate ? (
            <div className="flex items-center gap-2 px-3 py-1.5 xs:px-3.5 xs:py-2 rounded-2xl bg-white/[0.03] border border-white/10 text-luma-text-dim text-xs font-mono select-none">
              <History className="w-3.5 h-3.5" />
              <span>Past date • Archive</span>
            </div>
          ) : activeDaySchedule.length > 0 && onOpenShapeMyDay ? (
            <button
              onClick={() => onOpenShapeMyDay(selectedDateStr)}
              className="flex items-center gap-1.5 xs:gap-2 px-3 xs:px-4 py-1.5 xs:py-2 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs font-semibold border border-white/10 active:scale-95 transition-all shadow-sm cursor-pointer"
              title="Reshape this day's timetable with AI"
            >
              <Sparkles className="w-3.5 h-3.5 text-luma-lime stroke-[2.2]" />
              <span>{isSelectedToday ? 'Reshape day' : `Reshape ${selectedDayItem.day}`}</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Weekday Selector Bar */}
      <div className="bg-luma-card border border-luma-card-border rounded-3xl p-1 xs:p-1.5 sm:p-3 flex items-center justify-between gap-0.5 xs:gap-1 overflow-x-auto scrollbar-none">
        {weekDays.map((item) => {
          const isSelected = selectedDateStr === item.dateStr;
          return (
            <button
              key={item.day}
              onClick={() => setSelectedDateStr(item.dateStr)}
              className={`min-w-[36px] xs:min-w-[42px] sm:min-w-0 flex-1 flex flex-col items-center py-1.5 xs:py-2.5 sm:py-3.5 px-0.5 xs:px-1 sm:px-2 rounded-2xl transition-all cursor-pointer ${
                isSelected
                  ? 'bg-luma-cream text-luma-cream-text shadow-sm'
                  : 'text-luma-text-muted hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <span className="text-[9px] xs:text-[10px] font-mono uppercase tracking-wider mb-0.5 xs:mb-1">
                {item.day}
              </span>
              <div className="flex items-center gap-0.5 xs:gap-1 font-mono text-xs sm:text-sm font-semibold">
                <span>{item.date}</span>
                {item.isToday && (
                  <span
                    className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                      isSelected
                        ? 'bg-emerald-600 shadow-[0_0_8px_#10b981] ring-2 ring-emerald-500/40 animate-pulse'
                        : 'bg-luma-lime shadow-[0_0_8px_#d4f938] animate-pulse'
                    }`}
                    title="Current Date"
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Sequence (7 cols) */}
        <div className="lg:col-span-7 bg-luma-card border border-luma-card-border rounded-2xl xs:rounded-3xl p-3.5 xs:p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4 xs:mb-6 flex-wrap gap-2">
            <h2 className="text-sm xs:text-base font-semibold text-white tracking-tight">
              {sequenceTitle}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Add Task Button: ONLY visible and active when activeDaySchedule.length > 0 and not isPastDate */}
              {activeDaySchedule.length > 0 && !isPastDate && (
                <button
                  type="button"
                  onClick={() => setIsAddTaskModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-luma-lime text-black font-semibold text-xs shadow-lime-glow hover:bg-luma-lime-hover transition-all active:scale-95 cursor-pointer"
                  title="Add task directly to timetable"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Add task</span>
                </button>
              )}
              {/* Quick Reshape Button inside Sequence Card */}
              {!isPastDate && onOpenShapeMyDay && (
                <button
                  type="button"
                  onClick={() => onOpenShapeMyDay(selectedDateStr)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white font-semibold text-xs border border-white/10 transition-all active:scale-95 cursor-pointer"
                  title="Reshape this day's timetable"
                >
                  <Sparkles className="w-3.5 h-3.5 text-luma-lime stroke-[2.2]" />
                  <span>Reshape</span>
                </button>
              )}
              {savedWorkHours?.workStartTime && savedWorkHours?.workEndTime && (
                <button
                  type="button"
                  onClick={onAdjustCapacity}
                  title="Adjust working hours in Settings"
                  className="text-[11px] font-mono text-luma-lime bg-[#252824] hover:bg-[#2e332d] px-2.5 py-1 rounded-full border border-white/5 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Briefcase className="w-3 h-3 text-luma-lime" />
                  <span>{savedWorkHours.workStartTime} – {savedWorkHours.workEndTime}</span>
                </button>
              )}
              {activeDaySchedule.length > 0 ? (
                isPastDate ? (
                  <span className="text-[11px] font-mono tracking-wider uppercase text-luma-text-dim bg-white/5 px-2.5 py-1 rounded-full border border-white/10 flex items-center gap-1.5">
                    <History className="w-3 h-3 text-white/40" />
                    <span>ARCHIVE • {totalProtectedText}</span>
                  </span>
                ) : (
                  <span className="text-xs font-mono tracking-wider uppercase text-luma-lime bg-luma-lime/10 border border-luma-lime/25 px-2.5 py-1 rounded-full font-semibold">
                    {totalProtectedText}
                  </span>
                )
              ) : isPastDate ? (
                <span className="text-[11px] font-mono tracking-wider uppercase text-luma-text-dim bg-[#212421] px-2.5 py-1 rounded-full border border-white/5 flex items-center gap-1.5">
                  <History className="w-3 h-3 text-white/30" />
                  <span>PAST / UNSHAPED</span>
                </span>
              ) : (
                <span className="text-[11px] font-mono tracking-wider uppercase text-luma-text-dim bg-[#212421] px-2.5 py-1 rounded-full border border-white/5">
                  UNSHAPED
                </span>
              )}
            </div>
          </div>

          {/* Sequence List with Timeline Spine */}
          {loadingDay ? (
            <div className="py-20 text-center space-y-2">
              <div className="w-8 h-8 rounded-full border-2 border-luma-lime border-t-transparent animate-spin mx-auto" />
              <p className="text-xs font-mono text-luma-text-muted">Loading schedule...</p>
            </div>
          ) : activeDaySchedule.length > 0 ? (
            <div className="relative pl-7 space-y-4 before:absolute before:left-[8px] before:top-4 before:bottom-4 before:w-[2px] before:bg-white/10">
              {activeDaySchedule.map((item) => {
                const isBreak = isBreakOrRestBlock(item);
                const isDone = !isBreak && item.status === 'done';
                const isSocial = item.category === 'Personal & Social' || item.category === 'Social';
                const isCurrentlyActive = isSelectedToday && isTimeWithinBlock(currentHHMM, item.start_time, item.end_time);

                // Dot colors
                const dotColor = isCurrentlyActive
                  ? 'border-luma-lime bg-luma-lime shadow-[0_0_12px_#d4f938]'
                  : isBreak
                  ? 'border-[#d9822b] bg-[#342014]'
                  : isSocial
                  ? 'border-pink-500 bg-[#35152a] shadow-[0_0_8px_rgba(236,72,153,0.3)]'
                  : isDone
                  ? 'border-luma-lime bg-luma-lime'
                  : 'border-luma-purple bg-luma-purple-dim';

                // Card styling
                const cardBg = isCurrentlyActive
                  ? 'bg-[#1b2618] border-l-4 border-l-luma-lime border-y-white/10 border-r-white/10 shadow-[0_0_20px_rgba(212,249,56,0.16)] text-white'
                  : isBreak
                  ? 'bg-[#241710]/85 border-[#3d2417] text-[#f7ad72]'
                  : isSocial
                  ? 'bg-[#251522] border-[#4a203f] text-[#f9a8d4]'
                  : isDone
                  ? 'bg-[#1b221a] border-[#293627] text-white opacity-80'
                  : 'bg-[#211e38] border-[#342f59] text-white';

                const durationColor = isCurrentlyActive
                  ? 'text-luma-lime font-bold'
                  : isBreak
                  ? 'text-[#e6934c]'
                  : isSocial
                  ? 'text-pink-400'
                  : isDone
                  ? 'text-luma-lime'
                  : 'text-luma-purple';

                return (
                  <div key={item.id} className="relative flex items-center gap-1.5 xs:gap-2.5 sm:gap-4 group">
                    {/* Timeline Dot */}
                    <div
                      className={`absolute -left-[25px] w-3.5 h-3.5 rounded-full border-2 ${dotColor} transition-transform group-hover:scale-125 z-10`}
                    />

                    {/* Start Time */}
                    <span className="w-8 xs:w-10 sm:w-12 text-[10px] xs:text-[11px] sm:text-xs font-mono text-luma-text-muted shrink-0">
                      {item.start_time}
                    </span>

                    {/* Task or Recharge Card */}
                    <div
                      onClick={() => {
                        if (!isBreak && !isPastDate) {
                          handleToggleBlock(item.id);
                        }
                      }}
                      title={
                        isPastDate
                          ? 'Archived day: Past timeline tasks cannot be modified'
                          : isBreak
                          ? 'Recharge Window'
                          : isDone
                          ? 'Click to mark pending'
                          : 'Click to mark complete'
                      }
                      className={`flex-1 flex items-center justify-between p-2.5 xs:p-3 sm:p-4 rounded-2xl border transition-all gap-1.5 xs:gap-2 min-w-0 ${
                        isBreak || isPastDate ? 'cursor-default select-none' : 'cursor-pointer hover:brightness-110'
                      } ${cardBg}`}
                    >
                      <div className="flex items-center gap-1.5 xs:gap-2 flex-wrap min-w-0 flex-1">
                        {isBreak ? (
                          <div className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0 bg-[#3d2417] text-[#f7ad72]" title="Recharge Window">
                            <Coffee className="w-3.5 h-3.5 stroke-[2]" />
                          </div>
                        ) : isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-luma-lime shrink-0" />
                        ) : isPastDate ? (
                          <div className="w-4 h-4 rounded-full border border-white/20 flex items-center justify-center shrink-0" title="Archived task (Read-only)">
                            <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                          </div>
                        ) : (
                          <Circle className="w-4 h-4 text-luma-text-dim group-hover:text-white shrink-0" />
                        )}
                        <span
                          className={`text-xs xs:text-sm font-medium truncate ${
                            isBreak ? 'text-[#f7ad72]/95' : isDone ? 'line-through text-white/60' : ''
                          }`}
                        >
                          {item.title}
                        </span>
                        {isBreak ? (
                          <span className="text-[8.5px] xs:text-[9px] font-mono px-1.5 xs:px-2 py-0.5 rounded-full bg-[#3d2417] text-[#f7ad72] border border-[#5a3623] font-semibold tracking-wider shrink-0">
                            RECHARGE
                          </span>
                        ) : isCurrentlyActive ? (
                          <span className="text-[8.5px] xs:text-[9px] font-mono px-1.5 xs:px-2 py-0.5 rounded-full bg-luma-lime text-black font-bold tracking-wider flex items-center gap-1 shadow-sm animate-pulse shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                            ACTIVE
                          </span>
                        ) : null}
                        {!isBreak && isSocial ? (
                          <span className="text-[8.5px] xs:text-[9px] font-mono px-1.5 xs:px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/30 shrink-0">
                            🎉 SOCIAL
                          </span>
                        ) : !isBreak && item.block_source === 'habit' ? (
                          <span className="text-[8.5px] xs:text-[9px] font-mono px-1.5 xs:px-2 py-0.5 rounded-full bg-luma-purple-dim text-luma-purple border border-luma-purple/30 shrink-0">
                            HABIT
                          </span>
                        ) : !isBreak && item.block_source === 'weekly_goal' ? (
                          <span className="text-[8.5px] xs:text-[9px] font-mono px-1.5 xs:px-2 py-0.5 rounded-full bg-[#242b10] text-luma-lime border border-luma-lime/30 shrink-0">
                            WEEKLY
                          </span>
                        ) : !isBreak && item.block_source === 'long_term_goal' ? (
                          <span className="text-[8.5px] xs:text-[9px] font-mono px-1.5 xs:px-2 py-0.5 rounded-full bg-[#1b2535] text-[#60a5fa] border border-[#60a5fa]/30 shrink-0">
                            GOAL
                          </span>
                        ) : !isBreak && item.block_source === 'daily_todo' ? (
                          <span className="text-[8.5px] xs:text-[9px] font-mono px-1.5 xs:px-2 py-0.5 rounded-full bg-white/5 text-luma-text-muted border border-white/10 shrink-0">
                            TO-DO
                          </span>
                        ) : null}
                      </div>

                      {isBreak ? (
                        <span className="text-[10px] xs:text-[11px] font-mono font-semibold uppercase tracking-wider text-[#e6934c] bg-[#3d2417] px-2 py-0.5 rounded-lg border border-[#523120] shrink-0">
                          {item.duration}M REST
                        </span>
                      ) : item.target_label ? (
                        <span className={`text-[11px] xs:text-xs font-mono font-semibold px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 shrink-0 ${isCurrentlyActive ? 'text-luma-lime border-luma-lime/40' : 'text-luma-lime'}`}>
                          {item.target_label}
                        </span>
                      ) : item.is_untimed || item.duration === 0 ? (
                        <span className={`text-[11px] xs:text-xs font-mono font-semibold px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-1 shrink-0 ${isCurrentlyActive ? 'text-luma-lime border-luma-lime/40' : 'text-luma-text-dim'}`}>
                          <span className={isCurrentlyActive ? 'text-luma-lime' : ''}>⚡</span>
                          <span className={isCurrentlyActive ? 'text-luma-lime font-bold' : ''}>Action</span>
                        </span>
                      ) : (
                        <span
                          className={`text-[11px] xs:text-xs font-mono font-semibold uppercase tracking-wider shrink-0 ${durationColor}`}
                        >
                          {item.duration}M
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Unscheduled / Overflow To-Dos */}
              {unscheduledTasks.length > 0 && (
                <div className="mt-6 pt-5 border-t border-white/[0.08] relative">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-amber-300">
                        Unscheduled To-Dos ({unscheduledTasks.length})
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono text-luma-text-dim">
                      From Today's Tasks
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {unscheduledTasks.map(t => (
                      <div
                        key={t.id}
                        className="bg-[#181d16] border border-amber-500/25 hover:border-amber-500/50 rounded-xl p-3 flex items-center justify-between gap-2 transition-all"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-white truncate">
                            {t.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-luma-text-muted">
                            <span>{t.duration_minutes > 0 ? `${t.duration_minutes}m` : 'Action'}</span>
                            <span>•</span>
                            <span className="text-amber-400/90">{t.priority}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            handleAddTaskToTimeline({
                              title: t.title,
                              duration: t.duration_minutes || 30,
                              category: t.category || 'General',
                              priority: t.priority || 'MEDIUM',
                              isUntimed: t.duration_minutes === 0,
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-mono font-semibold flex items-center gap-1 transition-all shrink-0 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : isPastDate ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-white/10 bg-[#161716]/60 flex flex-col items-center justify-center my-2">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-luma-text-dim mb-3">
                <History className="w-6 h-6 stroke-[1.5] text-luma-text-dim" />
              </div>
              <p className="text-sm font-medium text-white mb-1">
                No schedule recorded for {fullDayNames[selectedDayCode]}
              </p>
              <p className="text-xs text-luma-text-muted max-w-sm">
                {fullDayNames[selectedDayCode]} ({selectedDayItem.date} {selectedDayItem.fullDate.toLocaleDateString('en-US', { month: 'short' })}) has already passed without a recorded timetable. Past days are archived and cannot be shaped.
              </p>
            </div>
          ) : (
            <div className="p-8 text-center rounded-2xl border border-dashed border-white/10 bg-[#161716]/60 flex flex-col items-center justify-center my-2">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-luma-text-dim mb-3">
                <Calendar className="w-6 h-6 stroke-[1.5]" />
              </div>
              <p className="text-sm font-medium text-white mb-1">
                No schedule for {isSelectedToday ? 'today' : fullDayNames[selectedDayCode]}
              </p>
              <p className="text-xs text-luma-text-muted max-w-sm mb-4">
                {isSelectedToday
                  ? 'Your daily timetable has not been generated yet. Click below to shape your day with AI.'
                  : `Your timetable for ${fullDayNames[selectedDayCode]} (${selectedDayItem.date} ${selectedDayItem.fullDate.toLocaleDateString('en-US', { month: 'short' })}) is currently unshaped.`}
              </p>
              {onOpenShapeMyDay && (
                <button
                  onClick={() => onOpenShapeMyDay(selectedDateStr)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-luma-lime text-black font-semibold text-xs shadow-lime-glow hover:bg-luma-lime-hover transition-all active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5 stroke-[2]" />
                  <span>Shape {isSelectedToday ? 'my day' : `${fullDayNames[selectedDayCode]} with AI`}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Hero Spotlight + Unified Horizon Radar Hub (5 cols) */}
        <div className="lg:col-span-5 space-y-4 xs:space-y-6">
          {/* 1. Next Protected Block Hero Spotlight (Elevated to top) */}
          <div className="relative overflow-hidden bg-gradient-to-br from-[#f5f1e8] to-[#e8e2d5] text-luma-cream-text rounded-2xl xs:rounded-3xl p-4 xs:p-6 sm:p-7 shadow-md">
            {/* Soft decorative background purple blob */}
            <div className="absolute -bottom-10 -right-10 w-44 h-44 rounded-full bg-[#9f8ff5]/35 blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-28 h-28 rounded-tl-full bg-[#9f8ff5]/25 pointer-events-none" />

            <div className="relative z-10">
              {activeDaySchedule.length === 0 ? (
                <>
                  <div className="text-[10px] font-mono tracking-widest uppercase text-[#5a604f] mb-3 font-semibold">
                    NO COMMITMENTS SCHEDULED
                  </div>

                  <h3 className="text-xl xs:text-2xl font-serif font-bold text-[#141514] tracking-tight mb-1">
                    Your canvas is clear.
                  </h3>

                  <p className="text-xs text-[#52574e] mb-4 xs:mb-5 leading-relaxed">
                    {isSelectedToday
                      ? 'Add tasks, daily habits, or weekly goals to generate an energy-aligned timetable.'
                      : `No focus blocks scheduled for ${fullDayNames[selectedDayCode]}. Shape this day in advance with AI.`}
                  </p>

                  {onOpenShapeMyDay && (
                    <button
                      type="button"
                      onClick={() => onOpenShapeMyDay(selectedDateStr)}
                      className="w-full xs:w-auto inline-flex items-center justify-center gap-2 bg-[#121312] text-white px-4 xs:px-5 py-2.5 rounded-2xl text-xs font-semibold shadow-md hover:bg-black transition-all cursor-pointer active:scale-95 min-h-[44px]"
                    >
                      <Sparkles className="w-4 h-4 text-luma-lime stroke-[2.2]" />
                      <span>Shape timetable with AI</span>
                    </button>
                  )}
                </>
              ) : nextBlock ? (
                <>
                  <div className="text-[10px] font-mono tracking-widest uppercase text-[#5a604f] mb-2 xs:mb-3 font-semibold">
                    NEXT PROTECTED BLOCK · {nextBlock.start_time}
                  </div>

                  <h3 className="text-xl xs:text-2xl font-serif font-bold text-[#141514] tracking-tight mb-1">
                    {nextBlock.title.split('·')[0].trim()}, uninterrupted.
                  </h3>

                  <p className="text-xs text-[#52574e] mb-4 xs:mb-5 leading-relaxed">
                    {nextBlock.duration} minutes reserved for {nextBlock.category || 'deep focus'}.
                  </p>

                  <button
                    type="button"
                    onClick={() => onStartFocus(nextBlock.title, nextBlock.duration, nextBlock.id)}
                    className="w-full xs:w-auto flex items-center justify-center gap-2 bg-luma-lime hover:bg-luma-lime-hover text-black px-4 xs:px-5 py-2.5 rounded-2xl font-semibold text-xs shadow-md active:scale-95 transition-all cursor-pointer min-h-[44px]"
                  >
                    <Play className="w-3.5 h-3.5 fill-black" />
                    <span>Begin focus session</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="text-[10px] font-mono tracking-widest uppercase text-[#5a604f] mb-2 xs:mb-3 font-semibold">
                    RHYTHM ACHIEVED · ALL BLOCKS COMPLETED
                  </div>

                  <h3 className="text-xl xs:text-2xl font-serif font-bold text-[#141514] tracking-tight mb-1">
                    Outstanding consistency.
                  </h3>

                  <p className="text-xs text-[#52574e] mb-4 xs:mb-5 leading-relaxed">
                    All scheduled focus commitments for today have been fulfilled. Time to step away & recharge.
                  </p>

                  <div className="inline-flex items-center gap-2 bg-[#252824] text-luma-lime px-3.5 xs:px-4 py-2 rounded-2xl text-xs font-mono font-semibold">
                    <span>✓ 100% Kept Today</span>
                  </div>
                </>
              )}

              {/* Integrated Circadian Energy Alignment Footnote */}
              <div className="pt-3 mt-3.5 xs:pt-3.5 xs:mt-4 border-t border-black/10 flex items-start gap-2 text-[10px] xs:text-[11px] text-[#4d5249] leading-relaxed">
                <span className="text-[#2d3a24] font-bold shrink-0">⚡ Energy-aligned:</span>
                <span>
                  {activeDaySchedule.length > 0
                    ? 'Deeper cognitive work sits before coaching. Tactical reviews are scheduled during natural dips.'
                    : 'Asst. JUGNU DAS aligns focus with your circadian peak, protecting space for habit formation and rest.'}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Unified Horizon Radar Hub (Habits, Weekly Goals, Long View) */}
          <div className="bg-luma-card border border-luma-card-border rounded-2xl xs:rounded-3xl p-3.5 xs:p-5 sm:p-6 shadow-sm">
            {/* Segmented Pill Navigation */}
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-white/[0.06] gap-2 flex-wrap">
              <div className="flex items-center gap-1 xs:gap-1.5 p-1 rounded-2xl bg-[#141514] border border-white/5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setActiveHorizonTab('anchors')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 xs:gap-1.5 px-2 xs:px-3 py-1.5 rounded-xl text-[11px] xs:text-xs font-medium transition-all cursor-pointer min-h-[40px] ${
                    activeHorizonTab === 'anchors'
                      ? 'bg-luma-purple text-white shadow-sm font-semibold'
                      : 'text-luma-text-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Habits</span>
                  {activeHabits.length > 0 && (
                    <span className={`text-[9px] xs:text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                      activeHorizonTab === 'anchors' ? 'bg-white/20 text-white font-bold' : 'bg-white/5 text-luma-text-dim'
                    }`}>
                      {completedHabitsCount}/{activeHabits.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveHorizonTab('weekly')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 xs:gap-1.5 px-2 xs:px-3 py-1.5 rounded-xl text-[11px] xs:text-xs font-medium transition-all cursor-pointer min-h-[40px] ${
                    activeHorizonTab === 'weekly'
                      ? 'bg-luma-lime text-black shadow-sm font-semibold'
                      : 'text-luma-text-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Target className="w-3.5 h-3.5" />
                  <span className="xs:hidden">Weekly</span>
                  <span className="hidden xs:inline">Weekly Sprint</span>
                  {weeklyGoals.length > 0 && (
                    <span className={`text-[9px] xs:text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                      activeHorizonTab === 'weekly' ? 'bg-black/20 text-black font-bold' : 'bg-white/5 text-luma-text-dim'
                    }`}>
                      {weeklyGoals.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveHorizonTab('long')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 xs:gap-1.5 px-2 xs:px-3 py-1.5 rounded-xl text-[11px] xs:text-xs font-medium transition-all cursor-pointer min-h-[40px] ${
                    activeHorizonTab === 'long'
                      ? 'bg-[#3b82f6] text-white shadow-sm font-semibold'
                      : 'text-luma-text-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span className="xs:hidden">Goals</span>
                  <span className="hidden xs:inline">Long View</span>
                  {goals.length > 0 && (
                    <span className={`text-[9px] xs:text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                      activeHorizonTab === 'long' ? 'bg-white/20 text-white font-bold' : 'bg-white/5 text-luma-text-dim'
                    }`}>
                      {goals.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Sub-label */}
              <span className="text-[10px] font-mono uppercase tracking-widest text-luma-text-dim hidden sm:inline-block">
                {activeHorizonTab === 'anchors' ? 'Daily Rituals' : activeHorizonTab === 'weekly' ? '7-Day Target' : 'Runway'}
              </span>
            </div>

            {/* TAB 1: DAILY ANCHORS */}
            {activeHorizonTab === 'anchors' && (
              <div className="space-y-4 animate-fadeIn">
                {/* Progress bar */}
                {activeHabits.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono text-luma-text-muted">
                      <span>Adherence Today</span>
                      <span className="text-luma-lime font-bold">{completedHabitsCount}/{activeHabits.length} ({habitProgressPercent}%)</span>
                    </div>
                    <div className="w-full bg-[#141514] h-1.5 rounded-full overflow-hidden border border-white/[0.04]">
                      <div
                        className="h-full bg-luma-lime transition-all duration-500 shadow-[0_0_8px_rgba(212,249,56,0.3)]"
                        style={{ width: `${habitProgressPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {activeHabits.length === 0 ? (
                  <div className="text-center py-8 px-4 text-xs text-luma-text-dim bg-[#141514] rounded-2xl border border-white/[0.04] space-y-2">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center mx-auto text-luma-text-dim">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <p className="text-white/80 font-medium text-xs">No active daily habits configured</p>
                    <p className="text-[11px] text-luma-text-muted max-w-xs mx-auto">
                      Add recurring anchors in Tasks & Cadence to build your daily rhythm.
                    </p>
                    {onSelectTab && (
                      <button
                        type="button"
                        onClick={() => onSelectTab('tasks')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs transition-all cursor-pointer"
                      >
                        <span>Open Tasks →</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    {activeHabits.map((h) => {
                      const isDone = h.last_completed_date === todayDateStr;
                      const AnchorIcon = h.anchor === 'morning' ? Sun : h.anchor === 'evening' ? Moon : Waves;
                      const anchorColor = h.anchor === 'morning' ? 'text-amber-400' : h.anchor === 'evening' ? 'text-luma-purple' : 'text-sky-400';

                      return (
                        <div
                          key={h.id}
                          onClick={() => onToggleHabit && onToggleHabit(h.id)}
                          className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer group ${
                            isDone
                              ? 'bg-[#151c15] border-[#222f21] text-white/70'
                              : 'bg-[#141514] border-white/[0.04] hover:border-white/20 text-white'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              type="button"
                              className="shrink-0 transition-transform active:scale-90"
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-4 h-4 text-luma-lime" />
                              ) : (
                                <Circle className="w-4 h-4 text-luma-text-dim group-hover:text-white" />
                              )}
                            </button>

                            <div className="min-w-0">
                              <div className={`text-xs font-medium truncate ${isDone ? 'line-through text-white/50' : 'text-white'}`}>
                                {h.title}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] font-mono text-luma-text-dim mt-0.5">
                                <span className={`flex items-center gap-1 ${anchorColor} capitalize`}>
                                  <AnchorIcon className="w-3 h-3" />
                                  <span>{h.anchor}</span>
                                </span>
                                <span>•</span>
                                {h.habit_type === 'check_off' ? (
                                  <span className="text-amber-400/90 font-semibold">
                                    {h.target_value ? `⚡ ${h.target_value}` : '⚡ Ritual'}
                                  </span>
                                ) : h.habit_type === 'target' ? (
                                  <span className="text-sky-400 font-semibold">
                                    🎯 {h.target_value} {h.target_unit || ''}
                                  </span>
                                ) : (
                                  <span className="text-luma-purple">
                                    ⏱️ {h.duration_minutes > 0 ? `${h.duration_minutes}m` : 'Session'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Streak */}
                          <div className="flex items-center gap-1 shrink-0 font-mono text-[11px] text-amber-400 pl-2">
                            {h.streak_count > 0 ? (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px]">
                                <Flame className="w-3 h-3 text-amber-400 fill-amber-400" />
                                <span>{h.streak_count}d</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-luma-text-dim/60">—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: WEEKLY SPRINT */}
            {activeHorizonTab === 'weekly' && (
              <div className="space-y-4 animate-fadeIn">
                {weeklyGoals.length === 0 ? (
                  <div className="text-center py-8 px-4 text-xs text-luma-text-dim bg-[#141514] rounded-2xl border border-white/[0.04] space-y-2">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center mx-auto text-luma-text-dim">
                      <Target className="w-4 h-4" />
                    </div>
                    <p className="text-white/80 font-medium text-xs">No weekly targets set for this week</p>
                    <p className="text-[11px] text-luma-text-muted max-w-xs mx-auto">
                      Define weekly milestones in Tasks & Cadence to track pacing across the 7-day week.
                    </p>
                    {onSelectTab && (
                      <button
                        type="button"
                        onClick={() => onSelectTab('tasks')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs transition-all cursor-pointer"
                      >
                        <span>Open Tasks →</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {weeklyGoals.map((wg) => {
                      const progress = wg.progressPercent || Math.min(100, Math.round((wg.completed_units / Math.max(wg.target_units, 1)) * 100));
                      const isAchieved = wg.completed_units >= wg.target_units;

                      return (
                        <div
                          key={wg.id}
                          className="p-3.5 rounded-2xl bg-[#141514] border border-white/[0.04] hover:border-white/10 transition-all space-y-2.5 group/wg"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-white truncate">
                              {wg.title}
                            </span>
                            {isAchieved ? (
                              <span className="text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30 shrink-0 flex items-center gap-1">
                                ✓ Done
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-luma-text-dim uppercase tracking-wider shrink-0">
                                {wg.category || 'Sprint'}
                              </span>
                            )}
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full h-1.5 bg-[#252825] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isAchieved
                                  ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]'
                                  : 'bg-luma-lime shadow-[0_0_10px_rgba(212,249,56,0.4)]'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>

                          {/* Interactive Stepper & Progress Stats */}
                          <div className="flex items-center justify-between text-[11px] font-mono pt-0.5">
                            {/* Stepper Controls */}
                            <div className="flex items-center gap-1 bg-[#1a1c1a] border border-white/[0.06] rounded-xl px-1.5 py-0.5">
                              <button
                                type="button"
                                disabled={wg.completed_units <= 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateWeeklyGoalProgress?.(wg.id, Math.max(0, wg.completed_units - 1));
                                }}
                                className="w-5 h-5 rounded-lg bg-white/5 hover:bg-white/15 disabled:opacity-20 disabled:pointer-events-none flex items-center justify-center text-white/70 hover:text-white transition-all text-xs active:scale-90"
                                title="Decrease 1 unit"
                              >
                                <Minus className="w-3 h-3" />
                              </button>

                              <button
                                type="button"
                                className="font-semibold text-white px-1.5 hover:text-luma-lime transition-colors cursor-pointer"
                                title="Click to manually set completed units"
                                onClick={(e) => {
                                  e.stopPropagation();
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
                              </button>
                              <span className="text-luma-text-dim text-[10px] pr-0.5">/ {wg.target_units} {wg.unit_label}</span>

                              <button
                                type="button"
                                disabled={wg.completed_units >= wg.target_units}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateWeeklyGoalProgress?.(wg.id, Math.min(wg.target_units, wg.completed_units + 1));
                                }}
                                className="w-5 h-5 rounded-lg bg-luma-lime/15 hover:bg-luma-lime/25 text-luma-lime disabled:opacity-20 disabled:pointer-events-none flex items-center justify-center transition-all text-xs font-bold active:scale-90 shadow-sm"
                                title="Add 1 unit"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Percentage or Quick +1 Pill */}
                            <div className="flex items-center gap-2">
                              <span className={isAchieved ? 'text-emerald-400 font-semibold' : 'text-white/80'}>
                                {progress}%
                              </span>
                              {!isAchieved && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onUpdateWeeklyGoalProgress?.(wg.id, Math.min(wg.target_units, wg.completed_units + 1));
                                  }}
                                  className="px-2 py-0.5 rounded-lg bg-luma-lime/10 hover:bg-luma-lime/20 text-luma-lime border border-luma-lime/25 text-[10px] font-bold transition-all hover:scale-105 active:scale-95 shadow-sm"
                                  title={`Log +1 ${wg.unit_label || 'unit'}`}
                                >
                                  +1
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div className="text-[10px] font-mono text-luma-text-dim text-center pt-1">
                      ⚡ Auto-advances when timetable focus blocks are checked off
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: LONG VIEW */}
            {activeHorizonTab === 'long' && (
              <div className="space-y-4 animate-fadeIn">
                {goals.length === 0 ? (
                  <div className="text-center py-8 px-4 text-xs text-luma-text-dim bg-[#141514] rounded-2xl border border-white/[0.04] space-y-2">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center mx-auto text-luma-text-dim">
                      <Compass className="w-4 h-4" />
                    </div>
                    <p className="text-white/80 font-medium text-xs">No active long-term projects</p>
                    <p className="text-[11px] text-luma-text-muted max-w-xs mx-auto">
                      Build syllabus roadmaps and projects in Projects & Goals.
                    </p>
                    {onSelectTab && (
                      <button
                        type="button"
                        onClick={() => onSelectTab('learning')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs transition-all cursor-pointer"
                      >
                        <span>Open Projects & Goals →</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {goals.map((goal, idx) => {
                      const progress = Math.min(100, Math.round((goal.covered_units / Math.max(goal.total_units, 1)) * 100));
                      const barColors = [
                        'bg-luma-purple shadow-[0_0_12px_rgba(123,110,246,0.5)]',
                        'bg-luma-lime shadow-[0_0_12px_rgba(212,249,56,0.4)]',
                        'bg-[#f08a5d] shadow-[0_0_12px_rgba(240,138,93,0.4)]',
                      ];
                      const barColor = barColors[idx % barColors.length];

                      const target = new Date(goal.target_date).getTime();
                      const now = new Date().getTime();
                      const daysLeft = Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)));

                      return (
                        <div
                          key={goal.id}
                          onClick={() => {
                            if (onSelectGoal) onSelectGoal(goal.id);
                            if (onSelectTab) onSelectTab('learning');
                          }}
                          className="p-3.5 rounded-2xl bg-[#141514] border border-white/[0.04] hover:border-white/15 cursor-pointer transition-all group space-y-2"
                          title="Click to view full curriculum in Projects & Goals"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-semibold text-white group-hover:text-luma-lime transition-colors truncate">
                                {goal.title} →
                              </span>
                              {goal.category && (
                                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border ${getCategoryBadge(goal.category).color} shrink-0`}>
                                  {getCategoryBadge(goal.category).label}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono font-medium text-[#f08a5d] shrink-0">
                              {daysLeft}d left
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full h-1.5 bg-[#252825] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px] font-mono text-luma-text-muted">
                            <span>
                              {goal.covered_units} / {goal.total_units} {goal.unit_label}
                            </span>
                            <span>{progress}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Task directly to Timetable Modal */}
      <AddTimelineTaskModal
        isOpen={isAddTaskModalOpen}
        onClose={() => setIsAddTaskModalOpen(false)}
        targetDateStr={selectedDateStr}
        isToday={isSelectedToday}
        currentHHMM={currentHHMM}
        workHours={savedWorkHours}
        existingBlocks={activeDaySchedule}
        onAdd={handleAddTaskToTimeline}
      />
    </div>
  );
};
