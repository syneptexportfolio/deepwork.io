import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  CheckSquare,
  Sparkles,
  Laptop,
  Briefcase,
  GraduationCap,
  Activity,
  Zap,
  Clock,
  Minus,
  Plus,
} from 'lucide-react';
import { Task, extractTimeFromText, getTimeBucket } from '../../services/api';

interface TaskModalProps {
  isOpen: boolean;
  task: Task | null;
  onClose: () => void;
  onSave: (data: Partial<Task>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

const CATEGORIES = [
  { id: 'Project', label: 'Project & Dev', icon: Laptop },
  { id: 'Business', label: 'Job & Business', icon: Briefcase },
  { id: 'Study', label: 'Exam & Study', icon: GraduationCap },
  { id: 'Fitness', label: 'Health & Fitness', icon: Activity },
  { id: 'Personal & Social', label: 'Personal & Social', icon: Sparkles },
  { id: 'Personal', label: 'Personal & Admin', icon: Zap },
];

const TEMPLATES = [
  {
    label: '🤝 Team / Client Meeting',
    title: 'Client sync & project review',
    category: 'Business',
    isUntimed: true,
    duration: 0,
    priority: 'HIGH' as const,
    energyLevel: 'light' as const,
    columnBucket: 'up_next' as const,
  },
  {
    label: '📞 Call & Outreach',
    title: 'Outreach call & follow-up discussion',
    category: 'Business',
    isUntimed: true,
    duration: 0,
    priority: 'MEDIUM' as const,
    energyLevel: 'light' as const,
    columnBucket: 'up_next' as const,
  },
  {
    label: '📍 Errand / Visit',
    title: 'Errand, bank visit or appointment',
    category: 'Personal',
    isUntimed: true,
    duration: 0,
    priority: 'LOW' as const,
    energyLevel: 'light' as const,
    columnBucket: 'up_next' as const,
  },
  {
    label: '💻 Ship Core Module',
    title: 'Ship feature component & tests',
    category: 'Project',
    isUntimed: false,
    duration: 60,
    priority: 'HIGH' as const,
    energyLevel: 'deep_focus' as const,
    columnBucket: 'now' as const,
  },
  {
    label: '📚 Syllabus Mastery',
    title: 'High-yield concept review & question bank',
    category: 'Study',
    isUntimed: false,
    duration: 45,
    priority: 'HIGH' as const,
    energyLevel: 'deep_focus' as const,
    columnBucket: 'now' as const,
  },
  {
    label: '🏃 Workout Session',
    title: 'Strength training & mobility session',
    category: 'Fitness',
    isUntimed: false,
    duration: 45,
    priority: 'MEDIUM' as const,
    energyLevel: 'light' as const,
    columnBucket: 'later' as const,
  },
  {
    label: '⚡ Inbox Zero & Triage',
    title: 'Email triage, PR reviews & admin backlog',
    category: 'Personal',
    isUntimed: false,
    duration: 15,
    priority: 'LOW' as const,
    energyLevel: 'light' as const,
    columnBucket: 'now' as const,
  },
];

const DURATION_PRESETS = [15, 25, 45, 60, 90];

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  task,
  onClose,
  onSave,
  onDelete,
}) => {
  const [title, setTitle] = useState('');
  const [isUntimed, setIsUntimed] = useState(false);
  const [duration, setDuration] = useState(45);
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('HIGH');
  const [energyLevel, setEnergyLevel] = useState<'deep_focus' | 'light'>('deep_focus');
  const [category, setCategory] = useState('Project');
  const [columnBucket, setColumnBucket] = useState<'now' | 'up_next' | 'later'>('now');
  const [scheduledStart, setScheduledStart] = useState('');
  const [loading, setLoading] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    setIsConfirmingDelete(false);
    if (task) {
      setTitle(task.title);
      const untimed = task.duration_minutes === 0;
      setIsUntimed(untimed);
      setDuration(untimed ? 0 : task.duration_minutes || 45);
      setPriority(task.priority || 'HIGH');
      setEnergyLevel(task.energy_level || 'deep_focus');
      setCategory(task.category || 'Project');
      setColumnBucket(task.column_bucket || 'now');
      setScheduledStart(task.scheduled_start || '');
    } else {
      setTitle('');
      setIsUntimed(false);
      setDuration(45);
      setPriority('HIGH');
      setEnergyLevel('deep_focus');
      setCategory('Project');
      setColumnBucket('now');
      setScheduledStart('');
    }
  }, [task, isOpen]);

  if (!isOpen) return null;

  const handleApplyTemplate = (tmpl: typeof TEMPLATES[0]) => {
    setTitle(tmpl.title);
    setCategory(tmpl.category);
    setIsUntimed(tmpl.isUntimed);
    setDuration(tmpl.duration);
    setPriority(tmpl.priority);
    setEnergyLevel(tmpl.energyLevel);
    setColumnBucket(tmpl.columnBucket);
  };

  const setTimeNow = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setScheduledStart(`${hh}:${mm}`);
  };

  const add30MinToSchedule = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setScheduledStart(`${hh}:${mm}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const detected = !scheduledStart ? extractTimeFromText(title.trim()) : null;
      const finalScheduledStart = scheduledStart || detected || null;
      let finalCategory = category.trim() || 'General';
      let finalBucket = finalScheduledStart ? getTimeBucket(finalScheduledStart) : columnBucket;
      let finalEnergy = energyLevel;

      if (finalScheduledStart && finalScheduledStart >= '17:00') {
        if (finalCategory === 'Project' || finalCategory === 'General') finalCategory = 'Personal & Social';
        finalBucket = 'later';
        if (finalEnergy === 'deep_focus') finalEnergy = 'light';
      }

      await onSave({
        title: title.trim(),
        duration_minutes: isUntimed ? 0 : Math.max(0, duration),
        priority,
        energy_level: finalEnergy,
        category: finalCategory,
        column_bucket: finalBucket,
        scheduled_start: finalScheduledStart,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!task || !onDelete) return;
    setLoading(true);
    try {
      await onDelete(task.id);
      onClose();
    } finally {
      setLoading(false);
      setIsConfirmingDelete(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg max-h-[90vh] bg-luma-card border border-luma-card-border rounded-3xl shadow-2xl relative flex flex-col overflow-hidden">
        {/* FIXED HEADER */}
        <div className="px-6 py-4 sm:py-5 border-b border-white/[0.06] flex items-start justify-between shrink-0 bg-[#161716]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#2a3015] border border-luma-lime/30 flex items-center justify-center text-luma-lime shrink-0">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-white tracking-tight mb-0.5">
                {task ? 'Edit Task' : 'New Task'}
              </h2>
              <p className="text-xs text-luma-text-muted">
                Add timed deep blocks or untimed tasks like meetings, calls & errands.
              </p>
            </div>
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
            {/* QUICK-START PRESETS */}
            {!task && (
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

            {/* TITLE */}
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-luma-text-dim block mb-1.5">
                Task Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => {
                  const val = e.target.value;
                  setTitle(val);
                  if (!scheduledStart) {
                    const detected = extractTimeFromText(val);
                    if (detected) {
                      setScheduledStart(detected);
                      if (detected >= '17:00') {
                        setColumnBucket('later');
                        setCategory('Personal & Social');
                      }
                    }
                  }
                }}
                placeholder="e.g. Party at 8:00pm, client meeting at 11am, ship feature module"
                className="w-full bg-[#1b1c1b] border border-luma-card-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-luma-lime transition-colors"
              />
            </div>

            {/* CATEGORY / DOMAIN SELECTOR */}
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-luma-text-dim block mb-1.5">
                Domain & Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-2">
                {CATEGORIES.map((cat) => {
                  const IconComponent = cat.icon;
                  const isSelected = category.toLowerCase().startsWith(cat.id.toLowerCase());
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
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
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Or type specific tag (e.g. Client Sync, Marketing, Biology, Errands)"
                className="w-full bg-[#161716] border border-white/[0.08] rounded-xl px-3.5 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-luma-lime transition-colors font-mono"
              />
            </div>

            {/* DURATION & TASK NATURE (TIMED VS UNTIMED) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-luma-text-dim">
                  Duration & Format
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUntimed(false);
                      if (duration === 0) setDuration(45);
                    }}
                    className={`px-2.5 py-0.5 rounded-lg text-[11px] font-mono transition-all ${
                      !isUntimed
                        ? 'bg-luma-lime/20 text-luma-lime border border-luma-lime/40 font-bold'
                        : 'text-luma-text-dim hover:text-white'
                    }`}
                  >
                    ⏱️ Timed
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUntimed(true);
                      setDuration(0);
                    }}
                    className={`px-2.5 py-0.5 rounded-lg text-[11px] font-mono transition-all ${
                      isUntimed
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                        : 'text-luma-text-dim hover:text-white'
                    }`}
                  >
                    ⚡ Untimed
                  </button>
                </div>
              </div>

              {isUntimed ? (
                <div className="p-3 rounded-2xl bg-[#1b1a16] border border-amber-500/30 flex items-center justify-between animate-fadeIn">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <Zap className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-white block">Untimed Action Item</span>
                      <span className="text-[10px] text-luma-text-muted block">
                        No fixed minutes needed · perfect for meetings, calls, errands & appointments.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUntimed(false);
                      setDuration(45);
                    }}
                    className="text-[11px] font-mono text-luma-lime hover:underline shrink-0 ml-2"
                  >
                    Set minutes
                  </button>
                </div>
              ) : (
                <div className="space-y-2 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex flex-wrap gap-1.5">
                      {DURATION_PRESETS.map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => {
                            setIsUntimed(false);
                            setDuration(mins);
                          }}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-medium transition-all ${
                            !isUntimed && duration === mins
                              ? 'bg-luma-lime text-black border-luma-lime font-bold shadow-lime-glow'
                              : 'bg-[#1b1c1b] border-luma-card-border text-luma-text-muted hover:text-white hover:bg-white/5'
                          }`}
                        >
                          {mins}m {mins === 25 ? '⚡ Pomodoro' : ''}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 bg-[#161716] border border-white/[0.08] rounded-xl p-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setDuration((prev) => Math.max(5, prev - 5))}
                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min="5"
                        step="5"
                        value={duration}
                        onChange={(e) => setDuration(parseInt(e.target.value, 10) || 5)}
                        className="w-12 bg-transparent text-center text-xs font-mono font-bold text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setDuration((prev) => prev + 5)}
                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* QUEUE PLACEMENT (MORNING / AFTERNOON / EVENING) */}
            <div>
              <label className="text-xs font-mono uppercase tracking-wider text-luma-text-dim block mb-1.5">
                Queue Placement (Time of Day)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setColumnBucket('now')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    columnBucket === 'now'
                      ? 'bg-luma-lime/10 border-luma-lime text-white shadow-sm'
                      : 'bg-[#1b1c1b] border-luma-card-border text-luma-text-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="text-xs font-bold text-luma-lime flex items-center gap-1.5 mb-0.5">
                    <span>🌅 MORNING</span>
                  </div>
                  <span className="text-[10px] text-luma-text-dim block">Start of day focus</span>
                </button>

                <button
                  type="button"
                  onClick={() => setColumnBucket('up_next')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    columnBucket === 'up_next'
                      ? 'bg-[#292418] border-amber-500/60 text-white shadow-sm'
                      : 'bg-[#1b1c1b] border-luma-card-border text-luma-text-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5 mb-0.5">
                    <span>☀️ AFTERNOON</span>
                  </div>
                  <span className="text-[10px] text-luma-text-dim block">Midday, calls & meetings</span>
                </button>

                <button
                  type="button"
                  onClick={() => setColumnBucket('later')}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    columnBucket === 'later'
                      ? 'bg-[#252238] border-luma-purple text-white shadow-sm'
                      : 'bg-[#1b1c1b] border-luma-card-border text-luma-text-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="text-xs font-bold text-purple-400 flex items-center gap-1.5 mb-0.5">
                    <span>🌙 EVENING</span>
                  </div>
                  <span className="text-[10px] text-luma-text-dim block">Night wrap-up & review</span>
                </button>
              </div>
            </div>

            {/* PRIORITY & COGNITIVE ENERGY */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* PRIORITY */}
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-luma-text-dim block mb-1.5">
                  Priority
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['HIGH', 'MEDIUM', 'LOW'] as const).map((p) => {
                    const isSelected = priority === p;
                    const style =
                      p === 'HIGH'
                        ? isSelected
                          ? 'bg-red-500/20 border-red-500 text-red-300 shadow-sm'
                          : 'hover:border-red-500/30 text-luma-text-muted'
                        : p === 'MEDIUM'
                        ? isSelected
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                          : 'hover:border-amber-500/30 text-luma-text-muted'
                        : isSelected
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                        : 'hover:border-emerald-500/30 text-luma-text-muted';

                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`py-2 px-2 rounded-xl border text-xs font-mono font-bold transition-all text-center bg-[#1b1c1b] border-luma-card-border ${style}`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* COGNITIVE ENERGY */}
              <div>
                <label className="text-xs font-mono uppercase tracking-wider text-luma-text-dim block mb-1.5">
                  Cognitive Energy
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEnergyLevel('deep_focus')}
                    className={`p-2 rounded-xl border text-left transition-all ${
                      energyLevel === 'deep_focus'
                        ? 'bg-[#201d36] border-luma-purple text-white shadow-sm'
                        : 'bg-[#1b1c1b] border-luma-card-border text-luma-text-muted hover:text-white'
                    }`}
                  >
                    <span className="text-xs font-bold block mb-0.5">🧠 Deep Focus</span>
                    <span className="text-[10px] text-luma-text-dim block">Prime focus</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEnergyLevel('light')}
                    className={`p-2 rounded-xl border text-left transition-all ${
                      energyLevel === 'light'
                        ? 'bg-[#291e17] border-[#d9822b] text-white shadow-sm'
                        : 'bg-[#1b1c1b] border-luma-card-border text-luma-text-muted hover:text-white'
                    }`}
                  >
                    <span className="text-xs font-bold block mb-0.5">⚡ Light / Admin</span>
                    <span className="text-[10px] text-luma-text-dim block">Calls & meetings</span>
                  </button>
                </div>
              </div>
            </div>

            {/* SCHEDULED START TIME (OPTIONAL - ESPECIALLY USEFUL FOR MEETINGS & APPOINTMENTS) */}
            <div className="p-3 rounded-2xl bg-[#171817] border border-white/[0.06]">
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-luma-text-dim">
                  <Clock className="w-3.5 h-3.5 text-luma-lime" />
                  <span>Scheduled Time (Meetings, Appointments & Calls)</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={setTimeNow}
                    className="text-[10px] font-mono text-luma-lime hover:underline"
                  >
                    Set to Now
                  </button>
                  <span className="text-white/20">•</span>
                  <button
                    type="button"
                    onClick={add30MinToSchedule}
                    className="text-[10px] font-mono text-luma-text-muted hover:text-white"
                  >
                    +30m
                  </button>
                  {scheduledStart && (
                    <>
                      <span className="text-white/20">•</span>
                      <button
                        type="button"
                        onClick={() => setScheduledStart('')}
                        className="text-[10px] font-mono text-red-400 hover:underline"
                      >
                        Clear
                      </button>
                    </>
                  )}
                </div>
              </div>
              <input
                type="time"
                value={scheduledStart}
                onChange={(e) => setScheduledStart(e.target.value)}
                className="w-full bg-[#1b1c1b] border border-luma-card-border rounded-xl px-4 py-2 text-xs text-white font-mono focus:outline-none focus:border-luma-lime"
              />
            </div>
          </div>

          {/* PERMANENT STICKY BOTTOM FOOTER (Always visible, never cut off!) */}
          <div className="px-6 py-3.5 border-t border-white/[0.06] bg-[#141514] flex items-center justify-between shrink-0">
            {task && onDelete ? (
              isConfirmingDelete ? (
                <div className="flex items-center gap-2 bg-[#2a1717] border border-red-500/30 px-3 py-1.5 rounded-2xl animate-fadeIn">
                  <span className="text-xs text-red-300 font-medium">Delete task?</span>
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
                disabled={loading || !title.trim()}
                className="bg-luma-lime hover:bg-luma-lime-hover text-black px-5 py-2.5 rounded-xl font-semibold text-xs shadow-lime-glow transition-all disabled:opacity-50 active:scale-95"
              >
                {loading ? 'Saving...' : task ? 'Save changes' : 'Create task'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
