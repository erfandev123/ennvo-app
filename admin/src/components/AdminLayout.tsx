import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Video, 
  Flag, 
  ShieldAlert, 
  Scale, 
  Smartphone, 
  Bell, 
  Sliders, 
  ShieldCheck, 
  HardDrive, 
  TrendingUp, 
  UserCog, 
  Activity, 
  FileText, 
  LogOut, 
  Moon, 
  Sun, 
  Globe, 
  Menu, 
  X,
  ArrowLeft,
  Clock,
  Lock
} from 'lucide-react';
import { Language, i18n } from '../i18n';
import { auth } from '../../../src/firebase';

export type AdminPageTab = 
  | 'dashboard' 
  | 'users' 
  | 'content' 
  | 'reports' 
  | 'blocks' 
  | 'legal' 
  | 'appVersions' 
  | 'push' 
  | 'flags' 
  | 'support' 
  | 'media' 
  | 'analytics' 
  | 'staff' 
  | 'health' 
  | 'auditLogs';

interface AdminLayoutProps {
  currentTab: AdminPageTab;
  onTabChange: (tab: AdminPageTab) => void;
  lang: Language;
  onLangChange: (lang: Language) => void;
  isDark: boolean;
  onThemeToggle: () => void;
  onExitAdmin: () => void;
  onLockConsole?: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentTab,
  onTabChange,
  lang,
  onLangChange,
  isDark,
  onThemeToggle,
  onExitAdmin,
  onLockConsole,
  children
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [idleMinutesLeft, setIdleMinutesLeft] = useState(30);
  const t = i18n[lang];

  // 30-minute idle session timeout tracker
  useEffect(() => {
    let lastActive = Date.now();
    const resetTimer = () => { lastActive = Date.now(); };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('touchstart', resetTimer);

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastActive) / 60000);
      const remaining = Math.max(0, 30 - elapsed);
      setIdleMinutesLeft(remaining);
      if (remaining <= 0) {
        alert('Admin session timed out after 30 minutes of inactivity for security.');
        auth.signOut();
        onExitAdmin();
      }
    }, 30000);

    return () => {
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      clearInterval(interval);
    };
  }, []);

  const navItems = [
    { id: 'dashboard' as const, label: t.dashboard, icon: LayoutDashboard },
    { id: 'users' as const, label: t.users, icon: Users },
    { id: 'content' as const, label: t.content, icon: Video },
    { id: 'reports' as const, label: t.reports, icon: Flag },
    { id: 'blocks' as const, label: t.blocks, icon: ShieldAlert },
    { id: 'legal' as const, label: t.legal, icon: Scale },
    { id: 'appVersions' as const, label: t.appVersions, icon: Smartphone },
    { id: 'push' as const, label: t.push, icon: Bell },
    { id: 'flags' as const, label: t.flags, icon: Sliders },
    { id: 'support' as const, label: t.support, icon: ShieldCheck },
    { id: 'media' as const, label: t.media, icon: HardDrive },
    { id: 'analytics' as const, label: t.analytics, icon: TrendingUp },
    { id: 'staff' as const, label: t.staff, icon: UserCog },
    { id: 'health' as const, label: t.health, icon: Activity },
    { id: 'auditLogs' as const, label: t.auditLogs, icon: FileText },
  ];

  return (
    <div className={`min-h-screen flex bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100 font-sans`}>
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-white/10 z-50 flex flex-col justify-between transition-transform duration-200 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="flex flex-col h-full overflow-hidden">
          {/* Brand Logo & Header */}
          <div className="p-5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img src="/Ennvo.png" alt="Ennvo" className="w-9 h-9 rounded-xl shadow-md" />
              <div>
                <h2 className="font-black text-sm tracking-wide text-gray-900 dark:text-white">
                  Ennvo Admin
                </h2>
                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">
                  Staff Workspace
                </span>
              </div>
            </div>

            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links Scroll Container */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer info */}
          <div className="p-4 border-t border-gray-100 dark:border-white/5 space-y-3 bg-gray-50/50 dark:bg-gray-950/30">
            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <span className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-purple-600" />
                <span>Session: {idleMinutesLeft}m</span>
              </span>
              <span className="font-semibold text-purple-600">v1.1</span>
            </div>

            {onLockConsole && (
              <button
                onClick={onLockConsole}
                className="w-full py-2 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                title="Lock admin session immediately"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock Console</span>
              </button>
            )}

            <button
              onClick={onExitAdmin}
              className="w-full py-2 px-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to App</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white/95 dark:bg-gray-900/95 border-b border-gray-200 dark:border-white/10 sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl"
            >
              <Menu className="w-5 h-5" />
            </button>

            <span className="font-bold text-sm text-gray-900 dark:text-white hidden sm:inline-block">
              {navItems.find(n => n.id === currentTab)?.label || 'Console'}
            </span>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Quick Lock Session Button */}
            {onLockConsole && (
              <button
                onClick={onLockConsole}
                title="Lock Admin Session"
                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors cursor-pointer"
              >
                <Lock className="w-4 h-4" />
              </button>
            )}

            {/* Language Toggle (English / বাংলা) */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-0.5 rounded-xl text-xs font-bold">
              <button
                onClick={() => onLangChange('bn')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  lang === 'bn' ? 'bg-purple-600 text-white' : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                বাংলা
              </button>
              <button
                onClick={() => onLangChange('en')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  lang === 'en' ? 'bg-purple-600 text-white' : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                EN
              </button>
            </div>

            {/* Dark Mode Switch */}
            <button
              onClick={onThemeToggle}
              title="Toggle Theme"
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-purple-600" />}
            </button>

            {/* Staff User Avatar Pill */}
            <div className="flex items-center space-x-2 pl-2 border-l border-gray-200 dark:border-white/10">
              <img
                src="/Ennvo.png"
                alt="Staff"
                className="w-7 h-7 rounded-full object-cover border border-purple-500"
              />
              <span className="text-xs font-bold text-gray-900 dark:text-white hidden md:inline-block">
                Staff Ops
              </span>
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="p-4 sm:p-6 lg:p-8 flex-1 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
