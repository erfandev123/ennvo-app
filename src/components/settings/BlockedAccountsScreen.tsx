import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, UserX, Search, ShieldCheck, UserPlus, 
  Loader2, Check, AlertTriangle, Shield 
} from 'lucide-react';
import { useAppStore } from '../../store';
import { db } from '../../firebase';
import { collection, query, where, getDocs, doc, onSnapshot } from 'firebase/firestore';
import { blockUser, unblockUser, getBlockedUsersList } from '../../services/followService';

interface BlockedAccountsScreenProps {
  onBack: () => void;
}

interface BlockedItem {
  uid: string;
  name?: string;
  username?: string;
  avatar?: string;
  blockedAt?: any;
}

export const BlockedAccountsScreen: React.FC<BlockedAccountsScreenProps> = ({ onBack }) => {
  const { currentUser } = useAppStore();

  const [blockedList, setBlockedList] = useState<BlockedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [blockInput, setBlockInput] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Fetch real blocked users list from Firestore
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const loadBlocked = async () => {
      try {
        const list = await getBlockedUsersList(currentUser.uid);
        if (list && list.length > 0) {
          setBlockedList(list);
        } else {
          // Check localStorage as well
          try {
            const saved = localStorage.getItem(`ennvo_blocked_${currentUser.uid}`);
            if (saved) {
              const parsed = JSON.parse(saved);
              setBlockedList(parsed);
            } else {
              setBlockedList([]);
            }
          } catch {
            setBlockedList([]);
          }
        }
      } catch (err) {
        console.error('Error fetching blocked accounts:', err);
      } finally {
        setLoading(false);
      }
    };

    loadBlocked();

    // Listen to real-time updates on blockedUsers subcollection
    const unsub = onSnapshot(
      collection(db, 'users', currentUser.uid, 'blockedUsers'),
      (snap) => {
        const items = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
        setBlockedList(items);
        try {
          localStorage.setItem(`ennvo_blocked_${currentUser.uid}`, JSON.stringify(items));
        } catch {}
      },
      () => {}
    );

    return () => unsub();
  }, [currentUser]);

  // Unblock user handler
  const handleUnblock = async (targetUid: string, targetName?: string) => {
    if (!currentUser) return;
    try {
      await unblockUser(currentUser.uid, targetUid);
      setBlockedList(prev => prev.filter(item => item.uid !== targetUid));
      setActionNotice(`Unblocked ${targetName || 'user'} successfully.`);
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err) {
      console.error('Failed to unblock user:', err);
      alert('Failed to unblock user. Please try again.');
    }
  };

  // Block a user by username search
  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = blockInput.trim().toLowerCase().replace('@', '');
    if (!clean || !currentUser) return;

    if (clean === (currentUser.username || '').toLowerCase().replace('@', '')) {
      alert('You cannot block your own account.');
      return;
    }

    if (blockedList.some(u => (u.username || '').toLowerCase().replace('@', '') === clean)) {
      alert(`@${clean} is already in your blocked list.`);
      return;
    }

    setIsBlocking(true);
    try {
      // Find the user by username in Firestore
      const q = query(collection(db, 'users'), where('username', '==', clean));
      const snap = await getDocs(q);

      let targetUid = `blocked_${Date.now()}`;
      let targetName = `@${clean}`;
      let targetAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(clean)}&background=ef4444&color=fff`;

      if (!snap.empty) {
        const docObj = snap.docs[0];
        targetUid = docObj.id;
        const d = docObj.data();
        targetName = d.name || targetName;
        targetAvatar = d.avatar || targetAvatar;
      }

      await blockUser(currentUser.uid, targetUid, {
        name: targetName,
        username: clean,
        avatar: targetAvatar
      });

      setBlockInput('');
      setActionNotice(`Blocked @${clean}. They will no longer be able to message you or view your content.`);
      setTimeout(() => setActionNotice(null), 3500);
    } catch (err: any) {
      console.error('Failed to block user:', err);
      alert(err.message || 'Failed to block user.');
    } finally {
      setIsBlocking(false);
    }
  };

  const filteredList = blockedList.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.name || '').toLowerCase().includes(q) ||
      (item.username || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 w-full flex flex-col pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-2xs">
        <button 
          onClick={onBack}
          type="button"
          className="p-1 -ml-1 text-gray-900 hover:text-gray-600 transition-colors"
          title="Back"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-bold text-gray-900 tracking-tight text-center flex-1 pr-5">
          Blocked accounts
        </h1>
      </div>

      <div className="px-4 py-5 max-w-lg w-full mx-auto space-y-4">
        {/* Info Banner */}
        <div className="p-3.5 bg-gray-100/70 rounded-2xl border border-gray-200/50 flex items-center space-x-3 text-xs text-gray-600">
          <Shield className="w-5 h-5 text-gray-500 shrink-0" />
          <span>
            Once you block someone, they won't be able to view your profile, watch your videos, or send you messages on Ennvo.
          </span>
        </div>

        {/* Action Notice */}
        {actionNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-semibold flex items-center space-x-2 animate-in fade-in duration-200">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Quick Block Input Form */}
        <form onSubmit={handleAddBlock} className="bg-white rounded-2xl border border-gray-100/90 p-3 shadow-2xs">
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Block an Account</label>
          <div className="flex items-center space-x-2">
            <div className="flex-1 flex items-center bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
              <span className="text-sm text-gray-400 font-semibold mr-1">@</span>
              <input
                type="text"
                value={blockInput}
                onChange={(e) => setBlockInput(e.target.value)}
                placeholder="Enter username to block..."
                className="w-full text-xs font-medium text-gray-900 bg-transparent focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isBlocking || !blockInput.trim()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40 flex items-center space-x-1 shrink-0 active:scale-95"
            >
              {isBlocking ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <span>Block</span>
              )}
            </button>
          </div>
        </form>

        {/* Search in Blocked List */}
        {blockedList.length > 3 && (
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search blocked accounts..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-2xl text-xs font-medium text-gray-900 placeholder-gray-400 focus:outline-none"
            />
          </div>
        )}

        {/* Blocked List */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            <span className="text-xs text-gray-400">Loading blocked accounts...</span>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center mx-auto">
              <UserX className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-gray-900">No Blocked Accounts</p>
            <p className="text-xs text-gray-400 max-w-xs mx-auto">
              {searchQuery ? 'No blocked users match your search.' : 'You have not blocked any accounts yet.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100/90 shadow-2xs divide-y divide-gray-100 overflow-hidden">
            {filteredList.map((item) => (
              <div key={item.uid} className="flex items-center justify-between p-3.5 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-center space-x-3 min-w-0">
                  <img
                    src={item.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || item.username || 'User')}&background=ef4444&color=fff`}
                    alt={item.name || 'User'}
                    className="w-10 h-10 rounded-full object-cover border border-gray-100 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-gray-900 truncate leading-tight">
                      {item.name || item.username || 'User'}
                    </p>
                    <p className="text-xs text-gray-400 truncate leading-tight mt-0.5">
                      @{item.username || 'user'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleUnblock(item.uid, item.name || item.username)}
                  className="px-3.5 py-1.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 font-semibold text-xs transition-colors shrink-0 active:scale-95"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
