import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Ban, 
  Plus, 
  Trash2, 
  CheckCircle, 
  Lock, 
  Smartphone, 
  Globe 
} from 'lucide-react';
import { Language, i18n } from '../i18n';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../src/firebase';
import { logAdminAction } from '../services/adminService';

export const BlocksSafetyPage: React.FC<{ lang: Language }> = ({ lang }) => {
  const [bannedWords, setBannedWords] = useState<string[]>([
    'scam', 'fraud', 'free_followers', 'hack_coins'
  ]);
  const [reservedUsernames, setReservedUsernames] = useState<string[]>([
    'admin', 'ennvo', 'support', 'help', 'official', 'security', 'billing', 'staff', 'erfan'
  ]);
  const [bannedIps, setBannedIps] = useState<string[]>(['192.0.2.1']);
  const [newWord, setNewWord] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newIp, setNewIp] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const t = i18n[lang];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const snap = await getDoc(doc(db, 'appConfig', 'moderation'));
      if (snap.exists()) {
        const d = snap.data();
        if (d.bannedWords) setBannedWords(d.bannedWords);
        if (d.reservedUsernames) setReservedUsernames(d.reservedUsernames);
        if (d.bannedIps) setBannedIps(d.bannedIps);
      }
    } catch (e) {}
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'appConfig', 'moderation'), {
        bannedWords,
        reservedUsernames,
        bannedIps,
        updatedAt: new Date()
      }, { merge: true });

      await logAdminAction({
        action: 'safety_moderation_config_updated',
        targetType: 'appConfig',
        targetId: 'moderation',
        afterValue: { bannedWordsCount: bannedWords.length, reservedUsernamesCount: reservedUsernames.length },
        reason: 'Updated safety blocklists and keyword filters'
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      alert(`Save error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">
            {t.blocks}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Global profanity filters, reserved system handles, and IP blacklist enforcement.
          </p>
        </div>

        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center space-x-1.5"
        >
          <CheckCircle className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Safety Rules'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Reserved Usernames */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center space-x-2">
            <Lock className="w-4 h-4 text-purple-600" />
            <span>Reserved Usernames</span>
          </h3>

          <div className="flex gap-2">
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
              placeholder="e.g. verified"
              className="flex-1 p-2 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs border border-gray-200 dark:border-white/10"
            />
            <button
              onClick={() => {
                if (newUsername.trim() && !reservedUsernames.includes(newUsername.trim())) {
                  setReservedUsernames([...reservedUsernames, newUsername.trim()]);
                  setNewUsername('');
                }
              }}
              className="p-2 bg-purple-600 text-white rounded-xl"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-60 overflow-y-auto">
            {reservedUsernames.map((u, i) => (
              <span key={i} className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 text-xs px-2.5 py-1 rounded-full text-gray-700 dark:text-gray-300">
                <span>@{u}</span>
                <button
                  onClick={() => setReservedUsernames(reservedUsernames.filter((_, idx) => idx !== i))}
                  className="hover:text-red-500 cursor-pointer"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Global Blocked Words */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center space-x-2">
            <Ban className="w-4 h-4 text-red-500" />
            <span>Blocked Words & Spam Keywords</span>
          </h3>

          <div className="flex gap-2">
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value.toLowerCase())}
              placeholder="Add keyword..."
              className="flex-1 p-2 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs border border-gray-200 dark:border-white/10"
            />
            <button
              onClick={() => {
                if (newWord.trim() && !bannedWords.includes(newWord.trim())) {
                  setBannedWords([...bannedWords, newWord.trim()]);
                  setNewWord('');
                }
              }}
              className="p-2 bg-red-600 text-white rounded-xl"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-60 overflow-y-auto">
            {bannedWords.map((w, i) => (
              <span key={i} className="flex items-center space-x-1 bg-red-50 dark:bg-red-950/40 text-xs px-2.5 py-1 rounded-full text-red-600">
                <span>{w}</span>
                <button
                  onClick={() => setBannedWords(bannedWords.filter((_, idx) => idx !== i))}
                  className="hover:text-red-800 cursor-pointer"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Banned IPs */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center space-x-2">
            <Globe className="w-4 h-4 text-blue-500" />
            <span>Banned IP Addresses</span>
          </h3>

          <div className="flex gap-2">
            <input
              type="text"
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              placeholder="192.0.2.x"
              className="flex-1 p-2 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs border border-gray-200 dark:border-white/10 font-mono"
            />
            <button
              onClick={() => {
                if (newIp.trim() && !bannedIps.includes(newIp.trim())) {
                  setBannedIps([...bannedIps, newIp.trim()]);
                  setNewIp('');
                }
              }}
              className="p-2 bg-blue-600 text-white rounded-xl"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-60 overflow-y-auto font-mono text-xs">
            {bannedIps.map((ip, i) => (
              <span key={i} className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full text-gray-700 dark:text-gray-300">
                <span>{ip}</span>
                <button
                  onClick={() => setBannedIps(bannedIps.filter((_, idx) => idx !== i))}
                  className="hover:text-red-500 cursor-pointer"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
