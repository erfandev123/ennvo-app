import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  MessageCircle, 
  Send, 
  Bookmark, 
  MoreHorizontal, 
  Play, 
  VolumeX, 
  Volume2,
  X, 
  Trash2,
  Edit2,
  Check,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Music,
  Repeat,
  Search,
  Mic,
  Image as ImageIcon,
  Smile,
  Pause,
  User,
  Sparkles,
  Download,
  Share2,
  Link,
  PlusCircle,
  Plus,
  Flag,
  Lock,
  Globe,
  Users,
  Zap,
  BarChart2,
  TrendingUp,
  Eye
} from 'lucide-react';
import { StickerPickerModal, StickerViewerModal } from './StickerPickerModal';
import { useAppStore } from '../store';
import { db } from '../firebase';
import { 
  onSnapshot, 
  doc,
  collection,
  query,
  orderBy,
  deleteDoc,
  updateDoc,
  getDoc,
  setDoc,
  addDoc,
  serverTimestamp,
  limit
} from 'firebase/firestore';
import { 
  toggleLike, 
  toggleFavorite, 
  incrementViewCount, 
  addComment, 
  getComments, 
  toggleCommentLike,
  deletePost,
  toggleSongFavorite,
  toggleRepost,
  checkHasReposted
} from '../services/postService';
import { sendNotification } from '../services/notificationService';
import { findUserByUsername } from '../services/userService';
import { subscribeConversations, sendMessage } from '../services/chatService';
import { Post, Comment } from '../types';
import { followUser, unfollowUser } from '../services/followService';
import { formatTime, formatCount } from '../utils';
import { VerifiedBadge } from './VerifiedBadge';

