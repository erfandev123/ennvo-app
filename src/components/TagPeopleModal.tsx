import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, AtSign, Check, X, Users, ArrowLeft } from 'lucide-react';
import { collection, query, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppStore } from '../store';
import { VerifiedBadge } from './VerifiedBadge';

interface TagPeopleModalProps {
  isOpen: boolean;
  onClose: () => void;
  taggedUsers: { uid: string; name: string; username: string; avatar: string }[];
  onToggleTagUser: (user: { uid: string; name: string; username: string; avatar: string }) => void;
}

export const TagPeopleModal: React.FC<TagPeopleModalProps> = ({
  isOpen,
  onClose,
  taggedUsers,
  onToggleTagUser,
}) => {
  const { currentUser } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'users'), limit(30));
        const snap = await getDocs(q);
        const users = snap.docs
          .map((d) => ({ uid: d.id, ...d.data() }))
          .filter((u) => u.uid !== currentUser?.uid);
        setUsersList(users);
      } catch (err) {
        console.error("Fetch users error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [isOpen, currentUser?.uid]);

  const filteredUsers = usersList.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="fixed inset-0 z-[200] bg-gray-950 md:bg-black/40 md:backdrop-blur-xl text-white flex flex-col items-center justify-center font-sans overflow-hidden md:p-6 md:pl-28"
      >
        {/* Full Screen Android on mobile, Soft Liquid Water Glass Container on PC */}
        <div 
          className="w-full h-full md:max-w-[720px] md:h-[660px] bg-gray-950 md:bg-zinc-950/85 md:backdrop-blur-2xl md:rounded-[32px] md:border md:border-white/15 flex flex-col overflow-hidden relative shadow-2xl"
          style={{
            boxShadow: '0 25px 60px -15px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.12) inset',
          }}
        >
          {/* Top Bar */}
          <div className="pt-10 sm:pt-4 px-4 md:px-6 pb-3 bg-gray-950 md:bg-zinc-900/40 border-b border-gray-800 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-all active:scale-90"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">Mention Friends</h2>
                <p className="text-xs text-gray-400 font-normal hidden md:block">Tag people to notify them on your post</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={onClose}
                className="text-xs font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-4 py-2 rounded-full border border-blue-500/20"
              >
                Done ({taggedUsers.length})
              </button>
              <button
                onClick={onClose}
                className="hidden md:flex p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="p-4 md:px-6 bg-gray-950 md:bg-transparent border-b border-gray-800/80">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
              <input
                type="text"
                placeholder="Search friends by name or @username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-10 py-3 bg-gray-900 md:bg-white/10 focus:bg-gray-850 md:focus:bg-white/15 rounded-2xl outline-none focus:ring-1 focus:ring-blue-500 transition-all font-normal text-sm text-white placeholder-gray-400 border border-gray-800 md:border-white/10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Users List */}
          <div className="flex-1 overflow-y-auto p-4 md:px-6 space-y-2.5 no-scrollbar">
            {loading ? (
              <div className="py-24 text-center space-y-2">
                <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-gray-400 text-xs">Loading friends list...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-24 text-center space-y-2">
                <Users className="w-10 h-10 text-gray-600 mx-auto opacity-50" />
                <p className="text-gray-400 text-sm font-medium">No accounts found</p>
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isTagged = taggedUsers.some((u) => u.uid === user.uid);
                return (
                  <div
                    key={user.uid}
                    onClick={() =>
                      onToggleTagUser({
                        uid: user.uid,
                        name: user.name || 'User',
                        username: user.username || 'user',
                        avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random`,
                      })
                    }
                    className={`flex items-center justify-between p-3.5 rounded-2xl transition-all cursor-pointer border ${
                      isTagged
                        ? 'bg-blue-950/40 border-blue-500/50 shadow-md'
                        : 'bg-gray-900/60 md:bg-white/5 hover:bg-gray-850 md:hover:bg-white/10 border-gray-800 md:border-white/10'
                    }`}
                  >
                    <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                      <img
                        src={
                          user.avatar ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random`
                        }
                        alt={user.name}
                        className="w-12 h-12 rounded-full object-cover border border-white/10 shrink-0"
                      />
                      <div className="min-w-0 text-left">
                        <div className="flex items-center space-x-1">
                          <h4 className={`font-semibold text-sm truncate ${isTagged ? 'text-blue-400 font-bold' : 'text-white'}`}>
                            {user.name}
                          </h4>
                          {user.isVerified && <VerifiedBadge />}
                        </div>
                        <p className="text-blue-400 font-medium text-xs truncate">
                          @{user.username || 'user'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center space-x-1 shrink-0 ${
                        isTagged
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-white/10 hover:bg-white/20 text-white'
                      }`}
                    >
                      {isTagged ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Mentioned</span>
                        </>
                      ) : (
                        <span>Mention</span>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
