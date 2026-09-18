import React, { useMemo } from 'react';
import { Task } from '../../services/api';

interface DailyTaskVisualizerProps {
  tasks: Task[];
  activeFilter: string;
  onSelectFilter: (filter: string) => void;
}

export const DailyTaskVisualizer: React.FC<DailyTaskVisualizerProps> = ({
  tasks,
  activeFilter,
  onSelectFilter,
}) => {
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const pendingTasks = totalTasks - doneTasks;
  const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Time & Energy Breakdown
  const deepFocusMins = tasks
    .filter((t) => t.energy_level === 'deep_focus')
    .reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
  const lightMins = tasks
    .filter((t) => t.energy_level === 'light')
    .reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
  const totalMins = deepFocusMins + lightMins;

  // Daylight Velocity: compare current time vs typical work day (09:00 - 18:00)
  const daylightStatus = useMemo(() => {
    if (totalTasks === 0) {
      return {
        label: 'Awaiting To-Dos',
        desc: 'Add your first task to ignite today’s execution velocity ring.',
        color: 'text-luma-text-dim border-white/5 bg-white/[0.02]',
        pillColor: 'bg-white/5 text-luma-text-muted',
      };
    }
    if (progressPercent === 100) {
      return {
        label: 'Day Complete 🏆',
        desc: 'All planned commitments successfully finished. Rest and recharge.',
        color: 'text-luma-lime border-luma-lime/30 bg-luma-lime/10',
        pillColor: 'bg-luma-lime/20 text-luma-lime border-luma-lime/40',
      };
    }

    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    const dayStart = 9;
    const dayEnd = 18;
    const elapsedRatio = Math.max(0, Math.min(1, (currentHour - dayStart) / (dayEnd - dayStart)));
    const elapsedPercent = Math.round(elapsedRatio * 100);

    if (progressPercent >= elapsedPercent + 10) {
      return {
        label: 'High Velocity ⚡',
        desc: `${progressPercent}% finished vs ${elapsedPercent}% daylight passed. Pacing ahead of sunset!`,
        color: 'text-luma-lime border-luma-lime/25 bg-luma-lime/5',
        pillColor: 'bg-luma-lime/20 text-luma-lime border-luma-lime/30',
      };
    } else if (progressPercent >= elapsedPercent - 15) {
      return {
        label: 'Steady Rhythm ⏳',
        desc: 'Execution pacing is synchronized with your workday hours.',
        color: 'text-amber-400 border-amber-400/25 bg-amber-500/5',
        pillColor: 'bg-amber-400/20 text-amber-300 border-amber-400/30',
      };
    } else {
      return {
        label: 'Focus Window Active 🔥',
        desc: `${pendingTasks} tasks remaining. Dedicate your next block to high-leverage work.`,
        color: 'text-luma-purple border-luma-purple/25 bg-luma-purple/5',
        pillColor: 'bg-luma-purple/20 text-luma-purple border-luma-purple/30',
      };
    }
  }, [totalTasks, progressPercent, pendingTasks]);

  // SVG Circular progress dimensions
  const size = 112;
  const strokeWidth = 9;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = totalTasks > 0
    ? circumference - (progressPercent / 100) * circumference
    : circumference;

  return (
    <div className="bg-luma-card border border-luma-card-border rounded-2xl xs:rounded-3xl p-3.5 xs:p-5 sm:p-6 relative overflow-hidden transition-all shadow-md">
      {/* Soft atmospheric gradient glow */}
      <div className="absolute -top-16 -right-16 w-52 h-52 rounded-full bg-luma-lime/5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-52 h-52 rounded-full bg-luma-purple/5 blur-3xl pointer-events-none" />

      {/* Main Grid: Circular Ring (Left) + Velocity & Energy Breakdown (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6 items-center">
        {/* Col 1: Circular Progress Gauge (4 cols) */}
        <div className="md:col-span-4 flex flex-col xs:flex-row items-center xs:items-start md:items-center gap-3.5 xs:gap-4 sm:gap-5 border-b md:border-b-0 md:border-r border-white/[0.06] pb-4 sm:pb-5 md:pb-0 md:pr-6 text-center xs:text-left">
          <div className="relative shrink-0 flex items-center justify-center">
            <svg width={size} height={size} className="transform -rotate-90">
              <defs>
                <linearGradient id="dailyRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7b6ef6" />
                  <stop offset="100%" stopColor="#d4f938" />
                </linearGradient>
              </defs>

              {/* Background track */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="#202420"
                strokeWidth={strokeWidth}
                fill="none"
              />

              {/* Dynamic Animated Stroke */}
              {totalTasks > 0 ? (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke="url(#dailyRingGradient)"
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-700 ease-out"
                />
              ) : (
                /* Ambient Ghost Dashed Circle */
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke="#333833"
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeDasharray="4 6"
                />
              )}
            </svg>

            {/* Inner Center Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-mono font-bold text-white tracking-tight leading-none">
                {totalTasks > 0 ? `${progressPercent}%` : '0%'}
              </span>
              <span className="text-[10px] font-mono text-luma-text-muted mt-1 uppercase">
                {doneTasks}/{totalTasks} Done
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="text-xs font-mono tracking-wider uppercase text-luma-lime font-bold">
                Daily Horizon
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${daylightStatus.pillColor}`}>
                {daylightStatus.label}
              </span>
            </div>
            <h3 className="text-base font-semibold text-white tracking-tight">
              Today's Velocity
            </h3>
            <p className="text-xs text-luma-text-muted leading-relaxed max-w-xs mx-auto sm:mx-0">
              {daylightStatus.desc}
            </p>
          </div>
        </div>

        {/* Col 2: Energy Split & Time Allocation (8 cols) */}
        <div className="md:col-span-8 space-y-4">
          {/* Energy Distribution Bar */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs font-mono">
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <span className="text-white font-medium flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-luma-purple inline-block" />
                  <span>Deep Focus: {Math.floor(deepFocusMins / 60)}h {deepFocusMins % 60}m</span>
                </span>
                <span className="text-luma-text-muted flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-luma-lime inline-block" />
                  <span>Light Tasks: {Math.floor(lightMins / 60)}h {lightMins % 60}m</span>
                </span>
              </div>
              <span className="text-luma-text-dim text-[11px]">
                Total Planned: {Math.floor(totalMins / 60)}h {totalMins % 60}m
              </span>
            </div>

            {/* Segmented Progress Bar */}
            <div className="w-full bg-[#121412] h-2.5 rounded-full overflow-hidden flex border border-white/[0.04]">
              {totalMins > 0 ? (
                <>
                  <div
                    className="h-full bg-luma-purple transition-all duration-500 relative group"
                    style={{ width: `${(deepFocusMins / totalMins) * 100}%` }}
                    title={`Deep Focus: ${deepFocusMins} mins`}
                  />
                  <div
                    className="h-full bg-luma-lime transition-all duration-500 relative group"
                    style={{ width: `${(lightMins / totalMins) * 100}%` }}
                    title={`Light: ${lightMins} mins`}
                  />
                </>
              ) : (
                <div className="w-full h-full bg-white/[0.04]" />
              )}
            </div>
          </div>

          {/* Interactive Filter Pills */}
          <div className="flex items-center justify-between pt-1 border-t border-white/[0.04] flex-wrap gap-2">
            <span className="text-[11px] font-mono uppercase text-luma-text-dim">
              Filter View:
            </span>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => onSelectFilter('all')}
                className={`px-2.5 py-1 rounded-xl text-xs font-mono transition-all ${
                  activeFilter === 'all'
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'bg-white/[0.04] text-luma-text-muted hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                All ({totalTasks})
              </button>

              <button
                type="button"
                onClick={() => onSelectFilter('deep_focus')}
                className={`px-2.5 py-1 rounded-xl text-xs font-mono transition-all flex items-center gap-1 ${
                  activeFilter === 'deep_focus'
                    ? 'bg-luma-purple text-white font-semibold shadow-purple-glow'
                    : 'bg-white/[0.04] text-luma-purple hover:bg-luma-purple/20'
                }`}
              >
                <span>🟣 Deep Work</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectFilter('light')}
                className={`px-2.5 py-1 rounded-xl text-xs font-mono transition-all flex items-center gap-1 ${
                  activeFilter === 'light'
                    ? 'bg-luma-lime text-black font-semibold shadow-lime-glow'
                    : 'bg-white/[0.04] text-luma-lime hover:bg-luma-lime/20'
                }`}
              >
                <span>🟢 Light</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectFilter('pending')}
                className={`px-2.5 py-1 rounded-xl text-xs font-mono transition-all ${
                  activeFilter === 'pending'
                    ? 'bg-amber-400 text-black font-semibold shadow-sm'
                    : 'bg-white/[0.04] text-amber-300 hover:bg-amber-400/20'
                }`}
              >
                Pending ({pendingTasks})
              </button>

              <button
                type="button"
                onClick={() => onSelectFilter('done')}
                className={`px-2.5 py-1 rounded-xl text-xs font-mono transition-all ${
                  activeFilter === 'done'
                    ? 'bg-emerald-400 text-black font-semibold shadow-sm'
                    : 'bg-white/[0.04] text-emerald-300 hover:bg-emerald-400/20'
                }`}
              >
                Done ({doneTasks})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