// Guaranteed instant-render exact Ionicons SVG paths matching previous ion-icon designs
const IonHeartIcon: React.FC<{ filled?: boolean; className?: string }> = ({ filled, className = "w-[1.85rem] h-[1.85rem]" }) => {
  if (filled) {
    return (
      <svg viewBox="0 0 512 512" className={className} fill="currentColor">
        <path d="M256 448l-30.16-27.42C118.8 323.03 48 258.94 48 180.05 48 116.14 98.14 66 162.05 66c36.08 0 70.72 16.79 93.95 43.32C279.23 82.79 313.87 66 349.95 66 413.86 66 464 116.14 464 180.05c0 78.89-70.8 142.98-177.84 240.53L256 448z"/>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 512 512" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32">
      <path d="M352.92 80C288 80 256 144 256 144s-32-64-96.92-64c-52.71 0-95.08 42.7-95.08 95.78 0 102.83 115.54 180.79 192 256.22 76.46-75.43 192-153.39 192-256.22 0-53.08-42.37-95.78-95.08-95.78z"/>
    </svg>
  );
};

const IonChatIcon: React.FC<{ className?: string }> = ({ className = "w-[1.85rem] h-[1.85rem]" }) => (
  // @ts-ignore
  <ion-icon name="chatbubble-ellipses-outline" class={className} style={{ fontSize: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}></ion-icon>
);

const IonBookmarkIcon: React.FC<{ filled?: boolean; className?: string }> = ({ filled, className = "w-[1.85rem] h-[1.85rem]" }) => {
  if (filled) {
    return (
      <svg viewBox="0 0 512 512" className={className} fill="currentColor">
        <path d="M400 480a16 16 0 01-10.63-4L256 357.41 122.63 476A16 16 0 0196 464V96a64.07 64.07 0 0164-64h192a64.07 64.07 0 0164 64v368a16 16 0 01-16 16z"/>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 512 512" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32">
      <path d="M352 48H160a48 48 0 00-48 48v368l144-128 144 128V96a48 48 0 00-48-48z"/>
    </svg>
  );
};

const IonShareIcon: React.FC<{ className?: string }> = ({ className = "w-[1.85rem] h-[1.85rem]" }) => (
  <svg viewBox="0 0 512 512" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="32">
    <path d="M448 256L272 88v96C103.57 184 64 304.77 64 424c48.61-62.24 91.6-96 208-96v96z"/>
  </svg>
);

const IonMoreIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
  <svg viewBox="0 0 512 512" className={className} fill="currentColor">
    <circle cx="256" cy="256" r="32"/>
    <circle cx="416" cy="256" r="32"/>
    <circle cx="96" cy="256" r="32"/>
  </svg>
);

export interface InteractionItem {
  uid: string;
  name: string;
  avatar: string;
  type: 'repost' | 'like';
  text?: string;
  isFriend?: boolean;
  isSelf?: boolean;
  updatedAt?: number;
}

interface ReelItemProps {
  reel: Post;
  isModal?: boolean;
  onClose?: () => void;
}

export const ReelItem: React.FC<ReelItemProps> = React.memo(({ reel, isModal, onClose }) => {
  const [playing, setPlaying] = useState(false);
  const [liked, setLiked] = useState<boolean>(() => !!(reel.isLiked || reel.liked));
  const [saved, setSaved] = useState<boolean>(() => !!(reel.isSaved || reel.saved));
  const [reposted, setReposted] = useState<boolean>(() => !!reel.isReposted);
  const [progress, setProgress] = useState(0);
  const [likesCount, setLikesCount] = useState(reel.likesCount || 0);
  const [commentsCount, setCommentsCount] = useState(reel.commentsCount || 0);
  const [repostsCount, setRepostsCount] = useState(reel.repostsCount || 0);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isFollowingUser, setIsFollowingUser] = useState<boolean>(() => {
    if (reel.isFollowing !== undefined) return reel.isFollowing;
    const fIds = useAppStore.getState().followingIds;
    return fIds ? fIds.includes(reel.authorId) : false;
  });
  const [followAnimating, setFollowAnimating] = useState(false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const [floatingHearts, setFloatingHearts] = useState<{ id: number, x: number, y: number }[]>([]);
  const [isNearScreen, setIsNearScreen] = useState(true);
  const [isVertical, setIsVertical] = useState(true);
  
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isCleanZoom, setIsCleanZoom] = useState(false);
  const pinchStartDist = useRef<number>(0);

  const [isSongSaved, setIsSongSaved] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const isImageReel = Boolean(
    reel.type !== 'reel' && 
    reel.media && 
    reel.media.length > 0 && 
    !reel.media[0].match(/\.(mp4|webm|mov|m4v|ogg|3gp)($|#|\?)/i) &&
    !reel.media[0].includes('/reels/') &&
    !reel.media[0].includes('video') &&
    !(reel.mediaDetails?.[0] as any)?.type?.includes('video')
  );
  const [reelSong, setReelSong] = useState<{id: string, title: string, artist: string, url: string} | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const scrubberThumbRef = useRef<HTMLDivElement>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const wasPlayingBeforeScrubRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTap = useRef<number>(0);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const [replyTo, setReplyTo] = useState<{id: string, name: string, authorId: string} | null>(null);
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [repostInputText, setRepostInputText] = useState('');
  const [isRepostingLoading, setIsRepostingLoading] = useState(false);
  const [interactions, setInteractions] = useState<InteractionItem[]>([]);
  const [showInteractionsModal, setShowInteractionsModal] = useState(false);
  const [showSongModal, setShowSongModal] = useState(false);
  const [is2XSpeed, setIs2XSpeed] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const speedTimerRef = useRef<any>(null);

  const holdTouchStartPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!showComments && !showShare && !showRepostModal && !showInteractionsModal && !showSongModal && !confirmDelete) return;
    const handleBack = (e: Event) => {
      e.preventDefault();
      if (showComments) setShowComments(false);
      else if (showShare) setShowShare(false);
      else if (showRepostModal) setShowRepostModal(false);
      else if (showInteractionsModal) setShowInteractionsModal(false);
      else if (showSongModal) setShowSongModal(false);
      else if (confirmDelete) setConfirmDelete(false);
    };
    window.addEventListener('appBackPress', handleBack);
    return () => window.removeEventListener('appBackPress', handleBack);
  }, [showComments, showShare, showRepostModal, showInteractionsModal, showSongModal, confirmDelete]);

  const handleSpeedHoldStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    // Only allow on mobile
    if (typeof window !== "undefined" && window.innerWidth >= 768) return;
    if (isImageReel) return;

    if ("touches" in e && e.touches.length > 0) {
      holdTouchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if ("clientX" in e) {
      holdTouchStartPos.current = { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY };
    }

    if (speedTimerRef.current) clearTimeout(speedTimerRef.current);
    speedTimerRef.current = setTimeout(() => {
      if (typeof window !== "undefined" && window.navigator?.vibrate) {
        try { window.navigator.vibrate(18); } catch (err) {}
      }
      setIs2XSpeed(true);
      if (videoRef.current) {
        try {
          // @ts-ignore
          videoRef.current.preservesPitch = true;
          // @ts-ignore
          videoRef.current.webkitPreservesPitch = true;
          // @ts-ignore
          videoRef.current.mozPreservesPitch = true;
        } catch (e) {}
        videoRef.current.playbackRate = 2.0;
      }
    }, 200);
  }, [isImageReel]);

  const handleSpeedHoldMove = useCallback((e: React.TouchEvent) => {
    if (!holdTouchStartPos.current || !e.touches[0]) return;
    const dx = Math.abs(e.touches[0].clientX - holdTouchStartPos.current.x);
    const dy = Math.abs(e.touches[0].clientY - holdTouchStartPos.current.y);
    // If finger moves (scrolling or swiping), cancel 2X immediately without blocking scroll
    if (dx > 8 || dy > 8) {
      if (speedTimerRef.current) {
        clearTimeout(speedTimerRef.current);
        speedTimerRef.current = null;
      }
      if (is2XSpeed) {
        setIs2XSpeed(false);
        if (videoRef.current) {
          videoRef.current.playbackRate = 1.0;
        }
      }
      holdTouchStartPos.current = null;
    }
  }, [is2XSpeed]);

  const handleSpeedHoldEnd = useCallback(() => {
    holdTouchStartPos.current = null;
    if (speedTimerRef.current) {
      clearTimeout(speedTimerRef.current);
      speedTimerRef.current = null;
    }
    if (is2XSpeed) {
      setIs2XSpeed(false);
      if (videoRef.current) {
        videoRef.current.playbackRate = 1.0;
      }
    }
  }, [is2XSpeed]);
  
  const { 
    currentUser, 
    userCache,
    followingIds,
    currentPage,
    setViewingUser, 
    pushPage, 
    setViewingReel, 
    highlightedCommentId, 
    setHighlightedCommentId,
    highlightedPostId, 
    setHighlightedPostId, 
    setShowLikesList, 
    setTargetLikesPostId, 
    setShowViewsList, 
    setTargetViewsPostId, 
    setShowAnalytics, 
    setTargetAnalyticsPostId,
    globalMuted: muted,
    setGlobalMuted: setMuted,
    setIsReelsCleanZoom,
    setIsBottomNavHidden,
    setSelectedCreateSong,
    navStyle,
    reelsStyle: reelsUiStyle
  } = useAppStore();

  const reelBottomSpacing = isModal ? 'bottom-[78px]' : navStyle === 'glass' ? 'bottom-[calc(98px+env(safe-area-inset-bottom))]' : 'bottom-[calc(72px+env(safe-area-inset-bottom))]';

  const cachedAuthor = userCache[reel.authorId];
  const rawAuthorName = cachedAuthor?.name || reel.authorName || 'User';
  const authorName = rawAuthorName.trim() ? (rawAuthorName.trim().charAt(0).toUpperCase() + rawAuthorName.trim().slice(1)) : 'User';
  const authorAvatar = cachedAuthor?.avatar || reel.authorAvatar;

  const [mediaSrc, setMediaSrc] = useState<string>(reel.media?.[0] || '');

  useEffect(() => {
    const original = reel.media?.[0];
    if (!original) return;
    setMediaSrc(original);

    // If offline, check offline storage for local blob URL
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      import('../services/offlineMediaService').then(m => {
        m.getOfflineMediaBlobUrl(original).then(cachedBlobUrl => {
          if (cachedBlobUrl) {
            setMediaSrc(cachedBlobUrl);
          }
        });
      }).catch(() => {});
    }
  }, [reel.media?.[0]]);

  useEffect(() => {
    if (isCleanZoom || is2XSpeed) {
      setIsReelsCleanZoom(true);
      setIsBottomNavHidden(true);
    } else {
      setIsReelsCleanZoom(false);
      setIsBottomNavHidden(false);
    }
    return () => {
      setIsReelsCleanZoom(false);
      setIsBottomNavHidden(false);
    };
  }, [isCleanZoom, is2XSpeed, setIsReelsCleanZoom, setIsBottomNavHidden]);

  const followingSet = useMemo(() => new Set(followingIds || []), [followingIds]);

  useEffect(() => {
    if (!isNearScreen) return;

    const repostsColRef = query(collection(db, 'posts', reel.id, 'reposts'), limit(4));
    const likesColRef = query(collection(db, 'posts', reel.id, 'likes'), limit(4));

    let latestReposts: any[] = [];
    let latestLikes: any[] = [];

    const updateActivity = () => {
      const allList: InteractionItem[] = [];
      const seenUids = new Set<string>();

      // 1. Process Reposts
      latestReposts.forEach(r => {
        const uid = r.userId || r.id;
        if (!uid) return;
        seenUids.add(uid);
        allList.push({
          uid,
          name: r.userName || 'User',
          avatar: r.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.userName || 'User')}&background=random`,
          type: 'repost',
          text: r.text || '',
          isFriend: currentUser ? followingSet.has(uid) : false,
          isSelf: currentUser ? uid === currentUser.uid : false,
          updatedAt: r.createdAt?.toMillis ? r.createdAt.toMillis() : Date.now()
        });
      });

      // 2. Process Likes
      latestLikes.forEach(l => {
        const uid = l.userId || l.id;
        if (!uid) return;
        if (!seenUids.has(uid)) {
          seenUids.add(uid);
          const isSelf = currentUser ? uid === currentUser.uid : false;
          allList.push({
            uid,
            name: l.userName || (isSelf && currentUser ? currentUser.name : 'User'),
            avatar: l.userAvatar || (isSelf && currentUser ? currentUser.avatar : `https://ui-avatars.com/api/?name=${encodeURIComponent(l.userName || 'User')}&background=random`),
            type: 'like',
            isFriend: currentUser ? followingSet.has(uid) : false,
            isSelf,
            updatedAt: l.createdAt?.toMillis ? l.createdAt.toMillis() : Date.now()
          });
        }
      });

      // Sort: Reposts first, then friends, then recency so repost users always appear
      allList.sort((a, b) => {
        if (a.type === 'repost' && b.type !== 'repost') return -1;
        if (b.type === 'repost' && a.type !== 'repost') return 1;
        if (a.isFriend !== b.isFriend) return a.isFriend ? -1 : 1;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });

      setInteractions(allList);
    };

    const unsubReposts = onSnapshot(repostsColRef, (snap) => {
      latestReposts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      updateActivity();
    }, () => {});

    const unsubLikes = onSnapshot(likesColRef, (snap) => {
      latestLikes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      updateActivity();
    }, () => {});

    return () => {
      unsubReposts();
      unsubLikes();
    };
  }, [reel.id, currentUser, isNearScreen, followingSet]);

  useEffect(() => {
    // Optimization: Keep nearby reel contents mounted within viewport distance for instant scroll
    const preloadObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsNearScreen(entry.isIntersecting);
        });
      },
      { rootMargin: '60% 0px' }
    );
    if (containerRef.current) preloadObserver.observe(containerRef.current);
    
    return () => preloadObserver.disconnect();
  }, []);

  // Sync following status instantly from memory store without network roundtrips
  useEffect(() => {
    setIsFollowingUser(currentUser ? followingSet.has(reel.authorId) : false);
  }, [followingSet, reel.authorId, currentUser]);

  useEffect(() => {
    if (highlightedPostId === reel.id && highlightedCommentId && currentUser) {
      // Automatically show comments once and consume the highlighted ID
      setShowComments(true);
      if (typeof setHighlightedPostId === 'function') {
        setHighlightedPostId(null);
        setHighlightedCommentId(null);
      }
    }
  }, [highlightedCommentId, highlightedPostId, reel.id, currentUser, setHighlightedPostId, setHighlightedCommentId]);

  useEffect(() => {
    return () => {
      // Clear highlights when reel item is destroyed if they matched this reel
      if (typeof setHighlightedPostId === 'function') {
        const { highlightedPostId: currentHPostId } = useAppStore.getState();
        if (currentHPostId === reel.id) {
          useAppStore.getState().setHighlightedPostId(null);
          useAppStore.getState().setHighlightedCommentId(null);
        }
      }
    };
  }, [reel.id]);

  useEffect(() => {
    if (!playing || !currentUser) return;

    let unsubReel: () => void = () => {};
    let unsubLike: () => void = () => {};
    let unsubFav: () => void = () => {};
    let unsubRepost: () => void = () => {};
    let isCancelled = false;

    const attachTimer = setTimeout(() => {
      if (isCancelled) return;

      const reelRef = doc(db, 'posts', reel.id);
      const likeRef = doc(db, 'posts', reel.id, 'likes', currentUser.uid);
      const favRef = doc(db, 'users', currentUser.uid, 'favorites', reel.id);
      const repostRef = doc(db, 'posts', reel.id, 'reposts', currentUser.uid);

      unsubReel = onSnapshot(reelRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setLikesCount(data.likesCount || 0);
          setCommentsCount(data.commentsCount || 0);
          if (data.repostsCount !== undefined) setRepostsCount(data.repostsCount);
        }
      }, () => {});

      unsubLike = onSnapshot(likeRef, (s) => setLiked(s.exists()), () => {});
      unsubFav = onSnapshot(favRef, (s) => setSaved(s.exists()), () => {});
      unsubRepost = onSnapshot(repostRef, (s) => setReposted(s.exists()), () => {});

      if (reel.songId) {
        getDoc(doc(db, 'songs', reel.songId)).then((snap: any) => {
          if (snap.exists() && !isCancelled) {
            const sData = snap.data();
            if (sData?.url && reel.media && reel.media.includes(sData.url)) {
              return;
            }
            if ((reel as any).createdSongId && (reel as any).createdSongId === snap.id) {
              return;
            }
            setReelSong({ id: snap.id, ...sData } as any);
          }
        }).catch(() => {});
      }
    }, 80);

    return () => {
      isCancelled = true;
      clearTimeout(attachTimer);
      unsubReel();
      unsubLike();
      unsubFav();
      unsubRepost();
    };
  }, [reel.id, currentUser, reel.authorId, playing]);

  // Only consider it an external song if it's truly a separate music track, not the video's own sound
  const isExternalAudioSong = Boolean(
    reelSong &&
    reelSong.url &&
    (!reel.media || !reel.media.includes(reelSong.url)) &&
    reelSong.id !== (reel as any).createdSongId
  );

  useEffect(() => {
    if (audioRef.current && isExternalAudioSong) {
      audioRef.current.muted = muted;
      if (playing && !muted) {
        audioRef.current.currentTime = videoRef.current ? videoRef.current.currentTime : 0;
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    }
  }, [playing, muted, isExternalAudioSong, reelSong]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setPlaying(true);
            if (currentUser) incrementViewCount(reel.id, currentUser.uid);
            if (videoRef.current && videoRef.current.paused) {
              videoRef.current.play().catch(() => {});
            }
          } else {
            setPlaying(false);
            if (videoRef.current) {
              videoRef.current.pause();
            }
            if (audioRef.current) {
              audioRef.current.pause();
            }
          }
        });
      },
      { threshold: 0.6 }
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [reel.id, currentUser]);

  useEffect(() => {
    if (videoRef.current) {
      if (playing) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Unmuted autoplay failed, gracefully fallback to muted for this specific video
            if (videoRef.current) {
               videoRef.current.muted = true;
               videoRef.current.play().catch(() => setPlaying(false));
            }
          });
        }
      } else {
        videoRef.current.pause();
      }
    }
  }, [playing]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isExternalAudioSong ? true : muted;
    }
  }, [muted, isExternalAudioSong]);

  useEffect(() => {
    if (currentPage !== 'home' && currentPage !== 'reels' && !isModal) {
      setPlaying(false);
      if (videoRef.current) videoRef.current.pause();
      if (audioRef.current) audioRef.current.pause();
    }
  }, [currentPage, isModal]);

  const handleLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const ratio = video.videoHeight / video.videoWidth;
    setIsVertical(ratio > 1.5);
  }, []);

  const handleTimeUpdate = () => {
    if (videoRef.current && !isScrubbing) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${p}%`;
      }
      if (scrubberThumbRef.current) {
        scrubberThumbRef.current.style.left = `${p}%`;
      }
      if (audioRef.current && isExternalAudioSong && !audioRef.current.paused) {
        const diff = Math.abs(audioRef.current.currentTime - videoRef.current.currentTime);
        // Only resync if significant drift occurs, never on fractions of a second to prevent stutter
        if (diff > 1.2) {
          audioRef.current.currentTime = videoRef.current.currentTime;
        }
      }
    }
  };

  const updateScrubPosition = (clientX: number, target: HTMLElement) => {
    if (!videoRef.current || !videoRef.current.duration) return;
    const rect = target.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const targetTime = percentage * videoRef.current.duration;
    videoRef.current.currentTime = targetTime;
    if (audioRef.current) audioRef.current.currentTime = targetTime;
    if (progressBarRef.current) {
      progressBarRef.current.style.transition = 'none';
      progressBarRef.current.style.width = `${percentage * 100}%`;
    }
    if (scrubberThumbRef.current) {
      scrubberThumbRef.current.style.transition = 'none';
      scrubberThumbRef.current.style.left = `${percentage * 100}%`;
    }
    setScrubTime(targetTime);
  };

  const handleScrubPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}
    wasPlayingBeforeScrubRef.current = playing;
    setIsScrubbing(true);
    updateScrubPosition(e.clientX, e.currentTarget);
  };

  const handleScrubPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    e.stopPropagation();
    updateScrubPosition(e.clientX, e.currentTarget);
  };

  const handleScrubPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing) return;
    e.stopPropagation();
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch (err) {}
    setIsScrubbing(false);
    if (wasPlayingBeforeScrubRef.current && videoRef.current) {
      videoRef.current.play().catch(() => {});
      setPlaying(true);
    }
  };

  const formatScrubSecs = (sec: number) => {
    if (isNaN(sec) || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleLike = async () => {
    if (!currentUser) return;
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount(prev => newLiked ? prev + 1 : prev - 1);
    try {
      await toggleLike(reel.id, currentUser.uid, currentUser);
      if (newLiked) {
        const targetAuthorId = reel.authorId || (reel as any).authorUID || (reel as any).userId;
        await sendNotification(targetAuthorId, 'like', currentUser, reel.id, reel.id, reel.media?.[0], null, reel.authorName, reel.authorAvatar);
      }
    } catch {
      setLiked(!newLiked);
      setLikesCount(prev => newLiked ? prev - 1 : prev + 1);
    }
  };

  const handleToggleFollow = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentUser || isCurrentUser) return;
    setFollowAnimating(true);
    const nextState = !isFollowingUser;
    setIsFollowingUser(nextState);
    try {
      const targetAuthorId = reel.authorId || (reel as any).authorUID || (reel as any).userId;
      if (nextState) {
        await followUser(currentUser, { uid: targetAuthorId, name: reel.authorName, avatar: reel.authorAvatar });
      } else {
        await unfollowUser(currentUser.uid, targetAuthorId);
      }
    } catch (err) {
      console.warn("Follow toggle notice:", err);
    } finally {
      setTimeout(() => setFollowAnimating(false), 450);
    }
  };

  const handleRepost = async () => {
    if (!currentUser) return;
    setShowRepostModal(true);
  };

  const handleFavorite = async () => {
    if (!currentUser) return;
    const newSaved = !saved;
    setSaved(newSaved);
    try {
      await toggleFavorite(reel.id, currentUser.uid);
      if (newSaved) {
        const targetAuthorId = reel.authorId || (reel as any).authorUID || (reel as any).userId;
        await sendNotification(targetAuthorId, 'favorite', currentUser, reel.id, reel.id, reel.media?.[0], null, reel.authorName, reel.authorAvatar);
      }
    } catch (e) {
      setSaved(!newSaved);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      pinchStartDist.current = 0;
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartDist.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && touchStartX.current) {
      const deltaX = e.touches[0].clientX - touchStartX.current;
      const deltaY = e.touches[0].clientY - touchStartY.current;

      // STRICT CONDITIONS for Left Swipe to Profile:
      // 1. MUST be on Reels main page (currentPage === 'reels' and !isModal)
      // 2. MUST be a VIDEO reel (!isImageReel) - never photo reels!
      // 3. MUST be horizontally dominant (Math.abs(deltaX) > Math.abs(deltaY) * 2.5) to prevent accidental left swipe during vertical scrolling!
      if (
        currentPage === 'reels' &&
        !isModal &&
        !isImageReel &&
        deltaX < -15 &&
        Math.abs(deltaX) > Math.abs(deltaY) * 2.5
      ) {
        setIsSwiping(true);
        setSwipeX(deltaX);
      }
    } else if (e.touches.length === 2 && pinchStartDist.current > 0) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (dist - pinchStartDist.current > 20) {
        setIsCleanZoom(true);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isSwiping && swipeX < -70) {
      // Smoothly animate off screen to left
      setIsSwiping(false);
      setSwipeX(-window.innerWidth);
      setTimeout(() => {
        setViewingUser({ uid: reel.authorId, name: authorName, avatar: authorAvatar });
        if (onClose) onClose();
        pushPage('profile');
        setSwipeX(0);
      }, 200);
    } else {
      setIsSwiping(false);
      setSwipeX(0);
    }
    touchStartX.current = 0;
    touchStartY.current = 0;
    pinchStartDist.current = 0;
  };

  const handleTap = (e: React.MouseEvent) => {
    // If clean zoom is active, tapping anywhere restores normal UI mode!
    if (isCleanZoom) {
      setIsCleanZoom(false);
      return;
    }

    // Only toggle if not clicking on buttons
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

    const now = Date.now();
    if (now - lastTap.current < 300) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const newHeart = { id: Date.now(), x, y };
      setFloatingHearts(prev => [...prev, newHeart]);
      if (!liked) handleLike();
      setTimeout(() => setFloatingHearts(prev => prev.filter(h => h.id !== newHeart.id)), 1000);
    } else {
      setPlaying(!playing);
    }
    lastTap.current = now;
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    try {
      await deletePost(reel.id, currentUser!.uid);
      if (isModal && onClose) onClose();
    } catch (e) {
      console.error(e);
    }
  };

  const isCurrentUser = currentUser?.uid === reel.authorId;

  const demoCounts = useMemo(() => {
    const likesArray = ['35K', '356K', '342.5K', '10.4K', '8.4M', '65M', '1.2M', '500K', '125K', '89K'];
    const commentsArray = ['1.2K', '4.5K', '890', '12K', '34K', '5.6K', '450', '2.1K', '9K', '150K'];
    let hash = 0;
    for (let i = 0; i < reel.id.length; i++) {
       hash = reel.id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % likesArray.length;
    return {
      likes: likesArray[index],
      comments: commentsArray[index]
    };
  }, [reel.id]);

  const renderActivityGroup = (isMobile: boolean) => {
    // Show profile pictures on the Reel overlay: All Reposts, plus friends who interacted
    const relevantInteractions = interactions.filter(item => item.type === 'repost' || item.isFriend || item.isSelf);
    const topAvatars = relevantInteractions.slice(0, 3);
    if (topAvatars.length === 0) return null;

    const textItems = relevantInteractions.filter(item => item.type === 'repost' && item.text).slice(0, 3);

    return (
      <div 
        onClick={(e) => {
          e.stopPropagation();
          setShowInteractionsModal(true);
        }}
        className="mb-3 inline-flex items-center space-x-3 cursor-pointer group/activity pointer-events-auto select-none self-start w-fit max-w-full"
      >
        {/* Triangular profile picture group with motion animation */}
        <motion.div 
          animate={{ y: [0, -3, 0], x: [0, 1, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="relative shrink-0 flex items-center justify-center"
        >
          {topAvatars.length === 1 && (
            <div className="relative">
              <img 
                src={topAvatars[0].avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(topAvatars[0].name || 'User')}&background=random`} 
                alt="Profile" 
                className={`w-8 h-8 rounded-full object-cover shadow-md ${isMobile ? 'border-2 border-black/80' : 'border-2 border-white'}`}
              />
              <div className={`absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full shadow-xs ${topAvatars[0].type === 'repost' ? 'bg-green-500' : 'bg-red-500'}`}>
                {topAvatars[0].type === 'repost' ? <Repeat className="w-2.5 h-2.5 text-white" strokeWidth={3} /> : <Heart className="w-2.5 h-2.5 text-white fill-white" />}
              </div>
            </div>
          )}

          {topAvatars.length === 2 && (
            <div className="relative w-11 h-11">
              <div className="absolute top-0 left-0 z-10">
                <img 
                  src={topAvatars[0].avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(topAvatars[0].name || 'User')}&background=random`} 
                  alt="Profile 1" 
                  className={`w-7 h-7 rounded-full object-cover shadow-md ${isMobile ? 'border border-black/80' : 'border border-white'}`}
                />
                <div className={`absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full shadow-xs ${topAvatars[0].type === 'repost' ? 'bg-green-500' : 'bg-red-500'}`}>
                  {topAvatars[0].type === 'repost' ? <Repeat className="w-2 h-2 text-white" strokeWidth={3} /> : <Heart className="w-2 h-2 text-white fill-white" />}
                </div>
              </div>
              <div className="absolute bottom-0 right-0 z-0">
                <img 
                  src={topAvatars[1].avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(topAvatars[1].name || 'User')}&background=random`} 
                  alt="Profile 2" 
                  className={`w-7 h-7 rounded-full object-cover shadow-md ${isMobile ? 'border border-black/80' : 'border border-white'}`}
                />
                <div className={`absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full shadow-xs ${topAvatars[1].type === 'repost' ? 'bg-green-500' : 'bg-red-500'}`}>
                  {topAvatars[1].type === 'repost' ? <Repeat className="w-2 h-2 text-white" strokeWidth={3} /> : <Heart className="w-2 h-2 text-white fill-white" />}
                </div>
              </div>
            </div>
          )}

          {topAvatars.length >= 3 && (
            <div className="relative w-12 h-12">
              {/* Top Center */}
              <div className="absolute top-0 left-3 z-20">
                <img 
                  src={topAvatars[0].avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(topAvatars[0].name || 'User')}&background=random`} 
                  alt="Profile 1" 
                  className={`w-6 h-6 rounded-full object-cover shadow-md ${isMobile ? 'border border-black/80' : 'border border-white'}`}
                />
                <div className={`absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full shadow-xs ${topAvatars[0].type === 'repost' ? 'bg-green-500' : 'bg-red-500'}`}>
                  {topAvatars[0].type === 'repost' ? <Repeat className="w-2 h-2 text-white" strokeWidth={3} /> : <Heart className="w-2 h-2 text-white fill-white" />}
                </div>
              </div>
              {/* Bottom Left */}
              <div className="absolute bottom-0 left-0 z-10">
                <img 
                  src={topAvatars[1].avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(topAvatars[1].name || 'User')}&background=random`} 
                  alt="Profile 2" 
                  className={`w-6 h-6 rounded-full object-cover shadow-md ${isMobile ? 'border border-black/80' : 'border border-white'}`}
                />
                <div className={`absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full shadow-xs ${topAvatars[1].type === 'repost' ? 'bg-green-500' : 'bg-red-500'}`}>
                  {topAvatars[1].type === 'repost' ? <Repeat className="w-2 h-2 text-white" strokeWidth={3} /> : <Heart className="w-2 h-2 text-white fill-white" />}
                </div>
              </div>
              {/* Bottom Right */}
              <div className="absolute bottom-0 right-0 z-0">
                <img 
                  src={topAvatars[2].avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(topAvatars[2].name || 'User')}&background=random`} 
                  alt="Profile 3" 
                  className={`w-6 h-6 rounded-full object-cover shadow-md ${isMobile ? 'border border-black/80' : 'border border-white'}`}
                />
                <div className={`absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full shadow-xs ${topAvatars[2].type === 'repost' ? 'bg-green-500' : 'bg-red-500'}`}>
                  {topAvatars[2].type === 'repost' ? <Repeat className="w-2 h-2 text-white" strokeWidth={3} /> : <Heart className="w-2 h-2 text-white fill-white" />}
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Repost text attached directly near profile pics (NO background box, up to 3 texts displayed) */}
        {textItems.length > 0 && (
          <div className="flex flex-col space-y-0.5 max-w-[200px]">
            {textItems.map((item) => (
              <p 
                key={`${item.uid}-${item.type}`} 
                className={`text-[11px] font-normal leading-tight line-clamp-1 ${
                  isMobile 
                    ? 'text-white/95 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]' 
                    : 'text-gray-800 dark:text-neutral-200'
                }`}
              >
                "{item.text}"
              </p>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      ref={containerRef} 
      style={{ 
        transform: `translateX(${swipeX}px)`, 
        transition: isSwiping ? 'none' : 'transform 0.25s ease-out' 
      }}
      className="w-full h-full min-h-full snap-start flex items-center justify-center relative bg-black md:bg-white dark:md:bg-[#08080a] overflow-hidden shrink-0 select-none antialiased"
    >
      {isNearScreen && (
        <div className="flex flex-col md:flex-row items-center justify-center w-full h-full mx-auto relative group py-0 md:py-3 lg:py-4 md:space-x-5 lg:space-x-6 md:-translate-x-14 lg:-translate-x-20 xl:-translate-x-24 animate-in fade-in duration-150">
          
          {/* Desktop Left Info Column (Strictly Outside Reels Box on Left, At the Bottom) */}
          <div className={`hidden md:flex flex-col justify-end self-end w-[220px] lg:w-[260px] pb-6 shrink-0 transition-all duration-300 ${isCleanZoom || is2XSpeed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            {renderActivityGroup(false)}
            <div className="flex items-center space-x-3 mb-2.5">
              <img 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setViewingUser({ uid: reel.authorId, name: authorName, avatar: authorAvatar }); 
                  if (onClose) onClose();
                  pushPage('profile'); 
                }}
                src={authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=random`} 
                className="w-10 h-10 rounded-full object-cover shadow-xs cursor-pointer border border-gray-200 dark:border-white/20 active:scale-95 transition-transform shrink-0" 
                alt={authorName}
              />
              <div className="flex flex-col min-w-0">
                <div className="flex items-center space-x-1">
                  <span className="text-gray-900 dark:text-white font-semibold text-[14.5px] cursor-pointer hover:underline truncate" onClick={() => {
                     setViewingUser({ uid: reel.authorId, name: authorName, avatar: authorAvatar }); 
                     if (onClose) onClose();
                     pushPage('profile'); 
                  }}>
                    {authorName}
                  </span>
                  {(reel as any).authorIsVerified && <VerifiedBadge />}
                </div>
                {/* Audio Info Desktop */}
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSongModal(true);
                  }}
                  className="flex items-center space-x-1.5 text-gray-500 dark:text-neutral-400 hover:text-gray-800 dark:hover:text-white cursor-pointer mt-0.5 transition-colors"
                >
                   <Music className="w-3 h-3 shrink-0" strokeWidth={1.8} />
                   <span className="text-[11.5px] truncate font-normal">{reelSong ? reelSong.title : 'Original Audio'}</span>
                </div>
              </div>
              {!isCurrentUser && (
                <motion.button 
                  type="button"
                  onClick={handleToggleFollow}
                  whileTap={{ scale: 0.85 }}
                  whileHover={{ scale: 1.1 }}
                  animate={followAnimating ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 26 }}
                  className={`ml-2 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer shadow-xs select-none border shrink-0 ${
                    isFollowingUser
                      ? 'bg-sky-50/80 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300 border-sky-200/80 dark:border-sky-800/60 hover:bg-sky-100'
                      : 'bg-gradient-to-tr from-sky-400 via-sky-500 to-blue-600 text-white border-transparent shadow-sky-500/30'
                  }`}
                  title={isFollowingUser ? "Following" : "Follow"}
                >
                  <AnimatePresence mode="wait">
                    {isFollowingUser ? (
                      <motion.div
                        key="following-icon-dt"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ duration: 0.12 }}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.8]" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="follow-icon-dt"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ duration: 0.12 }}
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.8]" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              )}
            </div>
            {reel.text && (
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCaptionExpanded(!isCaptionExpanded);
                }}
                className="cursor-pointer mb-2 pr-2 group/caption select-none"
              >
                <p className={`text-gray-800 dark:text-neutral-100 text-[13.5px] font-normal leading-[1.45] ${!isCaptionExpanded ? 'line-clamp-3' : ''} break-words whitespace-pre-line`}>
                  {reel.text}
                </p>
                {reel.text.length > 70 && (
                  <button 
                    type="button"
                    className="text-[12px] font-semibold text-gray-500 dark:text-neutral-400 hover:text-black dark:hover:text-white underline mt-0.5 inline-block"
                  >
                    {isCaptionExpanded ? 'See less' : 'See more...'}
                  </button>
                )}
              </div>
            )}
          </div>

        {/* Main Video Container (Enlarged Height & Width, Balanced Top/Bottom Padding) */}
        <div 
          onClick={handleTap}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`relative w-full ${isModal ? 'h-[calc(100%-50px)] self-start' : 'h-full'} md:h-[min(calc(100dvh-54px),760px)] md:w-auto md:max-w-[428px] md:aspect-[9/16] bg-black sm:rounded-[3px] md:rounded-[10px] overflow-hidden shadow-none md:shadow-[0_6px_28px_rgba(0,0,0,0.06)] dark:md:shadow-[0_16px_40px_rgba(0,0,0,0.7)] border-0 md:border-0 dark:md:border dark:md:border-white/10 cursor-pointer flex justify-center group/video shrink-0 transition-transform duration-300 ease-out origin-center ${showComments ? 'scale-[0.88] -translate-y-4 rounded-xl shadow-2xl md:scale-100 md:translate-y-0 md:rounded-[10px] md:shadow-none' : ''}`}
        >
          {isExternalAudioSong && <audio ref={audioRef} src={reelSong.url} loop playsInline preload={playing ? "auto" : "none"} className="hidden" />}
          
          {isImageReel ? (
            <div 
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              className={`w-full h-full flex overflow-x-auto snap-x snap-mandatory hide-scrollbar touch-pan-x transition-transform duration-300 ease-out ${isCleanZoom ? 'scale-[1.08] sm:scale-110' : ''}`}
              onScroll={(e) => {
                const el = e.currentTarget;
                const index = Math.round(el.scrollLeft / el.clientWidth);
                setCurrentImageIndex(index);
              }}
            >
              {reel.media.map((url, i) => (
                <div key={i} className="w-full h-full shrink-0 snap-center flex items-center justify-center bg-black overflow-hidden">
                  <img
                    src={url}
                    className={`w-full h-auto max-h-full my-auto object-contain transition-transform duration-300 ${
                      isCleanZoom ? 'scale-[1.08] sm:scale-110' : ''
                    }`}
                    alt=""
                  />
                </div>
              ))}
            </div>
          ) : !isNearScreen ? (
            <div className="w-full h-full bg-black flex items-center justify-center">
              {(reel.thumbnailUrl || reel.thumbnail || mediaSrc || reel.media?.[0]) && (
                <img 
                  src={reel.thumbnailUrl || reel.thumbnail || mediaSrc || reel.media?.[0]} 
                  alt="" 
                  className={`w-full h-full ${(reel as any).aspectRatioFit === 'contain' ? 'object-contain' : 'object-cover'}`}
                  loading="lazy"
                />
              )}
            </div>
          ) : (
            <video 
              ref={videoRef}
              src={mediaSrc || reel.media?.[0]} 
              loop 
              muted={muted || isExternalAudioSong}
              playsInline
              // @ts-ignore
              webkit-playsinline="true"
              // @ts-ignore
              x5-playsinline="true"
              disablePictureInPicture
              controls={false}
              poster={reel.thumbnailUrl || reel.thumbnail || "data:image/gif;base64,R0lHODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}
              autoPlay={playing}
              preload={playing ? "auto" : "metadata"}
              onWaiting={() => setIsBuffering(true)}
              onPlaying={() => setIsBuffering(false)}
              onCanPlay={() => setIsBuffering(false)}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              className={`w-full h-full mx-auto ${
                (reel as any).aspectRatioFit === 'contain' ? 'object-contain bg-black' : 'object-cover'
              } transition-transform duration-300 ease-out ${
                isCleanZoom ? 'scale-[1.08] sm:scale-110' : ''
              }`}
            />
          )}

          {/* Clean seamless video view without buffering spinner */}

          {/* Clean video view without intrusive play overlay */}

          {isImageReel && reel.media.length > 1 && (
            <div className="absolute bottom-28 left-0 right-0 flex justify-center space-x-1.5 z-20 pointer-events-none">
              {reel.media.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all ${i === currentImageIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`} />
              ))}
            </div>
          )}

          {/* Top Right Hold Zone for 2X Speed & UI Hide (VIDEO REELS ONLY so photo reels can swipe horizontally) */}
          {!isImageReel && (
            <div 
              onMouseDown={handleSpeedHoldStart}
              onMouseUp={handleSpeedHoldEnd}
              onMouseLeave={handleSpeedHoldEnd}
              onTouchStart={handleSpeedHoldStart}
              onTouchEnd={handleSpeedHoldEnd}
              onTouchCancel={handleSpeedHoldEnd}
              className="absolute top-12 left-8 right-20 h-[45%] z-20 select-none cursor-pointer"
            />
          )}

          {/* 2X Speed Active Badge */}
          <AnimatePresence>
            {is2XSpeed && (
              <div className="absolute top-12 left-1/2 -translate-x-1/2 z-[60] bg-black/70 backdrop-blur-sm px-3.5 py-1 rounded-full border border-white/20 flex items-center space-x-1.5 pointer-events-none text-white text-xs font-normal shadow-md">
                <Zap className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 shrink-0" />
                <span>2x Speed</span>
              </div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {floatingHearts.map(heart => (
              <motion.div
                key={heart.id}
                initial={{ opacity: 1, scale: 0.5, y: 0 }}
                animate={{ opacity: 0, scale: 2.5, y: -200, rotate: (Math.random() - 0.5) * 40 }}
                className="absolute z-50 pointer-events-none"
                style={{ left: heart.x - 20, top: heart.y - 20 }}
              >
                <Heart className="w-12 h-12 fill-red-500 text-red-500 drop-shadow-lg" />
              </motion.div>
            ))}
          </AnimatePresence>

          <div className="md:hidden absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none"></div>

          {/* Info Bottom (Overlayed on Video - MOBILE ONLY) */}
          <div className={`md:hidden absolute ${reelBottomSpacing} left-4 right-4 z-10 text-left flex flex-col pointer-events-auto transition-all duration-300 ${isCleanZoom || is2XSpeed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            {renderActivityGroup(true)}
            {isCurrentUser && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setTargetAnalyticsPostId(reel.id);
                  setShowAnalytics(true);
                }}
                className="mb-1.5 p-2 bg-black/45 hover:bg-black/70 text-white rounded-full border border-white/20 backdrop-blur-md transition-all active:scale-90 flex items-center justify-center self-start shadow-md cursor-pointer"
                title="Analytics"
              >
                <BarChart2 className="w-3.5 h-3.5 text-white" />
              </button>
            )}
            {/* Author / Info Details Container */}
            {reelsUiStyle === 'tiktok' ? (
              /* TikTok Clean UI Layout (From User Screenshot) */
              <>
                <div className="flex items-center space-x-1.5 mb-1.5 cursor-pointer" onClick={(e) => {
                  e.stopPropagation();
                  setViewingUser({ uid: reel.authorId, name: authorName, avatar: authorAvatar });
                  if (onClose) onClose();
                  pushPage('profile');
                }}>
                  <span className="text-[15px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] hover:underline">
                    @{authorName.replace(/\s+/g, '')}
                  </span>
                  {(reel as any).authorIsVerified && <VerifiedBadge />}
                </div>

                {reel.text && (
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCaptionExpanded(!isCaptionExpanded);
                    }}
                    className="cursor-pointer mb-2 pr-12 select-none"
                  >
                    <p className={`text-white text-[13.5px] font-normal leading-[1.35] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${!isCaptionExpanded ? 'line-clamp-2' : ''} break-words`}>
                      {reel.text}
                    </p>
                    {reel.text.length > 60 && (
                      <span className="text-[12px] font-bold text-white/90 hover:text-white underline mt-0.5 inline-block">
                        {isCaptionExpanded ? 'See less' : 'See more'}
                      </span>
                    )}
                  </div>
                )}

                {/* Audio Track Info */}
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSongModal(true);
                  }}
                  className="flex items-center space-x-2 text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] cursor-pointer hover:opacity-90 max-w-[220px]"
                >
                  <Music className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                  <span className="text-[12px] font-normal truncate">
                    {reelSong ? `${reelSong.title} • ${reelSong.artist}` : `Original Sound - ${authorName}`}
                  </span>
                </div>
              </>
            ) : (
              /* Ennvo Modern UI Layout (Original) */
              <>
                <div className="flex items-center space-x-2 mb-2">
                  <img 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setViewingUser({ uid: reel.authorId, name: authorName, avatar: authorAvatar }); 
                      if (onClose) onClose();
                      pushPage('profile'); 
                    }}
                    src={authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=random`} 
                    className="w-9 h-9 rounded-full object-cover border-2 border-white/90 shadow-[0_2px_8px_rgba(0,0,0,0.3)] cursor-pointer" 
                  />
                  <div className="flex items-center space-x-1">
                    <span className="text-[15px] font-normal text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] cursor-pointer hover:underline" onClick={() => {
                       setViewingUser({ uid: reel.authorId, name: authorName, avatar: authorAvatar }); 
                       if (onClose) onClose();
                       pushPage('profile'); 
                    }}>
                      {authorName}
                    </span>
                    {(reel as any).authorIsVerified && <VerifiedBadge />}
                  </div>
                  {!isCurrentUser && (
                    <motion.button 
                      type="button"
                      onClick={handleToggleFollow}
                      whileTap={{ scale: 0.85 }}
                      whileHover={{ scale: 1.1 }}
                      animate={followAnimating ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 26 }}
                      className={`ml-2 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer shadow-sm select-none border shrink-0 ${
                        isFollowingUser
                          ? 'bg-white/25 hover:bg-white/35 text-white backdrop-blur-md border-white/35'
                          : 'bg-gradient-to-tr from-sky-400 via-sky-500 to-blue-600 text-white border-white/20 shadow-sky-500/30'
                      }`}
                      title={isFollowingUser ? "Following" : "Follow"}
                    >
                      <AnimatePresence mode="wait">
                        {isFollowingUser ? (
                          <motion.div
                            key="following-icon-mb"
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            transition={{ duration: 0.12 }}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.8]" />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="follow-icon-mb"
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            transition={{ duration: 0.12 }}
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[2.8]" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  )}
                </div>
                {reel.text && (
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCaptionExpanded(!isCaptionExpanded);
                    }}
                    className="cursor-pointer mb-2 pr-[60px] select-none"
                  >
                    <p className={`text-white text-[14px] font-normal leading-[1.4] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${!isCaptionExpanded ? 'line-clamp-2' : ''} break-words whitespace-pre-line`}>
                      {reel.text}
                    </p>
                    {reel.text.length > 50 && (
                      <button 
                        type="button"
                        className="text-[12px] font-medium text-white/90 hover:text-white underline mt-0.5 inline-block drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
                      >
                        {isCaptionExpanded ? 'See less' : 'See more...'}
                      </button>
                    )}
                  </div>
                )}
                
                {/* Audio Track Info */}
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSongModal(true);
                  }}
                  className="flex items-center space-x-2 text-white/90 max-w-[200px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] cursor-pointer hover:opacity-90 transition-opacity"
                >
                   <Music className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
                   <div className="flex flex-col overflow-hidden">
                     <span className="text-[12px] truncate font-normal">{reelSong ? reelSong.title : 'Original Audio'}</span>
                     {reelSong && <span className="text-[9px] truncate font-normal text-white/60">{reelSong.artist}</span>}
                   </div>
                </div>
              </>
            )}
          </div>

          {/* Vertical Action Buttons (Overlayed on Video - MOBILE ONLY) */}
          {reelsUiStyle === 'tiktok' ? (
            /* TikTok Clean UI Vertical Action Stack (Matches User Image) */
            <div className={`md:hidden absolute right-2.5 ${reelBottomSpacing} flex flex-col items-center space-y-4 z-40 pointer-events-auto transition-all duration-300 ${isCleanZoom || is2XSpeed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              {/* 1. Profile Avatar with Red/Pink + Follow Badge */}
              <div className="relative mb-1 flex items-center justify-center">
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingUser({ uid: reel.authorId, name: authorName, avatar: authorAvatar });
                    if (onClose) onClose();
                    pushPage('profile');
                  }}
                  className="w-[48px] h-[48px] rounded-full border-2 border-white overflow-hidden shadow-lg cursor-pointer active:scale-95 transition-transform"
                >
                  <img 
                    src={authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=random`} 
                    className="w-full h-full object-cover" 
                    alt={authorName} 
                  />
                </div>
                {!isCurrentUser && !isFollowingUser && (
                  <motion.button 
                    type="button"
                    onClick={handleToggleFollow}
                    whileTap={{ scale: 0.85 }}
                    whileHover={{ scale: 1.15 }}
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 bg-gradient-to-tr from-sky-400 to-blue-600 rounded-full flex items-center justify-center text-white shadow-md shadow-sky-500/40 cursor-pointer border-1.5 border-white transition-all select-none"
                    title="Follow"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  </motion.button>
                )}
              </div>

              {/* 2. Like (Heart) */}
              <div 
                onClick={(e) => { e.stopPropagation(); handleLike(); }} 
                className="flex flex-col items-center cursor-pointer select-none active:scale-90 transition-transform"
              >
                <div className="transition-transform duration-200 active:scale-75 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" style={liked ? {color: '#fe2c55', filter: 'drop-shadow(0 0 8px rgba(254, 44, 85, 0.6))'} : {}}>
                  <Heart className={`w-8 h-8 ${liked ? 'fill-[#fe2c55] text-[#fe2c55]' : 'text-white fill-white stroke-[1.5]'}`} />
                </div>
                <span className="text-white text-[12px] font-bold mt-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  {demoCounts.likes}
                </span>
              </div>

              {/* 3. Comment */}
              <div 
                onClick={(e) => { e.stopPropagation(); setShowComments(true); }} 
                className="flex flex-col items-center cursor-pointer select-none active:scale-90 transition-transform"
              >
                <div className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center">
                  {/* @ts-ignore */}
                  <ion-icon name="chatbubble-ellipses-outline" style={{ fontSize: '32px' }}></ion-icon>
                </div>
                <span className="text-white text-[12px] font-bold mt-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  {demoCounts.comments}
                </span>
              </div>

              {/* 4. Bookmark (Save) */}
              <div 
                onClick={(e) => { e.stopPropagation(); handleFavorite(); }} 
                className="flex flex-col items-center cursor-pointer select-none active:scale-90 transition-transform"
              >
                <div className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" style={saved ? {color: '#FFD700', filter: 'drop-shadow(0 0 6px rgba(255, 215, 0, 0.6))'} : {}}>
                  <Bookmark className={`w-8 h-8 ${saved ? 'fill-[#FFD700] text-[#FFD700]' : 'text-white fill-white'}`} />
                </div>
                <span className="text-white text-[12px] font-bold mt-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  {demoCounts.bookmarks || '441'}
                </span>
              </div>

              {/* 5. Share */}
              <div 
                onClick={(e) => { e.stopPropagation(); setShowShare(true); }} 
                className="flex flex-col items-center cursor-pointer select-none active:scale-90 transition-transform"
              >
                <div className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                  <svg className="w-8 h-8 fill-white" viewBox="0 0 24 24">
                    <path d="M14 5v4C7 10 4 15 3 20c2.5-3.5 6-5.1 11-5.1V19l8-7-8-7z"/>
                  </svg>
                </div>
                <span className="text-white text-[12px] font-bold mt-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  {demoCounts.shares || '1,947'}
                </span>
              </div>

              {/* 6. Spinning Vinyl Record */}
              <div 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setShowSongModal(true);
                }}
                className={`w-10 h-10 rounded-full bg-[#111] border-[2.5px] border-[#2a2a2a] p-1 flex items-center justify-center overflow-hidden shadow-xl cursor-pointer mt-1 active:scale-95 transition-transform relative ${playing ? 'animate-[spin_4s_linear_infinite]' : ''}`}
              >
                <img src={reel.authorAvatar || `https://ui-avatars.com/api/?name=Music`} className="w-6 h-6 rounded-full object-cover" />
                {isSongSaved && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                    <Bookmark className="w-3 h-3 text-white fill-white" />
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Original Ennvo Modern UI Vertical Action Buttons */
            <div className={`md:hidden absolute right-2.5 ${reelBottomSpacing} flex flex-col items-center space-y-2.5 z-40 pointer-events-auto transition-all duration-300 ${isCleanZoom || is2XSpeed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              <div 
                onClick={(e) => { e.stopPropagation(); handleLike(); }} 
                onTouchStart={(e) => { e.stopPropagation(); }}
                className={`flex flex-col items-center cursor-pointer select-none active:scale-90 transition-transform ${liked ? 'liked' : ''}`}
              >
                <div className="w-8 h-8 flex items-center justify-center text-white/95 drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform duration-200 active:scale-75" style={liked ? {color: '#fe2c55', filter: 'drop-shadow(0 0 6px rgba(254, 44, 85, 0.5))'} : {}}>
                  <IonHeartIcon filled={liked} className="w-[1.85rem] h-[1.85rem]" />
                </div>
                <span className="text-white text-[0.75rem] font-medium mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{demoCounts.likes}</span>
              </div>
              
              <div onClick={(e) => { e.stopPropagation(); setShowComments(true); }} className="flex flex-col items-center cursor-pointer">
                <div className="w-8 h-8 flex items-center justify-center text-white/95 drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform duration-200 active:scale-75">
                  <IonChatIcon className="w-[1.85rem] h-[1.85rem]" />
                </div>
                <span className="text-white text-[0.75rem] font-medium mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{demoCounts.comments}</span>
              </div>
              
              <div onClick={(e) => { e.stopPropagation(); handleFavorite(); }} className={`flex flex-col items-center cursor-pointer ${saved ? 'saved' : ''}`}>
                <div className="w-8 h-8 flex items-center justify-center text-white/95 drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform duration-200 active:scale-75" style={saved ? {color: '#FFD700', filter: 'drop-shadow(0 0 5px rgba(255, 215, 0, 0.4))'} : {}}>
                  <IonBookmarkIcon filled={saved} className="w-[1.85rem] h-[1.85rem]" />
                </div>
                <span className="text-white text-[0.75rem] font-medium mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">Save</span>
              </div>

              <div onClick={(e) => { e.stopPropagation(); setShowShare(true); }} className="flex flex-col items-center cursor-pointer">
                <div className="w-8 h-8 flex items-center justify-center text-white/95 drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform duration-200 active:scale-75">
                  <IonShareIcon className="w-[1.85rem] h-[1.85rem]" />
                </div>
                <span className="text-white text-[0.75rem] font-medium mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">Share</span>
              </div>

              {/* Spinning Record */}
              <div 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setShowSongModal(true);
                }}
                className={`w-9 h-9 rounded-full border border-white/30 bg-[#111] flex items-center justify-center overflow-hidden shadow-[0_0_12px_rgba(0,0,0,0.8)] cursor-pointer mt-1 active:scale-95 transition-transform relative ${playing ? 'animate-[spin_4s_linear_infinite]' : ''}`}
              >
                <img src={reel.authorAvatar || `https://ui-avatars.com/api/?name=Music`} className="w-5 h-5 rounded-full object-cover" />
                {isSongSaved && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                    <Bookmark className="w-3 h-3 text-white fill-white" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Simple lightweight Sound / Mute toggle button centered on video when stopped or paused */}
          {!(isImageReel && !reelSong) && isNearScreen && (
            <button 
              onClick={(e) => { e.stopPropagation(); setMuted(!muted); }}
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-opacity flex items-center justify-center cursor-pointer ${playing ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}
              title={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
            </button>
          )}

          {/* Timeline / Progress Bar (ONLY in Classic Navigation: Flush right above bottom nav without dipping or overlapping) */}
          {!isImageReel && isNearScreen && navStyle !== 'glass' && (
            <div 
              className={`absolute ${isModal ? 'bottom-0' : 'bottom-[calc(54px+env(safe-area-inset-bottom))] md:bottom-0'} left-0 right-0 z-[70] flex flex-col justify-end h-4 cursor-pointer touch-none select-none group/timeline transition-opacity duration-200 ${(!playing || isScrubbing) ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
              onPointerDown={handleScrubPointerDown}
              onPointerMove={handleScrubPointerMove}
              onPointerUp={handleScrubPointerUp}
              onPointerCancel={handleScrubPointerUp}
            >
              {/* Floating Time Preview Bubble during Scrubbing */}
              {isScrubbing && (
                <div 
                  className="absolute -top-7 px-2.5 py-1 rounded-full bg-black/90 text-white text-[11px] font-medium shadow-md -translate-x-1/2 pointer-events-none z-[85] flex items-center space-x-1"
                  style={{ left: scrubberThumbRef.current?.style.left || '50%' }}
                >
                  <span className="text-white">{formatScrubSecs(scrubTime)}</span>
                  <span className="text-white/40">/</span>
                  <span className="text-white/75">{formatScrubSecs(videoRef.current?.duration || 0)}</span>
                </div>
              )}

              {/* Progress Track */}
              <div className={`w-full ${isScrubbing ? 'h-[3.5px]' : 'h-[2px] group-hover/timeline:h-[3px]'} bg-white/35 relative transition-[height] duration-150 overflow-visible`}>
                {/* Active Progress Fill */}
                <div 
                  ref={progressBarRef} 
                  className="h-full bg-white relative" 
                  style={{ width: '0%', transition: 'none' }}
                />
                {/* Thumb Dot: Sits cleanly right on the track and strictly above navigation bar */}
                <div 
                  ref={scrubberThumbRef}
                  className={`absolute -top-[3.5px] -translate-x-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-[0_1px_4px_rgba(0,0,0,0.6)] pointer-events-none transition-transform duration-100 z-[80] ${isScrubbing || !playing ? 'scale-100 opacity-100' : 'scale-0 opacity-0 group-hover/timeline:scale-100 group-hover/timeline:opacity-100'}`}
                  style={{ left: '0%' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Desktop Right Actions Column (Clean Soft Icons - Lowered & Slightly Bigger) */}
        <div className={`hidden md:flex flex-col items-center justify-end self-end space-y-3.5 pb-5 lg:pb-7 px-1 w-[60px] shrink-0 transition-opacity duration-200 select-none ${isCleanZoom ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          {/* Like */}
          <div 
            onClick={(e) => { e.stopPropagation(); handleLike(); }} 
            className="flex flex-col items-center cursor-pointer group select-none active:scale-90 transition-transform"
            title="Like"
          >
            <div 
              className="w-9 h-9 transition-transform duration-150 group-hover:scale-110 text-neutral-800 dark:text-neutral-100 flex items-center justify-center" 
              style={{ ...((liked ? { color: '#fe2c55' } : {})) }}
            >
              <IonHeartIcon filled={liked} className="w-7 h-7" />
            </div>
            <span className="text-[12px] font-normal text-neutral-600 dark:text-neutral-300 select-none mt-0.5">
              {demoCounts.likes}
            </span>
          </div>
          
          {/* Comment */}
          <div 
            onClick={(e) => { e.stopPropagation(); setShowComments(true); }} 
            className="flex flex-col items-center cursor-pointer group select-none active:scale-90 transition-transform"
            title="Comments"
          >
            <div className="w-9 h-9 transition-transform duration-150 group-hover:scale-110 text-neutral-800 dark:text-neutral-100 flex items-center justify-center">
              <IonChatIcon className="w-7 h-7" />
            </div>
            <span className="text-[12px] font-normal text-neutral-600 dark:text-neutral-300 select-none mt-0.5">
              {demoCounts.comments}
            </span>
          </div>

          {/* Share (Curved arrow exactly like mobile) */}
          <div 
            onClick={(e) => { e.stopPropagation(); setShowShare(true); }} 
            className="flex flex-col items-center cursor-pointer group select-none active:scale-90 transition-transform"
            title="Share"
          >
            <div className="w-9 h-9 transition-transform duration-150 group-hover:scale-110 text-neutral-800 dark:text-neutral-100 flex items-center justify-center">
              <IonShareIcon className="w-7 h-7" />
            </div>
            <span className="text-[12px] font-normal text-neutral-600 dark:text-neutral-300 select-none mt-0.5">
              Share
            </span>
          </div>

          {/* Favorite / Save */}
          <div 
            onClick={(e) => { e.stopPropagation(); handleFavorite(); }} 
            className="flex flex-col items-center cursor-pointer group select-none active:scale-90 transition-transform"
            title="Save"
          >
            <div 
              className="w-9 h-9 transition-transform duration-150 group-hover:scale-110 text-neutral-800 dark:text-neutral-100 flex items-center justify-center" 
              style={{ ...((saved ? { color: '#FFD700' } : {})) }}
            >
              <IonBookmarkIcon filled={saved} className="w-7 h-7" />
            </div>
          </div>

          {/* More (...) */}
          <div 
            onClick={(e) => { e.stopPropagation(); setShowShare(true); }} 
            className="flex flex-col items-center cursor-pointer group select-none active:scale-90 transition-transform"
            title="More"
          >
            <div className="w-9 h-9 transition-transform duration-150 group-hover:scale-110 text-neutral-800 dark:text-neutral-100 flex items-center justify-center">
              <IonMoreIcon className="w-6 h-6" />
            </div>
          </div>

          {/* Circular Vinyl Audio Disc - Identical to Mobile */}
          <div 
            onClick={(e) => { 
              e.stopPropagation(); 
              setShowSongModal(true);
            }}
            title="Audio"
            className={`w-10 h-10 rounded-full border border-gray-300 dark:border-white/20 bg-[#111] flex items-center justify-center overflow-hidden shadow-xs cursor-pointer mt-0.5 active:scale-95 transition-transform relative ${playing ? 'animate-[spin_4s_linear_infinite]' : ''}`}
          >
            <img src={reel.authorAvatar || `https://ui-avatars.com/api/?name=Music`} className="w-6 h-6 rounded-full object-cover" />
            {isSongSaved && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                <Bookmark className="w-3.5 h-3.5 text-white fill-white" />
              </div>
            )}
          </div>
        </div>

        {/* Navigation Indicators (Right far - PC ONLY for Modal) */}
        {isModal && (
          <div className="hidden md:flex flex-col items-center absolute right-3 lg:right-6 top-1/2 -translate-y-1/2 z-50 reels-pc-glass-nav p-1.5 rounded-full select-none shadow-xl pointer-events-auto">
             <button 
               onClick={(e) => {
                 e.stopPropagation();
                 const c = document.getElementById('global-reels-container') || document.documentElement;
                 c.scrollBy({ top: -window.innerHeight, behavior: 'smooth' });
               }}
               title="Previous Reel"
               aria-label="Previous Reel"
               className="w-10 h-10 rounded-full flex items-center justify-center text-gray-800 dark:text-white hover:bg-black/8 dark:hover:bg-white/15 transition-all active:scale-90 cursor-pointer"
             >
               <ChevronUp className="w-5.5 h-5.5 stroke-[2.4]" />
             </button>
             <div className="w-5 h-[1px] bg-black/10 dark:bg-white/15 my-0.5" />
             <button 
               onClick={(e) => {
                 e.stopPropagation();
                 const c = document.getElementById('global-reels-container') || document.documentElement;
                 c.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
               }}
               title="Next Reel"
               aria-label="Next Reel"
               className="w-10 h-10 rounded-full flex items-center justify-center text-gray-800 dark:text-white hover:bg-black/8 dark:hover:bg-white/15 transition-all active:scale-90 cursor-pointer"
             >
               <ChevronDown className="w-5.5 h-5.5 stroke-[2.4]" />
             </button>
          </div>
        )}

        {/* Ultra-Clean, Modern Bottom Comment Bar for Reel Modal */}
        {isModal && (
          <div 
            onClick={(e) => { e.stopPropagation(); setShowComments(true); }}
            className="md:hidden absolute bottom-3 inset-x-3.5 h-[52px] bg-neutral-950/85 backdrop-blur-2xl border border-white/15 rounded-full flex items-center px-3 z-[90] space-x-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.55)] mb-[env(safe-area-inset-bottom)] cursor-pointer active:scale-[0.985] transition-transform select-none group"
          >
            {/* User Avatar with soft glow border */}
            <div className="relative shrink-0">
              <img 
                src={currentUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || 'User')}&background=0284c7&color=fff`} 
                className="w-8 h-8 rounded-full object-cover ring-2 ring-white/25 shadow-xs" 
                alt="My avatar"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Fake Input Pill with Placeholder */}
            <div className="flex-1 flex items-center bg-white/10 hover:bg-white/15 border border-white/10 rounded-full px-3.5 py-1.5 transition-colors">
              <span className="text-[13px] text-white/70 font-medium tracking-tight">
                Add a comment...
              </span>
            </div>

            {/* Quick Emojis & Comment Icon */}
            <div className="flex items-center space-x-1.5 shrink-0 pr-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLike();
                }}
                className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-sm transition-transform active:scale-125"
                title="Like"
              >
                <Heart className={`w-4.5 h-4.5 transition-colors ${liked ? 'fill-rose-500 text-rose-500' : 'text-white/80'}`} />
              </button>
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/90">
                <MessageCircle className="w-4.5 h-4.5" />
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Action Menu Popover Removed */}

      {/* Overlays */}
      <AnimatePresence>
        {showComments && (
          <CommentsPortal 
            postId={reel.id} 
            onClose={() => setShowComments(false)} 
            authorId={reel.authorId}
            authorName={reel.authorName}
            authorAvatar={reel.authorAvatar}
            media={reel.media?.[0]} 
            initialReply={replyTo}
            onClearReply={() => setReplyTo(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showShare && (
          <SharePortal 
            reel={reel} 
            onClose={() => setShowShare(false)} 
            isCurrentUser={isCurrentUser}
            hasReposted={reposted}
            onRepost={handleRepost}
            onDelete={handleDelete}
            confirmingDelete={confirmDelete}
          />
        )}
      </AnimatePresence>
      {(showRepostModal || showInteractionsModal) && (
        <RepostMenuModal 
          reelId={reel.id}
          authorId={reel.authorId || (reel as any).authorUID || (reel as any).userId}
          authorName={reel.authorName}
          authorAvatar={reel.authorAvatar}
          reelMedia={reel.media?.[0]}
          interactions={interactions}
          reposted={reposted}
          initialTab={showInteractionsModal ? 'all' : 'reposts'}
          onRepostChange={(isNow, countChange) => {
            setReposted(isNow);
            if (countChange !== undefined) {
              setRepostsCount(prev => Math.max(0, prev + countChange));
            }
          }}
          onClose={() => {
            setShowRepostModal(false);
            setShowInteractionsModal(false);
          }}
          onSelectUser={(user) => {
            setViewingUser({ uid: user.uid, name: user.name, avatar: user.avatar });
            if (onClose) onClose();
            pushPage('profile');
          }}
        />
      )}

      {showSongModal && createPortal(
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowSongModal(false)}
          className="fixed inset-0 z-[250] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 touch-manipulation"
        >
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: "0%" }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#18191c] rounded-t-[28px] sm:rounded-3xl w-full max-w-md p-6 flex flex-col shadow-2xl relative overflow-hidden text-gray-900 dark:text-white border-t sm:border border-gray-100 dark:border-white/10"
          >
            <button 
              onClick={() => setShowSongModal(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 dark:text-neutral-400 hover:text-gray-600 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center pt-2 pb-2">
              <div className="relative w-20 h-20 rounded-full bg-gray-900 border-4 border-gray-800 shadow-xl flex items-center justify-center mb-4 animate-[spin_6s_linear_infinite]">
                <img 
                  src={reel.authorAvatar || `https://ui-avatars.com/api/?name=Music`} 
                  alt="Song Cover" 
                  className="w-10 h-10 rounded-full object-cover border-2 border-white" 
                />
                <div className="absolute inset-0 rounded-full border border-white/20"></div>
              </div>

              <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-snug">
                {reelSong ? reelSong.title : 'Original Audio'}
              </h3>
              <p className="text-xs font-medium text-gray-500 dark:text-neutral-400 mt-1">
                {reelSong ? reelSong.artist : authorName}
              </p>

              <div className="w-full flex flex-col space-y-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    const songObj = {
                      id: reelSong?.id || reel.id,
                      title: reelSong ? reelSong.title : 'Original Audio',
                      artist: reelSong ? reelSong.artist : authorName,
                      url: reelSong ? reelSong.url : (reel.media?.[0] || ''),
                      cover: reelSong ? reelSong.cover : (authorAvatar || '')
                    };
                    setSelectedCreateSong(songObj);
                    setShowSongModal(false);
                    if (onClose) onClose();
                    pushPage('create');
                  }}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3.5 px-4 rounded-2xl shadow-lg shadow-purple-500/25 hover:opacity-95 transition-all active:scale-98 flex items-center justify-center space-x-2 text-sm"
                >
                  <Music className="w-4.5 h-4.5 text-white" />
                  <span>Use This Song & Create Video</span>
                </button>

                {currentUser && (
                  <button
                    type="button"
                    onClick={async () => {
                      const songId = reelSong?.id || reel.id;
                      const songData = {
                        id: songId,
                        title: reelSong ? reelSong.title : 'Original Audio',
                        artist: reelSong ? reelSong.artist : authorName,
                        url: reelSong ? reelSong.url : (reel.media?.[0] || ''),
                        cover: reelSong ? reelSong.cover : (authorAvatar || '')
                      };
                      await toggleSongFavorite(songId, currentUser.uid, songData);
                    }}
                    className={`w-full font-semibold py-3 px-4 rounded-2xl border transition-all active:scale-98 flex items-center justify-center space-x-2 text-sm ${
                      isSongSaved 
                        ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300' 
                        : 'bg-white dark:bg-[#121214] border-gray-200 dark:border-white/10 text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <Bookmark className={`w-4 h-4 ${isSongSaved ? 'fill-purple-700 dark:fill-purple-300 text-purple-700 dark:text-purple-300' : 'text-gray-600 dark:text-neutral-400'}`} />
                    <span>{isSongSaved ? 'Saved in Favorite Songs' : 'Save Song to Favorites'}</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>,
        document.body
      )}
    </div>
  );
});

export interface RepostMenuModalProps {
  reelId: string;
  authorId?: string;
  authorName?: string;
  authorAvatar?: string;
  reelMedia?: string;
  interactions: InteractionItem[];
  reposted: boolean;
  initialTab?: 'reposts' | 'all' | 'likes';
  onRepostChange: (isNowReposted: boolean, countChange?: number) => void;
  onClose: () => void;
  onSelectUser: (user: { uid: string; name: string; avatar: string }) => void;
}

const RepostMenuModal: React.FC<RepostMenuModalProps> = ({
  reelId,
  authorId,
  authorName,
  authorAvatar,
  reelMedia,
  interactions,
  reposted,
  initialTab = 'reposts',
  onRepostChange,
  onClose,
  onSelectUser
}) => {
  const { currentUser } = useAppStore();
  const [filter, setFilter] = useState<'reposts' | 'likes'>(initialTab === 'likes' ? 'likes' : 'reposts');
  
  // Realtime state for activity likes & replies
  const [activityLikes, setActivityLikes] = useState<Record<string, string[]>>({});
  const [activityReplies, setActivityReplies] = useState<Record<string, any[]>>({});
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [replyTarget, setReplyTarget] = useState<InteractionItem | null>(null);
  const [replyInputText, setReplyInputText] = useState<string>('');
  const [repostInputText, setRepostInputText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  // Subscribe to activity likes for this reel
  useEffect(() => {
    if (!reelId) return;
    const likesRef = collection(db, 'posts', reelId, 'activityLikes');
    const unsub = onSnapshot(likesRef, (snap) => {
      const likesMap: Record<string, string[]> = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.targetKey && data.likedByUid) {
          if (!likesMap[data.targetKey]) likesMap[data.targetKey] = [];
          likesMap[data.targetKey].push(data.likedByUid);
        }
      });
      setActivityLikes(likesMap);
    }, (err) => console.warn("Activity likes snapshot err:", err));
    return () => unsub();
  }, [reelId]);

  // Subscribe to activity replies for this reel
  useEffect(() => {
    if (!reelId) return;
    const repliesRef = collection(db, 'posts', reelId, 'activityReplies');
    const unsub = onSnapshot(repliesRef, (snap) => {
      const repliesMap: Record<string, any[]> = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.targetKey) {
          if (!repliesMap[data.targetKey]) repliesMap[data.targetKey] = [];
          repliesMap[data.targetKey].push({ id: d.id, ...data });
        }
      });
      // Sort replies by createdAt ascending
      Object.keys(repliesMap).forEach(key => {
        repliesMap[key].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      });
      setActivityReplies(repliesMap);
    }, (err) => console.warn("Activity replies snapshot err:", err));
    return () => unsub();
  }, [reelId]);

  const repostItems = useMemo(() => {
    return interactions.filter(i => i.type === 'repost');
  }, [interactions]);

  const likeItems = useMemo(() => {
    return interactions.filter(i => i.type === 'like');
  }, [interactions]);

  const myExistingRepost = useMemo(() => {
    return interactions.find(i => i.type === 'repost' && (i.isSelf || i.uid === currentUser?.uid));
  }, [interactions, currentUser?.uid]);

  const hasUserReposted = Boolean(reposted || myExistingRepost);

  // Pre-fill user's existing caption if any
  useEffect(() => {
    if (myExistingRepost && myExistingRepost.text && !repostInputText) {
      setRepostInputText(myExistingRepost.text);
    }
  }, [myExistingRepost]);

  const handleDeleteMyRepost = async () => {
    if (!currentUser) return;
    setIsSubmitting(true);
    try {
      await toggleRepost(reelId, currentUser.uid);
      onRepostChange(false, -1);
      setRepostInputText('');
    } catch (e) {
      console.error("Error deleting repost:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveRepost = async () => {
    if (!currentUser) return;
    setIsSubmitting(true);
    try {
      const isNowReposted = await toggleRepost(reelId, currentUser.uid, currentUser, repostInputText.trim());
      onRepostChange(isNowReposted, hasUserReposted ? 0 : 1);
      if (isNowReposted && !hasUserReposted) {
        const targetAuthorId = authorId || reelId;
        await sendNotification(
          targetAuthorId, 
          'repost', 
          currentUser, 
          reelId, 
          reelId, 
          reelMedia, 
          null, 
          authorName, 
          authorAvatar
        );
      }
    } catch (e) {
      console.error("Error submitting repost:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReply = async (targetItem: InteractionItem) => {
    if (!currentUser) return;
    const targetKey = `${targetItem.uid}_${targetItem.type}`;
    const text = replyInputText.trim();
    if (!text) return;

    try {
      await addDoc(collection(db, 'posts', reelId, 'activityReplies'), {
        targetKey,
        targetUid: targetItem.uid,
        authorUid: currentUser.uid,
        authorName: currentUser.name || 'User',
        authorAvatar: currentUser.avatar || '',
        text,
        createdAt: Date.now()
      });

      if (targetItem.uid !== currentUser.uid) {
        await sendNotification(
          targetItem.uid, 
          'comment', 
          currentUser, 
          reelId, 
          reelId, 
          reelMedia, 
          null, 
          currentUser.name, 
          currentUser.avatar
        );
      }

      setReplyInputText('');
      setReplyTarget(null);
      setExpandedReplies(prev => ({ ...prev, [targetKey]: true }));
    } catch (e) {
      console.error("Error sending reply:", e);
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    try {
      await deleteDoc(doc(db, 'posts', reelId, 'activityReplies', replyId));
    } catch (e) {
      console.error("Error deleting reply:", e);
    }
  };

  const handleStartEditReply = (reply: any) => {
    setEditingReplyId(reply.id);
    setEditingText(reply.text || '');
  };

  const handleSaveEditReply = async (replyId: string) => {
    if (!editingText.trim()) return;
    try {
      await updateDoc(doc(db, 'posts', reelId, 'activityReplies', replyId), {
        text: editingText.trim(),
        updatedAt: Date.now()
      });
      setEditingReplyId(null);
    } catch (e) {
      console.error("Error updating reply:", e);
    }
  };

  const toggleLikeActivity = async (item: InteractionItem) => {
    if (!currentUser) return;
    const targetKey = `${item.uid}_${item.type}`;
    const userLikes = activityLikes[targetKey] || [];
    const isLiked = userLikes.includes(currentUser.uid);
    const likeDocId = `${targetKey}_${currentUser.uid}`;
    const likeRef = doc(db, 'posts', reelId, 'activityLikes', likeDocId);

    try {
      if (isLiked) {
        await deleteDoc(likeRef);
      } else {
        await setDoc(likeRef, {
          targetKey,
          targetUid: item.uid,
          targetType: item.type,
          likedByUid: currentUser.uid,
          likedByName: currentUser.name || 'User',
          createdAt: Date.now()
        });

        if (item.uid !== currentUser.uid) {
          await sendNotification(
            item.uid, 
            'like', 
            currentUser, 
            reelId, 
            reelId, 
            reelMedia, 
            null, 
            currentUser.name, 
            currentUser.avatar
          );
        }
      }
    } catch (e) {
      console.error("Error toggling activity like:", e);
    }
  };

  return createPortal(
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16, ease: "linear" }}
      className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center bg-black/40 md:p-4 touch-manipulation backdrop-blur-xs"
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: "0%" }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
        style={{ transform: 'translateZ(0)', willChange: 'transform' }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#0c121e] text-slate-900 dark:text-white rounded-t-[32px] sm:rounded-3xl w-full max-w-lg h-[75vh] sm:h-[80dvh] max-h-[750px] flex flex-col overflow-hidden shadow-2xl transform-gpu border-t sm:border border-sky-100 dark:border-sky-900/40 relative"
      >
        {/* Mobile Grab Handle */}
        <div className="w-10 h-1 bg-sky-200 dark:bg-sky-900/60 rounded-full mx-auto my-2.5 shrink-0 sm:hidden" />

        {/* Clean Header */}
        <div className="flex justify-between items-center px-4 py-2.5 border-b border-sky-100/80 dark:border-sky-900/30 flex-shrink-0 bg-white/95 dark:bg-[#0c121e]/95 backdrop-blur-md">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Repeat className="w-4 h-4" strokeWidth={2.5} />
            </div>
            <div className="flex items-center space-x-1.5">
              <h3 className="font-bold text-slate-900 dark:text-white text-[15px]">Reposts & Activity</h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-800/40">
                {repostItems.length}
              </span>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/50 border border-sky-100 dark:border-sky-800/40 rounded-full transition-colors active:scale-95 text-sky-700 dark:text-sky-300 cursor-pointer" 
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Clean Filter Tabs */}
        <div className="flex border-b border-sky-100/80 dark:border-sky-900/30 px-4 pt-1 space-x-3 bg-white dark:bg-[#0c121e] shrink-0">
          <button 
            type="button"
            onClick={() => setFilter('reposts')}
            className={`pb-2.5 px-2 text-xs font-medium border-b-2 transition-colors flex items-center space-x-1.5 cursor-pointer ${
              filter === 'reposts' 
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold' 
                : 'border-transparent text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>Reposts ({repostItems.length})</span>
          </button>
          <button 
            type="button"
            onClick={() => setFilter('likes')}
            className={`pb-2.5 px-2 text-xs font-medium border-b-2 transition-colors flex items-center space-x-1.5 cursor-pointer ${
              filter === 'likes' 
                ? 'border-rose-500 text-rose-600 dark:text-rose-400 font-semibold' 
                : 'border-transparent text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>Likes ({likeItems.length})</span>
          </button>
        </div>

        {/* Scrollable Repost List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar bg-white dark:bg-[#0c121e]">
          {filter === 'reposts' ? (
            repostItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-neutral-500">
                <div className="w-14 h-14 rounded-full bg-green-50 dark:bg-green-950/30 flex items-center justify-center text-green-500/40 mb-3">
                  <Repeat className="w-7 h-7" strokeWidth={1.8} />
                </div>
                <p className="font-medium text-sm text-gray-800 dark:text-neutral-200">No reposts yet</p>
                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1 max-w-xs text-center">
                  Be the first to repost this reel with your thoughts using the box below!
                </p>
              </div>
            ) : (
              repostItems.map((item) => {
                const targetKey = `${item.uid}_${item.type}`;
                const likesList = activityLikes[targetKey] || [];
                const isLiked = currentUser ? likesList.includes(currentUser.uid) : false;
                const repliesList = activityReplies[targetKey] || [];
                const isExpanded = expandedReplies[targetKey] || false;
                const isTargetReply = replyTarget?.uid === item.uid;

                return (
                  <div 
                    key={targetKey}
                    className={`p-3.5 rounded-2xl bg-gray-50/80 dark:bg-white/[0.04] border border-gray-100 dark:border-white/10 transition-all flex flex-col space-y-2.5 ${
                      isTargetReply ? 'ring-2 ring-blue-500/40' : ''
                    }`}
                  >
                    {/* Header Row: Avatar, Name, Timestamp, Delete */}
                    <div className="flex items-start justify-between">
                      <div 
                        onClick={() => {
                          onSelectUser({ uid: item.uid, name: item.name, avatar: item.avatar });
                          onClose();
                        }}
                        className="flex items-center space-x-2.5 cursor-pointer flex-1 min-w-0"
                      >
                        <div className="relative shrink-0">
                          <img 
                            src={item.avatar} 
                            alt={item.name} 
                            className="w-9 h-9 rounded-full object-cover border border-gray-100 dark:border-white/10 shadow-2xs"
                          />
                          <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-green-500 text-white shadow-2xs">
                            <Repeat className="w-2.5 h-2.5" strokeWidth={3} />
                          </div>
                        </div>

                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                              {item.isSelf ? 'You' : item.name}
                            </span>
                            {item.isFriend && (
                              <span className="text-[10px] font-medium bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.2 rounded-full shrink-0">
                                Friend
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 dark:text-neutral-500">
                            {formatTime(item.updatedAt)}
                          </span>
                        </div>
                      </div>

                      {/* Delete Repost Button if self */}
                      {item.isSelf && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMyRepost();
                          }}
                          disabled={isSubmitting}
                          className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-1 rounded-md transition-colors flex items-center space-x-1 text-xs"
                          title="Delete Repost"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-medium hidden sm:inline">Delete</span>
                        </button>
                      )}
                    </div>

                    {/* Thought / Caption Quote */}
                    {item.text ? (
                      <div className="px-3 py-2 rounded-xl bg-white dark:bg-black/30 border border-gray-100/90 dark:border-white/5">
                        <p className="text-[13px] text-gray-800 dark:text-neutral-100 font-normal leading-relaxed break-words whitespace-pre-line">
                          {item.text}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-neutral-500 italic font-normal">
                        Reposted this reel
                      </p>
                    )}

                    {/* Action Bar: Like, Reply, See Replies */}
                    <div className="flex items-center justify-between pt-1 border-t border-gray-100/80 dark:border-white/5 text-xs text-gray-500 dark:text-neutral-400">
                      <div className="flex items-center space-x-4">
                        {/* Like Repost */}
                        <button 
                          onClick={() => toggleLikeActivity(item)}
                          className="flex items-center space-x-1 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Heart 
                            className={`w-3.5 h-3.5 transition-transform active:scale-125 ${
                              isLiked ? 'fill-red-500 text-red-500' : 'text-gray-400 dark:text-neutral-400'
                            }`} 
                          />
                          {likesList.length > 0 && (
                            <span className="text-[11px] font-medium">{likesList.length}</span>
                          )}
                        </button>

                        {/* Reply to Repost */}
                        <button 
                          onClick={() => {
                            setReplyTarget(item);
                            setReplyInputText(`@${item.isSelf ? 'user' : item.name} `);
                          }}
                          className="flex items-center space-x-1 hover:text-gray-900 dark:hover:text-white font-medium transition-colors cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Reply</span>
                          {repliesList.length > 0 && (
                            <span className="text-[11px] font-medium ml-0.5">({repliesList.length})</span>
                          )}
                        </button>
                      </div>

                      {/* Expand / Collapse Replies */}
                      {repliesList.length > 0 && (
                        <button 
                          onClick={() => setExpandedReplies(prev => ({ ...prev, [targetKey]: !isExpanded }))}
                          className="text-blue-600 dark:text-blue-400 hover:underline text-[11px] font-medium flex items-center space-x-1 transition-colors cursor-pointer"
                        >
                          <span>{isExpanded ? 'Hide replies' : `View replies (${repliesList.length})`}</span>
                          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>

                    {/* Nested Replies List */}
                    {isExpanded && repliesList.length > 0 && (
                      <div className="ml-3 pl-3 border-l-2 border-gray-100 dark:border-white/10 space-y-2 pt-1">
                        {repliesList.map((reply) => (
                          <div key={reply.id} className="flex items-start space-x-2 text-xs">
                            <img 
                              src={reply.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(reply.authorName || 'User')}&background=random`} 
                              alt={reply.authorName} 
                              className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5 border border-gray-100 dark:border-white/10 cursor-pointer"
                              onClick={() => {
                                onSelectUser({ uid: reply.authorUid, name: reply.authorName, avatar: reply.authorAvatar });
                                onClose();
                              }}
                            />
                            <div className="flex-1 min-w-0 bg-white dark:bg-white/[0.03] p-2.5 rounded-xl border border-gray-100 dark:border-white/5">
                              <div className="flex items-center justify-between">
                                <span 
                                  className="font-semibold text-gray-900 dark:text-white text-[11.5px] truncate cursor-pointer hover:underline"
                                  onClick={() => {
                                    onSelectUser({ uid: reply.authorUid, name: reply.authorName, avatar: reply.authorAvatar });
                                    onClose();
                                  }}
                                >
                                  {reply.authorUid === currentUser?.uid ? 'You' : reply.authorName}
                                </span>
                                <div className="flex items-center space-x-1.5 text-gray-400 dark:text-neutral-500">
                                  <span className="text-[10px]">{formatTime(reply.createdAt)}</span>
                                  {reply.authorUid === currentUser?.uid && (
                                    <div className="flex items-center space-x-1 pl-1">
                                      <button 
                                        onClick={() => handleStartEditReply(reply)}
                                        className="hover:text-black dark:hover:text-white p-0.5 transition-colors"
                                        title="Edit reply"
                                      >
                                        <Edit2 className="w-2.5 h-2.5" />
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteReply(reply.id)}
                                        className="hover:text-red-500 p-0.5 transition-colors"
                                        title="Delete reply"
                                      >
                                        <Trash2 className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {editingReplyId === reply.id ? (
                                <div className="mt-1 flex items-center space-x-1.5">
                                  <input 
                                    type="text" 
                                    value={editingText}
                                    onChange={(e) => setEditingText(e.target.value)}
                                    className="flex-1 text-xs border border-gray-200 dark:border-white/20 bg-transparent rounded-md px-2 py-1 text-gray-900 dark:text-white outline-none focus:border-blue-500"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveEditReply(reply.id);
                                      if (e.key === 'Escape') setEditingReplyId(null);
                                    }}
                                  />
                                  <button onClick={() => handleSaveEditReply(reply.id)} className="p-1 bg-black dark:bg-white text-white dark:text-black rounded-md">
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => setEditingReplyId(null)} className="p-1 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white rounded-md">
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <p className="text-gray-700 dark:text-neutral-200 text-xs mt-0.5 font-normal break-words">
                                  {reply.text}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )
          ) : (
            likeItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-neutral-500">
                <Heart className="w-12 h-12 opacity-20 mb-2.5 text-red-500" />
                <p className="font-medium text-sm text-gray-800 dark:text-neutral-200">No likes yet</p>
                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">Likes on this reel will appear here.</p>
              </div>
            ) : (
              likeItems.map((item) => (
                <div 
                  key={item.uid}
                  onClick={() => {
                    onSelectUser({ uid: item.uid, name: item.name, avatar: item.avatar });
                    onClose();
                  }}
                  className="p-3 rounded-2xl bg-gray-50/70 dark:bg-white/[0.04] border border-gray-100 dark:border-white/10 flex items-center justify-between cursor-pointer hover:bg-gray-100/70 dark:hover:bg-white/[0.07] transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <img src={item.avatar} alt={item.name} className="w-9 h-9 rounded-full object-cover border border-gray-100 dark:border-white/10" />
                      <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-red-500 text-white shadow-2xs">
                        <Heart className="w-2.5 h-2.5 fill-white" />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-semibold text-gray-900 dark:text-white">
                          {item.isSelf ? 'You' : item.name}
                        </span>
                        {item.isFriend && (
                          <span className="text-[10px] font-medium bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.2 rounded-full">
                            Friend
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 dark:text-neutral-500">Liked this reel</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-neutral-500">{formatTime(item.updatedAt)}</span>
                </div>
              ))
            )
          )}
        </div>

        {/* Clean 2D Sticky Repost / Reply Form (Exact Comment Style) */}
        <div className="p-3 bg-white dark:bg-[#18191c] border-t border-gray-100 dark:border-white/10 flex flex-col space-y-2 sticky bottom-0 z-20 shrink-0">
          {/* Replying Banner */}
          {replyTarget && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-blue-50/80 dark:bg-blue-950/40 rounded-xl text-xs text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
              <span className="truncate">Replying to <strong>{replyTarget.isSelf ? 'your repost' : replyTarget.name}</strong></span>
              <button onClick={() => setReplyTarget(null)} className="p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* User Reposted Status Banner */}
          {!replyTarget && hasUserReposted && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-green-50/80 dark:bg-green-950/40 rounded-xl text-xs text-green-700 dark:text-green-300 border border-green-100 dark:border-green-900/30">
              <span className="flex items-center space-x-1.5">
                <Repeat className="w-3.5 h-3.5 text-green-500 shrink-0" strokeWidth={2.5} />
                <span>You reposted this reel</span>
              </span>
              <button 
                onClick={handleDeleteMyRepost}
                disabled={isSubmitting}
                className="text-red-600 dark:text-red-400 hover:underline font-medium flex items-center space-x-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Remove</span>
              </button>
            </div>
          )}

          {/* Input & Action Button */}
          <div className="flex items-center space-x-2">
            <img 
              src={currentUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || 'User')}`} 
              className="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-200 dark:border-white/10" 
              alt="You"
            />
            <input 
              type="text"
              value={replyTarget ? replyInputText : repostInputText}
              onChange={(e) => replyTarget ? setReplyInputText(e.target.value) : setRepostInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (replyTarget) {
                    handleSendReply(replyTarget);
                  } else {
                    handleSaveRepost();
                  }
                }
              }}
              placeholder={
                replyTarget 
                  ? `Reply to ${replyTarget.isSelf ? 'yourself' : replyTarget.name}...` 
                  : hasUserReposted 
                    ? "Update your repost caption..." 
                    : "Add thoughts or caption (optional)..."
              }
              className="flex-1 bg-gray-50 dark:bg-white/[0.06] border border-gray-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none focus:border-green-500"
              maxLength={200}
            />

            {replyTarget ? (
              <button
                onClick={() => handleSendReply(replyTarget)}
                disabled={!replyInputText.trim() || isSubmitting}
                className="p-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white rounded-xl transition-all active:scale-95 shrink-0 cursor-pointer"
                title="Send Reply"
              >
                <Send className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSaveRepost}
                disabled={isSubmitting}
                className="px-3.5 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white text-xs font-medium rounded-xl transition-all active:scale-95 flex items-center space-x-1.5 shrink-0 shadow-2xs cursor-pointer"
              >
                <Repeat className="w-3.5 h-3.5" strokeWidth={2.5} />
                <span>{hasUserReposted ? 'Update' : 'Repost'}</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
};

const ReelInteractionsModal = RepostMenuModal;

const MentionText = ({ text, onClosePortal }: { text: string; onClosePortal?: () => void }) => {
  const { setViewingUser, pushPage } = useAppStore();
  const parts = (text || '').split(/(@\w+)/g);
  return (
    <span className="text-[13px] text-gray-900 dark:text-neutral-100 font-normal leading-relaxed break-words">
      {parts.map((part, i) => {
        if (part && part.startsWith('@')) {
          const username = part.substring(1);
          return (
            <span 
              key={i} 
              onClick={(e) => {
                e.stopPropagation();
                findUserByUsername(username.toLowerCase()).then(u => {
                  if (u) {
                    setViewingUser({ uid: u.uid, name: u.name, avatar: u.avatar });
                    pushPage('profile');
                    if (onClosePortal) onClosePortal();
                  }
                });
              }}
              className="text-blue-600 dark:text-blue-400 font-medium hover:underline cursor-pointer"
            >
              {username}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};



const VoicePlayer = ({ audioUrl, duration }: { audioUrl: string; duration?: number }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setTotalDuration(Math.round(audio.duration));
      }
    };
    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };
    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [audioUrl]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const formatSecs = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progressPct = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
  // Soundwave heights strictly mimicking the uploaded screenshot design
  const waveformHeights = [28, 48, 36, 60, 44, 76, 52, 90, 64, 100, 72, 88, 56, 76, 48, 84, 60, 92, 52, 76, 44, 68, 32];

  return (
    <div className="mt-1.5 inline-flex items-center space-x-3 bg-[#eceff3] dark:bg-[#1f242d] text-neutral-900 dark:text-white px-3.5 py-2 rounded-full max-w-[270px] select-none border-0 shadow-none transition-all">
      <button 
        type="button"
        onClick={togglePlay} 
        className="w-7 h-7 flex items-center justify-center shrink-0 text-neutral-900 dark:text-white hover:opacity-80 active:scale-90 transition-transform cursor-pointer border-0 bg-transparent p-0"
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <div className="flex items-center space-x-1">
            <span className="w-1 h-3.5 bg-neutral-900 dark:bg-white rounded-full animate-pulse" />
            <span className="w-1 h-3.5 bg-neutral-900 dark:bg-white rounded-full animate-pulse delay-75" />
          </div>
        ) : (
          <svg className="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24">
            <polygon points="6 4 20 12 6 20 6 4" />
          </svg>
        )}
      </button>

      {/* Waveform Bars */}
      <div className="flex-1 flex items-center space-x-[2px] h-5 min-w-[120px]">
        {waveformHeights.map((h, i) => {
          const barProgress = (i / waveformHeights.length) * 100;
          const isFilled = barProgress <= progressPct;
          return (
            <div 
              key={i} 
              className={`w-[2.5px] rounded-full transition-all duration-150 ${
                isFilled 
                  ? 'bg-neutral-900 dark:bg-white' 
                  : 'bg-neutral-400/50 dark:bg-neutral-600/50'
              }`} 
              style={{ 
                height: isPlaying ? `${Math.max(25, (h + (i % 3) * 15) % 100)}%` : `${h}%`
              }}
            />
          );
        })}
      </div>

      <span className="text-[10px] font-mono tabular-nums text-neutral-500 dark:text-neutral-400 shrink-0">
        {formatSecs(isPlaying ? currentTime : totalDuration)}
      </span>
    </div>
  );
};

const CommentItem = React.memo(({ comment, postId, authorId, authorName, authorAvatar, media, onReply, onClosePortal }: { comment: Comment, postId: string, authorId: string, authorName: string, authorAvatar: string, media?: string, onReply: (id: string, name: string, authorId: string) => void, onClosePortal?: () => void }) => {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(comment.likesCount || 0);
  const [cConfirmDelete, setCConfirmDelete] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isStickerModalOpen, setIsStickerModalOpen] = useState(false);
  const { currentUser, setViewingUser, pushPage, highlightedCommentId, setHighlightedCommentId } = useAppStore();
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlightedCommentId === comment.id && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const timer = setTimeout(() => setHighlightedCommentId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightedCommentId, comment.id]);

  useEffect(() => {
    if (currentUser && comment.id) {
      const likeRef = doc(db, 'posts', postId, 'comments', comment.id, 'likes', currentUser.uid);
      return onSnapshot(likeRef, (doc) => setLiked(doc.exists()));
    }
  }, [postId, comment.id, currentUser]);

  const handleLike = async () => {
    if (!currentUser) return;
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount(prev => newLiked ? prev + 1 : prev - 1);
    try {
      await toggleCommentLike(postId, comment.id, currentUser.uid);
      if (newLiked) {
        await sendNotification(comment.authorId, 'comment_like', currentUser, comment.id, postId, media, 'liked your comment', authorName, authorAvatar);
      }
    } catch (err) {
      setLiked(!newLiked);
      setLikesCount(prev => !newLiked ? prev + 1 : prev - 1);
    }
  };

  const handleDelete = async () => {
     if (!currentUser || (currentUser.uid !== comment.authorId && currentUser.uid !== authorId)) return;
     if (!cConfirmDelete) {
       setCConfirmDelete(true);
       setTimeout(() => setCConfirmDelete(false), 3000);
       return;
     }
     try {
       const { deleteComment } = await import('../services/postService');
       await deleteComment(postId, comment.id!);
     } catch (err) {
       console.error("Failed to delete comment:", err);
     }
  };

  const handleProfileClick = () => {
    setViewingUser({ uid: comment.authorId, name: comment.authorName, avatar: comment.authorAvatar });
    pushPage('profile');
    if (onClosePortal) onClosePortal();
  };

  const handleReplyToClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (comment.replyToAuthorId) {
      setViewingUser({ uid: comment.replyToAuthorId, name: comment.replyToName || 'User', avatar: '' });
      pushPage('profile');
      if (onClosePortal) onClosePortal();
    } else if (comment.replyToName) {
      findUserByUsername(comment.replyToName.toLowerCase()).then(u => {
        if (u) {
          setViewingUser({ uid: u.uid, name: u.name, avatar: u.avatar });
          pushPage('profile');
          if (onClosePortal) onClosePortal();
        }
      });
    }
  };

  return (
    <div ref={itemRef} className={`flex space-x-2.5 group relative transition-colors duration-200 rounded-xl p-1.5 ${highlightedCommentId === comment.id ? 'bg-sky-50/80 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-800/40' : ''} ${comment.parentId ? 'ml-6 pl-2 my-1' : ''}`}>
      <img 
        src={comment.authorAvatar} 
        className={`${comment.parentId ? 'w-6 h-6' : 'w-8 h-8'} rounded-full object-cover cursor-pointer hover:opacity-85 transition-opacity shrink-0 mt-0.5 border border-sky-100 dark:border-sky-900/30`} 
        onClick={handleProfileClick}
        referrerPolicy="no-referrer"
        alt={comment.authorName}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-1.5 flex-wrap">
          {/* Author Name */}
          <p className={`${comment.parentId ? 'text-[11px]' : 'text-[12px]'} font-semibold text-slate-900 dark:text-white cursor-pointer hover:underline truncate`} onClick={handleProfileClick}>
            {comment.authorName}
          </p>

          {comment.replyToName && (
            <div className="flex items-center space-x-1">
              <span className="text-[10px] text-slate-400 font-normal">▸</span>
              <span 
                className="font-medium text-[12px] text-sky-600 dark:text-sky-400 cursor-pointer hover:underline truncate"
                onClick={handleReplyToClick}
              >
                {comment.replyToName}
              </span>
            </div>
          )}
          
          {/* Creator Badge ONLY if actual video/post owner */}
          {Boolean(authorId) && comment.authorId === authorId && (
            <span className="bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200/80 dark:border-sky-800/50 text-[9.5px] font-semibold px-2 py-0.5 rounded-full leading-none tracking-tight shrink-0 flex items-center space-x-0.5 shadow-2xs">
              <span>Creator</span>
            </span>
          )}

          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-normal shrink-0">· {formatTime(comment.createdAt)}</span>
        </div>
        
        {/* Comment Text - Black in light mode, crisp white/neutral in dark mode */}
        {comment.text && (
          <div className={`${comment.parentId ? 'text-[12px]' : 'text-[13px]'} text-black dark:text-neutral-100 font-normal leading-relaxed break-words mt-0.5`}>
            <MentionText text={comment.text} onClosePortal={onClosePortal} />
          </div>
        )}

        {/* Photo Attachment - Clickable for Lightbox */}
        {comment.imageUrl && (
          <div className="mt-1.5 cursor-pointer inline-block group/img" onClick={() => setIsImageModalOpen(true)}>
            <img 
              src={comment.imageUrl} 
              className="max-h-48 max-w-[220px] rounded-2xl object-cover border border-gray-100 dark:border-white/15 shadow-2xs group-hover/img:opacity-90 transition-opacity" 
              alt="Comment attachment" 
            />
          </div>
        )}

        {/* Sticker Attachment - Clickable for Save/Share Modal */}
        {comment.stickerUrl && (() => {
          let stkUrl = comment.stickerUrl;
          if (stkUrl.includes('/uploads/')) {
            stkUrl = `/uploads/${stkUrl.split('/uploads/')[1]}`;
          }
          const isVid = stkUrl.endsWith('.mp4') || stkUrl.endsWith('.webm') || stkUrl.endsWith('.mov');
          const isImg = stkUrl.startsWith('http') || stkUrl.startsWith('/') || stkUrl.startsWith('data:') || stkUrl.endsWith('.webp') || stkUrl.endsWith('.png') || stkUrl.endsWith('.gif') || stkUrl.endsWith('.jpg') || stkUrl.endsWith('.jpeg');
          return (
            <div 
              onClick={() => setIsStickerModalOpen(true)}
              className="my-1 cursor-pointer inline-block hover:scale-105 active:scale-95 transition-transform"
            >
              {isVid ? (
                <video src={stkUrl} autoPlay loop muted playsInline className="h-20 w-20 object-contain rounded-xl shadow-xs" />
              ) : isImg ? (
                <img 
                  src={stkUrl} 
                  className="h-20 w-20 object-contain rounded-xl shadow-xs" 
                  alt="Sticker" 
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const el = e.currentTarget;
                    if (stkUrl.includes('/uploads/') && !el.dataset.retried) {
                      el.dataset.retried = 'true';
                      el.src = `/uploads/${stkUrl.split('/uploads/')[1]}`;
                    }
                  }}
                />
              ) : (
                <span className="text-3xl select-none">{stkUrl}</span>
              )}
            </div>
          );
        })()}

        {/* Voice Note Attachment */}
        {comment.audioUrl && (
          <VoicePlayer audioUrl={comment.audioUrl} duration={comment.audioDuration} />
        )}

        <div className="flex items-center space-x-3 mt-1 text-[10px] font-normal text-gray-400 dark:text-gray-500">
           <button onClick={() => onReply(comment.parentId || comment.id!, comment.authorName, comment.authorId)} className="hover:text-gray-900 dark:hover:text-white uppercase tracking-tight font-medium cursor-pointer">Reply</button>
           {currentUser?.uid === comment.authorId || currentUser?.uid === authorId ? (
             <button onClick={handleDelete} className={`${cConfirmDelete ? 'text-red-500 font-medium' : 'text-gray-300 dark:text-gray-600 hover:text-red-600'} uppercase text-[9px] tracking-tight cursor-pointer`}>{cConfirmDelete ? 'Confirm?' : 'Delete'}</button>
           ) : null}
        </div>
      </div>

      {/* Heart Icon on Right with Like Count */}
      <button onClick={handleLike} className="flex flex-col items-center flex-shrink-0 pt-0.5 hover:scale-110 active:scale-90 transition-transform min-w-[22px] cursor-pointer">
        <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-red-500 text-red-500' : 'text-gray-300 dark:text-gray-600 hover:text-gray-400'}`} />
        {likesCount > 0 && (
          <span className={`text-[9.5px] font-medium mt-0.5 ${liked ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
            {likesCount}
          </span>
        )}
      </button>

      {/* Lightbox Modal for Photo */}
      {isImageModalOpen && comment.imageUrl && createPortal(
        <div 
          className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsImageModalOpen(false)}
        >
          <button 
            onClick={() => setIsImageModalOpen(false)} 
            className="absolute top-5 right-5 text-white bg-white/20 p-2 rounded-full hover:bg-white/30 backdrop-blur-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <img 
            src={comment.imageUrl} 
            className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl animate-in zoom-in-95 duration-150" 
            onClick={(e) => e.stopPropagation()} 
            alt="Full size comment photo" 
          />
        </div>,
        document.body
      )}

      {/* 2D Soft Sticker Modal: Enlarged in rounded box with 2 clean buttons (Save & Share), no black glow */}
      {isStickerModalOpen && comment.stickerUrl && createPortal(
        <StickerViewerModal
          isOpen={isStickerModalOpen}
          onClose={() => setIsStickerModalOpen(false)}
          stickerUrl={comment.stickerUrl}
          currentUserId={currentUser?.uid}
          onShareToChat={(url) => {
            if (navigator.clipboard) {
              navigator.clipboard.writeText(url);
            }
            setIsStickerModalOpen(false);
          }}
        />,
        document.body
      )}
    </div>
  );
});

export const CommentsPortal = ({ postId, onClose, authorId, authorName, authorAvatar, media, initialReply, onClearReply }: { postId: string, onClose: () => void, authorId: string, authorName: string, authorAvatar: string, media?: string, initialReply?: {id: string, name: string, authorId: string} | null, onClearReply?: () => void }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<{id: string, name: string, authorId: string} | null>(initialReply || null);
  const [mentions, setMentions] = useState<any[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [visibleReplyLimits, setVisibleReplyLimits] = useState<Record<string, number>>({});

  const handleReplyClick = (id: string, name: string, replyAuthorId: string) => {
    setReplyingTo({ id, name, authorId: replyAuthorId });
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  // Attachments State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedSticker, setSelectedSticker] = useState<string | null>(null);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [stickerTab, setStickerTab] = useState<'giphy' | 'emoji'>('giphy');

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedAudioDuration, setRecordedAudioDuration] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);

  const { currentUser, highlightedCommentId } = useAppStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Live GIPHY Reaction GIFs
  const giphyStickers = [
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHYyNHZxeTB0aG4xbDV4OTh2NHNwcGk2ZmRwcWJ4c3J5eGlxaTdxbCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKSjRrfIPjeiVyM/giphy.gif',
    'https://media.giphy.com/media/l41K3tokLoi1A4Gli/giphy.gif',
    'https://media.giphy.com/media/dzaUX7CAG0Ihi/giphy.gif',
    'https://media.giphy.com/media/26AHPxxnks4hVUJ44/giphy.gif',
    'https://media.giphy.com/media/11sBLVx28GiZWM/giphy.gif',
    'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif',
    'https://media.giphy.com/media/l0HlHFRbmaZtBRhXG/giphy.gif',
    'https://media.giphy.com/media/xT9IgG5083yTnCYC4M/giphy.gif',
    'https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif',
    'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
    'https://media.giphy.com/media/l0AMJzC6f028AnR4k/giphy.gif',
    'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif'
  ];

  const stickerList = ['🔥', '❤️', '👏', '🎉', '🚀', '💖', '🤩', '👑', '🥳', '🍕', '💯', '🌟', '✨', '🎯', '⚡', '🌺', '💬', '🎵', '🎈', '🐱', '🐶', '🌈', '🏆', '💎', '😍', '🙌', '😎', '👍', '🙏'];

  useEffect(() => {
    const q = query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [postId]);

  useEffect(() => {
    if (highlightedCommentId && comments.length > 0) {
      const target = comments.find(c => c.id === highlightedCommentId);
      if (target && target.parentId) {
        setVisibleReplyLimits(prev => ({ ...prev, [target.parentId!]: 999 }));
      }
    }
  }, [highlightedCommentId, comments]);

  useEffect(() => {
    if (currentUser) {
      import('../services/followService').then(service => {
        service.getFollowing(currentUser.uid).then(setFriends);
      });
    }
  }, [currentUser]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    const match = val.match(/@(\w*)$/);
    if (match) {
      const searchTerm = match[1].toLowerCase();
      const filtered = friends.filter(f => (f.name || '').toLowerCase().includes(searchTerm));
      setMentions(filtered);
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const selectMention = (friend: any) => {
    const newText = text.replace(/@(\w*)$/, `@${friend.name.replace(/\s/g, '')} `);
    setText(newText);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const startVoiceRecording = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              setRecordedAudioUrl(reader.result);
            }
          };
          reader.readAsDataURL(audioBlob);
          setRecordedAudioDuration(recordingTime || 5);
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
        setRecordingTime(0);
        recordTimerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      } else {
        setIsRecording(true);
        setRecordingTime(0);
        recordTimerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      }
    } catch (e) {
      setIsRecording(true);
      setRecordingTime(0);
      recordTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
  };

  const stopVoiceRecording = () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      const synthUrl = 'https://actions.google.com/sounds/v1/ambiences/outdoor_park.ogg';
      setRecordedAudioUrl(synthUrl);
      setRecordedAudioDuration(Math.max(1, recordingTime));
    }
    setIsRecording(false);
  };

  const cancelVoiceRecording = () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordedAudioUrl(null);
    setRecordingTime(0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!text.trim() && !selectedImage && !selectedSticker && !recordedAudioUrl) return;

    const commentText = text.trim();
    const currentReplyTo = replyingTo;
    
    const extraData: any = {};
    if (currentReplyTo) {
      extraData.replyToName = currentReplyTo.name;
      extraData.replyToAuthorId = currentReplyTo.authorId;
    }
    if (selectedImage) extraData.imageUrl = selectedImage;
    if (selectedSticker) extraData.stickerUrl = selectedSticker;
    if (recordedAudioUrl) {
      extraData.audioUrl = recordedAudioUrl;
      extraData.audioDuration = recordedAudioDuration || 5;
    }

    // Optimistic comment
    const optimisticComment = {
      id: `opt-${Date.now()}`,
      authorId: currentUser.uid,
      authorName: currentUser.name,
      authorAvatar: currentUser.avatar,
      text: commentText,
      createdAt: { toDate: () => new Date() },
      likesCount: 0,
      parentId: currentReplyTo?.id || null,
      ...extraData
    };
    
    setComments(prev => [optimisticComment as any, ...prev]);
    setText('');
    setSelectedImage(null);
    setSelectedSticker(null);
    setRecordedAudioUrl(null);
    setShowStickerPicker(false);
    setReplyingTo(null);
    onClearReply?.();
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    
    try {
      const newComment = await addComment(
        postId, 
        currentUser.uid, 
        currentUser, 
        commentText, 
        currentReplyTo?.id || null,
        extraData
      ) as any;
      
      // Notify post author
      await sendNotification(authorId, 'comment', currentUser, newComment.id, postId, media, commentText || 'sent an attachment', authorName, authorAvatar);
      
      // Notify parent comment author if reply
      if (currentReplyTo && currentReplyTo.authorId && currentReplyTo.authorId !== currentUser.uid && currentReplyTo.authorId !== authorId) {
        await sendNotification(currentReplyTo.authorId, 'reply', currentUser, newComment.id, postId, media, commentText || 'replied to your comment', authorName, authorAvatar);
      }

      // Mentions Notification
      const mentionMatches = commentText.match(/@(\w+)/g);
      if (mentionMatches) {
        const uniqueMentions = Array.from(new Set(mentionMatches.map(m => m.substring(1)))) as string[];
        for (const username of uniqueMentions) {
          const mentionedUser = await findUserByUsername(username);
          if (mentionedUser && mentionedUser.uid !== currentUser.uid && mentionedUser.uid !== authorId) {
            await sendNotification(mentionedUser.uid, 'mention', currentUser, newComment.id, postId, media, commentText, authorName, authorAvatar);
          }
        }
      }
    } catch (err) {
      setComments(prev => prev.filter(c => c.id !== optimisticComment.id));
      setText(commentText);
    }
  };

  return createPortal(
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16, ease: "linear" }}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 md:p-4 touch-manipulation backdrop-blur-xs" 
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: "0%" }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
        style={{ transform: 'translateZ(0)', willChange: 'transform' }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#0c121e] text-slate-900 dark:text-white rounded-t-[32px] sm:rounded-3xl w-full max-w-lg h-[75vh] sm:h-[80dvh] max-h-[750px] flex flex-col overflow-hidden shadow-2xl transform-gpu border-t sm:border border-sky-100 dark:border-sky-900/40 relative"
      >
        {/* Mobile Grab Handle */}
        <div className="w-10 h-1 bg-sky-200 dark:bg-sky-900/60 rounded-full mx-auto my-2.5 shrink-0 sm:hidden" />

        {/* Clean White & Sky-Blue Header */}
        <div className="flex justify-between items-center px-4 py-2.5 border-b border-sky-100/80 dark:border-sky-900/30 flex-shrink-0 bg-white/95 dark:bg-[#0c121e]/95 backdrop-blur-md">
          <div className="w-8"></div>
          <div className="flex items-center space-x-2 mx-auto">
            <h3 className="font-bold text-slate-900 dark:text-white text-[15px]">Comments</h3>
            {comments.length > 0 && (
              <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded-full border border-sky-200/60 dark:border-sky-800/40">
                {comments.length}
              </span>
            )}
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/50 border border-sky-100 dark:border-sky-800/40 rounded-full transition-colors active:scale-95 text-sky-700 dark:text-sky-300 cursor-pointer" 
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 no-scrollbar bg-white dark:bg-[#0c121e]">
          {loading ? (
            <div className="space-y-4 py-2 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex space-x-3 items-start">
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-neutral-800 shrink-0"></div>
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="w-28 h-3 bg-gray-200 dark:bg-neutral-800 rounded"></div>
                    <div className="w-3/4 h-3 bg-gray-100 dark:bg-neutral-900 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
              <MessageCircle className="w-14 h-14 opacity-10 mb-3" />
              <p className="font-normal text-sm">No comments yet. Be the first!</p>
            </div>
          ) : (
            (() => {
              const parentComments = comments.filter(c => !c.parentId);
              const repliesById = comments.reduce((acc, c) => {
                if (c.parentId) {
                  if (!acc[c.parentId]) acc[c.parentId] = [];
                  acc[c.parentId].push(c);
                }
                return acc;
              }, {} as Record<string, Comment[]>);

              // Bring highlighted comment / reply's parent to index 0 (top of the comments list)
              const sortedParentComments = [...parentComments].sort((a, b) => {
                if (!highlightedCommentId) return 0;
                const target = comments.find(c => c.id === highlightedCommentId);
                if (!target) return 0;
                const targetParentId = target.parentId || target.id;
                if (a.id === targetParentId) return -1;
                if (b.id === targetParentId) return 1;
                return 0;
              });

              return sortedParentComments.map((parent) => {
                const rawReplies = repliesById[parent.id] || [];
                // Sort replies chronologically, BUT if highlightedCommentId matches one of these replies, bring it to index 0!
                const replies = [...rawReplies].sort((a, b) => {
                  if (highlightedCommentId && a.id === highlightedCommentId) return -1;
                  if (highlightedCommentId && b.id === highlightedCommentId) return 1;
                  const tA = (a.createdAt as any)?.toMillis ? (a.createdAt as any).toMillis() : ((a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : (typeof a.createdAt === 'number' ? a.createdAt : 0));
                  const tB = (b.createdAt as any)?.toMillis ? (b.createdAt as any).toMillis() : ((b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : (typeof b.createdAt === 'number' ? b.createdAt : 0));
                  return tA - tB;
                });

                const isTargetParent = highlightedCommentId && comments.find(c => c.id === highlightedCommentId)?.parentId === parent.id;
                const defaultLimit = isTargetParent ? 999 : 0;
                const limit = visibleReplyLimits[parent.id] ?? defaultLimit; // Default collapsed (0) unless targeted
                const visibleReplies = replies.slice(0, limit);
                const remainingReplies = replies.length - visibleReplies.length;

                return (
                  <div key={parent.id} className="space-y-2">
                    <CommentItem 
                      comment={parent} 
                      postId={postId} 
                      authorId={authorId} 
                      authorName={authorName} 
                      authorAvatar={authorAvatar}
                      media={media} 
                      onReply={(id, name, replyAuthorId) => handleReplyClick(id, name, replyAuthorId)} 
                      onClosePortal={onClose}
                    />

                    {/* Replies section */}
                    {replies.length > 0 && (
                      <div className="space-y-2 pl-3 ml-4 mt-1">
                        {visibleReplies.map(reply => (
                          <CommentItem 
                            key={reply.id} 
                            comment={reply} 
                            postId={postId} 
                            authorId={authorId} 
                            authorName={authorName}
                            authorAvatar={authorAvatar}
                            media={media} 
                            onReply={(id, name, replyAuthorId) => handleReplyClick(id, name, replyAuthorId)} 
                            onClosePortal={onClose}
                          />
                        ))}

                        {/* See Replies toggle - Default collapsed, loads 5 at a time */}
                        {limit === 0 && (
                          <button 
                            onClick={() => setVisibleReplyLimits(prev => ({ ...prev, [parent.id]: 5 }))}
                            className="flex items-center space-x-1.5 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline transition-colors pt-1 cursor-pointer"
                          >
                            <span className="w-3.5 h-[1px] bg-blue-300 dark:bg-blue-600"></span>
                            <span>See {replies.length} {replies.length === 1 ? 'reply' : 'replies'}...</span>
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        )}

                        {limit > 0 && remainingReplies > 0 && (
                          <button 
                            onClick={() => setVisibleReplyLimits(prev => ({ ...prev, [parent.id]: (prev[parent.id] || 5) + 5 }))}
                            className="flex items-center space-x-1.5 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline transition-colors pt-1 cursor-pointer"
                          >
                            <span className="w-3.5 h-[1px] bg-blue-300 dark:bg-blue-600"></span>
                            <span>See {Math.min(5, remainingReplies)} more {remainingReplies === 1 ? 'reply' : 'replies'} ({remainingReplies} remaining)...</span>
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        )}

                        {limit > 0 && (
                          <button 
                            onClick={() => setVisibleReplyLimits(prev => ({ ...prev, [parent.id]: 0 }))}
                            className="flex items-center space-x-1.5 text-[11px] font-normal text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors pt-1 ml-2 cursor-pointer"
                          >
                            <span>Hide replies</span>
                            <ChevronUp className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              });
            })()
          )}
        </div>

        {/* Mentions Suggestions */}
        {showMentions && mentions.length > 0 && (
          <div className="absolute bottom-20 left-4 right-4 bg-white dark:bg-black border border-gray-100 dark:border-white/15 rounded-2xl shadow-2xl max-h-48 overflow-y-auto z-50">
            {mentions.map(f => (
              <button 
                type="button"
                key={f.uid} 
                onClick={() => selectMention(f)}
                className="w-full flex items-center space-x-3 p-2.5 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors border-b border-gray-50 dark:border-white/10 last:border-0 cursor-pointer"
              >
                <img src={f.avatar} className="w-7 h-7 rounded-full object-cover" referrerPolicy="no-referrer" alt={f.name} />
                <span className="font-normal text-xs text-gray-900 dark:text-white">{f.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Hidden File Input */}
        <input 
          type="file" 
          ref={imageInputRef} 
          accept="image/*" 
          className="hidden" 
          onChange={handleImageSelect} 
        />

        {/* Input & Action Controls Form - Clean White & Sky Blue */}
        <form onSubmit={handleSubmit} style={{ transform: 'translateZ(0)' }} className="p-3 border-t border-sky-100/80 dark:border-sky-900/40 flex flex-col space-y-2 bg-white/95 dark:bg-[#0c121e]/95 backdrop-blur-md sticky bottom-0 z-20 shrink-0 shadow-[0_-2px_12px_rgba(14,165,233,0.05)] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {/* Replying Banner */}
          {replyingTo && (
            <div className="flex items-center justify-between text-[11px] bg-sky-50 dark:bg-sky-950/50 px-3 py-1.5 rounded-xl border border-sky-100 dark:border-sky-900/50">
              <span className="text-sky-700 dark:text-sky-300 font-normal">Replying to <span className="font-semibold text-sky-900 dark:text-white">@{replyingTo.name}</span></span>
              <button type="button" onClick={() => setReplyingTo(null)} className="text-sky-500 hover:text-sky-800 dark:hover:text-white font-medium uppercase text-[9px] cursor-pointer">Cancel</button>
            </div>
          )}

          {/* Attachment Previews */}
          {(selectedImage || selectedSticker || recordedAudioUrl) && (
            <div className="flex items-center space-x-2 bg-sky-50/60 dark:bg-sky-950/30 p-2 rounded-2xl border border-sky-100 dark:border-sky-900/40">
              {selectedImage && (
                <div className="relative group">
                  <img src={selectedImage} className="w-12 h-12 rounded-xl object-cover border border-sky-200 dark:border-white/10" alt="Preview" />
                  <button type="button" onClick={() => setSelectedImage(null)} className="absolute -top-1.5 -right-1.5 bg-black/70 text-white rounded-full p-0.5 hover:bg-black cursor-pointer">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {selectedSticker && (() => {
                let stkUrl = selectedSticker;
                if (stkUrl.includes('/uploads/')) {
                  stkUrl = `/uploads/${stkUrl.split('/uploads/')[1]}`;
                }
                const isVid = stkUrl.endsWith('.mp4') || stkUrl.endsWith('.webm') || stkUrl.endsWith('.mov');
                const isImg = stkUrl.startsWith('http') || stkUrl.startsWith('/') || stkUrl.startsWith('data:') || stkUrl.endsWith('.webp') || stkUrl.endsWith('.png') || stkUrl.endsWith('.gif') || stkUrl.endsWith('.jpg') || stkUrl.endsWith('.jpeg');
                return (
                  <div className="relative group flex items-center bg-white dark:bg-white/[0.08] px-2.5 py-1.5 rounded-2xl border border-sky-100 dark:border-white/10 shadow-2xs">
                    {isVid ? (
                      <video src={stkUrl} autoPlay loop muted playsInline className="w-10 h-10 object-contain rounded-lg" />
                    ) : isImg ? (
                      <img 
                        src={stkUrl} 
                        className="w-10 h-10 object-contain rounded-lg" 
                        alt="Sticker" 
                        referrerPolicy="no-referrer" 
                        onError={(e) => {
                          const el = e.currentTarget;
                          if (stkUrl.includes('/uploads/') && !el.dataset.retried) {
                            el.dataset.retried = 'true';
                            el.src = `/uploads/${stkUrl.split('/uploads/')[1]}`;
                          }
                        }}
                      />
                    ) : (
                      <span className="text-2xl">{stkUrl}</span>
                    )}
                    <button type="button" onClick={() => setSelectedSticker(null)} className="ml-2 p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })()}
              {recordedAudioUrl && (
                <div className="relative inline-flex items-center space-x-2.5 bg-sky-50 dark:bg-[#131d31] border border-sky-100 dark:border-sky-800/40 px-3.5 py-1.5 rounded-full text-xs text-sky-900 dark:text-sky-200 select-none">
                  <div className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                  <span className="font-medium text-[12px]">Voice ({recordedAudioDuration}s)</span>
                  <div className="flex items-center space-x-0.5 h-3">
                    {[35, 75, 45, 95, 60, 100, 50, 85, 40, 90, 65, 80].map((h, idx) => (
                      <span key={idx} className="w-[2px] bg-sky-500 rounded-full" style={{ height: `${h * 0.12}px` }} />
                    ))}
                  </div>
                  <button type="button" onClick={() => setRecordedAudioUrl(null)} className="p-0.5 text-sky-400 hover:text-red-500 rounded-full transition-colors cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Active Voice Recording Bar - Clean Sky Blue */}
          {isRecording ? (
            <div className="flex items-center justify-between bg-sky-50/90 dark:bg-[#131d31] rounded-full px-4 py-2 select-none border border-sky-100 dark:border-sky-800/40">
              <div className="flex items-center space-x-2.5 min-w-0">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500"></span>
                </span>
                <span className="text-[12px] font-mono font-semibold text-sky-950 dark:text-white tabular-nums shrink-0">
                  0:{recordingTime < 10 ? '0' : ''}{recordingTime}
                </span>

                {/* Animated soundwave bars */}
                <div className="flex items-center space-x-[2px] h-4 px-2 overflow-hidden max-w-[140px]">
                  {[28, 48, 36, 60, 44, 76, 52, 90, 64, 100, 72, 88, 56, 76, 48, 84].map((h, idx) => (
                    <div
                      key={idx}
                      className="w-[2px] bg-sky-500 rounded-full transition-all duration-150"
                      style={{
                        height: `${Math.max(4, Math.min(16, (h * 0.16) * (0.6 + Math.sin((recordingTime * 4) + idx) * 0.4)))}px`,
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-1.5 shrink-0">
                <button 
                  type="button" 
                  onClick={stopVoiceRecording} 
                  className="w-7 h-7 bg-sky-500 text-white rounded-full hover:bg-sky-600 active:scale-95 transition-transform flex items-center justify-center cursor-pointer shadow-xs" 
                  title="Done Recording"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
                <button 
                  type="button" 
                  onClick={cancelVoiceRecording} 
                  className="w-7 h-7 bg-sky-100 dark:bg-white/15 text-sky-800 dark:text-neutral-200 rounded-full hover:bg-sky-200 dark:hover:bg-white/25 active:scale-95 transition-transform flex items-center justify-center cursor-pointer" 
                  title="Cancel Recording"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-2 bg-sky-50/70 dark:bg-[#131d31] border border-sky-100 dark:border-sky-800/50 rounded-full px-3.5 py-1.5 shadow-2xs focus-within:border-sky-400 focus-within:bg-white dark:focus-within:bg-[#162238] focus-within:ring-2 focus-within:ring-sky-200/40 transition-all">
              <img src={currentUser?.avatar || "https://picsum.photos/seed/myprofile/32/32"} className="w-7 h-7 rounded-full object-cover shrink-0 border border-sky-200/60 dark:border-sky-700/40" referrerPolicy="no-referrer" alt="Avatar" />
              
              {/* Dynamic Auto-Expanding Textarea */}
              <textarea 
                ref={textareaRef}
                rows={1}
                value={text} 
                onChange={(e) => {
                  handleInputChange(e as any);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`;
                }}
                placeholder={replyingTo ? `Reply to ${replyingTo.name}...` : `Add a comment...`} 
                enterKeyHint="send"
                autoComplete="off"
                className="flex-1 bg-transparent focus:outline-none text-[13.5px] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 font-normal px-1.5 py-1 resize-none max-h-24 min-h-[28px] overflow-y-auto no-scrollbar" 
              />

              {/* Action Buttons: Photo, Sticker, and Dynamic Mic / Send switch */}
              <div className="flex items-center space-x-0.5 shrink-0">
                <button 
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="p-1.5 text-sky-600 dark:text-sky-300 hover:text-sky-700 dark:hover:text-white hover:bg-sky-100/80 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                  title="Attach Photo"
                >
                  <ImageIcon className="w-4 h-4 stroke-[2]" />
                </button>

                <button 
                  type="button"
                  onClick={() => setShowStickerPicker(!showStickerPicker)}
                  className={`p-1.5 text-sky-600 dark:text-sky-300 hover:text-amber-500 dark:hover:text-amber-300 hover:bg-sky-100/80 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer ${showStickerPicker ? 'text-amber-500 bg-sky-100 dark:bg-white/10' : ''}`}
                  title="Stickers & GIFs"
                >
                  <Smile className="w-4 h-4 stroke-[2]" />
                </button>

                {/* Switch between Mic (when empty) and Send Button (when typing) */}
                {(!text.trim() && !selectedImage && !selectedSticker && !recordedAudioUrl) ? (
                  <button 
                    type="button"
                    onClick={startVoiceRecording}
                    className="w-7.5 h-7.5 bg-gradient-to-tr from-sky-400 via-sky-500 to-blue-600 active:scale-90 text-white rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs ml-0.5"
                    title="Record Voice Note"
                  >
                    <Mic className="w-4 h-4 stroke-[2.2] text-white" />
                  </button>
                ) : (
                  <button 
                    type="submit"
                    className="w-7.5 h-7.5 text-white bg-gradient-to-tr from-sky-400 via-sky-500 to-blue-600 hover:brightness-105 rounded-full transition-all flex items-center justify-center shadow-xs active:scale-90 ml-0.5 cursor-pointer"
                    title="Send Comment"
                  >
                    <Send className="w-3.5 h-3.5 text-white" />
                  </button>
                )}
              </div>
            </div>
          )}
        </form>

        {/* Global Sticker Picker Modal */}
        <StickerPickerModal
          isOpen={showStickerPicker}
          onClose={() => setShowStickerPicker(false)}
          onSelectSticker={(url) => {
            setSelectedSticker(url);
            setShowStickerPicker(false);
          }}
          onSelectEmoji={(emoji) => {
            setText((prev) => prev + emoji);
            setShowStickerPicker(false);
          }}
          currentUser={currentUser}
        />
      </motion.div>
    </motion.div>, document.body
  );
};

export const SharePortal = ({ 
  reel, 
  onClose,
  isCurrentUser,
  hasReposted,
  onRepost,
  onDelete,
  confirmingDelete
}: { 
  reel: Post, 
  onClose: () => void,
  isCurrentUser?: boolean,
  hasReposted?: boolean,
  onRepost?: () => void,
  onDelete?: () => void,
  confirmingDelete?: boolean
}) => {
  const { currentUser } = useAppStore();
  const [conversations, setConversations] = useState<any[]>([]);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [selectedConvs, setSelectedConvs] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [downloadingOffline, setDownloadingOffline] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  useEffect(() => {
    if (currentUser) {
      import('../services/chatService').then(m => {
        m.subscribeConversations(currentUser.uid, setConversations);
      });
      import('../services/followService').then(m => {
        m.getFollowing(currentUser.uid).then(setFriendsList);
      });
    }
  }, [currentUser]);

  const toggleSelect = (id: string) => {
    setSelectedConvs(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = () => {
    if (!currentUser || selectedConvs.length === 0) return;
    const selectedTargets = [...selectedConvs];
    const postMedia = reel.media?.[0] || '';
    const shareType = reel.type || 'post';

    // Close modal instantly for ULTRA FAST execution
    onClose();

    // Async background send
    import('../services/chatService').then(async ({ sendMessage, createClientMessageId }) => {
      for (const targetId of selectedTargets) {
        try {
          await sendMessage(targetId, currentUser.uid, shareType === 'post' ? 'reel' : shareType, 'Shared a post', postMedia, reel.id, undefined, {
            clientMessageId: createClientMessageId(currentUser.uid),
          });
        } catch (err) {
          console.error("Error sending share message:", err);
        }
      }
    });
  };

  // Combine conversations and friends without duplicates
  const allShareTargets = useMemo(() => {
    const list: any[] = [...conversations];
    const existingOtherIds = new Set(
      conversations.map(c => c.participantIds.find((id: string) => id !== currentUser?.uid))
    );

    friendsList.forEach(friend => {
      if (!existingOtherIds.has(friend.uid)) {
        list.push({
          id: friend.uid,
          isDirectFriend: true,
          participantIds: [currentUser?.uid || '', friend.uid],
          participantNames: { [friend.uid]: friend.name },
          participantAvatars: { [friend.uid]: friend.avatar }
        });
      }
    });

    return list;
  }, [conversations, friendsList, currentUser]);

  const filteredTargets = allShareTargets.filter(c => {
    if (!searchQuery.trim()) return true;
    const otherId = c.participantIds.find((id: string) => id !== currentUser?.uid);
    const name = c.participantNames[otherId || ''] || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const isOwner = isCurrentUser || (currentUser && (reel.authorId === currentUser.uid || (reel as any).author?.id === currentUser.uid));
  const [currentPrivacy, setCurrentPrivacy] = useState<string>(reel.privacy || 'public');

  const handleUpdatePrivacy = async (newPrivacy: 'public' | 'followers' | 'private') => {
    setCurrentPrivacy(newPrivacy);
    try {
      const isPrivate = newPrivacy === 'private';
      await updateDoc(doc(db, 'posts', reel.id), { 
        privacy: newPrivacy,
        isPrivate: isPrivate
      });
      window.dispatchEvent(new CustomEvent('reelPrivacyUpdated', { detail: { id: reel.id, privacy: newPrivacy, isPrivate } }));
    } catch (err) {
      console.error("Failed to update privacy:", err);
    }
  };

  return createPortal(
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16, ease: "linear" }}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 md:p-4 touch-manipulation backdrop-blur-xs" 
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: "0%" }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
        style={{ transform: 'translateZ(0)', willChange: 'transform' }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#0c121e] text-slate-900 dark:text-white rounded-t-[32px] sm:rounded-[32px] w-full max-w-lg h-auto max-h-[85dvh] flex flex-col overflow-hidden shadow-2xl transform-gpu relative border border-sky-100 dark:border-sky-900/40"
      >
        {/* Mobile Grab Handle */}
        <div className="w-10 h-1 bg-sky-200 dark:bg-sky-900/60 rounded-full mx-auto my-2.5 shrink-0 sm:hidden" />
        
        {/* Header */}
        <div className="relative px-4 py-2.5 border-b border-sky-100/80 dark:border-sky-900/30 flex items-center justify-between shrink-0 bg-white/95 dark:bg-[#0c121e]/95 backdrop-blur-md">
          <div className="w-8"></div>
          <h3 className="font-bold text-[15px] text-slate-900 dark:text-white mx-auto">Share to</h3>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/50 border border-sky-100 dark:border-sky-800/40 rounded-full transition-colors active:scale-95 text-sky-700 dark:text-sky-300 cursor-pointer" 
            title="Close"
          >
             <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Search */}
        <div className="p-3 shrink-0 bg-white dark:bg-[#0c121e]">
          <div className="bg-sky-50/70 dark:bg-[#131d31] border border-sky-100 dark:border-sky-800/50 rounded-full px-3.5 py-2 flex items-center space-x-2 focus-within:border-sky-400 focus-within:bg-white dark:focus-within:bg-[#162238] focus-within:ring-2 focus-within:ring-sky-200/40 transition-all">
             <Search className="w-4 h-4 text-sky-500 dark:text-sky-400 shrink-0" />
             <input 
               type="text" 
               placeholder="Search people..." 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="bg-transparent flex-1 outline-none text-sm font-normal text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500" 
             />
          </div>
        </div>

        {/* User Grid - Scrollable Container */}
        <div className="overflow-y-auto px-4 py-2 min-h-[160px] max-h-[300px] sm:max-h-[360px] scrollbar-thin scrollbar-thumb-sky-200 dark:scrollbar-thumb-sky-900/60 bg-white dark:bg-[#0c121e]">
          {filteredTargets.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs font-normal">
              No friends found
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-x-3 gap-y-4 pt-1">
              {filteredTargets.map(c => {
                 const otherId = c.participantIds.find((id: string) => id !== currentUser?.uid);
                 const isSelected = selectedConvs.includes(c.id);
                 return (
                   <div key={c.id} onClick={() => toggleSelect(c.id)} className="flex flex-col items-center justify-start cursor-pointer group active:scale-95 transition-transform relative">
                     <div className="relative mb-1.5">
                       <img 
                         src={c.participantAvatars[otherId || ''] || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.participantNames[otherId || ''] || 'User')}&background=random`} 
                         className={`w-[52px] h-[52px] rounded-full object-cover shadow-xs transition-all ${isSelected ? 'ring-2 ring-sky-500 ring-offset-2 opacity-90 scale-105' : 'group-hover:opacity-95'}`} 
                         referrerPolicy="no-referrer"
                       />
                       {isSelected && (
                         <div className="absolute -bottom-1 -right-1 bg-sky-500 rounded-full border-2 border-white dark:border-[#0c121e] p-0.5 shadow-xs animate-in zoom-in-50">
                           <CheckCircle2 className="w-3.5 h-3.5 text-white fill-white" />
                         </div>
                       )}
                     </div>
                     <span className="font-medium text-[11px] text-center text-slate-800 dark:text-white leading-tight line-clamp-1 max-w-[68px]">{c.participantNames[otherId || '']}</span>
                   </div>
                 )
              })}
            </div>
          )}
        </div>

        {/* Quick Action Rows - Hidden when a friend is selected */}
        {selectedConvs.length === 0 && (
          <div className="px-3 py-3 border-t border-sky-100/80 dark:border-sky-900/30 flex items-center justify-around space-x-2 shrink-0 bg-sky-50/40 dark:bg-sky-950/20">
            <button 
              type="button"
              onClick={onRepost} 
              className="flex flex-col items-center flex-1 cursor-pointer group active:scale-95 transition-transform"
            >
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-1 border transition-all ${hasReposted ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/50 text-emerald-600 dark:text-emerald-400 shadow-2xs' : 'bg-white dark:bg-[#131d31] border-sky-100 dark:border-sky-800/40 text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-900/40 shadow-2xs'}`}>
                <Repeat className={`w-5 h-5 ${hasReposted ? 'text-emerald-600 dark:text-emerald-400' : 'text-sky-600 dark:text-sky-400'}`} />
              </div>
              <span className={`text-[11px] font-medium text-center ${hasReposted ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
                {hasReposted ? 'Undo' : 'Repost'}
              </span>
            </button>
            
            <button 
              type="button"
              disabled={downloadingOffline}
              onClick={async () => {
                const rAny = reel as any;
                const mediaUrl = rAny.mediaUrls?.[0] || rAny.mediaUrl || rAny.videoUrl || reel.media?.[0] || "";
                if (!mediaUrl) return;

                setDownloadingOffline(true);
                try {
                  const { downloadMediaFile } = await import('../utils');
                  const { saveMediaOffline } = await import('../services/offlineMediaService');
                  
                  // Save into offline cache
                  await saveMediaOffline({
                    id: reel.id,
                    url: mediaUrl,
                    type: 'video',
                    title: reel.text || `Reel by ${reel.authorName}`,
                    authorName: reel.authorName,
                    authorAvatar: reel.authorAvatar
                  });

                  // Download to device
                  await downloadMediaFile(mediaUrl, `reel_${reel.id}.mp4`);
                  setDownloadSuccess(true);
                  setTimeout(() => setDownloadSuccess(false), 3000);
                } catch (err) {
                  console.error("Offline download failed:", err);
                } finally {
                  setDownloadingOffline(false);
                }
              }}
              className="flex flex-col items-center flex-1 cursor-pointer group active:scale-95 transition-transform"
            >
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-1 shadow-2xs transition-all ${downloadSuccess ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/50 text-emerald-600 dark:text-emerald-400' : 'bg-white dark:bg-[#131d31] hover:bg-sky-50 dark:hover:bg-sky-900/40 border border-sky-100 dark:border-sky-800/40 text-slate-700 dark:text-slate-200'}`}>
                {downloadingOffline ? (
                  <div className="w-5 h-5 border-2 border-sky-300 border-t-sky-600 rounded-full animate-spin" />
                ) : (
                  <Download className={`w-5 h-5 ${downloadSuccess ? 'text-emerald-600 dark:text-emerald-400' : 'text-sky-600 dark:text-sky-400'}`} />
                )}
              </div>
              <span className={`text-[11px] font-medium text-center ${downloadSuccess ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-600 dark:text-slate-300'}`}>
                {downloadingOffline ? 'Saving...' : downloadSuccess ? 'Saved!' : 'Save Reel'}
              </span>
            </button>

            <button 
              type="button"
              onClick={handleCopyLink} 
              className="flex flex-col items-center flex-1 cursor-pointer group active:scale-95 transition-transform"
            >
              <div className="w-11 h-11 rounded-2xl bg-white dark:bg-[#131d31] hover:bg-sky-50 dark:hover:bg-sky-900/40 border border-sky-100 dark:border-sky-800/40 text-slate-700 dark:text-slate-200 flex items-center justify-center mb-1 shadow-2xs transition-colors">
                <Link className={`w-5 h-5 ${copied ? 'text-emerald-600 dark:text-emerald-400' : 'text-sky-600 dark:text-sky-400'}`} />
              </div>
              <span className={`text-[11px] font-medium text-center ${copied ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-600 dark:text-slate-300'}`}>
                {copied ? 'Copied!' : 'Copy Link'}
              </span>
            </button>

            <button 
              type="button"
              onClick={async () => {
                if (!currentUser) return;
                try {
                  const rAny = reel as any;
                  const mediaUrl = rAny.mediaUrls?.[0] || rAny.mediaUrl || rAny.videoUrl || "";
                  const captionText = rAny.title || rAny.caption || `Reel by ${reel.authorName}`;
                  const { uploadStory } = await import('../services/storyService');
                  await uploadStory(
                    currentUser.uid,
                    currentUser.name,
                    currentUser.avatar || "",
                    null,
                    captionText,
                    "home",
                    undefined,
                    {
                      title: rAny.songInfo?.title || rAny.songTitle || captionText.substring(0, 30),
                      artist: rAny.songInfo?.artist || reel.authorName,
                      thumbnail: reel.thumbnailUrl || mediaUrl,
                      url: mediaUrl
                    }
                  );
                  alert('Reel shared to your story!');
                  onClose();
                } catch (e) {
                  console.error(e);
                  alert('Failed to add story');
                }
              }}
              className="flex flex-col items-center flex-1 cursor-pointer group active:scale-95 transition-transform"
            >
              <div className="w-11 h-11 rounded-2xl bg-white dark:bg-[#131d31] hover:bg-sky-50 dark:hover:bg-sky-900/40 border border-sky-100 dark:border-sky-800/40 text-slate-700 dark:text-slate-200 flex items-center justify-center mb-1 shadow-2xs transition-colors">
                <PlusCircle className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              </div>
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 text-center">Add Story</span>
            </button>

            {!isCurrentUser && (
              <button 
                type="button"
                className="flex flex-col items-center flex-1 cursor-pointer group active:scale-95 transition-transform"
              >
                <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800/40 text-rose-500 dark:text-rose-400 flex items-center justify-center mb-1 shadow-2xs transition-colors">
                  <Flag className="w-5 h-5 text-rose-500 dark:text-rose-400" />
                </div>
                <span className="text-[11px] font-medium text-rose-500 dark:text-rose-400 text-center">Report</span>
              </button>
            )}

            {isCurrentUser && (
              <button 
                type="button"
                onClick={onDelete} 
                className="flex flex-col items-center flex-1 cursor-pointer group active:scale-95 transition-transform"
              >
                <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800/40 flex items-center justify-center mb-1 shadow-2xs transition-colors">
                  <Trash2 className="w-5 h-5 text-rose-500 dark:text-rose-400" />
                </div>
                <span className="text-[11px] font-medium text-rose-500 dark:text-rose-400 text-center whitespace-nowrap">
                  {confirmingDelete ? 'Confirm' : 'Delete'}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Video Privacy Settings Option (Real-time update) */}
        {isOwner && selectedConvs.length === 0 && (
          <div className="px-4 py-3 bg-sky-50/70 dark:bg-[#131d31] border-t border-sky-100/70 dark:border-sky-900/40 flex flex-col space-y-2 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800 dark:text-white flex items-center space-x-1.5">
                <Lock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Settings (Privacy)</span>
              </span>
              <span className="text-[10px] font-semibold text-sky-700 dark:text-sky-300 capitalize bg-sky-100/90 dark:bg-sky-950/60 px-2 py-0.5 rounded-full border border-sky-200 dark:border-sky-800/40">
                {currentPrivacy === 'public' ? 'Public' : currentPrivacy === 'followers' ? 'Friends' : 'Only Me'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => handleUpdatePrivacy('public')}
                className={`px-2.5 py-2 rounded-2xl text-xs font-medium flex items-center justify-center space-x-1.5 border transition-all active:scale-95 ${
                  currentPrivacy === 'public'
                    ? 'bg-sky-500 text-white border-sky-500 shadow-sm font-semibold'
                    : 'bg-white dark:bg-[#131d31] text-slate-700 dark:text-slate-200 border-sky-100 dark:border-sky-800/40 hover:bg-sky-50 dark:hover:bg-sky-900/30'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Public</span>
              </button>
              <button
                type="button"
                onClick={() => handleUpdatePrivacy('followers')}
                className={`px-2.5 py-2 rounded-2xl text-xs font-medium flex items-center justify-center space-x-1.5 border transition-all active:scale-95 ${
                  currentPrivacy === 'followers'
                    ? 'bg-sky-500 text-white border-sky-500 shadow-sm font-semibold'
                    : 'bg-white dark:bg-[#131d31] text-slate-700 dark:text-slate-200 border-sky-100 dark:border-sky-800/40 hover:bg-sky-50 dark:hover:bg-sky-900/30'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Friends</span>
              </button>
              <button
                type="button"
                onClick={() => handleUpdatePrivacy('private')}
                className={`px-2.5 py-2 rounded-2xl text-xs font-medium flex items-center justify-center space-x-1.5 border transition-all active:scale-95 ${
                  currentPrivacy === 'private'
                    ? 'bg-sky-500 text-white border-sky-500 shadow-sm font-semibold'
                    : 'bg-white dark:bg-[#131d31] text-slate-700 dark:text-slate-200 border-sky-100 dark:border-sky-800/40 hover:bg-sky-50 dark:hover:bg-sky-900/30'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Only Me</span>
              </button>
            </div>
          </div>
        )}
        
        {/* Send Button - Only visible after selecting at least 1 friend */}
        {selectedConvs.length > 0 && (
          <div className="p-3 bg-white dark:bg-[#0c121e] border-t border-sky-100 dark:border-sky-900/40 shrink-0 animate-in slide-in-from-bottom-2 duration-150">
             <button 
               type="button"
               onClick={handleSend}
               className="w-full bg-gradient-to-tr from-sky-400 via-sky-500 to-blue-600 hover:brightness-105 active:scale-98 text-white font-semibold py-3 text-sm flex items-center justify-center rounded-xl transition-all shadow-md shadow-sky-500/25"
             >
               Send ({selectedConvs.length})
             </button>
          </div>
        )}

      </motion.div>
    </motion.div>, document.body
  );
};
