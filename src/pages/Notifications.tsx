import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { 
  Heart, 
  MessageCircle, 
  UserPlus, 
  AtSign, 
  Bookmark, 
  Sparkles,
  Play,
  Sun,
  Moon,
  Users,
  Bell
} from 'lucide-react';
import { useAppStore } from '../store';
import { subscribeNotifications, markAllRead } from '../services/notificationService';
import { followUser, unfollowUser } from '../services/followService';
import { Notification } from '../types';
import { formatTime } from '../utils';
import { collection, query, orderBy, onSnapshot, doc, getDoc, limit } from 'firebase/firestore';
import { db } from '../firebase';

// Light haptic feedback helper
const triggerHaptic = (ms = 12) => {
  if (typeof window !== 'undefined' && window.navigator?.vibrate) {
    try {
      window.navigator.vibrate(ms);
    } catch (_) {}
  }
};

interface FollowerUser {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
  createdAt?: any;
}

// Micro Badge icon matching user HTML
const getMicroBadge = (type: string) => {
  switch (type) {
    case 'like':
    case 'comment_like':
      return <div className="act-badge-icon act-badge-like">❤</div>;
    case 'comment':
    case 'reply':
      return <div className="act-badge-icon act-badge-comment">💬</div>;
    case 'repost':
      return <div className="act-badge-icon bg-[#007aff] text-white flex items-center justify-center text-[10px]">🔁</div>;
    case 'favorite':
      return <div className="act-badge-icon bg-[#ff9500] text-white flex items-center justify-center text-[10px]">★</div>;
    case 'mention':
      return <div className="act-badge-icon act-badge-mention">✦</div>;
    case 'follow':
      return <div className="act-badge-icon act-badge-follow">👤</div>;
    default:
      return <div className="act-badge-icon act-badge-mention">✦</div>;
  }
};

