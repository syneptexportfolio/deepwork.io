import React, { useState, useEffect } from 'react';
import { X, Target, Sparkles, Laptop, Briefcase, GraduationCap, Activity, PenTool, Compass, Trash2 } from 'lucide-react';
import { WeeklyGoal, Goal } from '../../services/api';

interface WeeklyGoalModalProps {
  isOpen: boolean;
  goal: WeeklyGoal | null;
  longTermGoals?: Goal[];
  onClose: () => void;
  onSave: (data: Partial<WeeklyGoal>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

const CATEGORIES = [
  { id: 'Project', label: 'Project & Dev', icon: Laptop, color: 'emerald' },
  { id: 'Business', label: 'Job & Business', icon: Briefcase, color: 'blue' },
  { id: 'Study', label: 'Exam & Study', icon: GraduationCap, color: 'amber' },
  { id: 'Fitness', label: 'Health & Fitness', icon: Activity, color: 'lime' },
  { id: 'Creative', label: 'Creative & Other', icon: PenTool, color: 'pink' },
];

const PRESET_UNITS = [
  'modules',
  'features',
  'pull requests',
  'bugs',
  'clients',
  'calls',
  'proposals',
  'topics',
  'chapters',
  'problems',
  'workouts',
  'sessions',
  'km',
  'articles',
  'drafts',
  'hours',
  'tasks',
  'custom',
];

const TEMPLATES = [
  {
    label: '💻 Ship Core Modules',
    title: 'Ship Core Feature Modules',
    category: 'Project',
    targetUnits: 4,
    unitLabel: 'modules',
    priority: 'HIGH' as const,
    energyLevel: 'deep_focus' as const,
  },
  {
    label: '💼 Client Outreach Sprint',
    title: 'Outreach to Prospective Clients',
    category: 'Business',
    targetUnits: 15,
    unitLabel: 'clients',
    priority: 'HIGH' as const,
    energyLevel: 'deep_focus' as const,
  },
  {
    label: '📚 Core Syllabus Topics',
    title: 'High-Yield Syllabus Mastery',
    category: 'Study',
    targetUnits: 6,
    unitLabel: 'topics',
    priority: 'HIGH' as const,
    energyLevel: 'deep_focus' as const,
  },
  {
    label: '🏃 Workout Sessions',
    title: 'Cardio & Strength Training Cadence',
    category: 'Fitness',
    targetUnits: 5,
    unitLabel: 'workouts',
    priority: 'MEDIUM' as const,
    energyLevel: 'light' as const,
  },
  {
    label: '✍️ Draft Articles',
    title: 'Publish Weekly Content Articles',
    category: 'Creative',
    targetUnits: 3,
    unitLabel: 'articles',
    priority: 'MEDIUM' as const,
    energyLevel: 'deep_focus' as const,
  },
  {
    label: '🔧 Sprint Bug Fixes',
    title: 'Triage & Resolve High-Priority Bugs',
    category: 'Project',
    targetUnits: 8,
    unitLabel: 'bugs',
    priority: 'HIGH' as const,
    energyLevel: 'deep_focus' as const,
  },
];

export const WeeklyGoalModal: React.FC<WeeklyGoalModalProps> = ({
  isOpen,
  goal,
  longTermGoals = [],
  onClose,
  onSave,
  onDelete,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Project');
  const [targetUnits, setTargetUnits] = useState(5);
  const [unitLabel, setUnitLabel] = useState('modules');
  const [customUnit, setCustomUnit] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('HIGH');
  const [energyLevel, setEnergyLevel] = useState<'deep_focus' | 'light'>('deep_focus');
  const [linkedGoalId, setLinkedGoalId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    setIsConfirmingDelete(false);
    if (goal) {
      setTitle(goal.title);
      setCategory(goal.category || 'Project');
      setTargetUnits(goal.target_units);
      const unit = goal.unit_label || 'modules';
      if (unit && !PRESET_UNITS.slice(0, -1).includes(unit)) {
        setUnitLabel('custom');
        setCustomUnit(unit);
      } else {
        setUnitLabel(unit);
        setCustomUnit('');
      }
      setPriority(goal.priority);
      setEnergyLevel(goal.energy_level);
      setLinkedGoalId(goal.goal_id || '');
    } else {
      setTitle('');
      setCategory('Project');
      setTargetUnits(5);
      setUnitLabel('modules');
      setCustomUnit('');
      setPriority('HIGH');
      setEnergyLevel('deep_focus');
      setLinkedGoalId('');
    }
  }, [goal, isOpen]);

  if (!isOpen) return null;

  const handleConfirmDelete = async () => {
    if (!goal || !onDelete) return;
    setLoading(true);
    try {
      await onDelete(goal.id);
      onClose();
    } finally {
      setLoading(false);
      setIsConfirmingDelete(false);
    }
  };

  const handleApplyTemplate = (tmpl: typeof TEMPLATES[0]) => {
    setTitle(tmpl.title);
    setCategory(tmpl.category);
    setTargetUnits(tmpl.targetUnits);
    if (!PRESET_UNITS.slice(0, -1).includes(tmpl.unitLabel)) {
      setUnitLabel('custom');
      setCustomUnit(tmpl.unitLabel);
    } else {
      setUnitLabel(tmpl.unitLabel);
      setCustomUnit('');
    }
    setPriority(tmpl.priority);
    setEnergyLevel(tmpl.energyLevel);
  };

  const resolvedUnit = unitLabel === 'custom' ? (customUnit.trim() || 'units') : unitLabel;
  const unitsPerDay = Number((Math.max(1, targetUnits) / 7).toFixed(1));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const now = new Date();
      const weekStart = now.toISOString().split('T')[0];
      const weekEnd = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];

      await onSave({
        title: title.trim(),
        category,
        target_units: Math.max(1, targetUnits || 1),
        completed_units: goal ? goal.completed_units : 0,
        unit_label: resolvedUnit,
        priority,
        energy_level: energyLevel,
        goal_id: linkedGoalId ? linkedGoalId : null,
        week_start: goal ? goal.week_start : weekStart,
        week_end: goal ? goal.week_end : weekEnd,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg max-h-[90vh] bg-luma-card border border-luma-card-border rounded-3xl shadow-2xl relative flex flex-col overflow-hidden">
        {/* FIXED HEADER (Never pushed off screen) */}
        <div className="px-6 py-4 sm:py-5 border-b border-white/[0.06] flex items-start justify-between shrink-0 bg-[#161716]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-xl bg-[#2a3015] flex items-center justify-center text-luma-lime shrink-0">
                <Target className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-xl font-serif font-bold text-white tracking-tight">
                {goal ? 'Edit Weekly Goal' : 'New Weekly Goal'}
              </h2>
            </div>
            <p className="text-xs text-luma-text-muted">
              Set weekly sprint targets for software builds, client business, exam prep, or habits.
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
            {/* QUICK PRESETS (Multi-Domain Templates) */}
            {!goal && (
              <div className="pb-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-luma-lime mb-2">
                  <Sparkles className="w-3 h-3" />
                  <span>QUICK-START PRESETS ACROSS ALL DOMAINS:</span>
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

            {/* CATEGORY / DOMAIN SELECTOR */}
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-luma-text-dim block mb-1.5">
                Goal Category & Track
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {CATEGORIES.map((cat) => {
                  const IconComponent = cat.icon;
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setCategory(cat.id);
                        if (cat.id === 'Project' && (unitLabel === 'topics' || unitLabel === 'clients')) {
                          setUnitLabel('modules');
                        } else if (cat.id === 'Business' && (unitLabel === 'topics' || unitLabel === 'modules')) {
                          setUnitLabel('clients');
                        } else if (cat.id === 'Study' && (unitLabel === 'modules' || unitLabel === 'clients')) {
                          setUnitLabel('topics');
                        } else if (cat.id === 'Fitness') {
                          setUnitLabel('workouts');
                        }
                      }}
                      className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all ${
                        isSelected
                          ? 'bg-luma-lime/10 border-luma-lime text-white shadow-sm'
                          : 'bg-[#1b1c1b] border-luma-card-border text-luma-text-muted hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <IconComponent className={`w-3.5 h-3.5 ${isSelected ? 'text-luma-lime' : 'text-luma-text-dim'}`} />
                      <span className="text-xs font-medium truncate">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* GOAL TITLE */}
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-luma-text-dim block mb-1.5">
                Weekly Goal Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  category === 'Project'
                    ? 'e.g. Ship Stripe webhook integration, build auth system'
                    : category === 'Business'
                    ? 'e.g. Q3 Sales Outreach, Complete 15 client calls'
                    : category === 'Fitness'
                    ? 'e.g. Complete 5 gym sessions & 20 km run'
                    : category === 'Creative'
                    ? 'e.g. Write 3 blog posts, film 2 tutorial videos'
                    : 'e.g. Review 50 organic chemistry problems, 6 topics'
                }
                className="w-full bg-[#1b1c1b] border border-luma-card-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-luma-lime placeholder-luma-text-dim/50"
              />
            </div>

            {/* TARGET UNITS & UNIT LABEL DROPDOWN */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-luma-text-dim block mb-1.5">
                  Target Units
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={targetUnits}
                  onChange={(e) => setTargetUnits(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-[#1b1c1b] border border-luma-card-border rounded-xl px-4 py-2 text-sm text-white font-mono focus:outline-none focus:border-luma-lime"
                />
              </div>

              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-luma-text-dim block mb-1.5">
                  Measurement Unit
                </label>
                <select
                  value={unitLabel}
                  onChange={(e) => setUnitLabel(e.target.value)}
                  className="w-full bg-[#1b1c1b] border border-luma-card-border rounded-xl px-3 py-2 text-sm text-white capitalize focus:outline-none focus:border-luma-lime"
                >
                  {PRESET_UNITS.map((u) => (
                    <option key={u} value={u} className="bg-[#1b1c1b] text-white">
                      {u === 'custom' ? 'Custom unit label...' : u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {unitLabel === 'custom' && (
              <div className="animate-fadeIn">
                <label className="text-[10px] font-mono uppercase tracking-wider text-luma-text-dim block mb-1">
                  Custom Unit Label
                </label>
                <input
                  type="text"
                  required
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  placeholder="e.g. deliverables, algorithms, leads"
                  className="w-full bg-[#121312] border border-luma-card-border rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-luma-lime"
                />
              </div>
            )}

            {/* LIVE PACE CALCULATOR READOUT */}
            <div className="p-2.5 rounded-xl bg-[#141514] border border-white/[0.06] flex items-center justify-between">
              <span className="text-xs text-luma-text-dim">Pace Required:</span>
              <span className="text-xs font-mono text-luma-lime font-medium">
                Target: {targetUnits} {resolvedUnit} → ~{unitsPerDay} {resolvedUnit} / day
              </span>
            </div>

            {/* OPTIONAL LINK TO LONG-TERM GOAL */}
            {longTermGoals.length > 0 && (
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-luma-text-dim flex items-center gap-1.5 mb-1.5">
                  <Compass className="w-3.5 h-3.5 text-luma-lime" />
                  <span>Link to Long-Term Goal (Optional)</span>
                </label>
                <select
                  value={linkedGoalId}
                  onChange={(e) => setLinkedGoalId(e.target.value)}
                  className="w-full bg-[#1b1c1b] border border-luma-card-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-luma-lime"
                >
                  <option value="">None (Independent Weekly Sprint)</option>
                  {longTermGoals.map((g) => (
                    <option key={g.id} value={g.id} className="bg-[#1b1c1b] text-white">
                      {g.title} ({g.category || 'General'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* PRIORITY & COGNITIVE ENERGY */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-luma-text-dim block mb-1.5">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full bg-[#1b1c1b] border border-luma-card-border rounded-xl px-4 py-2 text-xs text-white font-medium focus:outline-none focus:border-luma-lime"
                >
                  <option value="HIGH">High Priority</option>
                  <option value="MEDIUM">Medium Priority</option>
                  <option value="LOW">Low Priority</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-luma-text-dim block mb-1.5">
                  Cognitive Energy
                </label>
                <select
                  value={energyLevel}
                  onChange={(e) => setEnergyLevel(e.target.value as any)}
                  className="w-full bg-[#1b1c1b] border border-luma-card-border rounded-xl px-4 py-2 text-xs text-white font-medium focus:outline-none focus:border-luma-lime"
                >
                  <option value="deep_focus">Deep Focus (Prime Blocks)</option>
                  <option value="light">Light Work (Recovery Dip)</option>
                </select>
              </div>
            </div>
          </div>

          {/* PERMANENT STICKY BOTTOM FOOTER (Always visible, never cut off!) */}
          <div className="px-6 py-3.5 border-t border-white/[0.06] bg-[#141514] flex items-center justify-between shrink-0">
            {goal && onDelete ? (
              isConfirmingDelete ? (
                <div className="flex items-center gap-2 bg-[#2a1717] border border-red-500/30 px-3 py-1.5 rounded-2xl animate-fadeIn">
                  <span className="text-xs text-red-300 font-medium">Delete goal?</span>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={loading}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                  >
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                    className="text-luma-text-muted hover:text-white px-2 py-1 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 p-2 rounded-xl hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              )
            ) : <div />}

            <div className="flex items-center gap-3">
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
                {loading ? 'Saving...' : goal ? 'Save changes' : 'Set weekly goal'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
