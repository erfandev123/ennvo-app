import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, UserX, Search, ShieldCheck, UserPlus, Loader2, Check } from 'lucide-react';
import { useAppStore } from '../../store';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

interface BlockedUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BlockedUserItem {
  uid: string;
  username: string;
  name: string;
  avatar: string;
  blockedAt: number;
}

export const BlockedUsersModal: React.FC<BlockedUsersModalProps> = ({ isOpen, onClose }) => {
  const { currentUser } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [newBlockUsername, setNewBlockUsername] = useState('');
  const [blockedList, setBlockedList] = useState<BlockedUserItem[]>(() => {
    try {
      const saved = localStorage.getItem(`ennvo_blocked_${currentUser?.uid}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        uid: 'spam_user_1',
        username: 'cryptospam_99',
        name: 'Crypto Bot',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop',
        blockedAt: Date.now() - 86400000 * 5
      },
      {
        uid: 'spam_user_2',
        username: 'fake_giveaway_official',
        name: 'Giveaways Global',
        avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=80&h=80&fit=crop',
        blockedAt: Date.now() - 86400000 * 12
      }
    ];
  });

  if (!isOpen) return null;

  const handleUnblock = (uid: string) => {
    const updated = blockedList.filter((u) => u.uid !== uid);
    setBlockedList(updated);
    if (currentUser) {
      localStorage.setItem(`ennvo_blocked_${currentUser.uid}`, JSON.stringify(updated));
      // Also sync to Firestore user doc
      try {
        updateDoc(doc(db, 'users', currentUser.uid), {
          blockedUserIds: updated.map(u => u.uid)
        }).catch(() => {});
      } catch {}
    }
  };

  const handleAddBlock = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newBlockUsername.trim().replace('@', '');
    if (!clean) return;

    if (blockedList.some((u) => u.username.toLowerCase() === clean.toLowerCase())) {
      alert('This user is already in your blocked list.');
      return;
    }

    const newUser: BlockedUserItem = {
      uid: `blocked_${Date.now()}`,
      username: clean,
      name: `@${clean}`,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(clean)}&background=ef4444&color=fff`,
      blockedAt: Date.now()
    };

    const updated = [newUser, ...blockedList];
    setBlockedList(updated);
    setNewBlockUsername('');
    if (currentUser) {
      localStorage.setItem(`ennvo_blocked_${currentUser.uid}`, JSON.stringify(updated));
    }
  };

  const filtered = blockedList.filter(
    (u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.18 }}
          className="bg-white rounded-3xl w-full max-w-md shadow-xl overflow-hidden border border-gray-100 flex flex-col max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
                <UserX className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-gray-900">Blocked Accounts</h3>
                <p className="text-[11px] text-gray-500 font-medium">Users you blocked cannot see or message you</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 border-b border-gray-100 space-y-3">
            {/* Quick add block form */}
            <form onSubmit={handleAddBlock} className="flex items-center space-x-2">
              <input
                type="text"
                value={newBlockUsername}
                onChange={(e) => setNewBlockUsername(e.target.value)}
                placeholder="Block by username (e.g. spammer_1)"
                className="flex-1 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-semibold focus:outline-none focus:border-red-500 focus:bg-white transition-all"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-2xl transition-all active:scale-95 shadow-xs"
              >
                Block
              </button>
            </form>

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search blocked list..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-medium focus:outline-none focus:border-gray-400 focus:bg-white"
              />
            </div>
          </div>

          {/* List */}
          <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
            {filtered.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <div className="w-12 h-12 mx-auto rounded-full bg-gray-100 text-gray-400 flex items-center justify-center">
                  <UserX className="w-6 h-6" />
                </div>
                <p className="text-xs text-gray-500 font-medium">No blocked accounts found</p>
              </div>
            ) : (
              filtered.map((user) => (
                <div
                  key={user.uid}
                  className="p-3 bg-gray-50/70 border border-gray-100 rounded-2xl flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-10 h-10 rounded-full object-cover border border-gray-200"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">{user.name}</h4>
                      <p className="text-[11px] text-gray-500 font-medium">@{user.username}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnblock(user.uid)}
                    className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-gray-700 text-xs font-bold rounded-xl transition-colors shadow-2xs"
                  >
                    Unblock
                  </button>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
