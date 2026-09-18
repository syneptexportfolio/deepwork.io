import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  Flame,
  Target,
  ChevronRight,
  ChevronLeft,
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
  isBreakOrRestBlock,
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
  day?: number;
  label?: string;
  date: string;
  points: number;
  maxPoints?: number;
  totalTasks?: number;
  percentage?: number;
  activeDays?: number;
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
  horizon?: 'monthly' | 'yearly';
  onSelectNode?: (dateStr: string) => void;
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
  horizon = 'monthly',
  onSelectNode,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const totalScored = useMemo(() => {
    return points.reduce((sum, p) => sum + p.points, 0);
  }, [points]);

  const activeUnitsCount = useMemo(() => {
    return points.filter((p) => p.points > 0).length;
  }, [points]);

  const currentMonthStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()).slice(0, 7);
  }, []);

  const currentMonthScore = useMemo(() => {
    if (horizon !== 'yearly') return 0;
    const pt = points.find((p) => p.date === currentMonthStr);
    return pt ? pt.points : 0;
  }, [horizon, points, currentMonthStr]);

  // SVG Dimensions
  const svgWidth = 540;
  const svgHeight = 210;
  const paddingLeft = 36;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 34;
  const graphW = svgWidth - paddingLeft - paddingRight;
  const graphH = svgHeight - paddingTop - paddingBottom;

  const maxDataPoint = useMemo(() => {
    if (points.length === 0) return 0;
    return Math.max(...points.map((p) => p.points));
  }, [points]);

  const validMaxY = Math.max(maxY, maxDataPoint, 1);

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
  const gradientId = isLime
    ? horizon === 'yearly' ? 'limeYearlyGradient' : 'limeGraphGradient'
    : horizon === 'yearly' ? 'purpleYearlyGradient' : 'purpleGraphGradient';
  const badgeClasses = isLime
    ? 'text-luma-lime bg-luma-lime/10 border-luma-lime/20'
    : 'text-luma-purple bg-luma-purple/10 border-luma-purple/20';

  const hoveredItem = hoveredIndex !== null && coords[hoveredIndex] ? coords[hoveredIndex] : null;

  // Key ticks for X-axis
  const tickIndices = useMemo(() => {
    if (points.length === 0) return [];
    if (horizon === 'yearly') {
      return Array.from({ length: points.length }, (_, i) => i);
    }
    const ticks = [0];
    for (let d = 5; d < points.length; d += 5) {
      ticks.push(d - 1);
    }
    if (!ticks.includes(points.length - 1)) {
      ticks.push(points.length - 1);
    }
    return ticks;
  }, [points, horizon]);

  const handleTouchScrub = (e: React.TouchEvent<SVGSVGElement>) => {
    if (coords.length === 0) return;
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const scaleX = svgWidth / rect.width;
    const svgTouchX = touchX * scaleX;

    let closestIdx = 0;
    let closestDist = Math.abs(coords[0].x - svgTouchX);
    for (let i = 1; i < coords.length; i++) {
      const dist = Math.abs(coords[i].x - svgTouchX);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    setHoveredIndex(closestIdx);
  };

  return (
    <div className="bg-luma-card border border-luma-card-border rounded-2xl xs:rounded-3xl p-3 xs:p-4 sm:p-5 relative overflow-hidden transition-all shadow-sm">
      <div
        className={`absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
          isLime ? 'bg-luma-lime/5' : 'bg-luma-purple/5'
        }`}
      />

      <div>
        {/* Header */}
        <div className="flex flex-col xs:flex-row xs:items-start justify-between mb-2.5 xs:mb-4 gap-2 xs:gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[9px] xs:text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${badgeClasses}`}>
                {badgeLabel}
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-white tracking-tight">{title}</h3>
            <p className="text-[11px] xs:text-xs text-luma-text-muted mt-0.5">{subtitle}</p>
          </div>

          {/* Summary Metric Badges */}
          <div className="flex items-center gap-2 xs:gap-3 text-left xs:text-right shrink-0 pt-1 xs:pt-0 border-t xs:border-t-0 border-white/[0.04]">
            <div>
              <div className="text-[9px] xs:text-[10px] font-mono uppercase text-luma-text-dim">
                {horizon === 'yearly' ? 'This Month' : 'Total Scored'}
              </div>
              <div className="text-xs xs:text-sm sm:text-base font-bold text-white font-mono">
                {horizon === 'yearly' ? currentMonthScore : totalScored} <span className="text-[11px] xs:text-xs font-normal text-luma-text-dim">{yUnitLabel}</span>
              </div>
            </div>
            <div className="border-l border-white/10 pl-2 xs:pl-3">
              <div className="text-[9px] xs:text-[10px] font-mono uppercase text-luma-text-dim">
                {horizon === 'yearly' ? 'Yearly Total' : 'Active Days'}
              </div>
              <div className={`text-xs xs:text-sm sm:text-base font-bold font-mono ${isLime ? 'text-luma-lime' : 'text-luma-purple'}`}>
                {horizon === 'yearly' ? (
                  <>{totalScored} <span className="text-[11px] xs:text-xs font-normal text-luma-text-dim">{yUnitLabel}</span></>
                ) : (
                  <>{activeUnitsCount} <span className="text-[11px] xs:text-xs font-normal text-luma-text-dim">/ {points.length}d</span></>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Hover Highlight Status Banner */}
        <div className="min-h-7 mb-2 flex items-center justify-between text-[10px] xs:text-xs font-mono flex-wrap gap-1.5">
          {hoveredItem ? (
            <div
              onClick={() => {
                if (horizon === 'yearly' && onSelectNode) {
                  onSelectNode(hoveredItem.point.date);
                }
              }}
              className={`flex items-center gap-1.5 xs:gap-2 px-2 xs:px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white animate-fadeIn flex-wrap max-w-full ${
                horizon === 'yearly' ? 'cursor-pointer hover:border-white/30' : ''
              }`}
            >
              <span className={isLime ? 'text-luma-lime font-bold' : 'text-luma-purple font-bold'}>
                {horizon === 'yearly' ? `${hoveredItem.point.label} (${hoveredItem.point.date})` : `Day ${hoveredItem.point.day}`}
              </span>
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
              {hoveredItem.point.activeDays !== undefined && (
                <>
                  <span className="text-white/40">•</span>
                  <span className="text-luma-text-dim">{hoveredItem.point.activeDays} active days</span>
                </>
              )}
              {hoveredItem.point.percentage !== undefined && (
                <span className="text-emerald-400 font-bold">({hoveredItem.point.percentage}%)</span>
              )}
              {horizon === 'yearly' && (
                <span className="text-[9px] xs:text-[10px] text-luma-lime bg-luma-lime/10 px-1.5 py-0.5 rounded border border-luma-lime/20 ml-0.5">
                  View Month →
                </span>
              )}
            </div>
          ) : (
            <span className="text-[10px] xs:text-[11px] text-luma-text-dim italic">
              {horizon === 'yearly'
                ? 'Touch or hover curve to inspect'
                : 'Touch or hover points to inspect'}
            </span>
          )}

          <div className="text-[9px] xs:text-[10px] font-mono text-luma-text-dim shrink-0">
            {horizon === 'yearly' ? (
              <>Active: <span className="text-white font-medium">{activeUnitsCount}/12m</span></>
            ) : (
              <>Consistency: <span className="text-white font-medium">{points.length > 0 ? Math.round((activeUnitsCount / points.length) * 100) : 0}%</span></>
            )}
          </div>
        </div>

        {/* Chart SVG Canvas */}
        <div className="relative w-full overflow-hidden rounded-2xl bg-[#141514] border border-white/[0.04] p-1.5 sm:p-2">
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
              className="w-full h-auto overflow-visible select-none touch-none"
              onTouchStart={handleTouchScrub}
              onTouchMove={handleTouchScrub}
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
                    onTouchStart={() => setHoveredIndex(c.index)}
                    onClick={() => {
                      setHoveredIndex(c.index);
                      if (horizon === 'yearly' && onSelectNode) {
                        onSelectNode(c.point.date);
                      }
                    }}
                    className={horizon === 'yearly' ? 'cursor-pointer' : 'cursor-default'}
                  >
                    {/* Transparent larger hit target for smooth touch & hover */}
                    <circle cx={c.x} cy={c.y} r={18} fill="transparent" />

                    {/* Visible point node */}
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={isHovered ? 5.5 : hasScore ? (horizon === 'yearly' ? 4 : 3.5) : 2}
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

              {/* X-Axis Labels */}
              {tickIndices.map((idx) => {
                const c = coords[idx];
                if (!c) return null;
                const labelText = horizon === 'yearly' ? c.point.label : c.point.day;
                return (
                  <text
                    key={idx}
                    x={c.x}
                    y={svgHeight - 10}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.45)"
                    fontSize={horizon === 'yearly' ? "8.5" : "9"}
                    fontFamily="monospace"
                  >
                    {labelText}
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
  onToggleScheduleStatus: _onToggleScheduleStatus,
  onToggleHabit: _onToggleHabit,
  onOpenShapeMyDay,
  onAddTask: _onAddTask,
  onAddWeeklyGoal: _onAddWeeklyGoal,
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

  // Selected Day state for Mobile Interactive 7-Day Cockpit
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);

  useEffect(() => {
    if (weeklyScheduleData && weeklyScheduleData.days.length > 0) {
      const exists = weeklyScheduleData.days.some((d) => d.date === selectedDayDate);
      if (!exists) {
        const todayDay = weeklyScheduleData.days.find((d) => d.isToday);
        setSelectedDayDate(todayDay ? todayDay.date : weeklyScheduleData.days[0].date);
      }
    }
  }, [weeklyScheduleData, selectedDayDate]);

  const activeDay = useMemo(() => {
    if (!weeklyScheduleData?.days?.length) return null;
    return weeklyScheduleData.days.find((d) => d.date === selectedDayDate) || weeklyScheduleData.days[0];
  }, [weeklyScheduleData, selectedDayDate]);

  const activeDayFormattedDate = useMemo(() => {
    if (!activeDay) return '';
    const [y, m, d] = activeDay.date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }, [activeDay]);

  const activeDayIndex = useMemo(() => {
    if (!weeklyScheduleData?.days || !activeDay) return -1;
    return weeklyScheduleData.days.findIndex((d) => d.date === activeDay.date);
  }, [weeklyScheduleData, activeDay]);

  const handlePrevDay = () => {
    if (!weeklyScheduleData?.days || activeDayIndex <= 0) return;
    setSelectedDayDate(weeklyScheduleData.days[activeDayIndex - 1].date);
  };

  const handleNextDay = () => {
    if (!weeklyScheduleData?.days || activeDayIndex < 0 || activeDayIndex >= weeklyScheduleData.days.length - 1) return;
    setSelectedDayDate(weeklyScheduleData.days[activeDayIndex + 1].date);
  };

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

  // Performance Horizon: 'monthly' | 'yearly'
  const [performanceHorizon, setPerformanceHorizon] = useState<'monthly' | 'yearly'>('monthly');

  // Year Selector for Yearly Performance Curves
  const [selectedGraphYear, setSelectedGraphYear] = useState<string>(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()).slice(0, 4);
  });

  // Yearly Points Data State
  const [yearlyHabitPointsData, setYearlyHabitPointsData] = useState<PointItem[]>([]);
  const [yearlyTaskPointsData, setYearlyTaskPointsData] = useState<PointItem[]>([]);
  const [loadingYearlyPoints, setLoadingYearlyPoints] = useState(false);

  // Load Habit & Task Yearly Points
  useEffect(() => {
    if (performanceHorizon !== 'yearly') return;
    let isMounted = true;
    setLoadingYearlyPoints(true);
    Promise.all([
      api.getYearlyHabitPoints(selectedGraphYear).catch(() => null),
      api.getYearlyTaskPoints(selectedGraphYear).catch(() => null),
    ]).then(([habitRes, taskRes]) => {
      if (!isMounted) return;
      if (habitRes && habitRes.success) {
        setYearlyHabitPointsData(
          habitRes.points.map((p) => ({
            label: p.label,
            date: p.monthStr,
            points: p.points,
            activeDays: p.activeDays,
            percentage: p.points > 0 ? Math.round((p.activeDays / p.daysInMonth) * 100) : 0,
          }))
        );
      }
      if (taskRes && taskRes.success) {
        setYearlyTaskPointsData(
          taskRes.points.map((p) => ({
            label: p.label,
            date: p.monthStr,
            points: p.points,
            totalTasks: p.totalTasks,
            activeDays: p.activeDays,
            percentage: p.percentage || 0,
          }))
        );
      }
      setLoadingYearlyPoints(false);
    });
    return () => {
      isMounted = false;
    };
  }, [selectedGraphYear, performanceHorizon, habits, schedule]);

  const handlePrevYear = () => {
    const y = Number(selectedGraphYear) - 1;
    setSelectedGraphYear(String(y));
  };

  const handleCurrentYear = () => {
    const currentYear = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()).slice(0, 4);
    setSelectedGraphYear(currentYear);
  };

  const handleNextYear = () => {
    const y = Number(selectedGraphYear) + 1;
    setSelectedGraphYear(String(y));
  };

  const handleDrillDownMonth = (monthStr: string) => {
    setSelectedGraphMonth(monthStr);
    setPerformanceHorizon('monthly');
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

  // Today metrics: Work hours and Timeline Tasks (strictly excluding breaks, rest & lunch)
  const scheduledWorkBlocks = schedule.filter((s) => !isBreakOrRestBlock(s));
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
    <div className="space-y-6 xs:space-y-8 sm:space-y-10 animate-fadeIn pb-12 min-w-0 max-w-full overflow-x-hidden">
      {/* 1. EXECUTIVE HEADER & HERO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 xs:gap-6 pb-2 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2 xs:gap-2.5 mb-2 flex-wrap">
            <span className="text-[10px] xs:text-[11px] font-mono uppercase tracking-widest text-luma-purple font-bold bg-luma-purple/10 px-2.5 py-1 rounded-full border border-luma-purple/20">
              Executive Dashboard
            </span>
            <span className="text-[10px] xs:text-[11px] font-mono text-luma-text-dim flex items-center gap-1.5 bg-[#1b1c1b] px-2.5 xs:px-3 py-1 rounded-full border border-white/5">
              <Clock className="w-3 h-3 text-luma-lime" />
              <span>{formattedTodayDate}</span>
              <span className="text-white/20">•</span>
              <span className="text-white font-semibold">{currentHHMM} IST</span>
            </span>
          </div>

          <h1 className="text-xl xs:text-2xl sm:text-3xl md:text-5xl font-serif text-white tracking-tight">
            {greeting}, <span className="italic font-serif text-glow-purple text-luma-purple-glow">command your rhythm.</span>
          </h1>
          <p className="text-xs md:text-sm text-luma-text-muted mt-1.5 max-w-2xl leading-relaxed">
            High-level operational overview of your weekly timetable, monthly habit adherence, active sprints, and long-term milestones.
          </p>
        </div>

        {/* Quick Actions Bar - Dedicated Single Shape Action */}
        <div className="flex items-center w-full sm:w-auto">
          {onOpenShapeMyDay && (
            <button
              type="button"
              onClick={() => onOpenShapeMyDay(todayIST)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-luma-lime hover:bg-luma-lime-hover text-black text-xs font-semibold shadow-lime-glow active:scale-95 transition-all cursor-pointer w-full sm:w-auto min-h-[44px]"
            >
              <Sparkles className="w-4 h-4 stroke-[2.2]" />
              <span>Shape Today with AI</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. EXECUTIVE PULSE METRIC CARDS (4-Column Matrix) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 xs:gap-4 sm:gap-5">
        {/* Card 1: Work Hours Today (Completed / Scheduled) */}
        <div
          onClick={() => onSelectTab('daily')}
          className="bg-luma-card border border-luma-card-border hover:border-luma-lime/40 rounded-2xl xs:rounded-3xl p-3.5 xs:p-4 sm:p-5 cursor-pointer transition-all group relative overflow-hidden shadow-sm"
        >
          <div className="flex items-center justify-between mb-2 xs:mb-3">
            <span className="text-[10px] xs:text-[11px] font-mono uppercase tracking-wider text-luma-text-dim group-hover:text-luma-lime transition-colors">
              Work Hours Today
            </span>
            <div className="w-6 h-6 xs:w-7 xs:h-7 rounded-xl bg-luma-lime/10 flex items-center justify-center text-luma-lime">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl xs:text-2xl sm:text-3xl font-bold tracking-tight text-white mb-1 truncate">
            {workHoursRatio}
          </div>
          <div className="flex items-center justify-between text-[10px] xs:text-xs font-mono text-luma-text-muted mt-2.5 xs:mt-3">
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
          className="bg-luma-card border border-luma-card-border hover:border-luma-purple/40 rounded-2xl xs:rounded-3xl p-3.5 xs:p-4 sm:p-5 cursor-pointer transition-all group relative overflow-hidden shadow-sm"
        >
          <div className="flex items-center justify-between mb-2 xs:mb-3">
            <span className="text-[10px] xs:text-[11px] font-mono uppercase tracking-wider text-luma-text-dim group-hover:text-luma-purple transition-colors">
              Timeline Tasks
            </span>
            <div className="w-6 h-6 xs:w-7 xs:h-7 rounded-xl bg-luma-purple/10 flex items-center justify-center text-luma-purple">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl xs:text-2xl sm:text-3xl font-bold tracking-tight text-white mb-1">
            {isTodayShaped ? `${completedWorkBlocks.length} / ${scheduledWorkBlocks.length}` : '0 / 0'}
          </div>
          <div className="flex items-center justify-between text-[10px] xs:text-xs font-mono text-luma-text-muted mt-2.5 xs:mt-3">
            <span>Completed / Total</span>
            <span className={isTodayShaped ? 'text-luma-purple font-medium' : 'text-luma-text-dim'}>
              {isTodayShaped ? `${rhythmRate}% rhythm score` : 'No blocks'}
            </span>
          </div>
        </div>

        {/* Card 3: Completed Habits Today */}
        <div
          onClick={() => onSelectTab('tasks')}
          className="bg-luma-card border border-luma-card-border hover:border-[#f08a5d]/40 rounded-2xl xs:rounded-3xl p-3.5 xs:p-4 sm:p-5 cursor-pointer transition-all group relative overflow-hidden shadow-sm"
        >
          <div className="flex items-center justify-between mb-2 xs:mb-3">
            <span className="text-[10px] xs:text-[11px] font-mono uppercase tracking-wider text-luma-text-dim group-hover:text-[#f08a5d] transition-colors">
              Habits Today
            </span>
            <div className="w-6 h-6 xs:w-7 xs:h-7 rounded-xl bg-[#f08a5d]/10 flex items-center justify-center text-[#f08a5d]">
              <Flame className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl xs:text-2xl sm:text-3xl font-bold tracking-tight text-white mb-1">
            {completedHabitsToday} / {activeHabits.length}
          </div>
          <div className="flex items-center justify-between text-[10px] xs:text-xs font-mono text-luma-text-muted mt-2.5 xs:mt-3">
            <span>Completed Today</span>
            <span className="text-[#f08a5d]">
              🔥 {avgStreak}d avg streak
            </span>
          </div>
        </div>

        {/* Card 4: Weekly Task Completion Percentage Visual */}
        <div
          onClick={() => onSelectTab('tasks')}
          className="bg-luma-card border border-luma-card-border hover:border-emerald-500/40 rounded-2xl xs:rounded-3xl p-3.5 xs:p-4 sm:p-5 cursor-pointer transition-all group relative overflow-hidden shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2 xs:mb-3">
              <span className="text-[10px] xs:text-[11px] font-mono uppercase tracking-wider text-luma-text-dim group-hover:text-emerald-400 transition-colors">
                Weekly Sprint Pacing
              </span>
              <div className="w-6 h-6 xs:w-7 xs:h-7 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Target className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-xl xs:text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
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
          <div className="flex items-center justify-between text-[10px] xs:text-xs font-mono text-luma-text-muted mt-1">
            <span>{totalWeeklyCompleted} / {totalWeeklyTarget || 0} units</span>
            <span className="text-emerald-400">
              {weeklyGoals.length} goals
            </span>
          </div>
        </div>
      </div>

      {/* 3. SECTION: DAILY TIMETABLE FOR EACH WEEK (Weekly Focus Matrix) */}
      <div className="bg-luma-card border border-luma-card-border rounded-2xl xs:rounded-3xl p-3.5 xs:p-4 sm:p-6 lg:p-7 relative overflow-hidden shadow-md">
        {/* Background glow accent */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-luma-purple/5 rounded-full blur-3xl pointer-events-none" />

        {/* Section Header with Week Navigator */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 xs:gap-4 mb-4 xs:mb-6 relative z-10">
          <div>
            <div className="flex items-center gap-1.5 xs:gap-2 mb-1 flex-wrap">
              <span className="text-[11px] xs:text-xs font-mono font-bold uppercase tracking-widest text-luma-purple">
                Weekly Timetable Matrix
              </span>
              <span className="text-[9px] xs:text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-luma-text-dim border border-white/10">
                {weeklyScheduleData?.weekStart} → {weeklyScheduleData?.weekEnd}
              </span>
            </div>
            <h3 className="text-sm xs:text-base sm:text-lg font-semibold text-white tracking-tight">
              7-Day focus commitments & pacing rhythm
            </h3>
          </div>

          {/* Week Navigation Controls */}
          <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 w-full sm:w-auto">
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
              className="flex-1 sm:flex-initial text-center px-3.5 py-2 rounded-xl text-xs font-mono bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer border border-white/5 font-medium"
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

        {/* 7 Columns for Mon -> Sun on Desktop & Interactive Cockpit on Mobile */}
        {loadingWeek ? (
          <div className="py-16 text-center text-xs font-mono text-luma-text-muted">
            Loading weekly matrix...
          </div>
        ) : weeklyScheduleData ? (
          <>
            {/* DESKTOP VIEW: Full 7-Column Matrix (lg: and up) */}
            <div className="hidden lg:grid lg:grid-cols-7 gap-3 relative z-10">
              {weeklyScheduleData.days.map((day) => {
                const isToday = day.isToday;
                const workBlocks = (day.blocks || []).filter((b) => !isBreakOrRestBlock(b));
                const hasBlocks = workBlocks.length > 0;
                const completedCount = workBlocks.filter((b) => b.status === 'done').length;

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
                              className={`px-2 py-1.5 rounded-lg text-[10px] font-mono border transition-all flex items-center justify-between gap-1.5 ${
                                block.status === 'done'
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300/80 line-through'
                                  : block.type === 'deep_focus'
                                  ? 'bg-luma-purple/10 border-luma-purple/20 text-luma-purple'
                                  : 'bg-white/5 border-white/5 text-luma-text-muted'
                              }`}
                              title={`${block.title} (${block.duration}m) — Open in Daily Plan to execute`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                {block.status === 'done' && (
                                  <span className="text-[9px] text-emerald-400 font-bold shrink-0">✓</span>
                                )}
                                <span className="truncate">{block.title}</span>
                              </div>
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
                      <span>{hasBlocks ? `${completedCount}/${workBlocks.length} tasks done` : 'View Day'}</span>
                      <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* MOBILE & TABLET VIEW: Executive 7-Day Scrubber Ribbon + Active Day Cockpit (< lg) */}
            <div className="block lg:hidden relative z-10 space-y-3">
              {/* 7-Day Scrubber Strip */}
              <div className="grid grid-cols-7 gap-1 xs:gap-1.5 p-1 xs:p-1.5 bg-[#121412] rounded-2xl border border-white/[0.06]">
                {weeklyScheduleData.days.map((day) => {
                  const isSelected = activeDay?.date === day.date;
                  const isToday = day.isToday;
                  const hasFocus = day.focusHours > 0;
                  const workBlocks = (day.blocks || []).filter((b) => !isBreakOrRestBlock(b));
                  const completedBlocks = workBlocks.filter((b) => b.status === 'done').length;
                  const allDone = workBlocks.length > 0 && completedBlocks === workBlocks.length;

                  return (
                    <button
                      key={day.dayCode}
                      type="button"
                      onClick={() => setSelectedDayDate(day.date)}
                      className={`py-2 xs:py-2.5 px-0.5 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer select-none relative ${
                        isSelected
                          ? 'bg-luma-purple/20 border-luma-purple/60 text-white shadow-[0_0_12px_rgba(168,85,247,0.25)] ring-1 ring-luma-purple/40'
                          : isToday
                          ? 'bg-white/[0.05] border-luma-lime/40 text-white'
                          : 'bg-transparent hover:bg-white/[0.04] border-transparent text-luma-text-dim hover:text-white'
                      }`}
                    >
                      <span className={`text-[9px] xs:text-[10px] font-mono uppercase font-bold tracking-tight mb-0.5 ${
                        isSelected ? 'text-luma-purple-glow font-extrabold' : isToday ? 'text-luma-lime' : ''
                      }`}>
                        <span className="xs:hidden">{day.dayCode.slice(0, 1)}</span>
                        <span className="hidden xs:inline">{day.dayCode}</span>
                      </span>

                      <span className={`text-xs xs:text-sm font-mono font-bold leading-none mb-1.5 ${
                        isSelected ? 'text-white' : isToday ? 'text-white' : 'text-luma-text-muted'
                      }`}>
                        {day.date.split('-')[2]}
                      </span>

                      <div className="flex items-center justify-center h-2">
                        {isToday ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-luma-lime shadow-[0_0_6px_#d4f938] animate-pulse" />
                        ) : allDone ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                        ) : hasFocus ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-luma-purple shadow-[0_0_6px_rgba(168,85,247,0.5)]" />
                        ) : (
                          <span className="w-1 h-1 rounded-full bg-white/20" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Active Day Cockpit Card */}
              {activeDay && (
                <div className="p-3.5 xs:p-4 sm:p-5 rounded-2xl bg-[#151715]/90 border border-white/10 shadow-lg relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-luma-purple/10 rounded-full blur-2xl pointer-events-none" />

                  {/* Card Header: Day Info & Prev/Next Steppers */}
                  <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-white/[0.06] relative z-10">
                    <div className="flex items-center gap-1.5 xs:gap-2 flex-wrap min-w-0">
                      <span className="text-sm xs:text-base font-bold text-white font-mono">
                        {activeDayFormattedDate}
                      </span>
                      {activeDay.isToday && (
                        <span className="text-[9px] xs:text-[10px] font-mono font-bold bg-luma-lime/15 text-luma-lime px-2 py-0.5 rounded-full border border-luma-lime/30 uppercase tracking-wide">
                          Today
                        </span>
                      )}
                      <span className={`text-[10px] xs:text-[11px] font-mono px-2 py-0.5 rounded-md border ${
                        activeDay.focusHours > 0
                          ? 'bg-luma-lime/10 text-luma-lime border-luma-lime/20'
                          : 'bg-white/5 text-luma-text-dim border-white/5'
                      }`}>
                        {activeDay.focusHours}h focus
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={handlePrevDay}
                        disabled={activeDayIndex <= 0}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:pointer-events-none transition-colors border border-white/5"
                        title="Previous day"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[10px] font-mono text-luma-text-dim px-1">
                        {activeDayIndex + 1}/7
                      </span>
                      <button
                        type="button"
                        onClick={handleNextDay}
                        disabled={activeDayIndex >= (weeklyScheduleData.days.length - 1)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white disabled:opacity-30 disabled:pointer-events-none transition-colors border border-white/5"
                        title="Next day"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Task Pacing Progress Bar (strictly real work tasks, excluding breaks/rest/lunch) */}
                  {(() => {
                    const activeDayWorkBlocks = (activeDay.blocks || []).filter((b) => !isBreakOrRestBlock(b));
                    const completedWorkCount = activeDayWorkBlocks.filter((b) => b.status === 'done').length;
                    const workPacingRate = activeDayWorkBlocks.length > 0
                      ? Math.round((completedWorkCount / activeDayWorkBlocks.length) * 100)
                      : 0;

                    if (activeDayWorkBlocks.length === 0) return null;

                    return (
                      <div className="mb-3 relative z-10">
                        <div className="flex items-center justify-between text-[10px] xs:text-xs font-mono text-luma-text-muted mb-1.5">
                          <span>Task Pacing</span>
                          <span className="text-white font-medium">
                            {completedWorkCount} / {activeDayWorkBlocks.length} tasks completed
                            ({workPacingRate}%)
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500 bg-luma-purple shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                            style={{
                              width: `${workPacingRate}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Scheduled Blocks List */}
                  {activeDay.blocks && activeDay.blocks.length > 0 ? (
                    <div className="space-y-1.5 xs:space-y-2 mb-3.5 relative z-10 max-h-56 overflow-y-auto pr-0.5">
                      {activeDay.blocks.map((block) => {
                        const isBreak = isBreakOrRestBlock(block);
                        const isDone = !isBreak && block.status === 'done';
                        return (
                          <div
                            key={block.id}
                            onClick={() => {
                              if (onSelectDay) {
                                onSelectDay(activeDay.date);
                              }
                            }}
                            className={`p-2 xs:p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                              isBreak
                                ? 'bg-[#291a13]/60 border-[#442b1f] text-[#f7ad72] hover:border-[#5a3828]'
                                : isDone
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                                : block.type === 'deep_focus'
                                ? 'bg-luma-purple/10 border-luma-purple/30 text-white hover:border-luma-purple/50'
                                : 'bg-white/[0.04] border-white/10 text-white hover:border-white/20'
                            }`}
                            title={`${block.title} (${block.duration}m) — Open in Daily Plan to view`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isBreak ? (
                                <span className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0 bg-[#3d2417] text-[#f7ad72] text-xs">
                                  ☕
                                </span>
                              ) : isDone ? (
                                <span className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0 bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-[10px] font-bold">
                                  ✓
                                </span>
                              ) : (
                                <div className="w-2 h-2 rounded-full shrink-0 ml-1.5 mr-1.5 bg-luma-purple/60" />
                              )}
                              <span className={`text-xs font-medium truncate ${isBreak ? 'text-[#f7ad72]/90' : isDone ? 'line-through text-emerald-300/70' : 'text-white'}`}>
                                {block.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono">
                              {isBreak ? (
                                <span className="px-1.5 py-0.5 rounded bg-[#3d2417] text-[#f7ad72] text-[9px] uppercase font-semibold">
                                  Recharge
                                </span>
                              ) : block.type === 'deep_focus' ? (
                                <span className="hidden xs:inline px-1.5 py-0.5 rounded bg-luma-purple/20 text-luma-purple border border-luma-purple/30 text-[9px] uppercase">
                                  Deep
                                </span>
                              ) : null}
                              <span className="text-luma-text-dim px-1.5 py-0.5 rounded bg-white/5">
                                {block.duration}m
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-5 px-3 text-center rounded-xl bg-white/[0.02] border border-white/5 mb-3.5 relative z-10">
                      <p className="text-xs font-mono text-luma-text-dim mb-1">
                        No timetable blocks planned for this day.
                      </p>
                      <p className="text-[11px] text-luma-text-dim/60">
                        Shape your schedule with AI focus blocks or open the daily planner.
                      </p>
                    </div>
                  )}

                  {/* Action Bar Footer */}
                  <div className="flex items-center gap-2 pt-2 border-t border-white/[0.04] relative z-10">
                    {onOpenShapeMyDay && (
                      <button
                        type="button"
                        onClick={() => onOpenShapeMyDay(activeDay.date)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-luma-lime hover:bg-luma-lime-hover text-black text-xs font-semibold shadow-lime-glow transition-all cursor-pointer min-h-[44px]"
                      >
                        <Sparkles className="w-3.5 h-3.5 stroke-[2.2]" />
                        <span>Shape with AI</span>
                      </button>
                    )}

                    {onSelectDay && (
                      <button
                        type="button"
                        onClick={() => onSelectDay(activeDay.date)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-white border border-white/10 transition-all cursor-pointer min-h-[44px]"
                      >
                        <span>Daily Plan</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>

      {/* 4. DUAL SECTION: MONTHLY & YEARLY PERFORMANCE LINE GRAPHS */}
      <div className="space-y-4 xs:space-y-6">
        {/* Section Header with Horizon Switcher & Period Navigator */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 xs:gap-4 p-3.5 xs:p-4 sm:p-6 bg-luma-card border border-luma-card-border rounded-2xl xs:rounded-3xl shadow-sm">
          <div>
            <div className="flex items-center gap-1.5 xs:gap-2 mb-1 flex-wrap">
              <span className="text-[11px] xs:text-xs font-mono font-bold uppercase tracking-widest text-luma-lime">
                Performance Trajectory
              </span>
              <span className="text-[9px] xs:text-[10px] font-mono px-2 xs:px-2.5 py-0.5 rounded-full bg-white/5 text-white border border-white/10">
                {performanceHorizon === 'monthly' ? graphMonthLabel : `${selectedGraphYear} Annual Horizon`}
              </span>
            </div>
            <h3 className="text-sm xs:text-base sm:text-lg font-semibold text-white tracking-tight">
              {performanceHorizon === 'monthly'
                ? 'Habit & Timetable Task Points Progression'
                : 'Annual 12-Month Habit & Timetable Growth Curves'}
            </h3>
            <p className="text-[11px] xs:text-xs text-luma-text-muted mt-0.5">
              {performanceHorizon === 'monthly'
                ? 'Daily point accumulation trends across the 30/31-day monthly horizon.'
                : 'Macro monthly comparison and annual pacing across all 12 months.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 xs:gap-3 w-full lg:w-auto">
            {/* Horizon Switcher (Monthly vs Yearly) */}
            <div className="flex items-center bg-[#151715] p-1 rounded-xl xs:rounded-2xl border border-white/10 shadow-inner w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setPerformanceHorizon('monthly')}
                className={`flex-1 sm:flex-initial text-center px-2.5 xs:px-3 py-1.5 rounded-lg xs:rounded-xl text-[11px] xs:text-xs font-mono transition-all cursor-pointer ${
                  performanceHorizon === 'monthly'
                    ? 'bg-luma-lime text-black font-bold shadow-lime-glow'
                    : 'text-luma-text-muted hover:text-white'
                }`}
              >
                📅 Monthly (30d)
              </button>
              <button
                type="button"
                onClick={() => setPerformanceHorizon('yearly')}
                className={`flex-1 sm:flex-initial text-center px-2.5 xs:px-3 py-1.5 rounded-lg xs:rounded-xl text-[11px] xs:text-xs font-mono transition-all cursor-pointer ${
                  performanceHorizon === 'yearly'
                    ? 'bg-luma-lime text-black font-bold shadow-lime-glow'
                    : 'text-luma-text-muted hover:text-white'
                }`}
              >
                🌍 Yearly (12m)
              </button>
            </div>

            {/* Navigator Controls */}
            {performanceHorizon === 'monthly' ? (
              <div className="flex items-center justify-between sm:justify-start gap-1.5 w-full sm:w-auto">
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
                  className="flex-1 sm:flex-initial text-center px-3.5 py-2 rounded-xl text-xs font-mono bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer border border-white/5 font-medium"
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
            ) : (
              <div className="flex items-center justify-between sm:justify-start gap-1.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handlePrevYear}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer border border-white/5"
                  title="Previous year"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleCurrentYear}
                  className="flex-1 sm:flex-initial text-center px-3.5 py-2 rounded-xl text-xs font-mono bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer border border-white/5 font-medium"
                >
                  This Year
                </button>
                <button
                  type="button"
                  onClick={handleNextYear}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer border border-white/5"
                  title="Next year"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Dual Line Graphs Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {performanceHorizon === 'monthly' ? (
            <>
              {/* Chart 1: Monthly Habit Points Line Graph */}
              <MonthlyPointsLineChart
                title="Monthly Habit Points Curve"
                subtitle="1 point per completed habit daily"
                badgeLabel="HABIT CADENCE"
                colorScheme="lime"
                horizon="monthly"
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
                horizon="monthly"
                points={taskPointsData?.points || []}
                maxY={
                  taskPointsData?.points?.length
                    ? Math.max(...taskPointsData.points.map((p) => p.points), 5)
                    : 6
                }
                yUnitLabel="tasks"
                isLoading={loadingPoints}
              />
            </>
          ) : (
            <>
              {/* Chart 1: Annual Habit Cadence Curve */}
              <MonthlyPointsLineChart
                title="Annual Habit Cadence Curve"
                subtitle="Monthly habit completion volume across 12 months"
                badgeLabel="ANNUAL CADENCE"
                colorScheme="lime"
                horizon="yearly"
                points={yearlyHabitPointsData}
                maxY={
                  yearlyHabitPointsData.length
                    ? Math.max(...yearlyHabitPointsData.map((p) => p.points), 10)
                    : 10
                }
                yUnitLabel="pts"
                isLoading={loadingYearlyPoints}
                onSelectNode={handleDrillDownMonth}
              />

              {/* Chart 2: Annual Timetable Execution Curve */}
              <MonthlyPointsLineChart
                title="Annual Timetable Execution Curve"
                subtitle="Monthly scheduled focus task output across 12 months"
                badgeLabel="ANNUAL EXECUTION"
                colorScheme="purple"
                horizon="yearly"
                points={yearlyTaskPointsData}
                maxY={
                  yearlyTaskPointsData.length
                    ? Math.max(...yearlyTaskPointsData.map((p) => p.points), 10)
                    : 10
                }
                yUnitLabel="tasks"
                isLoading={loadingYearlyPoints}
                onSelectNode={handleDrillDownMonth}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
