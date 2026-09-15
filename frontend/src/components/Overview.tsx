import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Compass, Briefcase, Sparkles, CheckCircle2 } from 'lucide-react';
import { Goal, Habit, ScheduleBlock, StatsResponse, isTimeWithinBlock } from '../services/api';
import { getCategoryBadge } from './LearningPaths';
import { DailyAnchorsCard } from './DailyAnchorsCard';

interface OverviewProps {
  schedule: ScheduleBlock[];
  habits?: Habit[];
  goals: Goal[];
  stats: StatsResponse | null;
  onSelectTab: (tab: any) => void;
  onSelectGoal?: (goalId: string) => void;
  onToggleScheduleStatus?: (id: string) => void;
  onToggleHabit?: (habitId: string) => void | Promise<void>;
  onOpenShapeMyDay?: () => void;
}

export const Overview: React.FC<OverviewProps> = ({
  schedule,
  habits = [],
  goals,
  stats,
  onSelectTab,
  onSelectGoal,
  onToggleScheduleStatus,
  onToggleHabit,
  onOpenShapeMyDay,
}) => {
  const savedWorkHours = useMemo(() => {
    try {
      const raw = localStorage.getItem('luma_default_work_hours');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);
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

  // Real-time synchronization directly from active schedule
  const activeBlocks = schedule.filter(s => s.type !== 'break');
  const doneBlocks = activeBlocks.filter(s => s.status === 'done');
  const nextPendingBlock = activeBlocks.find(s => s.status === 'pending' && s.end_time >= currentHHMM) || activeBlocks.find(s => s.status === 'pending');

  const focusMinutes = schedule
    .filter(s => s.type === 'deep_focus')
    .reduce((sum, s) => sum + s.duration, 0);
  const focusHrs = Math.floor(focusMinutes / 60);
  const focusMins = focusMinutes % 60;
  const protectedFocusFormatted = focusMinutes > 0 
    ? `${focusHrs}h ${focusMins}m` 
    : (stats?.protectedFocus.totalMinutes ? stats.protectedFocus.formatted : '0h 0m');

  const promisesFormatted = activeBlocks.length > 0
    ? `${doneBlocks.length}/${activeBlocks.length}`
    : (stats?.promisesKept.total ? stats.promisesKept.formatted : '0/0');

  const nextSessionTime = nextPendingBlock ? nextPendingBlock.start_time : (activeBlocks.length > 0 ? 'All done' : 'None scheduled');

  const rhythmRate = activeBlocks.length > 0
    ? Math.round((doneBlocks.length / activeBlocks.length) * 100)
    : (stats?.weeklyRhythm.rate || 0);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Title */}
      <div>
        <h1 className="text-4xl md:text-5xl font-serif text-white tracking-tight">
          Make today <span className="italic font-serif text-glow-purple text-luma-purple-glow">count.</span>
        </h1>
      </div>

      {/* Top Metrics Row - Interlinked */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-2">
        {/* Metric 1 -> Daily Plan */}
        <div
          onClick={() => onSelectTab('daily')}
          className="cursor-pointer group hover:opacity-90 transition-all p-3 rounded-2xl hover:bg-white/[0.02]"
          title="Click to open Daily Plan"
        >
          <div className="text-[11px] font-mono tracking-wider uppercase text-luma-text-dim mb-1 group-hover:text-luma-lime transition-colors">
            Protected Focus
          </div>
          <div className="text-3xl font-bold tracking-tight text-white mb-1">
            {protectedFocusFormatted}
          </div>
          <div className="text-xs font-medium text-luma-purple">
            {activeBlocks.length === 0 ? '0m' : (stats?.protectedFocus.difference || '0m')}
          </div>
        </div>

        {/* Metric 2 -> Daily Plan */}
        <div
          onClick={() => onSelectTab('daily')}
          className="cursor-pointer group hover:opacity-90 transition-all p-3 rounded-2xl hover:bg-white/[0.02]"
          title="Click to view daily commitments"
        >
          <div className="text-[11px] font-mono tracking-wider uppercase text-luma-text-dim mb-1 group-hover:text-luma-lime transition-colors">
            Promises Kept
          </div>
          <div className="text-3xl font-bold tracking-tight text-white mb-1">
            {promisesFormatted}
          </div>
          <div className="text-xs font-medium text-luma-text-muted">
            {nextSessionTime === 'None scheduled' || nextSessionTime === 'All done' ? nextSessionTime : `Next at ${nextSessionTime}`}
          </div>
        </div>

        {/* Metric 3 -> Patterns */}
        <div
          onClick={() => onSelectTab('patterns')}
          className="cursor-pointer group hover:opacity-90 transition-all p-3 rounded-2xl hover:bg-white/[0.02]"
          title="Click to view completion patterns & trends"
        >
          <div className="text-[11px] font-mono tracking-wider uppercase text-luma-text-dim mb-1 group-hover:text-luma-purple transition-colors">
            Weekly Rhythm
          </div>
          <div className="text-3xl font-bold tracking-tight text-white mb-1">
            {rhythmRate}%
          </div>
          <div className="text-xs font-medium text-luma-purple flex items-center gap-1">
            {rhythmRate > 0 && <span>↑</span>}
            <span>{rhythmRate === 0 ? '0%' : (stats?.weeklyRhythm.diff || '0%')}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Your Day & Long View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Your day, in rhythm (7 cols) */}
        <div className="lg:col-span-7 bg-luma-card border border-luma-card-border rounded-3xl p-6 relative">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
            <h2
              onClick={() => onSelectTab('daily')}
              className="text-base font-semibold text-white tracking-tight cursor-pointer hover:text-luma-lime transition-colors"
              title="Open full daily sequence"
            >
              Your day, in rhythm →
            </h2>
            <div className="flex items-center gap-2">
              {savedWorkHours?.workStartTime && savedWorkHours?.workEndTime && (
                <span className="text-[11px] font-mono text-luma-lime bg-[#252824] px-2.5 py-1 rounded-full border border-white/5 flex items-center gap-1.5">
                  <Briefcase className="w-3 h-3 text-luma-lime" />
                  <span>{savedWorkHours.workStartTime} – {savedWorkHours.workEndTime}</span>
                </span>
              )}
              {schedule.length > 0 ? (
                <span className="text-[11px] font-mono tracking-wider uppercase text-luma-text-muted bg-[#212421] px-2.5 py-1 rounded-full border border-white/5">
                  @{focusHrs}h {focusMins}m TOTAL FOCUS
                </span>
              ) : (
                <span className="text-[11px] font-mono tracking-wider uppercase text-luma-text-dim bg-[#212421] px-2.5 py-1 rounded-full border border-white/5">
                  UNSHAPED
                </span>
              )}
            </div>
          </div>

          {/* Timeline Sequence */}
          {schedule.length > 0 ? (
            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-3 before:bottom-3 before:w-[2px] before:bg-[#252825]">
              {schedule.map((item) => {
                const isBreak = item.type === 'break';
                const isDone = item.status === 'done';
                const isCurrentlyActive = isTimeWithinBlock(currentHHMM, item.start_time, item.end_time);

                // Dot colors
                const dotColor = isCurrentlyActive
                  ? 'border-luma-lime bg-luma-lime shadow-[0_0_10px_#d4f938]'
                  : isBreak
                  ? 'border-[#d9822b] bg-[#342014]'
                  : isDone
                  ? 'border-luma-lime bg-luma-lime'
                  : 'border-luma-purple bg-luma-purple-dim';

                // Card styling
                const cardBg = isCurrentlyActive
                  ? 'bg-[#1b2618] border-luma-lime shadow-[0_0_15px_rgba(212,249,56,0.18)] text-white'
                  : isBreak
                  ? 'bg-[#291a13] border-[#442b1f] text-[#f7ad72]'
                  : isDone
                  ? 'bg-[#1b221a] border-[#293627] text-white opacity-80'
                  : 'bg-[#211e38] border-[#342f59] text-white';

                const durationColor = isCurrentlyActive
                  ? 'text-luma-lime font-bold'
                  : isBreak
                  ? 'text-[#e6934c]'
                  : 'text-luma-purple';

                return (
                  <div key={item.id} className="relative flex items-center gap-4 group">
                    {/* Timeline Dot */}
                    <div
                      className={`absolute -left-[27px] w-3.5 h-3.5 rounded-full border-2 ${dotColor} transition-transform group-hover:scale-125 z-10`}
                    />

                    {/* Start Time */}
                    <span className="w-12 text-xs font-mono text-luma-text-muted shrink-0">
                      {item.start_time}
                    </span>

                    {/* Task Card */}
                    <div
                      onClick={() => onToggleScheduleStatus && onToggleScheduleStatus(item.id)}
                      className={`flex-1 flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer hover:brightness-110 ${cardBg}`}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        {isDone && (
                          <CheckCircle2 className="w-4 h-4 text-luma-lime shrink-0" />
                        )}
                        <span className={`text-sm font-medium ${isDone ? 'line-through text-white/60' : ''}`}>
                          {item.title}
                        </span>
                        {isCurrentlyActive && (
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-luma-lime text-black font-bold tracking-wider flex items-center gap-1 shadow-sm animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                            ACTIVE NOW
                          </span>
                        )}
                        {item.block_source === 'habit' && (
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-luma-purple-dim text-luma-purple border border-luma-purple/30">
                            HABIT
                          </span>
                        )}
                        {item.block_source === 'weekly_goal' && (
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[#242b10] text-luma-lime border border-luma-lime/30">
                            WEEKLY GOAL
                          </span>
                        )}
                        {item.block_source === 'long_term_goal' && (
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[#1b2535] text-[#60a5fa] border border-[#60a5fa]/30">
                            LONG-TERM GOAL
                          </span>
                        )}
                        {item.block_source === 'daily_todo' && (
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-luma-text-muted border border-white/10">
                            TO-DO
                          </span>
                        )}
                      </div>
                      {item.target_label ? (
                        <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 ${isCurrentlyActive ? 'text-luma-lime border-luma-lime/40' : 'text-luma-lime'}`}>
                          {item.target_label}
                        </span>
                      ) : item.is_untimed || item.duration === 0 ? (
                        <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 flex items-center gap-1 ${isCurrentlyActive ? 'text-luma-lime border-luma-lime/40' : 'text-luma-text-dim'}`}>
                          <span className={isCurrentlyActive ? 'text-luma-lime' : ''}>⚡</span>
                          <span className={isCurrentlyActive ? 'text-luma-lime font-bold' : ''}>Action item</span>
                        </span>
                      ) : (
                        <span className={`text-xs font-mono font-semibold uppercase tracking-wider ${durationColor}`}>
                          {item.duration} MIN
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-14 px-4 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-[#212421] flex items-center justify-center mx-auto text-luma-text-muted border border-white/5 shadow-inner">
                <Calendar className="w-6 h-6 stroke-[1.5]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white">No commitments scheduled</h3>
                <p className="text-xs text-luma-text-muted max-w-sm mx-auto leading-relaxed">
                  Your daily timetable has not been generated yet. Use Shape My Day to craft your custom focus sequence.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                {onOpenShapeMyDay && (
                  <button
                    onClick={onOpenShapeMyDay}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-luma-lime hover:bg-luma-lime-hover text-black text-xs font-semibold shadow-lime-glow active:scale-95 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 stroke-[2.2]" />
                    <span>Shape my day with AI →</span>
                  </button>
                )}
                <button
                  onClick={() => onSelectTab('tasks')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-white border border-white/10 transition-all"
                >
                  <span>Add tasks & habits</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Daily Anchors & Long view (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Daily Anchors & Lifestyle Targets */}
          <DailyAnchorsCard habits={habits} onToggleHabit={onToggleHabit || (async () => {})} />

          {/* Card 2: Long view */}
          <div className="bg-luma-card border border-luma-card-border rounded-3xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-white tracking-tight">
                Long view
              </h2>
              <span className="text-[11px] font-mono tracking-wider uppercase text-luma-text-muted bg-[#212421] px-2.5 py-1 rounded-full border border-white/5">
                {goals.length} ACTIVE
              </span>
            </div>

            {/* Goal List */}
            {goals.length > 0 ? (
              <div className="space-y-6">
                {goals.map((goal, idx) => {
                  const progress = Math.min(100, Math.round((goal.covered_units / Math.max(goal.total_units, 1)) * 100));

                  // Colors based on mock
                  const barColors = [
                    'bg-luma-purple shadow-[0_0_12px_rgba(123,110,246,0.5)]',
                    'bg-luma-lime shadow-[0_0_12px_rgba(212,249,56,0.4)]',
                    'bg-[#f08a5d] shadow-[0_0_12px_rgba(240,138,93,0.4)]',
                  ];
                  const barColor = barColors[idx % barColors.length];

                  // Target days remaining calculation
                  const target = new Date(goal.target_date).getTime();
                  const now = new Date().getTime();
                  const daysLeft = Math.max(0, Math.ceil((target - now) / (1000 * 60 * 60 * 24)));

                  return (
                    <div
                      key={goal.id}
                      onClick={() => {
                        if (onSelectGoal) onSelectGoal(goal.id);
                        onSelectTab('learning');
                      }}
                      className="p-3 rounded-2xl hover:bg-white/[0.04] border border-transparent hover:border-white/10 cursor-pointer transition-all group"
                      title="Click to view detailed roadmap in Projects & Goals"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white group-hover:text-luma-lime transition-colors">
                            {goal.title} →
                          </span>
                          {goal.category && (
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border ${getCategoryBadge(goal.category).color}`}>
                              {getCategoryBadge(goal.category).label}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono font-medium text-[#f08a5d]">
                          {daysLeft} days
                        </span>
                      </div>

                      {/* Bar */}
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
              <div className="py-12 px-4 text-center space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-[#212421] flex items-center justify-center mx-auto text-luma-text-muted border border-white/5">
                  <Compass className="w-5 h-5 stroke-[1.5]" />
                </div>
                <h3 className="text-sm font-semibold text-white">No active projects or goals</h3>
                <p className="text-xs text-luma-text-muted max-w-xs mx-auto leading-relaxed">
                  Configure projects, business initiatives, or exam runways in Projects & Goals.
                </p>
                <button
                  onClick={() => onSelectTab('learning')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-white border border-white/10 transition-all"
                >
                  <span>Open Projects & Goals →</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Card: Consistency is becoming a pattern -> navigates to Patterns */}
      <div
        onClick={() => onSelectTab('patterns')}
        className="bg-luma-card border border-luma-card-border hover:border-white/20 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 cursor-pointer transition-all group"
        title="Click to open Patterns & Analytics"
      >
        <div className="max-w-xl">
          <h3 className="text-base font-semibold text-white tracking-tight mb-1 group-hover:text-luma-purple transition-colors">
            Consistency is becoming a pattern →
          </h3>
          <p className="text-sm text-luma-text-muted leading-relaxed">
            <span className="text-white font-medium">{rhythmRate}% completion</span> across the past week. Your protected focus blocks are holding especially well.
          </p>
        </div>

        {/* Mini 7-Day Bar Chart */}
        <div className="flex items-end gap-3.5 pt-2">
          {(stats?.weeklyPatternDays || [
            { day: 'M', heightPercent: 0 },
            { day: 'T', heightPercent: 0 },
            { day: 'W', heightPercent: 0 },
            { day: 'T', heightPercent: 0 },
            { day: 'F', heightPercent: 0 },
            { day: 'S', heightPercent: 0 },
            { day: 'S', heightPercent: 0 },
          ]).map((bar, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="w-4 h-16 bg-[#212421] rounded-t-sm flex items-end overflow-hidden">
                <div
                  className="w-full bg-luma-purple rounded-t-sm shadow-[0_0_8px_rgba(123,110,246,0.3)] transition-all duration-500 hover:brightness-125"
                  style={{ height: `${bar.heightPercent}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-luma-text-dim uppercase">
                {bar.day}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
