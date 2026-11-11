import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Activity, 
  MessageSquare, 
  PhoneCall, 
  Video, 
  Flag, 
  ShieldBan, 
  HardDrive, 
  TrendingUp, 
  Sparkles,
  ArrowUpRight,
  Clock,
  RefreshCw
} from 'lucide-react';
import { fetchLiveStats } from '../services/adminService';
import { LiveStats } from '../types';
import { Language, i18n } from '../i18n';
import { formatFileSize } from '../../../src/utils';

export const DashboardPage: React.FC<{ lang: Language }> = ({ lang }) => {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('7d');
  const t = i18n[lang];

  const loadData = async () => {
    setLoading(true);
    const data = await fetchLiveStats();
    setStats(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Time-series mock trend points for Recharts/SVG visualization
  const trendData = range === '7d' 
    ? [20, 32, 45, 58, 62, 79, 94] 
    : range === '30d' 
    ? [10, 18, 25, 40, 55, 68, 80, 95, 110, 125, 140, 155]
    : [5, 12, 28, 45, 75, 110, 150, 190, 240, 310];

  return (
    <div className="space-y-6">
      {/* Top Welcome Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">
              {t.dashboard}
            </h1>
            <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded-full border border-purple-200 dark:border-purple-800">
              Live Systems
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Real-time telemetry, user engagement metrics, and infrastructure capacity.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Range filter buttons */}
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl text-xs font-semibold">
            {(['7d', '30d', '90d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  range === r 
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs' 
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={loadData}
            title="Refresh statistics"
            className="p-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-xs">
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-3">
            <Users className="w-5 h-5" />
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full flex items-center">
              +14% <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white mb-0.5">
            {stats?.totalUsers ?? '...'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            {t.totalUsers}
          </div>
        </div>

        {/* Active Now */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-3">
            <Activity className="w-5 h-5 animate-pulse" />
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white mb-0.5">
            {stats?.activeNow ?? '...'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            {t.activeNow}
          </div>
        </div>

        {/* Daily Active Users (DAU) */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-xs">
          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-3">
            <TrendingUp className="w-5 h-5" />
            <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full">
              WAU: {stats?.wau ?? 0}
            </span>
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white mb-0.5">
            {stats?.dau ?? '...'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            {t.dau}
          </div>
        </div>

        {/* Open Reports */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-xs">
          <div className="flex items-center justify-between text-amber-500 mb-3">
            <Flag className="w-5 h-5" />
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              (stats?.openReports || 0) > 0 ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {stats?.openReports ? 'Action Needed' : 'Clear'}
            </span>
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white mb-0.5">
            {stats?.openReports ?? 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            {t.openReports}
          </div>
        </div>
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Posts & Reels */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-xs">
          <div className="flex items-center space-x-2 text-pink-600 dark:text-pink-400 mb-2">
            <Video className="w-4 h-4" />
            <span className="text-xs font-semibold">{t.postsToday}</span>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {stats?.postsToday ?? 0}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            Reels: {stats?.reelsToday ?? 0}
          </div>
        </div>

        {/* Messages */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-xs">
          <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 mb-2">
            <MessageSquare className="w-4 h-4" />
            <span className="text-xs font-semibold">{t.messagesToday}</span>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {stats?.messagesToday ?? 0}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            Direct & Group chats
          </div>
        </div>

        {/* Calls Today */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-xs">
          <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 mb-2">
            <PhoneCall className="w-4 h-4" />
            <span className="text-xs font-semibold">{t.callsToday}</span>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {stats?.callsToday ?? 0}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            HD Audio & Video
          </div>
        </div>

        {/* Storage */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-xs">
          <div className="flex items-center space-x-2 text-purple-600 dark:text-purple-400 mb-2">
            <HardDrive className="w-4 h-4" />
            <span className="text-xs font-semibold">{t.storageUsed}</span>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {formatFileSize(stats?.storageUsedBytes || 0)}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            Cloudflare R2 Bucket
          </div>
        </div>
      </div>

      {/* Engagement Curve Visualizer (7 / 30 / 90 days) */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Platform Growth & Activity Curve ({range.toUpperCase()})
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Daily signups, active users, and message throughput aggregated by Cloud Functions.
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-purple-600 dark:text-purple-400">
            <Sparkles className="w-4 h-4" />
            <span>Target: 99.98% SLA</span>
          </div>
        </div>

        {/* SVG Sparkline Graph */}
        <div className="h-44 w-full flex items-end justify-between gap-2 pt-6 pb-2 px-2 bg-gray-50/70 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-white/5">
          {trendData.map((val, idx) => {
            const heightPercent = Math.min(100, Math.max(12, (val / Math.max(...trendData)) * 100));
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                <div 
                  style={{ height: `${heightPercent}%` }}
                  className="w-full max-w-[28px] bg-gradient-to-t from-purple-600 to-indigo-500 rounded-lg group-hover:from-purple-500 group-hover:to-pink-500 transition-all relative cursor-pointer"
                >
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    {val} pts
                  </div>
                </div>
                <span className="text-[10px] font-medium text-gray-400">
                  {idx + 1}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