// Activity Card Component with Squircle styling & tap feedback
const ActivityCard = React.memo(({ 
  notif, 
  index, 
  isTopItem = false 
}: { 
  notif: Notification; 
  index: number;
  isTopItem?: boolean;
}) => {
  const { 
    setViewingUser, 
    pushPage, 
    setViewingReel, 
    currentUser, 
    setHighlightedCommentId, 
    setHighlightedPostId,
    followingIds,
    followerIds,
    setFollowingIds
  } = useAppStore();

  const [loading, setLoading] = useState(false);

  const isFollowing = (followingIds || []).includes(notif.actorId);
  const isFollower = (followerIds || []).includes(notif.actorId) || notif.type === 'follow';
  const isFriend = isFollowing && isFollower;

  const handleActorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic(8);
    setViewingUser({ uid: notif.actorId, name: notif.actorName, avatar: notif.actorAvatar });
    pushPage('profile');
  };

  const handleCardClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic(10);
    if (notif.postId) {
      if (['comment', 'reply', 'like', 'comment_like', 'mention', 'repost', 'favorite'].includes(notif.type)) {
        setHighlightedCommentId(notif.targetId);
        setHighlightedPostId(notif.postId);
      }
      
      try {
        const { getPost } = await import('../services/postService');
        const post = await getPost(notif.postId);
        if (post) {
          setViewingReel({ ...post, single: true });
        } else if (notif.postMedia) {
          const isVideo = notif.postMedia.includes('.mp4') || notif.postMedia.includes('video');
          setViewingReel({ 
            id: notif.postId, 
            authorId: notif.postAuthorId || '', 
            authorName: notif.postAuthorName || notif.actorName, 
            authorAvatar: notif.postAuthorAvatar || notif.actorAvatar, 
            media: [notif.postMedia], 
            text: notif.content || '', 
            type: isVideo ? 'reel' : 'post', 
            single: true 
          });
        }
      } catch (err) {
        console.warn("Failed to load post for notification", err);
      }
    } else {
      handleActorClick(e);
    }
  };

  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || loading) return;
    triggerHaptic(20);
    setLoading(true);

    const prevFollowing = [...(followingIds || [])];
    const willFollow = !isFollowing;

    // Instant optimistic update
    if (willFollow) {
      setFollowingIds([...prevFollowing, notif.actorId]);
    } else {
      setFollowingIds(prevFollowing.filter(id => id !== notif.actorId));
    }

    try {
      if (willFollow) {
        await followUser(currentUser, { 
          uid: notif.actorId, 
          name: notif.actorName, 
          avatar: notif.actorAvatar 
        });
      } else {
        await unfollowUser(currentUser.uid, notif.actorId);
      }
    } catch (error) {
      console.error(error);
      setFollowingIds(prevFollowing);
    } finally {
      setLoading(false);
    }
  };

  const isVideo = notif.postMedia && (notif.postMedia.includes('.mp4') || notif.postMedia.includes('video'));

  return (
    <div 
      className={`act-card-item ${isTopItem ? 'act-animate-in' : ''}`}
      style={isTopItem ? { animationDelay: `${(index + 1) * 0.08}s` } : undefined}
      onClick={handleCardClick}
    >
      {/* Profile Picture with Micro Badge */}
      <div className="relative w-12 h-12 shrink-0 cursor-pointer" onClick={handleActorClick}>
        <img 
          src={notif.actorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(notif.actorName || 'User')}&background=random`} 
          alt={notif.actorName || 'avatar'}
          className="w-full h-full rounded-full object-cover shadow-[0_4px_14px_rgba(0,0,0,0.18)]"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
        {getMicroBadge(notif.type)}
      </div>

      {/* Content Details */}
      <div className="flex-1 min-w-0">
        <div className="text-[0.88rem] leading-[1.35] tracking-[-0.25px] line-clamp-2 text-neutral-900 dark:text-neutral-100">
          <span className="font-bold mr-1 text-neutral-950 dark:text-white cursor-pointer hover:underline" onClick={handleActorClick}>
            {notif.actorName || 'User'}
          </span>
          {notif.type === 'like' && 'liked your video.'}
          {notif.type === 'comment' && `commented: "${notif.content || ''}"`}
          {notif.type === 'reply' && `replied: "${notif.content || ''}"`}
          {notif.type === 'repost' && 'reposted your video.'}
          {notif.type === 'favorite' && 'saved your video to favorites.'}
          {notif.type === 'follow' && 'started following you.'}
          {notif.type === 'mention' && (notif.content ? `mentioned you: "${notif.content}"` : 'mentioned you in a post.')}
          {notif.type === 'comment_like' && 'liked your comment.'}
        </div>
        <div className="text-[0.74rem] text-neutral-500 dark:text-neutral-400 font-medium mt-0.5 flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-[#007aff] inline-block shrink-0" />
          <span>{formatTime(notif.createdAt)}</span>
        </div>
      </div>

      {/* Right Side: Follow Pill or Post Thumbnail */}
      {notif.type === 'follow' ? (
        <button 
          type="button"
          onClick={handleFollowToggle}
          disabled={loading}
          className={`act-btn-pill ${
            isFriend || isFollowing 
              ? 'act-btn-following' 
              : 'act-btn-follow-back'
          }`}
        >
          {isFriend ? 'Friends ✓' : isFollowing ? 'Following' : 'Follow Back'}
        </button>
      ) : (notif.postMedia || notif.postId) ? (
        <div 
          onClick={handleCardClick}
          className="w-11 h-11 rounded-[15px] overflow-hidden shrink-0 border border-white/15 shadow-[0_4px_14px_rgba(0,0,0,0.16)] bg-neutral-900 relative cursor-pointer group"
          title="View post"
        >
          {isVideo ? (
            <div className="w-full h-full relative flex items-center justify-center bg-neutral-950">
              <video 
                src={notif.postMedia} 
                className="w-full h-full object-cover pointer-events-none opacity-80" 
                preload="none" 
                muted 
                playsInline 
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <Play className="w-3.5 h-3.5 text-white fill-white drop-shadow-xs" />
              </div>
            </div>
          ) : notif.postMedia ? (
            <img 
              src={notif.postMedia} 
              alt="post" 
              className="w-full h-full object-cover pointer-events-none transition-transform duration-300" 
              referrerPolicy="no-referrer" 
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
              <Play className="w-3.5 h-3.5 text-white/70" />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
});

// Follower Card Component with Squircle styling & tap feedback
const FollowerCard = React.memo(({ 
  follower, 
  index, 
  isTopItem = false 
}: { 
  follower: FollowerUser; 
  index: number;
  isTopItem?: boolean;
}) => {
  const { 
    setViewingUser, 
    pushPage, 
    currentUser,
    followingIds,
    followerIds,
    setFollowingIds
  } = useAppStore();

  const [loading, setLoading] = useState(false);

  const isFollowing = (followingIds || []).includes(follower.id);
  const isFollower = true;
  const isFriend = isFollowing && isFollower;

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic(8);
    setViewingUser({ 
      uid: follower.id, 
      name: follower.name, 
      avatar: follower.avatar 
    });
    pushPage('profile');
  };

  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || loading) return;
    triggerHaptic(20);
    setLoading(true);

    const prevFollowing = [...(followingIds || [])];
    const willFollow = !isFollowing;

    if (willFollow) {
      setFollowingIds([...prevFollowing, follower.id]);
    } else {
      setFollowingIds(prevFollowing.filter(id => id !== follower.id));
    }

    try {
      if (willFollow) {
        await followUser(currentUser, { 
          uid: follower.id, 
          name: follower.name, 
          avatar: follower.avatar 
        });
      } else {
        await unfollowUser(currentUser.uid, follower.id);
      }
    } catch (error) {
      console.error(error);
      setFollowingIds(prevFollowing);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className={`act-card-item ${isTopItem ? 'act-animate-in' : ''}`}
      style={isTopItem ? { animationDelay: `${(index + 1) * 0.08}s` } : undefined}
      onClick={handleProfileClick}
    >
      <div className="relative w-12 h-12 shrink-0 cursor-pointer" onClick={handleProfileClick}>
        <img 
          src={follower.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(follower.name || 'User')}&background=random`} 
          alt={follower.name}
          className="w-full h-full rounded-full object-cover shadow-[0_4px_14px_rgba(0,0,0,0.18)]"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-bold text-[0.92rem] text-neutral-950 dark:text-white truncate leading-tight hover:underline">
          {follower.name}
        </div>
        <div className="text-[0.74rem] text-neutral-500 dark:text-neutral-400 font-medium truncate mt-0.5">
          {follower.username ? `@${follower.username}` : 'Started following you'}
        </div>
      </div>

      <button 
        type="button"
        onClick={handleFollowToggle}
        disabled={loading}
        className={`act-btn-pill ${
          isFriend || isFollowing 
            ? 'act-btn-following' 
            : 'act-btn-follow-back'
        }`}
      >
        {isFriend ? 'Friends ✓' : isFollowing ? 'Following' : 'Follow Back'}
      </button>
    </div>
  );
});

