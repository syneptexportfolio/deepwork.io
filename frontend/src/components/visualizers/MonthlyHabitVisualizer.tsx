import React, { useMemo } from 'react';
import { Flame, Calendar, Sun, Moon, Target, Sparkles, Award, Zap } from 'lucide-react';
import { Habit } from '../../services/api';

interface MonthlyHabitVisualizerProps {
  habits: Habit[];
}

export const MonthlyHabitVisualizer: React.FC<MonthlyHabitVisualizerProps> = ({ habits }) => {
  const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

  const totalHabits = habits.length;
  const activeHabits = habits.filter((h) => h.is_active);
  const todayCompletedHabits = activeHabits.filter((h) => h.last_completed_date === todayIST).length;
  const todayCompletionPercent = activeHabits.length > 0
    ? Math.round((todayCompletedHabits / activeHabits.length) * 100)
    : 0;

  // Streak metrics
  const bestStreak = habits.length > 0
    ? Math.max(0, ...habits.map((h) => h.streak_count || 0))
    : 0;
  const activeStreakSum = activeHabits.reduce((sum, h) => sum + (h.streak_count || 0), 0);
  const averageStreak = activeHabits.length > 0
    ? Math.round(activeStreakSum / activeHabits.length)
    : 0;

  // Anchor Distribution
  const morningCount = activeHabits.filter((h) => h.anchor === 'morning').length;
  const eveningCount = activeHabits.filter((h) => h.anchor === 'evening').length;
  const targetCount = activeHabits.filter((h) => h.habit_type === 'target').length;
  const floatingCount = activeHabits.length - morningCount - eveningCount;

  // Dynamic Current Month Calendar Grid
  const calendarData = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    const todayDate = now.getDate();

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const currentMonthName = `${monthNames[month]} ${year}`;

    // First day of month (0 = Sun, 1 = Mon, ..., 6 = Sat)
    const firstDayDate = new Date(year, month, 1);
    let startDayOfWeek = firstDayDate.getDay();
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // 0 = Mon, 6 = Sun

    // Total days in month
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    // Days array
    const days: Array<{
      dayNumber: number;
      isToday: boolean;
      isPast: boolean;
      isFuture: boolean;
      intensity: number; // 0 to 100
    }> = [];

    // Empty leading padding slots
    const leadingEmptySlots = startDayOfWeek;

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const isToday = d === todayDate;
      const isPast = d < todayDate;
      const isFuture = d > todayDate;

      // Compute habit density for past days based on streaks and today's status
      let intensity = 0;
      if (isToday) {
        intensity = todayCompletionPercent;
      } else if (isPast) {
        // If user has active streak spanning these days
        const daysAgo = todayDate - d;
        const habitsCoveringThisDay = activeHabits.filter((h) => (h.streak_count || 0) >= daysAgo).length;
        intensity = activeHabits.length > 0 ? Math.round((habitsCoveringThisDay / activeHabits.length) * 100) : 0;
      }

      days.push({
        dayNumber: d,
        isToday,
        isPast,
        isFuture,
        intensity,
      });
    }

    return {
      currentMonthName,
      leadingEmptySlots,
      days,
      todayDate,
    };
  }, [activeHabits, todayCompletionPercent]);

  // Monthly Adherence Rate (estimated from active streaks vs days elapsed)
  const monthlyAdherence = useMemo(() => {
    if (activeHabits.length === 0) return 0;
    const daysElapsed = calendarData.todayDate;
    if (daysElapsed <= 0) return 0;
    const cappedAvg = Math.min(daysElapsed, averageStreak);
    return Math.min(100, Math.max(0, Math.round((cappedAvg / daysElapsed) * 100)));
  }, [activeHabits, averageStreak, calendarData.todayDate]);

  return (
    <div className="bg-luma-card border border-luma-card-border rounded-2xl xs:rounded-3xl p-3.5 xs:p-5 sm:p-6 relative overflow-hidden transition-all shadow-md">
      {/* Background glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-luma-purple/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

      {/* Header & Monthly KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center mb-6">
        {/* Left: Summary & Adherence Score (5 cols) */}
        <div className="md:col-span-5 space-y-4 border-b md:border-b-0 md:border-r border-white/[0.06] pb-5 md:pb-0 md:pr-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-mono tracking-widest uppercase text-luma-purple font-bold">
                Monthly Horizon
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-luma-purple/15 text-luma-purple border border-luma-purple/30">
                {calendarData.currentMonthName}
              </span>
            </div>
            <h3 className="text-base font-semibold text-white tracking-tight">
              Habit Consistency & Streak Matrix
            </h3>
            <p className="text-xs text-luma-text-muted leading-relaxed">
              {totalHabits > 0
                ? `${todayCompletedHabits} of ${activeHabits.length} anchors completed today (${todayCompletionPercent}%).`
                : 'Define daily anchors to establish subconscious consistency.'}
            </p>
          </div>

          {/* KPI Stat Badges */}
          <div className="grid grid-cols-3 gap-1.5 xs:gap-2 pt-1">
            <div className="bg-[#141614] border border-white/[0.04] rounded-xl xs:rounded-2xl p-2 xs:p-2.5 sm:p-3 text-center">
              <div className="text-[9px] xs:text-[10px] font-mono uppercase text-luma-text-dim flex items-center justify-center gap-1">
                <Flame className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span>Best</span>
              </div>
              <div className="text-xs xs:text-sm sm:text-base font-mono font-bold text-amber-400 mt-0.5">
                {bestStreak}d
              </div>
            </div>

            <div className="bg-[#141614] border border-white/[0.04] rounded-xl xs:rounded-2xl p-2 xs:p-2.5 sm:p-3 text-center">
              <div className="text-[9px] xs:text-[10px] font-mono uppercase text-luma-text-dim flex items-center justify-center gap-1">
                <Award className="w-3 h-3 text-luma-purple" />
                <span>Average</span>
              </div>
              <div className="text-xs xs:text-sm sm:text-base font-mono font-bold text-luma-purple mt-0.5">
                {averageStreak}d
              </div>
            </div>

            <div className="bg-[#141614] border border-white/[0.04] rounded-xl xs:rounded-2xl p-2 xs:p-2.5 sm:p-3 text-center">
              <div className="text-[9px] xs:text-[10px] font-mono uppercase text-luma-text-dim flex items-center justify-center gap-1">
                <Sparkles className="w-3 h-3 text-luma-lime" />
                <span>Adherence</span>
              </div>
              <div className="text-xs xs:text-sm sm:text-base font-mono font-bold text-luma-lime mt-0.5">
                {totalHabits > 0 ? `${monthlyAdherence}%` : '0%'}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Current Month Visual Calendar Heatmap (7 cols) */}
        <div className="md:col-span-7 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-luma-text-dim" />
              <span className="text-xs font-mono text-white font-medium">
                {calendarData.currentMonthName} Cadence Map
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[9px] xs:text-[10px] font-mono text-luma-text-dim">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-[#1d201d]" /> Less
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-luma-purple" /> Active
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-luma-lime shadow-[0_0_6px_#d4f938]" /> 100%
              </span>
            </div>
          </div>

          {/* Calendar Heatmap Grid (7 Columns: Mon to Sun) */}
          <div className="bg-[#121412] border border-white/[0.04] rounded-2xl p-2 xs:p-2.5 sm:p-3.5 space-y-2">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center text-[9px] xs:text-[10px] font-mono text-luma-text-dim">
              <span>M</span>
              <span>T</span>
              <span>W</span>
              <span>T</span>
              <span>F</span>
              <span>S</span>
              <span>S</span>
            </div>

            {/* Day Slots */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {/* Empty leading padding slots */}
              {Array.from({ length: calendarData.leadingEmptySlots }).map((_, idx) => (
                <div key={`empty-${idx}`} className="h-6 sm:h-7 rounded-md xs:rounded-lg bg-transparent" />
              ))}

              {/* Real month days */}
              {calendarData.days.map((day) => {
                let cellStyle = 'bg-[#1a1d1a] text-white/50 border border-transparent';

                if (totalHabits === 0) {
                  cellStyle = 'bg-[#181a18] text-white/30 border border-dashed border-white/5';
                } else if (day.isToday) {
                  cellStyle = day.intensity >= 100
                    ? 'bg-luma-lime text-black font-bold border-2 border-white shadow-[0_0_10px_#d4f938]'
                    : day.intensity > 0
                    ? 'bg-[#2a2642] text-luma-lime font-bold border-2 border-luma-lime/80 shadow-[0_0_8px_rgba(212,249,56,0.3)]'
                    : 'bg-[#1a1d1a] text-white font-bold border-2 border-luma-purple shadow-[0_0_6px_rgba(123,110,246,0.4)]';
                } else if (day.isPast) {
                  if (day.intensity >= 85) {
                    cellStyle = 'bg-luma-lime text-black font-medium shadow-[0_0_6px_rgba(212,249,56,0.25)]';
                  } else if (day.intensity >= 50) {
                    cellStyle = 'bg-luma-purple text-white font-medium shadow-[0_0_6px_rgba(123,110,246,0.25)]';
                  } else if (day.intensity > 0) {
                    cellStyle = 'bg-[#292645] text-purple-200 border border-luma-purple/30';
                  } else {
                    cellStyle = 'bg-[#191c19] text-white/40';
                  }
                } else {
                  // Future days
                  cellStyle = 'bg-[#151715] text-white/20 border border-white/[0.02]';
                }

                return (
                  <div
                    key={day.dayNumber}
                    className={`h-6 sm:h-7 rounded-md xs:rounded-lg flex items-center justify-center text-[8px] xs:text-[9px] sm:text-[10px] font-mono transition-transform hover:scale-110 cursor-pointer ${cellStyle}`}
                    title={`Day ${day.dayNumber}: ${day.isToday ? "Today" : day.isPast ? (day.intensity > 0 ? `${day.intensity}% completed` : "No activity recorded") : "Upcoming"}`}
                  >
                    {day.dayNumber}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Routine Anchor Breakdown */}
      <div className="flex items-center justify-between pt-3 border-t border-white/[0.04] text-xs font-mono flex-wrap gap-2">
        <span className="text-[11px] uppercase text-luma-text-dim">
          Routine Breakdown:
        </span>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[11px]">
            <Sun className="w-3 h-3 text-amber-400" />
            <span>Morning Anchors: {morningCount}</span>
          </span>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-sky-500/10 text-sky-300 border border-sky-500/20 text-[11px]">
            <Target className="w-3 h-3 text-sky-400" />
            <span>Targets & Quotas: {targetCount}</span>
          </span>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-300 border border-purple-500/20 text-[11px]">
            <Moon className="w-3 h-3 text-purple-400" />
            <span>Evening Wind-Down: {eveningCount}</span>
          </span>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/[0.04] text-luma-text-muted border border-white/10 text-[11px]">
            <Zap className="w-3 h-3 text-luma-purple" />
            <span>Floating Cadence: {floatingCount}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
