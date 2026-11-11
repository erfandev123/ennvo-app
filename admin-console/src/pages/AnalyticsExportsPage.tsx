import React from 'react';
import { TrendingUp, Download, Users, FileSpreadsheet, PieChart, BarChart3, Award } from 'lucide-react';
import { Language, i18n } from '../i18n';

export const AnalyticsExportsPage: React.FC<{ lang: Language }> = ({ lang }) => {
  const t = i18n[lang];

  const funnels = [
    { step: 'App Install & Open', count: '10,400', conv: '100%' },
    { step: 'Account Signup', count: '8,920', conv: '85.7%' },
    { step: 'Profile Completed', count: '7,450', conv: '83.5%' },
    { step: 'First Post / Reel Published', count: '5,120', conv: '68.7%' },
    { step: 'First Message Sent', count: '6,340', conv: '85.1%' },
    { step: 'First Video Call Placed', count: '3,890', conv: '61.3%' },
  ];

  const topCreators = [
    { rank: 1, name: 'Erfan Sarker', handle: '@erfansarker', followers: '14.8K', engagement: '9.4%' },
    { rank: 2, name: 'Ennvo Tech Official', handle: '@ennvo', followers: '11.2K', engagement: '8.7%' },
    { rank: 3, name: 'Bijoynagar Beats', handle: '@beats', followers: '8.4K', engagement: '7.9%' },
    { rank: 4, name: 'Dhaka Stories', handle: '@dhaka', followers: '6.2K', engagement: '7.1%' },
  ];

  const handleDownloadDataset = (name: string) => {
    const dummy = [{ exportedAt: new Date().toISOString(), reportName: name, status: 'complete' }];
    const blob = new Blob([JSON.stringify(dummy, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ennvo_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">{t.analytics}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Conversion funnels, creator leaderboards, retention cohorts, and bulk export tools.
          </p>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={() => handleDownloadDataset('Engagement_Cohorts')}
            className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center space-x-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Export Analytics JSON</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Onboarding & Engagement Funnel */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-purple-600" />
            <span>Product Lifecycle Conversion Funnel</span>
          </h3>

          <div className="space-y-2.5">
            {funnels.map((f, i) => (
              <div key={i} className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-gray-900 dark:text-white block">{f.step}</span>
                  <span className="text-gray-400 text-[11px]">{f.count} users</span>
                </div>
                <div className="text-right">
                  <span className="font-black text-purple-600 dark:text-purple-400">{f.conv}</span>
                  <span className="text-[10px] text-gray-400 block">step rate</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Creators Leaderboard */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center space-x-2">
            <Award className="w-4 h-4 text-yellow-500" />
            <span>Top Performing Creators</span>
          </h3>

          <div className="space-y-2.5">
            {topCreators.map((c) => (
              <div key={c.rank} className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3">
                  <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-600 font-bold flex items-center justify-center text-xs">
                    #{c.rank}
                  </span>
                  <div>
                    <span className="font-bold text-gray-900 dark:text-white block">{c.name}</span>
                    <span className="text-gray-400 text-[11px]">{c.handle}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-gray-900 dark:text-white">{c.followers} fans</span>
                  <span className="text-[10px] text-emerald-600 block">{c.engagement} ER</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
