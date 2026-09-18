import React, { useState, useEffect } from 'react';
import {
  LayoutGrid,
  Calendar,
  CheckSquare,
  Compass,
  Sparkles,
  Settings,
} from 'lucide-react';

export type NavTab = 'overview' | 'daily' | 'tasks' | 'learning';

interface LayoutProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenShapeMyDay: () => void;
  onOpenSettings: () => void;
  children: React.ReactNode;
  weeklyCapacityHours?: number;
  maxCapacityHours?: number;
}

export const Layout: React.FC<LayoutProps> = ({
  currentTab,
  onSelectTab,
  onOpenShapeMyDay,
  onOpenSettings,
  children,
  weeklyCapacityHours = 24,
  maxCapacityHours = 32,
}) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format real date and live time
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const dayDate = now.toLocaleDateString('en-US', { day: '2-digit', month: 'long' }).toUpperCase();
  const year = now.getFullYear();
  const timeStringShort = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const timeSeconds = now.toLocaleTimeString('en-US', {
    second: '2-digit',
  });

  const navItems = [
    { id: 'overview' as NavTab, label: 'Overview', icon: LayoutGrid },
    { id: 'daily' as NavTab, label: 'Daily plan', icon: Calendar },
    { id: 'tasks' as NavTab, label: 'Tasks', icon: CheckSquare },
    { id: 'learning' as NavTab, label: 'Projects & Goals', icon: Compass },
  ];

  const capacityPercent = Math.min(100, Math.round((weeklyCapacityHours / maxCapacityHours) * 100));

  const [showMobileCapacity, setShowMobileCapacity] = useState(false);

  return (
    <div className="flex min-h-screen bg-luma-bg text-luma-text overflow-x-hidden max-w-full">
      {/* Desktop Sidebar (hidden on mobile/tablet portrait < 768px) */}
      <aside className="hidden md:flex w-64 border-r border-luma-sidebar-border bg-luma-sidebar/80 backdrop-blur-md flex-col justify-between p-6 fixed inset-y-0 left-0 z-30 select-none">
        <div>
          {/* Brand Logo */}
          <div className="flex items-center gap-2.5 mb-10 px-2 cursor-pointer" onClick={() => onSelectTab('overview')}>
            <span className="font-serif text-2xl font-bold tracking-tight text-white">Asst. JUGNU DAS</span>
            <div className="w-4 h-4 rounded-full bg-[#1b2612] flex items-center justify-center border border-luma-lime/40">
              <div className="w-2 h-2 rounded-full bg-luma-lime shadow-[0_0_8px_#d4f938]"></div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-luma-cream text-luma-cream-text shadow-sm font-semibold'
                      : 'text-luma-text-muted hover:text-luma-text hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-luma-cream-text' : 'text-luma-text-muted'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Capacity Widget (Desktop) */}
        <div className="bg-[#151715] border border-luma-card-border/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-[11px] font-mono tracking-wider uppercase text-luma-text-dim mb-1.5">
            <span>Weekly Capacity</span>
          </div>
          <div className="text-sm font-medium text-luma-text mb-2.5">
            {weeklyCapacityHours}h of {maxCapacityHours}h protected
          </div>
          <div className="w-full h-1.5 bg-[#252824] rounded-full overflow-hidden">
            <div
              className="h-full bg-luma-lime rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(212,249,56,0.4)]"
              style={{ width: `${capacityPercent}%` }}
            />
          </div>
        </div>
      </aside>

      {/* Main Content Area (Full width on mobile, offset by 64 on desktop) */}
      <div className="flex-1 ml-0 md:ml-64 flex flex-col min-h-screen pb-20 md:pb-0 min-w-0 max-w-full overflow-x-hidden">
        {/* Top Floating App Bar */}
        <header className="px-2.5 xs:px-4 sm:px-6 md:px-10 pt-3 xs:pt-4 sm:pt-5 pb-2.5 xs:pb-3 flex items-center justify-between gap-1.5 xs:gap-3 border-b border-white/[0.04] md:border-b-0 max-w-full">
          <div className="flex items-center gap-2 xs:gap-3 min-w-0">
            {/* Mobile Brand Logo */}
            <div
              className="md:hidden flex items-center gap-1.5 cursor-pointer shrink-0"
              onClick={() => onSelectTab('overview')}
            >
              <span className="font-serif text-lg xs:text-xl font-bold tracking-tight text-white">Asst. JUGNU DAS</span>
              <div className="w-2.5 h-2.5 rounded-full bg-luma-lime shadow-[0_0_6px_#d4f938]"></div>
            </div>

            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="text-[9px] xs:text-[10px] sm:text-[11px] font-mono tracking-wider uppercase text-luma-text-muted flex items-center gap-1 xs:gap-1.5 sm:gap-2 truncate">
                <span className="text-white font-semibold">{dayName}</span>
                <span className="text-white/20 hidden xs:inline">/</span>
                <span className="hidden xs:inline">{dayDate} {year}</span>
                <span className="text-white/20">/</span>
                <span className="text-luma-lime font-semibold flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-luma-lime animate-pulse"></span>
                  <span>LIVE</span>
                </span>
              </div>
              {/* Live Real-Time Clock */}
              <div className="font-mono text-sm xs:text-base sm:text-xl font-bold tracking-tight text-white/90">
                <span>{timeStringShort}</span>
                <span className="hidden sm:inline text-xs text-white/50 ml-1">:{timeSeconds.split(' ')[0]}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 shrink-0">
            {/* Mobile Capacity Pill (Tap to view protected hours breakdown) */}
            <button
              type="button"
              onClick={() => setShowMobileCapacity(!showMobileCapacity)}
              className="md:hidden flex items-center gap-1 xs:gap-1.5 px-2 xs:px-2.5 py-1 xs:py-1.5 rounded-lg xs:rounded-xl bg-[#151715] border border-luma-card-border text-[10px] xs:text-[11px] font-mono text-white active:scale-95 transition-all"
              title="View Weekly Capacity breakdown"
            >
              <span className="text-luma-lime font-bold">{weeklyCapacityHours}h</span>
              <span className="text-luma-text-dim">/{maxCapacityHours}h</span>
            </button>

            {/* Bronze Coin / Settings Icon */}
            <button
              onClick={onOpenSettings}
              title="Settings & Integrations"
              className="w-7 h-7 xs:w-8 xs:h-8 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-[#8a5d3b] via-[#c99166] to-[#ddaa82] shadow-inner border border-white/10 hover:scale-105 active:scale-95 transition-all flex items-center justify-center group cursor-pointer shrink-0"
            >
              <Settings className="w-3.5 h-3.5 sm:w-3.5 sm:h-3.5 text-black/70 group-hover:text-black transition-colors" />
            </button>

            {/* Shape My Day Button (Hidden on Daily Plan and Overview pages, and on mobile < sm to prevent header overflow) */}
            {currentTab !== 'daily' && currentTab !== 'overview' && (
              <button
                onClick={onOpenShapeMyDay}
                className="hidden sm:flex items-center gap-1.5 sm:gap-2 bg-luma-lime hover:bg-luma-lime-hover text-black px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-xl font-semibold text-xs sm:text-sm shadow-lime-glow active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-black stroke-[2.2]" />
                <span>Shape my day</span>
              </button>
            )}
          </div>
        </header>

        {/* Mobile Expandable Weekly Capacity Drawer */}
        {showMobileCapacity && (
          <div className="md:hidden mx-2.5 xs:mx-4 sm:mx-6 mb-3 xs:mb-4 p-3 xs:p-4 rounded-2xl bg-[#151715] border border-luma-lime/30 shadow-lg animate-fadeIn">
            <div className="flex items-center justify-between text-xs font-mono tracking-wider uppercase text-luma-text-dim mb-1">
              <span>Weekly Protected Capacity</span>
              <button
                onClick={() => setShowMobileCapacity(false)}
                className="text-white/60 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>
            <div className="text-sm font-semibold text-white mb-2">
              {weeklyCapacityHours}h of {maxCapacityHours}h protected ({capacityPercent}%)
            </div>
            <div className="w-full h-2 bg-[#252824] rounded-full overflow-hidden">
              <div
                className="h-full bg-luma-lime rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(212,249,56,0.4)]"
                style={{ width: `${capacityPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Dynamic Page Views */}
        <main className="flex-1 px-2.5 xs:px-4 sm:px-6 md:px-10 pb-8 md:pb-12">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Visible only below md breakpoint < 768px) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#121412]/95 backdrop-blur-xl border-t border-luma-sidebar-border px-1 xs:px-2 py-1 flex items-center justify-around shadow-2xl"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 xs:px-1 rounded-xl transition-all cursor-pointer min-h-[44px] ${
                isActive
                  ? 'text-luma-lime font-semibold'
                  : 'text-luma-text-muted hover:text-white'
              }`}
            >
              <div className={`p-1 rounded-lg transition-colors ${isActive ? 'bg-luma-lime/15 text-luma-lime' : ''}`}>
                <Icon className={`w-4 h-4 ${isActive ? 'text-luma-lime stroke-[2.4]' : 'text-luma-text-muted'}`} />
              </div>
              <span className={`text-[9px] xs:text-[10px] tracking-tight leading-tight mt-0.5 ${isActive ? 'text-white font-bold' : 'text-luma-text-muted'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
