import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, VolumeX, Play, X, ArrowLeft, ChevronUp, ChevronDown, Share2, Share, SendHorizontal, Trash2, UserPlus, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store';
import { subscribeReels, toggleLike, toggleFavorite, incrementViewCount, addComment, getComments, toggleCommentLike } from '../services/postService';
import { Post, Comment } from '../types';
import { followUser, unfollowUser, isFollowing, getFollowing } from '../services/followService';
import { sendNotification } from '../services/notificationService';
import { sendMessage, subscribeConversations } from '../services/chatService';

import { ReelItem } from '../components/ReelItem';

export default function Reels() {
  const { pushPage, currentUser, cachedReels, setCachedReels, isReelsCleanZoom } = useAppStore();
  const [reels, setReels] = useState<Post[]>(cachedReels && cachedReels.length > 0 ? cachedReels : []);
  const [loading, setLoading] = useState(reels.length === 0);
  const [activeTab, setActiveTab] = useState<'forYou' | 'following'>('forYou');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const CATEGORIES = ['All', 'Music', 'Gaming', 'Comedy', 'Tech', 'Lifestyle', 'Trending'];
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(5);
  const reelsContainerRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    // Re-attach keyboard listener logic strictly for reels container
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
    
    // Set scroll position to top initially when component mounts
    if (reelsContainerRef.current) {
       reelsContainerRef.current.scrollTop = 0;
    }
    
    const handleRefresh = () => {
      if (reelsContainerRef.current) {
        reelsContainerRef.current.scrollTop = 0;
      }
      setVisibleCount(5);
      setLoading(true);
      setTimeout(() => {
        setReels(prev => [...prev].sort(() => Math.random() - 0.5));
        setLoading(false);
      }, 250);
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
    };
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 800) {
      setVisibleCount(prev => prev + 5);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = subscribeReels((fetchedReels) => {
      setCachedReels(fetchedReels.slice(0, 30));
      setReels(prev => {
        if (!initialLoadDone.current && prev.length === 0) {
          const shuffled = [...fetchedReels].sort(() => Math.random() - 0.5);
          initialLoadDone.current = true;
          setTimeout(() => {
             if (reelsContainerRef.current) reelsContainerRef.current.scrollTop = 0;
          }, 50);
          return shuffled;
        } else if (prev.length === 0) {
          return fetchedReels;
        } else {
          // If already loaded from cache or state, merge new items
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
    // Hide private reels from the global reels feed (visible only in author's profile private section)
    let list = reels.filter(r => r.privacy !== 'private' && !(r as any).isPrivate);

    if (activeTab === 'following') {
      list = list.filter(r => followingIds.has(r.authorId));
    } else {
      // TikTok-like AI Recommendation Algorithm
      try {
        const categoryWeights = JSON.parse(localStorage.getItem('reel_category_weights') || '{}');
        list.sort((a, b) => {
          const getCat = (r: Post) => {
            if (r.category) return r.category;
            const txt = (r.text || '').toLowerCase();
            if (txt.includes('music') || txt.includes('song')) return 'Music';
            if (txt.includes('funny') || txt.includes('comedy') || txt.includes('lol')) return 'Comedy';
            if (txt.includes('gaming') || txt.includes('game')) return 'Gaming';
            if (txt.includes('tech') || txt.includes('code') || txt.includes('ai')) return 'Tech';
            if (txt.includes('life') || txt.includes('vlog')) return 'Lifestyle';
            return 'Trending';
          };

          const catA = getCat(a);
          const catB = getCat(b);

          const scoreA = (categoryWeights[catA] || 0) * 15 + (a.likesCount || 0) * 0.2 + (a.viewsCount || 0) * 0.05;
          const scoreB = (categoryWeights[catB] || 0) * 15 + (b.likesCount || 0) * 0.2 + (b.viewsCount || 0) * 0.05;

          return scoreB - scoreA;
        });
      } catch (e) {}
    }

    if (selectedCategory !== 'All') {
      list = list.filter(r => {
        const txt = (r.text || '').toLowerCase();
        const cat = r.category || (txt.includes('music') ? 'Music' : txt.includes('funny') ? 'Comedy' : txt.includes('game') ? 'Gaming' : txt.includes('tech') ? 'Tech' : txt.includes('life') ? 'Lifestyle' : 'Trending');
        return cat.toLowerCase() === selectedCategory.toLowerCase();
      });
    }

    return list;
  }, [reels, activeTab, followingIds, selectedCategory]);

  // Extract next 3 video URLs to preload in background for zero lag playback
  const preloadVideoUrls = useMemo(() => {
    return filteredReels
      .slice(1, 6)
      .map(r => r.media?.[0])
      .filter((url): url is string => !!url && (url.includes('.mp4') || url.includes('video') || url.includes('github')));
  }, [filteredReels]);

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
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
        className="h-full w-full overflow-y-auto snap-y snap-mandatory no-scrollbar overscroll-y-contain transform-gpu will-change-scroll bg-black md:bg-[#f8f9fa]"
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
            <ReelItem key={reel.id} reel={reel} />
          ))
        )}
      </div>

      {/* Background Video Preloader for Ultra-Fast Zero-Lag Scrolling */}
      <div className="hidden" aria-hidden="true">
        {preloadVideoUrls.map((url, i) => (
          <video key={i} src={`${url}#t=0.001`} preload="auto" muted playsInline />
        ))}
      </div>
    </div>
  );
}
