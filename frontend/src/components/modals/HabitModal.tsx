import React, { useState, useEffect } from 'react';
import { X, Flame, Sun, Waves, Moon, Check, Zap, Target, Clock, Sparkles, RotateCcw, Calendar, Minus, Plus } from 'lucide-react';
import { Habit, HabitType, FrequencyType } from '../../services/api';

interface HabitModalProps {
  isOpen: boolean;
  habit: Habit | null;
  onClose: () => void;
  onSave: (data: Partial<Habit>) => Promise<void>;
}

type FrequencyPreset = 'all' | 'weekdays' | 'weekends' | 'custom';
type CustomSubMode = 'specific_days' | 'interval' | 'weekly_target';

const TEMPLATES = [
  {
    label: '🌅 Wake up early (6 AM)',
    title: 'Wake up early',
    type: 'check_off' as HabitType,
    target_value: '6:00 AM',
    target_unit: '',
    duration: 0,
    anchor: 'morning' as const,
    energy: 'light' as const,
    frequencyPreset: 'all' as FrequencyPreset,
  },
  {
    label: '💧 Drink 3L water',
    title: 'Drink water',
    type: 'target' as HabitType,
    target_value: '3',
    target_unit: 'Liters',
    duration: 0,
    anchor: 'floating' as const,
    energy: 'light' as const,
    frequencyPreset: 'all' as FrequencyPreset,
  },
  {
    label: '👟 Walk 10k steps',
    title: 'Walk 10,000+ steps',
    type: 'target' as HabitType,
    target_value: '10000',
    target_unit: 'steps',
    duration: 0,
    anchor: 'evening' as const,
    energy: 'light' as const,
    frequencyPreset: 'all' as FrequencyPreset,
  },
  {
    label: '🚿 Cold shower (Alt days)',
    title: 'Cold shower',
    type: 'check_off' as HabitType,
    target_value: 'Morning ritual',
    target_unit: '',
    duration: 0,
    anchor: 'morning' as const,
    energy: 'light' as const,
    frequencyPreset: 'custom' as FrequencyPreset,
    customSubMode: 'interval' as CustomSubMode,
    intervalDays: 2,
  },
  {
    label: '🏋️ Workout (3x / week)',
    title: 'Strength workout session',
    type: 'timed' as HabitType,
    target_value: '',
    target_unit: '',
    duration: 45,
    anchor: 'floating' as const,
    energy: 'deep_focus' as const,
    frequencyPreset: 'custom' as FrequencyPreset,
    customSubMode: 'weekly_target' as CustomSubMode,
    weeklyTargetDays: 3,
  },
  {
    label: '📖 Read 20 pages',
    title: 'Evening book reading',
    type: 'target' as HabitType,
    target_value: '20',
    target_unit: 'pages',
    duration: 0,
    anchor: 'evening' as const,
    energy: 'deep_focus' as const,
    frequencyPreset: 'all' as FrequencyPreset,
  },
];

