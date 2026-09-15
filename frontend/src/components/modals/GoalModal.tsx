import React, { useState } from 'react';
import { X, Plus, Trash2, Rocket, GraduationCap, Briefcase, Sparkles, Target, ChevronDown } from 'lucide-react';
import { Goal, SyllabusTopic, Milestone } from '../../services/api';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Goal>) => Promise<void>;
}

export type GoalCategory = 'Project / Build' | 'Exam / Academic' | 'Job / Business' | 'Skill / Mastery' | 'Custom / Other';

interface CategoryConfig {
  id: GoalCategory;
  label: string;
  icon: React.ElementType;
  titleLabel: string;
  titlePlaceholder: string;
  unitFieldLabel: string;
  unitOptions: Array<{ value: string; label: string }>;
  defaultUnit: string;
  totalFieldLabel: string;
  defaultTotal: number;
  checklistLabel: string;
  itemPlaceholders: string[];
  defaultMilestones: Milestone[];
  defaultRecommendation: string;
}

const CATEGORY_CONFIGS: Record<GoalCategory, CategoryConfig> = {
  'Project / Build': {
    id: 'Project / Build',
    label: 'Project & Build',
    icon: Rocket,
    titleLabel: 'Project Name',
    titlePlaceholder: 'e.g. Luma AI SaaS MVP, Portfolio Redesign, Mobile App V1',
    unitFieldLabel: 'Scope Metric',
    unitOptions: [
      { value: 'features', label: 'Features (e.g. Auth, Dashboard)' },
      { value: 'modules', label: 'Modules / Components' },
      { value: 'sprints', label: 'Sprints / Phases' },
      { value: 'tasks', label: 'Milestone Tasks' },
      { value: 'custom', label: 'Custom scope metric...' },
    ],
    defaultUnit: 'features',
    totalFieldLabel: 'Total to Ship',
    defaultTotal: 18,
    checklistLabel: 'Key Features & Roadmap Modules',
    itemPlaceholders: [
      'e.g. User Authentication & JWT Flow',
      'e.g. PostgreSQL Schema & D1 Migrations',
      'e.g. Real-Time Sync & WebSocket Service',
      'e.g. Production Deployment & Monitoring',
    ],
    defaultMilestones: [
      { date: 'Phase 1', label: 'Architecture & Prototype', icon: 'flag' },
      { date: 'Phase 2', label: 'Core feature buildout', icon: 'repeat' },
      { date: 'Final', label: 'Testing & Production deployment', icon: 'trophy' },
    ],
    defaultRecommendation: 'Tackle architecture and complex logic during morning deep focus blocks to maximize shipping velocity.',
  },
  'Exam / Academic': {
    id: 'Exam / Academic',
    label: 'Exam & Academic',
    icon: GraduationCap,
    titleLabel: 'Exam / Subject Title',
    titlePlaceholder: 'e.g. USMLE Step 1, AWS Solutions Architect, CFA Level 1',
    unitFieldLabel: 'Study Unit',
    unitOptions: [
      { value: 'topics', label: 'Topics (e.g. Pathology, Cardio)' },
      { value: 'chapters', label: 'Chapters / Units' },
      { value: 'modules', label: 'Curriculum Modules' },
      { value: 'papers', label: 'Practice Exam Papers' },
      { value: 'custom', label: 'Custom study unit...' },
    ],
    defaultUnit: 'topics',
    totalFieldLabel: 'Total Syllabus Units',
    defaultTotal: 100,
    checklistLabel: 'Syllabus Topics & High-Yield Units',
    itemPlaceholders: [
      'e.g. Cardiovascular Pathology & Diagnostics',
      'e.g. Renal Pharmacology & Diuretics',
      'e.g. Endocrine Physiology & Hormones',
      'e.g. Full-length Practice Exam Review',
    ],
    defaultMilestones: [
      { date: 'Phase 1', label: 'Core syllabus coverage', icon: 'flag' },
      { date: 'Phase 2', label: 'Revision & Question bank', icon: 'repeat' },
      { date: 'Final', label: 'Full-length mock series', icon: 'trophy' },
    ],
    defaultRecommendation: 'Prioritize high-yield topics during your morning peak, leaving active recall practice for later blocks.',
  },
  'Job / Business': {
    id: 'Job / Business',
    label: 'Job & Business',
    icon: Briefcase,
    titleLabel: 'Initiative / Campaign Name',
    titlePlaceholder: 'e.g. Q4 Enterprise Sales Campaign, Client Onboarding System',
    unitFieldLabel: 'Deliverable Type',
    unitOptions: [
      { value: 'deliverables', label: 'Deliverables (e.g. Pitch Deck)' },
      { value: 'milestones', label: 'Key Milestones' },
      { value: 'accounts', label: 'Target Client Accounts' },
      { value: 'phases', label: 'Project Phases' },
      { value: 'reports', label: 'Audits & Reports' },
      { value: 'custom', label: 'Custom deliverable type...' },
    ],
    defaultUnit: 'deliverables',
    totalFieldLabel: 'Target Deliverables',
    defaultTotal: 12,
    checklistLabel: 'Key Deliverables & Action Items',
    itemPlaceholders: [
      'e.g. Discovery & Executive Pitch Deck',
      'e.g. Pipeline Forecast & Financial Model',
      'e.g. Client Onboarding System Rollout',
      'e.g. Stakeholder Signoff & Final Delivery',
    ],
    defaultMilestones: [
      { date: 'Phase 1', label: 'Discovery & Strategy scoping', icon: 'flag' },
      { date: 'Phase 2', label: 'Execution & Stakeholder outreach', icon: 'repeat' },
      { date: 'Final', label: 'Final delivery & Signoff review', icon: 'trophy' },
    ],
    defaultRecommendation: 'Protect dedicated morning focus blocks for high-impact deliverables before opening communication channels.',
  },
  'Skill / Mastery': {
    id: 'Skill / Mastery',
    label: 'Skill & Mastery',
    icon: Sparkles,
    titleLabel: 'Skill or Discipline',
    titlePlaceholder: 'e.g. Full-Stack Rust Mastery, Conversational Spanish, Marathon',
    unitFieldLabel: 'Measurement Unit',
    unitOptions: [
      { value: 'skills', label: 'Skills / Competencies' },
      { value: 'lessons', label: 'Course Lessons' },
      { value: 'hours', label: 'Deliberate Practice Hours' },
      { value: 'sessions', label: 'Training Sessions' },
      { value: 'custom', label: 'Custom measurement unit...' },
    ],
    defaultUnit: 'skills',
    totalFieldLabel: 'Mastery Target',
    defaultTotal: 24,
    checklistLabel: 'Skill Modules & Practice Topics',
    itemPlaceholders: [
      'e.g. Foundational Syntax & Memory Model',
      'e.g. Asynchronous Concurrency & Error Handling',
      'e.g. Practical Application Project',
      'e.g. Capstone Portfolio Showcase',
    ],
    defaultMilestones: [
      { date: 'Phase 1', label: 'Foundational syntax & drills', icon: 'flag' },
      { date: 'Phase 2', label: 'Intermediate applied projects', icon: 'repeat' },
      { date: 'Final', label: 'Capstone mastery showcase', icon: 'trophy' },
    ],
    defaultRecommendation: 'Daily micro-deliberate practice outperforms sporadic binge sessions. Keep cadence consistent.',
  },
  'Custom / Other': {
    id: 'Custom / Other',
    label: 'Custom Goal',
    icon: Target,
    titleLabel: 'Goal Objective',
    titlePlaceholder: 'e.g. Writing a Sci-Fi Novel, Community Launch, Life Reset',
    unitFieldLabel: 'Tracking Unit',
    unitOptions: [
      { value: 'milestones', label: 'Milestones' },
      { value: 'steps', label: 'Sequential Steps' },
      { value: 'chapters', label: 'Chapters / Sections' },
      { value: 'items', label: 'Target Items' },
      { value: 'custom', label: 'Custom tracking unit...' },
    ],
    defaultUnit: 'milestones',
    totalFieldLabel: 'Target Total',
    defaultTotal: 10,
    checklistLabel: 'Milestones & Progression Steps',
    itemPlaceholders: [
      'e.g. Initial Research & Scope Outline',
      'e.g. Core Build & Draft Milestone',
      'e.g. Iteration, Testing & Polish',
      'e.g. Final Review & Community Launch',
    ],
    defaultMilestones: [
      { date: 'Phase 1', label: 'Initial research & planning', icon: 'flag' },
      { date: 'Phase 2', label: 'Core creation & progress sprint', icon: 'repeat' },
      { date: 'Final', label: 'Review, polish & launch', icon: 'trophy' },
    ],
    defaultRecommendation: 'Break your long-term vision into tangible sub-milestones to build steady forward momentum.',
  },
};

