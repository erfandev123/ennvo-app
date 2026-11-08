import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Lock, 
  PhoneCall, 
  MessageSquare, 
  Clock, 
  FileText, 
  AlertTriangle,
  Eye
} from 'lucide-react';
import { Language, i18n } from '../i18n';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../../src/firebase';
import { logAdminAction } from '../services/adminService';
import { formatTime } from '../../../src/utils';

export const LegalMessagesCallsPage: React.FC<{ lang: Language }> = ({ lang }) => {
  const [calls, setCalls] = useState<any[]>([]);
  const [legalReason, setLegalReason] = useState('');
  const [legalCaseNumber, setLegalCaseNumber] = useState('');
  const [activeTab, setActiveTab] = useState<'calls' | 'audit'>('calls');
  const [targetConversationId, setTargetConversationId] = useState('');
  const [unlockedMessages, setUnlockedMessages] = useState<any[] | null>(null);
  const [unlockTimer, setUnlockTimer] = useState<number | null>(null);
  const t = i18n[lang];

  useEffect(() => {
    loadCallLogs();
  }, []);

  const loadCallLogs = async () => {
    try {
      const q = query(collection(db, 'calls'), orderBy('createdAt', 'desc'), limit(30));
      const snap = await getDocs(q);
      setCalls(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {}
  };

  const handleUnlockConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetConversationId.trim() || !legalReason.trim() || !legalCaseNumber.trim()) {
      alert('Case number, conversation ID, and official legal justification are strictly required.');
      return;
    }

    try {
      // 1. Record forensic immutable audit log
      await logAdminAction({
        action: 'legal_chat_access_granted',
        targetType: 'conversation',
        targetId: targetConversationId,
        reason: `Case #${legalCaseNumber}: ${legalReason}`,
        afterValue: { timeWindowMinutes: 15 }
      });

      // 2. Fetch messages for diagnostic review
      const msgSnap = await getDocs(
        query(collection(db, 'conversations', targetConversationId, 'messages'), orderBy('createdAt', 'desc'), limit(50))
      );
      setUnlockedMessages(msgSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setUnlockTimer(15 * 60); // 15-minute SLA timer

      const countdown = setInterval(() => {
        setUnlockTimer(prev => {
          if (!prev || prev <= 1) {
            clearInterval(countdown);
            setUnlockedMessages(null);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (e: any) {
      alert(`Access denied or not found: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">
              {t.legal}
            </h1>
            <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 rounded-full">
              Restricted Forensic Access
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Zero-browsing privacy policy: Conversations require official legal warrants or abuse report linkage.
          </p>
        </div>

        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('calls')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer ${
              activeTab === 'calls' ? 'bg-white dark:bg-gray-700 text-purple-600 font-bold' : 'text-gray-500'
            }`}
          >
            Call Diagnostics
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer ${
              activeTab === 'audit' ? 'bg-white dark:bg-gray-700 text-purple-600 font-bold' : 'text-gray-500'
            }`}
          >
            Legal Chat Access
          </button>
        </div>
      </div>

      {activeTab === 'calls' ? (
        /* Call Telemetry Diagnostics (No audio content stored or accessible) */
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-white/5 text-xs text-gray-500 font-semibold flex items-center space-x-2">
            <PhoneCall className="w-4 h-4 text-emerald-500" />
            <span>Realtime WebRTC Call Connection & Duration Telemetry</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-400 uppercase font-bold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Call ID</th>
                  <th className="py-3 px-4">Caller</th>
                  <th className="py-3 px-4">Receiver</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-gray-700 dark:text-gray-300">
                {calls.length === 0 ? (
                  <tr><td colSpan={6} className="py-6 text-center text-gray-400">No calls recorded</td></tr>
                ) : (
                  calls.map((c) => (
                    <tr key={c.id}>
                      <td className="py-3 px-4 font-mono text-[11px] text-gray-400">{c.id.substring(0, 10)}</td>
                      <td className="py-3 px-4 font-bold">{c.callerName || 'User'}</td>
                      <td className="py-3 px-4 font-bold">{c.receiverName || 'User'}</td>
                      <td className="py-3 px-4 capitalize font-semibold">{c.type || 'video'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          c.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-400">{formatTime(c.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Legal Case Inspection Request Form */
        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs max-w-xl space-y-4">
          <div className="p-3.5 bg-red-50 dark:bg-red-950/40 rounded-2xl border border-red-200 dark:border-red-900/50 flex items-start space-x-3 text-red-800 dark:text-red-200 text-xs">
            <Lock className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Strict Privacy Notice:</span>
              Opening private messages is logged irreversibly to the immutable audit trail. Access is automatically revoked after 15 minutes.
            </div>
          </div>

          <form onSubmit={handleUnlockConversation} className="space-y-4 text-xs font-semibold">
            <div>
              <label className="text-gray-500 block mb-1">Official Legal / Report Case Number:</label>
              <input
                type="text"
                required
                value={legalCaseNumber}
                onChange={(e) => setLegalCaseNumber(e.target.value)}
                placeholder="CASE-2026-XXXX"
                className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-white/10"
              />
            </div>

            <div>
              <label className="text-gray-500 block mb-1">Target Conversation ID:</label>
              <input
                type="text"
                required
                value={targetConversationId}
                onChange={(e) => setTargetConversationId(e.target.value)}
                placeholder="Paste conversation document ID..."
                className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-white/10 font-mono"
              />
            </div>

            <div>
              <label className="text-gray-500 block mb-1">Mandatory Justification / Warrant Summary:</label>
              <textarea
                required
                value={legalReason}
                onChange={(e) => setLegalReason(e.target.value)}
                placeholder="Specify law enforcement request or abuse report context..."
                className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-white/10 h-20 resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold cursor-pointer transition-colors shadow-xs"
            >
              Authorize & Open Conversation (Logged)
            </button>
          </form>

          {unlockedMessages && (
            <div className="pt-4 border-t border-gray-100 dark:border-white/5 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-amber-600">
                <span>Access Active ({unlockedMessages.length} messages)</span>
                <span>Time remaining: {unlockTimer}s</span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-2xl max-h-60 overflow-y-auto space-y-2 text-xs">
                {unlockedMessages.map((m, idx) => (
                  <div key={idx} className="p-2 bg-white dark:bg-gray-900 rounded-xl">
                    <span className="text-[10px] text-gray-400 font-mono">[{m.senderId}]</span>
                    <p className="text-gray-800 dark:text-gray-200 font-medium">{m.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
