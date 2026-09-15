import React, { useState, useEffect, useMemo } from 'react';
import { SlidersHorizontal, CheckCircle2, Circle, Play, Sparkles, Calendar, Briefcase } from 'lucide-react';
import { Habit, ScheduleBlock, isTimeWithinBlock } from '../services/api';
import { DailyAnchorsCard } from './DailyAnchorsCard';

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

// Compute dynamic current week starting from Monday
const computeCurrentWeekDays = () => {
  const now = new Date();
  const dayIdx = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const distToMonday = dayIdx === 0 ? -6 : 1 - dayIdx;
  const monday = new Date(now);
  monday.setDate(now.getDate() + distToMonday);

  return dayNames.map((code, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);
    const dateNum = String(d.getDate()).padStart(2, '0');
    const isToday = d.toDateString() === now.toDateString();
    return {
      day: code,
      date: dateNum,
      isToday,
      hasDot: isToday,
      fullDate: d,
    };
  });
};

interface DailyPlanProps {
  schedule: ScheduleBlock[];
  habits?: Habit[];
  onToggleStatus: (id: string) => void;
  onToggleHabit?: (habitId: string) => void | Promise<void>;
  onStartFocus: (taskTitle: string, durationMinutes: number, blockId?: string) => void;
  onAdjustCapacity: () => void;
  onOpenShapeMyDay?: () => void;
}

