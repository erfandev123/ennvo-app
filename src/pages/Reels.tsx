import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Play, UserPlus, Search, ChevronUp, ChevronDown, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store';
import { subscribeReels } from '../services/postService';
import { Post } from '../types';
import { ReelItem } from '../components/ReelItem';
import { FacebookReelSkeleton } from '../components/Skeletons';

const SEEN_REELS_STORAGE_KEY = 'ennvo_seen_reels_v2';
const NOT_INTERESTED_STORAGE_KEY = 'ennvo_not_interested_reels';

const getSeenReelIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(SEEN_REELS_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (e) {
    return new Set();
  }
};

const getNotInterestedIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(NOT_INTERESTED_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (e) {
    return new Set();
  }
};

const markReelAsSeen = (reelId: string) => {
  try {
    const current = getSeenReelIds();
    current.add(reelId);
    // Keep max 250 most recent seen IDs to avoid unbounded storage
    const arr = Array.from(current).slice(-250);
    localStorage.setItem(SEEN_REELS_STORAGE_KEY, JSON.stringify(arr));
  } catch (e) {}
};

export default function Reels() {
  const { pushPage, currentUser, cachedReels, setCachedReels, isReelsCleanZoom, newUserWelcomeName, setNewUserWelcomeName, followingIds } = useAppStore();
  const [reels, setReels] = useState<Post[]>(() => {
    if (cachedReels && cachedReels.length > 0) return cachedReels;
    try {
      const local = localStorage.getItem('cached_reels');
      if (local) return JSON.parse(local);
    } catch (e) {}
    return [];
  });
  const [loading, setLoading] = useState(reels.length === 0);
  const [activeTab, setActiveTab] = useState<'forYou' | 'following'>('forYou');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const followingSet = useMemo(() => new Set(followingIds || []), [followingIds]);
  const [visibleCount, setVisibleCount] = useState(6);
  // Each mounted reel owns a <video>. Keeping that list bounded is what keeps
  // scrolling smooth after the user has watched dozens of reels.
  const MAX_MOUNTED_REELS = 24;
  const [seenIds, setSeenIds] = useState<Set<string>>(getSeenReelIds);
  const reelsContainerRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);
  const activeReelTimerRef = useRef<any>(null);
  const scrollTickingRef = useRef(false);

  // New user welcome overlay state
  const [welcomeName, setWelcomeName] = useState<string | null>(() => {
    return newUserWelcomeName || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('ennvo_new_user_welcome') : null);
  });
  const [showWelcomeGreeting, setShowWelcomeGreeting] = useState<boolean>(() => !!welcomeName);

  useEffect(() => {
    if (newUserWelcomeName && !welcomeName) {
      setWelcomeName(newUserWelcomeName);
      setShowWelcomeGreeting(true);
    }
  }, [newUserWelcomeName, welcomeName]);

  const handleDismissWelcome = useCallback(() => {
    setShowWelcomeGreeting(false);
    setNewUserWelcomeName(null);
    try {
      sessionStorage.removeItem('ennvo_new_user_welcome');
    } catch (e) {}
  }, [setNewUserWelcomeName]);

  // Smooth auto-dismiss after 4.2 seconds
  useEffect(() => {
    if (showWelcomeGreeting) {
      const timer = setTimeout(() => {
        handleDismissWelcome();
      }, 4200);
      return () => clearTimeout(timer);
    }
  }, [showWelcomeGreeting, handleDismissWelcome]);

  const handlePrevReel = useCallback(() => {
    const c = reelsContainerRef.current;
    if (!c) return;
    const h = c.clientHeight || window.innerHeight;
    c.scrollBy({ top: -h });
  }, []);

  const handleNextReel = useCallback(() => {
    const c = reelsContainerRef.current;
    if (!c) return;
    const h = c.clientHeight || window.innerHeight;
    c.scrollBy({ top: h });
  }, []);

  useEffect(() => {
    // Keyboard listener for desktop arrow keys
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrevReel();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNextReel();
      }
    };
    
    // Refresh reels and rotate seen pool
    const handleRefresh = () => {
      if (reelsContainerRef.current) {
        reelsContainerRef.current.scrollTop = 0;
      }
      setVisibleCount(5);
      setLoading(true);
      setTimeout(() => {
        setSeenIds(getSeenReelIds());
        setReels(prev => [...prev].sort(() => Math.random() - 0.5));
        setLoading(false);
      }, 200);
    };

    const handlePrivacyUpdate = (e: any) => {
      const { id, privacy, isPrivate } = e.detail || {};
      if (id) {
        setReels(prev => prev.map(r => r.id === id ? { ...r, privacy, isPrivate } : r));
      }
    };

    const handleNotInterested = (e: any) => {
      const { id } = e.detail || {};
      if (id) {
        setReels(prev => prev.filter(r => r.id !== id));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('refreshReels', handleRefresh);
    window.addEventListener('reelPrivacyUpdated', handlePrivacyUpdate);
    window.addEventListener('reelNotInterested', handleNotInterested);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('refreshReels', handleRefresh);
      window.removeEventListener('reelPrivacyUpdated', handlePrivacyUpdate);
      window.removeEventListener('reelNotInterested', handleNotInterested);
      if (activeReelTimerRef.current) clearTimeout(activeReelTimerRef.current);
    };
  }, [handlePrevReel, handleNextReel]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const currentTarget = e.currentTarget;
    if (!scrollTickingRef.current) {
      scrollTickingRef.current = true;
      requestAnimationFrame(() => {
        scrollTickingRef.current = false;
        const { scrollTop, scrollHeight, clientHeight } = currentTarget;
        if (scrollTop + clientHeight >= scrollHeight - 1200) {
          setVisibleCount(prev => prev + 5);
        }

        // Determine current index to mark reel as seen after 2.5 seconds of viewing
        if (clientHeight > 0) {
          const activeIdx = Math.round(scrollTop / clientHeight);
          if (activeReelTimerRef.current) clearTimeout(activeReelTimerRef.current);
          activeReelTimerRef.current = setTimeout(() => {
            const activeReel = reels[activeIdx];
            if (activeReel?.id) {
              markReelAsSeen(activeReel.id);
            }
          }, 2500);
        }
      });
    }
  }, [reels]);

  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = subscribeReels((fetchedReels) => {
      setCachedReels(fetchedReels.slice(0, 30));
      setReels(prev => {
        if (!initialLoadDone.current && prev.length === 0) {
          initialLoadDone.current = true;
          return fetchedReels;
        } else if (prev.length === 0) {
          return fetchedReels;
        } else {
          const prevMap = new Map(prev.map(r => [r.id, true]));
          const newReels = fetchedReels.filter(r => !prevMap.has(r.id));
          const updatedPrev = prev.map(r => fetchedReels.find(f => f.id === r.id) || r).filter(r => fetchedReels.some(f => f.id === r.id));
          return [...newReels, ...updatedPrev];
        }
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, setCachedReels]);

  const filteredReels = useMemo(() => {
    const notInterested = getNotInterestedIds();
    // 1. Filter out private and not-interested items
    let rawList = reels.filter(r => r.privacy !== 'private' && !(r as any).isPrivate && !notInterested.has(r.id));

    // 2. Strict ID Deduplication: Never allow duplicate reel videos in the feed
    const dedupeMap = new Map<string, typeof reels[0]>();
    rawList.forEach(item => {
      if (!dedupeMap.has(item.id)) {
        dedupeMap.set(item.id, item);
      }
    });
    let list = Array.from(dedupeMap.values());

    if (activeTab === 'following') {
      list = list.filter(r => followingSet.has(r.authorId));
    }

    // 3. Smart Algorithm: Promoted items at Top (#1), followed by Fresh & Viral
    const currentSeen = seenIds;
    list.sort((a, b) => {
      const isPromotedA = !!(a.isPromoted || (a as any).promoted);
      const isPromotedB = !!(b.isPromoted || (b as any).promoted);
      if (isPromotedA && !isPromotedB) return -1;
      if (!isPromotedA && isPromotedB) return 1;

      const isSeenA = currentSeen.has(a.id);
      const isSeenB = currentSeen.has(b.id);

      const viralA = ((a.likesCount || 0) * 1.5) + ((a.commentsCount || 0) * 3) + ((a.viewsCount || 0) * 0.1);
      const viralB = ((b.likesCount || 0) * 1.5) + ((b.commentsCount || 0) * 3) + ((b.viewsCount || 0) * 0.1);

      // Heavy penalty if already seen so the user always sees fresh viral videos
      const scoreA = (isSeenA ? 0 : 500) + viralA + ((a.id.charCodeAt(0) % 30));
      const scoreB = (isSeenB ? 0 : 500) + viralB + ((b.id.charCodeAt(0) % 30));

      return scoreB - scoreA;
    });

    if (selectedCategory !== 'All') {
      list = list.filter(r => {
        const txt = (r.text || '').toLowerCase();
        const cat = r.category || (txt.includes('music') ? 'Music' : txt.includes('funny') ? 'Comedy' : txt.includes('game') ? 'Gaming' : txt.includes('tech') ? 'Tech' : txt.includes('life') ? 'Lifestyle' : 'Trending');
        return cat.toLowerCase() === selectedCategory.toLowerCase();
      });
    }

    return list;
  }, [reels, activeTab, followingSet, selectedCategory, seenIds]);


  if (reels.length === 0 && !loading) {
    return (
      <div className="h-full w-full bg-white flex flex-col items-center justify-center text-gray-900 p-4">
        <Play className="w-16 h-16 mb-4 text-gray-300" />
        <h2 className="text-xl font-normal mb-2">No reels yet</h2>
        <p className="text-gray-500 text-center mb-6">Be the first to share a reel!</p>
        <button 
          onClick={() => pushPage('create')}
          className="bg-blue-500 hover:bg-blue-600 text-white font-normal px-8 py-3 rounded-full transition-all shadow-lg shadow-blue-100"
        >
          Create Reel
        </button>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-black md:bg-white dark:md:bg-[#08080a] overflow-hidden relative antialiased">
      {/* New User Welcome Message on Reels (Sleek, Non-Bold, Smooth, No Lag) */}
      <AnimatePresence>
        {showWelcomeGreeting && welcomeName && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute inset-0 z-[60] flex flex-col items-center justify-center p-5 text-center bg-black/85 backdrop-blur-sm transform-gpu select-none"
          >
            {/* Soft Ambient Light (Static GPU layer, 0 lag) */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-40 transform-gpu"
              style={{
                background: 'radial-gradient(circle at 50% 40%, rgba(56, 189, 248, 0.25) 0%, rgba(139, 92, 246, 0.15) 45%, transparent 70%)'
              }}
            />

            {/* Fresh, Rounded Soft Card */}
            <motion.div
              initial={{ scale: 0.92, y: 12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 26, stiffness: 340 }}
              className="relative z-10 max-w-[340px] sm:max-w-[380px] w-full p-6 sm:p-7 rounded-[32px] bg-[#0b101e]/90 border border-white/15 shadow-[0_25px_60px_rgba(0,0,0,0.6)] flex flex-col items-center text-center space-y-4.5 transform-gpu"
            >
              {/* App Icon Container */}
              <div className="relative">
                <div className="w-19 h-19 rounded-full bg-gradient-to-tr from-sky-400 via-indigo-500 to-pink-500 p-[1.5px] shadow-[0_8px_25px_rgba(56,189,248,0.35)]">
                  <div className="w-full h-full bg-[#0a0f1d] rounded-full flex items-center justify-center overflow-hidden">
                    <img src="/icon-192.png?v=5" alt="Ennvo" className="w-13 h-13 rounded-full object-cover" />
                  </div>
                </div>
                <div className="absolute -top-1 -right-1 text-amber-300">
                  <Sparkles className="w-5 h-5 fill-amber-300" />
                </div>
              </div>

              {/* Text Greeting */}
              <div className="space-y-1.5 w-full">
                <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-400/25 text-sky-300 text-xs font-normal">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
                  <span>Welcome to Ennvo Community</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-normal text-white tracking-tight">
                  Hi, <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-teal-300 to-pink-400 font-medium">{welcomeName}!</span>
                </h2>
                <p className="text-xs sm:text-[13px] text-gray-300 font-normal leading-relaxed max-w-xs mx-auto">
                  Your account is live! Swipe up anytime to explore viral reels, share your thoughts, and connect with friends.
                </p>
              </div>

              {/* Fresh Feature Badges */}
              <div className="flex items-center justify-center gap-2 pt-1 pb-1 flex-wrap">
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 font-normal">
                  🎬 HD Reels
                </span>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 font-normal">
                  ⚡ Instant Chat
                </span>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 font-normal">
                  📞 HD Calls
                </span>
              </div>

              {/* Start Watching Reels Button */}
              <button
                type="button"
                onClick={handleDismissWelcome}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-medium text-sm shadow-[0_10px_25px_rgba(56,189,248,0.35)] flex items-center justify-center space-x-2 cursor-pointer transition-all"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Start Watching Reels</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Top Navigation Tabs: "Following" & "For You" - Extremely close together, NO vertical line divider, Spring animation */}
      <div 
        className={`absolute top-0 left-0 right-0 z-40 flex items-center justify-center pt-[max(calc(env(safe-area-inset-top,0px)+10px),14px)] pb-2 select-none pointer-events-none transition-opacity duration-200 lg:hidden ${
          isReelsCleanZoom ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <div className="flex items-center space-x-1 pointer-events-auto select-none">
          <motion.button
            type="button"
            onClick={() => setActiveTab('following')}
            animate={{ 
              scale: activeTab === 'following' ? 1.05 : 0.85, 
              y: activeTab === 'following' ? 0 : 3,
              opacity: activeTab === 'following' ? 1 : 0.55
            }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            className="px-1 py-0.5 text-[13.5px] font-bold text-white relative flex flex-col items-center cursor-pointer select-none"
          >
            <span>Following</span>
            {activeTab === 'following' && (
              <motion.span 
                layoutId="reelsActiveTabIndicator"
                className="w-4 h-[2.5px] bg-white rounded-full mt-0.5 shadow-xs" 
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </motion.button>

          <motion.button
            type="button"
            onClick={() => setActiveTab('forYou')}
            animate={{ 
              scale: activeTab === 'forYou' ? 1.05 : 0.85, 
              y: activeTab === 'forYou' ? 0 : 3,
              opacity: activeTab === 'forYou' ? 1 : 0.55
            }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            className="px-1 py-0.5 text-[13.5px] font-bold text-white relative flex flex-col items-center cursor-pointer select-none"
          >
            <span>For You</span>
            {activeTab === 'forYou' && (
              <motion.span 
                layoutId="reelsActiveTabIndicator"
                className="w-4 h-[2.5px] bg-white rounded-full mt-0.5 shadow-xs" 
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </motion.button>
        </div>
      </div>

      {/* Top Right Search Button */}
      <div className={`absolute top-[max(calc(env(safe-area-inset-top,0px)+10px),16px)] right-4 md:right-8 z-40 transition-opacity duration-300 ${isReelsCleanZoom ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}>
        <button 
          onClick={() => pushPage('search')}
          className="p-2 text-white md:text-gray-800 dark:md:text-white hover:opacity-80 transition-all drop-shadow-sm flex items-center justify-center cursor-pointer"
          title="Search"
        >
          <Search className="w-5 h-5 text-white md:text-gray-800 dark:md:text-white stroke-[2.2]" />
        </button>
      </div>

      {/* PC Only Clean 2D Up/Down Navigation Floating Controller (Lag-Free, No Black Glow) */}
      <div className={`hidden md:flex flex-col items-center fixed right-4 lg:right-7 top-1/2 -translate-y-1/2 z-50 reels-pc-glass-nav p-1 rounded-full select-none shadow-sm pointer-events-auto transition-opacity duration-200 ${isReelsCleanZoom ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <button 
          type="button"
          onClick={handlePrevReel}
          title="Previous Reel (Arrow Up)"
          aria-label="Previous Reel"
          className="w-9.5 h-9.5 rounded-full flex items-center justify-center text-gray-800 dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer"
        >
          <ChevronUp className="w-5 h-5 stroke-[2.2]" />
        </button>
        <div className="w-4 h-[1px] bg-black/10 dark:bg-white/10 my-0.5" />
        <button 
          type="button"
          onClick={handleNextReel}
          title="Next Reel (Arrow Down)"
          aria-label="Next Reel"
          className="w-9.5 h-9.5 rounded-full flex items-center justify-center text-gray-800 dark:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer"
        >
          <ChevronDown className="w-5 h-5 stroke-[2.2]" />
        </button>
      </div>

      <div 
        id="global-reels-container"
        ref={reelsContainerRef}
        onScroll={handleScroll}
        className="h-full w-full overflow-y-auto reels-scroll-viewport no-scrollbar bg-black md:bg-white dark:md:bg-[#08080a] transform-gpu will-change-transform overscroll-y-contain select-none"
        style={{ 
          scrollSnapType: 'y mandatory', 
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y'
        }}
      >
        {filteredReels.length === 0 && activeTab === 'following' ? (
          <div className="h-full w-full flex flex-col items-center justify-center bg-black text-white p-6 text-center">
            <UserPlus className="w-16 h-16 mb-4 opacity-50" />
            <h2 className="text-xl font-normal mb-2">No following reels</h2>
            <p className="opacity-60 mb-6">Follow some creators to see their content here!</p>
            <button onClick={() => setActiveTab('forYou')} className="bg-white text-black px-8 py-2.5 rounded-full font-normal">Discover Creators</button>
          </div>
        ) : (
          filteredReels.slice(0, visibleCount).map((reel) => (
            <div
              key={reel.id}
              className="reel-snap-item w-full h-full shrink-0 reel-cv"
              style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
            >
              <ReelItem reel={reel} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
