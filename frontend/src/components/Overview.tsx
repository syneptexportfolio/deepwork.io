import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  Flame,
  Target,
  ChevronRight,
  ChevronLeft,
  Plus,
  ArrowUpRight,
} from 'lucide-react';
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

interface PointItem {
  day: number;
  date: string;
  points: number;
  maxPoints?: number;
  totalTasks?: number;
  percentage: number;
}

interface MonthlyPointsLineChartProps {
  title: string;
  subtitle: string;
  badgeLabel: string;
  colorScheme: 'lime' | 'purple';
  points: PointItem[];
  maxY: number;
  yUnitLabel: string;
  isLoading?: boolean;
}

function getSmoothSvgPath(coords: { x: number; y: number }[]): string {
  if (coords.length === 0) return '';
  if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;
  let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i === 0 ? i : i - 1];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

const MonthlyPointsLineChart: React.FC<MonthlyPointsLineChartProps> = ({
  title,
  subtitle,
  badgeLabel,
  colorScheme,
  points,
  maxY,
  yUnitLabel,
  isLoading = false,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const totalScored = useMemo(() => {
    return points.reduce((sum, p) => sum + p.points, 0);
  }, [points]);

  const activeDaysWithPoints = useMemo(() => {
    return points.filter((p) => p.points > 0).length;
  }, [points]);

  // SVG Dimensions
  const svgWidth = 540;
  const svgHeight = 210;
  const paddingLeft = 36;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 34;
  const graphW = svgWidth - paddingLeft - paddingRight;
  const graphH = svgHeight - paddingTop - paddingBottom;

  const validMaxY = Math.max(maxY, 1);

  const coords = useMemo(() => {
    if (points.length === 0) return [];
    return points.map((p, idx) => {
      const x = paddingLeft + (idx / Math.max(points.length - 1, 1)) * graphW;
      const y = paddingTop + graphH - (p.points / validMaxY) * graphH;
      return { x, y, point: p, index: idx };
    });
  }, [points, validMaxY, graphW, graphH]);

  const linePath = useMemo(() => getSmoothSvgPath(coords), [coords]);
  const areaPath = useMemo(() => {
    if (coords.length === 0) return '';
    const bottomY = paddingTop + graphH;
    return `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${bottomY} L ${coords[0].x.toFixed(1)} ${bottomY} Z`;
  }, [linePath, coords, paddingTop, graphH]);

  const isLime = colorScheme === 'lime';
  const strokeColor = isLime ? '#d4f938' : '#a78bfa';
  const glowColor = isLime ? 'rgba(212,249,56,0.5)' : 'rgba(167,139,250,0.5)';
  const gradientId = isLime ? 'limeGraphGradient' : 'purpleGraphGradient';
  const badgeClasses = isLime
    ? 'text-luma-lime bg-luma-lime/10 border-luma-lime/20'
    : 'text-luma-purple bg-luma-purple/10 border-luma-purple/20';

  const hoveredItem = hoveredIndex !== null && coords[hoveredIndex] ? coords[hoveredIndex] : null;

  // Key day ticks for X-axis
  const dayTickIndices = useMemo(() => {
    if (points.length === 0) return [];
    const ticks = [0];
    for (let d = 5; d < points.length; d += 5) {
      ticks.push(d - 1);
    }
    if (!ticks.includes(points.length - 1)) {
      ticks.push(points.length - 1);
    }
    return ticks;
  }, [points]);

  return (
    <div className="bg-luma-card border border-luma-card-border rounded-3xl p-6 relative overflow-hidden shadow-md flex flex-col justify-between">
      {/* Background radial highlight */}
      <div
        className={`absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
          isLime ? 'bg-luma-lime/5' : 'bg-luma-purple/5'
        }`}
      />

      <div>
        {/* Header */}
        <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${badgeClasses}`}>
                {badgeLabel}
              </span>
            </div>
            <h3 className="text-base font-semibold text-white tracking-tight">{title}</h3>
            <p className="text-xs text-luma-text-muted mt-0.5">{subtitle}</p>
          </div>

          {/* Summary Metric Badges */}
          <div className="flex items-center gap-3 text-right">
            <div>
              <div className="text-[10px] font-mono uppercase text-luma-text-dim">Total Scored</div>
              <div className="text-base font-bold text-white font-mono">
                {totalScored} <span className="text-xs font-normal text-luma-text-dim">{yUnitLabel}</span>
              </div>
            </div>
            <div className="hidden sm:block border-l border-white/10 pl-3">
              <div className="text-[10px] font-mono uppercase text-luma-text-dim">Active Days</div>
              <div className={`text-base font-bold font-mono ${isLime ? 'text-luma-lime' : 'text-luma-purple'}`}>
                {activeDaysWithPoints} <span className="text-xs font-normal text-luma-text-dim">/ {points.length}d</span>
              </div>
            </div>
          </div>
        </div>

        {/* Hover Highlight Status Banner */}
        <div className="h-7 mb-2 flex items-center justify-between text-xs font-mono">
          {hoveredItem ? (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white animate-fadeIn">
              <span className={isLime ? 'text-luma-lime font-bold' : 'text-luma-purple font-bold'}>
                Day {hoveredItem.point.day}
              </span>
              <span className="text-white/40">•</span>
              <span className="text-luma-text-dim">{hoveredItem.point.date}</span>
              <span className="text-white/40">•</span>
              <span className="font-semibold text-white">
                {hoveredItem.point.points} {yUnitLabel}
                {hoveredItem.point.maxPoints !== undefined && (
                  <span className="text-luma-text-dim font-normal"> / {hoveredItem.point.maxPoints}</span>
                )}
                {hoveredItem.point.totalTasks !== undefined && (
                  <span className="text-luma-text-dim font-normal"> / {hoveredItem.point.totalTasks}</span>
                )}
              </span>
              <span className="text-emerald-400 font-bold">({hoveredItem.point.percentage}%)</span>
            </div>
          ) : (
            <span className="text-[11px] text-luma-text-dim italic">
              Hover over points along the curve to inspect daily scores
            </span>
          )}

          <div className="text-[10px] font-mono text-luma-text-dim">
            Consistency: <span className="text-white font-medium">{points.length > 0 ? Math.round((activeDaysWithPoints / points.length) * 100) : 0}%</span>
          </div>
        </div>

        {/* Chart SVG Canvas */}
        <div className="relative w-full overflow-hidden rounded-2xl bg-[#141514] border border-white/[0.04] p-2">
          {isLoading ? (
            <div className="h-44 flex items-center justify-center text-xs font-mono text-luma-text-muted">
              Loading monthly curve...
            </div>
          ) : points.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-xs font-mono text-luma-text-muted">
              No points data recorded for this month
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto overflow-visible select-none"
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
                  <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines */}
              {[0, 0.5, 1].map((ratio) => {
                const y = paddingTop + graphH - ratio * graphH;
                const val = Math.round(ratio * validMaxY);
                return (
                  <g key={ratio}>
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={svgWidth - paddingRight}
                      y2={y}
                      stroke="rgba(255,255,255,0.06)"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={paddingLeft - 8}
                      y={y + 3.5}
                      textAnchor="end"
                      fill="rgba(255,255,255,0.3)"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Area Fill */}
              {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}

              {/* Glowing Line Curve */}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ filter: `drop-shadow(0 0 5px ${glowColor})` }}
                />
              )}

              {/* Active Hover Guideline */}
              {hoveredItem && (
                <line
                  x1={hoveredItem.x}
                  y1={paddingTop}
                  x2={hoveredItem.x}
                  y2={paddingTop + graphH}
                  stroke={strokeColor}
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  opacity="0.7"
                />
              )}

              {/* Interactive Circles on Nodes */}
              {coords.map((c) => {
                const isHovered = hoveredIndex === c.index;
                const hasScore = c.point.points > 0;
                return (
                  <g
                    key={c.index}
                    onMouseEnter={() => setHoveredIndex(c.index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className="cursor-pointer"
                  >
                    {/* Transparent larger hit target for smooth hover */}
                    <circle cx={c.x} cy={c.y} r={10} fill="transparent" />

                    {/* Visible point node */}
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={isHovered ? 5.5 : hasScore ? 3.5 : 2}
                      fill={isHovered || hasScore ? strokeColor : '#252825'}
                      stroke={isHovered ? '#ffffff' : hasScore ? '#141514' : 'rgba(255,255,255,0.1)'}
                      strokeWidth={isHovered ? 2 : 1}
                      style={
                        hasScore || isHovered
                          ? { filter: `drop-shadow(0 0 4px ${glowColor})` }
                          : undefined
                      }
                      className="transition-all duration-150"
                    />
                  </g>
                );
              })}

              {/* X-Axis Days Labels */}
              {dayTickIndices.map((idx) => {
                const c = coords[idx];
                if (!c) return null;
                return (
                  <text
                    key={idx}
                    x={c.x}
                    y={svgHeight - 10}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.4)"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {c.point.day}
                  </text>
                );
              })}
            </svg>
          )}
        </div>
      </div>
    </div>
  );
};

export const Overview: React.FC<OverviewProps> = ({
  schedule,
  habits = [],
  goals: _goals = [],
  weeklyGoals = [],
  tasks: _tasks = [],
  stats: _stats,
  onSelectTab,
  onSelectGoal: _onSelectGoal,
  onSelectDay,
  onToggleScheduleStatus,
  onToggleHabit: _onToggleHabit,
  onOpenShapeMyDay,
  onAddTask,
  onAddWeeklyGoal,
  onIncrementWeeklyGoal: _onIncrementWeeklyGoal,
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

  // Month Selector for Dual Monthly Curves
  const [selectedGraphMonth, setSelectedGraphMonth] = useState<string>(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()).slice(0, 7);
  });

  const [habitPointsData, setHabitPointsData] = useState<{
    totalHabits: number;
    points: PointItem[];
  } | null>(null);

  const [taskPointsData, setTaskPointsData] = useState<{
    points: PointItem[];
  } | null>(null);

  const [loadingPoints, setLoadingPoints] = useState(false);

  // Load Habit & Task Monthly Points
  useEffect(() => {
    let isMounted = true;
    setLoadingPoints(true);
    Promise.all([
      api.getMonthlyHabitPoints(selectedGraphMonth).catch(() => null),
      api.getMonthlyTaskPoints(selectedGraphMonth).catch(() => null),
    ]).then(([habitRes, taskRes]) => {
      if (!isMounted) return;
      if (habitRes && habitRes.success) {
        setHabitPointsData({
          totalHabits: habitRes.totalHabits,
          points: habitRes.points,
        });
      }
      if (taskRes && taskRes.success) {
        setTaskPointsData({
          points: taskRes.points,
        });
      }
      setLoadingPoints(false);
    });
    return () => {
      isMounted = false;
    };
  }, [selectedGraphMonth, habits, schedule]);

  const graphMonthLabel = useMemo(() => {
    const [y, m] = selectedGraphMonth.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [selectedGraphMonth]);

  const handlePrevMonth = () => {
    const [y, m] = selectedGraphMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setSelectedGraphMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleCurrentMonth = () => {
    const now = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()).slice(0, 7);
    setSelectedGraphMonth(now);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedGraphMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setSelectedGraphMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

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

  // Today metrics: Work hours and Timeline Tasks
  const scheduledWorkBlocks = schedule.filter((s) => s.type !== 'break');
  const completedWorkBlocks = scheduledWorkBlocks.filter((s) => s.status === 'done');
  const isTodayShaped = scheduledWorkBlocks.length > 0;

  const totalWorkMins = scheduledWorkBlocks.reduce((sum, s) => sum + s.duration, 0);
  const completedWorkMins = completedWorkBlocks.reduce((sum, s) => sum + s.duration, 0);

  const completedWorkHoursFormatted = `${Math.floor(completedWorkMins / 60)}h ${completedWorkMins % 60}m`;
  const totalWorkHoursFormatted = `${Math.floor(totalWorkMins / 60)}h ${totalWorkMins % 60}m`;
  const workHoursRatio = isTodayShaped
    ? `${completedWorkHoursFormatted} / ${totalWorkHoursFormatted}`
    : '0h 0m / 0h 0m';

  const rhythmRate = isTodayShaped
    ? Math.round((completedWorkBlocks.length / scheduledWorkBlocks.length) * 100)
    : 0;

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

  // Dynamic Greeting
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
        {/* Card 1: Work Hours Today (Completed / Scheduled) */}
        <div
          onClick={() => onSelectTab('daily')}
          className="bg-luma-card border border-luma-card-border hover:border-luma-lime/40 rounded-3xl p-5 cursor-pointer transition-all group relative overflow-hidden shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-luma-text-dim group-hover:text-luma-lime transition-colors">
              Work Hours Today
            </span>
            <div className="w-7 h-7 rounded-xl bg-luma-lime/10 flex items-center justify-center text-luma-lime">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-1 truncate">
            {workHoursRatio}
          </div>
          <div className="flex items-center justify-between text-xs font-mono text-luma-text-muted mt-3">
            <span>Completed / Scheduled</span>
            <span className={isTodayShaped ? 'text-luma-lime font-medium' : 'text-amber-400/90 font-medium'}>
              {isTodayShaped
                ? `${Math.round((completedWorkMins / Math.max(totalWorkMins, 1)) * 100)}% done`
                : 'Unshaped'}
            </span>
          </div>
        </div>

        {/* Card 2: Timeline Tasks Today (Completed / Total) */}
        <div
          onClick={() => onSelectTab('daily')}
          className="bg-luma-card border border-luma-card-border hover:border-luma-purple/40 rounded-3xl p-5 cursor-pointer transition-all group relative overflow-hidden shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-luma-text-dim group-hover:text-luma-purple transition-colors">
              Timeline Tasks
            </span>
            <div className="w-7 h-7 rounded-xl bg-luma-purple/10 flex items-center justify-center text-luma-purple">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-white mb-1">
            {isTodayShaped ? `${completedWorkBlocks.length} / ${scheduledWorkBlocks.length}` : '0 / 0'}
          </div>
          <div className="flex items-center justify-between text-xs font-mono text-luma-text-muted mt-3">
            <span>Completed / Total</span>
            <span className={isTodayShaped ? 'text-luma-purple font-medium' : 'text-luma-text-dim'}>
              {isTodayShaped ? `${rhythmRate}% rhythm score` : 'No blocks'}
            </span>
          </div>
        </div>

        {/* Card 3: Completed Habits Today */}
        <div
          onClick={() => onSelectTab('tasks')}
          className="bg-luma-card border border-luma-card-border hover:border-[#f08a5d]/40 rounded-3xl p-5 cursor-pointer transition-all group relative overflow-hidden shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-luma-text-dim group-hover:text-[#f08a5d] transition-colors">
              Habits Today
            </span>
            <div className="w-7 h-7 rounded-xl bg-[#f08a5d]/10 flex items-center justify-center text-[#f08a5d]">
              <Flame className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-3xl font-bold tracking-tight text-white mb-1">
            {completedHabitsToday} / {activeHabits.length}
          </div>
          <div className="flex items-center justify-between text-xs font-mono text-luma-text-muted mt-3">
            <span>Completed Today</span>
            <span className="text-[#f08a5d]">
              🔥 {avgStreak}d avg streak
            </span>
          </div>
        </div>

        {/* Card 4: Weekly Task Completion Percentage Visual */}
        <div
          onClick={() => onSelectTab('tasks')}
          className="bg-luma-card border border-luma-card-border hover:border-emerald-500/40 rounded-3xl p-5 cursor-pointer transition-all group relative overflow-hidden shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-luma-text-dim group-hover:text-emerald-400 transition-colors">
                Weekly Sprint Pacing
              </span>
              <div className="w-7 h-7 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Target className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-3xl font-bold tracking-tight text-white mb-2">
              {weeklySprintProgress}%
            </div>
            {/* Visual Progress Bar */}
            <div className="w-full h-1.5 bg-[#252825] rounded-full overflow-hidden mb-2">
              <div
                className="h-full rounded-full transition-all duration-500 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                style={{ width: `${weeklySprintProgress}%` }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs font-mono text-luma-text-muted mt-1">
            <span>{totalWeeklyCompleted} / {totalWeeklyTarget || 0} units</span>
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
            <h3 className="text-lg font-semibold text-white tracking-tight">
              7-Day focus commitments & pacing rhythm
            </h3>
          </div>

          {/* Week Navigation Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekOffset((prev) => prev - 1)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer border border-white/5"
              title="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="px-3.5 py-2 rounded-xl text-xs font-mono bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer border border-white/5 font-medium"
            >
              Current Week
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset((prev) => prev + 1)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer border border-white/5"
              title="Next week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 7 Columns for Mon -> Sun */}
        {loadingWeek ? (
          <div className="py-16 text-center text-xs font-mono text-luma-text-muted">
            Loading weekly matrix...
          </div>
        ) : weeklyScheduleData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3 relative z-10">
            {weeklyScheduleData.days.map((day) => {
              const isToday = day.isToday;
              const hasBlocks = day.blocks && day.blocks.length > 0;
              const completedCount = day.blocks.filter((b) => b.status === 'done').length;

              return (
                <div
                  key={day.dayCode}
                  onClick={() => {
                    if (onSelectDay) {
                      onSelectDay(day.date);
                    }
                  }}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer group ${
                    isToday
                      ? 'bg-luma-purple/5 border-luma-purple/40 ring-1 ring-luma-purple/30'
                      : 'bg-[#151715]/60 hover:bg-[#191b19] border-white/[0.06] hover:border-white/15'
                  }`}
                >
                  <div>
                    {/* Day Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-bold uppercase text-white">
                          {day.dayCode}
                        </span>
                        {isToday && (
                          <span className="w-1.5 h-1.5 rounded-full bg-luma-lime shadow-[0_0_6px_#d4f938] animate-pulse" />
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-luma-text-dim">
                        {day.date.split('-').slice(1).join('/')}
                      </span>
                    </div>

                    {/* Focus Hours Pill */}
                    <div className="mb-3">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                          day.focusHours > 0
                            ? 'bg-luma-lime/10 text-luma-lime border-luma-lime/20'
                            : 'bg-white/5 text-luma-text-dim border-white/5'
                        }`}
                      >
                        {day.focusHours}h focus
                      </span>
                    </div>

                    {/* Block Stack Preview */}
                    {hasBlocks ? (
                      <div className="space-y-1.5 mb-3">
                        {day.blocks.slice(0, 3).map((block) => (
                          <div
                            key={block.id}
                            onClick={(e) => {
                              if (onToggleScheduleStatus) {
                                e.stopPropagation();
                                onToggleScheduleStatus(block.id, day.date);
                              }
                            }}
                            className={`px-2 py-1.5 rounded-lg text-[10px] font-mono border transition-all flex items-center justify-between gap-1 ${
                              block.status === 'done'
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300 line-through opacity-70'
                                : block.type === 'deep_focus'
                                ? 'bg-luma-purple/10 border-luma-purple/20 text-luma-purple hover:border-luma-purple/40'
                                : 'bg-white/5 border-white/5 text-luma-text-muted hover:border-white/10'
                            }`}
                            title={`Toggle status: ${block.title}`}
                          >
                            <span className="truncate">{block.title}</span>
                            <span className="shrink-0 text-[9px] opacity-70">
                              {block.duration}m
                            </span>
                          </div>
                        ))}
                        {day.blocks.length > 3 && (
                          <div className="text-[9px] font-mono text-luma-text-dim pl-1">
                            +{day.blocks.length - 3} more block{day.blocks.length - 3 > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-6 text-center">
                        <span className="text-[10px] font-mono text-luma-text-dim/60 block mb-1">
                          Unshaped
                        </span>
                        {onOpenShapeMyDay && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenShapeMyDay(day.date);
                            }}
                            className="text-[10px] font-mono text-luma-lime hover:underline flex items-center gap-1 mx-auto"
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
                    <span>{hasBlocks ? `${completedCount}/${day.blocks.length} done` : 'View Day'}</span>
                    <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* 4. DUAL SECTION: MONTHLY PERFORMANCE LINE GRAPHS (Habit Points & Timetable Task Points) */}
      <div className="space-y-6">
        {/* Section Header with Synchronized Month Navigator */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-luma-card border border-luma-card-border rounded-3xl shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-luma-lime">
                Monthly Performance Curves
              </span>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-white/5 text-white border border-white/10">
                {graphMonthLabel}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-white tracking-tight">
              Habit & Timetable Task Points Progression
            </h3>
            <p className="text-xs text-luma-text-muted mt-0.5">
              Daily point accumulation trends across the 30/31-day monthly horizon.
            </p>
          </div>

          {/* Synchronized Month Navigation Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer border border-white/5"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleCurrentMonth}
              className="px-3.5 py-2 rounded-xl text-xs font-mono bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer border border-white/5 font-medium"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer border border-white/5"
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dual Line Graphs Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Monthly Habit Points Line Graph */}
          <MonthlyPointsLineChart
            title="Monthly Habit Points Curve"
            subtitle="1 point per completed habit daily"
            badgeLabel="HABIT CADENCE"
            colorScheme="lime"
            points={habitPointsData?.points || []}
            maxY={habitPointsData?.totalHabits ? Math.max(habitPointsData.totalHabits, 5) : 6}
            yUnitLabel="pts"
            isLoading={loadingPoints}
          />

          {/* Chart 2: Monthly Timetable Task Points Line Graph */}
          <MonthlyPointsLineChart
            title="Monthly Timetable Task Points Curve"
            subtitle="Points scored from completed timetable blocks"
            badgeLabel="TIMELINE EXECUTION"
            colorScheme="purple"
            points={taskPointsData?.points || []}
            maxY={
              taskPointsData?.points?.length
                ? Math.max(...taskPointsData.points.map((p) => p.points), 5)
                : 6
            }
            yUnitLabel="tasks"
            isLoading={loadingPoints}
          />
        </div>
      </div>
    </div>
  );
};
