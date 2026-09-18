import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Sparkles,
  Laptop,
  Briefcase,
  GraduationCap,
  Activity,
  Zap,
  Clock,
  Calendar,
  Info,
  Layers,
} from 'lucide-react';
import { ScheduleBlock } from '../../services/api';

interface AddTimelineTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDateStr: string;
  isToday: boolean;
  currentHHMM: string;
  workHours: { workStartTime: string; workEndTime: string } | null;
  existingBlocks: ScheduleBlock[];
  onAdd: (params: {
    title: string;
    duration: number;
    startTime?: string;
    category: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    isUntimed: boolean;
  }) => Promise<void>;
}

const CATEGORIES = [
  { id: 'Project', label: 'Project & Dev', icon: Laptop },
  { id: 'Business', label: 'Job & Business', icon: Briefcase },
  { id: 'Study', label: 'Exam & Study', icon: GraduationCap },
  { id: 'Fitness', label: 'Health & Fitness', icon: Activity },
  { id: 'Personal & Social', label: 'Personal & Social', icon: Sparkles },
  { id: 'Personal', label: 'Personal & Admin', icon: Zap },
];

const DURATION_PRESETS = [15, 30, 45, 60];

// Utility: convert "HH:MM" to minutes
export const timeToMinutes = (timeStr: string): number => {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Utility: convert minutes to "HH:MM"
export const minutesToTime = (totalMinutes: number): string => {
  const norm = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// Utility: round up to nearest quarter hour (:00, :15, :30, :45)
export const roundUpToQuarter = (hhmm: string): string => {
  if (!hhmm || !hhmm.includes(':')) return '09:00';
  const [h, m] = hhmm.split(':').map(Number);
  if (m % 15 === 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const roundedM = Math.ceil(m / 15) * 15;
  if (roundedM >= 60) {
    const nextH = (h + 1) % 24;
    return `${String(nextH).padStart(2, '0')}:00`;
  }
  return `${String(h).padStart(2, '0')}:${String(roundedM).padStart(2, '0')}`;
};

export const AddTimelineTaskModal: React.FC<AddTimelineTaskModalProps> = ({
  isOpen,
  onClose,
  targetDateStr,
  isToday,
  currentHHMM,
  workHours,
  existingBlocks,
  onAdd,
}) => {
  const [title, setTitle] = useState('');
  const [isUntimed, setIsUntimed] = useState(false);
  const [duration, setDuration] = useState(30);
  const [hasSpecificTime, setHasSpecificTime] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [category, setCategory] = useState('Project');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('HIGH');
  const [loading, setLoading] = useState(false);

  // Defaults
  const workStart = workHours?.workStartTime || '09:00';
  const workEnd = workHours?.workEndTime || '18:00';
  const roundedNow = useMemo(() => roundUpToQuarter(currentHHMM), [currentHHMM]);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setIsUntimed(false);
      setDuration(30);
      setHasSpecificTime(false);
      setStartTime(isToday ? roundedNow : workStart);
      setCategory('Project');
      setPriority('HIGH');
      setLoading(false);
    }
  }, [isOpen, isToday, roundedNow, workStart]);

  if (!isOpen) return null;

  // Analysis of time placement
  const placementAnalysis = (() => {
    if (isUntimed || !hasSpecificTime || !startTime) {
      return {
        type: 'untimed',
        badge: 'APPEND TO TIMELINE',
        badgeColor: 'text-luma-purple bg-luma-purple/10 border-luma-purple/30',
        message: 'Untimed task will be placed directly at the end of the day\'s timeline.',
      };
    }

    const startMins = timeToMinutes(startTime);
    const endMins = startMins + (isUntimed ? 0 : duration);
    const workStartMins = timeToMinutes(workStart);
    const workEndMins = timeToMinutes(workEnd);

    const isInsideWorkWindow = startMins >= workStartMins && startMins < workEndMins;

    if (!isInsideWorkWindow) {
      return {
        type: 'outside_window',
        badge: 'OUTSIDE WORK WINDOW',
        badgeColor: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
        message: `Task is scheduled outside work hours (${workStart}–${workEnd}). Directly added to timeline without rearranging your workday blocks.`,
      };
    }

    // Check overlap with active blocks
    const hasOverlap = existingBlocks.some(b => {
      if (b.is_untimed || b.duration === 0) return false;
      const bStart = timeToMinutes(b.start_time);
      const bEnd = timeToMinutes(b.end_time);
      return Math.max(startMins, bStart) < Math.min(endMins, bEnd);
    });

    if (hasOverlap) {
      const reflowBaseline = isToday ? roundedNow : workStart;
      return {
        type: 'overlap_reflow',
        badge: 'REFLOW ACTIVE SCHEDULE',
        badgeColor: 'text-luma-lime bg-luma-lime/10 border-luma-lime/30',
        message: `Overlaps existing blocks. Task will lock at ${startTime}. Pending commitments will reflow from ${reflowBaseline} around this fixed slot.`,
      };
    }

    return {
      type: 'gap_slot',
      badge: 'OPEN TIMELINE GAP',
      badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      message: `Fits neatly into an open gap in your schedule. Directly added to the timeline without moving other blocks.`,
    };
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      await onAdd({
        title: title.trim(),
        duration: isUntimed ? 0 : Math.max(5, duration),
        startTime: hasSpecificTime && startTime ? startTime : undefined,
        category,
        priority,
        isUntimed,
      });
      onClose();
    } catch (err) {
      console.error('Failed to add task to timeline', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#141514] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl text-white space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-luma-lime/10 border border-luma-lime/30 flex items-center justify-center text-luma-lime">
              <Layers className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-tight">Add Task to Timetable</h3>
              <p className="text-xs text-luma-text-muted flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3 h-3 text-luma-lime" />
                <span>{targetDateStr} {isToday ? '(Today)' : ''}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-luma-text-muted hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-luma-text-muted uppercase tracking-wider">
              Task Title
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Bank visit, Client sync, Review PRs..."
              className="w-full bg-[#1b1d1b] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-luma-lime/60 transition-colors"
            />
          </div>

          {/* Duration & Untimed Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-luma-text-muted uppercase tracking-wider">
                Duration
              </label>
              <button
                type="button"
                onClick={() => setIsUntimed(!isUntimed)}
                className={`text-xs font-mono px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                  isUntimed
                    ? 'bg-luma-purple text-white border-luma-purple'
                    : 'bg-white/5 text-luma-text-dim border-white/10 hover:text-white'
                }`}
              >
                {isUntimed ? '✓ Untimed / Action Item' : '⚡ Set as Untimed'}
              </button>
            </div>

            {!isUntimed ? (
              <div className="flex items-center gap-2 flex-wrap">
                {DURATION_PRESETS.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDuration(mins)}
                    className={`flex-1 min-w-[65px] py-2 rounded-xl text-xs font-mono font-semibold border transition-all cursor-pointer ${
                      duration === mins
                        ? 'bg-luma-lime text-black border-luma-lime shadow-lime-glow'
                        : 'bg-[#1b1d1b] text-luma-text-dim border-white/10 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
                <div className="flex items-center gap-1.5 bg-[#1b1d1b] border border-white/10 rounded-xl px-3 py-1.5">
                  <input
                    type="number"
                    min="5"
                    max="360"
                    step="5"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-12 bg-transparent text-xs font-mono font-bold text-center text-white focus:outline-none"
                  />
                  <span className="text-[11px] font-mono text-luma-text-muted">min</span>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-luma-purple/10 border border-luma-purple/20 text-xs text-luma-purple-dim flex items-center gap-2">
                <Info className="w-4 h-4 text-luma-purple shrink-0" />
                <span>Unlimited / Untimed action item: will be placed at the end of the timeline.</span>
              </div>
            )}
          </div>

          {/* Specific Time Placement */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-luma-text-muted uppercase tracking-wider">
                Timing Placement
              </label>
              <div className="flex items-center gap-1.5 p-0.5 rounded-xl bg-white/5 border border-white/10">
                <button
                  type="button"
                  onClick={() => setHasSpecificTime(false)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    !hasSpecificTime ? 'bg-white/20 text-white font-semibold' : 'text-luma-text-muted hover:text-white'
                  }`}
                >
                  Append to End
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHasSpecificTime(true);
                    if (!startTime) setStartTime(isToday ? roundedNow : workStart);
                  }}
                  className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    hasSpecificTime ? 'bg-luma-lime text-black font-semibold' : 'text-luma-text-muted hover:text-white'
                  }`}
                >
                  Specific Time
                </button>
              </div>
            </div>

            {hasSpecificTime && (
              <div className="space-y-2 p-3.5 rounded-2xl bg-[#1b1d1b] border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <Clock className="w-4 h-4 text-luma-lime shrink-0" />
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-luma-lime"
                    />
                  </div>
                  {/* Quick pills */}
                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    {isToday && (
                      <button
                        type="button"
                        onClick={() => setStartTime(roundedNow)}
                        className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-luma-text-dim hover:text-white cursor-pointer"
                      >
                        Now ({roundedNow})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setStartTime(workStart)}
                      className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-luma-text-dim hover:text-white cursor-pointer"
                    >
                      Work Start ({workStart})
                    </button>
                  </div>
                </div>

                {/* Live Analysis Alert */}
                <div className="pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border font-bold ${placementAnalysis.badgeColor}`}>
                      {placementAnalysis.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-luma-text-muted leading-relaxed">
                    {placementAnalysis.message}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Category Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-luma-text-muted uppercase tracking-wider">
              Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-luma-lime/10 border-luma-lime text-white'
                        : 'bg-[#1b1d1b] border-white/5 text-luma-text-dim hover:text-white hover:border-white/15'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-luma-lime' : 'text-white/40'}`} />
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-luma-text-muted uppercase tracking-wider">
              Priority
            </label>
            <div className="flex items-center gap-2">
              {(['LOW', 'MEDIUM', 'HIGH'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 py-2 rounded-xl text-xs font-mono font-semibold border transition-all cursor-pointer ${
                    priority === p
                      ? p === 'HIGH'
                        ? 'bg-red-500/20 text-red-300 border-red-500/40'
                        : p === 'MEDIUM'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      : 'bg-[#1b1d1b] text-luma-text-dim border-white/5 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-medium text-luma-text-muted hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-luma-lime text-black font-semibold text-xs shadow-lime-glow hover:bg-luma-lime-hover disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Adding to Timeline...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 stroke-[2]" />
                  <span>Add to Timetable</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export interface InsertScheduleParams {
  currentBlocks: ScheduleBlock[];
  newTask: {
    title: string;
    duration: number;
    startTime?: string;
    category: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    isUntimed: boolean;
    taskId: string;
    blockId: string;
  };
  workHours: { workStartTime: string; workEndTime: string } | null;
  selectedDateStr: string;
  isToday: boolean;
  currentHHMM: string;
}

export function insertAndReflowSchedule({
  currentBlocks,
  newTask,
  workHours,
  selectedDateStr: _selectedDateStr,
  isToday,
  currentHHMM,
}: InsertScheduleParams): ScheduleBlock[] {
  const workStart = workHours?.workStartTime || '09:00';
  const workEnd = workHours?.workEndTime || '18:00';
  const workStartMins = timeToMinutes(workStart);
  const workEndMins = timeToMinutes(workEnd);

  const duration = newTask.isUntimed ? 0 : Math.max(0, newTask.duration);
  const isSocial = newTask.category === 'Personal & Social' || newTask.category === 'Social';
  const isEvening = newTask.startTime ? newTask.startTime >= '17:00' : false;

  const newBlock: ScheduleBlock = {
    id: newTask.blockId,
    task_id: newTask.taskId,
    title: newTask.title,
    start_time: '',
    end_time: '',
    duration,
    type: isSocial || isEvening ? 'light' : 'deep_focus',
    block_source: 'daily_todo',
    category: newTask.category,
    status: 'pending',
    reasoning: 'Directly added to timetable',
    is_untimed: newTask.isUntimed || duration === 0,
  };

  // Case A: Untimed or No Specific Time -> Append to End of Timeline
  if (newTask.isUntimed || !newTask.startTime) {
    let maxEndMins = 0;
    for (const b of currentBlocks) {
      const endM = timeToMinutes(b.end_time || b.start_time);
      if (endM > maxEndMins) maxEndMins = endM;
    }

    const baselineMins = maxEndMins > 0 ? maxEndMins : workEndMins;
    const startStr = minutesToTime(baselineMins);
    const endStr = minutesToTime(baselineMins + duration);

    newBlock.start_time = startStr;
    newBlock.end_time = newTask.isUntimed ? startStr : endStr;

    const updated = [...currentBlocks, newBlock];
    return updated.sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
  }

  // Case B: Specific Start Time
  const newStartMins = timeToMinutes(newTask.startTime);
  const newEndMins = newStartMins + (duration > 0 ? duration : 15);
  newBlock.start_time = newTask.startTime;
  newBlock.end_time = minutesToTime(newStartMins + duration);

  const isInsideWorkWindow = newStartMins >= workStartMins && newStartMins < workEndMins;

  // Case 3: Time is outside the work window -> Add directly without rearranging
  if (!isInsideWorkWindow) {
    const updated = [...currentBlocks, newBlock];
    return updated.sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
  }

  // Check if it overlaps with any existing block
  const hasOverlap = currentBlocks.some(b => {
    if (b.is_untimed || b.duration === 0) return false;
    const bStart = timeToMinutes(b.start_time);
    const bEnd = timeToMinutes(b.end_time);
    return Math.max(newStartMins, bStart) < Math.min(newEndMins, bEnd);
  });

  // Case 2: Time is within work window but does NOT overlap (fits into an open gap/outside current blocks)
  if (!hasOverlap) {
    const updated = [...currentBlocks, newBlock];
    return updated.sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
  }

  // Case 1: Time is within work window AND overlaps existing schedule -> REFLOW from roundoff time
  const roundoffStr = roundUpToQuarter(currentHHMM);
  const reflowAnchorMins = isToday
    ? Math.max(workStartMins, timeToMinutes(roundoffStr))
    : workStartMins;

  const lockedBlocks: ScheduleBlock[] = [];
  const pendingToReflow: ScheduleBlock[] = [];

  for (const b of currentBlocks) {
    const bEnd = timeToMinutes(b.end_time || b.start_time);

    if (b.status === 'done' || bEnd <= reflowAnchorMins) {
      lockedBlocks.push(b);
    } else if (b.type === 'break' && b.category === 'Lunch') {
      lockedBlocks.push(b);
    } else if (b.is_untimed || b.duration === 0) {
      lockedBlocks.push(b);
    } else {
      pendingToReflow.push(b);
    }
  }

  // Lock the new block at its requested time
  lockedBlocks.push(newBlock);
  lockedBlocks.sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

  // Reflow pending blocks sequentially starting from reflowAnchorMins
  let cursorMins = reflowAnchorMins;
  const reflowedBlocks: ScheduleBlock[] = [];

  for (const block of pendingToReflow) {
    const bDuration = block.duration || 15;
    let placed = false;

    while (!placed) {
      const candidateStart = cursorMins;
      const candidateEnd = candidateStart + bDuration;

      // Check collision with any locked block
      const collision = lockedBlocks.find(lb => {
        if (lb.is_untimed || lb.duration === 0) return false;
        const lbStart = timeToMinutes(lb.start_time);
        const lbEnd = timeToMinutes(lb.end_time || lb.start_time);
        return Math.max(candidateStart, lbStart) < Math.min(candidateEnd, lbEnd);
      });

      if (collision) {
        // Jump cursor to the end of the colliding locked block
        cursorMins = Math.max(cursorMins, timeToMinutes(collision.end_time || collision.start_time));
      } else {
        reflowedBlocks.push({
          ...block,
          start_time: minutesToTime(candidateStart),
          end_time: minutesToTime(candidateEnd),
        });
        cursorMins = candidateEnd;
        placed = true;
      }
    }
  }

  const allUpdated = [...lockedBlocks, ...reflowedBlocks];
  return allUpdated.sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
}

