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
  HardDrive
} from 'lucide-react';
import { MediaInfoModal } from './MediaInfoModal';
import { useAppStore } from '../store';
import { toggleLike, addComment, getComments, deletePost, deleteComment, toggleCommentLike, toggleFavorite, incrementViewCount } from '../services/postService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Post, Comment } from '../types';
import { sendNotification } from '../services/notificationService';
import { findUserByUsername } from '../services/userService';
import { sendMessage, subscribeConversations } from '../services/chatService';
import { formatTime, formatCount } from '../utils';
import { SharePortal, CommentsPortal } from './ReelItem';
import { VerifiedBadge } from './VerifiedBadge';

interface PostItemProps {
  post: Post;
  theme?: 'white' | 'purple';
}

const MentionText = ({ text, onClosePortal, isWhiteText = false }: { text: string; onClosePortal?: () => void; isWhiteText?: boolean }) => {
  const { setViewingUser, pushPage } = useAppStore();
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
    highlightedPostId
  } = useAppStore();

  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
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
      if (currentUser.uid !== post.authorId) {
        await sendNotification(post.authorId, 'comment', currentUser, post.id, post.id, post.media?.[0], null, post.authorName, post.authorAvatar);
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
    if (highlightedPostId === post.id && highlightedCommentId && currentUser) {
      setShowCommentsModal(true);
    }
  }, [highlightedCommentId, highlightedPostId, post.id, currentUser]);

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
       return () => { unsubLike(); unsubFav(); };
    }
  }, [currentUser, post.id, isNearScreen]);

  const handleToggleFavorite = async () => {
    if (!currentUser) return;
    const newSaved = !isSaved;
    setIsSaved(newSaved);
    try {
      await toggleFavorite(post.id, currentUser.uid);
      if (newSaved) {
        await sendNotification(post.authorId, 'favorite', currentUser, post.id, post.id, post.media?.[0], null, post.authorName, post.authorAvatar);
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
        await sendNotification(post.authorId, 'like', currentUser, post.id, post.id, post.media?.[0], null, post.authorName, post.authorAvatar);
      }
    } catch (error) {
      setLiked(!newLiked);
      setLikesCount(prev => !newLiked ? prev + 1 : prev - 1);
    }
  }, [liked, post.id, post.authorId, currentUser, post.media]);

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

  return (
    <article 
      ref={containerRef}
      className={`relative overflow-hidden transition-all duration-200 ${
        theme === 'purple' 
          ? 'bg-white/90 backdrop-blur-md border border-purple-100 rounded-3xl mx-2 my-2.5 shadow-sm' 
          : 'bg-white border-b border-gray-100 md:border md:border-gray-200/80 md:rounded-3xl md:shadow-xs'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5">
        <div 
          className="flex items-center space-x-3 cursor-pointer group select-none"
          onClick={() => {
            setViewingUser({ uid: post.authorId, name: authorName, avatar: authorAvatar });
            pushPage('profile');
          }}
        >
          <div className="relative flex-shrink-0">
            <div className="p-0.5 rounded-full bg-gradient-to-tr from-gray-200 to-gray-300 group-hover:from-blue-500 group-hover:to-indigo-500 transition-all duration-300">
              <img 
                src={authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName || 'User')}&background=random`} 
                alt={authorName} 
                loading="lazy" 
                decoding="async"
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover border-2 border-white" 
              />
            </div>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center space-x-1 flex-wrap">
              <h4 className="font-semibold text-[14.5px] text-gray-900 group-hover:text-blue-600 transition-colors leading-tight truncate">
                {authorName}
              </h4>
              {(post as any).authorIsVerified && <VerifiedBadge className="w-3.5 h-3.5" />}
              {(post as any).taggedUsers && (post as any).taggedUsers.length > 0 && (
                <span className="text-[12px] text-gray-500 font-normal">
                  with <span className="text-blue-600 font-bold">@{(post as any).taggedUsers[0].username}</span>
                  {(post as any).taggedUsers.length > 1 && ` & ${(post as any).taggedUsers.length - 1} others`}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-1 text-gray-400 text-[11.5px] font-normal leading-tight mt-0.5 flex-wrap">
              <span>{formatTime(post.createdAt)}</span>
              <span>•</span>
              <Globe className="w-3 h-3 text-gray-400" />
              {(post as any).location && (
                <>
                  <span>•</span>
                  <span className="text-emerald-600 font-semibold flex items-center">
                    <MapPin className="w-3 h-3 inline mr-0.5 text-emerald-500" />
                    {(post as any).location}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Actions Header */}
        <div className="flex items-center space-x-1.5">
          {currentUser?.uid === post.authorId && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setTargetAnalyticsPostId(post.id);
                setShowAnalytics(true);
              }}
              className="flex items-center space-x-1 text-[11px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-full border border-blue-100 transition-all active:scale-95"
            >
              <BarChart2 className="w-3 h-3" />
              <span>Insights</span>
            </button>
          )}

          <div className="relative">
            <button 
              onClick={() => setShowOptions(!showOptions)}
              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors active:scale-90"
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
                  className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-50 overflow-hidden"
                >
                  <button 
                    onClick={() => { handleToggleFavorite(); setShowOptions(false); }}
                    className="w-full px-3.5 py-2.5 text-left flex items-center space-x-2.5 hover:bg-gray-50 transition-colors text-gray-700 text-[13px] font-medium"
                  >
                    <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-yellow-500 text-yellow-500' : 'text-gray-500'}`} />
                    <span>{isSaved ? 'Unsave Post' : 'Save Post'}</span>
                  </button>

                  <button 
                    onClick={handleCopyLink}
                    className="w-full px-3.5 py-2.5 text-left flex items-center space-x-2.5 hover:bg-gray-50 transition-colors text-gray-700 text-[13px] font-medium"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
                    <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
                  </button>

                  {currentUser?.uid === post.authorId && (
                    <>
                      <button 
                        onClick={() => { setShowMediaInfoModal(true); setShowOptions(false); }}
                        className="w-full px-3.5 py-2.5 text-left flex items-center space-x-2.5 hover:bg-purple-50 transition-colors text-purple-600 text-[13px] font-semibold border-t border-gray-50"
                      >
                        <HardDrive className="w-4 h-4 text-purple-500" />
                        <span>Media Info (Me Only)</span>
                      </button>

                      <button 
                        onClick={() => { setShowDeleteConfirm(true); setShowOptions(false); }}
                        className="w-full px-3.5 py-2.5 text-left flex items-center space-x-2.5 hover:bg-red-50 transition-colors text-red-600 text-[13px] font-medium border-t border-gray-50"
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
      
      {/* Background Song Banner */}
      {((post as any).songTitle || (post as any).songUrl) && (
        <div className="px-4 py-2 bg-purple-50/80 border-y border-purple-100 flex items-center justify-between text-xs mb-2">
          <div className="flex items-center space-x-2 text-purple-900 font-bold min-w-0">
            <Music className="w-4 h-4 text-purple-600 shrink-0 animate-pulse" />
            <span className="truncate">{(post as any).songTitle || 'Background Song'} • {(post as any).songArtist || 'Music Track'}</span>
          </div>
          {(post as any).songUrl && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePostAudio((post as any).songUrl);
              }}
              className="p-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-full transition-all active:scale-90 shadow-sm shrink-0"
            >
              {isPlayingPostAudio ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-white ml-0.5" />}
            </button>
          )}
        </div>
      )}

      {/* Post Text */}
      {post.text && (
        <div className="px-4 pb-2.5 pt-0.5">
          {isBigText && (isShortText || (post as any).bg) ? (
            <div className={`min-h-[180px] sm:min-h-[220px] flex items-center justify-center p-6 text-white rounded-2xl shadow-sm text-center ${ (post as any).bg || 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600' }`}>
              <div className="text-[20px] sm:text-[24px] font-bold leading-relaxed drop-shadow-sm">
                <MentionText text={post.text} isWhiteText={true} />
              </div>
            </div>
          ) : (
            <div className="text-[14px] text-gray-800 leading-relaxed break-words font-normal">
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
          )}
        </div>
      )}

      {/* Post Media Section */}
      {post.media && post.media.length > 0 && (
        <div 
          className="relative w-full bg-transparent overflow-hidden select-none cursor-pointer"
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

          {post.media.length === 1 ? (
            <div className="relative w-full flex items-center justify-center bg-transparent overflow-hidden">
              {post.media[0].match(/\.(mp4|webm|mov|ogg)($|#|\?)/i) || post.media[0].includes('video') ? (
                <div className="relative w-full h-full flex items-center justify-center bg-black group/video">
                  <video 
                    ref={videoRef}
                    src={post.media[0].includes('#t=') ? post.media[0] : `${post.media[0]}#t=0.8`} 
                    autoPlay
                    muted={isMuted}
                    loop
                    playsInline
                    // @ts-ignore
                    webkit-playsinline="true"
                    // @ts-ignore
                    x5-playsinline="true"
                    poster={post.thumbnailUrl || (post as any).thumbnail || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"}
                    className="w-full max-h-[600px] object-contain block mx-auto"
                    referrerPolicy="no-referrer"
                    preload="metadata"
                  />

                  {/* Video Controls Overlay */}
                  <div className="absolute bottom-3 right-3 flex items-center space-x-2 z-20">
                    <button 
                      onClick={toggleMute}
                      className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-md transition-transform active:scale-90"
                      aria-label="Mute toggle"
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={toggleVideoPlayback}
                      className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-md transition-transform active:scale-90"
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
                  className="w-full h-auto max-h-[620px] object-cover block transition-transform duration-300" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingMedia({ type: 'post', url: post.media[0], user: { name: post.authorName, avatar: post.authorAvatar } });
                  }}
                />
              )}
            </div>
          ) : (
            <div 
              onTouchStart={handlePostTouchStart}
              onTouchMove={handlePostTouchMove}
              onTouchEnd={handlePostTouchEnd}
              className="relative w-full bg-black min-h-[300px] max-h-[580px] flex items-center justify-center select-none"
            >
              <img 
                src={post.media[activeMediaIdx]} 
                alt={`Post media ${activeMediaIdx + 1}`} 
                loading="lazy" 
                decoding="async"
                referrerPolicy="no-referrer"
                className="w-full h-auto max-h-[580px] object-contain transition-all duration-300" 
                onClick={(e) => {
                  e.stopPropagation();
                  setViewingMedia({ type: 'post', url: post.media[activeMediaIdx], user: { name: post.authorName, avatar: post.authorAvatar } });
                }}
              />

              {/* Counter Badge */}
              <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full border border-white/20 z-10">
                {activeMediaIdx + 1} / {post.media.length}
              </div>

              {/* Prev / Next Swipe Arrows */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMediaIdx((prev) => (prev > 0 ? prev - 1 : post.media.length - 1));
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-black/90 text-white rounded-full backdrop-blur-md transition-all active:scale-90 z-10"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMediaIdx((prev) => (prev < post.media.length - 1 ? prev + 1 : 0));
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-black/90 text-white rounded-full backdrop-blur-md transition-all active:scale-90 z-10"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              {/* Indicator dots */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-1.5 z-10 pointer-events-auto">
                {post.media.map((_, dotIdx) => (
                  <button
                    key={dotIdx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMediaIdx(dotIdx);
                    }}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      activeMediaIdx === dotIdx ? 'bg-white w-5 shadow-sm' : 'bg-white/40 hover:bg-white/70 w-2'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Engagement & Action Bar */}
      <div className="px-4 pt-2.5 pb-2.5">
        {/* Metric counts summary */}
        <div className="flex items-center justify-between text-[12.5px] text-gray-500 font-normal pb-2 mb-1.5 border-b border-gray-100/80">
          <div 
            className="flex items-center space-x-1.5 cursor-pointer hover:text-gray-800 transition-colors"
            onClick={() => {
              if (currentUser?.uid === post.authorId) {
                setTargetLikesPostId(post.id);
                setShowLikesList(true);
              }
            }}
          >
            <div className="flex -space-x-1">
              <div className="w-4.5 h-4.5 rounded-full bg-gradient-to-tr from-red-500 to-rose-400 flex items-center justify-center text-white shadow-2xs">
                <Heart className="w-2.5 h-2.5 fill-white" />
              </div>
            </div>
            <span className="font-medium text-gray-700">{formatCount(likesCount)} {likesCount === 1 ? 'like' : 'likes'}</span>
          </div>

          <div className="flex items-center space-x-3.5">
            {post.viewsCount !== undefined && post.viewsCount > 0 && (
              <span 
                className={`hover:text-gray-800 transition-colors ${currentUser?.uid === post.authorId ? 'cursor-pointer hover:underline' : 'cursor-default'}`}
                onClick={() => { 
                  if (currentUser?.uid === post.authorId) {
                    setTargetViewsPostId(post.id); 
                    setShowViewsList(true); 
                  }
                }}
              >
                {formatCount(post.viewsCount)} views
              </span>
            )}
            <button 
              onClick={() => setShowCommentsModal(true)} 
              className="hover:text-gray-800 transition-colors cursor-pointer"
            >
              {formatCount(post.commentsCount || 0)} comments
            </button>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center justify-between pt-0.5 gap-1.5">
          {/* Like Button */}
          <button 
            onClick={handleLike} 
            className={`flex-1 flex items-center justify-center py-2 px-2 rounded-xl transition-all active:scale-95 select-none ${
              liked 
                ? 'bg-rose-50 text-rose-600 font-semibold' 
                : 'hover:bg-gray-50 text-gray-600 font-medium'
            }`}
          >
            <motion.div
              key={liked ? 'liked' : 'unliked'}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              className="flex items-center space-x-1.5"
            >
              <Heart 
                className={`w-[19px] h-[19px] ${liked ? 'fill-rose-500 text-rose-500' : 'text-gray-600'}`} 
                strokeWidth={liked ? 2.2 : 1.8} 
              />
              <span className="text-[13.5px]">Like</span>
            </motion.div>
          </button>

          {/* Comment Button */}
          <button 
            onClick={() => setShowCommentsModal(true)} 
            className="flex-1 flex items-center justify-center py-2 px-2 rounded-xl hover:bg-gray-50 text-gray-600 font-medium transition-all active:scale-95 select-none"
          >
            <div className="flex items-center space-x-1.5">
              <MessageCircle className="w-[19px] h-[19px] text-gray-600" strokeWidth={1.8} />
              <span className="text-[13.5px]">Comment</span>
            </div>
          </button>

          {/* Share Button */}
          <button 
            onClick={() => setShowShareModal(true)} 
            className="flex-1 flex items-center justify-center py-2 px-2 rounded-xl hover:bg-gray-50 text-gray-600 font-medium transition-all active:scale-95 select-none"
          >
            <div className="flex items-center space-x-1.5">
              <Share2 className="w-[19px] h-[19px] text-gray-600" strokeWidth={1.8} />
              <span className="text-[13.5px]">Share</span>
            </div>
          </button>

          {/* Quick Bookmark Button */}
          <button 
            onClick={handleToggleFavorite} 
            className="p-2 hover:bg-gray-50 rounded-xl text-gray-500 hover:text-gray-900 transition-all active:scale-90 shrink-0"
            aria-label="Bookmark post"
          >
            <Bookmark className={`w-[19px] h-[19px] ${isSaved ? 'fill-yellow-500 text-yellow-500' : 'text-gray-500'}`} strokeWidth={1.8} />
          </button>
        </div>

        {/* Inline Quick Comment Input Pill */}
        <div className="pt-2.5 mt-2 border-t border-gray-100 flex items-center space-x-2.5">
          <img 
            src={currentUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || 'User')}&background=random`} 
            alt="My Avatar" 
            className="w-7.5 h-7.5 rounded-full object-cover shrink-0 border border-gray-200/60 shadow-2xs"
            referrerPolicy="no-referrer"
          />
          <form onSubmit={handleSendInlineComment} className="flex-1 flex items-center bg-gray-50 hover:bg-gray-100/80 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 border border-gray-200/60 rounded-full px-3.5 py-1.5 transition-all">
            <input 
              type="text" 
              placeholder="Write a comment..." 
              value={inlineCommentText} 
              onChange={(e) => setInlineCommentText(e.target.value)} 
              className="bg-transparent text-[13px] text-gray-800 placeholder-gray-400 focus:outline-none w-full" 
            />
            <button 
              type="submit" 
              disabled={!inlineCommentText.trim() || isSubmittingInline} 
              className="ml-1 text-blue-600 disabled:opacity-30 p-1 hover:scale-110 active:scale-95 transition-all shrink-0"
            >
              <Send className="w-3.5 h-3.5 fill-blue-600 text-blue-600" />
            </button>
          </form>
        </div>
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
                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-xl transition-all active:scale-95 disabled:opacity-50 text-[14px]"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-xl transition-all active:scale-95 text-[14px]"
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

