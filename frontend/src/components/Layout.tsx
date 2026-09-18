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
  const timeString = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const navItems = [
    { id: 'overview' as NavTab, label: 'Overview', icon: LayoutGrid },
    { id: 'daily' as NavTab, label: 'Daily plan', icon: Calendar },
    { id: 'tasks' as NavTab, label: 'Tasks', icon: CheckSquare },
    { id: 'learning' as NavTab, label: 'Projects & Goals', icon: Compass },
  ];

  const capacityPercent = Math.min(100, Math.round((weeklyCapacityHours / maxCapacityHours) * 100));

  return (
    <div className="flex min-h-screen bg-luma-bg text-luma-text">
      {/* Sidebar */}
      <aside className="w-64 border-r border-luma-sidebar-border bg-luma-sidebar/80 backdrop-blur-md flex flex-col justify-between p-6 fixed inset-y-0 left-0 z-30 select-none">
        <div>
          {/* Brand Logo */}
          <div className="flex items-center gap-2.5 mb-10 px-2 cursor-pointer" onClick={() => onSelectTab('overview')}>
            <span className="font-serif text-2xl font-bold tracking-tight text-white">Luma</span>
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
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-150 ${
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

        {/* Bottom Capacity Widget */}
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

      {/* Main Content Area */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        {/* Top Floating App Bar */}
        <header className="px-10 pt-5 pb-3 flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <div className="text-[11px] font-mono tracking-widest uppercase text-luma-text-muted flex items-center gap-2">
              <span className="text-white font-semibold">{dayName}</span>
              <span className="text-white/20">/</span>
              <span>{dayDate} {year}</span>
              <span className="text-white/20">/</span>
              <span className="text-luma-lime font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-luma-lime animate-pulse"></span>
                <span>LIVE</span>
              </span>
            </div>
            {/* Live Real-Time Clock */}
            <div className="font-mono text-xl font-bold tracking-tight text-white/90">
              {timeString}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Bronze Coin / Settings Icon */}
            <button
              onClick={onOpenSettings}
              title="Settings & Integrations"
              className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#8a5d3b] via-[#c99166] to-[#ddaa82] shadow-inner border border-white/10 hover:scale-105 active:scale-95 transition-all flex items-center justify-center group"
            >
              <Settings className="w-3.5 h-3.5 text-black/60 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            {/* Shape My Day Button (Hidden on Daily Plan page to avoid duplicate stacked buttons) */}
            {currentTab !== 'daily' && (
              <button
                onClick={onOpenShapeMyDay}
                className="flex items-center gap-2 bg-luma-lime hover:bg-luma-lime-hover text-black px-4 py-2.5 rounded-xl font-semibold text-sm shadow-lime-glow active:scale-[0.98] transition-all"
              >
                <Sparkles className="w-4 h-4 text-black stroke-[2.2]" />
                <span>Shape my day</span>
              </button>
            )}
          </div>
        </header>

        {/* Dynamic Page Views */}
        <main className="flex-1 px-10 pb-12">
          {children}
        </main>
      </div>
    </div>
  );
};
