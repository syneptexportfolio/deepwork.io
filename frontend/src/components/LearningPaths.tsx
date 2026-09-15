import React, { useState, useEffect } from 'react';
import { Plus, Check, RefreshCw, Circle, Flag, Trophy, Sparkles, Play, Trash2, Compass } from 'lucide-react';
import { Goal, SyllabusTopic } from '../services/api';

interface LearningPathsProps {
  goals: Goal[];
  selectedGoalId?: string;
  onSelectGoalId?: (id: string) => void;
  onNewPath: () => void;
  onToggleTopic: (goalId: string, topicId: string) => void;
  onStartFocus?: (taskTitle: string, durationMinutes: number) => void;
  onDeletePath?: (id: string) => Promise<void>;
}

// Category Badge Helper
export const getCategoryBadge = (category?: string) => {
  switch (category) {
    case 'Project / Build':
      return { label: 'PROJECT', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
    case 'Job / Business':
      return { label: 'BUSINESS', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
    case 'Skill / Mastery':
      return { label: 'SKILL', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' };
    case 'Exam / Academic':
      return { label: 'EXAM', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
    default:
      return { label: 'GOAL', color: 'bg-white/10 text-white/80 border-white/20' };
  }
};

// Dynamic Runway Card Title
const getRunwayTitle = (category?: string) => {
  switch (category) {
    case 'Project / Build':
      return 'Project Runway';
    case 'Job / Business':
      return 'Initiative Runway';
    case 'Skill / Mastery':
      return 'Mastery Runway';
    case 'Exam / Academic':
      return 'Exam Runway';
    default:
      return 'Target Runway';
  }
};

// Dynamic Checklist Title
const getChecklistTitle = (category?: string) => {
  switch (category) {
    case 'Project / Build':
      return 'Roadmap & Key Features';
    case 'Job / Business':
      return 'Key Deliverables & Action Items';
    case 'Skill / Mastery':
      return 'Skill Modules & Practice Topics';
    case 'Exam / Academic':
      return 'Syllabus Topics & High-Yield Units';
    default:
      return 'Deliverables & Milestones';
  }
};

export const LearningPaths: React.FC<LearningPathsProps> = ({
  goals,
  selectedGoalId,
  onSelectGoalId,
  onNewPath,
  onToggleTopic,
  onStartFocus,
  onDeletePath,
}) => {
  const [internalGoalId, setInternalGoalId] = useState<string>(selectedGoalId || goals[0]?.id || '');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (selectedGoalId) {
      setInternalGoalId(selectedGoalId);
      setIsConfirmingDelete(false);
    }
  }, [selectedGoalId]);

  const activeGoal = goals.find((g) => g.id === internalGoalId) || goals[0];

  if (!activeGoal || goals.length === 0) {
    return (
      <div className="text-center py-24 space-y-4 animate-fadeIn">
        <div className="w-14 h-14 rounded-3xl bg-luma-card border border-luma-card-border flex items-center justify-center mx-auto text-luma-text-muted">
          <Compass className="w-7 h-7 stroke-[1.5]" />
        </div>
        <h3 className="text-xl font-serif text-white font-medium">No projects or goals active</h3>
        <p className="text-xs text-luma-text-muted max-w-sm mx-auto leading-relaxed">
          Create engineering projects, business deliverables, exam runways, or skill mastery tracks.
        </p>
        <div className="pt-2">
          <button
            onClick={onNewPath}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-luma-lime text-black text-xs font-semibold shadow-lime-glow hover:bg-luma-lime-hover active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Create your first project or goal</span>
          </button>
        </div>
      </div>
    );
  }

  const progressPercent = Math.min(100, Math.round((activeGoal.covered_units / Math.max(activeGoal.total_units, 1)) * 100));

  const targetDate = new Date(activeGoal.target_date).getTime();
  const now = new Date().getTime();
  const daysRemaining = Math.max(0, Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24)));

  // SVG circular stroke calculation
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  const categoryBadge = getCategoryBadge(activeGoal.category);
  const runwayTitle = getRunwayTitle(activeGoal.category);
  const checklistTitle = getChecklistTitle(activeGoal.category);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-mono tracking-widest uppercase text-luma-text-dim mb-1">
            Deadline-Aware Execution
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-white tracking-tight mb-2">
            Projects & Goals
          </h1>
          <p className="text-sm text-luma-text-muted">
            Every long-term milestone has a next best move.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {onDeletePath && (
            isConfirmingDelete ? (
              <div className="flex items-center gap-1.5 bg-[#2a1717] border border-red-500/30 px-3 py-1.5 rounded-2xl animate-fadeIn">
                <span className="text-[11px] font-mono text-red-300">Delete?</span>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      await onDeletePath(activeGoal.id);
                    } finally {
                      setIsDeleting(false);
                      setIsConfirmingDelete(false);
                    }
                  }}
                  className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded-xl text-[10px] font-semibold transition-all disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(false)}
                  className="text-luma-text-muted hover:text-white px-1.5 py-0.5 text-xs transition-colors"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-luma-card border border-luma-card-border hover:border-red-500/30 hover:bg-red-500/10 text-xs font-medium text-luma-text-dim hover:text-red-400 transition-all"
                title="Delete this project or goal"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )
          )}

          <button
            onClick={onNewPath}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-luma-card border border-luma-card-border hover:bg-white/[0.04] text-xs font-medium text-white transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-luma-text-muted" />
            <span>New project / goal</span>
          </button>
        </div>
      </div>

      {/* Goal Selector Pills (if multiple goals) */}
      {goals.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {goals.map((g) => {
            const badge = getCategoryBadge(g.category);
            const isSelected = g.id === activeGoal.id;

            return (
              <button
                key={g.id}
                onClick={() => {
                  setInternalGoalId(g.id);
                  if (onSelectGoalId) onSelectGoalId(g.id);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all shrink-0 ${
                  isSelected
                    ? 'bg-luma-cream text-luma-cream-text font-semibold shadow-sm'
                    : 'bg-luma-card border border-luma-card-border text-luma-text-muted hover:text-white'
                }`}
              >
                <span>{g.title}</span>
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border ${badge.color}`}>
                  {badge.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Syllabus / Roadmap & Donut Progress (7 cols) */}
        <div className="lg:col-span-7 bg-luma-card border border-luma-card-border rounded-3xl p-6">
          {/* Donut and Title Header */}
          <div className="flex items-center gap-6 mb-8">
            {/* SVG Circular Progress Ring */}
            <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r={radius}
                  className="stroke-[#252825] fill-none"
                  strokeWidth="7"
                />
                <circle
                  cx="48"
                  cy="48"
                  r={radius}
                  className="stroke-luma-purple fill-none transition-all duration-700 ease-out"
                  strokeWidth="7"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold font-mono text-white">
                  {progressPercent}%
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <h2 className="text-xl font-semibold text-white tracking-tight">
                  {activeGoal.title}
                </h2>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${categoryBadge.color}`}>
                  {categoryBadge.label}
                </span>
              </div>
              <p className="text-xs text-luma-text-muted font-mono">
                {daysRemaining} days remaining · {activeGoal.covered_units} of {activeGoal.total_units} {activeGoal.unit_label} complete
              </p>
            </div>
          </div>

          {/* Checklist Header */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/[0.06]">
            <span className="text-xs font-mono uppercase tracking-wider text-luma-text-dim">
              {checklistTitle}
            </span>
            <span className="text-xs font-mono text-luma-text-muted">
              {activeGoal.syllabus.filter((t) => t.covered).length} / {activeGoal.syllabus.length} DONE
            </span>
          </div>

          {/* Topic / Milestone List */}
          <div className="space-y-1">
            {activeGoal.syllabus.length > 0 ? (
              activeGoal.syllabus.map((topic: SyllabusTopic) => {
                const isCovered = topic.covered || topic.status === 'COVERED';
                const isDueToday = topic.status === 'DUE TODAY';
                const isHighWeight = topic.status === 'HIGH WEIGHT';
                const isNextUp = topic.status === 'NEXT UP';

                return (
                  <div
                    key={topic.id}
                    onClick={() => onToggleTopic(activeGoal.id, topic.id)}
                    className="flex items-center justify-between py-3.5 px-3 rounded-xl hover:bg-white/[0.02] border-b border-white/[0.04] last:border-b-0 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      {isCovered ? (
                        <div className="w-4 h-4 rounded-full border border-luma-text-muted flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      ) : isDueToday ? (
                        <RefreshCw className="w-4 h-4 text-luma-purple animate-spin-slow" />
                      ) : (
                        <Circle className="w-4 h-4 text-luma-text-dim group-hover:text-white" />
                      )}

                      <span className={`text-sm font-medium ${isCovered ? 'text-luma-text-muted line-through opacity-70' : 'text-white'}`}>
                        {topic.name}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-mono uppercase tracking-wider ${
                        isCovered
                          ? 'text-luma-text-dim'
                          : isDueToday
                          ? 'text-luma-purple font-semibold'
                          : isHighWeight
                          ? 'text-[#e6934c] font-semibold'
                          : isNextUp
                          ? 'text-luma-text-muted font-semibold'
                          : 'text-luma-text-dim'
                      }`}
                    >
                      {topic.status}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="py-6 text-center text-xs text-luma-text-dim font-mono">
                No items in roadmap yet.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Runway & Recommendations (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: Dynamic Runway */}
          <div className="bg-luma-card border border-luma-card-border rounded-3xl p-6">
            <div className="text-[10px] font-mono tracking-widest uppercase text-luma-text-dim mb-2">
              {runwayTitle}
            </div>

            <div className="text-4xl font-serif font-bold text-white mb-1">
              {daysRemaining} days
            </div>

            <p className="text-xs text-luma-text-muted mb-6">
              Tracking momentum across your {activeGoal.unit_label || 'milestones'}.
            </p>

            {/* Milestones */}
            <div className="space-y-4 pt-2 border-t border-white/[0.06]">
              {(activeGoal.milestones || []).map((m, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  {m.icon === 'trophy' ? (
                    <Trophy className="w-4 h-4 text-luma-lime shrink-0" />
                  ) : m.icon === 'repeat' ? (
                    <RefreshCw className="w-4 h-4 text-luma-purple shrink-0" />
                  ) : (
                    <Flag className="w-4 h-4 text-[#f08a5d] shrink-0" />
                  )}
                  <span className="font-mono text-white font-medium">{m.date}</span>
                  <span className="text-luma-text-dim">·</span>
                  <span className="text-luma-text-muted">{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2: Luma's Recommendation */}
          <div className="bg-luma-card border border-luma-card-border rounded-3xl p-6">
            <div className="text-[10px] font-mono tracking-widest uppercase text-luma-text-dim mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-luma-lime" />
              <span>Luma's Recommendation</span>
            </div>
            <p className="text-xs text-luma-text-muted leading-relaxed mb-4">
              {activeGoal.recommendation || (
                <>
                  Protect your next uninterrupted focus block for the highest priority items in <strong className="text-white font-semibold">{activeGoal.title}</strong>.
                </>
              )}
            </p>

            {onStartFocus && (
              <button
                onClick={() => onStartFocus(`${activeGoal.title} · Deep Session`, 60)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-luma-purple/20 hover:bg-luma-purple text-luma-purple hover:text-white border border-luma-purple/30 text-xs font-semibold active:scale-95 transition-all shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Launch deep focus session</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