export const GoalModal: React.FC<GoalModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [category, setCategory] = useState<GoalCategory>('Project / Build');
  const [title, setTitle] = useState('');
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 85);
    return d.toISOString().split('T')[0];
  });
  const [unitSelectValue, setUnitSelectValue] = useState<string>(CATEGORY_CONFIGS['Project / Build'].defaultUnit);
  const [customUnitText, setCustomUnitText] = useState<string>('');
  const [totalUnits, setTotalUnits] = useState<number>(CATEGORY_CONFIGS['Project / Build'].defaultTotal);
  const [topics, setTopics] = useState<Array<{ name: string; weight: 'HIGH' | 'MEDIUM' | 'LOW' }>>([
    { name: '', weight: 'HIGH' },
    { name: '', weight: 'MEDIUM' },
  ]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const currentConfig = CATEGORY_CONFIGS[category];

  const handleSelectCategory = (newCat: GoalCategory) => {
    setCategory(newCat);
    const config = CATEGORY_CONFIGS[newCat];
    setUnitSelectValue(config.defaultUnit);
    setCustomUnitText('');
    setTotalUnits(config.defaultTotal);
  };

  const handleAddTopicRow = () => {
    setTopics([...topics, { name: '', weight: 'MEDIUM' }]);
  };

  const handleRemoveTopicRow = (index: number) => {
    setTopics(topics.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const resolvedUnitLabel = unitSelectValue === 'custom'
      ? (customUnitText.trim() || currentConfig.defaultUnit)
      : unitSelectValue;

    setLoading(true);
    try {
      const syllabus: SyllabusTopic[] = topics
        .filter((t) => t.name.trim() !== '')
        .map((t, idx) => ({
          id: `top-${Date.now()}-${idx}`,
          name: t.name.trim(),
          status: 'UNTOUCHED',
          covered: false,
          weight: t.weight,
        }));

      await onSave({
        title: title.trim(),
        category,
        target_date: targetDate,
        unit_label: resolvedUnitLabel,
        total_units: Math.max(1, totalUnits),
        covered_units: 0,
        syllabus,
        milestones: currentConfig.defaultMilestones,
        recommendation: currentConfig.defaultRecommendation,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl max-h-[90vh] bg-luma-card border border-luma-card-border rounded-3xl shadow-2xl relative flex flex-col overflow-hidden">
        {/* FIXED HEADER */}
        <div className="px-6 py-4 sm:py-5 border-b border-white/[0.06] flex items-start justify-between shrink-0 bg-[#161716]">
          <div>
            <h2 className="text-xl font-serif font-bold text-white tracking-tight mb-0.5">
              New Long-Term Path
            </h2>
            <p className="text-xs text-luma-text-muted">
              Track multi-month projects, exam runways, business deliverables, or skill mastery.
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
          <div className="px-6 py-4 overflow-y-auto space-y-5 flex-1">
          {/* Category Selector Pills */}
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-luma-text-dim block mb-2">
              Track Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(CATEGORY_CONFIGS) as GoalCategory[]).map((catKey) => {
                const conf = CATEGORY_CONFIGS[catKey];
                const IconComponent = conf.icon;
                const isSelected = category === catKey;

                return (
                  <button
                    type="button"
                    key={catKey}
                    onClick={() => handleSelectCategory(catKey)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all text-left ${
                      isSelected
                        ? 'bg-luma-lime/10 border-luma-lime text-luma-lime shadow-[0_0_12px_rgba(212,249,56,0.15)] font-semibold'
                        : 'bg-[#181918] border-white/5 text-luma-text-muted hover:text-white hover:border-white/15'
                    }`}
                  >
                    <IconComponent className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-luma-lime' : 'text-luma-text-dim'}`} />
                    <span className="truncate">{conf.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Context-Aware Title Input */}
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-luma-text-dim block mb-1.5">
              {currentConfig.titleLabel}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={currentConfig.titlePlaceholder}
              className="w-full bg-[#181918] border border-luma-card-border rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-luma-lime transition-colors"
            />
          </div>

          {/* Target Date, Unit Dropdown, Total Units */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-mono uppercase tracking-wider text-luma-text-dim block mb-1.5">
                Target Deadline
              </label>
              <input
                type="date"
                required
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full bg-[#181918] border border-luma-card-border rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-luma-lime transition-colors"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono uppercase tracking-wider text-luma-text-dim block mb-1.5">
                {currentConfig.unitFieldLabel}
              </label>
              <div className="relative">
                <select
                  value={unitSelectValue}
                  onChange={(e) => setUnitSelectValue(e.target.value)}
                  className="w-full appearance-none bg-[#181918] border border-luma-card-border rounded-xl px-3 py-2 pr-7 text-xs text-white focus:outline-none focus:border-luma-lime transition-colors cursor-pointer"
                >
                  {currentConfig.unitOptions.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-[#181918] text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-luma-text-dim absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Reveal text input when custom option selected */}
              {unitSelectValue === 'custom' && (
                <input
                  type="text"
                  required
                  value={customUnitText}
                  onChange={(e) => setCustomUnitText(e.target.value)}
                  placeholder="e.g. clients, pages, epics"
                  className="w-full mt-2 bg-[#181918] border border-luma-lime rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none transition-colors"
                />
              )}
            </div>

            <div>
              <label className="text-[11px] font-mono uppercase tracking-wider text-luma-text-dim block mb-1.5">
                {currentConfig.totalFieldLabel}
              </label>
              <input
                type="number"
                min="1"
                required
                value={totalUnits}
                onChange={(e) => setTotalUnits(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-[#181918] border border-luma-card-border rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-luma-lime transition-colors"
              />
            </div>
          </div>

          {/* Checklist / Deliverables */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-mono uppercase tracking-wider text-luma-text-dim">
                {currentConfig.checklistLabel}
              </label>
              <button
                type="button"
                onClick={handleAddTopicRow}
                className="flex items-center gap-1 text-xs text-luma-lime hover:underline font-mono"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add item</span>
              </button>
            </div>

            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {topics.map((t, idx) => {
                const placeholder = currentConfig.itemPlaceholders[idx] || `${currentConfig.checklistLabel.split('&')[0].trim()} Item ${idx + 1}`;

                return (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={t.name}
                      onChange={(e) => {
                        const updated = [...topics];
                        updated[idx].name = e.target.value;
                        setTopics(updated);
                      }}
                      placeholder={placeholder}
                      className="flex-1 bg-[#181918] border border-luma-card-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-luma-lime transition-colors"
                    />
                    <div className="relative">
                      <select
                        value={t.weight}
                        onChange={(e) => {
                          const updated = [...topics];
                          updated[idx].weight = e.target.value as any;
                          setTopics(updated);
                        }}
                        className="appearance-none bg-[#181918] border border-luma-card-border rounded-xl px-3 py-2 pr-7 text-xs text-white focus:outline-none focus:border-luma-lime cursor-pointer"
                      >
                        <option value="HIGH" className="bg-[#181918]">High Priority</option>
                        <option value="MEDIUM" className="bg-[#181918]">Medium Priority</option>
                        <option value="LOW" className="bg-[#181918]">Low Priority</option>
                      </select>
                      <ChevronDown className="w-3 h-3 text-luma-text-dim absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    {topics.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTopicRow(idx)}
                        className="p-1.5 text-luma-text-dim hover:text-red-400 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
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
              disabled={loading || !title.trim()}
              className="bg-luma-lime hover:bg-luma-lime-hover text-black px-5 py-2.5 rounded-xl font-semibold text-xs shadow-lime-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              {loading ? 'Creating...' : 'Create Path'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
