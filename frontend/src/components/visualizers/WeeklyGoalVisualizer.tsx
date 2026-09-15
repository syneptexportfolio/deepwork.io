import React, { useMemo } from 'react';
import { Calendar, Layers } from 'lucide-react';
import { WeeklyGoal } from '../../services/api';

interface WeeklyGoalVisualizerProps {
  weeklyGoals: WeeklyGoal[];
  activeCategoryFilter: string;
  onSelectCategoryFilter: (category: string) => void;
}

export const WeeklyGoalVisualizer: React.FC<WeeklyGoalVisualizerProps> = ({
  weeklyGoals,
  activeCategoryFilter,
  onSelectCategoryFilter,
}) => {
  const totalWeeklyGoals = weeklyGoals.length;

  // Cumulative units
  const totalTargetUnits = weeklyGoals.reduce((sum, g) => sum + (g.target_units || 0), 0);
  const totalCompletedUnits = weeklyGoals.reduce((sum, g) => sum + (g.completed_units || 0), 0);
  const aggregateProgress = totalTargetUnits > 0
    ? Math.min(100, Math.round((totalCompletedUnits / totalTargetUnits) * 100))
    : 0;

  // Week elapsed calculation (Monday - Sunday)
  const pacingMetrics = useMemo(() => {
    const now = new Date();
    // JS getDay(): 0 = Sun, 1 = Mon, ..., 6 = Sat
    const dayOfWeek = now.getDay();
    const dayIndex = dayOfWeek === 0 ? 7 : dayOfWeek; // 1 (Mon) to 7 (Sun)
    const weekElapsedPercent = Math.round((dayIndex / 7) * 100);

    const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const currentDayName = dayNames[dayIndex];

    if (totalWeeklyGoals === 0) {
      return {
        statusText: 'Awaiting Weekly Targets',
        badgeColor: 'bg-white/5 text-luma-text-muted border-white/10',
        statusColor: 'text-luma-text-muted',
        advice: 'Define weekly deliverables. The system will track daily burn-up vs. calendar days.',
        dayIndex,
        currentDayName,
        weekElapsedPercent,
        deltaUnits: 0,
      };
    }

    if (aggregateProgress >= 100) {
      return {
        statusText: 'Weekly Target Fulfilled 🏆',
        badgeColor: 'bg-luma-lime/20 text-luma-lime border-luma-lime/40',
        statusColor: 'text-luma-lime',
        advice: 'All weekly milestone quotas have been achieved ahead of the Sunday deadline.',
        dayIndex,
        currentDayName,
        weekElapsedPercent,
        deltaUnits: 0,
      };
    }

    const expectedUnitsSoFar = Math.round((weekElapsedPercent / 100) * totalTargetUnits);
    const deficitUnits = expectedUnitsSoFar - totalCompletedUnits;

    if (aggregateProgress >= weekElapsedPercent + 5) {
      return {
        statusText: 'Ahead of Pace 🟢',
        badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        statusColor: 'text-emerald-400',
        advice: `${aggregateProgress}% finished vs. ${weekElapsedPercent}% of week elapsed. Banking buffer for the weekend!`,
        dayIndex,
        currentDayName,
        weekElapsedPercent,
        deltaUnits: deficitUnits,
      };
    } else if (aggregateProgress >= weekElapsedPercent - 10) {
      return {
        statusText: 'On Track 🟡',
        badgeColor: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
        statusColor: 'text-amber-300',
        advice: `Pacing matches ${currentDayName} milestone expectations. Maintain steady daily progress.`,
        dayIndex,
        currentDayName,
        weekElapsedPercent,
        deltaUnits: deficitUnits,
      };
    } else {
      return {
        statusText: 'Pace Deficit 🔴',
        badgeColor: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        statusColor: 'text-rose-400',
        advice: `Pace lag of ~${Math.max(1, deficitUnits)} units. Allocate dedicated focus blocks in Shape My Day today to realign.`,
        dayIndex,
        currentDayName,
        weekElapsedPercent,
        deltaUnits: deficitUnits,
      };
    }
  }, [totalWeeklyGoals, aggregateProgress, totalTargetUnits, totalCompletedUnits]);

  // Categories present in weekly goals
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const wg of weeklyGoals) {
      const cat = wg.category || 'Project';
      map.set(cat, (map.get(cat) || 0) + 1);
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [weeklyGoals]);

  return (
    <div className="bg-luma-card border border-luma-card-border rounded-3xl p-6 relative overflow-hidden transition-all shadow-md">
      {/* Ambient background glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-luma-lime/5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-[#4287f5]/5 blur-3xl pointer-events-none" />

      {/* Top row: Metrics & Pacing Badge */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono tracking-widest uppercase text-luma-lime font-bold">
              Weekly Horizon
            </span>
            <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border ${pacingMetrics.badgeColor}`}>
              {pacingMetrics.statusText}
            </span>
          </div>
          <h3 className="text-base font-semibold text-white tracking-tight">
            Velocity & Burn-Up Trajectory
          </h3>
          <p className="text-xs text-luma-text-muted leading-relaxed">
            {pacingMetrics.advice}
          </p>
        </div>

        {/* Aggregate Unit Counter */}
        <div className="flex items-center gap-4 bg-[#141614] border border-white/[0.05] rounded-2xl px-4 py-3 shrink-0">
          <div>
            <div className="text-[10px] font-mono uppercase text-luma-text-dim">
              Weekly Cumulative
            </div>
            <div className="text-xl font-mono font-bold text-white tracking-tight flex items-baseline gap-1.5">
              <span>{totalCompletedUnits}</span>
              <span className="text-xs text-luma-text-muted font-normal">/ {totalTargetUnits} units</span>
            </div>
          </div>
          <div className="text-right border-l border-white/[0.06] pl-4">
            <div className="text-[10px] font-mono uppercase text-luma-text-dim">
              Completion
            </div>
            <div className="text-xl font-mono font-bold text-luma-lime">
              {aggregateProgress}%
            </div>
          </div>
        </div>
      </div>

      {/* Trajectory Dual Bar: Actual vs. Calendar Elapsed */}
      <div className="space-y-2 mb-6">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-white flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-luma-lime shadow-[0_0_8px_#d4f938]" />
            <span>Actual Completed: {aggregateProgress}%</span>
          </span>
          <span className="text-luma-text-muted flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-luma-text-dim" />
            <span>{pacingMetrics.currentDayName} (Day {pacingMetrics.dayIndex} of 7 · {pacingMetrics.weekElapsedPercent}% of week elapsed)</span>
          </span>
        </div>

        {/* Visual Dual Pacing Bar */}
        <div className="relative pt-1 pb-2">
          {/* Main Progress Bar */}
          <div className="w-full bg-[#121412] h-3 rounded-full overflow-hidden border border-white/[0.04] relative">
            {totalWeeklyGoals > 0 ? (
              <div
                className="h-full bg-gradient-to-r from-[#4287f5] via-luma-purple to-luma-lime rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(212,249,56,0.3)]"
                style={{ width: `${aggregateProgress}%` }}
              />
            ) : (
              <div className="w-full h-full bg-white/[0.03]" />
            )}
          </div>

          {/* Calendar Benchmark Tick Marker */}
          {totalWeeklyGoals > 0 && (
            <div
              className="absolute top-0 transform -translate-x-1/2 flex flex-col items-center pointer-events-none transition-all duration-500"
              style={{ left: `${pacingMetrics.weekElapsedPercent}%` }}
              title={`Today is Day ${pacingMetrics.dayIndex} of 7 (${pacingMetrics.weekElapsedPercent}% through the week)`}
            >
              <div className="w-1 h-5 bg-white rounded-full shadow-[0_0_6px_#fff]" />
              <span className="text-[9px] font-mono text-white/80 bg-black/80 px-1 rounded mt-0.5 whitespace-nowrap">
                Today
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Category Filter Badges */}
      <div className="flex items-center justify-between pt-3 border-t border-white/[0.04] flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-luma-text-dim" />
          <span className="text-[11px] font-mono uppercase text-luma-text-dim">
            Domain Focus:
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => onSelectCategoryFilter('all')}
            className={`px-3 py-1 rounded-xl text-xs font-mono transition-all ${
              activeCategoryFilter === 'all'
                ? 'bg-luma-lime text-black font-semibold shadow-lime-glow'
                : 'bg-white/[0.04] text-luma-text-muted hover:text-white hover:bg-white/[0.08]'
            }`}
          >
            All Goals ({totalWeeklyGoals})
          </button>

          {categories.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => onSelectCategoryFilter(c.name)}
              className={`px-3 py-1 rounded-xl text-xs font-mono transition-all ${
                activeCategoryFilter === c.name
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'bg-white/[0.04] text-luma-text-muted hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              {c.name} ({c.count})
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