const PRESET_UNITS = ['steps', 'Liters', 'glasses', 'pages', 'reps', 'km', 'chapters', 'custom'];
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_FULL_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const HabitModal: React.FC<HabitModalProps> = ({
  isOpen,
  habit,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [habitType, setHabitType] = useState<HabitType>('check_off');
  const [targetValue, setTargetValue] = useState('');
  const [targetUnit, setTargetUnit] = useState('steps');
  const [customUnit, setCustomUnit] = useState('');
  const [duration, setDuration] = useState(15);
  const [anchor, setAnchor] = useState<'morning' | 'floating' | 'evening'>('morning');
  const [energyLevel, setEnergyLevel] = useState<'deep_focus' | 'light'>('light');

  // Repeating Frequency states
  const [frequencyPreset, setFrequencyPreset] = useState<FrequencyPreset>('all');
  const [customSubMode, setCustomSubMode] = useState<CustomSubMode>('specific_days');
  const [activeDays, setActiveDays] = useState<string[]>(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  const [intervalDays, setIntervalDays] = useState<number>(2);
  const [weeklyTargetDays, setWeeklyTargetDays] = useState<number>(3);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (habit) {
      setTitle(habit.title);
      const inferredType: HabitType = habit.habit_type || (habit.duration_minutes > 0 ? 'timed' : (habit.target_value ? 'target' : 'check_off'));
      setHabitType(inferredType);
      setTargetValue(habit.target_value || '');
      const unit = habit.target_unit || '';
      if (unit && !PRESET_UNITS.slice(0, -1).includes(unit)) {
        setTargetUnit('custom');
        setCustomUnit(unit);
      } else {
        setTargetUnit(unit || 'steps');
        setCustomUnit('');
      }
      setDuration(habit.duration_minutes || (inferredType === 'timed' ? 15 : 0));
      setAnchor(habit.anchor);
      setEnergyLevel(habit.energy_level);

      // Frequency detection
      if (habit.frequency_type === 'interval') {
        setFrequencyPreset('custom');
        setCustomSubMode('interval');
        setIntervalDays(habit.frequency_value || 2);
        setActiveDays(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
      } else if (habit.frequency_type === 'weekly_target') {
        setFrequencyPreset('custom');
        setCustomSubMode('weekly_target');
        setWeeklyTargetDays(habit.frequency_value || 3);
        setActiveDays(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
      } else {
        const days = habit.active_days && habit.active_days.length > 0 ? habit.active_days : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
        setActiveDays(days);
        if (days.length === 7) {
          setFrequencyPreset('all');
        } else if (days.length === 5 && !days.includes('S')) {
          setFrequencyPreset('weekdays');
        } else if (days.length === 2 && days.every(d => d === 'S')) {
          setFrequencyPreset('weekends');
        } else {
          setFrequencyPreset('custom');
          setCustomSubMode('specific_days');
        }
      }
    } else {
      setTitle('');
      setHabitType('check_off');
      setTargetValue('');
      setTargetUnit('steps');
      setCustomUnit('');
      setDuration(0);
      setAnchor('morning');
      setEnergyLevel('light');
      setFrequencyPreset('all');
      setCustomSubMode('specific_days');
      setIntervalDays(2);
      setWeeklyTargetDays(3);
      setActiveDays(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    }
  }, [habit, isOpen]);

  if (!isOpen) return null;

  const handleApplyTemplate = (tmpl: typeof TEMPLATES[0]) => {
    setTitle(tmpl.title);
    setHabitType(tmpl.type);
    setTargetValue(tmpl.target_value);
    if (tmpl.target_unit && !PRESET_UNITS.slice(0, -1).includes(tmpl.target_unit)) {
      setTargetUnit('custom');
      setCustomUnit(tmpl.target_unit);
    } else {
      setTargetUnit(tmpl.target_unit || 'steps');
      setCustomUnit('');
    }
    setDuration(tmpl.duration);
    setAnchor(tmpl.anchor);
    setEnergyLevel(tmpl.energy);

    setFrequencyPreset(tmpl.frequencyPreset);
    if (tmpl.customSubMode) {
      setCustomSubMode(tmpl.customSubMode);
    }
    if (tmpl.intervalDays) {
      setIntervalDays(tmpl.intervalDays);
    }
    if (tmpl.weeklyTargetDays) {
      setWeeklyTargetDays(tmpl.weeklyTargetDays);
    }
  };

  const handleSelectPreset = (preset: FrequencyPreset) => {
    setFrequencyPreset(preset);
    if (preset === 'all') {
      setActiveDays(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    } else if (preset === 'weekdays') {
      setActiveDays(['M', 'T', 'W', 'T', 'F']);
    } else if (preset === 'weekends') {
      setActiveDays(['S', 'S']);
    } else if (preset === 'custom') {
      if (customSubMode === 'specific_days' && activeDays.length === 7) {
        setActiveDays(['M', 'W', 'F']);
      }
    }
  };

  const toggleDay = (index: number) => {
    const dayTag = DAY_LABELS[index];
    const isCurrentlyActive = activeDays.includes(dayTag);
    let nextDays: string[];
    if (isCurrentlyActive) {
      if (activeDays.length <= 1) return; // keep at least 1 day
      nextDays = activeDays.filter(d => d !== dayTag);
    } else {
      nextDays = [...activeDays, dayTag];
    }
    setActiveDays(nextDays);
    setFrequencyPreset('custom');
    setCustomSubMode('specific_days');
  };

  const applyDayCombo = (combo: 'mwf' | 'tts' | 'all') => {
    setFrequencyPreset('custom');
    setCustomSubMode('specific_days');
    if (combo === 'mwf') {
      setActiveDays(['M', 'W', 'F']);
    } else if (combo === 'tts') {
      setActiveDays(['T', 'T', 'S']);
    } else if (combo === 'all') {
      setActiveDays(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const resolvedUnit = habitType === 'target' ? (targetUnit === 'custom' ? customUnit.trim() : targetUnit) : undefined;
      const finalDuration = habitType === 'timed' ? Math.max(5, duration || 15) : 0;

      let finalFrequencyType: FrequencyType = 'days';
      let finalFrequencyValue: number | undefined = undefined;
      let finalActiveDays = activeDays;

      if (frequencyPreset === 'all') {
        finalFrequencyType = 'days';
        finalActiveDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
      } else if (frequencyPreset === 'weekdays') {
        finalFrequencyType = 'days';
        finalActiveDays = ['M', 'T', 'W', 'T', 'F'];
      } else if (frequencyPreset === 'weekends') {
        finalFrequencyType = 'days';
        finalActiveDays = ['S', 'S'];
      } else if (frequencyPreset === 'custom') {
        if (customSubMode === 'specific_days') {
          finalFrequencyType = 'days';
          finalFrequencyValue = activeDays.length;
          finalActiveDays = activeDays;
        } else if (customSubMode === 'interval') {
          finalFrequencyType = 'interval';
          finalFrequencyValue = Math.max(2, intervalDays || 2);
          finalActiveDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
        } else if (customSubMode === 'weekly_target') {
          finalFrequencyType = 'weekly_target';
          finalFrequencyValue = Math.min(7, Math.max(1, weeklyTargetDays || 3));
          finalActiveDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
        }
      }

      await onSave({
        title: title.trim(),
        habit_type: habitType,
        target_value: habitType === 'target' ? targetValue.trim() : (habitType === 'check_off' ? targetValue.trim() : undefined),
        target_unit: resolvedUnit,
        duration_minutes: finalDuration,
        anchor,
        energy_level: energyLevel,
        active_days: finalActiveDays,
        frequency_type: finalFrequencyType,
        frequency_value: finalFrequencyValue,
        is_active: 1,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg max-h-[90vh] bg-luma-card border border-luma-card-border rounded-3xl shadow-2xl relative flex flex-col overflow-hidden">
        {/* FIXED HEADER */}
        <div className="px-6 py-4 sm:py-5 border-b border-white/[0.06] flex items-start justify-between shrink-0 bg-[#161716]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-xl bg-luma-purple-dim flex items-center justify-center text-luma-purple shrink-0">
                <Flame className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-serif font-bold text-white tracking-tight">
                {habit ? 'Edit Daily Habit' : 'New Daily Habit'}
              </h2>
            </div>
            <p className="text-xs text-luma-text-muted">
              Build consistent rituals. Configure once a month to anchor automatically into your daily timetable.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/5 text-luma-text-muted hover:text-white transition-colors shrink-0 -mr-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SCROLLABLE FORM BODY & STICKY FOOTER */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="px-6 py-4 overflow-y-auto space-y-4 flex-1">
            {/* QUICK TEMPLATES */}
            {!habit && (
              <div className="pb-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-luma-lime mb-2">
                  <Sparkles className="w-3 h-3" />
                  <span>QUICK-START PRESETS (ONE-CLICK PREFILL):</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.label}
                      type="button"
                      onClick={() => handleApplyTemplate(tmpl)}
                      className="px-2.5 py-1 rounded-lg bg-[#191b19] hover:bg-[#252a25] border border-white/10 hover:border-luma-lime/40 text-[11px] text-white/90 transition-all text-left"
                    >
                      {tmpl.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TRACKING STYLE SELECTOR */}
            <div>
            <label className="text-xs font-mono uppercase tracking-wider text-luma-text-dim block mb-1.5">
              1. Habit Tracking Style
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setHabitType('check_off');
                  setDuration(0);
                }}
                className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                  habitType === 'check_off'
                    ? 'bg-[#252238] border-luma-purple text-white shadow-purple-glow'
                    : 'bg-[#1b1c1b] border-luma-card-border text-luma-text-muted hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Zap className={`w-4 h-4 ${habitType === 'check_off' ? 'text-luma-purple' : 'text-luma-text-dim'}`} />
                  {habitType === 'check_off' && <Check className="w-3.5 h-3.5 text-luma-purple" />}
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Check-off Ritual</div>
                  <div className="text-[10px] text-luma-text-dim mt-0.5 leading-tight">No timer needed (Wake up early, cold shower)</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setHabitType('target');
                  setDuration(0);
                }}
                className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                  habitType === 'target'
                    ? 'bg-[#1e2638] border-[#4287f5] text-white shadow-md'
                    : 'bg-[#1b1c1b] border-luma-card-border text-luma-text-muted hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Target className={`w-4 h-4 ${habitType === 'target' ? 'text-[#4287f5]' : 'text-luma-text-dim'}`} />
                  {habitType === 'target' && <Check className="w-3.5 h-3.5 text-[#4287f5]" />}
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Target Volume</div>
                  <div className="text-[10px] text-luma-text-dim mt-0.5 leading-tight">Daily amount (3L water, 10k steps, pages)</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setHabitType('timed');
                  if (duration === 0) setDuration(15);
                }}
                className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                  habitType === 'timed'
                    ? 'bg-[#242b10] border-luma-lime text-white shadow-lime-glow'
                    : 'bg-[#1b1c1b] border-luma-card-border text-luma-text-muted hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Clock className={`w-4 h-4 ${habitType === 'timed' ? 'text-luma-lime' : 'text-luma-text-dim'}`} />
                  {habitType === 'timed' && <Check className="w-3.5 h-3.5 text-luma-lime" />}
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Timed Block</div>
                  <div className="text-[10px] text-luma-text-dim mt-0.5 leading-tight">Scheduled minutes on timetable (15m, 30m)</div>
                </div>
              </button>
            </div>
          </div>

          {/* HABIT TITLE */}
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-luma-text-dim block mb-1.5">
              2. Habit Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                habitType === 'check_off'
                  ? 'e.g. Wake up early, Cold shower, Morning pushups'
                  : habitType === 'target'
                  ? 'e.g. Drink water, Walk steps, Read book'
                  : 'e.g. Morning meditation, Daily planning, Review notes'
              }
              className="w-full bg-[#1b1c1b] border border-luma-card-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-luma-lime"
            />
          </div>

          {/* DYNAMIC TRACKING INPUTS BASED ON HABIT TYPE */}
          {habitType === 'check_off' && (
            <div className="p-3.5 rounded-2xl bg-[#171817] border border-white/[0.06] space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-luma-text-dim flex items-center justify-between">
                <span>Time Cue or Target (Optional)</span>
                <span className="text-[10px] text-luma-lime">No fixed timer needed</span>
              </label>
              <input
                type="text"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="e.g. 6:00 AM, Before breakfast, Right before bed"
                className="w-full bg-[#121312] border border-luma-card-border rounded-xl px-3.5 py-2 text-xs text-white placeholder-luma-text-dim/60 focus:outline-none focus:border-luma-lime"
              />
              <p className="text-[10px] text-luma-text-muted">
                Completed with a single click. Ideal for lifestyle rituals that don't block out calendar time.
              </p>
            </div>
          )}

          {habitType === 'target' && (
            <div className="p-3.5 rounded-2xl bg-[#171817] border border-white/[0.06] space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider text-luma-text-dim block">
                Target Quantity & Measurement Unit
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] font-mono text-luma-text-dim block mb-1">Target Amount</span>
                  <input
                    type="text"
                    required
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder="e.g. 3, 10000, 20"
                    className="w-full bg-[#121312] border border-luma-card-border rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-luma-lime"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-luma-text-dim block mb-1">Unit</span>
                  <select
                    value={targetUnit}
                    onChange={(e) => setTargetUnit(e.target.value)}
                    className="w-full bg-[#121312] border border-luma-card-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-luma-lime"
                  >
                    {PRESET_UNITS.map((u) => (
                      <option key={u} value={u} className="bg-[#1b1c1b] text-white capitalize">
                        {u === 'custom' ? 'Custom unit...' : u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {targetUnit === 'custom' && (
                <div>
                  <span className="text-[10px] font-mono text-luma-text-dim block mb-1">Custom Unit Label</span>
                  <input
                    type="text"
                    required
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value)}
                    placeholder="e.g. glasses, kilometers, chapters"
                    className="w-full bg-[#121312] border border-luma-card-border rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-luma-lime"
                  />
                </div>
              )}
            </div>
          )}

          {habitType === 'timed' && (
            <div className="p-3.5 rounded-2xl bg-[#171817] border border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono uppercase tracking-wider text-luma-text-dim">
                  Duration (Minutes)
                </label>
                <div className="flex items-center gap-1">
                  {[10, 15, 20, 30, 45].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDuration(m)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition-all ${
                        duration === m
                          ? 'bg-luma-lime text-black font-bold'
                          : 'bg-[#121312] text-luma-text-dim hover:text-white'
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                min="5"
                step="5"
                required
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-[#121312] border border-luma-card-border rounded-xl px-4 py-2 text-xs text-white font-mono focus:outline-none focus:border-luma-lime"
              />
            </div>
          )}

          {/* TIME ANCHOR */}
          <div>
            <label className="text-xs font-mono uppercase tracking-wider text-luma-text-dim block mb-1.5">
              3. Time Anchor In Your Day
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAnchor('morning')}
                className={`py-2 px-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                  anchor === 'morning'
                    ? 'bg-[#2a2542] border-luma-purple text-white shadow-purple-glow'
                    : 'bg-[#1b1c1b] border-luma-card-border text-luma-text-muted hover:text-white'
                }`}
              >
                <Sun className="w-4 h-4 text-amber-400" />
                <span>Morning</span>
                <span className="text-[9px] text-luma-text-dim">After wake time</span>
              </button>

              <button
                type="button"
                onClick={() => setAnchor('floating')}
                className={`py-2 px-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                  anchor === 'floating'
                    ? 'bg-[#1e2638] border-[#4287f5] text-white shadow-md'
                    : 'bg-[#1b1c1b] border-luma-card-border text-luma-text-muted hover:text-white'
                }`}
              >
                <Waves className="w-4 h-4 text-[#4287f5]" />
                <span>Floating</span>
                <span className="text-[9px] text-luma-text-dim">Throughout day</span>
              </button>

              <button
                type="button"
                onClick={() => setAnchor('evening')}
                className={`py-2 px-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                  anchor === 'evening'
                    ? 'bg-[#2e1d2c] border-[#e85df0] text-white shadow-md'
                    : 'bg-[#1b1c1b] border-luma-card-border text-luma-text-muted hover:text-white'
                }`}
              >
                <Moon className="w-4 h-4 text-luma-purple" />
                <span>Evening</span>
                <span className="text-[9px] text-luma-text-dim">Wind-down time</span>
              </button>
            </div>
          </div>

          {/* 4. REPEATING FREQUENCY WITH CUSTOM OPTION */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-mono uppercase tracking-wider text-luma-text-dim">
                4. Repeating Frequency
              </label>
              <span className="text-[11px] font-mono text-luma-lime">
                {frequencyPreset === 'all'
                  ? '7 days / week'
                  : frequencyPreset === 'weekdays'
                  ? 'Mon – Fri (5 days)'
                  : frequencyPreset === 'weekends'
                  ? 'Sat – Sun (2 days)'
                  : customSubMode === 'specific_days'
                  ? `${activeDays.length} days / week`
                  : customSubMode === 'interval'
                  ? `Every ${intervalDays} days`
                  : `${weeklyTargetDays}x / week`}
              </span>
            </div>

            {/* PRESET SEGMENTED BUTTONS: Every day | Weekdays | Weekends | Custom */}
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#121312] border border-white/[0.08] rounded-2xl mb-3">
              <button
                type="button"
                onClick={() => handleSelectPreset('all')}
                className={`py-2 px-2 rounded-xl text-xs font-medium transition-all text-center ${
                  frequencyPreset === 'all'
                    ? 'bg-luma-lime text-black font-semibold shadow-lime-glow'
                    : 'text-luma-text-dim hover:text-white hover:bg-white/5'
                }`}
              >
                Every day
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset('weekdays')}
                className={`py-2 px-2 rounded-xl text-xs font-medium transition-all text-center ${
                  frequencyPreset === 'weekdays'
                    ? 'bg-luma-lime text-black font-semibold shadow-lime-glow'
                    : 'text-luma-text-dim hover:text-white hover:bg-white/5'
                }`}
              >
                Weekdays
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset('weekends')}
                className={`py-2 px-2 rounded-xl text-xs font-medium transition-all text-center ${
                  frequencyPreset === 'weekends'
                    ? 'bg-luma-lime text-black font-semibold shadow-lime-glow'
                    : 'text-luma-text-dim hover:text-white hover:bg-white/5'
                }`}
              >
                Weekends
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset('custom')}
                className={`py-2 px-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1 text-center ${
                  frequencyPreset === 'custom'
                    ? 'bg-luma-lime text-black font-semibold shadow-lime-glow'
                    : 'text-luma-text-dim hover:text-white hover:bg-white/5'
                }`}
              >
                <span>Custom</span>
                {frequencyPreset === 'custom' && <span className="w-1.5 h-1.5 rounded-full bg-black"></span>}
              </button>
            </div>

            {/* CUSTOM CONFIGURATION PANEL */}
            {frequencyPreset === 'custom' ? (
              <div className="p-3.5 rounded-2xl bg-[#171817] border border-white/[0.08] space-y-3 animate-fadeIn">
                {/* Custom Sub-Mode Tabs */}
                <div className="flex items-center gap-1.5 pb-2 border-b border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => setCustomSubMode('specific_days')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all ${
                      customSubMode === 'specific_days'
                        ? 'bg-white/10 text-white font-medium border border-white/20'
                        : 'text-luma-text-dim hover:text-white'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Specific Days</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCustomSubMode('interval')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all ${
                      customSubMode === 'interval'
                        ? 'bg-white/10 text-white font-medium border border-white/20'
                        : 'text-luma-text-dim hover:text-white'
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Every X Days</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCustomSubMode('weekly_target')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all ${
                      customSubMode === 'weekly_target'
                        ? 'bg-white/10 text-white font-medium border border-white/20'
                        : 'text-luma-text-dim hover:text-white'
                    }`}
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span>X Times / Week</span>
                  </button>
                </div>

                {/* Sub-Mode 1: Specific Days */}
                {customSubMode === 'specific_days' && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-luma-text-dim">Tap days to toggle:</span>
                      <div className="flex items-center gap-2 text-[10px]">
                        <button
                          type="button"
                          onClick={() => applyDayCombo('mwf')}
                          className="text-luma-text-muted hover:text-luma-lime underline"
                        >
                          Mon/Wed/Fri
                        </button>
                        <span className="text-white/20">•</span>
                        <button
                          type="button"
                          onClick={() => applyDayCombo('tts')}
                          className="text-luma-text-muted hover:text-luma-lime underline"
                        >
                          Tue/Thu/Sat
                        </button>
                        <span className="text-white/20">•</span>
                        <button
                          type="button"
                          onClick={() => applyDayCombo('all')}
                          className="text-luma-text-muted hover:text-luma-lime underline"
                        >
                          Select All
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1.5">
                      {DAY_LABELS.map((dayTag, idx) => {
                        const isActive = activeDays.includes(dayTag);
                        return (
                          <button
                            key={`${dayTag}-${idx}`}
                            type="button"
                            onClick={() => toggleDay(idx)}
                            title={DAY_FULL_NAMES[idx]}
                            className={`h-9 rounded-xl border text-xs font-mono font-bold flex flex-col items-center justify-center transition-all ${
                              isActive
                                ? 'bg-luma-lime text-black border-luma-lime shadow-sm'
                                : 'bg-[#1b1c1b] border-luma-card-border text-luma-text-dim hover:text-white'
                            }`}
                          >
                            <span>{dayTag}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sub-Mode 2: Interval (Every X Days) */}
                {customSubMode === 'interval' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white">Repeat Interval:</span>
                      <div className="flex items-center gap-1.5">
                        {[2, 3, 4].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setIntervalDays(n)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                              intervalDays === n
                                ? 'bg-luma-lime text-black font-bold'
                                : 'bg-[#121312] text-luma-text-dim hover:text-white'
                            }`}
                          >
                            {n === 2 ? 'Alternate (2d)' : `Every ${n}d`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-[#121312] p-2.5 rounded-xl border border-white/[0.06]">
                      <span className="text-xs text-luma-text-muted">Repeats every</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIntervalDays(prev => Math.max(2, prev - 1))}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-sm font-mono font-bold text-white px-2">
                          {intervalDays}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIntervalDays(prev => Math.min(30, prev + 1))}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-xs text-luma-text-muted">days</span>
                    </div>

                    <p className="text-[11px] text-luma-text-dim leading-relaxed">
                      💡 Ideal for cold showers, workout rest cycles, or alternating study disciplines.
                    </p>
                  </div>
                )}

                {/* Sub-Mode 3: Weekly Target (X Times / Week) */}
                {customSubMode === 'weekly_target' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white">Target Frequency:</span>
                      <div className="flex items-center gap-1.5">
                        {[2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setWeeklyTargetDays(n)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                              weeklyTargetDays === n
                                ? 'bg-luma-lime text-black font-bold'
                                : 'bg-[#121312] text-luma-text-dim hover:text-white'
                            }`}
                          >
                            {n}x / wk
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-[#121312] p-2.5 rounded-xl border border-white/[0.06]">
                      <span className="text-xs text-luma-text-muted">Complete</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setWeeklyTargetDays(prev => Math.max(1, prev - 1))}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-sm font-mono font-bold text-white px-2">
                          {weeklyTargetDays}
                        </span>
                        <button
                          type="button"
                          onClick={() => setWeeklyTargetDays(prev => Math.min(7, prev + 1))}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-xs text-luma-text-muted">times each week</span>
                    </div>

                    <p className="text-[11px] text-luma-text-dim leading-relaxed">
                      💡 Flexible schedule: complete on any days of the week to maintain your cadence.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Non-custom preview pills */
              <div className="grid grid-cols-7 gap-1.5">
                {DAY_LABELS.map((dayTag, idx) => {
                  const isActive = activeDays.includes(dayTag);
                  return (
                    <button
                      key={`${dayTag}-${idx}`}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      title={`${DAY_FULL_NAMES[idx]} (Click to customize)`}
                      className={`h-9 rounded-xl border text-xs font-mono font-bold flex flex-col items-center justify-center transition-all ${
                        isActive
                          ? 'bg-luma-lime text-black border-luma-lime shadow-sm'
                          : 'bg-[#1b1c1b] border-luma-card-border text-luma-text-dim hover:text-white'
                      }`}
                    >
                      <span>{dayTag}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          </div>

          {/* STICKY FOOTER */}
          <div className="px-6 py-3.5 border-t border-white/[0.06] bg-[#141514] flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-luma-text-muted hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-luma-lime hover:bg-luma-lime-hover text-black px-5 py-2.5 rounded-xl font-semibold text-xs shadow-lime-glow transition-all disabled:opacity-50"
            >
              {loading ? 'Saving...' : habit ? 'Save changes' : 'Create habit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
