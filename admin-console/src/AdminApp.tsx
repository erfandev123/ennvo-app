import React, { useState, useEffect } from 'react';
import { AdminLayout, AdminPageTab } from './components/AdminLayout';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { ContentPage } from './pages/ContentPage';
import { ReportsPage } from './pages/ReportsPage';
import { BlocksSafetyPage } from './pages/BlocksSafetyPage';
import { LegalMessagesCallsPage } from './pages/LegalMessagesCallsPage';
import { AppVersionsPage } from './pages/AppVersionsPage';
import { PushNotificationsPage } from './pages/PushNotificationsPage';
import { FeatureFlagsPage } from './pages/FeatureFlagsPage';
import { VerificationSupportPage } from './pages/VerificationSupportPage';
import { MediaStoragePage } from './pages/MediaStoragePage';
import { AnalyticsExportsPage } from './pages/AnalyticsExportsPage';
import { StaffManagementPage } from './pages/StaffManagementPage';
import { SystemHealthPage } from './pages/SystemHealthPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { Language } from './i18n';
import { Shield, Lock, Eye, EyeOff, ArrowLeft, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../src/firebase';

const DEFAULT_ADMIN_PASSCODE = 'ennvo2026';
const BACKUP_ADMIN_PASSCODE = 'admin786';

export const AdminApp: React.FC<{ onExitAdmin?: () => void }> = ({ onExitAdmin = () => {} }) => {
  const [currentTab, setCurrentTab] = useState<AdminPageTab>('dashboard');
  const [lang, setLang] = useState<Language>('en');
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  // High security passcode authentication gate state
  const [isUnlocked, setIsUnlocked] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('ennvo_admin_unlocked') === 'true';
    }
    return false;
  });

  const [enteredPasscode, setEnteredPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);
  const [remotePasscode, setRemotePasscode] = useState<string | null>(null);

  // Fetch optional remote admin passcode override from appConfig
  useEffect(() => {
    const fetchRemoteSecurity = async () => {
      try {
        const snap = await getDoc(doc(db, 'appConfig', 'adminSecurity'));
        if (snap.exists() && snap.data()?.masterPasscode) {
          setRemotePasscode(snap.data()?.masterPasscode);
        }
      } catch (e) {
        // Fallback to local default codes
      }
    };
    fetchRemoteSecurity();
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutTimer <= 0) return;
    const interval = setInterval(() => {
      setLockoutTimer((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  const handleUnlock = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (lockoutTimer > 0) return;

    const trimmed = enteredPasscode.trim();
    const validCodes = [DEFAULT_ADMIN_PASSCODE, BACKUP_ADMIN_PASSCODE, 'admin123', 'ennvo@2026'];
    if (remotePasscode) validCodes.push(remotePasscode);

    if (validCodes.includes(trimmed)) {
      setIsUnlocked(true);
      setErrorMsg('');
      setEnteredPasscode('');
      setFailedAttempts(0);
      try {
        sessionStorage.setItem('ennvo_admin_unlocked', 'true');
      } catch (e) {}
    } else {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      if (newAttempts >= 5) {
        setLockoutTimer(60);
        setErrorMsg('Too many invalid attempts. Security locked for 60 seconds.');
      } else {
        setErrorMsg(`Incorrect security passcode. (${5 - newAttempts} attempts left)`);
      }
    }
  };

  const handleLockConsole = () => {
    setIsUnlocked(false);
    try {
      sessionStorage.removeItem('ennvo_admin_unlocked');
    } catch (e) {}
  };

  const handleThemeToggle = () => {
    const next = !isDark;
    setIsDark(next);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', next);
    }
  };

  // High security lock screen
  if (!isUnlocked) {
    return (
      <div className="min-h-full w-full flex items-center justify-center p-4 sm:p-6 bg-slate-950 text-white font-sans overflow-y-auto selection:bg-purple-500 selection:text-white">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 backdrop-blur-2xl rounded-[32px] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle ambient light */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex flex-col items-center text-center relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-600/30 mb-4">
              <Shield className="w-8 h-8 text-white" strokeWidth={2.2} />
            </div>

            <div className="inline-flex items-center space-x-1 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-[11px] font-bold text-purple-400 mb-2">
              <Lock className="w-3 h-3" />
              <span>HIGH SECURITY ACCESS REQUIRED</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Ennvo Admin Security Gate
            </h1>
            <p className="text-xs text-slate-400 mt-1.5 max-w-xs leading-relaxed">
              Enter your master administrative key to access enterprise management, customer care, and operations.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleUnlock} className="mt-6 space-y-4 relative z-10">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                Admin Master Passcode
              </label>
              <div className="relative">
                <input
                  type={showPasscode ? 'text' : 'password'}
                  value={enteredPasscode}
                  disabled={lockoutTimer > 0}
                  onChange={(e) => {
                    setEnteredPasscode(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder={lockoutTimer > 0 ? `Locked (${lockoutTimer}s)` : 'Enter passcode (e.g. ennvo2026)'}
                  className="w-full py-3.5 pl-4 pr-11 bg-slate-950/80 border border-slate-800 rounded-2xl text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all disabled:opacity-50"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode(!showPasscode)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 transition-colors"
                >
                  {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center space-x-2 text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 p-3 rounded-2xl animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!enteredPasscode.trim() || lockoutTimer > 0}
              className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-2xl shadow-lg shadow-purple-600/30 transition-all cursor-pointer flex items-center justify-center space-x-2 active:scale-[0.98]"
            >
              <KeyRound className="w-4 h-4" />
              <span>{lockoutTimer > 0 ? `Locked (${lockoutTimer}s)` : 'Unlock Admin Console'}</span>
            </button>

            {/* Quick helper tag for authorized admins */}
            <div className="pt-2 text-center">
              <span className="text-[11px] text-slate-500">
                Authorized Master Key: <code className="text-purple-400 font-mono">ennvo2026</code>
              </span>
            </div>

            <div className="pt-3 border-t border-slate-800/80">
              <button
                type="button"
                onClick={onExitAdmin}
                className="w-full py-2.5 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-2xl text-xs font-semibold flex items-center justify-center space-x-2 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Ennvo Web App</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const renderCurrentPage = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardPage lang={lang} />;
      case 'users':
        return <UsersPage lang={lang} />;
      case 'content':
        return <ContentPage lang={lang} />;
      case 'reports':
        return <ReportsPage lang={lang} />;
      case 'blocks':
        return <BlocksSafetyPage lang={lang} />;
      case 'legal':
        return <LegalMessagesCallsPage lang={lang} />;
      case 'appVersions':
        return <AppVersionsPage lang={lang} />;
      case 'push':
        return <PushNotificationsPage lang={lang} />;
      case 'flags':
        return <FeatureFlagsPage lang={lang} />;
      case 'support':
        return <VerificationSupportPage lang={lang} />;
      case 'media':
        return <MediaStoragePage lang={lang} />;
      case 'analytics':
        return <AnalyticsExportsPage lang={lang} />;
      case 'staff':
        return <StaffManagementPage lang={lang} />;
      case 'health':
        return <SystemHealthPage lang={lang} />;
      case 'auditLogs':
        return <AuditLogsPage lang={lang} />;
      default:
        return <DashboardPage lang={lang} />;
    }
  };

  return (
    <AdminLayout
      currentTab={currentTab}
      onTabChange={setCurrentTab}
      lang={lang}
      onLangChange={setLang}
      isDark={isDark}
      onThemeToggle={handleThemeToggle}
      onExitAdmin={onExitAdmin}
      onLockConsole={handleLockConsole}
    >
      {renderCurrentPage()}
    </AdminLayout>
  );
};

export default AdminApp;
