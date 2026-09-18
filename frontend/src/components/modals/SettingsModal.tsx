import React, { useState, useEffect } from 'react';
import { X, Send, Lock, CheckCircle, AlertCircle, Bot, Sparkles, Briefcase, Coffee } from 'lucide-react';
import { api, getStoredPasscode, setStoredPasscode } from '../../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  maxCapacity: number;
  onUpdateCapacity: (newMax: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  maxCapacity,
  onUpdateCapacity,
}) => {
  const [passcode, setPasscode] = useState(getStoredPasscode());
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [testStatus, setTestStatus] = useState<{ loading: boolean; message?: string; error?: string }>({
    loading: false,
  });
  const [capacityInput, setCapacityInput] = useState(maxCapacity);
  const [healthInfo, setHealthInfo] = useState<any>(null);

  // Default Working Hours
  const [workStart, setWorkStart] = useState('09:30');
  const [workEnd, setWorkEnd] = useState('18:30');
  const [hasLunch, setHasLunch] = useState(true);
  const [lunchStart, setLunchStart] = useState('13:00');
  const [lunchDuration, setLunchDuration] = useState(45);
  const [workHoursSaved, setWorkHoursSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPasscode(getStoredPasscode());
      api.checkHealth().then(setHealthInfo).catch(() => {});

      // Load saved default work hours
      try {
        const saved = localStorage.getItem('luma_default_work_hours');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.workStartTime) setWorkStart(parsed.workStartTime);
          if (parsed.workEndTime) setWorkEnd(parsed.workEndTime);
          if (parsed.hasLunchBreak !== undefined) setHasLunch(parsed.hasLunchBreak);
          if (parsed.lunchStartTime) setLunchStart(parsed.lunchStartTime);
          if (parsed.lunchDuration) setLunchDuration(parsed.lunchDuration);
        }
      } catch {}
    }
  }, [isOpen]);

  const handleSaveWorkHours = () => {
    try {
      const existing = localStorage.getItem('luma_default_work_hours');
      const parsed = existing ? JSON.parse(existing) : {};
      localStorage.setItem('luma_default_work_hours', JSON.stringify({
        ...parsed,
        workStartTime: workStart,
        workEndTime: workEnd,
        hasLunchBreak: hasLunch,
        lunchStartTime: lunchStart,
        lunchDuration: lunchDuration,
      }));
      setWorkHoursSaved(true);
      setTimeout(() => setWorkHoursSaved(false), 2500);
    } catch {}
  };

  if (!isOpen) return null;

  const handleSavePasscode = () => {
    setStoredPasscode(passcode);
    alert('Passcode saved in browser storage.');
  };

  const handleTestTelegram = async () => {
    setTestStatus({ loading: true });
    try {
      const res = await api.testTelegram(botToken || undefined, chatId || undefined);
      setTestStatus({ loading: false, message: res.message || 'Telegram test message sent successfully!' });
    } catch (err: any) {
      setTestStatus({ loading: false, error: err.message || 'Failed to send Telegram message' });
    }
  };

  const handleTriggerCron = async () => {
    setTestStatus({ loading: true });
    try {
      const res = await api.triggerReminderCheck();
      setTestStatus({
        loading: false,
        message: `Cron check complete! Checked ${res.summary.checked} tasks, sent ${res.summary.sent} reminders.`,
      });
    } catch (err: any) {
      setTestStatus({ loading: false, error: err.message || 'Cron trigger check failed' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full sm:max-w-xl max-h-[94vh] sm:max-h-[90vh] bg-luma-card border border-luma-card-border rounded-t-3xl sm:rounded-3xl shadow-2xl relative flex flex-col overflow-hidden">
        {/* FIXED HEADER */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-white/[0.06] flex items-start justify-between shrink-0 bg-[#161716]">
          <div>
            <h2 className="text-xl font-serif font-bold text-white tracking-tight mb-0.5">
              Settings & Integrations
            </h2>
            <p className="text-xs text-luma-text-muted">
              Configure Telegram reminders, Google Gemini Flash, and security passcode.
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

        {/* SCROLLABLE BODY */}
        <div className="px-4 sm:px-6 py-4 overflow-y-auto space-y-6 flex-1">
          {/* AI Engine Section */}
          <div className="p-4 rounded-2xl bg-[#1a1c1a] border border-luma-card-border">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-luma-lime" />
              <span className="text-xs font-mono uppercase tracking-wider text-white font-semibold">
                AI Generation Engine
              </span>
            </div>
            <p className="text-xs text-luma-text-muted mb-3">
              Configured for <strong className="text-white">Google Gemini API (Flash model via Google AI Studio)</strong>. Runs strictly server-side in Cloudflare Worker with intelligent rhythm fallback.
            </p>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-luma-text-dim">Worker Secret:</span>
              <span className="bg-black/40 px-2 py-0.5 rounded text-luma-lime">
                {healthInfo?.hasGeminiKey ? '✓ GEMINI_API_KEY Active' : 'Fallback Local Engine (Add GEMINI_API_KEY in Worker)'}
              </span>
            </div>
          </div>

          {/* Telegram Notifications Section */}
          <div className="p-4 rounded-2xl bg-[#1a1c1a] border border-luma-card-border">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-4 h-4 text-[#44a2f7]" />
              <span className="text-xs font-mono uppercase tracking-wider text-white font-semibold">
                Telegram Reminders (5-Minute Cron)
              </span>
            </div>
            <p className="text-xs text-luma-text-muted mb-4">
              Sends an automated reminder message 5 minutes before each scheduled timeline block, including tasks, goals, rest, and lunch.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-luma-text-dim block mb-1">
                  Telegram Bot Token (Optional test override)
                </label>
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                  className="w-full bg-[#141514] border border-luma-card-border rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-luma-lime"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-luma-text-dim block mb-1">
                  Telegram Chat ID (Optional test override)
                </label>
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="e.g. 987654321"
                  className="w-full bg-[#141514] border border-luma-card-border rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-luma-lime"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleTestTelegram}
                  disabled={testStatus.loading}
                  className="flex items-center gap-1.5 bg-[#252825] hover:bg-[#323632] text-white px-3.5 py-2 rounded-xl text-xs font-medium transition-all"
                >
                  <Send className="w-3.5 h-3.5 text-[#44a2f7]" />
                  <span>Send Test Alert</span>
                </button>

                <button
                  type="button"
                  onClick={handleTriggerCron}
                  disabled={testStatus.loading}
                  className="flex items-center gap-1.5 bg-[#252825] hover:bg-[#323632] text-white px-3.5 py-2 rounded-xl text-xs font-medium transition-all"
                >
                  <span>Trigger Cron Check Now</span>
                </button>
              </div>

              {testStatus.message && (
                <div className="flex items-center gap-2 text-xs text-luma-lime bg-luma-lime/10 p-2.5 rounded-xl">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{testStatus.message}</span>
                </div>
              )}

              {testStatus.error && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 p-2.5 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{testStatus.error}</span>
                </div>
              )}
            </div>
          </div>

          {/* Passcode Security */}
          <div className="p-4 rounded-2xl bg-[#1a1c1a] border border-luma-card-border">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-luma-purple" />
              <span className="text-xs font-mono uppercase tracking-wider text-white font-semibold">
                Access Passcode Gate
              </span>
            </div>
            <p className="text-xs text-luma-text-muted mb-3">
              Single-user personal security passcode sent in the <code className="text-luma-lime">X-Passcode</code> header.
            </p>

            <div className="flex items-center gap-3">
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter personal passcode"
                className="flex-1 bg-[#141514] border border-luma-card-border rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-luma-lime"
              />
              <button
                type="button"
                onClick={handleSavePasscode}
                className="bg-luma-purple hover:bg-luma-purple-glow text-white px-4 py-2 rounded-xl text-xs font-medium transition-all"
              >
                Save
              </button>
            </div>
          </div>

          {/* Weekly Capacity Hours */}
          <div className="p-4 rounded-2xl bg-[#1a1c1a] border border-luma-card-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-white font-semibold">
                Weekly Target Capacity
              </span>
              <span className="text-xs font-mono text-luma-lime">{capacityInput}h / week</span>
            </div>
            <input
              type="range"
              min="10"
              max="60"
              step="2"
              value={capacityInput}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setCapacityInput(val);
                onUpdateCapacity(val);
              }}
              className="w-full accent-luma-lime h-2 bg-[#252825] rounded-lg cursor-pointer"
            />
          </div>

          {/* Default Daily Working Hours */}
          <div className="p-4 rounded-2xl bg-[#1a1c1a] border border-luma-card-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-luma-lime" />
                <span className="text-xs font-mono uppercase tracking-wider text-white font-semibold">
                  Default Working Hours
                </span>
              </div>
              {workHoursSaved && (
                <span className="text-[11px] font-mono text-luma-lime flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Saved!
                </span>
              )}
            </div>
            <p className="text-xs text-luma-text-muted">
              Pre-filled baseline for the <strong className="text-white">Shape My Day</strong> scheduler.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-luma-text-dim block mb-1">
                  Work Start
                </label>
                <input
                  type="time"
                  value={workStart}
                  onChange={(e) => setWorkStart(e.target.value)}
                  className="w-full bg-[#141514] border border-luma-card-border rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-luma-lime"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-luma-text-dim block mb-1">
                  Work End
                </label>
                <input
                  type="time"
                  value={workEnd}
                  onChange={(e) => setWorkEnd(e.target.value)}
                  className="w-full bg-[#141514] border border-luma-card-border rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-luma-lime"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#141514] border border-white/[0.04] space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                <input
                  type="checkbox"
                  checked={hasLunch}
                  onChange={(e) => setHasLunch(e.target.checked)}
                  className="rounded border-luma-card-border accent-luma-lime w-3.5 h-3.5"
                />
                <Coffee className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-medium text-xs">Default Midday Lunch Break</span>
              </label>

              {hasLunch && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] font-mono text-luma-text-dim block mb-1">
                      Lunch Time
                    </span>
                    <input
                      type="time"
                      value={lunchStart}
                      onChange={(e) => setLunchStart(e.target.value)}
                      className="w-full bg-[#1b1d1b] border border-luma-card-border rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-luma-lime"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-luma-text-dim block mb-1">
                      Duration
                    </span>
                    <select
                      value={lunchDuration}
                      onChange={(e) => setLunchDuration(Number(e.target.value))}
                      className="w-full bg-[#1b1d1b] border border-luma-card-border rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-luma-lime"
                    >
                      <option value={30}>30 mins</option>
                      <option value={45}>45 mins</option>
                      <option value={60}>60 mins</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleSaveWorkHours}
              className="w-full bg-[#252825] hover:bg-[#323632] text-white py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5"
            >
              <Briefcase className="w-3.5 h-3.5 text-luma-lime" />
              <span>Save Default Work Hours</span>
            </button>
          </div>
        </div>

        {/* STICKY FOOTER */}
        <div className="px-4 sm:px-6 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] border-t border-white/[0.06] bg-[#141514] flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="bg-luma-lime hover:bg-luma-lime-hover text-black px-6 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-lime-glow"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
