import React, { useState, useCallback, useEffect, memo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  MessageCircle, 
  Send, 
  Bookmark, 
  X, 
  MoreHorizontal, 
  Globe, 
  Trash2, 
  Share2, 
  BarChart2, 
  Volume2, 
  VolumeX, 
  Play, 
  Pause,
  Copy,
  Check,
  Music,
  MapPin,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  Repeat2
} from 'lucide-react';
import { MediaInfoModal } from './MediaInfoModal';
import { useAppStore } from '../store';
import { toggleLike, addComment, getComments, deletePost, deleteComment, toggleCommentLike, toggleFavorite, toggleRepost, incrementViewCount } from '../services/postService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Post, Comment } from '../types';
import { sendNotification } from '../services/notificationService';
import { findUserByUsername } from '../services/userService';
import { sendMessage, subscribeConversations } from '../services/chatService';
import { formatTime, formatCount } from '../utils';
import { SharePortal, CommentsPortal } from './ReelItem';
import { VerifiedBadge } from './VerifiedBadge';
import { useShallow } from 'zustand/react/shallow';

interface PostItemProps {
  post: Post;
  theme?: 'white' | 'purple';
}

const MentionText = ({ text, onClosePortal, isWhiteText = false }: { text: string; onClosePortal?: () => void; isWhiteText?: boolean }) => {
  const { setViewingUser, pushPage } = useAppStore(useShallow((s: any) => ({ setViewingUser: s.setViewingUser, pushPage: s.pushPage })));
  if (!text) return null;

  const renderFormattedToken = (token: string, key: number) => {
    if (token.startsWith('@')) {
      return (
        <span 
          key={key} 
          onClick={(e) => {
            e.stopPropagation();
            const username = token.substring(1);
            findUserByUsername(username.toLowerCase()).then(u => {
              if (u) {
                setViewingUser({ uid: u.uid, name: u.name, avatar: u.avatar });
                pushPage('profile');
                if (onClosePortal) onClosePortal();
              }
            });
          }}
          className={`${isWhiteText ? 'text-blue-200' : 'text-blue-600'} font-bold hover:underline cursor-pointer`}
        >
          {token}
        </span>
      );
    }
    if (token.startsWith('#')) {
      return (
        <span key={key} className={`${isWhiteText ? 'text-blue-300' : 'text-blue-500'} font-semibold cursor-pointer hover:underline`}>
          {token}
        </span>
      );
    }
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      return <strong key={key} className="font-bold">{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
      return <em key={key} className="italic">{token.slice(1, -1)}</em>;
    }
    if (token.startsWith('~~') && token.endsWith('~~') && token.length > 4) {
      return <del key={key} className="line-through opacity-75">{token.slice(2, -2)}</del>;
    }
    if (token.startsWith('<u>') && token.endsWith('</u>') && token.length > 7) {
      return <u key={key} className="underline underline-offset-2">{token.slice(3, -4)}</u>;
    }
    if (token.startsWith('> ')) {
      return (
        <span key={key} className="block border-l-3 border-blue-500 pl-3 py-0.5 my-1 italic text-gray-700 bg-gray-50 rounded-r-md">
          {token.slice(2)}
        </span>
      );
    }

    return <span key={key}>{token}</span>;
  };

  const tokens = text.split(/(\*\*.+?\*\*|\*.+?\*|~~.+?~~|<u>.+?<\/u>|^> .+$|@\w+|#\w+|\n)/gm);

  return (
    <span className={`text-[14px] ${isWhiteText ? 'text-white' : 'text-gray-800'} break-words leading-relaxed whitespace-pre-line`}>
      {tokens.map((token, index) => {
        if (!token) return null;
        if (token === '\n') return <br key={index} />;
        return renderFormattedToken(token, index);
      })}
    </span>
  );
};

export const PostItem: React.FC<PostItemProps> = React.memo(({ post, theme = 'white' }) => {
  const { 
    setViewingUser, 
    setViewingMedia, 
    currentUser, 
    pushPage, 
    setShowAnalytics, 
    setTargetAnalyticsPostId,
    setShowLikesList, 
    setTargetLikesPostId, 
    setShowViewsList, 
    setTargetViewsPostId,
    highlightedCommentId,
    setHighlightedCommentId,
    highlightedPostId,
    setHighlightedPostId,
    viewingReel
  } = useAppStore(useShallow((s: any) => ({
    setViewingUser: s.setViewingUser,
    setViewingMedia: s.setViewingMedia,
    currentUser: s.currentUser,
    pushPage: s.pushPage,
    setShowAnalytics: s.setShowAnalytics,
    setTargetAnalyticsPostId: s.setTargetAnalyticsPostId,
    setShowLikesList: s.setShowLikesList,
    setTargetLikesPostId: s.setTargetLikesPostId,
    setShowViewsList: s.setShowViewsList,
    setTargetViewsPostId: s.setTargetViewsPostId,
    highlightedCommentId: s.highlightedCommentId,
    setHighlightedCommentId: s.setHighlightedCommentId,
    highlightedPostId: s.highlightedPostId,
    setHighlightedPostId: s.setHighlightedPostId,
    viewingReel: s.viewingReel,
  })))

  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [reposted, setReposted] = useState(false);
  const [repostsCount, setRepostsCount] = useState<number>((post as any).repostsCount || 0);
  const [showOptions, setShowOptions] = useState(false);
  const [showMediaInfoModal, setShowMediaInfoModal] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isNearScreen, setIsNearScreen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  
  // Double tap heart animation
  const [showHeartOverlay, setShowHeartOverlay] = useState(false);
  const lastTapRef = useRef<number>(0);

  // Active media carousel state
  const [activeMediaIdx, setActiveMediaIdx] = useState(0);

  // Touch swipe support for multi-media
  const postTouchStartX = useRef<number | null>(null);
  const postTouchEndX = useRef<number | null>(null);

  const handlePostTouchStart = (e: React.TouchEvent) => {
    postTouchStartX.current = e.targetTouches[0].clientX;
  };

  const handlePostTouchMove = (e: React.TouchEvent) => {
    postTouchEndX.current = e.targetTouches[0].clientX;
  };

  const handlePostTouchEnd = () => {
    if (!postTouchStartX.current || !postTouchEndX.current || !post.media) return;
    const distance = postTouchStartX.current - postTouchEndX.current;
    if (distance > 40 && post.media.length > 1) {
      setActiveMediaIdx((prev) => (prev < post.media.length - 1 ? prev + 1 : 0));
    } else if (distance < -40 && post.media.length > 1) {
      setActiveMediaIdx((prev) => (prev > 0 ? prev - 1 : post.media.length - 1));
    }
    postTouchStartX.current = null;
    postTouchEndX.current = null;
  };

  // Background Audio State
  const [isPlayingPostAudio, setIsPlayingPostAudio] = useState(false);
  const postAudioRef = useRef<HTMLAudioElement | null>(null);

  // Inline comment state
  const [inlineCommentText, setInlineCommentText] = useState('');
  const [isSubmittingInline, setIsSubmittingInline] = useState(false);

  const handleSendInlineComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !inlineCommentText.trim() || isSubmittingInline) return;
    const textToSend = inlineCommentText.trim();
    setInlineCommentText('');
    setIsSubmittingInline(true);
    try {
      await addComment(post.id, currentUser.uid, currentUser, textToSend);
      const targetAuthorId = post.authorId || (post as any).userId || (post as any).authorUID;
      if (targetAuthorId && currentUser.uid !== targetAuthorId) {
        await sendNotification(targetAuthorId, 'comment', currentUser, post.id, post.id, post.media?.[0], null, post.authorName, post.authorAvatar);
      }
    } catch (err) {
      console.error('Failed to post inline comment', err);
    } finally {
      setIsSubmittingInline(false);
    }
  };

  const togglePostAudio = (url: string) => {
    if (isPlayingPostAudio) {
      postAudioRef.current?.pause();
      setIsPlayingPostAudio(false);
    } else {
      if (!postAudioRef.current) {
        postAudioRef.current = new Audio(url);
      } else {
        postAudioRef.current.src = url;
      }
      postAudioRef.current.play();
      setIsPlayingPostAudio(true);
      postAudioRef.current.onended = () => setIsPlayingPostAudio(false);
    }
  };

  // Video playback states for post videos
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewTrackedRef = useRef(false);

  const [isCenteredInViewport, setIsCenteredInViewport] = useState(false);

  useEffect(() => {
    if (!viewingReel && highlightedPostId === post.id && highlightedCommentId && currentUser) {
      setShowCommentsModal(true);
      if (typeof setHighlightedPostId === 'function') {
        setHighlightedPostId(null);
        setHighlightedCommentId(null);
      }
    }
  }, [viewingReel, highlightedCommentId, highlightedPostId, post.id, currentUser, setHighlightedPostId, setHighlightedCommentId]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsNearScreen(entry.isIntersecting),
      { rootMargin: '300px 0px' }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    
    // View Tracking & Audio Autoplay Observer (50% visibility threshold)
    const viewObserver = new IntersectionObserver(
      ([entry]) => {
        const isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.45;
        setIsCenteredInViewport(isVisible);
        if (entry.isIntersecting && !viewTrackedRef.current && currentUser && currentUser.uid !== post.authorId) {
           viewTrackedRef.current = true;
           incrementViewCount(post.id, currentUser.uid).catch(() => {});
        }
      },
      { threshold: [0, 0.45, 0.75] }
    );
    if (containerRef.current) viewObserver.observe(containerRef.current);
    
    return () => { observer.disconnect(); viewObserver.disconnect(); };
  }, [currentUser, post.authorId, post.id]);

  // Feed Background Song Autoplay when post comes into view!
  useEffect(() => {
    const bgSongUrl = (post as any).songUrl || (post as any).songInfo?.url;
    if (!bgSongUrl) return;

    if (isCenteredInViewport) {
      if (!postAudioRef.current) {
        postAudioRef.current = new Audio(bgSongUrl);
        postAudioRef.current.loop = true;
      } else {
        postAudioRef.current.src = bgSongUrl;
      }
      
      const playPromise = postAudioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlayingPostAudio(true))
          .catch((err) => {
            // Browser autoplay restrictions require initial touch/click
            console.log('Background song autoplay waiting for user interaction');
          });
      }
    } else {
      if (postAudioRef.current) {
        postAudioRef.current.pause();
        setIsPlayingPostAudio(false);
      }
    }

    return () => {
      if (postAudioRef.current) {
        postAudioRef.current.pause();
        setIsPlayingPostAudio(false);
      }
    };
  }, [isCenteredInViewport, (post as any).songUrl, (post as any).songInfo?.url]);

  useEffect(() => {
    if (currentUser && post.id && isNearScreen) {
       const likeRef = doc(db, 'posts', post.id, 'likes', currentUser.uid);
       const unsubLike = onSnapshot(likeRef, (d) => setLiked(d.exists()), () => {});
       const favRef = doc(db, 'users', currentUser.uid, 'favorites', post.id);
       const unsubFav = onSnapshot(favRef, (d) => setIsSaved(d.exists()), () => {});
       const repostRef = doc(db, 'posts', post.id, 'reposts', currentUser.uid);
       const unsubRepost = onSnapshot(repostRef, (d) => setReposted(d.exists()), () => {});
       return () => { unsubLike(); unsubFav(); unsubRepost(); };
    }
  }, [currentUser, post.id, isNearScreen]);

  const handleRepost = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    const newReposted = !reposted;
    setReposted(newReposted);
    setRepostsCount(prev => newReposted ? prev + 1 : Math.max(0, prev - 1));

    try {
      await toggleRepost(post.id, currentUser.uid, { name: currentUser.name, avatar: currentUser.avatar });
      const targetAuthorId = post.authorId || (post as any).userId || (post as any).authorUID;
      if (newReposted && targetAuthorId && currentUser.uid !== targetAuthorId) {
        await sendNotification(targetAuthorId, 'repost', currentUser, post.id, post.id, post.media?.[0], null, post.authorName, post.authorAvatar);
      }
    } catch (error) {
      console.error('Repost error:', error);
      setReposted(!newReposted);
      setRepostsCount(prev => !newReposted ? prev + 1 : Math.max(0, prev - 1));
    }
  }, [reposted, post, currentUser]);

  const handleToggleFavorite = async () => {
    if (!currentUser) return;
    const newSaved = !isSaved;
    setIsSaved(newSaved);
    try {
      await toggleFavorite(post.id, currentUser.uid);
      if (newSaved) {
        const targetAuthorId = post.authorId || (post as any).userId || (post as any).authorUID;
        if (targetAuthorId && currentUser.uid !== targetAuthorId) {
          await sendNotification(targetAuthorId, 'favorite', currentUser, post.id, post.id, post.media?.[0], null, post.authorName, post.authorAvatar);
        }
      }
    } catch (error) {
      setIsSaved(!newSaved);
    }
  };

  const handleLike = useCallback(async () => {
    if (!currentUser) return;
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount(prev => newLiked ? prev + 1 : prev - 1);
    
    try {
      await toggleLike(post.id, currentUser.uid);
      if (newLiked) {
        const targetAuthorId = post.authorId || (post as any).userId || (post as any).authorUID;
        if (targetAuthorId && currentUser.uid !== targetAuthorId) {
          await sendNotification(targetAuthorId, 'like', currentUser, post.id, post.id, post.media?.[0], null, post.authorName, post.authorAvatar);
        }
      }
    } catch (error) {
      setLiked(!newLiked);
      setLikesCount(prev => !newLiked ? prev + 1 : prev - 1);
    }
  }, [liked, post, currentUser]);

  const handleDoubleTap = (e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    const timeDiff = now - lastTapRef.current;
    if (timeDiff < 350 && timeDiff > 0) {
      // Trigger heart pop
      setShowHeartOverlay(true);
      setTimeout(() => setShowHeartOverlay(false), 900);
      if (!liked) {
        handleLike();
      }
    }
    lastTapRef.current = now;
  };

  const handleDelete = async () => {
    if (!currentUser || isDeleting) return;
    setIsDeleting(true);
    try {
      await deletePost(post.id, currentUser.uid);
      setShowOptions(false);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error(error);
      alert('Failed to delete post');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyLink = () => {
    const postUrl = `${window.location.origin}/#post-${post.id}`;
    navigator.clipboard.writeText(postUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      setShowOptions(false);
    });
  };

  const cachedAuthor = useAppStore(state => state.userCache[post.authorId]);
  const authorName = cachedAuthor?.name || post.authorName;
  const authorAvatar = cachedAuthor?.avatar || post.authorAvatar;

  const isBigText = !post.media || post.media.length === 0;
  const isShortText = (post.text || '').length < 90 && !post.text.includes('\n');

  const toggleVideoPlayback = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const isProfileTheme = theme === 'purple';

  return (
    <article 
      ref={containerRef}
      className={`relative w-full transition-all duration-300 select-none pb-2 ${
        isProfileTheme 
          ? 'bg-transparent' 
          : 'bg-transparent'
      }`}
    >
      {/* Header matching Screen 3 */}
      <div className="flex items-center justify-between px-2 pt-1.5 pb-2">
        <div 
          className="flex items-center space-x-3 cursor-pointer group select-none min-w-0"
          onClick={() => {
            setViewingUser({ uid: post.authorId, name: authorName, avatar: authorAvatar });
            pushPage('profile');
          }}
        >
          <img 
            src={authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName || 'User')}&background=random`} 
            alt={authorName} 
            loading="lazy" 
            decoding="async" 
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-full object-cover shrink-0 ring-1 ring-black/5 dark:ring-white/10" 
          />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center space-x-1.5">
              <h4 className="font-bold text-[15px] leading-tight text-neutral-900 dark:text-white truncate group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors">
                {authorName}
              </h4>
              {(post as any).authorIsVerified && <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />}
            </div>
            <div className="text-[12px] text-neutral-500 dark:text-neutral-400 font-normal leading-tight mt-0.5 truncate">
              {(post as any).location || formatTime(post.createdAt)}
            </div>
          </div>
        </div>

        {/* Right Actions Header: subtle Insights icon if owner + MoreHorizontal (···) */}
        <div className="flex items-center space-x-1 shrink-0">
          {currentUser?.uid === post.authorId && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setTargetAnalyticsPostId(post.id);
                setShowAnalytics(true);
              }}
              className="p-1.5 text-neutral-400 hover:text-blue-500 dark:hover:text-blue-400 rounded-full transition-colors cursor-pointer"
              title="Post Insights"
            >
              <BarChart2 className="w-4 h-4" />
            </button>
          )}

          <div className="relative">
            <button 
              onClick={() => setShowOptions(!showOptions)}
              className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-white rounded-full transition-colors cursor-pointer"
              aria-label="Post options"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            
            {showOptions && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowOptions(false)} />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-black rounded-2xl shadow-lg border border-gray-200/90 dark:border dark:border-white/20 py-1.5 z-50 overflow-hidden"
                >
                  <button 
                    onClick={() => { handleToggleFavorite(); setShowOptions(false); }}
                    className="w-full px-3.5 py-2.5 text-left flex items-center space-x-2.5 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors text-gray-700 dark:text-gray-200 text-[13px] font-medium cursor-pointer"
                  >
                    <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-yellow-500 text-yellow-500' : 'text-gray-500 dark:text-gray-400'}`} />
                    <span>{isSaved ? 'Unsave Post' : 'Save Post'}</span>
                  </button>

                  <button 
                    onClick={handleCopyLink}
                    className="w-full px-3.5 py-2.5 text-left flex items-center space-x-2.5 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors text-gray-700 dark:text-gray-200 text-[13px] font-medium cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500 dark:text-gray-400" />}
                    <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
                  </button>

                  {currentUser?.uid === post.authorId && (
                    <>
                      <button 
                        onClick={() => { setShowMediaInfoModal(true); setShowOptions(false); }}
                        className="w-full px-3.5 py-2.5 text-left flex items-center space-x-2.5 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors text-purple-600 dark:text-purple-400 text-[13px] font-semibold border-t border-gray-100 dark:border-white/15 cursor-pointer"
                      >
                        <HardDrive className="w-4 h-4 text-purple-500" />
                        <span>Media Info (Me Only)</span>
                      </button>

                      <button 
                        onClick={() => { setShowDeleteConfirm(true); setShowOptions(false); }}
                        className="w-full px-3.5 py-2.5 text-left flex items-center space-x-2.5 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors text-red-600 dark:text-red-400 text-[13px] font-medium border-t border-gray-100 dark:border-white/15 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete Post</span>
                      </button>
                    </>
                  )}
                </motion.div>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Compact & Unique Post Song Pill - Not black, No border */}
      {((post as any).songTitle || (post as any).songUrl) && (
        <div className="mx-2 mb-2 px-3 py-1.5 rounded-full bg-neutral-100/90 dark:bg-white/[0.08] text-neutral-800 dark:text-neutral-100 border-0 flex items-center justify-between gap-2.5 transition-all select-none w-fit max-w-[calc(100%-16px)] shadow-none">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            {/* Animated Equalizer Sound wave / Mini Music Icon */}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-transform ${
              isPlayingPostAudio ? 'bg-violet-600 text-white shadow-xs' : 'bg-neutral-200 dark:bg-white/10 text-neutral-700 dark:text-neutral-300'
            }`}>
              {isPlayingPostAudio ? (
                <div className="flex items-end space-x-0.5 h-2.5">
                  <span className="w-0.5 bg-white rounded-full animate-eq-1" />
                  <span className="w-0.5 bg-white rounded-full animate-eq-2" />
                  <span className="w-0.5 bg-white rounded-full animate-eq-3" />
                </div>
              ) : (
                <Music className="w-3.5 h-3.5" />
              )}
            </div>

            {/* Song title and artist in one compact line */}
            <div className="flex items-center space-x-1.5 min-w-0 text-xs">
              <span className="font-bold text-[12.5px] text-neutral-900 dark:text-white truncate">
                {(post as any).songTitle || 'Track'}
              </span>
              {(post as any).songArtist && (
                <>
                  <span className="text-neutral-400 dark:text-neutral-500">•</span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                    {(post as any).songArtist}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Small Play / Pause Button */}
          {(post as any).songUrl && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePostAudio((post as any).songUrl);
              }}
              className="w-6 h-6 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center transition-transform cursor-pointer shrink-0 shadow-xs border-0"
              title={isPlayingPostAudio ? "Pause" : "Play"}
            >
              {isPlayingPostAudio ? (
                <Pause className="w-2.5 h-2.5 fill-current" />
              ) : (
                <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
              )}
            </button>
          )}
        </div>
      )}

      {/* Post Text: Only rendered above media when media exists */}
      {!isBigText && post.text && (
        <div className="px-3 pb-2 pt-0.5">
          <div className={`text-[14px] leading-relaxed break-words font-normal ${isProfileTheme ? 'text-gray-800' : 'text-gray-800 dark:text-white'}`}>
            {isExpanded ? (
              <MentionText text={post.text} />
            ) : (
              <>
                <MentionText text={post.text.length > 180 ? `${post.text.substring(0, 180)}...` : post.text} />
                {post.text.length > 180 && (
                  <button 
                    onClick={() => setIsExpanded(true)}
                    className="text-blue-600 font-medium ml-1.5 hover:underline text-[13px] cursor-pointer"
                  >
                    more
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Big Text Post (Text-only): Fresh, clean, beautifully squircle rounded design matching screenshot */}
      {isBigText && post.text && (() => {
        const bgVal = (post as any).bg || 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500';
        const isCustomBg = bgVal.startsWith('#') || bgVal.startsWith('rgb') || bgVal.startsWith('hsl') || bgVal.startsWith('linear-gradient');
        return (
          <div className="relative w-full my-1 px-0.5">
            <div 
              style={isCustomBg ? { background: bgVal } : undefined}
              className={`w-full min-h-[220px] sm:min-h-[260px] flex items-center justify-center p-7 sm:p-9 text-white rounded-[34px] sm:rounded-[40px] text-center select-text ring-1 ring-black/5 dark:ring-white/10 ${!isCustomBg ? bgVal : ''}`}
            >
              <div className="text-[20px] sm:text-[23px] font-bold leading-relaxed max-w-[90%] mx-auto">
                <MentionText text={post.text} isWhiteText={true} />
              </div>
            </div>
          </div>
        );
      })()}

      {/* Post Media Section - Squircle Rounded Photos Separated by Gaps Matching Screenshot */}
      {post.media && post.media.length > 0 && (
        <div 
          className="relative w-full select-none my-1.5 px-0.5"
          onClick={handleDoubleTap}
        >
          {/* Double tap heart overlay */}
          <AnimatePresence>
            {showHeartOverlay && (
              <motion.div 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.25, 1], opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
              >
                <div className="p-4 bg-white/20 backdrop-blur-md rounded-full shadow-2xl">
                  <Heart className="w-20 h-20 text-red-500 fill-red-500 drop-shadow-[0_10px_20px_rgba(239,68,68,0.5)]" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 1. SINGLE MEDIA (Fixed unified squircle card box matching screenshot) */}
          {post.media.length === 1 && (
            <div className="relative w-full h-[360px] sm:h-[420px] rounded-[34px] sm:rounded-[40px] overflow-hidden bg-neutral-100 dark:bg-neutral-900 ring-1 ring-black/5 dark:ring-white/10 flex items-center justify-center">
              {post.type === 'reel' || post.media[0].match(/\.(mp4|webm|mov|ogg|m4v|3gp)($|#|\?)/i) || post.media[0].includes('video') || post.media[0].includes('/reels/') || post.media[0].includes('/stories/') ? (
                <div className="relative w-full h-full flex items-center justify-center bg-black group/video">
                  {!isNearScreen ? (
                    <div className="w-full h-full bg-neutral-900 flex items-center justify-center">
                      {(post.thumbnailUrl || (post as any).thumbnail) && (
                        <img 
                          src={post.thumbnailUrl || (post as any).thumbnail} 
                          alt="" 
                          className="w-full h-full object-contain block mx-auto" 
                          loading="lazy" 
                        />
                      )}
                    </div>
                  ) : (
                    <video 
                      ref={videoRef}
                      src={post.media[0]} 
                      autoPlay={isCenteredInViewport && isPlaying}
                      muted={isMuted}
                      loop
                      playsInline
                      // @ts-ignore
                      webkit-playsinline="true"
                      // @ts-ignore
                      x5-playsinline="true"
                      poster={post.thumbnailUrl || (post as any).thumbnail || undefined}
                      className="w-full h-full object-contain block mx-auto"
                      referrerPolicy="no-referrer"
                      preload={isCenteredInViewport ? "metadata" : "none"}
                    />
                  )}

                  {/* Video Controls Overlay */}
                  <div className="absolute bottom-3 right-3 flex items-center space-x-2 z-20">
                    <button 
                      onClick={toggleMute}
                      className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-md transition-transform"
                      aria-label="Mute toggle"
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={toggleVideoPlayback}
                      className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-md transition-transform"
                      aria-label="Play pause toggle"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                    </button>
                  </div>
                </div>
              ) : (
                <img 
                  src={post.media[0]} 
                  alt="Post content" 
                  loading="lazy" 
                  decoding="async" 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover block cursor-pointer transition-transform duration-300" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingMedia({ type: 'post', url: post.media[0], user: { name: post.authorName, avatar: post.authorAvatar } });
                  }}
                />
              )}
            </div>
          )}

          {/* 2. TWO PHOTOS (Separate squircle boxes with clean gap) */}
          {post.media.length === 2 && (
            <div className="grid grid-cols-2 gap-2.5 w-full h-[260px] sm:h-[300px]">
              {post.media.map((imgUrl, idx) => (
                <div 
                  key={idx} 
                  className="relative h-full rounded-[26px] sm:rounded-[30px] overflow-hidden bg-neutral-100 dark:bg-neutral-900 ring-1 ring-black/5 dark:ring-white/10 group cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingMedia({ type: 'post', url: imgUrl, user: { name: post.authorName, avatar: post.authorAvatar } });
                  }}
                >
                  <img 
                    src={imgUrl} 
                    alt={`Photo ${idx + 1}`} 
                    loading="lazy" 
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-300"
                  />
                </div>
              ))}
            </div>
          )}

          {/* 3. THREE PHOTOS (1 Big on left, 2 Smaller stacked on right, each in separate squircle box) */}
          {post.media.length === 3 && (
            <div className="grid grid-cols-5 gap-2.5 w-full h-[320px] sm:h-[360px]">
              {/* Big Photo on left (takes 3 cols) */}
              <div 
                className="col-span-3 h-full rounded-[28px] sm:rounded-[32px] overflow-hidden bg-neutral-100 dark:bg-neutral-900 ring-1 ring-black/5 dark:ring-white/10 group cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewingMedia({ type: 'post', url: post.media[0], user: { name: post.authorName, avatar: post.authorAvatar } });
                }}
              >
                <img 
                  src={post.media[0]} 
                  alt="Primary photo" 
                  loading="lazy" 
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-300"
                />
              </div>

              {/* 2 Smaller photos stacked on right (takes 2 cols) */}
              <div className="col-span-2 flex flex-col gap-2.5 h-full">
                <div 
                  className="flex-1 rounded-[22px] sm:rounded-[26px] overflow-hidden bg-neutral-100 dark:bg-neutral-900 ring-1 ring-black/5 dark:ring-white/10 group cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingMedia({ type: 'post', url: post.media[1], user: { name: post.authorName, avatar: post.authorAvatar } });
                  }}
                >
                  <img 
                    src={post.media[1]} 
                    alt="Photo 2" 
                    loading="lazy" 
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-300"
                  />
                </div>
                <div 
                  className="flex-1 rounded-[22px] sm:rounded-[26px] overflow-hidden bg-neutral-100 dark:bg-neutral-900 ring-1 ring-black/5 dark:ring-white/10 group cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingMedia({ type: 'post', url: post.media[2], user: { name: post.authorName, avatar: post.authorAvatar } });
                  }}
                >
                  <img 
                    src={post.media[2]} 
                    alt="Photo 3" 
                    loading="lazy" 
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-300"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4. FOUR OR MORE PHOTOS (Separate squircle boxes with +N badge) */}
          {post.media.length >= 4 && (
            <div className="grid grid-cols-5 gap-2.5 w-full h-[320px] sm:h-[360px]">
              {/* Big Photo on left */}
              <div 
                className="col-span-3 h-full rounded-[28px] sm:rounded-[32px] overflow-hidden bg-neutral-100 dark:bg-neutral-900 ring-1 ring-black/5 dark:ring-white/10 group cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewingMedia({ type: 'post', url: post.media[0], user: { name: post.authorName, avatar: post.authorAvatar } });
                }}
              >
                <img 
                  src={post.media[0]} 
                  alt="Primary photo" 
                  loading="lazy" 
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-300"
                />
              </div>

              {/* Smaller Photos stacked on right */}
              <div className="col-span-2 flex flex-col gap-2.5 h-full">
                <div 
                  className="flex-1 rounded-[22px] sm:rounded-[26px] overflow-hidden bg-neutral-100 dark:bg-neutral-900 ring-1 ring-black/5 dark:ring-white/10 group cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingMedia({ type: 'post', url: post.media[1], user: { name: post.authorName, avatar: post.authorAvatar } });
                  }}
                >
                  <img 
                    src={post.media[1]} 
                    alt="Photo 2" 
                    loading="lazy" 
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-300"
                  />
                </div>

                <div 
                  className="relative flex-1 rounded-[22px] sm:rounded-[26px] overflow-hidden bg-neutral-100 dark:bg-neutral-900 ring-1 ring-black/5 dark:ring-white/10 group cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingMedia({ type: 'post', url: post.media[2], user: { name: post.authorName, avatar: post.authorAvatar } });
                  }}
                >
                  <img 
                    src={post.media[2]} 
                    alt="Photo 3" 
                    loading="lazy" 
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-300"
                  />
                  {post.media.length > 3 && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-white font-extrabold text-xl group-hover:bg-black/50 transition-colors">
                      +{post.media.length - 2}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Row matching Screen 3: ❤️ 43   🔁 1   💬 5            ↗ */}
      <div className="flex items-center justify-between pt-2.5 pb-1 px-3 select-none">
        <div className="flex items-center space-x-6 text-[13.5px] font-semibold text-neutral-700 dark:text-neutral-300">
          {/* Like */}
          <button 
            onClick={handleLike} 
            className="flex items-center space-x-1.5 transition-transform cursor-pointer group"
            title="Like"
            aria-label="Like post"
          >
            <motion.div
              key={liked ? 'liked' : 'unliked'}
              initial={{ scale: 0.75 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 450, damping: 18 }}
            >
              <Heart 
                className={`w-5 h-5 transition-colors ${liked ? 'fill-rose-500 text-rose-500' : 'text-neutral-700 dark:text-neutral-300 stroke-[2] group-hover:text-rose-500'}`} 
              />
            </motion.div>
            <span className={`text-[13px] font-semibold ${liked ? 'text-rose-500' : 'text-neutral-800 dark:text-neutral-200'}`}>
              {likesCount}
            </span>
          </button>

          {/* Repost */}
          <button 
            onClick={handleRepost} 
            className={`flex items-center space-x-1.5  transition-transform cursor-pointer group ${
              reposted ? 'text-blue-500 dark:text-blue-400' : 'text-neutral-700 dark:text-neutral-300'
            }`}
            title={reposted ? "Undo Repost" : "Repost"}
            aria-label="Repost"
          >
            <motion.div
              key={reposted ? 'reposted' : 'unreposted'}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 450, damping: 18 }}
            >
              <Repeat2 
                className={`w-5 h-5 transition-colors ${
                  reposted 
                    ? 'text-blue-500 dark:text-blue-400 stroke-[2.4]' 
                    : 'text-neutral-700 dark:text-neutral-300 stroke-[2.2] group-hover:text-blue-500'
                }`} 
              />
            </motion.div>
            <span className={`text-[13px] font-semibold transition-colors ${
              reposted 
                ? 'text-blue-500 dark:text-blue-400 font-bold' 
                : 'text-neutral-800 dark:text-neutral-200'
            }`}>
              {repostsCount}
            </span>
          </button>

          {/* Comment */}
          <button 
            onClick={() => setShowCommentsModal(true)} 
            className="flex items-center space-x-1.5 transition-transform cursor-pointer group hover:text-blue-500"
            title="Comments"
            aria-label="Comments"
          >
            <MessageCircle className="w-5 h-5 text-neutral-700 dark:text-neutral-300 stroke-[2] group-hover:text-blue-500 transition-colors" />
            <span className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-200">
              {post.commentsCount || 0}
            </span>
          </button>
        </div>

        {/* Share Arrow */}
        <button 
          onClick={() => setShowShareModal(true)} 
          className="p-1 transition-transform cursor-pointer text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white"
          title="Share"
          aria-label="Share post"
        >
          <Share2 className="w-5 h-5 stroke-[2]" />
        </button>
      </div>

      {/* Comments Drawer / Modal */}
      {showCommentsModal && (
        <CommentsPortal
          postId={post.id}
          onClose={() => setShowCommentsModal(false)}
          authorId={post.authorId}
          authorName={post.authorName}
          authorAvatar={post.authorAvatar}
          media={post.media?.[0]}
        />
      )}

      {/* Share Modal */}
      {showShareModal && (
        <SharePortal reel={post} onClose={() => setShowShareModal(false)} />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-xs p-6 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3.5">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1.5">Delete Post?</h3>
            <p className="text-[13px] text-gray-500 mb-5 leading-normal">
              This post will be permanently removed from your profile and feed.
            </p>
            <div className="flex flex-col space-y-2">
              <button 
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-xl transition-all disabled:opacity-50 text-[14px]"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-xl transition-all text-[14px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media Info Modal for Post Author */}
      <MediaInfoModal
        isOpen={showMediaInfoModal}
        onClose={() => setShowMediaInfoModal(false)}
        post={post}
      />
    </article>
  );
});