export interface NotificationsProps {
  onBack?: () => void;
  isModal?: boolean;
}

// Module-level in-memory user profile cache to prevent repeated Firestore fetches across re-renders
const followerProfileCache = new Map<string, { name: string; avatar?: string; username?: string }>();

export default function Notifications({ onBack, isModal = false }: NotificationsProps = {}) {
  const { 
    popPage, 
    currentUser, 
    cachedNotifications, 
    setCachedNotifications,
    appTheme,
    setAppTheme
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<0 | 1>(0); // 0 = Activity, 1 = Followers
  const [followers, setFollowers] = useState<FollowerUser[]>([]);
  
  // Accordion Stack Expansion States
  const [isActivityExpanded, setIsActivityExpanded] = useState(false);
  const [isFollowersExpanded, setIsFollowersExpanded] = useState(false);

  // Real-time 1:1 Swipe tracking with requestAnimationFrame
  const viewportRef = useRef<HTMLDivElement>(null);
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const currentDiffXRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = subscribeNotifications(currentUser.uid, (notifs) => {
      setCachedNotifications(notifs);
    });
    
    const timer = setTimeout(() => {
      markAllRead(currentUser.uid);
    }, 1500);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [currentUser, setCachedNotifications]);


  // Subscribe to followers
  useEffect(() => {
    if (!currentUser?.uid) return;

    const q = query(
      collection(db, 'users', currentUser.uid, 'followers'),
      orderBy('createdAt', 'desc'),
      limit(40)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      try {
        const rawDocs = snap.docs;
        // 0ms synchronous render using follower doc data and existing cache
        const initialList: FollowerUser[] = rawDocs.map((d) => {
          const data = d.data();
          const cached = followerProfileCache.get(d.id);
          return {
            id: d.id,
            name: cached?.name || data.name || 'User',
            avatar: cached?.avatar || data.avatar,
            username: cached?.username || data.username,
            createdAt: data.createdAt
          };
        });
        setFollowers(initialList);

        // Fetch missing profiles in background without blocking UI thread
        const missingIds = rawDocs
          .filter(d => !followerProfileCache.has(d.id) && (!d.data().avatar || !d.data().name))
          .map(d => d.id)
          .slice(0, 10);

        if (missingIds.length > 0) {
          Promise.allSettled(
            missingIds.map(async (uid) => {
              const uSnap = await getDoc(doc(db, 'users', uid));
              if (uSnap.exists()) {
                const uData = uSnap.data();
                followerProfileCache.set(uid, {
                  name: uData.name,
                  avatar: uData.avatar,
                  username: uData.username
                });
              }
            })
          ).then(() => {
            setFollowers(prev => prev.map(f => {
              const c = followerProfileCache.get(f.id);
              return c ? { ...f, name: c.name || f.name, avatar: c.avatar || f.avatar, username: c.username || f.username } : f;
            }));
          });
        }
      } catch (err) {
        console.warn('Failed loading followers', err);
      }
    }, () => {});

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Tab Switcher with Apple spring easing (Hardware Accelerated 3D)
  const switchTab = useCallback((index: 0 | 1) => {
    setActiveTab(index);
    triggerHaptic(12);

    if (sliderTrackRef.current) {
      sliderTrackRef.current.style.transition = 'transform 0.42s cubic-bezier(0.16, 1, 0.3, 1)';
      sliderTrackRef.current.style.transform = `translate3d(-${index * 50}%, 0, 0)`;
    }
  }, []);

  // Theme Toggle: Light & Dark Mode
  const toggleTheme = useCallback(() => {
    triggerHaptic(15);
    const nextTheme = appTheme === 'dark' ? 'light' : 'dark';
    setAppTheme(nextTheme);
  }, [appTheme, setAppTheme]);

  // Stack toggle helper with haptic
  const toggleActivityStack = useCallback(() => {
    triggerHaptic(18);
    setIsActivityExpanded(prev => !prev);
  }, []);

  const toggleFollowersStack = useCallback(() => {
    triggerHaptic(18);
    setIsFollowersExpanded(prev => !prev);
  }, []);

  // Real-time 1:1 Touch Drag tracking between Activity and Followers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    currentDiffXRef.current = 0;
    isDraggingRef.current = true;
    if (sliderTrackRef.current) {
      sliderTrackRef.current.style.transition = 'none';
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || !viewportRef.current || !sliderTrackRef.current) return;
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    const diffX = x - touchStartXRef.current;
    const diffY = y - touchStartYRef.current;

    if (Math.abs(diffX) > Math.abs(diffY)) {
      currentDiffXRef.current = diffX;
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          if (!sliderTrackRef.current || !viewportRef.current) return;
          const base = -activeTab * 50;
          const dragPercent = (currentDiffXRef.current / viewportRef.current.clientWidth) * 50;
          sliderTrackRef.current.style.transform = `translate3d(${base + dragPercent}%, 0, 0)`;
        });
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    const diffX = currentDiffXRef.current;

    if (sliderTrackRef.current) {
      sliderTrackRef.current.style.transition = 'transform 0.42s cubic-bezier(0.16, 1, 0.3, 1)';
    }

    if (diffX < -45 && activeTab === 0) {
      switchTab(1);
    } else if (diffX > 45 && activeTab === 1) {
      switchTab(0);
    } else {
      if (sliderTrackRef.current) {
        sliderTrackRef.current.style.transform = `translate3d(-${activeTab * 50}%, 0, 0)`;
      }
    }
  };

  // Drag gesture for stack banner handles (drag up to expand, drag down to collapse)
  const actBannerTouchRef = useRef<number>(0);
  const handleActBannerTouchStart = (e: React.TouchEvent) => {
    actBannerTouchRef.current = e.touches[0].clientY;
  };
  const handleActBannerTouchEnd = (e: React.TouchEvent) => {
    const deltaY = e.changedTouches[0].clientY - actBannerTouchRef.current;
    if (deltaY < -20 && !isActivityExpanded) toggleActivityStack();
    else if (deltaY > 20 && isActivityExpanded) toggleActivityStack();
  };

  const folBannerTouchRef = useRef<number>(0);
  const handleFolBannerTouchStart = (e: React.TouchEvent) => {
    folBannerTouchRef.current = e.touches[0].clientY;
  };
  const handleFolBannerTouchEnd = (e: React.TouchEvent) => {
    const deltaY = e.changedTouches[0].clientY - folBannerTouchRef.current;
    if (deltaY < -20 && !isFollowersExpanded) toggleFollowersStack();
    else if (deltaY > 20 && isFollowersExpanded) toggleFollowersStack();
  };

  // Splitting notifications: top 2 in static list, rest in magical accordion stack
  const topActivities = useMemo(() => cachedNotifications.slice(0, 2), [cachedNotifications]);
  const stackedActivities = useMemo(() => cachedNotifications.slice(2), [cachedNotifications]);

  // Splitting followers: top 2 in static list, rest in magical accordion stack
  const topFollowers = useMemo(() => followers.slice(0, 2), [followers]);
  const stackedFollowers = useMemo(() => followers.slice(2), [followers]);

  // Handle header back button
  const handleBack = () => {
    triggerHaptic(10);
    if (activeTab === 1) {
      switchTab(0);
    } else if (onBack) {
      onBack();
    } else {
      popPage();
    }
  };

  return (
    <div 
      className={`h-[100dvh] w-full overflow-hidden bg-[#f2f2f7] dark:bg-black text-black dark:text-white flex flex-col ${isModal ? '' : 'md:pl-28 lg:pl-32'} select-none relative transition-colors duration-400 font-sans`}
    >
      {/* Ambient Soft Lighting Glow at Top */}
      <div className="act-ambient-glow" />

      {/* Header with Back, Dynamic Title & Theme Toggle */}
      <header className="h-[56px] px-4 pt-[max(calc(env(safe-area-inset-top,0px)+10px),16px)] flex items-center justify-between z-50 shrink-0">
        {!isModal ? (
          <>
            <button 
              type="button"
              onClick={handleBack}
              className="act-header-btn md:hidden" 
              title="Back"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div className="w-10 h-10 hidden md:block pointer-events-none" />
          </>
        ) : (
          <button 
            type="button"
            onClick={handleBack}
            className="act-header-btn" 
            title="Back"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}

        <h1 className="text-[1.2rem] font-bold tracking-[-0.4px] text-neutral-950 dark:text-white select-none">
          {activeTab === 0 ? 'Activity' : 'Followers'}
        </h1>

        <button 
          type="button"
          onClick={toggleTheme}
          className="act-header-btn" 
          title="Toggle Theme"
        >
          {appTheme === 'dark' ? (
            <Sun className="w-[18px] h-[18px] text-amber-400 stroke-[2.2]" />
          ) : (
            <Moon className="w-[18px] h-[18px] text-neutral-800 stroke-[2.2]" />
          )}
        </button>
      </header>

      {/* Swipable Viewport Track */}
      <div 
        ref={viewportRef}
        className="flex-1 w-full overflow-hidden relative z-10 touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div 
          ref={sliderTrackRef}
          className="flex w-[200%] h-full"
          style={{ transform: `translate3d(-${activeTab * 50}%, 0, 0)` }}
        >
          {/* ================= TAB 1: ACTIVITY ================= */}
          <div className="w-[50%] h-full overflow-y-auto overflow-x-hidden pt-2 px-4 pb-32 no-scrollbar [webkit-overflow-scrolling:touch] overscroll-y-contain">
            <div className="max-w-[440px] mx-auto">
              
              {/* Section Subheader (Extra noise/Live badge removed as instructed) */}
              <div className="text-[0.76rem] font-bold uppercase tracking-[0.8px] text-neutral-500 dark:text-neutral-400 my-2.5 mx-2 flex items-center justify-between">
                <span>Recent Activity</span>
              </div>

              {/* Top Recent Activities */}
              <div className="flex flex-col gap-2.5">
                {topActivities.map((notif, idx) => (
                  <ActivityCard 
                    key={notif.id} 
                    notif={notif} 
                    index={idx} 
                    isTopItem 
                  />
                ))}
              </div>

              {/* MAGICAL IPHONE NOTIFICATION STACK ACCORDION UNROLL */}
              {stackedActivities.length > 0 && (
                <div className="mt-3.5 relative act-animate-in" style={{ animationDelay: '0.24s' }}>
                  {/* Stack Handle Banner */}
                  <div 
                    className="act-stack-handle-banner"
                    onClick={toggleActivityStack}
                    onTouchStart={handleActBannerTouchStart}
                    onTouchEnd={handleActBannerTouchEnd}
                  >
                    <div className="act-stack-pill-handle" />
                    <span className="text-[0.75rem] font-semibold text-neutral-500 dark:text-neutral-400 tracking-[-0.1px] flex items-center gap-1.5">
                      <span>{isActivityExpanded ? 'Earlier Notifications (Tap to close)' : 'Earlier Notifications (Tap to open)'}</span>
                      <svg 
                        className="transition-transform duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]"
                        style={{ transform: isActivityExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        width="13" 
                        height="13" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2.5"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </span>
                  </div>

                  {/* Stacking Cards Deck */}
                  <div 
                    className={`act-stack-deck ${isActivityExpanded ? 'is-expanded' : 'is-collapsed'}`}
                    onClick={() => {
                      if (!isActivityExpanded) toggleActivityStack();
                    }}
                  >
                    {stackedActivities.map((notif, idx) => (
                      <ActivityCard 
                        key={notif.id} 
                        notif={notif} 
                        index={idx} 
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Clean Empty State */}
              {cachedNotifications.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-neutral-400 dark:text-neutral-500 space-y-2 select-none">
                  <div className="w-14 h-14 rounded-full bg-white/70 dark:bg-white/10 flex items-center justify-center shadow-xs mb-1">
                    <Bell className="w-6 h-6 text-neutral-400 dark:text-neutral-500 stroke-[1.8]" />
                  </div>
                  <p className="text-[15px] font-bold text-neutral-800 dark:text-neutral-200">No activity yet</p>
                  <p className="text-[12.5px] text-neutral-500 dark:text-neutral-400">Likes, comments, and mentions will appear here</p>
                </div>
              )}
            </div>
          </div>

          {/* ================= TAB 2: FOLLOWERS ================= */}
          <div className="w-[50%] h-full overflow-y-auto overflow-x-hidden pt-2 px-4 pb-32 no-scrollbar [webkit-overflow-scrolling:touch] overscroll-y-contain">
            <div className="max-w-[440px] mx-auto">
              
              {/* Section Subheader */}
              <div className="text-[0.76rem] font-bold uppercase tracking-[0.8px] text-neutral-500 dark:text-neutral-400 my-2.5 mx-2 flex items-center justify-between">
                <span>Follow Requests</span>
              </div>

              {/* Top Recent Followers */}
              <div className="flex flex-col gap-2.5">
                {topFollowers.map((f, idx) => (
                  <FollowerCard 
                    key={f.id} 
                    follower={f} 
                    index={idx} 
                    isTopItem 
                  />
                ))}
              </div>

              {/* Bottom Follower Suggestions / Earlier Stack (CLICK TO UNROLL) */}
              {stackedFollowers.length > 0 && (
                <div className="mt-3.5 relative act-animate-in" style={{ animationDelay: '0.24s' }}>
                  <div 
                    className="act-stack-handle-banner"
                    onClick={toggleFollowersStack}
                    onTouchStart={handleFolBannerTouchStart}
                    onTouchEnd={handleFolBannerTouchEnd}
                  >
                    <div className="act-stack-pill-handle" />
                    <span className="text-[0.75rem] font-semibold text-neutral-500 dark:text-neutral-400 tracking-[-0.1px] flex items-center gap-1.5">
                      <span>{isFollowersExpanded ? 'Earlier Followers (Tap to close)' : 'Earlier Followers (Tap to open)'}</span>
                      <svg 
                        className="transition-transform duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]"
                        style={{ transform: isFollowersExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        width="13" 
                        height="13" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2.5"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </span>
                  </div>

                  <div 
                    className={`act-stack-deck ${isFollowersExpanded ? 'is-expanded' : 'is-collapsed'}`}
                    onClick={() => {
                      if (!isFollowersExpanded) toggleFollowersStack();
                    }}
                  >
                    {stackedFollowers.map((f, idx) => (
                      <FollowerCard 
                        key={f.id} 
                        follower={f} 
                        index={idx} 
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Clean Empty State */}
              {followers.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-neutral-400 dark:text-neutral-500 space-y-2 select-none">
                  <div className="w-14 h-14 rounded-full bg-white/70 dark:bg-white/10 flex items-center justify-center shadow-xs mb-1">
                    <UserPlus className="w-6 h-6 text-neutral-400 dark:text-neutral-500 stroke-[1.8]" />
                  </div>
                  <p className="text-[15px] font-bold text-neutral-800 dark:text-neutral-200">No followers yet</p>
                  <p className="text-[12.5px] text-neutral-500 dark:text-neutral-400">When someone follows you, they will appear here</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Floating High-White Light Glass Navigation Bar at Bottom */}
      <div className="act-bottom-nav-container">
        <nav className="act-glass-nav-pill">
          {/* Sliding capsule indicator with spring bounce */}
          <div 
            className="act-capsule-slider"
            style={{
              transform: activeTab === 0 ? 'translateX(0%)' : 'translateX(100%)'
            }}
          />

          {/* Activity Button */}
          <button 
            type="button"
            className={`act-nav-btn ${activeTab === 0 ? 'active' : ''}`}
            onClick={() => switchTab(0)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span>Activity</span>
          </button>

          {/* Followers Button */}
          <button 
            type="button"
            className={`act-nav-btn ${activeTab === 1 ? 'active' : ''}`}
            onClick={() => switchTab(1)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
            <span>Followers</span>
          </button>
        </nav>
      </div>

    </div>
  );
}
