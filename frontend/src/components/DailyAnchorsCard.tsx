import React from 'react';
import { Zap, CheckCircle2, Circle, Flame, Sun, Target, Moon, Sparkles } from 'lucide-react';
import { Habit } from '../services/api';

interface DailyAnchorsCardProps {
  habits: Habit[];
  onToggleHabit: (habitId: string) => void | Promise<void>;
  className?: string;
}

export const DailyAnchorsCard: React.FC<DailyAnchorsCardProps> = ({
  habits,
  onToggleHabit,
  className = '',
}) => {
  const todayIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

  const activeHabits = habits.filter(h => h.is_active);
  const completedCount = activeHabits.filter(h => h.last_completed_date === todayIST).length;
  const progressPercent = activeHabits.length > 0 
    ? Math.round((completedCount / activeHabits.length) * 100) 
    : 0;

  // Split into Anchors / Morning, All-Day Targets, Floating Cadence, and Evening
  const morningAndAnchors = activeHabits.filter(
    h => h.anchor === 'morning' || (h.habit_type === 'check_off' && h.anchor !== 'evening')
  );
  const eveningHabits = activeHabits.filter(
    h => h.anchor === 'evening'
  );
  const targetsAndFloating = activeHabits.filter(
    h => h.habit_type === 'target' && !morningAndAnchors.includes(h) && !eveningHabits.includes(h)
  );
  const otherFloating = activeHabits.filter(
    h => !morningAndAnchors.includes(h) && !eveningHabits.includes(h) && !targetsAndFloating.includes(h)
  );

  const renderHabitItem = (h: Habit) => {
    const isDone = h.last_completed_date === todayIST;

    return (
      <div
        key={h.id}
        onClick={() => onToggleHabit(h.id)}
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

        {/* Streak indicator */}
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
  };

  return (
    <div className={`bg-luma-card border border-luma-card-border rounded-3xl p-6 relative overflow-hidden ${className}`}>
      {/* Background soft glow */}
      <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-[#9f8ff5]/15 blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between mb-4 pb-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#252238] border border-luma-purple/30 flex items-center justify-center text-luma-purple">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-1.5">
              <span>Daily Anchors & Targets</span>
            </h3>
            <p className="text-[11px] text-luma-text-muted">
              Habits, rituals & health targets for today
            </p>
          </div>
        </div>

        {/* Completed badge */}
        {activeHabits.length > 0 && (
          <div className="text-right">
            <span className="text-[11px] font-mono font-bold text-luma-lime px-2.5 py-1 rounded-full bg-luma-lime/10 border border-luma-lime/20">
              {completedCount}/{activeHabits.length} done
            </span>
          </div>
        )}
      </div>

      {activeHabits.length === 0 ? (
        <div className="text-center py-8 px-4 text-xs text-luma-text-dim bg-[#141514] rounded-2xl border border-white/[0.04] space-y-2">
          <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center mx-auto text-luma-text-dim">
            <Sparkles className="w-4 h-4" />
          </div>
          <p className="text-white/80 font-medium text-xs">No active habits configured</p>
          <p className="text-[11px] text-luma-text-muted max-w-xs mx-auto">
            Add recurring daily habits or anchors in Tasks & Cadence to build your rhythm.
          </p>
        </div>
      ) : (
        <>
          {/* Progress Bar */}
          <div className="relative z-10 mb-5">
            <div className="w-full bg-[#141514] h-1 rounded-full overflow-hidden border border-white/[0.04]">
              <div
                className="h-full bg-luma-lime transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        <div className="space-y-4 max-h-[460px] overflow-y-auto custom-scrollbar pr-1 relative z-10">
          
          {/* 1. Anchors & Morning Milestones */}
          {morningAndAnchors.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5 pl-1">
                <Sun className="w-3 h-3 text-amber-400" />
                <span>Anchors & Milestones ({morningAndAnchors.length})</span>
              </div>
              <div className="space-y-1.5">
                {morningAndAnchors.map(renderHabitItem)}
              </div>
            </div>
          )}

          {/* 2. All-Day Health & Metric Targets */}
          {targetsAndFloating.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400/90 flex items-center gap-1.5 pl-1">
                <Target className="w-3 h-3 text-sky-400" />
                <span>Health & Daily Targets ({targetsAndFloating.length})</span>
              </div>
              <div className="space-y-1.5">
                {targetsAndFloating.map(renderHabitItem)}
              </div>
            </div>
          )}

          {/* 3. Other Floating Habits */}
          {otherFloating.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-luma-purple flex items-center gap-1.5 pl-1">
                <Sparkles className="w-3 h-3 text-luma-purple" />
                <span>Daily Cadence ({otherFloating.length})</span>
              </div>
              <div className="space-y-1.5">
                {otherFloating.map(renderHabitItem)}
              </div>
            </div>
          )}

          {/* 4. Evening Wind-down */}
          {eveningHabits.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-purple-400/90 flex items-center gap-1.5 pl-1">
                <Moon className="w-3 h-3 text-purple-400" />
                <span>Evening Wind-Down ({eveningHabits.length})</span>
              </div>
              <div className="space-y-1.5">
                {eveningHabits.map(renderHabitItem)}
              </div>
            </div>
          )}

        </div>
        </>
      )}
    </div>
  );
};
