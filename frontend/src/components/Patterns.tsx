import React, { useState } from 'react';
import { Calendar, Quote, TrendingUp, Sparkles, ChevronDown, Check } from 'lucide-react';
import { StatsResponse } from '../services/api';
import { NavTab } from './Layout';

interface PatternsProps {
  stats: StatsResponse | null;
  onSelectTab?: (tab: NavTab) => void;
  onOpenShapeMyDay?: () => void;
}

// Compute dynamic 30-day date checkpoints ending on real today
const compute30DayLabels = () => {
  const now = new Date();
  const intervals = [28, 21, 14, 0];
  const months = ['AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL'];
  return intervals.map((daysAgo) => {
    const d = new Date(now);
    d.setDate(now.getDate() - daysAgo);
    const month = months[d.getMonth()];
    const date = String(d.getDate()).padStart(2, '0');
    return `${month} ${date}`;
  });
};

// Generate smooth cubic Bezier path for SVG trend chart
function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;

  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

export const Patterns: React.FC<PatternsProps> = ({ stats, onSelectTab, onOpenShapeMyDay }) => {
  const [selectedRange, setSelectedRange] = useState<'7' | '14' | '30'>('30');
  const [isRangeMenuOpen, setIsRangeMenuOpen] = useState(false);

  const defaultHeatmap = [
    { period: 'Morning', days: [0, 0, 0, 0, 0, 0, 0] },
    { period: 'Afternoon', days: [0, 0, 0, 0, 0, 0, 0] },
    { period: 'Evening', days: [0, 0, 0, 0, 0, 0, 0] },
  ];

  const heatmap = stats?.patterns?.heatmap || defaultHeatmap;
  const daysHeader = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  // Check if any heatmap block has actual activity
  const hasHeatmapData = heatmap.some((row) => row.days.some((val) => val > 0));

  const getHeatmapColor = (val: number) => {
    if (val >= 85) return 'bg-[#8c7bff] shadow-[0_0_8px_rgba(140,123,255,0.4)]';
    if (val >= 60) return 'bg-[#6757d9]';
    if (val >= 40) return 'bg-[#433b7a]';
    if (val > 0) return 'bg-[#292645]';
    return 'bg-[#171917] border border-white/[0.04] hover:border-white/20';
  };

  // Morning / Afternoon completion percentages
  const morningPercent = stats?.patterns?.morningPercent ?? 0;
  const afternoonPercent = stats?.patterns?.afternoonPercent ?? 0;
  const hasFocusActivity = morningPercent > 0 || afternoonPercent > 0 || hasHeatmapData;

  // Trend calculation sliced by selectedRange
  const rawTrendPoints = stats?.patterns?.trendPoints || [];
  const trendPoints = selectedRange === '7'
    ? rawTrendPoints.slice(-7)
    : selectedRange === '14'
    ? rawTrendPoints.slice(-14)
    : rawTrendPoints;

  const hasTrendData = trendPoints.some((p) => p.value > 0);

  const mappedTrendPoints = trendPoints.map((tp, idx) => {
    const x = (idx / Math.max(trendPoints.length - 1, 1)) * 820 + 40;
    const y = 145 - (Math.min(100, Math.max(0, tp.value)) / 100) * 115;
    return { x, y, date: tp.date, value: tp.value };
  });

  const trendLinePath = hasTrendData ? buildSmoothPath(mappedTrendPoints) : '';
  const lastPoint = mappedTrendPoints.length > 0 ? mappedTrendPoints[mappedTrendPoints.length - 1] : { x: 860, y: 145 };
  const firstPoint = mappedTrendPoints.length > 0 ? mappedTrendPoints[0] : { x: 40, y: 145 };
  const trendAreaPath = hasTrendData ? `${trendLinePath} L ${lastPoint.x},160 L ${firstPoint.x},160 Z` : '';

  const xLabels = compute30DayLabels();

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-mono tracking-widest uppercase text-luma-text-dim mb-1">
            Your Work, Reflected Back
          </div>
          <h1 className="text-4xl md:text-5xl font-serif text-white tracking-tight mb-2">
            Patterns
          </h1>
          <p className="text-sm text-luma-text-muted">
            Evidence to help you plan with more self-knowledge.
          </p>
        </div>

        {/* Interactive Date Range Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsRangeMenuOpen(prev => !prev)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-luma-card border border-luma-card-border hover:bg-white/[0.04] text-xs font-medium text-white transition-all shadow-sm"
          >
            <Calendar className="w-3.5 h-3.5 text-luma-text-muted" />
            <span>Last {selectedRange} days</span>
            <ChevronDown className="w-3.5 h-3.5 text-luma-text-dim" />
          </button>

          {isRangeMenuOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-luma-card border border-luma-card-border rounded-2xl p-1.5 shadow-2xl z-20 space-y-1">
              {[
                { id: '7', label: 'Last 7 days' },
                { id: '14', label: 'Last 14 days' },
                { id: '30', label: 'Last 30 days' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setSelectedRange(opt.id as any);
                    setIsRangeMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${
                    selectedRange === opt.id
                      ? 'bg-white/10 text-white font-medium'
                      : 'text-luma-text-dim hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <span>{opt.label}</span>
                  {selectedRange === opt.id && <Check className="w-3.5 h-3.5 text-luma-lime" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Two Cards: Heatmap & Insight */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Card: When focus lands (7 cols) */}
        <div className="lg:col-span-7 bg-luma-card border border-luma-card-border rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-white tracking-tight">
                When focus lands
              </h2>
              <span className="text-[10px] font-mono tracking-widest uppercase text-luma-text-dim">
                {hasHeatmapData ? 'HOURS COMPLETED' : 'NO LOGS RECORDED'}
              </span>
            </div>

            {/* Matrix Heatmap */}
            <div className="space-y-3">
              {/* Day Headers */}
              <div className="grid grid-cols-8 gap-2 items-center text-center">
                <span className="text-xs text-transparent select-none">Period</span>
                {daysHeader.map((d, i) => (
                  <span key={i} className="text-[11px] font-mono text-luma-text-dim uppercase">
                    {d}
                  </span>
                ))}
              </div>

              {/* Rows */}
              {heatmap.map((row) => (
                <div key={row.period} className="grid grid-cols-8 gap-2 items-center">
                  <span className="text-xs font-mono text-luma-text-muted text-left">
                    {row.period}
                  </span>
                  {row.days.map((val, idx) => (
                    <div
                      key={idx}
                      className={`h-9 rounded-xl ${getHeatmapColor(val)} transition-transform hover:scale-105 cursor-pointer`}
                      title={val > 0 ? `${row.period} · Day ${idx + 1}: ${Math.round(val / 15)}h completed` : `${row.period} · Day ${idx + 1}: No focus blocks`}
                    />
                  ))}
                </div>
              ))}
            </div>

            {!hasHeatmapData && (
              <div className="text-[11px] font-mono text-luma-text-dim text-center pt-4">
                Complete focus sessions to light up rhythm blocks
              </div>
            )}
          </div>
        </div>

        {/* Right Card: Quote Insight (5 cols) */}
        <div className="lg:col-span-5 bg-luma-card border border-luma-card-border rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <div className="w-7 h-7 rounded-lg bg-luma-purple-dim flex items-center justify-center mb-5 text-luma-purple">
              <Quote className="w-4 h-4" />
            </div>

            <h3 className="text-xl font-serif font-bold text-white tracking-tight mb-2">
              {hasFocusActivity ? 'Your best work happens early.' : 'Awaiting rhythm data.'}
            </h3>

            <p className="text-xs text-luma-text-muted leading-relaxed mb-6">
              {hasFocusActivity
                ? (stats?.patterns?.insight || 'Morning focus blocks are completed 27% more often than afternoon blocks. Keep the hardest topic before lunch.')
                : 'No focus blocks logged yet. Schedule and complete focus sessions in your daily plan to reveal your peak performance hours and circadian rhythm.'}
            </p>

            {!hasFocusActivity && onOpenShapeMyDay && (
              <button
                onClick={onOpenShapeMyDay}
                className="mb-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-luma-lime hover:bg-luma-lime-hover text-black text-xs font-semibold shadow-lime-glow active:scale-95 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 stroke-[2.2]" />
                <span>Shape my day</span>
              </button>
            )}
          </div>

          {/* Split Bar */}
          <div>
            {hasFocusActivity ? (
              <div className="w-full h-2 rounded-full overflow-hidden flex mb-2">
                <div
                  className="h-full bg-luma-purple transition-all duration-500"
                  style={{ width: `${morningPercent}%` }}
                />
                <div
                  className="h-full bg-luma-lime transition-all duration-500"
                  style={{ width: `${afternoonPercent}%` }}
                />
              </div>
            ) : (
              <div className="w-full h-2 rounded-full bg-[#202220] border border-white/5 mb-2" />
            )}
            <div className="flex items-center justify-between text-[11px] font-mono text-luma-text-dim">
              <span>{morningPercent}% MORNING</span>
              <span>{afternoonPercent}% AFTERNOON</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Full-Width Card: Completion Rhythm (30-day Trend) */}
      <div className="bg-luma-card border border-luma-card-border rounded-3xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-white tracking-tight">
            Completion rhythm
          </h2>
          <span className="text-[10px] font-mono tracking-widest uppercase text-luma-text-dim">
            30-DAY TREND
          </span>
        </div>

        {/* SVG Spline Trend Chart */}
        <div className="h-44 w-full relative">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 900 160" preserveAspectRatio="none">
            <defs>
              <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7b6ef6" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#7b6ef6" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {hasTrendData ? (
              <>
                {/* Area Fill */}
                <path d={trendAreaPath} fill="url(#curveGradient)" />

                {/* Smooth Spline Curve */}
                <path
                  d={trendLinePath}
                  fill="none"
                  stroke="#7b6ef6"
                  strokeWidth="3.5"
                  className="filter drop-shadow-[0_0_12px_rgba(123,110,246,0.6)]"
                />

                {/* Peak Endpoint Node */}
                <circle cx={lastPoint.x} cy={lastPoint.y} r="5" fill="#7b6ef6" />
                <circle cx={lastPoint.x} cy={lastPoint.y} r="9" fill="none" stroke="#7b6ef6" strokeWidth="2" opacity="0.6" />
              </>
            ) : (
              /* Flat Empty Baseline */
              <line
                x1="20"
                y1="140"
                x2="880"
                y2="140"
                stroke="#2a2d2a"
                strokeDasharray="6 6"
                strokeWidth="2"
              />
            )}
          </svg>

          {/* Empty State overlay */}
          {!hasTrendData && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
              <div className="w-9 h-9 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-luma-text-dim mb-2">
                <TrendingUp className="w-4 h-4 stroke-[1.8]" />
              </div>
              <span className="text-xs font-semibold text-white mb-0.5">
                No completion trajectory yet
              </span>
              <p className="text-[11px] text-luma-text-muted max-w-sm">
                Complete your scheduled daily commitments to trace your 30-day rhythm curve.
              </p>
              {onSelectTab && (
                <button
                  onClick={() => onSelectTab('daily')}
                  className="mt-2.5 text-xs font-mono text-luma-lime hover:underline flex items-center gap-1"
                >
                  <span>Go to daily plan →</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* X-Axis Dates */}
        <div className="flex items-center justify-between pt-4 border-t border-white/[0.04] text-[11px] font-mono text-luma-text-dim">
          {xLabels.map((label, idx) => (
            <span key={idx}>{label}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