export const DailyPlan: React.FC<DailyPlanProps> = ({
  schedule,
  habits = [],
  onToggleStatus,
  onToggleHabit,
  onStartFocus,
  onAdjustCapacity,
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
  const now = new Date();
  const todayDayMap: Record<number, DayCode> = {
    0: 'SUN',
    1: 'MON',
    2: 'TUE',
    3: 'WED',
    4: 'THU',
    5: 'FRI',
    6: 'SAT',
  };
  const todayCode = todayDayMap[now.getDay()];

  const [selectedDay, setSelectedDay] = useState<DayCode>(todayCode);
  const weekDays = computeCurrentWeekDays();

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

  // Dynamic protected focus calculation
  const focusMinutes = schedule
    .filter(s => s.type === 'deep_focus')
    .reduce((sum, s) => sum + s.duration, 0);
  const focusHrs = Math.floor(focusMinutes / 60);
  const focusMins = focusMinutes % 60;
  const totalProtectedText = focusMinutes > 0 ? `${focusHrs}H ${focusMins}M PROTECTED` : '0H 0M PROTECTED';

  // Find next pending protected block based on real time
  const isSelectedToday = selectedDay === todayCode;
  const nextBlock = schedule.length > 0 ? ((isSelectedToday
    ? schedule.find(s => s.status === 'pending' && s.type === 'deep_focus' && s.end_time >= currentHHMM)
    : null) || schedule.find(s => s.status === 'pending' && s.type === 'deep_focus') || schedule[0]) : null;

  const sequenceTitle = isSelectedToday ? "Today's sequence" : `${fullDayNames[selectedDay]}'s sequence`;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-mono tracking-widest uppercase text-luma-text-dim mb-1">
            Your Focused Week
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-white tracking-tight mb-2">
            Daily plan
          </h1>
          <p className="text-sm text-luma-text-muted">
            One clear commitment at a time.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {onOpenShapeMyDay && (
            <button
              onClick={onOpenShapeMyDay}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-luma-lime hover:bg-luma-lime-hover text-black text-xs font-semibold shadow-lime-glow active:scale-95 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Shape my day</span>
            </button>
          )}
          <button
            onClick={onAdjustCapacity}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-luma-card border border-luma-card-border hover:bg-white/[0.04] text-xs font-medium text-white transition-all"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-luma-text-muted" />
            <span>Adjust capacity</span>
          </button>
        </div>
      </div>

      {/* Weekday Selector Bar */}
      <div className="bg-luma-card border border-luma-card-border rounded-3xl p-3 flex items-center justify-between">
        {weekDays.map((item) => {
          const isSelected = selectedDay === item.day;
          return (
            <button
              key={item.day}
              onClick={() => setSelectedDay(item.day)}
              className={`flex-1 flex flex-col items-center py-3.5 px-2 rounded-2xl transition-all ${
                isSelected
                  ? 'bg-luma-cream text-luma-cream-text shadow-sm'
                  : 'text-luma-text-muted hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <span className="text-[10px] font-mono uppercase tracking-wider mb-1">
                {item.day}
              </span>
              <div className="flex items-center gap-1 font-mono text-sm font-semibold">
                <span>{item.date}</span>
                {item.hasDot && !isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-luma-lime shadow-[0_0_6px_#d4f938]"></span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Sequence (7 cols) */}
        <div className="lg:col-span-7 bg-luma-card border border-luma-card-border rounded-3xl p-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
            <h2 className="text-base font-semibold text-white tracking-tight">
              {sequenceTitle}
            </h2>
            <div className="flex items-center gap-2">
              {savedWorkHours?.workStartTime && savedWorkHours?.workEndTime && (
                <span className="text-[11px] font-mono text-luma-lime bg-[#252824] px-2.5 py-1 rounded-full border border-white/5 flex items-center gap-1.5">
                  <Briefcase className="w-3 h-3 text-luma-lime" />
                  <span>{savedWorkHours.workStartTime} – {savedWorkHours.workEndTime}</span>
                </span>
              )}
              {schedule.length > 0 ? (
                <span className="text-xs font-mono tracking-wider uppercase text-luma-text-muted">
                  {totalProtectedText}
                </span>
              ) : (
                <span className="text-[11px] font-mono tracking-wider uppercase text-luma-text-dim bg-[#212421] px-2.5 py-1 rounded-full border border-white/5">
                  UNSHAPED
                </span>
              )}
            </div>
          </div>

          {/* Sequence List with Timeline Spine */}
          {schedule.length > 0 ? (
            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-3 before:bottom-3 before:w-[2px] before:bg-[#252825]">
              {schedule.map((item) => {
                const isDone = item.status === 'done';
                const isBreak = item.type === 'break';
                const isCurrentlyActive = isSelectedToday && isTimeWithinBlock(currentHHMM, item.start_time, item.end_time);

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
                  : isDone
                  ? 'text-luma-lime'
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
                      onClick={() => onToggleStatus(item.id)}
                      className={`flex-1 flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer hover:brightness-110 ${cardBg}`}
                    >
                      <div className="flex items-center gap-3.5">
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5 text-luma-lime shrink-0" />
                        ) : (
                          <Circle className="w-5 h-5 text-luma-text-dim hover:text-white shrink-0" />
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${isDone ? 'line-through opacity-60' : ''}`}>
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
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
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
                          <span
                            className={`text-xs font-mono font-semibold uppercase tracking-wider ${durationColor}`}
                          >
                            {item.duration} MIN
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center rounded-2xl border border-dashed border-white/10 bg-[#161716]/60 flex flex-col items-center justify-center my-2">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-luma-text-dim mb-3">
                <Calendar className="w-6 h-6 stroke-[1.5]" />
              </div>
              <p className="text-sm font-medium text-white mb-1">No schedule for {isSelectedToday ? 'today' : fullDayNames[selectedDay]}</p>
              <p className="text-xs text-luma-text-muted max-w-sm mb-4">
                Your daily timetable has not been generated yet. Click below to shape your day with AI.
              </p>
              {onOpenShapeMyDay && (
                <button
                  onClick={onOpenShapeMyDay}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-luma-lime text-black font-semibold text-xs shadow-lime-glow hover:bg-luma-lime-hover transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5 stroke-[2]" />
                  <span>Shape my day with AI</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Anchors + Next Protected Block & Why this works (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Daily Anchors & Lifestyle Targets */}
          <DailyAnchorsCard habits={habits} onToggleHabit={onToggleHabit || (async () => {})} />

          {/* Card 2: Next Protected Block Spotlight */}
          <div className="relative overflow-hidden bg-gradient-to-br from-[#f5f1e8] to-[#e8e2d5] text-luma-cream-text rounded-3xl p-7 shadow-md">
            {/* Soft decorative background purple blob */}
            <div className="absolute -bottom-10 -right-10 w-44 h-44 rounded-full bg-[#9f8ff5]/40 blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-28 h-28 rounded-tl-full bg-[#9f8ff5]/30 pointer-events-none" />

            <div className="relative z-10">
              {schedule.length === 0 ? (
                <>
                  <div className="text-[10px] font-mono tracking-widest uppercase text-[#5a604f] mb-3">
                    NO COMMITMENTS SCHEDULED
                  </div>

                  <h3 className="text-2xl font-serif font-bold text-[#141514] tracking-tight mb-1">
                    Your canvas is clear.
                  </h3>

                  <p className="text-xs text-[#52574e] mb-6">
                    Add tasks, daily habits, or weekly goals to generate an energy-aligned timetable.
                  </p>

                  {onOpenShapeMyDay && (
                    <button
                      onClick={onOpenShapeMyDay}
                      className="flex items-center gap-2 bg-luma-lime hover:bg-luma-lime-hover text-black px-5 py-3 rounded-2xl font-semibold text-xs shadow-md active:scale-95 transition-all"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Shape my day</span>
                    </button>
                  )}
                </>
              ) : nextBlock ? (
                <>
                  <div className="text-[10px] font-mono tracking-widest uppercase text-[#5a604f] mb-3">
                    NEXT PROTECTED BLOCK · {nextBlock.start_time}
                  </div>

                  <h3 className="text-2xl font-serif font-bold text-[#141514] tracking-tight mb-1">
                    {nextBlock.title.split('·')[0].trim()}, uninterrupted.
                  </h3>

                  <p className="text-xs text-[#52574e] mb-6">
                    {nextBlock.duration} minutes for {nextBlock.category}.
                  </p>

                  <button
                    onClick={() => onStartFocus(nextBlock.title, nextBlock.duration, nextBlock.id)}
                    className="flex items-center gap-2 bg-luma-lime hover:bg-luma-lime-hover text-black px-5 py-3 rounded-2xl font-semibold text-xs shadow-md active:scale-95 transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-black" />
                    <span>Begin focus session</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="text-[10px] font-mono tracking-widest uppercase text-[#5a604f] mb-3">
                    RHYTHM ACHIEVED · ALL BLOCKS COMPLETED
                  </div>

                  <h3 className="text-2xl font-serif font-bold text-[#141514] tracking-tight mb-1">
                    Outstanding consistency.
                  </h3>

                  <p className="text-xs text-[#52574e] mb-6">
                    All scheduled focus commitments for today have been fulfilled. Time to step away & recharge.
                  </p>

                  <div className="inline-flex items-center gap-2 bg-[#252824] text-luma-lime px-4 py-2.5 rounded-2xl text-xs font-mono font-semibold">
                    <span>✓ 100% Kept Today</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Card 2: Why this works */}
          <div className="bg-luma-card border border-luma-card-border rounded-3xl p-6">
            <div className="text-[10px] font-mono tracking-widest uppercase text-luma-text-dim mb-3">
              Why this works
            </div>
            <p className="text-xs text-luma-text-muted leading-relaxed">
              {schedule.length > 0 ? (
                <>
                  <strong className="text-white font-medium">Energy-aligned:</strong> deeper work sits before coaching. The light review is intentionally saved for your post-lunch dip.
                </>
              ) : (
                <>
                  <strong className="text-white font-medium">Intentional planning:</strong> Luma aligns deep focus blocks with your natural circadian peak, leaving space for breaks and habit formation once commitments are added.
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
