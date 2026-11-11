import React, { useState, useEffect } from 'react';
import { Sliders, CheckCircle, RefreshCw, Sparkles, Shield } from 'lucide-react';
import { Language, i18n } from '../i18n';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../src/firebase';
import { logAdminAction } from '../services/adminService';

export const FeatureFlagsPage: React.FC<{ lang: Language }> = ({ lang }) => {
  const [flags, setFlags] = useState({
    callsEnabled: true,
    reelsUploadEnabled: true,
    aiChatEnabled: true,
    storiesEnabled: true,
    adsEnabled: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const t = i18n[lang];

  useEffect(() => {
    loadFlags();
  }, []);

  const loadFlags = async () => {
    try {
      const snap = await getDoc(doc(db, 'appConfig', 'flags'));
      if (snap.exists()) {
        setFlags((prev) => ({ ...prev, ...snap.data() }));
      }
    } catch (e) {}
  };

  const handleToggle = (key: keyof typeof flags) => {
    setFlags({ ...flags, [key]: !flags[key] });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'appConfig', 'flags'), {
        ...flags,
        updatedAt: new Date()
      }, { merge: true });

      await logAdminAction({
        action: 'feature_flags_updated',
        targetType: 'appConfig',
        targetId: 'flags',
        afterValue: flags,
        reason: 'Staff updated remote feature toggles'
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      alert(`Save error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const flagItems = [
    { key: 'callsEnabled' as const, label: 'Realtime Audio & Video Calling', desc: 'Allows users to initiate WebRTC calls across Android and Web.' },
    { key: 'reelsUploadEnabled' as const, label: 'Reels Video Uploads', desc: 'Allows publishing of short video reels to the feed.' },
    { key: 'aiChatEnabled' as const, label: 'Ennvo Jarvis AI Companion', desc: 'Enables real-time companion chat powered by Gemini.' },
    { key: 'storiesEnabled' as const, label: 'Ephemeral 24h Stories', desc: 'Enables posting stories on top of the home screen.' },
    { key: 'adsEnabled' as const, label: 'Promoted Sponsored Posts', desc: 'Allows brand ads and sponsored cards in discovery feed.' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">{t.flags}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Dynamic remote switches stored in <code>appConfig/flags</code>. Changes propagate instantly to active client sessions.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center space-x-1.5"
        >
          <CheckCircle className="w-4 h-4" />
          <span>{saving ? 'Publishing...' : 'Save Feature Flags'}</span>
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs p-6 space-y-4 max-w-2xl">
        {flagItems.map((item) => (
          <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-white/5">
            <div>
              <span className="font-bold text-sm text-gray-900 dark:text-white block">{item.label}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</span>
            </div>
            <button
              onClick={() => handleToggle(item.key)}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                flags[item.key] ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                  flags[item.key] ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
