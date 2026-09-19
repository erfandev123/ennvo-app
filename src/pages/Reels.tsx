import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Play, UserPlus, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppStore } from '../store';
import { subscribeReels } from '../services/postService';
import { Post } from '../types';
import { getFollowing } from '../services/followService';
import { ReelItem } from '../components/ReelItem';
import { FacebookReelSkeleton } from '../components/Skeletons';

const SEEN_REELS_STORAGE_KEY = 'ennvo_seen_reels_v2';

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
  const { pushPage, currentUser, cachedReels, setCachedReels, isReelsCleanZoom } = useAppStore();
  const [reels, setReels] = useState<Post[]>(cachedReels && cachedReels.length > 0 ? cachedReels : []);
  const [loading, setLoading] = useState(reels.length === 0);
  const [activeTab, setActiveTab] = useState<'forYou' | 'following'>('forYou');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(6);
  const [seenIds, setSeenIds] = useState<Set<string>>(getSeenReelIds);
  const reelsContainerRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);
  const activeReelTimerRef = useRef<any>(null);

  useEffect(() => {
    // Keyboard listener for desktop arrow keys
    const handleKeyDown = (e: KeyboardEvent) => {
      const c = reelsContainerRef.current;
      if (!c) return;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        c.scrollBy({ top: -window.innerHeight, behavior: 'smooth' });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        c.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
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

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('refreshReels', handleRefresh);
    
    const handlePrivacyUpdate = (e: any) => {
      const { id, privacy, isPrivate } = e.detail || {};
      if (id) {
        setReels(prev => prev.map(r => r.id === id ? { ...r, privacy, isPrivate } : r));
      }
    };
    window.addEventListener('reelPrivacyUpdated', handlePrivacyUpdate);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('refreshReels', handleRefresh);
      window.removeEventListener('reelPrivacyUpdated', handlePrivacyUpdate);
      if (activeReelTimerRef.current) clearTimeout(activeReelTimerRef.current);
    };
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
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
    
    getFollowing(currentUser.uid).then(following => {
      setFollowingIds(new Set(following.map(f => f.uid)));
    });

    return () => unsubscribe();
  }, [currentUser, setCachedReels]);

  const filteredReels = useMemo(() => {
    let list = reels.filter(r => r.privacy !== 'private' && !(r as any).isPrivate);

    if (activeTab === 'following') {
      list = list.filter(r => followingIds.has(r.authorId));
    } else {
      // Smart Random + Viral Recommendation Algorithm with Seen-Deduplication
      const currentSeen = seenIds;
      list.sort((a, b) => {
        const isSeenA = currentSeen.has(a.id);
        const isSeenB = currentSeen.has(b.id);

        const viralA = ((a.likesCount || 0) * 1.5) + ((a.commentsCount || 0) * 3) + ((a.viewsCount || 0) * 0.1);
        const viralB = ((b.likesCount || 0) * 1.5) + ((b.commentsCount || 0) * 3) + ((b.viewsCount || 0) * 0.1);

        // Heavy penalty if already seen so the user always sees fresh viral videos
        const scoreA = (isSeenA ? 0 : 500) + viralA + ((a.id.charCodeAt(0) % 30));
        const scoreB = (isSeenB ? 0 : 500) + viralB + ((b.id.charCodeAt(0) % 30));

        return scoreB - scoreA;
      });
    }

    if (selectedCategory !== 'All') {
      list = list.filter(r => {
        const txt = (r.text || '').toLowerCase();
        const cat = r.category || (txt.includes('music') ? 'Music' : txt.includes('funny') ? 'Comedy' : txt.includes('game') ? 'Gaming' : txt.includes('tech') ? 'Tech' : txt.includes('life') ? 'Lifestyle' : 'Trending');
        return cat.toLowerCase() === selectedCategory.toLowerCase();
      });
    }

    return list;
  }, [reels, activeTab, followingIds, selectedCategory, seenIds]);

  // Preload top 2 adjacent videos
  const preloadVideoUrls = useMemo(() => {
    return filteredReels
      .slice(1, 4)
      .map(r => r.media?.[0])
      .filter((url): url is string => !!url && (url.includes('.mp4') || url.includes('video') || url.includes('github') || url.includes('blob')));
  }, [filteredReels]);

  if (reels.length === 0 && loading) {
    return <FacebookReelSkeleton />;
  }

  if (reels.length === 0 && !loading) {
    return (
      <div className="h-full w-full bg-white flex flex-col items-center justify-center text-gray-900 p-4">
        <Play className="w-16 h-16 mb-4 text-gray-300" />
        <h2 className="text-xl font-normal mb-2">No reels yet</h2>
        <p className="text-gray-500 text-center mb-6">Be the first to share a reel!</p>
        <button 
          onClick={() => pushPage('create')}
          className="bg-blue-500 hover:bg-blue-600 text-white font-normal px-8 py-3 rounded-full transition-all active:scale-95 shadow-lg shadow-blue-100"
        >
          Create Reel
        </button>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-black md:bg-[#f8f9fa] overflow-hidden relative">
      {/* Feed Tabs Overlay */}
      <div className={`absolute top-8 md:top-4 left-0 right-0 md:left-28 md:right-auto z-40 flex justify-center md:justify-start pointer-events-none transition-opacity duration-300 ${isReelsCleanZoom ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="flex items-center space-x-5 px-5 py-1.5 pointer-events-auto">
          <button 
            onClick={() => setActiveTab('following')}
            className={`text-[13px] font-medium tracking-wide drop-shadow-md transition-all ${activeTab === 'following' ? 'text-white md:text-black scale-105' : 'text-white/70 md:text-black/60 hover:text-white md:hover:text-black'}`}
          >
            Following
            {activeTab === 'following' && <motion.div layoutId="reel-tab" className="h-0.5 bg-white md:bg-black rounded-full mt-0.5" />}
          </button>
          <button 
            onClick={() => setActiveTab('forYou')}
            className={`text-[13px] font-medium tracking-wide drop-shadow-md transition-all ${activeTab === 'forYou' ? 'text-white md:text-black scale-105' : 'text-white/70 md:text-black/60 hover:text-white md:hover:text-black'}`}
          >
            For You
            {activeTab === 'forYou' && <motion.div layoutId="reel-tab" className="h-0.5 bg-white md:bg-black rounded-full mt-0.5" />}
          </button>
        </div>
      </div>

      {/* Top Right Search Button */}
      <div className={`absolute top-8 md:top-4 right-4 z-40 transition-opacity duration-300 ${isReelsCleanZoom ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}>
        <button 
          onClick={() => pushPage('search')}
          className="p-2 text-white md:text-gray-800 hover:opacity-80 transition-all active:scale-95 drop-shadow-md flex items-center justify-center"
          title="Search"
        >
          <Search className="w-5.5 h-5.5 text-white md:text-gray-800 stroke-[2.2]" />
        </button>
      </div>

      <div 
        id="global-reels-container"
        ref={reelsContainerRef}
        onScroll={handleScroll}
        className="h-full w-full overflow-y-auto reels-scroll-viewport no-scrollbar bg-black md:bg-[#f8f9fa]"
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
            <div key={reel.id} className="reel-snap-item w-full h-full">
              <ReelItem reel={reel} />
            </div>
          ))
        )}
      </div>

      {/* Background Video Preloader for Fast Scrolling */}
      <div className="hidden" aria-hidden="true">
        {preloadVideoUrls.slice(0, 2).map((url, i) => (
          <video key={i} src={`${url}#t=0.001`} preload="metadata" muted playsInline />
        ))}
      </div>
    </div>
  );
}
