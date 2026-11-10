import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Check, X, Users, Loader2, Maximize2, Minimize2 } from 'lucide-react';
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
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsFullScreen(false);
      return;
    }

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'users'), limit(40));
        const snap = await getDocs(q);
        const users = snap.docs
          .map((d) => ({ uid: d.id, ...d.data() }))
          .filter((u: any) => u.uid !== currentUser?.uid);
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

  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 640;
  });

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleBack = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    window.addEventListener('appBackPress', handleBack);
    return () => window.removeEventListener('appBackPress', handleBack);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6">
        {/* Soft frosted glass backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-md"
        />

        {/* Modal Sheet - Perfectly Centered on PC, Smooth Slide Up on Mobile */}
        <motion.div
          initial={isDesktop ? { opacity: 0, scale: 0.95, y: 15 } : { y: '100%' }}
          animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
          exit={isDesktop ? { opacity: 0, scale: 0.95, y: 15 } : { y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 350, mass: 0.7 }}
          drag={isDesktop ? false : "y"}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.15, bottom: 0.4 }}
          onDragEnd={(_, info) => {
            if (isDesktop) return;
            if (info.offset.y < -50 || info.velocity.y < -300) {
              setIsFullScreen(true);
            } else if (info.offset.y > 90 || info.velocity.y > 350) {
              if (isFullScreen) {
                setIsFullScreen(false);
              } else {
                onClose();
              }
            }
          }}
          className={`w-full max-w-[540px] bg-white/95 dark:bg-neutral-950/95 backdrop-blur-2xl flex flex-col overflow-hidden relative shadow-2xl border-0 sm:border sm:border-black/10 sm:dark:border-white/10 z-10 sm:my-auto transition-[height,border-radius] duration-300 ease-out ${
            isFullScreen
              ? 'h-[100dvh] max-h-[100dvh] rounded-none sm:rounded-[32px] sm:h-[90vh]'
              : 'h-[82vh] sm:h-[620px] max-h-[90vh] sm:max-h-[85vh] rounded-t-[34px] sm:rounded-[32px]'
          }`}
        >
          {/* Top Ambient Blue Glow */}
          <div 
            className="pointer-events-none absolute top-0 left-0 right-0 h-44 bg-gradient-to-b from-sky-400/[0.16] via-blue-500/[0.06] to-transparent dark:from-blue-600/[0.22] dark:via-blue-800/[0.06] dark:to-transparent z-0" 
            aria-hidden="true" 
          />

          {/* Top Drag Handle Bar (Mobile Only) */}
          <div 
            onClick={() => setIsFullScreen(prev => !prev)}
            className="w-full pt-3 pb-1 flex sm:hidden items-center justify-center cursor-pointer select-none group"
            title={isFullScreen ? "Tap or drag down to shrink" : "Tap or drag up for full screen"}
          >
            <div className="w-12 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-700 group-hover:bg-neutral-400 dark:group-hover:bg-neutral-600 transition-colors" />
          </div>

          {/* Header */}
          <div className="relative z-10 px-5 pt-2 pb-3 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Users className="w-4.5 h-4.5" />
              </div>
              <div>
                <h2 className="text-[18px] font-bold text-neutral-900 dark:text-white tracking-tight">
                  Tag People
                </h2>
                <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                  Mention friends in your post ({taggedUsers.length} selected)
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1.5">
              {/* Fullscreen Expand/Collapse Button */}
              <button
                type="button"
                onClick={() => setIsFullScreen(prev => !prev)}
                className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-white/10 hover:bg-neutral-200 dark:hover:bg-white/15 flex items-center justify-center text-neutral-700 dark:text-neutral-200 cursor-pointer transition-all border-0 shadow-none"
                title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
              >
                {isFullScreen ? (
                  <Minimize2 className="w-4 h-4 stroke-[2.2]" />
                ) : (
                  <Maximize2 className="w-4 h-4 stroke-[2.2]" />
                )}
              </button>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-white/10 hover:bg-neutral-200 dark:hover:bg-white/15 flex items-center justify-center text-neutral-700 dark:text-neutral-200 cursor-pointer transition-all border-0 shadow-none"
                aria-label="Close"
              >
                <X className="w-4 h-4 stroke-[2.2]" />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative z-10 px-5 py-1">
            <div className="w-full bg-neutral-100/80 dark:bg-white/[0.06] rounded-full px-4 py-2.5 flex items-center space-x-2.5">
              <Search className="w-4 h-4 text-neutral-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search friends by name or username..."
                className="w-full bg-transparent border-0 text-[13.5px] text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-white p-0.5 cursor-pointer border-0 bg-transparent"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Selected Users Pill Tray */}
          {taggedUsers.length > 0 && (
            <div className="relative z-10 px-5 pt-3 pb-1 flex items-center space-x-2 overflow-x-auto no-scrollbar">
              {taggedUsers.map((u) => (
                <div
                  key={u.uid}
                  className="flex items-center space-x-1.5 pl-1.5 pr-2.5 py-1 rounded-full bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 text-xs font-semibold shrink-0"
                >
                  <img
                    src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`}
                    alt={u.name}
                    className="w-5 h-5 rounded-full object-cover"
                  />
                  <span className="truncate max-w-[100px]">{u.name}</span>
                  <button
                    type="button"
                    onClick={() => onToggleTagUser(u)}
                    className="p-0.5 hover:text-blue-800 dark:hover:text-white cursor-pointer border-0 bg-transparent"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Users List */}
          <div className="relative z-10 flex-1 overflow-y-auto px-5 py-2 space-y-1.5 no-scrollbar">
            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center text-neutral-400">
                <Loader2 className="w-6 h-6 animate-spin mb-2 text-blue-500" />
                <span className="text-xs">Loading people...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-16 text-center text-neutral-400">
                <Users className="w-10 h-10 mx-auto opacity-30 mb-2" />
                <p className="text-sm font-semibold">No people found</p>
                <p className="text-xs text-neutral-500 mt-0.5">Try searching with a different name</p>
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isTagged = taggedUsers.some((tu) => tu.uid === u.uid);
                return (
                  <button
                    key={u.uid}
                    type="button"
                    onClick={() =>
                      onToggleTagUser({
                        uid: u.uid,
                        name: u.name || 'User',
                        username: u.username || 'user',
                        avatar: u.avatar || '',
                      })
                    }
                    className={`w-full p-2.5 rounded-[22px] flex items-center justify-between text-left transition-all cursor-pointer border-0 ${
                      isTagged
                        ? 'bg-blue-500/10 dark:bg-blue-500/15 ring-2 ring-blue-500 text-neutral-900 dark:text-white'
                        : 'bg-neutral-100/60 dark:bg-white/[0.03] hover:bg-neutral-100 dark:hover:bg-white/[0.06] text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0 pr-2">
                      <img
                        src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'User')}&background=random`}
                        alt={u.name || 'User'}
                        className="w-10 h-10 rounded-full object-cover shrink-0 ring-1 ring-black/5 dark:ring-white/10"
                      />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center space-x-1">
                          <span className="text-[13.5px] font-bold text-neutral-900 dark:text-white truncate">
                            {u.name || 'User'}
                          </span>
                          {u.isVerified && <VerifiedBadge size="sm" />}
                        </div>
                        <span className="text-[11.5px] text-neutral-400 dark:text-neutral-500 truncate">
                          @{u.username || 'user'}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        isTagged
                          ? 'bg-blue-600 text-white'
                          : 'border-2 border-neutral-300 dark:border-white/20'
                      }`}
                    >
                      {isTagged && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Done button */}
          <div className="relative z-10 px-5 pt-2 pb-5 bg-white/50 dark:bg-neutral-950/50 backdrop-blur-md">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 rounded-full font-bold text-[14px] bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/25 transition-all cursor-pointer border-0 text-center"
            >
              Done ({taggedUsers.length} Tagged)
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
