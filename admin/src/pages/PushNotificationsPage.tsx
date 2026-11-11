import React, { useState } from 'react';
import { 
  Send, 
  Bell, 
  Smartphone, 
  Users, 
  CheckCircle, 
  Calendar, 
  Sparkles, 
  ExternalLink 
} from 'lucide-react';
import { Language, i18n } from '../i18n';
import { logAdminAction } from '../services/adminService';

export const PushNotificationsPage: React.FC<{ lang: Language }> = ({ lang }) => {
  const [audience, setAudience] = useState<'all' | 'segment' | 'single'>('all');
  const [targetUid, setTargetUid] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [deepLink, setDeepLink] = useState('https://ennvo.vercel.app');
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const t = i18n[lang];

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim() || !reason.trim()) {
      alert('Please fill out title, body, and audit reason.');
      return;
    }
    setSending(true);
    try {
      // Simulate/trigger FCM distribution and log audit entry
      await logAdminAction({
        action: 'fcm_push_broadcast',
        targetType: 'fcm_notification',
        targetId: audience,
        afterValue: { audience, title, body, deepLink, targetUid },
        reason,
      });

      setSentSuccess(true);
      setTimeout(() => setSentSuccess(false), 4000);
      setTitle('');
      setBody('');
      setReason('');
    } catch (e: any) {
      alert(`Send error: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">
            {t.push}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Dispatch FCM background pushes, deep-link campaigns, and in-app emergency alerts.
          </p>
        </div>

        {sentSuccess && (
          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-semibold">
            <CheckCircle className="w-4 h-4" />
            <span>Push Successfully Dispatched!</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <form onSubmit={handleSend} className="lg:col-span-2 space-y-5 bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs">
          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-2">
              Audience Segment:
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['all', 'segment', 'single'] as const).map((a) => (
                <button
                  type="button"
                  key={a}
                  onClick={() => setAudience(a)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold capitalize transition-colors cursor-pointer ${
                    audience === a 
                      ? 'bg-purple-600 text-white shadow-xs' 
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {a === 'all' ? 'All Registered Users' : a === 'segment' ? 'Country / Language' : 'Single User UID'}
                </button>
              ))}
            </div>
          </div>

          {audience === 'single' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Target User UID:</label>
              <input
                type="text"
                required
                value={targetUid}
                onChange={(e) => setTargetUid(e.target.value)}
                placeholder="Enter Firebase user UID..."
                className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs border border-gray-200 dark:border-white/10 font-mono"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Notification Title:</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. ⚡ Live event started on Ennvo!"
              className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs border border-gray-200 dark:border-white/10"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Message Body:</label>
            <textarea
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type notification text..."
              className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs border border-gray-200 dark:border-white/10 h-24 resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Deep Link URL (Opens on tap):</label>
            <input
              type="text"
              value={deepLink}
              onChange={(e) => setDeepLink(e.target.value)}
              placeholder="https://ennvo.vercel.app/post/xyz or https://ennvo.vercel.app/account/erfan"
              className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs border border-gray-200 dark:border-white/10 font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-900 dark:text-white block mb-1">
              Mandatory Audit Reason:
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Weekly engagement highlight notification..."
              className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs border border-gray-200 dark:border-white/10"
            />
          </div>

          <button
            type="submit"
            disabled={sending || !title.trim() || !body.trim() || !reason.trim()}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2"
          >
            <Send className="w-4 h-4" />
            <span>{sending ? 'Broadcasting Push...' : 'Send Push via FCM Batches'}</span>
          </button>
        </form>

        {/* Live Notification Mock Preview */}
        <div>
          <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center space-x-1.5">
              <Smartphone className="w-4 h-4 text-purple-600" />
              <span>Android Notification Shade</span>
            </h3>

            {/* Android Lockscreen / Status Shade Mock */}
            <div className="w-full max-w-[280px] mx-auto bg-gray-900 rounded-[28px] p-4 text-white shadow-2xl border border-gray-800">
              <div className="flex items-center justify-between text-[10px] text-gray-400 mb-4 px-1">
                <span>12:45</span>
                <span>📶 100%</span>
              </div>

              {/* Notification Banner */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 shadow-lg space-y-1">
                <div className="flex items-center space-x-2 mb-1">
                  <img src="/icon-192.png?v=3" alt="Ennvo" className="w-4 h-4 rounded-full" />
                  <span className="text-[10px] font-bold text-gray-300">Ennvo • Just now</span>
                </div>
                <div className="font-bold text-xs text-white truncate">
                  {title || 'Ennvo Notification Title'}
                </div>
                <div className="text-[11px] text-gray-300 line-clamp-2 leading-relaxed">
                  {body || 'Your message preview will appear here inside the native Android notification shade.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
