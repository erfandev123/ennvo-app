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
  Flag,
  Lock,
  Globe,
  Users,
  Zap
} from 'lucide-react';
import { StickerPickerModal } from './StickerPickerModal';
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
  serverTimestamp
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
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [likesCount, setLikesCount] = useState(reel.likesCount || 0);
  const [commentsCount, setCommentsCount] = useState(reel.commentsCount || 0);
  const [repostsCount, setRepostsCount] = useState(reel.repostsCount || 0);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const [floatingHearts, setFloatingHearts] = useState<{ id: number, x: number, y: number }[]>([]);
  const [isNearScreen, setIsNearScreen] = useState(true);
  const [isVertical, setIsVertical] = useState(true);
  
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isCleanZoom, setIsCleanZoom] = useState(false);
  const pinchStartDist = useRef<number>(0);

  const [isSongSaved, setIsSongSaved] = useState(false);
  const isImageReel = reel.media && reel.media.length > 0 && !reel.media[0].match(/\.(mp4|webm|mov|ogg)($|#|\?)/i);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [reelSong, setReelSong] = useState<{id: string, title: string, artist: string, url: string} | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
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
  const speedTimerRef = useRef<any>(null);

  const handleSpeedHoldStart = useCallback((e: React.SyntheticEvent) => {
    if (speedTimerRef.current) clearTimeout(speedTimerRef.current);
    if (isImageReel) {
      speedTimerRef.current = setTimeout(() => {
        if (typeof window !== "undefined" && window.navigator?.vibrate) {
          try { window.navigator.vibrate(25); } catch (err) {}
        }
        setShowShare(true);
      }, 350);
      return;
    }
    speedTimerRef.current = setTimeout(() => {
      if (typeof window !== "undefined" && window.navigator?.vibrate) {
        try { window.navigator.vibrate(20); } catch (err) {}
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
    }, 150);
  }, [isImageReel]);

  const handleSpeedHoldEnd = useCallback(() => {
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
    navStyle
  } = useAppStore();

  const reelBottomSpacing = isModal ? 'bottom-8' : navStyle === 'glass' ? 'bottom-[calc(96px+env(safe-area-inset-bottom))]' : 'bottom-[calc(65px+env(safe-area-inset-bottom))]';

  const cachedAuthor = userCache[reel.authorId];
  const authorName = cachedAuthor?.name || reel.authorName;
  const authorAvatar = cachedAuthor?.avatar || reel.authorAvatar;

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
    if (!playing || !isNearScreen || !currentUser) return;

    const repostsColRef = collection(db, 'posts', reel.id, 'reposts');
    const likesColRef = collection(db, 'posts', reel.id, 'likes');

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
          isFriend: followingSet.has(uid),
          isSelf: uid === currentUser.uid,
          updatedAt: r.createdAt?.toMillis ? r.createdAt.toMillis() : Date.now()
        });
      });

      // 2. Process Likes
      latestLikes.forEach(l => {
        const uid = l.userId || l.id;
        if (!uid) return;
        if (!seenUids.has(uid)) {
          seenUids.add(uid);
          const isSelf = uid === currentUser.uid;
          allList.push({
            uid,
            name: l.userName || (isSelf ? currentUser.name : 'User'),
            avatar: l.userAvatar || (isSelf ? currentUser.avatar : `https://ui-avatars.com/api/?name=${encodeURIComponent(l.userName || 'User')}&background=random`),
            type: 'like',
            isFriend: followingSet.has(uid),
            isSelf,
            updatedAt: l.createdAt?.toMillis ? l.createdAt.toMillis() : Date.now()
          });
        }
      });

      // Sort: Friends first, then recency so recent likes and reposts appear on the reel overlay
      allList.sort((a, b) => {
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
    // Optimization: Keep nearby reel contents mounted within 1 viewport distance for instant scroll
    const preloadObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsNearScreen(entry.isIntersecting);
        });
      },
      { rootMargin: '100% 0px' }
    );
    if (containerRef.current) preloadObserver.observe(containerRef.current);
    
    return () => preloadObserver.disconnect();
  }, []);

  useEffect(() => {
    if (highlightedPostId === reel.id && highlightedCommentId && currentUser) {
      // If there's a highlighted comment for THIS reel, automatically show comments
      setShowComments(true);
      // We don't clear setHighlightedPostId(null) here yet, might need it for scrolling in CommentsPortal
    }
  }, [highlightedCommentId, highlightedPostId, reel.id, currentUser]);

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
    if (!isNearScreen || !currentUser || (!playing && !showComments)) return;

    const reelRef = doc(db, 'posts', reel.id);
    const likeRef = doc(db, 'posts', reel.id, 'likes', currentUser.uid);
    const favRef = doc(db, 'users', currentUser.uid, 'favorites', reel.id);
    const followRef = doc(db, 'users', currentUser.uid, 'following', reel.authorId);
    const repostRef = doc(db, 'posts', reel.id, 'reposts', currentUser.uid);

    const unsubReel = onSnapshot(reelRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setLikesCount(data.likesCount || 0);
        setCommentsCount(data.commentsCount || 0);
        if (data.repostsCount !== undefined) setRepostsCount(data.repostsCount);
      }
    }, () => {});

    const unsubLike = onSnapshot(likeRef, (s) => setLiked(s.exists()), () => {});
    const unsubFav = onSnapshot(favRef, (s) => setSaved(s.exists()), () => {});
    const unsubFollow = onSnapshot(followRef, (s) => setIsFollowingUser(s.exists()), () => {});
    const unsubRepost = onSnapshot(repostRef, (s) => setReposted(s.exists()), () => {});

    let unsubSongFav: () => void = () => {};
    const effectiveSongId = reelSong?.id || reel.songId || reel.id;
    if (reel.songId) {
      getDoc(doc(db, 'songs', reel.songId)).then((snap: any) => {
        if (snap.exists()) {
          const sData = snap.data();
          // If song URL is just the reel video URL itself or auto-generated, ignore it so native video audio plays
          if (sData?.url && reel.media && reel.media.includes(sData.url)) {
            return;
          }
          if ((reel as any).createdSongId && (reel as any).createdSongId === snap.id) {
            return;
          }
          setReelSong({ id: snap.id, ...sData } as any);
        }
      });
    }
    if (effectiveSongId) {
      const songFavRef = doc(db, 'users', currentUser.uid, 'favoriteSongs', effectiveSongId);
      unsubSongFav = onSnapshot(songFavRef, (s) => setIsSongSaved(s.exists()), () => {});
    }

    return () => {
      unsubReel();
      unsubLike();
      unsubFav();
      unsubFollow();
      unsubRepost();
      unsubSongFav();
    };
  }, [reel.id, currentUser, reel.authorId, isNearScreen]);

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
    if (videoRef.current) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${p}%`;
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

  const handleLike = async () => {
    if (!currentUser) return;
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount(prev => newLiked ? prev + 1 : prev - 1);
    try {
      await toggleLike(reel.id, currentUser.uid, currentUser);
      if (newLiked) {
        await sendNotification(reel.authorId, 'like', currentUser, reel.id, reel.id, reel.media?.[0], null, reel.authorName, reel.authorAvatar);
      }
    } catch {
      setLiked(!newLiked);
      setLikesCount(prev => newLiked ? prev - 1 : prev + 1);
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
        await sendNotification(reel.authorId, 'favorite', currentUser, reel.id, reel.id, reel.media?.[0], null, reel.authorName, reel.authorAvatar);
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
    // Requirement: Show profile pictures on the Reel overlay ONLY if they are friends (isFriend === true)
    const friendInteractions = interactions.filter(item => item.isFriend);
    const topAvatars = friendInteractions.slice(0, 3);
    if (topAvatars.length === 0) return null;

    const textItems = friendInteractions.filter(item => item.type === 'repost' && item.text).slice(0, 3);

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
                    : 'text-gray-800'
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
      className="w-full h-full min-h-full snap-start flex items-center justify-center relative bg-black md:bg-[#f8f9fa] transform-gpu overflow-hidden shrink-0 select-none"
    >
      {isNearScreen && (
        <div className="flex flex-col md:flex-row items-center md:items-end justify-center w-full h-full max-w-[1200px] mx-auto relative group py-0 md:py-8 md:space-x-4 lg:space-x-8 animate-in fade-in duration-200 md:pl-28 lg:pl-32">
          
          {/* Desktop Left Info Column */}
        <div className={`hidden md:flex flex-col justify-end w-[260px] lg:w-[320px] pb-4 shrink-0 transition-all duration-300 ${isCleanZoom || is2XSpeed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          {renderActivityGroup(false)}
          <div className="flex items-center space-x-3 mb-3">
              <img 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setViewingUser({ uid: reel.authorId, name: authorName, avatar: authorAvatar }); 
                  if (onClose) onClose();
                  pushPage('profile'); 
                }}
                src={authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=random`} 
                className="w-10 h-10 rounded-full object-cover shadow-sm cursor-pointer border border-gray-100" 
              />
              <div className="flex flex-col">
                <div className="flex items-center space-x-1">
                  <span className="text-gray-900 font-normal text-[15px] cursor-pointer hover:underline" onClick={() => {
                     setViewingUser({ uid: reel.authorId, name: authorName, avatar: authorAvatar }); 
                     if (onClose) onClose();
                     pushPage('profile'); 
                  }}>
                    {(authorName || 'User').toLowerCase().replace(/\s+/g, '_')}
                  </span>
                  {(reel as any).authorIsVerified && <VerifiedBadge />}
                </div>
                {/* Audio Info Desktop */}
                <div className="flex items-center space-x-1 text-gray-500 mt-0.5">
                   <Music className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                   <span className="text-[12px] truncate font-normal">Original Audio</span>
                </div>
              </div>
              {!isCurrentUser && !isFollowingUser && (
                <>
                  <span className="text-gray-300 text-xs px-1">•</span>
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!currentUser) return;
                      await followUser(currentUser, { uid: reel.authorId, name: reel.authorName, avatar: reel.authorAvatar });
                    }}
                    className="text-blue-600 font-normal text-[14px] hover:text-blue-700 transition-colors"
                  >
                    Follow
                  </button>
                </>
              )}
            </div>
            {reel.text && (
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCaptionExpanded(!isCaptionExpanded);
                }}
                className="cursor-pointer mb-2 pr-4 group/caption select-none"
              >
                <p className={`text-gray-800 text-[14px] font-normal leading-[1.5] ${!isCaptionExpanded ? 'line-clamp-3' : ''} break-words whitespace-pre-line`}>
                  {reel.text}
                </p>
                {reel.text.length > 70 && (
                  <button 
                    type="button"
                    className="text-[12px] font-medium text-gray-500 hover:text-black underline mt-0.5 inline-block"
                  >
                    {isCaptionExpanded ? 'See less' : 'See more...'}
                  </button>
                )}
              </div>
            )}
        </div>

        {/* Main Video Container */}
        <div 
          onClick={handleTap}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`relative w-full ${isModal ? 'h-[calc(100%-50px)] self-start' : 'h-full'} md:h-[min(90dvh,850px)] md:w-auto md:min-w-[350px] md:aspect-[9/16] bg-black sm:rounded-[3px] md:rounded-[26px] overflow-hidden md:shadow-[0_16px_45px_rgba(0,0,0,0.12)] cursor-pointer flex justify-center group/video shrink-0 pt-0 transition-transform duration-300 ease-out origin-top ${showComments ? 'scale-[0.88] -translate-y-4 rounded-2xl shadow-2xl md:scale-100 md:translate-y-0 md:rounded-[26px] md:shadow-none' : ''}`}
        >
          {isExternalAudioSong && <audio ref={audioRef} src={reelSong.url} loop playsInline preload="auto" className="hidden" />}
          
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
          ) : (
            <video 
              ref={videoRef}
              src={reel.media?.[0]} 
              loop 
              muted={muted || isExternalAudioSong}
              playsInline
              // @ts-ignore
              webkit-playsinline="true"
              // @ts-ignore
              x5-playsinline="true"
              poster={reel.thumbnailUrl || reel.thumbnail || undefined}
              autoPlay={playing}
              preload={playing ? "auto" : isNearScreen ? "auto" : "metadata"}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              className={`w-full h-full mx-auto ${
                (reel as any).aspectRatioFit === 'contain' ? 'object-contain bg-black' : 'object-cover'
              } transition-transform duration-300 ease-out ${
                isCleanZoom ? 'scale-[1.08] sm:scale-110' : ''
              }`}
            />
          )}

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
                className="mb-1.5 bg-black/40 hover:bg-black/60 text-white text-[10px] font-normal px-2.5 py-1 rounded-full border border-white/20 backdrop-blur-md transition-all active:scale-95 flex items-center space-x-1 self-start shadow-xs"
              >
                <MoreHorizontal className="w-3 h-3 text-white/90" />
                <span>View Analytics</span>
              </button>
            )}
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
                  {(authorName || 'User').toLowerCase().replace(/\s+/g, '_')}
                </span>
                {(reel as any).authorIsVerified && <VerifiedBadge />}
              </div>
              {!isCurrentUser && !isFollowingUser && (
                <>
                  <span className="text-white/60 text-xs">•</span>
                  <button 
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!currentUser) return;
                      await followUser(currentUser, { uid: reel.authorId, name: reel.authorName, avatar: reel.authorAvatar });
                    }}
                    className="text-white border border-white/50 bg-black/20 font-normal text-[12px] px-2 py-0.5 rounded-md hover:bg-white hover:text-black transition-colors"
                  >
                    Follow
                  </button>
                </>
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
          </div>

          {/* Vertical Action Buttons (Overlayed on Video - MOBILE ONLY) */}
          <div className={`md:hidden absolute right-2.5 ${reelBottomSpacing} flex flex-col items-center space-y-2.5 z-40 pointer-events-auto transition-all duration-300 ${isCleanZoom || is2XSpeed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <div 
              onClick={(e) => { e.stopPropagation(); handleLike(); }} 
              onTouchStart={(e) => { e.stopPropagation(); }}
              className={`flex flex-col items-center cursor-pointer select-none active:scale-90 transition-transform ${liked ? 'liked' : ''}`}
            >
              <div className="text-[1.85rem] leading-none text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform duration-200 active:scale-75" style={liked ? {color: '#fe2c55', filter: 'drop-shadow(0 0 6px rgba(254, 44, 85, 0.5))'} : {}}>
                <ion-icon name={liked ? "heart" : "heart-outline"}></ion-icon>
              </div>
              <span className="text-white text-[0.75rem] font-medium mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{demoCounts.likes}</span>
            </div>
            
            <div onClick={(e) => { e.stopPropagation(); setShowComments(true); }} className="flex flex-col items-center cursor-pointer">
              <div className="text-[1.85rem] leading-none text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform duration-200 active:scale-75">
                <ion-icon name="chatbubble-ellipses-outline"></ion-icon>
              </div>
              <span className="text-white text-[0.75rem] font-medium mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{demoCounts.comments}</span>
            </div>
            
            <div onClick={(e) => { e.stopPropagation(); handleFavorite(); }} className={`flex flex-col items-center cursor-pointer ${saved ? 'saved' : ''}`}>
              <div className="text-[1.85rem] leading-none text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform duration-200 active:scale-75" style={saved ? {color: '#FFD700', filter: 'drop-shadow(0 0 5px rgba(255, 215, 0, 0.4))'} : {}}>
                <ion-icon name={saved ? "bookmark" : "bookmark-outline"}></ion-icon>
              </div>
              <span className="text-white text-[0.75rem] font-medium mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">Save</span>
            </div>

            <div onClick={(e) => { e.stopPropagation(); setShowShare(true); }} className="flex flex-col items-center cursor-pointer">
              <div className="text-[1.85rem] leading-none text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform duration-200 active:scale-75">
                <ion-icon name="arrow-redo-outline"></ion-icon>
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

          {/* Sound / Mute toggle button when paused or tapped */}
          {!(isImageReel && !reelSong) && isNearScreen && (
            <button 
              onClick={(e) => { e.stopPropagation(); setMuted(!muted); }}
              className={`absolute top-10 left-4 z-30 md:top-6 md:left-6 p-2.5 bg-black/40 hover:bg-black/60 rounded-full text-white transition-all active:scale-90 backdrop-blur-md border border-white/20 shadow-lg flex items-center justify-center ${playing ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}
              title={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX className="w-4.5 h-4.5 text-white fill-white" /> : <Volume2 className="w-4.5 h-4.5 text-white fill-white" />}
            </button>
          )}

          {/* Timeline / Progress Bar (Ultra-thin Android style in Classic Navigation) */}
          {!isImageReel && isNearScreen && navStyle !== 'glass' && (
            <div 
              className={`absolute ${isModal ? 'bottom-1' : 'bottom-[calc(56px+env(safe-area-inset-bottom))]'} left-0 right-0 h-3 z-40 flex items-end cursor-pointer group/timeline touch-none select-none`}
              onClick={(e) => {
                e.stopPropagation();
                if (videoRef.current && videoRef.current.duration) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const percentage = Math.max(0, Math.min(1, x / rect.width));
                  const targetTime = percentage * videoRef.current.duration;
                  videoRef.current.currentTime = targetTime;
                  if (audioRef.current) audioRef.current.currentTime = targetTime;
                  if (progressBarRef.current) {
                    progressBarRef.current.style.transition = 'none';
                    progressBarRef.current.style.width = `${percentage * 100}%`;
                  }
                }
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                try {
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                } catch (err) {}
                if (progressBarRef.current) {
                  progressBarRef.current.style.transition = 'none';
                }
              }}
              onPointerMove={(e) => {
                if (e.buttons === 1 && videoRef.current && videoRef.current.duration) {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const percentage = Math.max(0, Math.min(1, x / rect.width));
                  const targetTime = percentage * videoRef.current.duration;
                  videoRef.current.currentTime = targetTime;
                  if (audioRef.current) audioRef.current.currentTime = targetTime;
                  if (progressBarRef.current) {
                    progressBarRef.current.style.transition = 'none';
                    progressBarRef.current.style.width = `${percentage * 100}%`;
                  }
                }
              }}
            >
              <div className="w-full h-[2px] group-hover/timeline:h-[3.5px] bg-white/20 relative overflow-hidden transition-all duration-150">
                <div 
                  ref={progressBarRef} 
                  className="h-full bg-white group-hover/timeline:bg-gradient-to-r group-hover/timeline:from-purple-400 group-hover/timeline:to-pink-500 shadow-[0_0_4px_rgba(255,255,255,0.8)]" 
                  style={{ width: '0%', transition: 'none' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Desktop Right Actions Column */}
        <div className={`hidden md:flex flex-col items-start justify-end space-y-3 pb-2 pl-4 w-[260px] lg:w-[320px] shrink-0 transition-opacity duration-300 ${isCleanZoom ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div 
            onClick={(e) => { e.stopPropagation(); handleLike(); }} 
            className="flex flex-col items-center space-y-1 cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            <div className="text-[2.5rem] leading-none text-gray-900 drop-shadow-sm transition-colors" style={liked ? {color: '#fe2c55'} : {}}>
              <ion-icon name={liked ? "heart" : "heart-outline"}></ion-icon>
            </div>
            <span className="text-gray-700 text-[0.85rem] font-normal mt-1.5">{demoCounts.likes}</span>
          </div>
          
          <div 
            onClick={(e) => { e.stopPropagation(); setShowComments(true); }} 
            className="flex flex-col items-center space-y-1 cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            <div className="text-[2.5rem] leading-none text-gray-900 drop-shadow-sm">
              <ion-icon name="chatbubble-ellipses-outline"></ion-icon>
            </div>
            <span className="text-gray-700 text-[0.85rem] font-normal mt-1.5">{demoCounts.comments}</span>
          </div>

          <div 
            onClick={(e) => { e.stopPropagation(); handleFavorite(); }} 
            className="flex flex-col items-center space-y-1 cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            <div className="text-[2.5rem] leading-none text-gray-900 drop-shadow-sm" style={saved ? {color: '#FFD700'} : {}}>
              <ion-icon name={saved ? "bookmark" : "bookmark-outline"}></ion-icon>
            </div>
            <span className="text-gray-700 text-[0.85rem] font-normal mt-1.5">Save</span>
          </div>
          
          <div 
            onClick={(e) => { e.stopPropagation(); setShowShare(true); }} 
            className="flex flex-col items-center space-y-1 cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            <div className="text-[2.5rem] leading-none text-gray-900 drop-shadow-sm">
              <ion-icon name="arrow-redo-outline"></ion-icon>
            </div>
            <span className="text-gray-700 text-[0.85rem] font-normal mt-1.5">Share</span>
          </div>

          {isCurrentUser && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setTargetAnalyticsPostId(reel.id);
                setShowAnalytics(true);
              }}
              className="mt-4 text-xs font-normal text-gray-500 hover:text-blue-600 transition-colors uppercase tracking-wider"
            >
              Analytics
            </button>
          )}
        </div>

        {/* Navigation Indicators (Right far - PC ONLY) */}
        <div className="hidden md:flex flex-col items-center absolute right-[10px] sm:right-[30px] lg:right-[50px] top-1/2 -translate-y-1/2 z-50 bg-white/10 p-2 rounded-full backdrop-blur-md border border-white/20">
           <button 
             onClick={(e) => {
               e.stopPropagation();
               const c = document.getElementById('global-reels-container') || document.documentElement;
               c.scrollBy({ top: -window.innerHeight, behavior: 'smooth' });
             }}
             title="Previous Reel"
             className="p-3 bg-white/20 rounded-full shadow-md hover:bg-white transition-all active:scale-95 border border-transparent group mb-2"
           >
             <ChevronUp className="w-6 h-6 text-white group-hover:text-gray-900 drop-shadow-md" strokeWidth={3} />
           </button>
           <button 
             onClick={(e) => {
               e.stopPropagation();
               const c = document.getElementById('global-reels-container') || document.documentElement;
               c.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
             }}
             title="Next Reel"
             className="p-3 bg-white/20 rounded-full shadow-md hover:bg-white transition-all active:scale-95 border border-transparent group"
           >
             <ChevronDown className="w-6 h-6 text-white group-hover:text-gray-900 drop-shadow-md" strokeWidth={3} />
           </button>
        </div>

        {/* Modal Close Button */}
        {isModal && (
          <>
            <button onClick={onClose} className="absolute top-12 left-4 sm:top-8 sm:left-8 p-3 bg-black/40 sm:bg-white hover:bg-black/60 sm:hover:bg-gray-100 rounded-full text-white sm:text-gray-900 sm:shadow-md sm:border sm:border-gray-200 transition-all active:scale-90 z-[100]">
              <X className="w-6 h-6" strokeWidth={2.5} />
            </button>
            <div className="md:hidden absolute bottom-0 left-0 right-0 h-[52px] bg-black border-t border-white/10 flex items-center px-4 z-[90] space-x-3 pb-[env(safe-area-inset-bottom)]">
              <img src={currentUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || 'User')}`} className="w-8 h-8 rounded-full object-cover shrink-0" />
              <input 
                type="text" 
                placeholder="Add comment..."
                className="flex-1 bg-white/10 text-white placeholder-white/50 rounded-full px-4 py-2 text-sm focus:outline-none border border-transparent focus:border-white/20 transition-all"
                onClick={(e) => { e.stopPropagation(); setShowComments(true); }}
                readOnly
              />
            </div>
          </>
        )}
      </div>
      )}

      {/* Action Menu Popover Removed */}


        {/* Modal Header for Web/Tablets */}
        {isModal && (
          <button onClick={onClose} className="hidden sm:flex absolute -top-12 -left-12 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white border border-white/20 transition-all active:scale-95">
            <X className="w-6 h-6" />
          </button>
        )}

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
      {showRepostModal && createPortal(
        <div 
          className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4"
          onClick={() => setShowRepostModal(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md rounded-t-[24px] sm:rounded-2xl p-5 shadow-2xl flex flex-col space-y-4 animate-in slide-in-from-bottom duration-200"
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center space-x-2">
                <Repeat className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-gray-900 text-base">Repost Reel</h3>
              </div>
              <button 
                onClick={() => setShowRepostModal(false)}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex items-start space-x-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
              <img 
                src={currentUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || 'User')}`}
                className="w-9 h-9 rounded-full object-cover shrink-0"
                alt="Avatar"
              />
              <textarea
                value={repostInputText}
                onChange={(e) => setRepostInputText(e.target.value)}
                placeholder="Add your thoughts or caption (optional)..."
                className="w-full bg-transparent border-none outline-none text-sm text-gray-900 placeholder-gray-400 resize-none min-h-[70px]"
                maxLength={200}
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-1">
              {reposted && (
                <button
                  onClick={async () => {
                    if (!currentUser) return;
                    setIsRepostingLoading(true);
                    await toggleRepost(reel.id, currentUser.uid);
                    setReposted(false);
                    setRepostsCount(prev => Math.max(0, prev - 1));
                    setIsRepostingLoading(false);
                    setShowRepostModal(false);
                  }}
                  disabled={isRepostingLoading}
                  className="px-4 py-2 rounded-xl text-xs font-normal text-red-600 hover:bg-red-50 border border-red-200 transition-all active:scale-95"
                >
                  Remove Repost
                </button>
              )}
              <button
                onClick={async () => {
                  if (!currentUser) return;
                  setIsRepostingLoading(true);
                  const isNowReposted = await toggleRepost(reel.id, currentUser.uid, currentUser, repostInputText);
                  setReposted(isNowReposted);
                  if (isNowReposted) {
                    setRepostsCount(prev => prev + 1);
                    await sendNotification(reel.authorId, 'favorite', currentUser, reel.id, reel.id, reel.media?.[0], null, reel.authorName, reel.authorAvatar);
                  }
                  setIsRepostingLoading(false);
                  setShowRepostModal(false);
                }}
                disabled={isRepostingLoading}
                className="px-5 py-2 rounded-xl text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 transition-all active:scale-95 shadow-md shadow-blue-500/20"
              >
                {isRepostingLoading ? 'Posting...' : reposted ? 'Update Repost' : 'Repost'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showInteractionsModal && (
        <ReelInteractionsModal 
          reelId={reel.id}
          interactions={interactions}
          onClose={() => setShowInteractionsModal(false)}
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
            className="bg-white rounded-t-[28px] sm:rounded-3xl w-full max-w-md p-6 flex flex-col shadow-2xl relative overflow-hidden text-gray-900"
          >
            <button 
              onClick={() => setShowSongModal(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
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

              <h3 className="text-lg font-bold text-gray-900 leading-snug">
                {reelSong ? reelSong.title : 'Original Audio'}
              </h3>
              <p className="text-xs font-medium text-gray-500 mt-1">
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
                        ? 'bg-purple-50 border-purple-200 text-purple-700' 
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Bookmark className={`w-4 h-4 ${isSongSaved ? 'fill-purple-700 text-purple-700' : 'text-gray-600'}`} />
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

const ReelInteractionsModal = ({
  reelId,
  interactions,
  onClose,
  onSelectUser
}: {
  reelId: string;
  interactions: InteractionItem[];
  onClose: () => void;
  onSelectUser: (user: { uid: string; name: string; avatar: string }) => void;
}) => {
  const { currentUser } = useAppStore();
  const [filter, setFilter] = useState<'all' | 'reposts' | 'likes'>('all');
  
  // Realtime state for activity likes & replies
  const [activityLikes, setActivityLikes] = useState<Record<string, string[]>>({});
  const [activityReplies, setActivityReplies] = useState<Record<string, any[]>>({});
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [activeReplyInput, setActiveReplyInput] = useState<string | null>(null);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');

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

        // Send notification to target user
        if (item.uid !== currentUser.uid) {
          await sendNotification(
            item.uid, 
            'like', 
            currentUser, 
            reelId, 
            reelId, 
            undefined, 
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

  const handleSendReply = async (item: InteractionItem) => {
    if (!currentUser) return;
    const targetKey = `${item.uid}_${item.type}`;
    const text = (replyInputs[targetKey] || '').trim();
    if (!text) return;

    try {
      await addDoc(collection(db, 'posts', reelId, 'activityReplies'), {
        targetKey,
        targetUid: item.uid,
        authorUid: currentUser.uid,
        authorName: currentUser.name || 'User',
        authorAvatar: currentUser.avatar || '',
        text,
        createdAt: Date.now()
      });

      // Send notification to target user
      if (item.uid !== currentUser.uid) {
        await sendNotification(
          item.uid, 
          'comment', 
          currentUser, 
          reelId, 
          reelId, 
          undefined, 
          null, 
          currentUser.name, 
          currentUser.avatar
        );
      }

      setReplyInputs(prev => ({ ...prev, [targetKey]: '' }));
      setExpandedReplies(prev => ({ ...prev, [targetKey]: true }));
      setActiveReplyInput(null);
    } catch (e) {
      console.error("Error sending activity reply:", e);
    }
  };

  const friendInteractions = useMemo(() => {
    return interactions.filter(i => i.isFriend || i.uid === currentUser?.uid);
  }, [interactions, currentUser?.uid]);

  const filteredInteractions = useMemo(() => {
    if (filter === 'reposts') return friendInteractions.filter(i => i.type === 'repost');
    if (filter === 'likes') return friendInteractions.filter(i => i.type === 'like');
    return friendInteractions;
  }, [friendInteractions, filter]);

  return createPortal(
    <div 
      className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-md rounded-t-[24px] sm:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-200 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 text-base">Activity</h3>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex border-b border-gray-100 px-4 pt-2 space-x-2">
          <button 
            onClick={() => setFilter('all')}
            className={`pb-2 px-3 text-xs font-medium border-b-2 transition-colors ${
              filter === 'all' ? 'border-black text-black font-semibold' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            All ({friendInteractions.length})
          </button>
          <button 
            onClick={() => setFilter('reposts')}
            className={`pb-2 px-3 text-xs font-medium border-b-2 transition-colors ${
              filter === 'reposts' ? 'border-green-500 text-green-600 font-semibold' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Reposts ({friendInteractions.filter(i => i.type === 'repost').length})
          </button>
          <button 
            onClick={() => setFilter('likes')}
            className={`pb-2 px-3 text-xs font-medium border-b-2 transition-colors ${
              filter === 'likes' ? 'border-red-500 text-red-600 font-semibold' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Likes ({friendInteractions.filter(i => i.type === 'like').length})
          </button>
        </div>

        {/* List of Activity Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
          {filteredInteractions.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              No activity yet
            </div>
          ) : (
            filteredInteractions.map((item) => {
              const targetKey = `${item.uid}_${item.type}`;
              const likesList = activityLikes[targetKey] || [];
              const isLiked = currentUser ? likesList.includes(currentUser.uid) : false;
              const repliesList = activityReplies[targetKey] || [];
              const isExpanded = expandedReplies[targetKey] || false;
              const isReplying = activeReplyInput === targetKey;

              return (
                <div 
                  key={targetKey}
                  className="p-3 rounded-2xl bg-gray-50/70 border border-gray-100 transition-all flex flex-col"
                >
                  <div className="flex items-start justify-between space-x-3">
                    <div 
                      onClick={() => {
                        onSelectUser({ uid: item.uid, name: item.name, avatar: item.avatar });
                        onClose();
                      }}
                      className="flex items-center space-x-3 cursor-pointer flex-1 min-w-0"
                    >
                      <div className="relative shrink-0">
                        <img 
                          src={item.avatar} 
                          alt={item.name} 
                          className="w-10 h-10 rounded-full object-cover border border-gray-100 shadow-sm"
                        />
                        <div className={`absolute -bottom-1 -right-1 p-0.5 rounded-full shadow-xs ${
                          item.type === 'repost' ? 'bg-green-500' : 'bg-red-500'
                        }`}>
                          {item.type === 'repost' ? (
                            <Repeat className="w-3 h-3 text-white" strokeWidth={3} />
                          ) : (
                            <Heart className="w-3 h-3 text-white fill-white" />
                          )}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {item.isSelf ? 'You' : item.name}
                          </p>
                          {item.isFriend && (
                            <span className="text-[10px] font-medium bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full shrink-0">
                              Friend
                            </span>
                          )}
                        </div>
                        {item.type === 'repost' && item.text ? (
                          <p className="text-xs text-gray-800 font-normal mt-0.5 italic">
                            "{item.text}"
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 font-normal mt-0.5">
                            {item.type === 'repost' ? 'Reposted this reel' : 'Liked this reel'}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Like Activity Button */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLikeActivity(item);
                      }}
                      className="flex items-center space-x-1 p-1.5 rounded-full hover:bg-gray-100 transition-colors shrink-0"
                    >
                      <Heart 
                        className={`w-4 h-4 transition-transform active:scale-125 ${
                          isLiked ? 'fill-red-500 text-red-500' : 'text-gray-400'
                        }`} 
                      />
                      {likesList.length > 0 && (
                        <span className="text-xs font-medium text-gray-500">{likesList.length}</span>
                      )}
                    </button>
                  </div>

                  {/* Actions Row (Reply trigger & See Replies toggle) */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 text-xs">
                    <button 
                      onClick={() => setActiveReplyInput(isReplying ? null : targetKey)}
                      className="text-gray-500 hover:text-black font-medium transition-colors flex items-center space-x-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Reply</span>
                    </button>

                    {repliesList.length > 0 && (
                      <button 
                        onClick={() => setExpandedReplies(prev => ({ ...prev, [targetKey]: !isExpanded }))}
                        className="text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1 transition-colors"
                      >
                        <span>{isExpanded ? 'Hide replies' : `See replies (${repliesList.length})`}</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>

                  {/* Inline Reply Input */}
                  {isReplying && (
                    <div className="mt-2.5 flex items-center space-x-2 animate-in fade-in duration-150">
                      <input 
                        type="text" 
                        value={replyInputs[targetKey] || ''}
                        onChange={(e) => setReplyInputs(prev => ({ ...prev, [targetKey]: e.target.value }))}
                        placeholder={`Reply to ${item.isSelf ? 'yourself' : item.name}...`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSendReply(item);
                        }}
                        className="flex-1 bg-white border border-gray-200 rounded-full px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-black"
                        autoFocus
                      />
                      <button 
                        onClick={() => handleSendReply(item)}
                        className="p-1.5 bg-black text-white rounded-full hover:bg-gray-800 transition-colors shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Replies List (Indented to the right and below) */}
                  {isExpanded && repliesList.length > 0 && (
                    <div className="ml-6 pl-2 mt-2 space-y-2.5 pt-1">
                      {repliesList.map((reply) => (
                        <div key={reply.id} className="flex items-start space-x-2 group/reply">
                          <img 
                            src={reply.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(reply.authorName || 'User')}&background=random`} 
                            alt={reply.authorName} 
                            className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5 border border-gray-100 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectUser({ uid: reply.authorUid, name: reply.authorName, avatar: reply.authorAvatar });
                              onClose();
                            }}
                          />
                          <div className="flex-1 min-w-0 bg-white p-2 rounded-xl border border-gray-100 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <span 
                                className="text-xs font-semibold text-gray-900 truncate cursor-pointer hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectUser({ uid: reply.authorUid, name: reply.authorName, avatar: reply.authorAvatar });
                                  onClose();
                                }}
                              >
                                {reply.authorUid === currentUser?.uid ? 'You' : reply.authorName}
                              </span>
                              <div className="flex items-center space-x-1.5 ml-2 shrink-0">
                                <span className="text-[10px] text-gray-400">
                                  {formatTime(reply.createdAt)}
                                </span>
                                {reply.authorUid === currentUser?.uid && (
                                  <div className="flex items-center space-x-1 pl-1">
                                    <button 
                                      onClick={() => handleStartEditReply(reply)}
                                      className="p-0.5 text-gray-400 hover:text-black transition-colors"
                                      title="Edit reply"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteReply(reply.id)}
                                      className="p-0.5 text-gray-400 hover:text-red-500 transition-colors"
                                      title="Delete reply"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {editingReplyId === reply.id ? (
                              <div className="mt-1.5 flex items-center space-x-1.5">
                                <input 
                                  type="text" 
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  className="flex-1 text-xs border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:border-black"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveEditReply(reply.id);
                                    if (e.key === 'Escape') setEditingReplyId(null);
                                  }}
                                />
                                <button 
                                  onClick={() => handleSaveEditReply(reply.id)}
                                  className="p-1 bg-black text-white rounded-md hover:bg-gray-800"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button 
                                  onClick={() => setEditingReplyId(null)}
                                  className="p-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <p className="text-xs text-gray-700 mt-0.5 font-normal break-words">
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
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

const MentionText = ({ text, onClosePortal }: { text: string; onClosePortal?: () => void }) => {
  const { setViewingUser, pushPage } = useAppStore();
  const parts = (text || '').split(/(@\w+)/g);
  return (
    <span className="text-[13px] text-gray-900 font-normal leading-relaxed break-words">
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
              className="text-blue-600 font-medium hover:underline cursor-pointer"
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

  return (
    <div className="mt-1.5 flex items-center space-x-2.5 bg-gray-100/90 border border-gray-200/80 px-3 py-1.5 rounded-full max-w-[230px] shadow-2xs">
      <button 
        type="button"
        onClick={togglePlay} 
        className="w-6 h-6 rounded-full bg-[#0095f6] text-white flex items-center justify-center shrink-0 shadow-xs hover:scale-105 active:scale-95 transition-transform"
      >
        {isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col justify-center space-y-0.5 min-w-0">
        <div className="flex items-center space-x-0.5 h-3 w-full">
          {[35, 75, 45, 90, 60, 30, 85, 50, 95, 40, 70, 50, 80, 45, 65, 30].map((h, i) => {
            const barProgress = (i / 16) * 100;
            const isFilled = barProgress <= progressPct;
            return (
              <div 
                key={i} 
                className={`flex-1 rounded-full transition-all duration-150 ${
                  isFilled ? 'bg-[#0095f6]' : 'bg-gray-300'
                }`} 
                style={{ 
                  height: isPlaying ? `${Math.max(25, (h + (i % 3) * 15) % 100)}%` : `${h * 0.45}%`
                }}
              />
            );
          })}
        </div>
        <div className="flex justify-between items-center text-[9.5px] font-medium text-gray-500 font-mono">
          <span>{formatSecs(currentTime)}</span>
          <span>{formatSecs(totalDuration || 5)}</span>
        </div>
      </div>
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
    <div ref={itemRef} className={`flex space-x-2.5 group relative transition-colors duration-200 rounded-xl p-1 ${highlightedCommentId === comment.id ? 'bg-blue-50/60' : ''} ${comment.parentId ? 'ml-6 pl-2 my-1' : ''}`}>
      <img 
        src={comment.authorAvatar} 
        className={`${comment.parentId ? 'w-6 h-6' : 'w-8 h-8'} rounded-full object-cover cursor-pointer hover:opacity-85 transition-opacity shrink-0 mt-0.5 border border-gray-100`} 
        onClick={handleProfileClick}
        referrerPolicy="no-referrer"
        alt={comment.authorName}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-1.5 flex-wrap">
          {/* Author Name */}
          <p className={`${comment.parentId ? 'text-[11px]' : 'text-[12px]'} font-semibold text-gray-900 cursor-pointer hover:underline truncate`} onClick={handleProfileClick}>
            {comment.authorName}
          </p>

          {comment.replyToName && (
            <div className="flex items-center space-x-1">
              <span className="text-[10px] text-gray-400 font-normal">▸</span>
              <span 
                className="font-medium text-[12px] text-blue-600 cursor-pointer hover:underline truncate"
                onClick={handleReplyToClick}
              >
                {comment.replyToName}
              </span>
            </div>
          )}
          
          {/* Creator Badge ONLY if actual video/post owner */}
          {Boolean(authorId) && comment.authorId === authorId && (
            <span className="bg-blue-50 text-blue-600 border border-blue-200/80 text-[9.5px] font-semibold px-2 py-0.5 rounded-full leading-none tracking-tight shrink-0 flex items-center space-x-0.5 shadow-2xs">
              <span>Creator</span>
            </span>
          )}

          <span className="text-[10px] text-gray-400 font-normal shrink-0">· {formatTime(comment.createdAt)}</span>
        </div>
        
        {/* Comment Text - Solid Black */}
        {comment.text && (
          <div className={`${comment.parentId ? 'text-[12px]' : 'text-[13px]'} text-black font-normal leading-relaxed break-words mt-0.5`}>
            <MentionText text={comment.text} onClosePortal={onClosePortal} />
          </div>
        )}

        {/* Photo Attachment - Clickable for Lightbox */}
        {comment.imageUrl && (
          <div className="mt-1.5 cursor-pointer inline-block group/img" onClick={() => setIsImageModalOpen(true)}>
            <img 
              src={comment.imageUrl} 
              className="max-h-48 max-w-[220px] rounded-2xl object-cover border border-gray-100 shadow-2xs group-hover/img:opacity-90 transition-opacity" 
              alt="Comment attachment" 
            />
          </div>
        )}

        {/* Sticker Attachment - Clickable for Save/Share Modal */}
        {comment.stickerUrl && (
          <div 
            onClick={() => setIsStickerModalOpen(true)}
            className="my-1 cursor-pointer inline-block hover:scale-105 active:scale-95 transition-transform"
          >
            {comment.stickerUrl.startsWith('http') ? (
              <img src={comment.stickerUrl} className="h-20 w-20 object-contain rounded-xl shadow-xs" alt="Sticker" />
            ) : (
              <span className="text-3xl select-none">{comment.stickerUrl}</span>
            )}
          </div>
        )}

        {/* Voice Note Attachment */}
        {comment.audioUrl && (
          <VoicePlayer audioUrl={comment.audioUrl} duration={comment.audioDuration} />
        )}

        <div className="flex items-center space-x-3 mt-1 text-[10px] font-normal text-gray-400">
           <button onClick={() => onReply(comment.parentId || comment.id!, comment.authorName, comment.authorId)} className="hover:text-gray-900 uppercase tracking-tight font-medium">Reply</button>
           {currentUser?.uid === comment.authorId || currentUser?.uid === authorId ? (
             <button onClick={handleDelete} className={`${cConfirmDelete ? 'text-red-500 font-medium' : 'text-gray-300 hover:text-red-600'} uppercase text-[9px] tracking-tight`}>{cConfirmDelete ? 'Confirm?' : 'Delete'}</button>
           ) : null}
        </div>
      </div>

      {/* Heart Icon on Right with Like Count */}
      <button onClick={handleLike} className="flex flex-col items-center flex-shrink-0 pt-0.5 hover:scale-110 active:scale-90 transition-transform min-w-[22px]">
        <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-red-500 text-red-500' : 'text-gray-300 hover:text-gray-400'}`} />
        {likesCount > 0 && (
          <span className={`text-[9.5px] font-medium mt-0.5 ${liked ? 'text-red-500' : 'text-gray-400'}`}>
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

      {/* Save / Share Modal for Sticker */}
      {isStickerModalOpen && comment.stickerUrl && createPortal(
        <div 
          className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsStickerModalOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl p-5 w-full max-w-xs flex flex-col items-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 bg-gray-50 rounded-2xl flex items-center justify-center min-h-[100px] min-w-[100px]">
              {comment.stickerUrl.startsWith('http') ? (
                <img src={comment.stickerUrl} className="h-24 w-24 object-contain" alt="Sticker" />
              ) : (
                <span className="text-6xl">{comment.stickerUrl}</span>
              )}
            </div>
            <div className="w-full space-y-2">
              <button 
                onClick={() => {
                  try {
                    const saved = JSON.parse(localStorage.getItem('saved_stickers') || '[]');
                    if (!saved.includes(comment.stickerUrl)) {
                      localStorage.setItem('saved_stickers', JSON.stringify([...saved, comment.stickerUrl]));
                    }
                  } catch(e) {}
                  setIsStickerModalOpen(false);
                }}
                className="w-full bg-blue-500 hover:bg-blue-600 active:scale-98 text-white font-medium py-2.5 rounded-xl text-xs transition-all flex items-center justify-center space-x-2 shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Save Sticker</span>
              </button>
              <button 
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(comment.stickerUrl || '');
                  }
                  setIsStickerModalOpen(false);
                }}
                className="w-full bg-gray-100 hover:bg-gray-200 active:scale-98 text-gray-800 font-medium py-2.5 rounded-xl text-xs transition-all flex items-center justify-center space-x-2"
              >
                <Share2 className="w-4 h-4" />
                <span>Share / Copy Sticker</span>
              </button>
            </div>
          </div>
        </div>,
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
      transition={{ duration: 0.18, ease: "linear" }}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 md:p-4 touch-manipulation" 
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: "0%" }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
        style={{ transform: 'translateZ(0)', willChange: 'transform' }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-[28px] sm:rounded-2xl w-full max-w-lg h-[75vh] sm:h-[80dvh] max-h-[750px] flex flex-col overflow-hidden shadow-2xl transform-gpu"
      >
        {/* Mobile Grab Handle */}
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto my-2.5 shrink-0 sm:hidden" />

        {/* Clean Header */}
        <div className="flex justify-between items-center px-4 py-2.5 border-b border-gray-100 flex-shrink-0 bg-white">
          <div className="w-8"></div>
          <h3 className="font-semibold text-gray-900 text-[15px] mx-auto">Comments</h3>
          <button onClick={onClose} className="p-1.5 bg-gray-100/80 hover:bg-gray-200 rounded-full transition-colors active:scale-95"><X className="w-4 h-4 text-gray-600" /></button>
        </div>

        {/* Comments List - Ultra White Background */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 no-scrollbar bg-white">
          {loading ? (
            <div className="space-y-4 py-2 animate-pulse">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex space-x-3 items-start">
                  <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0"></div>
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="w-28 h-3 bg-gray-200 rounded"></div>
                    <div className="w-3/4 h-3 bg-gray-100 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
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
                            className="flex items-center space-x-1.5 text-[11px] font-medium text-blue-600 hover:text-blue-700 transition-colors pt-1"
                          >
                            <span className="w-3.5 h-[1px] bg-blue-300"></span>
                            <span>See {replies.length} {replies.length === 1 ? 'reply' : 'replies'}...</span>
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        )}

                        {limit > 0 && remainingReplies > 0 && (
                          <button 
                            onClick={() => setVisibleReplyLimits(prev => ({ ...prev, [parent.id]: (prev[parent.id] || 5) + 5 }))}
                            className="flex items-center space-x-1.5 text-[11px] font-medium text-blue-600 hover:text-blue-700 transition-colors pt-1"
                          >
                            <span className="w-3.5 h-[1px] bg-blue-300"></span>
                            <span>See {Math.min(5, remainingReplies)} more {remainingReplies === 1 ? 'reply' : 'replies'} ({remainingReplies} remaining)...</span>
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        )}

                        {limit > 0 && (
                          <button 
                            onClick={() => setVisibleReplyLimits(prev => ({ ...prev, [parent.id]: 0 }))}
                            className="flex items-center space-x-1.5 text-[11px] font-normal text-gray-500 hover:text-gray-700 transition-colors pt-1 ml-2"
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
          <div className="absolute bottom-20 left-4 right-4 bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50">
            {mentions.map(f => (
              <button 
                type="button"
                key={f.uid} 
                onClick={() => selectMention(f)}
                className="w-full flex items-center space-x-3 p-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
              >
                <img src={f.avatar} className="w-7 h-7 rounded-full object-cover" referrerPolicy="no-referrer" alt={f.name} />
                <span className="font-normal text-xs text-gray-900">{f.name}</span>
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

        {/* Input & Action Controls Form */}
        <form onSubmit={handleSubmit} style={{ transform: 'translateZ(0)' }} className="p-3 border-t border-gray-100 flex flex-col space-y-2 bg-white sticky bottom-0 z-20 shrink-0 shadow-[0_-2px_10px_rgba(0,0,0,0.03)] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {/* Replying Banner */}
          {replyingTo && (
            <div className="flex items-center justify-between text-[11px] bg-gray-50 px-3 py-1 rounded-lg border border-gray-100">
              <span className="text-gray-500 font-normal">Replying to <span className="font-medium text-gray-900">@{replyingTo.name}</span></span>
              <button type="button" onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-gray-900 font-normal uppercase text-[9px]">Cancel</button>
            </div>
          )}

          {/* Attachment Previews */}
          {(selectedImage || selectedSticker || recordedAudioUrl) && (
            <div className="flex items-center space-x-2 bg-gray-50 p-2 rounded-xl border border-gray-200/60">
              {selectedImage && (
                <div className="relative group">
                  <img src={selectedImage} className="w-12 h-12 rounded-lg object-cover border border-gray-200" alt="Preview" />
                  <button type="button" onClick={() => setSelectedImage(null)} className="absolute -top-1.5 -right-1.5 bg-black/70 text-white rounded-full p-0.5 hover:bg-black">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              {selectedSticker && (
                <div className="relative group flex items-center bg-white px-2.5 py-1.5 rounded-2xl border border-gray-200 shadow-2xs">
                  {selectedSticker.endsWith('.mp4') || selectedSticker.endsWith('.webm') ? (
                    <video src={selectedSticker} autoPlay loop muted playsInline className="w-10 h-10 object-contain rounded-lg" />
                  ) : selectedSticker.startsWith('http') || selectedSticker.startsWith('data:') ? (
                    <img src={selectedSticker} className="w-10 h-10 object-contain" alt="Sticker" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-2xl">{selectedSticker}</span>
                  )}
                  <button type="button" onClick={() => setSelectedSticker(null)} className="ml-2 p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {recordedAudioUrl && (
                <div className="relative flex items-center space-x-2 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200 text-xs text-blue-700">
                  <Mic className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                  <span className="font-normal">Voice Note (0:{recordedAudioDuration < 10 ? '0' : ''}{recordedAudioDuration})</span>
                  <button type="button" onClick={() => setRecordedAudioUrl(null)} className="text-blue-400 hover:text-red-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Active Voice Recording Bar */}
          {isRecording ? (
            <div className="flex items-center justify-between bg-red-50 border border-red-200/80 rounded-full px-4 py-2 animate-in fade-in duration-150">
              <div className="flex items-center space-x-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0"></span>
                <span className="text-xs font-normal text-red-700">Recording... 0:{recordingTime < 10 ? '0' : ''}{recordingTime}</span>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  type="button" 
                  onClick={stopVoiceRecording} 
                  className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 active:scale-95 transition-transform" 
                  title="Done Recording"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button 
                  type="button" 
                  onClick={cancelVoiceRecording} 
                  className="p-1.5 bg-gray-200 text-gray-600 rounded-full hover:bg-gray-300 active:scale-95 transition-transform" 
                  title="Cancel Recording"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-2 bg-gray-100/90 hover:bg-gray-100 transition-colors border border-gray-200/80 rounded-2xl px-2 py-1.5 shadow-2xs">
              <img src={currentUser?.avatar || "https://picsum.photos/seed/myprofile/32/32"} className="w-7 h-7 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" alt="Avatar" />
              
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
                className="flex-1 bg-transparent focus:outline-none text-[13px] text-gray-900 placeholder-gray-400 font-normal px-1.5 py-1 resize-none max-h-24 min-h-[28px] overflow-y-auto no-scrollbar" 
              />

              {/* Action Buttons: Solid BLACK icons */}
              <div className="flex items-center space-x-1 shrink-0 text-black font-semibold">
                <button 
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="p-1.5 hover:text-blue-600 hover:bg-white rounded-full transition-colors text-black"
                  title="Attach Photo"
                >
                  <ImageIcon className="w-4 h-4 stroke-[2.2]" />
                </button>

                <button 
                  type="button"
                  onClick={startVoiceRecording}
                  className="p-1.5 hover:text-red-600 hover:bg-white rounded-full transition-colors text-black"
                  title="Record Voice Note"
                >
                  <Mic className="w-4 h-4 stroke-[2.2]" />
                </button>

                <button 
                  type="button"
                  onClick={() => setShowStickerPicker(!showStickerPicker)}
                  className={`p-1.5 hover:text-amber-500 hover:bg-white rounded-full transition-colors text-black ${showStickerPicker ? 'text-amber-500 bg-white' : ''}`}
                  title="Stickers & GIFs"
                >
                  <Smile className="w-4 h-4 stroke-[2.2]" />
                </button>

                <button 
                  disabled={!text.trim() && !selectedImage && !selectedSticker && !recordedAudioUrl} 
                  className="text-white bg-blue-500 p-1.5 rounded-full hover:bg-blue-600 disabled:bg-gray-300 disabled:text-white transition-all flex items-center justify-center shadow-xs active:scale-95 ml-1"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
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
    import('../services/chatService').then(async ({ sendMessage }) => {
      for (const targetId of selectedTargets) {
        try {
          await sendMessage(targetId, currentUser.uid, shareType === 'post' ? 'reel' : shareType, 'Shared a post', postMedia, reel.id);
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
      transition={{ duration: 0.18, ease: "linear" }}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 md:p-4 touch-manipulation backdrop-blur-xs" 
      onClick={onClose}
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: "0%" }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
        style={{ transform: 'translateZ(0)', willChange: 'transform' }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-t-[32px] sm:rounded-[32px] w-full max-w-lg h-auto max-h-[85dvh] flex flex-col overflow-hidden shadow-2xl transform-gpu relative border border-gray-100"
      >
        {/* Mobile Grab Handle */}
        <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto my-2.5 shrink-0 sm:hidden" />
        
        {/* Header */}
        <div className="relative px-4 py-2.5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="w-8"></div>
          <h3 className="font-semibold text-[15px] text-gray-900 mx-auto">Share to</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors active:scale-95">
             <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        {/* Search */}
        <div className="p-3 shrink-0">
          <div className="bg-gray-100 rounded-xl px-3.5 py-2 flex items-center space-x-2">
             <Search className="w-4 h-4 text-gray-400 shrink-0" />
             <input 
               type="text" 
               placeholder="Search people..." 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="bg-transparent flex-1 outline-none text-sm font-normal text-gray-900 placeholder-gray-400" 
             />
          </div>
        </div>

        {/* User Grid - Scrollable Container */}
        <div className="overflow-y-auto px-4 py-2 min-h-[160px] max-h-[300px] sm:max-h-[360px] scrollbar-thin scrollbar-thumb-gray-200">
          {filteredTargets.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs font-normal">
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
                         className={`w-[52px] h-[52px] rounded-full object-cover shadow-xs transition-all ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 opacity-85 scale-105' : 'group-hover:opacity-95'}`} 
                         referrerPolicy="no-referrer"
                       />
                       {isSelected && (
                         <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full border-2 border-white p-0.5 shadow-xs animate-in zoom-in-50">
                           <CheckCircle2 className="w-3.5 h-3.5 text-white fill-white" />
                         </div>
                       )}
                     </div>
                     <span className="font-medium text-[11px] text-center text-gray-800 leading-tight line-clamp-1 max-w-[68px]">{c.participantNames[otherId || '']}</span>
                   </div>
                 )
              })}
            </div>
          )}
        </div>

        {/* Quick Action Rows - Hidden when a friend is selected */}
        {selectedConvs.length === 0 && (
          <div className="px-3 py-3 border-t border-gray-100 flex items-center justify-around space-x-2 shrink-0 bg-gray-50/50">
            <button 
              type="button"
              onClick={onRepost} 
              className="flex flex-col items-center flex-1 cursor-pointer group active:scale-95 transition-transform"
            >
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-1 border transition-all ${hasReposted ? 'bg-green-50 border-green-200 text-green-600 shadow-2xs' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100 shadow-2xs'}`}>
                <Repeat className={`w-5 h-5 ${hasReposted ? 'text-green-600' : 'text-gray-700'}`} />
              </div>
              <span className={`text-[11px] font-medium text-center ${hasReposted ? 'text-green-600' : 'text-gray-600'}`}>
                {hasReposted ? 'Undo' : 'Repost'}
              </span>
            </button>
            
            <button 
              type="button"
              onClick={handleCopyLink} 
              className="flex flex-col items-center flex-1 cursor-pointer group active:scale-95 transition-transform"
            >
              <div className="w-11 h-11 rounded-2xl bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 flex items-center justify-center mb-1 shadow-2xs transition-colors">
                <Link className={`w-5 h-5 ${copied ? 'text-green-600' : 'text-gray-700'}`} />
              </div>
              <span className={`text-[11px] font-medium text-center ${copied ? 'text-green-600 font-semibold' : 'text-gray-600'}`}>
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
              <div className="w-11 h-11 rounded-2xl bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 flex items-center justify-center mb-1 shadow-2xs transition-colors">
                <PlusCircle className="w-5 h-5 text-gray-700" />
              </div>
              <span className="text-[11px] font-medium text-gray-600 text-center">Add Story</span>
            </button>

            {!isCurrentUser && (
              <button 
                type="button"
                className="flex flex-col items-center flex-1 cursor-pointer group active:scale-95 transition-transform"
              >
                <div className="w-11 h-11 rounded-2xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-500 flex items-center justify-center mb-1 shadow-2xs transition-colors">
                  <Flag className="w-5 h-5 text-red-500" />
                </div>
                <span className="text-[11px] font-medium text-red-500 text-center">Report</span>
              </button>
            )}

            {isCurrentUser && (
              <button 
                type="button"
                onClick={onDelete} 
                className="flex flex-col items-center flex-1 cursor-pointer group active:scale-95 transition-transform"
              >
                <div className="w-11 h-11 rounded-2xl bg-red-50 hover:bg-red-100 border border-red-200 flex items-center justify-center mb-1 shadow-2xs transition-colors">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <span className="text-[11px] font-medium text-red-500 text-center whitespace-nowrap">
                  {confirmingDelete ? 'Confirm' : 'Delete'}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Video Privacy Settings Option (Real-time update) */}
        {isOwner && selectedConvs.length === 0 && (
          <div className="px-4 py-3 bg-purple-50/70 border-t border-purple-100/70 flex flex-col space-y-2 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-800 flex items-center space-x-1.5">
                <Lock className="w-3.5 h-3.5 text-purple-600" />
                <span>Settings (Privacy)</span>
              </span>
              <span className="text-[10px] font-semibold text-purple-700 capitalize bg-purple-100/90 px-2 py-0.5 rounded-full border border-purple-200">
                {currentPrivacy === 'public' ? 'Public' : currentPrivacy === 'followers' ? 'Friends' : 'Only Me'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => handleUpdatePrivacy('public')}
                className={`px-2.5 py-2 rounded-2xl text-xs font-medium flex items-center justify-center space-x-1.5 border transition-all active:scale-95 ${
                  currentPrivacy === 'public'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm font-semibold'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
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
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm font-semibold'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
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
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm font-semibold'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
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
          <div className="p-3 bg-white border-t border-gray-100 shrink-0 animate-in slide-in-from-bottom-2 duration-150">
             <button 
               onClick={handleSend}
               className="w-full bg-blue-500 hover:bg-blue-600 active:scale-98 text-white font-semibold py-3 text-sm flex items-center justify-center rounded-xl transition-all shadow-md shadow-blue-500/20"
             >
               Send ({selectedConvs.length})
             </button>
          </div>
        )}

      </motion.div>
    </motion.div>, document.body
  );
};
