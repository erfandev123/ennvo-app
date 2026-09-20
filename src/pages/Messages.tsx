import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import {
  Search,
  Video,
  Phone,
  PhoneOff,
  MoreVertical,
  Image as ImageIcon,
  Mic,
  Smile,
  Plus,
  ArrowLeft,
  Check,
  CheckCheck,
  Info,
  ChevronDown,
  Send,
  X,
  Heart,
  Type,
  Music,
  MoreHorizontal,
  UserPlus,
  Bell,
  MessageCircle,
  Play,
  Pause,
  Reply,
  Trash2,
  Share2,
  Copy,
  UserSquare,
  Palette,
  ChevronRight,
  ChevronLeft,
  Layers,
  EyeOff,
  Shield,
  Camera,
  Settings2,
  UserX,
  Users,
  Sparkles,
  Download,
  Film,
  Bookmark,
  Star,
  Sticker as StickerIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PullToRefresh } from "../components/PullToRefresh";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";
import { subscribeNotifications } from "../services/notificationService";

import { useAppStore } from "../store";
import { safeFile, formatTime, downloadMediaFile } from "../utils";
import {
  subscribeConversations,
  subscribeMessages,
  sendMessage,
  createConversation,
  updateConversationTheme,
} from "../services/chatService";
import { ChatThemeStudioModal } from "../components/ChatThemeStudioModal";
import { StickerPickerModal } from "../components/StickerPickerModal";
import {
  getSmartStickerSuggestions,
  CuratedSticker,
  fetchCommunityStickers,
  toggleSaveSticker,
  isStickerSaved,
} from "../services/stickerService";
import {
  subscribePresence,
  setTyping,
  subscribeTyping,
} from "../services/presenceService";
import { followUser } from "../services/followService";
import { initiateCall } from "../services/callService";
import { playMessageSentSound } from "../services/soundService";
import { subscribeStories, Story } from "../services/storyService";
import { Conversation, Message as AppMessage, Notification } from "../types";
import { FacebookMessageListSkeleton } from "../components/Skeletons";

const GroupAvatar = ({
  members,
  sizeClass = "w-14 h-14",
}: {
  members: string[];
  sizeClass?: string;
}) => {
  if (members.length === 0)
    return <div className={`${sizeClass} rounded-full bg-gray-200`}></div>;
  if (members.length === 1)
    return (
      <img
        src={members[0]}
        className={`${sizeClass} rounded-full object-cover`}
      />
    );
  if (members.length === 2)
    return (
      <div
        className={`${sizeClass} rounded-full overflow-hidden bg-gray-100 border border-gray-200 relative`}
      >
        <img
          src={members[0]}
          className="absolute w-1/2 h-full left-0 object-cover"
        />
        <img
          src={members[1]}
          className="absolute w-1/2 h-full right-0 object-cover"
        />
      </div>
    );
  return (
    <div
      className={`${sizeClass} rounded-full overflow-hidden bg-gray-100 border border-gray-200 relative`}
    >
      <img
        src={members[0]}
        className="absolute w-1/2 h-full left-0 object-cover"
      />
      <img
        src={members[1]}
        className="absolute w-1/2 h-1/2 right-0 top-0 object-cover"
      />
      <img
        src={members[2]}
        className="absolute w-1/2 h-1/2 right-0 bottom-0 object-cover"
      />
    </div>
  );
};

const FollowerItem = React.memo(
  ({
    follower,
    currentUser,
    onFollowBack,
  }: {
    follower: any;
    currentUser: any;
    onFollowBack: (f: any) => void;
  }) => {
    const [isFollowing, setIsFollowing] = useState(false);
    const [isOptimisticFollowing, setIsOptimisticFollowing] = useState(false);
    const [realtimeUser, setRealtimeUser] = useState<any>(follower);
    // They are in our followers list, so they follow us by definition
    const followsMe = true;
    const { setViewingUser, pushPage } = useAppStore();

    useEffect(() => {
      // Fetch latest user data for real-time avatar and name
      let unsubUser: (() => void) | undefined;
      import("firebase/firestore").then(({ doc, onSnapshot }) => {
        unsubUser = onSnapshot(doc(db, "users", follower.id), (docSnap) => {
          if (docSnap.exists()) {
            setRealtimeUser((prev: any) => ({ ...prev, ...docSnap.data() }));
          }
        }, () => {});
      });

      if (currentUser && follower.id) {
        import("firebase/firestore").then(({ doc, onSnapshot }) => {
          const followRef = doc(
            db,
            "users",
            currentUser.uid,
            "following",
            follower.id,
          );
          onSnapshot(followRef, (d) => setIsFollowing(d.exists()), () => {});
        });
      }

      return () => {
        if (unsubUser) unsubUser();
      };
    }, [currentUser, follower.id]);

    const isActuallyFollowing = isFollowing || isOptimisticFollowing;
    const isFriend = isActuallyFollowing && followsMe;

    return (
      <div
        className="flex items-center justify-between p-3 hover:bg-purple-50/50 rounded-2xl cursor-pointer transition-all active:scale-[0.98]"
        onClick={() => {
          setViewingUser({
            uid: realtimeUser.id || follower.id,
            name: realtimeUser.name || follower.name || "User",
            avatar: realtimeUser.avatar || follower.avatar,
          });
          pushPage("profile");
        }}
      >
        <div className="flex items-center space-x-3">
          <img
            src={
              realtimeUser.avatar ||
              follower.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(realtimeUser.name || follower.name || "User")}&background=random`
            }
            className="w-14 h-14 rounded-full object-cover shadow-sm border border-gray-100"
            alt="follower"
            referrerPolicy="no-referrer"
          />
          <div>
            <p className="font-normal text-[15px] text-gray-900">
              {realtimeUser.name || follower.name || "New Follower"}
            </p>
            <p className="text-[12px] text-gray-500 font-normal">Started following you</p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsOptimisticFollowing(true);
            onFollowBack(follower);
          }}
          className={`px-5 py-2 rounded-full text-[13px] font-medium transition-all active:scale-95 ${
            isFriend
              ? "bg-purple-100 text-purple-700"
              : isActuallyFollowing
                ? "bg-purple-50 text-purple-600 border border-purple-100"
                : "bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
          }`}
        >
          {isFriend ? "Friends" : isActuallyFollowing ? "Following" : "Follow back"}
        </button>
      </div>
    );
  },
);

const StackedMediaAlbumBubble = React.memo(({
  albumList,
  msg,
  isMe,
  msgSenderName,
  msgSenderAvatar,
  setViewingMedia,
  downloadMediaFile,
}: {
  albumList: { type: 'image' | 'video'; url: string }[];
  msg: any;
  isMe: boolean;
  msgSenderName: string;
  msgSenderAvatar: string;
  setViewingMedia: any;
  downloadMediaFile: any;
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartXRef = useRef<number | null>(null);

  const openViewer = (idx: number) => {
    setViewingMedia({
      type: albumList[idx]?.type || 'image',
      url: albumList[idx]?.url || '',
      user: { name: msgSenderName, avatar: msgSenderAvatar },
      mediaList: albumList,
      initialIndex: idx,
    });
  };

  const handlePrev = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : albumList.length - 1));
  };

  const handleNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActiveIndex((prev) => (prev < albumList.length - 1 ? prev + 1 : 0));
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    if (deltaX > 35) {
      handlePrev();
    } else if (deltaX < -35) {
      handleNext();
    }
    touchStartXRef.current = null;
  };

  const currentItem = albumList[activeIndex] || albumList[0];
  const nextItem1 = albumList.length > 1 ? albumList[(activeIndex + 1) % albumList.length] : null;
  const nextItem2 = albumList.length > 2 ? albumList[(activeIndex + 2) % albumList.length] : null;

  return (
    <div className="flex flex-col space-y-1.5 max-w-[270px] sm:max-w-[300px] select-none">
      {/* Stacked Cards Area */}
      <div 
        className="relative w-full aspect-[4/3] sm:aspect-square max-h-[300px] flex items-center justify-center p-2"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Layer 3: If 3 or more photos, peeks out further on the right */}
        {albumList.length >= 3 && nextItem2 && (
          <div 
            onClick={() => setActiveIndex((activeIndex + 2) % albumList.length)}
            className="absolute inset-x-2 inset-y-1 rounded-2xl overflow-hidden shadow-xs border border-black/10 bg-gray-200 cursor-pointer transition-all duration-300 transform-gpu translate-x-5 translate-y-2 rotate-[6deg] scale-[0.91] opacity-75 hover:opacity-95"
            title="Click to view photo"
          >
            {nextItem2.type === 'video' ? (
              <video src={`${nextItem2.url}#t=0.001`} className="w-full h-full object-cover" preload="metadata" playsInline />
            ) : (
              <img src={nextItem2.url} alt="album peek 2" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
            )}
          </div>
        )}

        {/* Layer 2: If 2 or more photos, peeks out to the side */}
        {albumList.length >= 2 && nextItem1 && (
          <div 
            onClick={() => setActiveIndex((activeIndex + 1) % albumList.length)}
            className="absolute inset-x-2 inset-y-1 rounded-2xl overflow-hidden shadow-xs border border-black/10 bg-gray-100 cursor-pointer transition-all duration-300 transform-gpu translate-x-2.5 translate-y-1 rotate-[3deg] scale-[0.96] opacity-90 hover:opacity-100"
            title="Click to view photo"
          >
            {nextItem1.type === 'video' ? (
              <video src={`${nextItem1.url}#t=0.001`} className="w-full h-full object-cover" preload="metadata" playsInline />
            ) : (
              <img src={nextItem1.url} alt="album peek 1" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
            )}
          </div>
        )}

        {/* Main Active Front Card */}
        <div 
          onClick={() => openViewer(activeIndex)}
          className="relative w-full h-full rounded-2xl overflow-hidden shadow-md border border-black/10 bg-black group/album cursor-pointer z-10 transform-gpu transition-all duration-200"
        >
          {currentItem.type === 'video' ? (
            <div className="w-full h-full relative overflow-hidden bg-gray-950 flex items-center justify-center">
              <video src={`${currentItem.url}#t=0.001`} className="w-full h-full object-cover" preload="metadata" playsInline />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="w-10 h-10 rounded-full bg-black/60 text-white backdrop-blur-xs flex items-center justify-center shadow-md">
                  <Play className="w-4 h-4 fill-white ml-0.5" />
                </div>
              </div>
            </div>
          ) : (
            <img 
              src={currentItem.url} 
              alt={`album photo ${activeIndex + 1}`} 
              className="w-full h-full object-cover transition-transform duration-300 group-hover/album:scale-105" 
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          )}

          {/* Top-Right Badge: Total count & layers */}
          <div className="absolute top-2.5 right-2.5 z-20 flex items-center space-x-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/20 text-white shadow-md select-none">
            <Layers className="w-3 h-3 text-white/90" />
            <span className="text-[11px] font-bold tracking-tight">{activeIndex + 1}/{albumList.length}</span>
          </div>

          {/* Left Arrow (Prev) */}
          {albumList.length > 1 && (
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-black/50 hover:bg-black/75 active:scale-90 backdrop-blur-md text-white border border-white/20 flex items-center justify-center shadow-md transition-all opacity-80 hover:opacity-100 cursor-pointer"
              title="Previous photo"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Right Arrow (Next) */}
          {albumList.length > 1 && (
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-black/50 hover:bg-black/75 active:scale-90 backdrop-blur-md text-white border border-white/20 flex items-center justify-center shadow-md transition-all opacity-80 hover:opacity-100 cursor-pointer"
              title="Next photo"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Quick Download button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              downloadMediaFile(currentItem.url, `media_${Date.now()}.${currentItem.type === 'video' ? 'mp4' : 'jpg'}`);
            }}
            className="absolute bottom-2 right-2 z-20 p-1.5 bg-black/60 hover:bg-black/85 active:scale-90 text-white rounded-full transition-all shadow-md backdrop-blur-xs"
            title="Download this photo"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Bottom Dots Indicator */}
          {albumList.length > 1 && (
            <div className="absolute bottom-2.5 inset-x-0 z-20 flex items-center justify-center space-x-1 pointer-events-none">
              {albumList.slice(0, 5).map((_, dotIdx) => (
                <div
                  key={dotIdx}
                  className={`rounded-full transition-all duration-300 ${
                    dotIdx === activeIndex
                      ? 'w-3.5 h-1.5 bg-white shadow-xs'
                      : 'w-1.5 h-1.5 bg-white/50 backdrop-blur-xs'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Message Text/Caption if any */}
      {msg.content && !msg.content.startsWith("Sent ") && (
        <p className="text-[14px] leading-relaxed px-1 pt-0.5 break-words">
          {msg.content}
        </p>
      )}
    </div>
  );
});

const ReelMessageBubble = React.memo(({
  msg,
  setViewingReel,
  setViewingReelContext,
}: {
  msg: any;
  setViewingReel: any;
  setViewingReelContext: any;
}) => {
  const [reel, setReel] = React.useState<any>(null);
  React.useEffect(() => {
    if (!msg.postId) return;
    import("../services/postService")
      .then((s) => s.getPost(msg.postId))
      .then((fetchedReel) => {
        if (fetchedReel) setReel(fetchedReel);
      })
      .catch(() => {});
  }, [msg.postId]);

  const coverPic = reel?.thumbnailUrl || reel?.thumbnail || reel?.coverUrl || msg.thumbnailUrl || msg.coverUrl || reel?.media?.[0] || msg.mediaUrl;
  const isVideo = coverPic && (coverPic.includes('.mp4') || coverPic.includes('video') || coverPic.includes('firebasestorage'));

  return (
    <div className="flex flex-col max-w-[170px] will-change-transform">
      <div
        className="relative w-36 sm:w-40 aspect-[9/15] rounded-[18px] overflow-hidden cursor-pointer bg-neutral-950 group shadow-md border border-black/10 dark:border-white/15 transition-transform duration-200 active:scale-[0.98]"
        onClick={() => {
          if (reel) {
            setViewingReel({ ...reel, single: true });
            setViewingReelContext("chat");
          } else if (msg.mediaUrl || msg.postId) {
            setViewingReel({
              id: msg.postId || msg.id,
              authorId: msg.senderId,
              authorName: reel?.authorName || "Reel",
              authorAvatar: reel?.authorAvatar || "",
              media: [coverPic || msg.mediaUrl],
              text: "",
              type: "reel",
              single: true,
            });
            setViewingReelContext("chat");
          }
        }}
      >
        <div className="w-full h-full relative overflow-hidden bg-neutral-900">
          {isVideo ? (
            <video
              src={`${coverPic}#t=0.001`}
              className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-300"
              preload="metadata"
              muted
              playsInline
            />
          ) : (
            <img
              src={coverPic}
              className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-300"
              alt="Reel cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-9 h-9 rounded-full bg-black/45 backdrop-blur-md border border-white/25 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
              <Play className="w-4 h-4 text-white fill-white ml-0.5" />
            </div>
          </div>
        </div>
        
        {/* Author pic and name inside corner overlay */}
        {(reel || msg.senderId) && (
          <div className="absolute top-2 left-2 z-20 flex items-center space-x-1.5 bg-black/55 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/15 select-none max-w-[85%]">
            <img
              src={reel?.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(reel?.authorName || "User")}&background=random`}
              className="w-3.5 h-3.5 rounded-full object-cover border border-white/50 shrink-0"
              alt={reel?.authorName || "User"}
              referrerPolicy="no-referrer"
            />
            <span className="text-[10.5px] text-white font-medium truncate leading-none">
              {reel?.authorName || "Reel"}
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex items-center justify-between pointer-events-none z-10">
          <span className="text-[9.5px] text-white/90 font-semibold tracking-wide uppercase">Reel</span>
          <Video
            className="w-3.5 h-3.5 text-white/90 drop-shadow-md"
            strokeWidth={2}
          />
        </div>
      </div>
    </div>
  );
});

const VoiceMessageBubble = ({ msg, isMe, borderRadius }: { msg: any; isMe: boolean; borderRadius: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(msg.duration || msg.replyTo?.duration || 3);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  };

  const formatSecs = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={`px-4 py-2.5 flex items-center space-x-3 min-w-[210px] sm:min-w-[240px] rounded-[26px] ${isMe ? "bg-[#FE2C55] text-white shadow-2xs" : "bg-white text-gray-900 border border-gray-100/90 shadow-2xs"}`}>
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 ${isMe ? "bg-white text-[#FE2C55] shadow-2xs hover:bg-gray-50" : "bg-[#FE2C55] text-white shadow-2xs hover:bg-red-600"}`}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      <div className="flex-1 flex flex-col justify-center space-y-1 min-w-0">
        <div className="flex items-center space-x-0.5 h-4 w-full px-0.5">
          {[35, 65, 25, 80, 45, 95, 55, 35, 85, 50, 30, 70, 40, 90, 60, 25, 75, 45].map((height, i) => (
            <div
              key={i}
              className={`flex-1 rounded-full transition-all duration-150 ${isMe ? "bg-white" : "bg-rose-500"}`}
              style={{
                height: isPlaying ? `${Math.max(22, (height + (i % 3) * 20) % 100)}%` : `${height * 0.45}%`,
                opacity: (i / 18) <= (currentTime / (duration || 1)) ? 1 : 0.35,
              }}
            />
          ))}
        </div>

        <div className={`flex justify-between items-center text-[10.5px] font-medium tracking-tight ${isMe ? "text-white/90" : "text-gray-500"}`}>
          <span>{formatSecs(currentTime)}</span>
          <div className="flex items-center space-x-1">
            <Mic className={`w-3 h-3 ${isMe ? "text-white/80" : "text-rose-500"}`} />
            <span>{formatSecs(duration)}</span>
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={msg.mediaUrl || "https://actions.google.com/sounds/v1/ambiences/outdoor_park.ogg"}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
              setDuration(audioRef.current.duration);
            }
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration)) {
            setDuration(audioRef.current.duration);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />
    </div>
  );
};

const MessageBubble = React.memo(function MessageBubble({
  msg,
  isMe,
  isFirstInGroup,
  isLastInGroup,
  borderRadius,
  isNew,
  avatarUrl,
  senderName,
  senderInfo,
  isGroup,
  seenStr,
  onReply,
  onLongPress,
  onContextMenu,
  onToggleReaction,
  setViewingReel,
  setViewingReelContext,
  setViewingMedia,
  handleStartCall
}: {
  msg: any;
  isMe: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  borderRadius: string;
  isNew: boolean;
  avatarUrl?: string;
  senderName?: string;
  senderInfo?: { name: string; avatar: string };
  isGroup?: boolean;
  seenStr: string | null;
  onReply: (msg: any) => void;
  onLongPress: (e: React.UIEvent, msgId: string) => void;
  onContextMenu: (e: React.MouseEvent, msgId: string) => void;
  onToggleReaction: (msgId: string, currentReaction: string | null) => void;
  setViewingReel: (r: any) => void;
  setViewingReelContext: (c: any) => void;
  setViewingMedia: (m: any) => void;
  handleStartCall: (type: 'audio' | 'video') => void;
}) {
  const bubbleRef = React.useRef<HTMLDivElement>(null);
  const replyIconLeftRef = React.useRef<HTMLDivElement>(null);
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const longPressTimerRef = React.useRef<any>(null);
  const currentDragXRef = React.useRef<number>(0);
  const isVerticalScrollRef = React.useRef<boolean>(false);
  const isSwipeReplyActiveRef = React.useRef<boolean>(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    currentDragXRef.current = 0;
    isVerticalScrollRef.current = false;
    isSwipeReplyActiveRef.current = false;
    if (bubbleRef.current) {
      bubbleRef.current.style.transition = 'none';
    }
    longPressTimerRef.current = setTimeout(() => {
      onLongPress(e, msg.id);
    }, 420);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = e.touches[0].clientY - touchStartRef.current.y;

    if (Math.abs(dx) > 7 || Math.abs(dy) > 7) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }

    // If already detected as vertical scroll, do not handle horizontal drag
    if (isVerticalScrollRef.current) return;

    if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
      isVerticalScrollRef.current = true;
      return;
    }

    // STRICT: Never allow dragging to the left (prevents messages shifting left when scrolling)
    if (dx <= 0) return;

    // Detect intentional right swipe for reply
    if (!isSwipeReplyActiveRef.current && dx > 14 && dx > Math.abs(dy) * 1.8) {
      isSwipeReplyActiveRef.current = true;
    }

    if (isSwipeReplyActiveRef.current && dx > 0) {
      const damped = Math.min(dx * 0.44, 56);
      currentDragXRef.current = damped;

      if (bubbleRef.current) {
        bubbleRef.current.style.transform = `translate3d(${damped}px, 0, 0)`;
      }

      if (replyIconLeftRef.current) {
        const progress = Math.min(1, Math.max(0, (damped - 8) / 22));
        replyIconLeftRef.current.style.opacity = progress.toString();
        replyIconLeftRef.current.style.transform = `translate3d(0, -50%, 0) scale(${0.7 + 0.3 * progress})`;
      }
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    const finalDrag = currentDragXRef.current;
    if (bubbleRef.current) {
      bubbleRef.current.style.transition = 'transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)';
      bubbleRef.current.style.transform = 'translate3d(0, 0, 0)';
    }

    if (replyIconLeftRef.current) {
      replyIconLeftRef.current.style.transition = 'opacity 0.15s ease-out';
      replyIconLeftRef.current.style.opacity = '0';
    }

    if (finalDrag > 24) {
      if (typeof window !== 'undefined' && window.navigator?.vibrate) {
        try { window.navigator.vibrate(12); } catch (err) {}
      }
      onReply(msg);
    }

    currentDragXRef.current = 0;
    isVerticalScrollRef.current = false;
    isSwipeReplyActiveRef.current = false;
    touchStartRef.current = null;
  };

  const emojiRegex = /^[\p{Extended_Pictographic}\s]+$/u;
  const trimmedMsg = (msg.content || "").trim();
  const isEmojiOnly = emojiRegex.test(trimmedMsg) && Array.from(trimmedMsg).length <= 3 && trimmedMsg.length > 0;
  const emojiCount = isEmojiOnly ? Array.from(trimmedMsg).length : 0;

  const bubbleContent = (
    <div
      id={`msg-${msg.id}`}
      className={`flex ${isMe ? "justify-end" : "justify-start"} ${isFirstInGroup ? "mt-2" : isMe ? "mt-[0.5px]" : "mt-[1.5px]"} group relative touch-pan-y`}
      onContextMenu={(e) => onLongPress(e, msg.id)}
    >
      {!isMe && isLastInGroup && avatarUrl && (
        <img
          src={avatarUrl}
          className="w-7 h-7 rounded-full mr-2 self-end mb-1 object-cover"
          alt="Avatar"
          loading="lazy"
        />
      )}
      {!isMe && !isLastInGroup && <div className="w-9 shrink-0"></div>}

      {isMe && (
        <div className="hidden sm:group-hover:flex items-center opacity-0 group-hover:opacity-100 transition-opacity pr-2">
          <button
            type="button"
            onClick={() => onReply(msg)}
            className="p-1.5 hover:bg-black/5 rounded-full"
            title="Reply"
          >
            <Reply className="w-4 h-4 text-gray-400 cursor-pointer" />
          </button>
        </div>
      )}

      <div
        ref={bubbleRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className={`flex flex-col max-w-[78%] ${isMe ? "items-end" : "items-start"} relative group/bubble select-none`}
      >
        {/* Swipe Right to Reply Indicator */}
        <div 
          ref={replyIconLeftRef}
          className="absolute left-[-32px] top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-white/95 border border-purple-200/80 text-purple-600 rounded-full pointer-events-none z-10 opacity-0 shadow-xs"
        >
          <Reply className="w-3.5 h-3.5" strokeWidth={2.4} />
        </div>

        {isGroup && !isMe && isFirstInGroup && (
          <span className="text-[11px] text-gray-500 font-normal ml-1 mb-0.5 mt-1">
            {senderName || "User"}
          </span>
        )}

        <div
          onContextMenu={(e) => onContextMenu(e, msg.id)}
          onDoubleClick={() => onToggleReaction(msg.id, (msg as any).reaction)}
          className={`relative flex flex-col ${isMe ? "items-end" : "items-start"} max-w-full select-none`}
        >
          {/* Reply preview inside message bubble if it's a reply */}
          {msg.replyTo && (
            <div
              className={`mb-1 px-2.5 py-1.5 rounded-xl text-[11px] border-l-2 transition-all max-w-full overflow-hidden flex items-center space-x-2 cursor-pointer ${
                isMe
                  ? "bg-black/15 text-white/95 border-white/70"
                  : "bg-gray-200/80 text-gray-800 border-purple-500"
              }`}
              onClick={() => {
                const el = document.getElementById(`msg-${msg.replyTo.id}`);
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                  el.style.backgroundColor = "rgba(254, 44, 85, 0.15)";
                  setTimeout(() => { el.style.backgroundColor = ""; }, 2000);
                }
              }}
            >
              {/* Media Thumbnails inside Bubble Reply Box */}
              {msg.replyTo.mediaUrl && (msg.replyTo.type === "image" || (!msg.replyTo.type && !msg.replyTo.stickerUrl)) && (
                <img src={msg.replyTo.mediaUrl} className="w-5 h-5 rounded object-cover shrink-0 border border-black/10" alt="Reply thumbnail" referrerPolicy="no-referrer" />
              )}
              {(msg.replyTo.type === "sticker" || msg.replyTo.stickerUrl) && (
                <img src={msg.replyTo.stickerUrl || msg.replyTo.mediaUrl} className="w-5 h-5 object-contain shrink-0" alt="Sticker thumbnail" referrerPolicy="no-referrer" />
              )}
              {msg.replyTo.type === "reel" && (
                <div className="w-4 h-5 rounded overflow-hidden shrink-0 bg-black flex items-center justify-center">
                  <Play className="w-2.5 h-2.5 text-white fill-white" />
                </div>
              )}
              {msg.replyTo.type === "voice" && (
                <Mic className={`w-3.5 h-3.5 shrink-0 ${isMe ? "text-white" : "text-rose-500"}`} />
              )}

              <div className="flex-1 min-w-0">
                <p className="line-clamp-1 italic text-ellipsis break-words font-normal text-[11px] max-w-[200px]">
                  {msg.replyTo.content ||
                    (msg.replyTo.type === "sticker" || msg.replyTo.stickerUrl ? "Sticker" :
                     msg.replyTo.type === "image" ? "Photo" :
                     msg.replyTo.type === "voice" ? "Voice message" :
                     msg.replyTo.type === "reel" ? "Reel" : "Media")}
                </p>
              </div>
            </div>
          )}

          <div className="max-w-full relative">
            {(() => {
              if (msg.type === "reel") {
                return (
                  <ReelMessageBubble
                    msg={msg}
                    setViewingReel={setViewingReel}
                    setViewingReelContext={setViewingReelContext}
                  />
                );
              } else if (msg.type === "voice") {
                return (
                  <VoiceMessageBubble
                    msg={msg}
                    isMe={isMe}
                    borderRadius={borderRadius}
                  />
                );
              } else if (msg.type === "audio") {
                return (
                  <div
                    className={`px-4 py-3 ${borderRadius} ${isMe ? "bg-[#FE2C55] text-white shadow-xs" : "bg-[#F2F4F7] text-gray-900 border border-gray-100/80 shadow-2xs"}`}
                  >
                    <audio
                      controls
                      src={msg.mediaUrl}
                      className={`h-8 ${isMe ? "invert filter grayscale" : ""}`}
                      style={{ maxWidth: "200px" }}
                    />
                  </div>
                );
              } else if (msg.type === "video") {
                const mediaUser = senderInfo || { name: senderName || "User", avatar: avatarUrl || "" };
                return (
                  <div
                    className="relative group cursor-pointer rounded-2xl overflow-hidden max-w-[240px] bg-black shadow-sm"
                    onClick={() =>
                      setViewingMedia({
                        type: "video",
                        url: msg.mediaUrl!,
                        user: mediaUser,
                        mediaList: [{ type: "video", url: msg.mediaUrl! }],
                        initialIndex: 0,
                      })
                    }
                  >
                    <video
                      src={`${msg.mediaUrl}#t=0.001`}
                      className="w-full h-auto max-h-[280px] object-cover"
                      preload="metadata"
                      playsInline
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/40 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-md">
                        <Play className="w-5 h-5 text-gray-900 ml-0.5 fill-gray-900" />
                      </div>
                    </div>
                    {/* Quick Download button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadMediaFile(msg.mediaUrl!, `video_${msg.id || Date.now()}.mp4`);
                      }}
                      className="absolute bottom-2 right-2 p-1.5 bg-black/60 hover:bg-black/85 active:scale-90 text-white rounded-full transition-all shadow-md backdrop-blur-sm"
                      title="Download Video"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              } else if (msg.type === "album" || (msg.mediaUrls && msg.mediaUrls.length > 1) || (msg.mediaItems && msg.mediaItems.length > 1)) {
                const albumList: { type: 'image' | 'video'; url: string }[] = (msg.mediaItems && msg.mediaItems.length > 0)
                  ? msg.mediaItems
                  : (msg.mediaUrls && msg.mediaUrls.length > 0)
                  ? msg.mediaUrls.map((u: string) => ({
                      type: u.includes('.mp4') || u.includes('video') ? 'video' : 'image',
                      url: u
                    }))
                  : [{ type: 'image', url: msg.mediaUrl || '' }];

                const mediaUser = senderInfo || { name: senderName || "User", avatar: avatarUrl || "" };

                return (
                  <StackedMediaAlbumBubble
                    albumList={albumList}
                    msg={msg}
                    isMe={isMe}
                    msgSenderName={mediaUser.name}
                    msgSenderAvatar={mediaUser.avatar}
                    setViewingMedia={setViewingMedia}
                    downloadMediaFile={downloadMediaFile}
                  />
                );
              } else if (msg.type === "image") {
                const mediaUser = senderInfo || { name: senderName || "User", avatar: avatarUrl || "" };
                return (
                  <div
                    className="relative group cursor-pointer rounded-2xl overflow-hidden max-w-[240px] shadow-sm"
                    onClick={() =>
                      setViewingMedia({
                        type: "image",
                        url: msg.mediaUrl!,
                        user: mediaUser,
                        mediaList: [{ type: "image", url: msg.mediaUrl! }],
                        initialIndex: 0,
                      })
                    }
                  >
                    <img
                      src={msg.mediaUrl}
                      alt="Sent image"
                      className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <div className="bg-black/60 text-white text-[11px] font-normal px-3 py-1.5 rounded-full backdrop-blur-sm">
                        View Full Screen
                      </div>
                    </div>
                    {/* Quick Download button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadMediaFile(msg.mediaUrl!, `photo_${msg.id || Date.now()}.jpg`);
                      }}
                      className="absolute bottom-2 right-2 p-1.5 bg-black/60 hover:bg-black/85 active:scale-90 text-white rounded-full transition-all shadow-md backdrop-blur-sm"
                      title="Download Photo"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              } else if (msg.type === "sticker" || msg.stickerUrl) {
                const isVideoSticker = msg.stickerType === "video" || (msg.mediaUrl && (msg.mediaUrl.includes(".mp4") || msg.mediaUrl.includes(".webm") || msg.mediaUrl.includes(".mov")));
                const stickerSrc = msg.stickerUrl || msg.mediaUrl;
                return (
                  <div
                    className="relative group/stk cursor-pointer p-0.5 transition-all duration-200 active:scale-95 max-w-[170px] sm:max-w-[210px] select-none hover:scale-[1.03]"
                    onClick={(e) => onLongPress(e, msg.id)}
                    title="Click or Long-press for Sticker actions"
                  >
                    {isVideoSticker ? (
                      <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-[28px] overflow-hidden bg-transparent flex items-center justify-center drop-shadow-md">
                        <video
                          src={stickerSrc}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full h-full object-cover rounded-[28px] pointer-events-none"
                        />
                      </div>
                    ) : (
                      <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-[28px] overflow-hidden bg-transparent flex items-center justify-center drop-shadow-md">
                        <img
                          src={stickerSrc}
                          alt="Sticker"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain pointer-events-none select-none rounded-[28px] mix-blend-multiply dark:mix-blend-normal"
                        />
                      </div>
                    )}
                  </div>
                );
              } else if (isEmojiOnly) {
                return (
                  <div className={`leading-none drop-shadow-sm px-1 py-0.5 select-none ${emojiCount === 1 ? "text-5xl sm:text-6xl" : "text-4xl sm:text-5xl"}`}>
                    {msg.content}
                  </div>
                );
              } else if (
                msg.content && (
                  msg.content.includes("call") ||
                  msg.content.includes("Missed") ||
                  msg.content.includes("Declined") ||
                  msg.content.startsWith("📞") ||
                  msg.content.startsWith("📹") ||
                  msg.content.startsWith("📵") ||
                  msg.content.startsWith("🚫")
                )
              ) {
                const isMissed = msg.content.includes("Missed") || msg.content.includes("📵");
                const isDeclined = msg.content.includes("Declined") || msg.content.includes("🚫");
                const isVideoCall = msg.content.includes("Video") || msg.content.includes("📹");
                const parts = msg.content.split('•').map((s: string) => s.trim());
                const mainLabel = parts[0] || msg.content;
                const durationLabel = parts[1] || '';

                return (
                  <div className={`p-3.5 rounded-2xl flex flex-col space-y-2.5 max-w-[260px] shadow-sm border ${
                    isMissed || isDeclined 
                      ? "bg-rose-50/95 border-rose-200/80 text-rose-950" 
                      : isMe 
                        ? "bg-purple-600 text-white border-purple-500/80 shadow-purple-600/20" 
                        : "bg-white border-purple-100 text-gray-900 shadow-xs"
                  }`}>
                    <div className="flex items-center space-x-3">
                      <div className={`p-2.5 rounded-full shrink-0 ${
                        isMissed || isDeclined 
                          ? "bg-rose-100 text-rose-600" 
                          : isMe 
                            ? "bg-white/20 text-white" 
                            : "bg-purple-100 text-purple-700"
                      }`}>
                        {isVideoCall ? <Video className="w-4 h-4" /> : (isMissed || isDeclined) ? <PhoneOff className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-[13px] truncate leading-tight">{mainLabel}</h4>
                        {durationLabel && (
                          <p className={`text-[11px] font-medium mt-0.5 ${
                            isMissed || isDeclined 
                              ? "text-rose-600" 
                              : isMe 
                                ? "text-purple-100" 
                                : "text-purple-600"
                          }`}>
                            Duration: {durationLabel}
                          </p>
                        )}
                      </div>
                    </div>

                    {!isGroup && (
                      <button
                        type="button"
                        onClick={() => handleStartCall(isVideoCall ? 'video' : 'audio')}
                        className={`w-full py-1.5 px-3 rounded-xl text-xs font-medium flex items-center justify-center space-x-1.5 transition-all active:scale-95 border ${
                          isMe 
                            ? "bg-white/15 hover:bg-white/25 text-white border-white/20" 
                            : "bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200/60"
                        }`}
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Call Back</span>
                      </button>
                    )}
                  </div>
                );
              } else {
                return (
                  <div
                    className={`px-4 py-2.5 text-[15px] leading-snug whitespace-pre-wrap break-words inline-block ${borderRadius} ${isMe ? "bg-[#FE2C55] text-white shadow-xs font-normal" : "bg-[#F2F4F7] text-gray-900 border border-gray-100/80 shadow-2xs font-normal"}`}
                  >
                    {msg.content}
                  </div>
                );
              }
            })()}
          </div>

          {(msg as any).reaction && (
            <div
              className={`absolute -bottom-3 ${isMe ? "right-2" : "left-2"} bg-white border border-gray-100 rounded-full px-1.5 py-0.5 text-sm z-10 shadow-xs`}
            >
              {(msg as any).reaction}
            </div>
          )}
        </div>

        {/* Seen text animation: smooth glide and fade-in */}
        {seenStr && (
          <motion.div
            key="seen-indicator"
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="text-[11px] text-gray-400 font-normal select-none self-end mt-0.5 pr-0.5 overflow-hidden flex items-center space-x-1"
          >
            <span>{seenStr}</span>
          </motion.div>
        )}
      </div>

      {!isMe && (
        <div className="hidden sm:group-hover:flex items-center opacity-0 group-hover:opacity-100 transition-opacity pl-2">
          <button
            type="button"
            onClick={() => onReply(msg)}
            className="p-1.5 hover:bg-black/5 rounded-full"
            title="Reply"
          >
            <Reply className="w-4 h-4 text-gray-400 cursor-pointer" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div
      className={isNew ? "animate-message-pop" : ""}
      style={{ transformOrigin: isMe ? "bottom right" : "bottom left" }}
    >
      {bubbleContent}
    </div>
  );
}, (prev, next) => {
  return (
    prev.msg.id === next.msg.id &&
    prev.msg.status === next.msg.status &&
    prev.msg.content === next.msg.content &&
    (prev.msg as any).reaction === (next.msg as any).reaction &&
    prev.isFirstInGroup === next.isFirstInGroup &&
    prev.isLastInGroup === next.isLastInGroup &&
    prev.borderRadius === next.borderRadius &&
    prev.seenStr === next.seenStr &&
    prev.isMe === next.isMe &&
    prev.isNew === next.isNew &&
    prev.avatarUrl === next.avatarUrl &&
    prev.senderName === next.senderName
  );
});

export default function Messages() {
  const {
    chatTheme,
    setChatTheme,
    setViewingUser,
    viewingStory,
    setViewingStory,
    activeChat,
    setActiveChat,
    currentUser,
    pushPage,
    lastCheckedActivity,
    setLastCheckedActivity,
    lastCheckedFollowers,
    setLastCheckedFollowers,
    setViewingReel,
    setViewingReelContext,
    setViewingMedia,
    cachedChatMessages: messagesCache,
    setCachedChatMessages: setMessagesCache,
    cachedConversations: conversations,
    setCachedConversations: setConversations,
    setIsBottomNavHidden,
    setActiveCallState
  } = useAppStore();

  const handleStartCall = async (type: 'audio' | 'video') => {
    if (!currentUser || !activeContact?.uid || activeContact.isGroup) return;

    setActiveCallState({
      callId: '',
      otherUid: activeContact.uid,
      otherName: activeContact.name,
      otherAvatar: activeContact.avatar,
      type,
      status: 'ringing',
      isCaller: true
    });

    try {
      const { callId } = await initiateCall(
        { uid: currentUser.uid, name: currentUser.name || 'User', avatar: currentUser.avatar || '' },
        { uid: activeContact.uid, name: activeContact.name || 'User', avatar: activeContact.avatar || '' },
        type,
        () => {},
        (status) => {
          if (status === 'ended' || status === 'rejected') {
            useAppStore.getState().setActiveCallState(null);
          } else if (status === 'accepted') {
            const currentCall = useAppStore.getState().activeCallState;
            if (currentCall) {
              useAppStore.getState().setActiveCallState({ ...currentCall, status: 'accepted' });
            }
          }
        }
      );

      setActiveCallState({
        callId,
        otherUid: activeContact.uid,
        otherName: activeContact.name,
        otherAvatar: activeContact.avatar,
        type,
        status: 'ringing',
        isCaller: true
      });
    } catch (err) {
      console.error("Failed to initiate call:", err);
      setActiveCallState(null);
    }
  };
  const [jarvisMessages, setJarvisMessages] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("jarvis_chat_history");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [
      {
        id: "jarvis-welcome-1",
        senderId: "jarvis",
        type: "text",
        content: `কিরে বন্ধু ${currentUser?.name ? currentUser.name : ""}! কী খবর তোর? আমি তোর বেস্ট ফ্রেন্ড এনভো জার্ভিস! আজকে কী করতে চাস বল?`,
        createdAt: 0,
        status: "sent"
      }
    ];
  });
  const [isJarvisTyping, setIsJarvisTyping] = useState(false);

  const messages = activeChat === "jarvis"
    ? jarvisMessages
    : (activeChat && messagesCache[activeChat]) || [];
  const [inputText, setInputText] = useState("");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [presenceData, setPresenceData] = useState<{
    [uid: string]: { isOnline: boolean; lastSeen: number };
  }>({});
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [followers, setFollowers] = useState<any[]>([]);
  const [userDataCache, setUserDataCache] = useState<{
    [uid: string]: { name: string; avatar: string; statusNote?: string };
  }>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const shouldAutoScrollRef = useRef<boolean>(true);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    msgId: string;
  } | null>(null);
  const [chatContextMenu, setChatContextMenu] = useState<{
    x: number;
    y: number;
    convId: string;
    otherUid?: string;
  } | null>(null);
  const [showThemeSettings, setShowThemeSettings] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showPrivacySheet, setShowPrivacySheet] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [selectedMediaItems, setSelectedMediaItems] = useState<{ id: string; type: 'image' | 'video'; url: string; name?: string }[]>([]);
  const selectedImagePreview = selectedMediaItems.length > 0 ? selectedMediaItems[0].url : null;
  const selectedMediaType = selectedMediaItems.length > 0 ? selectedMediaItems[0].type : "image";
  const [showSharedMedia, setShowSharedMedia] = useState(false);
  const [sharedMediaTab, setSharedMediaTab] = useState<"all" | "media" | "reels">("all");
  const [viewportBottomOffset, setViewportBottomOffset] = useState(0);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [lastSeenFollowers, setLastSeenFollowers] = useState<number>(0);
  const [storyPreview, setStoryPreview] = useState<string | null>(null);
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [storyUploading, setStoryUploading] = useState(false);
  const isTypingActiveRef = useRef<boolean>(false);
  const typingTimerRef = useRef<any>(null);

  const isChatInitialLoadedRef = useRef<boolean>(false);
  const animatedMsgIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    isChatInitialLoadedRef.current = false;
    const timer = setTimeout(() => {
      isChatInitialLoadedRef.current = true;
    }, 400);
    return () => clearTimeout(timer);
  }, [activeChat]);

  const [unzoomedCssHeight, setUnzoomedCssHeight] = useState(() => {
    if (typeof window === "undefined") {
      return 800;
    }
    // Always use window.innerHeight (CSS layout pixels) to avoid physical pixel over-zooming from window.screen.height
    return window.innerHeight || 800;
  });

  useEffect(() => {
    const handleScreenResize = () => {
      const currentInnerHeight = window.innerHeight;
      // Only update if height expands (e.g. keyboard closes or orientation changes), never shrink on keyboard open
      setUnzoomedCssHeight((prev) => {
        if (currentInnerHeight > prev || Math.abs(window.innerWidth - 390) > 50) {
          return currentInnerHeight;
        }
        return prev;
      });
    };
    window.addEventListener("resize", handleScreenResize);
    window.addEventListener("orientationchange", handleScreenResize);
    return () => {
      window.removeEventListener("resize", handleScreenResize);
      window.removeEventListener("orientationchange", handleScreenResize);
    };
  }, []);

  useEffect(() => {
    if (!window.visualViewport) return;
    const updateViewport = () => {
      if (!window.visualViewport) return;
      const diff = window.innerHeight - window.visualViewport.height;
      const offset = Math.max(0, diff);
      setViewportBottomOffset(offset);
      if (messagesContainerRef.current) {
        requestAnimationFrame(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTo({
              top: messagesContainerRef.current.scrollHeight,
              behavior: offset > 0 ? 'smooth' : 'auto'
            });
          }
        });
      }
    };
    window.visualViewport.addEventListener("resize", updateViewport);
    window.visualViewport.addEventListener("scroll", updateViewport);
    return () => {
      window.visualViewport?.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("scroll", updateViewport);
    };
  }, []);

  const sharedMediaItems = React.useMemo(() => {
    if (!messages || messages.length === 0) return [];
    return messages
      .filter((m: any) => {
        return (
          m.type === "image" ||
          m.type === "video" ||
          m.type === "reel" ||
          (m.mediaUrl && (m.mediaUrl.startsWith("http") || m.mediaUrl.startsWith("data:"))) ||
          m.postId
        );
      })
      .map((m: any) => {
        const isReel = m.type === "reel" || !!m.postId;
        const isVid = m.type === "video" || (m.mediaUrl && (m.mediaUrl.includes(".mp4") || m.mediaUrl.includes("video")));
        const isImg = m.type === "image" || (!isReel && !isVid && !!m.mediaUrl);
        const cover = m.thumbnailUrl || m.coverUrl || m.mediaUrl;
        return {
          ...m,
          isReel,
          isVid,
          isImg,
          cover,
          mediaType: isReel ? "reel" : isVid ? "video" : "image",
        };
      });
  }, [messages]);

  const displayedSharedItems = React.useMemo(() => {
    if (sharedMediaTab === "media") return sharedMediaItems.filter((i: any) => i.isImg || i.isVid);
    if (sharedMediaTab === "reels") return sharedMediaItems.filter((i: any) => i.isReel);
    return sharedMediaItems;
  }, [sharedMediaItems, sharedMediaTab]);

  const [newGroupAvatar, setNewGroupAvatar] = useState<string | null>(null);
  const groupPfpInputRef = useRef<HTMLInputElement>(null);
  const [showStatusInput, setShowStatusInput] = useState(false);
  const [statusNoteText, setStatusNoteText] = useState("");
  const [showStickerModal, setShowStickerModal] = useState(false);
  const [communityStickersCache, setCommunityStickersCache] = useState<any[]>([]);

  useEffect(() => {
    if (showStickerModal && messagesContainerRef.current) {
      setTimeout(() => {
        messagesContainerRef.current?.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: "smooth"
        });
      }, 100);
    }
  }, [showStickerModal]);

  useEffect(() => {
    fetchCommunityStickers().then(setCommunityStickersCache).catch(() => {});
  }, []);

  const stickerSuggestions = React.useMemo(() => {
    if (!inputText || !inputText.trim()) return [];
    return getSmartStickerSuggestions(inputText, communityStickersCache);
  }, [inputText, communityStickersCache]);

  const handleSendStickerDirect = async (stickerUrl: string, stickerType?: 'image' | 'video' | 'animated') => {
    if (!activeChat || !currentUser) return;
    playMessageSentSound();
    
    const replyData = replyingTo
      ? {
          id: replyingTo.id,
          content: replyingTo.content,
          senderId: replyingTo.senderId,
          type: replyingTo.type,
          mediaUrl: replyingTo.mediaUrl,
        }
      : undefined;

    // Reset inputs
    setInputText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setReplyingTo(null);
    setShowStickerModal(false);
    shouldAutoScrollRef.current = true;

    // Optimistic message in UI
    const tempId = 'temp_' + Date.now();
    const optMsg: any = {
      id: tempId,
      tempId: tempId,
      senderId: currentUser.uid,
      type: 'sticker',
      content: '',
      mediaUrl: stickerUrl,
      stickerUrl: stickerUrl,
      stickerType: stickerType || 'image',
      createdAt: { toMillis: () => Date.now() },
      status: 'sent',
      replyTo: replyData
    };

    setMessagesCache((prev) => ({
      ...prev,
      [activeChat]: [...(prev[activeChat] || []), optMsg]
    }));

    setConversations((prev) => {
      const existing = prev.find((c) => c.id === activeChat);
      if (!existing) return prev;
      const updated = {
        ...existing,
        lastMessage: "Sent a sticker",
        lastMessageTime: Date.now(),
        updatedAt: { toMillis: () => Date.now() },
      };
      return [updated, ...prev.filter((c) => c.id !== activeChat)];
    });

    try {
      await sendMessage(
        activeChat,
        currentUser.uid,
        'sticker' as any,
        '',
        stickerUrl,
        undefined,
        replyData
      );
    } catch (err) {
      console.error("Failed to send sticker:", err);
    }
  };

  const [privacyMode, setPrivacyMode] = useState<"public" | "private">(() => {
    return (
      (localStorage.getItem("privacyMode") as "public" | "private") || "public"
    );
  });
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [inboxStories, setInboxStories] = useState<Story[]>([]);
  const [viewedInboxStories, setViewedInboxStories] = useState<
    Record<string, boolean>
  >(() => {
    try {
      return JSON.parse(localStorage.getItem("viewedInboxStories") || "{}");
    } catch {
      return {};
    }
  });
  useEffect(() => {
    if (showCreateGroup || showStatusInput || showPrivacySheet || showCreateStory) {
      setIsBottomNavHidden(true);
      return () => setIsBottomNavHidden(false);
    } else {
      setIsBottomNavHidden(false);
    }
  }, [showCreateGroup, showStatusInput, showPrivacySheet, showCreateStory, setIsBottomNavHidden]);

  useEffect(() => {
    if (showStatusInput && currentUser) {
      setStatusNoteText((currentUser as any)?.statusNote || "");
    }
  }, [showStatusInput, currentUser]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const durationIntervalRef = useRef<any>(null);
  const isCanceledRef = useRef(false);
  const fetchedUserIdsRef = useRef<Set<string>>(new Set());
  const subscribedPresenceRef = useRef<Map<string, () => void>>(new Map());
  const isSendingMsgRef = useRef(false);

  const startRecording = async () => {
    isCanceledRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (isCanceledRef.current) return;

        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          if (
            activeChat &&
            activeChat !== "followers" &&
            activeChat !== "activity" &&
            currentUser
          ) {
            sendMessage(
              activeChat,
              currentUser.uid,
              "voice",
              "Sent a voice message",
              dataUrl,
              undefined,
              { duration: Math.max(1, recordingDuration) }
            ).catch(console.error);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone fallback activated", err);
      setIsRecording(true);
      setRecordingDuration(0);
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      } else if (!isCanceledRef.current) {
        const synthUrl = "https://actions.google.com/sounds/v1/ambiences/outdoor_park.ogg";
        if (activeChat && currentUser) {
          sendMessage(
            activeChat,
            currentUser.uid,
            "voice",
            "Sent a voice message",
            synthUrl,
            undefined,
            { duration: Math.max(1, recordingDuration) }
          ).catch(console.error);
        }
      }
    }
  };

  const cancelRecording = () => {
    isCanceledRef.current = true;
    setIsRecording(false);
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const processHighQualityChatImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      // Small files or PNG/WebP under 1.5MB: preserve 100% original binary data
      if (file.size < 1.5 * 1024 * 1024 && (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp')) {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // WhatsApp HD Ultra resolution preservation: up to 2560px
          const MAX_DIM = 2560;
          let { width, height } = img;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d", { alpha: false });
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.94);
            resolve(dataUrl);
          } else {
            resolve(event.target?.result as string);
          }
        };
        img.onerror = () => resolve(event.target?.result as string);
        img.src = event.target?.result as string;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.target.files || []);
    if (
      files.length === 0 ||
      !activeChat ||
      activeChat === "followers" ||
      activeChat === "activity" ||
      !currentUser
    )
      return;

    const newItems: { id: string; type: 'image' | 'video'; url: string; name?: string }[] = [];

    for (const file of files) {
      const isVideo = file.type.startsWith("video/");
      if (isVideo) {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.onerror = () => resolve('');
          reader.readAsDataURL(file);
        });
        if (dataUrl) {
          newItems.push({
            id: 'vid_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            type: "video",
            url: dataUrl,
            name: file.name
          });
        }
      } else {
        const dataUrl = await processHighQualityChatImage(file);
        if (dataUrl) {
          newItems.push({
            id: 'img_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            type: "image",
            url: dataUrl,
            name: file.name
          });
        }
      }
    }

    setSelectedMediaItems((prev) => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    const saved = localStorage.getItem("last_seen_followers");
    if (saved) setLastSeenFollowers(parseInt(saved));
  }, []);

  useEffect(() => {
    if (activeChat === "activity" && currentUser) {
      import("../services/notificationService").then((m) =>
        m.markAllRead(currentUser.uid),
      );
      setLastCheckedActivity(Date.now());
    }
    if (activeChat === "followers" && followers.length > 0) {
      setLastCheckedFollowers(followers.length);
    }
  }, [activeChat, currentUser, followers.length]);

  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = subscribeConversations(
      currentUser.uid,
      setConversations,
    );
    const unsubscribeNotifs = subscribeNotifications(
      currentUser.uid,
      setNotifications,
    );
    const unsubscribeStories = subscribeStories(setInboxStories, "inbox");

    // Fetch followers for the followers tab
    const q = query(
      collection(db, "users", currentUser.uid, "followers"),
      orderBy("createdAt", "desc"),
    );
    const unsubscribeFollowers = onSnapshot(q, async (snapshot) => {
      const { getDoc, doc } = await import("firebase/firestore");
      const cacheUpdates: Record<string, any> = {};
      const followerData = await Promise.all(
        snapshot.docs.map(async (docRef) => {
          const data = docRef.data();
          const userSnap = await getDoc(doc(db, "users", docRef.id));
          if (userSnap.exists()) {
            const upToDateUser = userSnap.data();
            cacheUpdates[docRef.id] = {
              name: upToDateUser.name,
              avatar: upToDateUser.avatar,
              statusNote: upToDateUser.statusNote,
            };
            return { id: docRef.id, ...data, ...upToDateUser };
          }
          return { id: docRef.id, ...data };
        }),
      );
      if (Object.keys(cacheUpdates).length > 0) {
        setUserDataCache((prev) => ({ ...prev, ...cacheUpdates }));
      }
      setFollowers(followerData);
    }, () => {});

    return () => {
      unsubscribe();
      unsubscribeNotifs();
      unsubscribeStories();
      unsubscribeFollowers();
    };
  }, [currentUser]);

  // Listen in REAL-TIME to user profile changes for conversation participants
  useEffect(() => {
    if (!currentUser) return;
    const unsubs: (() => void)[] = [];
    const allParticipantIds = new Set<string>();

    conversations.forEach((conv) => {
      conv.participantIds?.forEach((id: string) => {
        if (id && id !== currentUser.uid) allParticipantIds.add(id);
      });
    });

    allParticipantIds.forEach((uid) => {
      const userRef = doc(db, "users", uid);
      const unsub = onSnapshot(userRef, (userDoc) => {
        if (userDoc.exists()) {
          const data = userDoc.data();
          const name = data.name || data.username || "User";
          const avatar = data.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
          setUserDataCache((prev) => ({
            ...prev,
            [uid]: {
              name,
              avatar,
              statusNote: data.statusNote,
            },
          }));
        }
      }, (err) => console.warn("Real-time user cache listener error:", err));
      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [conversations, currentUser]);

  const [messageLimit, setMessageLimit] = useState(20);
  const [activityLimit, setActivityLimit] = useState(15);

  useEffect(() => {
    if (!activeChat || activeChat === "followers" || activeChat === "activity")
      return;

    if (currentUser) {
      import("../services/chatService").then((m) =>
        m.markConversationRead(activeChat, currentUser.uid),
      );
    }

    const unsubscribe = subscribeMessages(
      activeChat,
      (newMsgs) => {
        setMessagesCache((prev) => {
          const currentCached = prev[activeChat] || [];
          const newMsgIds = new Set(newMsgs.map(m => m.id));
          
          // Filter out temp messages that have already synced to Firestore
          const pendingTempMsgs = currentCached.filter((m: any) => {
            if (!m.id || typeof m.id !== 'string') return false;
            if (!m.id.startsWith('temp_')) return false;
            // Check if synced
            const isSynced = newMsgs.some(nm =>
              nm.senderId === m.senderId &&
              nm.type === m.type &&
              nm.content === m.content &&
              Math.abs((nm.createdAt?.toMillis?.() || Date.now()) - (m.createdAt?.toMillis?.() || Date.now())) < 20000
            );
            return !isSynced;
          });

          // Deduplicate all messages by id
          const seenIds = new Set<string>();
          const merged: any[] = [];
          
          [...newMsgs, ...pendingTempMsgs].forEach(m => {
            const idToUse = m.id || m.tempId;
            if (idToUse && !seenIds.has(idToUse)) {
              seenIds.add(idToUse);
              merged.push(m);
            }
          });

          return { ...prev, [activeChat]: merged };
        });
        if (currentUser && newMsgs.some(m => m.senderId !== currentUser.uid && m.status !== 'seen')) {
          import("../services/chatService").then((m) =>
            m.markConversationRead(activeChat, currentUser.uid),
          );
        }
      },
      messageLimit,
    );
    const unsubscribeTyping = subscribeTyping(activeChat, (users) => {
      setTypingUsers(users.filter((uid) => uid !== currentUser?.uid));
    });
    return () => {
      unsubscribe();
      unsubscribeTyping();
    };
  }, [activeChat, currentUser, messageLimit]);

  useLayoutEffect(() => {
    setMessageLimit(20); // Reset limit when chat changes
    if (activeChat && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [activeChat]);

  const prevMessagesCountRef = useRef(messages.length);
  useLayoutEffect(() => {
    const isAdded = messages.length > prevMessagesCountRef.current;
    prevMessagesCountRef.current = messages.length;

    if (activeChat && messagesContainerRef.current && shouldAutoScrollRef.current) {
      if (isAdded) {
        messagesContainerRef.current.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [messages.length, activeChat]);

  // Focus input safely when replying without jumping the viewport
  useEffect(() => {
    if (replyingTo) {
      textareaRef.current?.focus({ preventScroll: true });
      if (messagesContainerRef.current && shouldAutoScrollRef.current) {
        messagesContainerRef.current.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [replyingTo]);

  // Keep chat content aligned smoothly when virtual keyboard opens without forcing scroll if user scrolled up
  useEffect(() => {
    if (!activeChat) return;
    let rafId: number | null = null;
    const handleViewportChange = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (messagesContainerRef.current && shouldAutoScrollRef.current) {
          messagesContainerRef.current.scrollTo({
            top: messagesContainerRef.current.scrollHeight,
            behavior: 'smooth'
          });
        }
      });
    };
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
    }
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
      }
    };
  }, [activeChat]);

  useEffect(() => {
    if (!currentUser) return;
    const currentUnsubs = subscribedPresenceRef.current;
    conversations.forEach((conv) => {
      const otherId = conv.participantIds?.find((id) => id !== currentUser.uid);
      if (otherId && !currentUnsubs.has(otherId)) {
        const unsub = subscribePresence(otherId, (data) => {
          setPresenceData((prev) => ({ ...prev, [otherId]: data }));
        });
        currentUnsubs.set(otherId, unsub);
      }
    });
  }, [conversations, currentUser]);

  const handleLongPress = (e: React.UIEvent, msgId: string) => {
    e.preventDefault();
    if (typeof window !== "undefined" && window.navigator?.vibrate) {
      try { window.navigator.vibrate(25); } catch (err) {}
    }
    const x =
      "touches" in e
        ? (e as React.TouchEvent).touches[0].clientX
        : (e as React.MouseEvent).clientX;
    const y =
      "touches" in e
        ? (e as React.TouchEvent).touches[0].clientY
        : (e as React.MouseEvent).clientY;
    setContextMenu({
      x: Math.min(x, window.innerWidth - 270),
      y: Math.min(y, window.innerHeight - 250),
      msgId,
    });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSendingMsgRef.current) return;
    if (
      (!inputText.trim() && selectedMediaItems.length === 0) ||
      !activeChat ||
      activeChat === "followers" ||
      activeChat === "activity" ||
      !currentUser
    )
      return;

    isSendingMsgRef.current = true;
    playMessageSentSound();
    const textToSend = inputText.trim();
    const mediaItemsToSend = [...selectedMediaItems];
    const replyData = replyingTo
      ? {
          id: replyingTo.id,
          content: replyingTo.content,
          senderId: replyingTo.senderId,
          type: replyingTo.type,
          mediaUrl: replyingTo.mediaUrl,
        }
      : undefined;

    // Reset inputs IMMEDIATELY for ultra-fast response
    setInputText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus({ preventScroll: true });
    }
    setSelectedMediaItems([]);
    setReplyingTo(null);
    setTyping(activeChat, currentUser.uid, false);
    shouldAutoScrollRef.current = true;

    // Handle Ennvo Jarvis AI Assistant messages
    if (activeChat === "jarvis") {
      const nowTs = Date.now();
      const userMsg = {
        id: "user-" + nowTs,
        senderId: currentUser.uid,
        type: "text",
        content: textToSend,
        createdAt: nowTs,
        status: "sent"
      };

      const newJarvisMsgs = [...jarvisMessages, userMsg];
      setJarvisMessages(newJarvisMsgs);
      try { localStorage.setItem("jarvis_chat_history", JSON.stringify(newJarvisMsgs)); } catch (e) {}

      setIsJarvisTyping(true);
      isSendingMsgRef.current = false;

      const apiEndpoint = typeof window !== 'undefined' && window.location?.origin && window.location.origin.startsWith('http')
        ? `${window.location.origin}/api/jarvis`
        : '/api/jarvis';

      fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newJarvisMsgs,
          userName: currentUser?.name || "দোস্ত"
        })
      })
        .then((res) => {
          if (!res.ok) throw new Error("API HTTP " + res.status);
          return res.json();
        })
        .then((data) => {
          const replyText = data?.reply || `কিরে বন্ধু ${currentUser?.name || ""}! তোর মেসেজ পেয়েছি, বল কী সাহায্য করতে পারি?`;
          const replyMsg = {
            id: "jarvis-" + Date.now(),
            senderId: "jarvis",
            type: "text",
            content: replyText,
            createdAt: Date.now(),
            status: "sent"
          };
          setJarvisMessages((prev) => {
            const updated = [...prev, replyMsg];
            try { localStorage.setItem("jarvis_chat_history", JSON.stringify(updated)); } catch (e) {}
            return updated;
          });
          playMessageSentSound();
        })
        .catch((err) => {
          console.error("Jarvis response error:", err);
          const fallbackText = `কিরে ${currentUser?.name || "দোস্ত"}! তোর মেসেজ পেয়েছি! বিজয়নগরের সন্তান এরফান ভাইয়ের বানানো Ennvo এআই সার্ভিস তোর পাশে সব সময় রেডি আছে! বল কী হেল্প লাগবে?`;
          const replyMsg = {
            id: "jarvis-" + Date.now(),
            senderId: "jarvis",
            type: "text",
            content: fallbackText,
            createdAt: Date.now(),
            status: "sent"
          };
          setJarvisMessages((prev) => {
            const updated = [...prev, replyMsg];
            try { localStorage.setItem("jarvis_chat_history", JSON.stringify(updated)); } catch (e) {}
            return updated;
          });
          playMessageSentSound();
        })
        .finally(() => {
          setIsJarvisTyping(false);
        });

      return;
    }

    // Optimistically show message in UI
    const tempId = 'temp_' + Date.now();
    let optMsg: any;
    if (mediaItemsToSend.length === 1) {
      const single = mediaItemsToSend[0];
      optMsg = {
        id: tempId,
        tempId: tempId,
        senderId: currentUser.uid,
        type: single.type,
        content: textToSend || (single.type === 'video' ? 'Sent a video' : 'Sent an image'),
        mediaUrl: single.url,
        createdAt: { toMillis: () => Date.now() },
        status: 'sent',
        replyTo: replyData
      };
    } else if (mediaItemsToSend.length > 1) {
      optMsg = {
        id: tempId,
        tempId: tempId,
        senderId: currentUser.uid,
        type: 'album',
        content: textToSend || `Sent ${mediaItemsToSend.length} photos/videos`,
        mediaUrl: mediaItemsToSend[0].url,
        mediaUrls: mediaItemsToSend.map(m => m.url),
        mediaItems: mediaItemsToSend.map(m => ({ type: m.type, url: m.url })),
        createdAt: { toMillis: () => Date.now() },
        status: 'sent',
        replyTo: replyData
      };
    } else {
      optMsg = {
        id: tempId,
        tempId: tempId,
        senderId: currentUser.uid,
        type: 'text',
        content: textToSend,
        createdAt: { toMillis: () => Date.now() },
        status: 'sent',
        replyTo: replyData
      };
    }

    setMessagesCache((prev) => ({
      ...prev,
      [activeChat]: [...(prev[activeChat] || []), optMsg]
    }));

    setConversations((prev) => {
      const existing = prev.find((c) => c.id === activeChat);
      if (!existing) return prev;
      const updated = {
        ...existing,
        lastMessage:
          textToSend ||
          (mediaItemsToSend.length > 1
            ? `Sent ${mediaItemsToSend.length} photos/videos`
            : mediaItemsToSend[0]?.type === "video"
              ? "Sent a video"
              : mediaItemsToSend[0]?.type === "image"
                ? "Sent an image"
                : "Sent a message"),
        lastMessageTime: Date.now(),
        updatedAt: { toMillis: () => Date.now() },
      };
      return [updated, ...prev.filter((c) => c.id !== activeChat)];
    });

    shouldAutoScrollRef.current = true;

    try {
      if (mediaItemsToSend.length === 1) {
        const single = mediaItemsToSend[0];
        await sendMessage(
          activeChat,
          currentUser.uid,
          single.type,
          textToSend || (single.type === "video" ? "Sent a video" : "Sent an image"),
          single.url,
          undefined,
          replyData
        );
      } else if (mediaItemsToSend.length > 1) {
        await sendMessage(
          activeChat,
          currentUser.uid,
          'album',
          textToSend || `Sent ${mediaItemsToSend.length} photos/videos`,
          mediaItemsToSend[0].url,
          undefined,
          replyData,
          {
            mediaUrls: mediaItemsToSend.map(m => m.url),
            mediaItems: mediaItemsToSend.map(m => ({ type: m.type, url: m.url }))
          }
        );
      } else {
        await sendMessage(
          activeChat,
          currentUser.uid,
          "text",
          textToSend,
          undefined,
          undefined,
          replyData
        );
      }
    } catch (error) {
      console.error("Failed sending chat message:", error);
    } finally {
      isSendingMsgRef.current = false;
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);
    if (
      activeChat &&
      activeChat !== "followers" &&
      activeChat !== "activity" &&
      currentUser
    ) {
      if (val.trim().length > 0) {
        if (!isTypingActiveRef.current) {
          isTypingActiveRef.current = true;
          setTyping(activeChat, currentUser.uid, true);
        }
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
          isTypingActiveRef.current = false;
          setTyping(activeChat, currentUser.uid, false);
        }, 3000);
      } else {
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        isTypingActiveRef.current = false;
        setTyping(activeChat, currentUser.uid, false);
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent, msgId: string) => {
    e.preventDefault();
    let x = e.clientX;
    let y = e.clientY;

    const menuWidth = 270;
    const menuHeight = 250;

    if (x + menuWidth > window.innerWidth)
      x = window.innerWidth - menuWidth - 10;
    if (y + menuHeight > window.innerHeight)
      y = window.innerHeight - menuHeight - 10;

    setContextMenu({ x, y, msgId });
  };

  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const longPressedRef = useRef(false);

  const handleChatTouchStart = (
    e: React.TouchEvent | React.MouseEvent,
    convId: string,
    otherUid?: string,
  ) => {
    longPressedRef.current = false;
    const x = "touches" in e ? e.touches[0].clientX : e.clientX;
    const y = "touches" in e ? e.touches[0].clientY : e.clientY;
    touchTimerRef.current = setTimeout(() => {
      longPressedRef.current = true;
      setChatContextMenu({ x, y, convId, otherUid });
    }, 500); // 500ms long press
  };

  const handleChatTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
    }
  };

  const closeContextMenu = () => {
    setContextMenu(null);
    setChatContextMenu(null);
  };

  const handleFollowBack = async (follower: any) => {
    if (!currentUser) return;
    try {
      await followUser(currentUser, {
        uid: follower.id,
        name: follower.name,
        avatar: follower.avatar,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const jarvisLastMsg = jarvisMessages[jarvisMessages.length - 1];
  const hasRealJarvisChat = jarvisMessages.length > 1 || (jarvisLastMsg && jarvisLastMsg.id !== "jarvis-welcome-1");
  const jarvisTimeMs = hasRealJarvisChat && jarvisLastMsg?.createdAt
    ? (typeof jarvisLastMsg.createdAt === 'number'
        ? jarvisLastMsg.createdAt
        : typeof (jarvisLastMsg.createdAt as any)?.toMillis === "function"
          ? (jarvisLastMsg.createdAt as any).toMillis()
          : (jarvisLastMsg.createdAt instanceof Date
              ? jarvisLastMsg.createdAt.getTime()
              : (typeof (jarvisLastMsg.createdAt as any)?.seconds === 'number'
                  ? (jarvisLastMsg.createdAt as any).seconds * 1000
                  : (!isNaN(new Date(jarvisLastMsg.createdAt).getTime())
                      ? new Date(jarvisLastMsg.createdAt).getTime()
                      : 0))))
    : 0;

  const jarvisConvItem: any = {
    id: "jarvis",
    participantIds: [currentUser?.uid || "", "jarvis"],
    participantNames: { jarvis: "Ennvo Jarvis" },
    participantAvatars: { jarvis: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80" },
    lastMessage: jarvisLastMsg?.content || "কিরে বন্ধু! কী খবর তোর?",
    lastMessageTime: jarvisTimeMs > 0 ? jarvisTimeMs : null,
    updatedAt: jarvisTimeMs > 0 ? { toMillis: () => jarvisTimeMs } : null,
    unreadCount: { [currentUser?.uid || ""]: 0 },
    isAi: true,
  };

  const pendingRequests = React.useMemo(() => {
    if (!currentUser) return [];
    return conversations.filter((c: any) => {
      if (!c.isRequest || c.requestStatus !== "pending") return false;
      return c.requestTo === currentUser.uid || (!c.requestTo && c.requestFrom !== currentUser.uid);
    });
  }, [conversations, currentUser?.uid]);

  const pendingRequestsCount = pendingRequests.length;

  const latestPendingRequestTime = React.useMemo(() => {
    if (pendingRequests.length === 0) return 0;
    let maxTime = 0;
    for (const req of pendingRequests) {
      const getT = (item: any) => {
        if (typeof item.updatedAt?.toMillis === 'function') return item.updatedAt.toMillis();
        if (typeof item.updatedAt === 'number') return item.updatedAt;
        if (typeof item.lastMessageTime === 'number') return item.lastMessageTime;
        if (typeof item.lastMessageTime?.toMillis === 'function') return item.lastMessageTime.toMillis();
        if (typeof item.createdAt?.toMillis === 'function') return item.createdAt.toMillis();
        if (typeof item.createdAt === 'number') return item.createdAt;
        return 0;
      };
      const reqTime = getT(req);
      if (reqTime > maxTime) maxTime = reqTime;
    }
    return maxTime;
  }, [pendingRequests]);

  const messageRequestsConvItem: any = {
    id: "message_requests_item",
    isMessageRequestsRow: true,
    lastMessageTime: latestPendingRequestTime > 0 ? latestPendingRequestTime : null,
    updatedAt: latestPendingRequestTime > 0 ? { toMillis: () => latestPendingRequestTime } : null,
    unreadCount: { [currentUser?.uid || ""]: pendingRequestsCount },
  };

  const allUnifiedConversations = React.useMemo(() => {
    const list = [
      jarvisConvItem,
      messageRequestsConvItem,
      ...conversations.filter((c: any) => {
        const isIncomingPending =
          c.isRequest &&
          c.requestStatus === "pending" &&
          (c.requestTo === currentUser?.uid || (!c.requestTo && c.requestFrom !== currentUser?.uid));
        return !isIncomingPending;
      })
    ];

    const getConvTime = (item: any) => {
      if (typeof item.updatedAt?.toMillis === "function") return item.updatedAt.toMillis();
      if (typeof item.updatedAt === "number") return item.updatedAt;
      if (typeof item.lastMessageTime === "number") return item.lastMessageTime;
      if (typeof item.lastMessageTime?.toMillis === "function") return item.lastMessageTime.toMillis();
      if (typeof item.lastMessageTime?.seconds === "number") return item.lastMessageTime.seconds * 1000;
      if (typeof item.createdAt?.toMillis === "function") return item.createdAt.toMillis();
      if (typeof item.createdAt?.seconds === "number") return item.createdAt.seconds * 1000;
      if (typeof item.createdAt === "number") return item.createdAt;
      return 0;
    };

    return list.sort((a: any, b: any) => getConvTime(b) - getConvTime(a));
  }, [conversations, currentUser?.uid, jarvisTimeMs, jarvisLastMsg?.content, latestPendingRequestTime, pendingRequestsCount]);

  const filteredConversations = React.useMemo(() => {
    return allUnifiedConversations.filter((conv: any) => {
      if (!searchQuery.trim()) return true;
      if (conv.id === "jarvis") {
        return "ennvo jarvis".includes(searchQuery.toLowerCase());
      }
      if (conv.isMessageRequestsRow) {
        return "message requests".includes(searchQuery.toLowerCase()) || "requests".includes(searchQuery.toLowerCase());
      }
      const otherId = conv.participantIds?.find((id: string) => id !== currentUser?.uid);
      const name =
        (conv.participantNames || {})[otherId || ""] ||
        userDataCache[otherId || ""]?.name ||
        "User";
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [allUnifiedConversations, searchQuery, currentUser?.uid, userDataCache]);

  const activeConversation = conversations.find((c) => c.id === activeChat);
  const otherParticipantId = activeConversation?.participantIds?.find(
    (id) => id !== currentUser?.uid,
  );
  const isGroup = activeConversation
    ? (activeConversation as any).isGroup ||
      !!(activeConversation as any).groupName ||
      activeConversation.participantIds?.length > 2
    : false;

  const activeContact = activeChat === "jarvis"
    ? {
        id: "jarvis",
        uid: "jarvis",
        name: "Ennvo Jarvis",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
        online: true,
        lastSeen: Date.now(),
        isGroup: false,
        isAi: true
      }
    : activeConversation
    ? {
        id: activeConversation.id,
        uid: isGroup ? activeConversation.id : otherParticipantId,
        name: isGroup
          ? (activeConversation as any).groupName || "Group Chat"
          : userDataCache[otherParticipantId || ""]?.name ||
            (activeConversation.participantNames || {})[
              otherParticipantId || ""
            ] ||
            "User",
        avatar: isGroup
          ? (activeConversation as any).groupAvatar
          : userDataCache[otherParticipantId || ""]?.avatar ||
            (activeConversation.participantAvatars || {})[
              otherParticipantId || ""
            ] ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(userDataCache[otherParticipantId || ""]?.name || (activeConversation.participantNames || {})[otherParticipantId || ""] || "User")}&background=random`,
        online: isGroup
          ? false
          : presenceData[otherParticipantId || ""]?.isOnline || false,
        lastSeen: isGroup
          ? 0
          : presenceData[otherParticipantId || ""]?.lastSeen || 0,
        isGroup,
      }
    : (activeChat && activeChat !== "followers" && activeChat !== "activity" && activeChat !== "requests")
    ? {
        id: activeChat,
        uid: activeChat,
        name: userDataCache[activeChat]?.name || "Chat",
        avatar: userDataCache[activeChat]?.avatar || `https://ui-avatars.com/api/?name=Chat&background=random`,
        online: false,
        lastSeen: 0,
        isGroup: false
      }
    : null;

  const activeConvTheme = (activeConversation as any)?.theme || 
    (activeChat === "jarvis" ? (localStorage.getItem("jarvis_chat_theme") || chatTheme) : chatTheme) || 
    "/chat-background.png";

  const scrollToBottom = (force = false) => {
    if (messagesContainerRef.current && (shouldAutoScrollRef.current || force)) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: force ? "instant" : "smooth",
      });
    }
  };

  useEffect(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        messagesContainerRef.current;

      // Handle pagination scroll adjustment when top messages are loaded
      if (scrollHeight > prevScrollHeightRef.current && scrollTop < 80) {
        const diff = scrollHeight - prevScrollHeightRef.current;
        messagesContainerRef.current.scrollTop = scrollTop + diff;
      } else if (shouldAutoScrollRef.current) {
        scrollToBottom();
      }
      prevScrollHeightRef.current = scrollHeight;
    }
  }, [messages, typingUsers]);

  // Force scroll to bottom on chat enter
  useEffect(() => {
    if (activeChat) {
      shouldAutoScrollRef.current = true;
      scrollToBottom(true);
      setTimeout(() => scrollToBottom(true), 150);
    }
  }, [activeChat]);

  const isSpecialChat = activeChat === "followers" || activeChat === "activity" || activeChat === "requests";

  const isMobile =
    typeof window !== "undefined" ? window.innerWidth < 768 : false;

  const unreadNotifsCount = notifications.filter((n) => !n.isRead).length;

  const renderedMessages = React.useMemo(
    () =>
      messages.map((msg, idx) => {
        const isMe = msg.senderId === currentUser?.uid;
        const prevMsg = messages[idx - 1];
        const nextMsg = messages[idx + 1];

        const getMsgTime = (m: any) => {
          if (!m) return 0;
          if (m.createdAt?.toMillis) return m.createdAt.toMillis();
          if (m.createdAt?.seconds) return m.createdAt.seconds * 1000;
          if (typeof m.createdAt === 'number') return m.createdAt;
          return Date.now();
        };

        const msgTime = getMsgTime(msg);
        const prevTime = getMsgTime(prevMsg);
        const nextTime = getMsgTime(nextMsg);

        const emojiRegex = /^[\p{Extended_Pictographic}\s]+$/u;
        const checkIsEmoji = (m: any) => {
          if (!m || m.type !== 'text' || !m.content) return false;
          const trimmed = (m.content || "").trim();
          return emojiRegex.test(trimmed) && Array.from(trimmed).length <= 3 && trimmed.length > 0;
        };

        const curIsEmoji = checkIsEmoji(msg);
        const prevIsEmoji = checkIsEmoji(prevMsg);
        const nextIsEmoji = checkIsEmoji(nextMsg);

        const prevSame = !curIsEmoji && !prevIsEmoji && prevMsg && prevMsg.senderId === msg.senderId && Math.abs(msgTime - prevTime) < 60000;
        const nextSame = !curIsEmoji && !nextIsEmoji && nextMsg && nextMsg.senderId === msg.senderId && Math.abs(nextTime - msgTime) < 60000;

        const isFirstInGroup = !prevSame;
        const isLastInGroup = !nextSame;

        let borderRadius = "rounded-3xl";
        if (isMe) {
          if (!isFirstInGroup && !isLastInGroup)
            borderRadius = "rounded-3xl rounded-tr-md rounded-br-md";
          else if (!isFirstInGroup && isLastInGroup)
            borderRadius = "rounded-3xl rounded-tr-md";
          else if (isFirstInGroup && !isLastInGroup)
            borderRadius = "rounded-3xl rounded-br-md";
        } else {
          if (!isFirstInGroup && !isLastInGroup)
            borderRadius = "rounded-3xl rounded-tl-md rounded-bl-md";
          else if (!isFirstInGroup && isLastInGroup)
            borderRadius = "rounded-3xl rounded-tl-md";
          else if (isFirstInGroup && !isLastInGroup)
            borderRadius = "rounded-3xl rounded-bl-md";
        }

        const messageKey = msg.id && !msg.id.startsWith("temp_")
          ? msg.id
          : `${msg.id || msg.tempId || 'msg'}_${idx}`;

        const isLastMsg = idx === messages.length - 1;
        let seenStr: string | null = null;
        if (isMe && isLastMsg) {
          const otherUid = activeConversation?.participantIds?.find(id => id !== currentUser?.uid);
          const isReadByOther = msg.status === 'seen' || (otherUid && activeConversation?.unreadCount && activeConversation.unreadCount[otherUid] === 0);
          if (isReadByOther) {
            const mTime = (msg.createdAt as any)?.toMillis ? (msg.createdAt as any).toMillis() : ((msg.createdAt as any)?.seconds ? (msg.createdAt as any).seconds * 1000 : (typeof msg.createdAt === 'number' ? msg.createdAt : Date.now()));
            const diffSec = Math.floor((Date.now() - mTime) / 1000);
            if (diffSec < 45) {
              seenStr = "Seen";
            } else if (diffSec < 3600) {
              const mins = Math.max(1, Math.floor(diffSec / 60));
              seenStr = `Seen ${mins}m ago`;
            } else if (diffSec < 86400) {
              const hours = Math.floor(diffSec / 3600);
              seenStr = `Seen ${hours}h ago`;
            } else {
              const days = Math.floor(diffSec / 86400);
              seenStr = `Seen ${days}d ago`;
            }
          }
        }

        const msgId = msg.id || msg.tempId;
        const isTemp = Boolean(msg.id?.startsWith("temp_"));
        const isNew = isTemp || (Boolean(msgId) && !animatedMsgIdsRef.current.has(msgId) && isChatInitialLoadedRef.current);
        if (msgId) {
          animatedMsgIdsRef.current.add(msgId);
        }

        const resolvedSenderName = isMe
          ? (currentUser?.name || "You")
          : activeContact?.isGroup
          ? (((activeConversation as any)?.participantNames || {})[msg.senderId] || userDataCache[msg.senderId]?.name || "User")
          : (activeContact?.name || "User");

        const resolvedAvatarUrl = isMe
          ? (currentUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || "Me")}&background=random`)
          : activeContact?.isGroup
          ? (((activeConversation as any)?.participantAvatars || {})[msg.senderId] ||
             userDataCache[msg.senderId]?.avatar ||
             `https://ui-avatars.com/api/?name=${encodeURIComponent(resolvedSenderName)}&background=random`)
          : (activeContact?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(resolvedSenderName)}&background=random`);

        const avatarUrl = !isMe && isLastInGroup ? resolvedAvatarUrl : undefined;
        const senderName = activeContact?.isGroup && !isMe ? resolvedSenderName : undefined;

        if (msg.type === "system") {
          return (
            <div key={messageKey} className="my-2.5 flex items-center justify-center">
              <div className="px-3.5 py-1 bg-black/40 backdrop-blur-md text-white/95 text-[11.5px] font-medium rounded-full border border-white/10 shadow-xs tracking-tight text-center max-w-[85%] animate-in fade-in zoom-in-95">
                {msg.content}
              </div>
            </div>
          );
        }

        return (
          <MessageBubble
            key={messageKey}
            msg={msg}
            isMe={isMe}
            isFirstInGroup={isFirstInGroup}
            isLastInGroup={isLastInGroup}
            borderRadius={borderRadius}
            isNew={isNew}
            avatarUrl={avatarUrl}
            senderName={senderName}
            senderInfo={{ name: resolvedSenderName, avatar: resolvedAvatarUrl }}
            isGroup={Boolean(activeContact?.isGroup)}
            seenStr={seenStr}
            onReply={(m) => setReplyingTo(m as any)}
            onLongPress={handleLongPress}
            onContextMenu={handleContextMenu}
            onToggleReaction={async (msgId, currentReaction) => {
              if (activeChat) {
                try {
                  const { updateDoc, doc } = await import("firebase/firestore");
                  await updateDoc(
                    doc(db, "conversations", activeChat, "messages", msgId),
                    { reaction: currentReaction === "❤️" ? null : "❤️" }
                  );
                } catch (err) {}
              }
            }}
            setViewingReel={setViewingReel}
            setViewingReelContext={setViewingReelContext}
            setViewingMedia={setViewingMedia}
            handleStartCall={handleStartCall}
          />
        );
      }),
    [messages, currentUser, activeContact, activeConversation, userDataCache, chatTheme, activeChat],
  );

  return (
    <div
      className="h-full w-full flex bg-white overflow-hidden relative md:pl-24"
      onClick={closeContextMenu}
    >
      {/* Left Sidebar (Contacts) */}
      <div
        className={`w-full md:w-[350px] flex-shrink-0 border-r border-purple-100/50 flex-col h-full bg-transparent backdrop-blur-xl z-10 ${activeChat ? "hidden md:flex" : "flex"}`}
      >
        {/* Header */}
        <div className="px-4 pt-8 pb-3 flex items-center justify-between sticky top-0 bg-transparent z-10 w-full min-h-[88px] md:min-h-[72px]">
          {isSearchExpanded ? (
            <div className="relative flex items-center flex-1 animate-in fade-in slide-in-from-right-2">
              <Search
                className="w-5 h-5 absolute left-3 text-gray-400"
                strokeWidth={2}
              />
              <input
                type="text"
                placeholder="Search friends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-100 rounded-full pl-10 pr-8 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all font-normal text-gray-900"
                autoFocus
              />
              <button
                onClick={() => {
                  setIsSearchExpanded(false);
                  setSearchQuery("");
                }}
                className="absolute right-3 p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>
          ) : (
            <>
              <button
                className="p-2 hover:bg-white/50 rounded-full transition-colors active:scale-95"
                onClick={() => setShowCreateGroup(true)}
              >
                <UserPlus
                  className="w-6 h-6 text-gray-800"
                  strokeWidth={1.5}
                />
              </button>
              <div
                className="flex items-center space-x-1.5 cursor-pointer relative select-none active:scale-95 transition-transform"
                onClick={() => setShowPrivacySheet(true)}
              >
                <h1 className="text-xl font-normal text-gray-900 tracking-tight">
                  Inbox
                </h1>
                <ChevronDown
                  className="w-4 h-4 text-gray-900 mt-[2px]"
                  strokeWidth={2}
                />
                {privacyMode === "private" && (
                  <div className="absolute -right-3 top-[-2px]">
                    <EyeOff className="w-3 h-3 text-gray-500" strokeWidth={2.5} />
                  </div>
                )}
              </div>
              <button
                className="p-2 hover:bg-white/50 rounded-full transition-colors active:scale-95"
                onClick={() => setIsSearchExpanded(true)}
              >
                <Search
                  className="w-6 h-6 text-gray-800"
                  strokeWidth={1.5}
                />
              </button>
            </>
          )}
        </div>

        {/* Scrollable Area (Stories + Contacts) */}
        <PullToRefresh onRefresh={async () => { await new Promise(r => setTimeout(r, 450)); }} className="flex-1 overflow-y-auto scrollbar-hide pb-[80px] [webkit-font-smoothing:antialiased]">
          <div className="w-full">
          {/* Small Stories with Notes block */}
          {!searchQuery.trim() && (
            <div className="pb-2.5 pt-1 border-b border-gray-100/60">
              <div className="flex space-x-3.5 overflow-x-auto scrollbar-hide px-3.5">
                <div className="flex flex-col items-center flex-shrink-0 cursor-pointer pt-6 pb-1">
                  <div className="relative">
                    {/* Clean Note Bubble overlapping avatar top */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowStatusInput(true);
                      }}
                      className="absolute top-[-10px] left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-white/80 backdrop-blur-md border border-white/80 shadow-xs rounded-full z-20 w-auto max-w-[96px] cursor-pointer hover:bg-white/95 transition-all active:scale-95 flex items-center justify-center"
                    >
                      <span className="text-[10px] font-medium text-purple-700 leading-tight block text-center truncate max-w-[80px]">
                        {(currentUser as any)?.statusNote || "Note+"}
                      </span>
                      <div className="absolute -bottom-[3px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white/80 border-b border-r border-white/80 rotate-45"></div>
                    </div>
                    <div
                      onClick={() => {
                        const { setSelectedCreateMode } = useAppStore.getState();
                        setSelectedCreateMode('story');
                        pushPage('create');
                      }}
                      className="cursor-pointer transition-transform active:scale-95 relative p-[2.5px] rounded-full bg-gradient-to-tr from-cyan-400 to-teal-400"
                    >
                      <img
                        src={
                          currentUser?.avatar ||
                          `https://ui-avatars.com/api/?name=${currentUser?.name || "Me"}&background=random`
                        }
                        className="w-[84px] h-[84px] rounded-full object-cover border-2 border-white shadow-xs"
                        alt="Me"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute bottom-0.5 right-0.5 w-6 h-6 bg-[#20D5EC] rounded-full border-[2.5px] border-white flex items-center justify-center shadow-xs">
                        <Plus className="w-4 h-4 text-white" strokeWidth={3} />
                      </div>
                    </div>
                  </div>
                  <span className="text-[12px] font-normal [font-weight:400] text-gray-900 mt-1.5">
                    Create
                  </span>
                </div>

                {(() => {
                  // Build combined list of users with active stories and followers
                  const authorMap = new Map<string, { id: string; name: string; avatar: string; statusNote?: string; stories: Story[] }>();

                  // 1. Add all authors who have active stories
                  inboxStories.forEach((s) => {
                    if (s.authorId && s.authorId !== currentUser?.uid) {
                      if (!authorMap.has(s.authorId)) {
                        authorMap.set(s.authorId, {
                          id: s.authorId,
                          name: s.authorName || 'User',
                          avatar: s.authorAvatar || '',
                          stories: []
                        });
                      }
                      authorMap.get(s.authorId)!.stories.push(s);
                    }
                  });

                  // 2. Merge followers
                  followers.forEach((f) => {
                    const fid = f.id as string;
                    if (fid && fid !== currentUser?.uid) {
                      if (authorMap.has(fid)) {
                        const item = authorMap.get(fid)!;
                        if (f.name) item.name = f.name;
                        if (f.avatar) item.avatar = f.avatar as string;
                        item.statusNote = f.statusNote;
                      } else {
                        authorMap.set(fid, {
                          id: fid,
                          name: f.name || 'User',
                          avatar: (f.avatar as string) || '',
                          statusNote: f.statusNote,
                          stories: []
                        });
                      }
                    }
                  });

                  const items = Array.from(authorMap.values()).sort((a, b) => {
                    const hasStoryA = a.stories.length > 0;
                    const hasStoryB = b.stories.length > 0;
                    if (hasStoryA && !hasStoryB) return -1;
                    if (!hasStoryA && hasStoryB) return 1;
                    if (hasStoryA && hasStoryB) {
                      const isViewedA = !!viewedInboxStories[a.id];
                      const isViewedB = !!viewedInboxStories[b.id];
                      if (!isViewedA && isViewedB) return -1;
                      if (isViewedA && !isViewedB) return 1;
                    }
                    return 0;
                  });

                  return items.map((item) => {
                    const authorId = item.id;
                    const firstStory = item.stories[0];
                    const isViewed = !!viewedInboxStories[authorId as string];
                    const hasStory = !!firstStory;

                    const authorInfo = {
                      name: userDataCache[authorId]?.name || item.name,
                      avatar: userDataCache[authorId]?.avatar || item.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=random`,
                      statusNote: item.statusNote || userDataCache[authorId]?.statusNote,
                    };

                    return (
                      <div
                        key={authorId}
                        className="flex flex-col items-center flex-shrink-0 cursor-pointer pt-6 pb-1 relative"
                        onClick={() => {
                          if (hasStory) {
                            setViewingStory(firstStory);
                            const newViewed = {
                              ...viewedInboxStories,
                              [authorId as string]: true,
                            };
                            setViewedInboxStories(newViewed);
                            localStorage.setItem(
                              "viewedInboxStories",
                              JSON.stringify(newViewed),
                            );
                          } else {
                            // Find conversation and open chat
                            const conv = conversations.find(
                              (c) =>
                                c.participantIds?.includes(
                                  authorId as string,
                                ) && c.participantIds?.length === 2,
                            );
                            if (conv) {
                              setActiveChat(conv.id);
                            } else if (currentUser) {
                              import("../services/chatService").then(async ({ createConversation }) => {
                                const newConvId = await createConversation(
                                  [currentUser.uid, authorId],
                                  {
                                    [currentUser.uid]: {
                                      name: currentUser.name || "User",
                                      avatar: currentUser.avatar || "",
                                    },
                                    [authorId]: {
                                      name: authorInfo.name || "User",
                                      avatar: authorInfo.avatar || "",
                                    },
                                  },
                                );
                                setActiveChat(newConvId);
                              }).catch(err => console.error(err));
                            }
                          }
                        }}
                      >
                        <div className="relative">
                          {/* Follower Note Bubble overlapping top */}
                          {authorInfo.statusNote && (
                            <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-white/80 backdrop-blur-md border border-white/80 shadow-xs rounded-full z-20 w-auto max-w-[96px]">
                              <span className="text-[10px] font-medium text-gray-800 leading-tight block text-center truncate max-w-[80px]">
                                {authorInfo.statusNote}
                              </span>
                              <div className="absolute -bottom-[3px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white/80 border-b border-r border-white/80 rotate-45"></div>
                            </div>
                          )}
                          <div
                            className={`w-[88px] h-[88px] rounded-full p-[2.5px] transition-all duration-300 active:scale-95 ${
                              hasStory
                                ? isViewed
                                  ? "bg-gray-300/80 opacity-60 border border-gray-200"
                                  : "bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600 shadow-xs ring-2 ring-rose-500/20"
                                : "bg-gray-200/60 border border-gray-100"
                            }`}
                          >
                            <div className="w-full h-full rounded-full border-[2.5px] border-white overflow-hidden bg-gray-100 relative">
                              <img
                                src={authorInfo.avatar}
                                alt={authorInfo.name}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          </div>
                        </div>
                        <span className="text-[12px] font-normal [font-weight:400] text-gray-900 mt-1.5 truncate w-[88px] text-center">
                          {authorInfo.name.split(" ")[0]}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Contacts List */}
          <div className="pt-0.5">
            {!searchQuery.trim() && (
              <>
                {/* Followers Option Row - Friend List Item Style */}
                <div
                  onClick={() => {
                    setLastCheckedFollowers(followers.length);
                    setActiveChat("followers");
                  }}
                  className="flex items-center justify-between px-3.5 py-1.5 cursor-pointer hover:bg-white/50 active:bg-gray-100/60 transition-colors group"
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="relative flex-shrink-0">
                      <div className="w-[54px] h-[54px] rounded-full bg-gradient-to-tr from-[#0095F6] via-sky-500 to-cyan-400 flex items-center justify-center border-2 border-white shadow-xs group-hover:scale-105 transition-transform">
                        <Users className="w-6 h-6 text-white" strokeWidth={2.2} />
                      </div>
                    </div>
                    <div className="flex flex-col min-w-0 pr-2 space-y-0 -mt-0.5 flex-1">
                      <h3 className="text-[14px] truncate tracking-tight leading-tight font-normal text-black group-hover:text-[#0095F6] transition-colors">
                        Followers
                      </h3>
                      <div className="flex items-center text-[12px] leading-tight pt-0.5">
                        <p className="truncate max-w-[200px] md:max-w-[260px] text-[12px] font-normal text-gray-400">
                          {followers.length === 1 ? "1 follower" : `${followers.length} followers`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-shrink-0 ml-2">
                    {followers.length > lastCheckedFollowers ? (
                      <div className="bg-[#FF2C55] text-white text-[11px] font-bold rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center shadow-xs">
                        {followers.length - lastCheckedFollowers > 5 ? "5+" : followers.length - lastCheckedFollowers}
                      </div>
                    ) : (
                      <span className="text-[12px] font-medium text-gray-400">
                        {followers.length > 0 ? followers.length : ""}
                      </span>
                    )}
                  </div>
                </div>

                {/* Activity Option Row - Friend List Item Style */}
                {(() => {
                  const actUnread = notifications.filter((n) => {
                    if (n.type === "follow") return false;
                    if (n.read || n.isRead) return false;
                    const nTime = (n.createdAt as any)?.toMillis
                      ? (n.createdAt as any).toMillis()
                      : (n.createdAt as any)?.seconds
                        ? (n.createdAt as any).seconds * 1000
                        : typeof n.createdAt === "number"
                          ? n.createdAt
                          : Date.now();
                    return nTime > (lastCheckedActivity || 0);
                  }).length;

                  const latestNotif = notifications[0];
                  let latestText = "Notifications & alerts";
                  if (latestNotif) {
                    const actorName = latestNotif.actorName || "User";
                    if (latestNotif.type === "like") {
                      latestText = `${actorName} liked your video/post.`;
                    } else if (latestNotif.type === "comment") {
                      latestText = `${actorName}: ${latestNotif.content || "commented on your video."}`;
                    } else if (latestNotif.type === "follow") {
                      latestText = `${actorName} started following you.`;
                    } else if (latestNotif.type === "mention") {
                      latestText = `${actorName} mentioned you.`;
                    } else if (latestNotif.type === "reply") {
                      latestText = `${actorName} replied: ${latestNotif.content || ""}`;
                    } else if (latestNotif.type === "comment_like") {
                      latestText = `${actorName} liked your comment.`;
                    } else if ((latestNotif.type as string) === "repost") {
                      latestText = `${actorName} reposted your video.`;
                    } else if (latestNotif.content) {
                      latestText = `${actorName}: ${latestNotif.content}`;
                    }
                  }

                  return (
                    <div
                      onClick={() => {
                        setNotifications((prev) =>
                          prev.map((n) => ({ ...n, read: true, isRead: true })),
                        );
                        setLastCheckedActivity(Date.now());
                        if (currentUser?.uid) {
                          import("../services/notificationService").then((m) =>
                            m.markAllRead(currentUser.uid),
                          );
                        }
                        setActiveChat("activity");
                      }}
                      className="flex items-center justify-between px-3.5 py-1.5 cursor-pointer hover:bg-white/50 active:bg-gray-100/60 transition-colors group"
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <div className="relative flex-shrink-0">
                          <div className="w-[54px] h-[54px] rounded-full bg-gradient-to-tr from-[#FF2C55] via-pink-500 to-rose-400 flex items-center justify-center border-2 border-white shadow-xs group-hover:scale-105 transition-transform">
                            <Sparkles className="w-6 h-6 fill-white stroke-white" strokeWidth={1.5} />
                          </div>
                        </div>
                        <div className="flex flex-col min-w-0 pr-2 space-y-0 -mt-0.5 flex-1">
                          <h3 className="text-[14px] truncate tracking-tight leading-tight font-normal text-black group-hover:text-[#FF2C55] transition-colors">
                            Activity
                          </h3>
                          <div className="flex items-center text-[12px] leading-tight pt-0.5">
                            <p className={`truncate max-w-[190px] md:max-w-[240px] text-[12px] ${actUnread > 0 ? "font-medium text-black" : "font-normal text-gray-400"}`}>
                              {latestText}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex-shrink-0 ml-2">
                        {actUnread > 0 ? (
                          <div className="bg-[#FF2C55] text-white text-[11px] font-bold rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center shadow-xs">
                            {actUnread > 5 ? "5+" : actUnread}
                          </div>
                        ) : (
                          <span className="text-[12px] font-medium text-gray-400">
                            {notifications.length > 0 ? notifications.length : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}

            {conversations.length === 0 ? (
              <FacebookMessageListSkeleton count={7} />
            ) : filteredConversations.length === 0 && searchQuery.trim() ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                No chats found for "{searchQuery}"
              </div>
            ) : (
              filteredConversations.map((conv, idx) => {
                if (conv.isMessageRequestsRow || conv.id === "message_requests_item") {
                  let reqTimeStr = "";
                  if (conv.lastMessageTime && conv.lastMessageTime > 0) {
                    const diff = Math.floor((Date.now() - conv.lastMessageTime) / 1000);
                    if (diff < 45) {
                      reqTimeStr = "Just now";
                    } else if (diff < 3600) {
                      const mins = Math.max(1, Math.floor(diff / 60));
                      reqTimeStr = `${mins}m ago`;
                    } else if (diff < 86400) {
                      const hours = Math.floor(diff / 3600);
                      reqTimeStr = `${hours}h ago`;
                    } else {
                      const days = Math.floor(diff / 86400);
                      reqTimeStr = `${days}d ago`;
                    }
                  }

                  return (
                    <div
                      key="message_requests_row"
                      onClick={() => {
                        setActiveChat("requests");
                      }}
                      className="flex items-center justify-between px-3.5 py-1.5 cursor-pointer hover:bg-white/50 active:bg-gray-100/60 transition-colors group"
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <div className="relative flex-shrink-0">
                          <div className="w-[54px] h-[54px] rounded-full bg-gradient-to-tr from-purple-600 via-indigo-500 to-blue-500 flex items-center justify-center border-2 border-white shadow-xs">
                            <MessageCircle className="w-6 h-6 text-white" strokeWidth={2.2} />
                          </div>
                        </div>
                        <div className="flex flex-col min-w-0 pr-2 space-y-0 -mt-0.5 flex-1">
                          <h3 className="text-[14px] truncate tracking-tight leading-tight font-normal text-black">
                            Message Requests
                          </h3>
                          <div className="flex items-center text-[12px] leading-tight pt-0.5">
                            <p className={`truncate max-w-[170px] md:max-w-[220px] text-[12px] ${pendingRequestsCount > 0 ? "font-semibold text-purple-600" : "font-normal text-gray-400"}`}>
                              {pendingRequestsCount > 0
                                ? `${pendingRequestsCount} new message request${pendingRequestsCount > 1 ? 's' : ''}`
                                : "0 pending requests"}
                            </p>
                            {reqTimeStr && (
                              <>
                                <span className="mx-1 text-[11px] text-gray-400 font-normal">·</span>
                                <span className="whitespace-nowrap text-[11px] font-normal text-gray-400">
                                  {reqTimeStr}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex-shrink-0 ml-2">
                        {pendingRequestsCount > 0 && (
                          <div className="bg-purple-600 text-white text-[11px] font-bold rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center shadow-xs">
                            {pendingRequestsCount > 9 ? "9+" : pendingRequestsCount}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                const isJarvis = conv.id === "jarvis";
                const isGroup =
                  !isJarvis && (
                    (conv as any).isGroup ||
                    !!(conv as any).groupName ||
                    (conv.participantIds ? conv.participantIds.length > 2 : false)
                  );
                const otherId = isJarvis
                  ? "jarvis"
                  : isGroup
                  ? undefined
                  : conv.participantIds?.find((id) => id !== currentUser?.uid);
                const name = isJarvis
                  ? "Ennvo Jarvis"
                  : isGroup
                  ? (conv as any).groupName || "Group Chat"
                  : userDataCache[otherId || ""]?.name ||
                    (conv.participantNames || {})[otherId || ""] ||
                    "User";
                const rawAvatar = isJarvis
                  ? "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80"
                  : isGroup
                  ? (conv as any).groupAvatar
                  : userDataCache[otherId || ""]?.avatar ||
                    (conv.participantAvatars || {})[otherId || ""];

                const avatar = isJarvis 
                  ? rawAvatar
                  : (rawAvatar && rawAvatar.trim().length > 0 && !rawAvatar.includes('ui-avatars.com'))
                  ? rawAvatar
                  : `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(name)}&backgroundColor=f1f5f9`;
                const unreadMessages =
                  conv.id === activeChat || isJarvis
                    ? 0
                    : currentUser &&
                      conv.unreadCount &&
                      conv.unreadCount[currentUser.uid]
                    ? conv.unreadCount[currentUser.uid]
                    : 0;

                const isUnread = typeof unreadMessages === "number" && unreadMessages > 0;

                let timeStr = "";
                let lastMsgDate: Date | null = null;
                const rawTime =
                  conv.lastMessageTime ||
                  (typeof conv.updatedAt?.toMillis === "function"
                    ? conv.updatedAt.toMillis()
                    : typeof conv.updatedAt === "number"
                    ? conv.updatedAt
                    : typeof conv.createdAt?.toMillis === "function"
                    ? conv.createdAt.toMillis()
                    : typeof conv.createdAt === "number"
                    ? conv.createdAt
                    : null);

                if (rawTime) {
                  lastMsgDate =
                    typeof (rawTime as any)?.toDate === "function"
                      ? (rawTime as any).toDate()
                      : (rawTime instanceof Date ? rawTime : new Date(rawTime));
                  if (lastMsgDate && !isNaN(lastMsgDate.getTime()) && lastMsgDate.getTime() > 0) {
                    const diff = Math.floor(
                      (Date.now() - lastMsgDate.getTime()) / 1000,
                    );
                    if (diff < 45) {
                      timeStr = "Just now";
                    } else if (diff < 3600) {
                      const mins = Math.max(1, Math.floor(diff / 60));
                      timeStr = `${mins} min ago`;
                    } else if (diff < 86400) {
                      const hours = Math.floor(diff / 3600);
                      timeStr = `${hours} hour${hours > 1 ? "s" : ""} ago`;
                    } else if (diff < 2592000) {
                      const days = Math.floor(diff / 86400);
                      timeStr = `${days} day${days > 1 ? "s" : ""} ago`;
                    } else {
                      const months = Math.floor(diff / 2592000);
                      timeStr = `${months} month${months > 1 ? "s" : ""} ago`;
                    }
                  }
                }

                const isOlderThan5Days = !!(
                  lastMsgDate &&
                  !isNaN(lastMsgDate.getTime()) &&
                  lastMsgDate.getTime() > 0 &&
                  Date.now() - lastMsgDate.getTime() > 5 * 24 * 60 * 60 * 1000
                );

                const hasStory =
                  otherId && otherId !== "jarvis" && inboxStories.some((s) => s.authorId === otherId);

                const otherMembers = isGroup
                  ? conv.participantIds.filter((id) => id !== currentUser?.uid)
                  : [];

                return (
                  <React.Fragment key={conv.id}>
                    <div
                      onClick={(e) => {
                        if (longPressedRef.current) {
                          e.preventDefault();
                          e.stopPropagation();
                          return;
                        }
                        if (
                          document.querySelector(
                            ".fixed.bg-white.rounded-2xl.shadow-2xl.border.border-gray-100.py-2.w-48.z-50",
                          )
                        )
                          return;
                        setActiveChat(conv.id);
                      }}
                      onContextMenu={(e) => {
                        if (isJarvis) return;
                        e.preventDefault();
                        setChatContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          convId: conv.id,
                          otherUid: !isGroup ? otherId : undefined,
                        });
                      }}
                      onTouchStart={(e) =>
                        !isJarvis &&
                        handleChatTouchStart(
                          e,
                          conv.id,
                          !isGroup ? otherId : undefined,
                        )
                      }
                      onTouchEnd={handleChatTouchEnd}
                      onTouchMove={handleChatTouchEnd}
                      onMouseDown={(e) =>
                        !isJarvis &&
                        handleChatTouchStart(
                          e,
                          conv.id,
                          !isGroup ? otherId : undefined,
                        )
                      }
                      onMouseUp={handleChatTouchEnd}
                      onMouseMove={handleChatTouchEnd}
                      className="flex items-center justify-between px-3.5 py-1.5 cursor-pointer hover:bg-white/50 active:bg-gray-100/60 transition-colors group"
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <div
                          className="relative flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isJarvis) {
                              setActiveChat("jarvis");
                            } else if (isGroup) {
                              setActiveChat(conv.id);
                              setShowChatSettings(true);
                            } else {
                              setViewingUser({
                                uid: otherId || "",
                                name,
                                avatar: avatar as string,
                              });
                              pushPage("profile");
                            }
                          }}
                        >
                          {isGroup && !avatar ? (
                            <div className="group-hover:opacity-90 transition-opacity">
                              <GroupAvatar
                                members={otherMembers
                                  .slice(0, 3)
                                  .map(
                                    (id) =>
                                      userDataCache[id]?.avatar ||
                                      (conv.participantAvatars || {})[id] ||
                                      `https://ui-avatars.com/api/?name=${encodeURIComponent(userDataCache[id]?.name || (conv.participantNames || {})[id] || "User")}&background=random`,
                                  )}
                                sizeClass="w-[54px] h-[54px]"
                              />
                            </div>
                          ) : (
                            <div className={`rounded-full p-[2px] transition-all shrink-0 ${hasStory ? "bg-gradient-to-tr from-[#20D5EC] via-pink-500 to-yellow-400" : isJarvis ? "bg-gradient-to-tr from-purple-600 via-pink-500 to-cyan-400" : "bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500"}`}>
                              <img
                                src={avatar as string}
                                alt={name}
                                loading="lazy"
                                className="w-[54px] h-[54px] rounded-full object-cover group-hover:opacity-90 transition-opacity border-2 border-white"
                                referrerPolicy="no-referrer"
                              />
                              {isJarvis && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-gradient-to-tr from-purple-600 to-pink-500 border-2 border-white rounded-full flex items-center justify-center shadow-xs">
                                  <Sparkles className="w-2.5 h-2.5 text-white fill-white" />
                                </div>
                              )}
                              {!isJarvis && otherId && (presenceData[otherId]?.isOnline || (presenceData[otherId] as any)?.state === "online") && (
                                <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-[#22c55e] border-2 border-white rounded-full"></div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0 pr-2 space-y-0 -mt-0.5 flex-1">
                          <h3 className="text-[14px] truncate tracking-tight leading-tight font-normal text-black">
                            {name}
                          </h3>
                        <div className="flex items-center text-[12px] leading-tight pt-0.5">
                          {isOlderThan5Days ? (
                            <p className="truncate max-w-[170px] md:max-w-[220px] text-[12px] text-gray-400 font-normal">
                              {timeStr}
                            </p>
                          ) : isUnread ? (
                            unreadMessages >= 2 ? (
                              <>
                                <p className="truncate max-w-[150px] md:max-w-[200px] text-[12px] font-semibold text-black">
                                  {unreadMessages > 5
                                    ? "5+ new messages"
                                    : `${unreadMessages} new messages`}
                                </p>
                                <span className="mx-1 text-[11px] text-gray-400 font-normal">·</span>
                                <span className="whitespace-nowrap text-[11px] font-normal text-gray-400">
                                  {timeStr}
                                </span>
                              </>
                            ) : (
                              <>
                                <p className="truncate max-w-[150px] md:max-w-[200px] text-[12px] font-semibold text-black">
                                  {conv.lastMessage || "Sent a message"}
                                </p>
                                <span className="mx-1 text-[11px] text-gray-400 font-normal">·</span>
                                <span className="whitespace-nowrap text-[11px] font-normal text-gray-400">
                                  {timeStr}
                                </span>
                              </>
                            )
                          ) : (conv as any).lastSenderId === currentUser?.uid ? (() => {
                            const isSeenByOther = otherId && conv.unreadCount && conv.unreadCount[otherId] === 0;
                            return (
                              <p className="truncate max-w-[170px] md:max-w-[220px] text-[12px] text-gray-400 font-normal">
                                {isSeenByOther ? `Seen · ${timeStr}` : `Sent ${timeStr}`}
                              </p>
                            );
                          })() : (
                            <>
                              <p className="truncate max-w-[150px] md:max-w-[200px] text-[12px] text-gray-400 font-normal">
                                {conv.lastMessage || "Sent a message"}
                              </p>
                              <span className="mx-1 text-[11px] text-gray-400 font-normal">·</span>
                              <span className="whitespace-nowrap text-[11px] font-normal text-gray-400">
                                {timeStr}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex-shrink-0 ml-2">
                      {typeof unreadMessages === "number" &&
                      unreadMessages > 0 ? (
                        <div className="bg-[#FF3366] text-white text-[11px] font-bold rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center shadow-xs">
                          {unreadMessages > 5 ? "5+" : unreadMessages}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
          </div>
          </div>
        </PullToRefresh>
      </div>

      {/* Right Chat Area */}
      <AnimatePresence>
        {activeChat ? (
          isSpecialChat ? (
            <motion.div
              key="special"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[100] md:relative md:z-auto flex-1 flex flex-col h-full bg-white will-change-opacity"
            >
              <div className="min-h-[88px] md:min-h-[72px] px-4 pt-8 md:pt-0 pb-2 md:pb-0 border-b border-gray-100 flex items-center space-x-4 bg-white/90 backdrop-blur-md sticky top-0 z-20">
                <button
                  className="md:hidden p-2 -ml-2 hover:bg-black/5 rounded-full"
                  onClick={() => setActiveChat(null)}
                >
                  <ArrowLeft className="w-6 h-6 text-gray-900" />
                </button>
                <h2 className="font-normal text-[16px] leading-tight text-gray-900">
                  {activeChat === "followers"
                    ? "New followers"
                    : activeChat === "requests"
                    ? "Message requests"
                    : "Activity"}
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto p-2 md:p-4">
                {activeChat === "followers" ? (
                  <div className="space-y-0">
                    {followers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4 py-20">
                        <UserPlus className="w-16 h-16 text-gray-200" />
                        <p className="font-normal text-lg">
                          No new followers yet
                        </p>
                      </div>
                    ) : (
                      followers
                        .slice(0, 50)
                        .map((f: any) => (
                          <FollowerItem
                            key={f.id}
                            follower={f}
                            currentUser={currentUser}
                            onFollowBack={handleFollowBack}
                          />
                        ))
                    )}
                  </div>
                ) : activeChat === "requests" ? (
                  <div className="max-w-2xl mx-auto space-y-3 p-1">
                    <div className="p-3.5 bg-purple-50/60 border border-purple-100 rounded-2xl text-[12.5px] text-purple-900/80 leading-relaxed">
                      Open a message request to see what was sent. The sender won&apos;t know you&apos;ve seen it until you accept. You can choose to accept or block their messages.
                    </div>
                    {pendingRequests.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-3 py-20 text-center">
                        <div className="w-14 h-14 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center shadow-xs">
                          <MessageCircle className="w-7 h-7" />
                        </div>
                        <p className="font-semibold text-[16px] text-gray-900">No message requests</p>
                        <p className="text-[13px] text-gray-400 max-w-xs">
                          You have no pending message requests right now.
                        </p>
                      </div>
                    ) : (
                      pendingRequests.map((req: any) => {
                        const otherId = req.participantIds?.find((id: string) => id !== currentUser?.uid);
                        const otherName = (req.participantNames || {})[otherId || ""] || userDataCache[otherId || ""]?.name || "User";
                        const otherAvatar = (req.participantAvatars || {})[otherId || ""] || userDataCache[otherId || ""]?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherName)}&background=random`;
                        const count = req.requestMessageCount || 1;
                        return (
                          <div
                            key={req.id}
                            onClick={() => setActiveChat(req.id)}
                            className="flex items-center justify-between p-3.5 rounded-2xl bg-white hover:bg-gray-50 border border-gray-100 transition-all cursor-pointer active:scale-[0.99] shadow-xs"
                          >
                            <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                              <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
                                <img src={otherAvatar} alt={otherName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="text-[14px] font-semibold text-gray-900 truncate">{otherName}</h4>
                                <p className="text-[12.5px] text-gray-500 truncate mt-0.5">{req.lastMessage || "Sent a message"}</p>
                                <div className="flex items-center space-x-2 mt-1">
                                  <span className="text-[11px] font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                                    {count} of 2 sent
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-1.5 shrink-0 pl-3">
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`Block ${otherName}? They won't be able to message you or find your profile.`)) {
                                    const { blockUser } = await import("../services/followService");
                                    const { declineConversationRequest } = await import("../services/chatService");
                                    if (currentUser?.uid && otherId) {
                                      await blockUser(currentUser.uid, otherId, { name: otherName, avatar: otherAvatar });
                                    }
                                    await declineConversationRequest(req.id);
                                  }
                                }}
                                className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-xl text-[12px] font-medium transition-colors"
                              >
                                Block
                              </button>
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const { acceptConversationRequest } = await import("../services/chatService");
                                  await acceptConversationRequest(req.id);
                                  setActiveChat(req.id);
                                }}
                                className="px-3.5 py-1.5 bg-gray-900 hover:bg-black text-white rounded-xl text-[12px] font-semibold transition-colors shadow-xs"
                              >
                                Accept
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <div
                    className="space-y-0 p-0"
                    onScroll={(e) => {
                      if (
                        e.currentTarget.scrollHeight -
                          e.currentTarget.scrollTop <=
                        e.currentTarget.clientHeight + 50
                      ) {
                        setActivityLimit((prev) => prev + 15);
                      }
                    }}
                  >
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-3 py-20">
                        <Bell className="w-14 h-14 text-gray-200 stroke-[1.5]" />
                        <p className="font-medium text-15px text-gray-500">No activity yet</p>
                      </div>
                    ) : (
                      notifications.slice(0, activityLimit || 15).map((n) => (
                        <div
                          key={n.id}
                          className="flex items-center space-x-3.5 px-3.5 py-2.5 hover:bg-gray-50/80 active:bg-gray-100/70 cursor-pointer transition-colors group relative"
                          onClick={() => {
                            if (n.postId && n.postMedia) {
                              const {
                                setHighlightedCommentId,
                                setHighlightedPostId,
                                setShowLikesList,
                                setTargetLikesPostId,
                                setViewingReel,
                                setViewingMedia,
                              } = useAppStore.getState();

                              if (n.type === "like") {
                                setTargetLikesPostId(n.postId);
                                setShowLikesList(true);
                              } else if (
                                n.type === "comment" ||
                                n.type === "reply" ||
                                n.type === "mention" ||
                                n.type === "comment_like"
                              ) {
                                setHighlightedCommentId(n.targetId);
                                setHighlightedPostId(n.postId);
                              }

                              const isReel =
                                n.postMedia.includes(".mp4") ||
                                n.postMedia.includes("video");
                              const postAuthor = {
                                name: n.postAuthorName || n.actorName,
                                avatar: n.postAuthorAvatar || n.actorAvatar,
                              };

                              if (isReel) {
                                import("../services/postService").then(({ getPost }) => {
                                  getPost(n.postId!).then((realPost) => {
                                    if (realPost) {
                                      setViewingReel({ ...realPost, single: true });
                                    } else {
                                      setViewingReel({
                                        id: n.postId,
                                        authorId: n.postAuthorId || "",
                                        authorName: postAuthor.name,
                                        authorAvatar: postAuthor.avatar,
                                        media: [n.postMedia!],
                                        text: "",
                                        type: "reel",
                                        likesCount: 0,
                                        commentsCount: 0,
                                        single: true,
                                      });
                                    }
                                  });
                                });
                              } else {
                                setViewingMedia({
                                  url: n.postMedia,
                                  type: "post",
                                  user: postAuthor,
                                });
                              }
                            } else {
                              setViewingUser({
                                uid: n.actorId,
                                name: n.actorName,
                                avatar: n.actorAvatar,
                              });
                              pushPage("profile");
                            }
                          }}
                        >
                          <div
                            className="relative flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingUser({
                                uid: n.actorId,
                                name: n.actorName,
                                avatar: n.actorAvatar,
                              });
                              pushPage("profile");
                            }}
                          >
                            <img
                              src={
                                n.actorAvatar ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(n.actorName || "User")}&background=random`
                              }
                              className="w-11 h-11 rounded-full object-cover border border-gray-100/80 shadow-2xs"
                              alt="actor"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 bg-white rounded-full flex items-center justify-center shadow-2xs border border-gray-100 scale-90">
                              {n.type === "like" && (
                                <Heart className="w-2.5 h-2.5 text-red-500 fill-red-500" />
                              )}
                              {n.type === "comment" && (
                                <MessageCircle className="w-2.5 h-2.5 text-blue-500 fill-blue-500" />
                              )}
                              {n.type === "follow" && (
                                <UserPlus className="w-2.5 h-2.5 text-purple-500" />
                              )}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 pr-1">
                            <p className="text-[13.5px] leading-snug">
                              <span className="font-medium text-gray-900 group-hover:underline">
                                {n.actorName || "User"}
                              </span>
                              <span className="text-gray-600 font-normal ml-1">
                                {n.type === "like" && "liked your post."}
                                {n.type === "comment" &&
                                  `commented: ${n.content}`}
                                {n.type === "follow" &&
                                  "started following you."}
                                {n.type === "mention" && "mentioned you."}
                                {n.type === "favorite" && "saved your post."}
                                {n.type === "reply" &&
                                  `replied to your comment: ${n.content}`}
                                {n.type === "comment_like" &&
                                  "liked your comment."}
                              </span>
                            </p>
                            <p className="text-[11px] text-gray-400 mt-0.5 font-normal tracking-tight">
                              {(() => {
                                const timestamp = n.createdAt;
                                if (!timestamp) return "Just now";
                                try {
                                  const date = timestamp?.toDate
                                    ? timestamp.toDate()
                                    : timestamp instanceof Date
                                      ? timestamp
                                      : new Date(timestamp);
                                  if (isNaN(date.getTime())) return "Just now";
                                  const now = new Date();
                                  const diff = Math.floor(
                                    (now.getTime() - date.getTime()) / 1000,
                                  );
                                  if (diff < 60) return "Just now";
                                  if (diff < 3600)
                                    return `${Math.floor(diff / 60)}m ago`;
                                  if (diff < 86400)
                                    return `${Math.floor(diff / 3600)}h ago`;
                                  return date.toLocaleDateString();
                                } catch (e) {
                                  return "Just now";
                                }
                              })()}
                            </p>
                          </div>
                          {n.postMedia && (
                            <div className="w-11 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100 shadow-2xs group-hover:scale-105 transition-transform bg-gray-900 relative">
                              {n.postMedia.includes(".mp4") ||
                              n.postMedia.includes("video") ? (
                                <div className="relative w-full h-full">
                                  <video
                                    src={`${n.postMedia}#t=0.001`}
                                    className="w-full h-full object-cover"
                                    preload="metadata"
                                    muted
                                    playsInline
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                    <Play className="w-3.5 h-3.5 text-white fill-white drop-shadow-xs" />
                                  </div>
                                </div>
                              ) : (
                                <img
                                  src={n.postMedia}
                                  className="w-full h-full object-cover"
                                  alt="thumb"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="regular"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="fixed inset-0 z-[100] md:relative md:z-auto flex-1 flex flex-col h-full overflow-hidden bg-white"
            >
              {/* Chat Background Layer - Ultra-fast GPU hardware layer with original bright, clean aesthetic */}
              {(() => {
                const isImage = 
                  activeConvTheme === 'bg-image' || 
                  activeConvTheme === '/chat-background.png' ||
                  activeConvTheme.startsWith('http') || 
                  activeConvTheme.startsWith('/') || 
                  activeConvTheme.startsWith('data:') ||
                  activeConvTheme.includes('.png') ||
                  activeConvTheme.includes('.jpg') ||
                  activeConvTheme.includes('.webp');

                const isDefaultWallpaper = 
                  !activeConvTheme || 
                  activeConvTheme === 'bg-image' || 
                  activeConvTheme === '/chat-background.png' || 
                  activeConvTheme === 'bg-white';

                if (isDefaultWallpaper) {
                  return (
                    <>
                      {/* Mobile: Original Crisp Clean Unzoomed Background Image (Pinned at top:0, never shifts on keyboard open) */}
                      <img
                        src="/chat-background.png"
                        alt=""
                        className="absolute top-0 left-0 right-0 w-full pointer-events-none z-0 select-none object-cover object-top md:hidden"
                        style={{ 
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          width: '100%',
                          height: `${unzoomedCssHeight}px`,
                          minHeight: `${unzoomedCssHeight}px`,
                          maxHeight: `${unzoomedCssHeight}px`,
                          objectFit: 'cover',
                          objectPosition: 'center top',
                          transform: 'translate3d(0, 0, 0)',
                          WebkitTransform: 'translate3d(0, 0, 0)',
                          backfaceVisibility: 'hidden',
                          pointerEvents: 'none'
                        }}
                      />

                      {/* Desktop/PC: Original Aesthetic Ambient Pastel Glow Background */}
                      <div 
                        className="hidden md:block absolute inset-0 pointer-events-none z-0 select-none overflow-hidden"
                        style={{
                          background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 35%, #faf5ff 70%, #fdf4ff 100%)',
                        }}
                      >
                        <div className="absolute -top-28 -right-28 w-[480px] h-[480px] rounded-full bg-gradient-to-br from-indigo-200/40 via-purple-200/30 to-pink-200/20 blur-3xl pointer-events-none" />
                        <div className="absolute top-1/2 -left-32 w-[420px] h-[420px] rounded-full bg-gradient-to-tr from-blue-200/35 via-cyan-100/25 to-purple-200/20 blur-3xl pointer-events-none" />
                        <div className="absolute -bottom-24 right-1/4 w-[440px] h-[440px] rounded-full bg-gradient-to-t from-purple-200/30 via-pink-100/30 to-amber-100/20 blur-3xl pointer-events-none" />
                        <div 
                          className="absolute inset-0 opacity-[0.04] pointer-events-none" 
                          style={{
                            backgroundImage: `radial-gradient(#4f46e5 1px, transparent 1px), radial-gradient(#9333ea 1px, #f8fafc 1px)`,
                            backgroundSize: '28px 28px',
                            backgroundPosition: '0 0, 14px 14px',
                          }}
                        />
                      </div>
                    </>
                  );
                }

                if (isImage) {
                  return (
                    <img
                      src={activeConvTheme}
                      alt="Wallpaper"
                      className="absolute top-0 left-0 right-0 w-full pointer-events-none z-0 select-none object-cover object-top"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        width: '100%',
                        height: `${unzoomedCssHeight}px`,
                        minHeight: `${unzoomedCssHeight}px`,
                        maxHeight: `${unzoomedCssHeight}px`,
                        objectFit: 'cover',
                        objectPosition: 'center top',
                        transform: 'translate3d(0, 0, 0)',
                        WebkitTransform: 'translate3d(0, 0, 0)',
                        backfaceVisibility: 'hidden',
                        pointerEvents: 'none'
                      }}
                    />
                  );
                }

                return (
                  <div
                    className={`absolute top-0 left-0 right-0 w-full ${activeConvTheme} z-0 pointer-events-none`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      width: '100%',
                      height: `${unzoomedCssHeight}px`,
                      minHeight: `${unzoomedCssHeight}px`,
                      maxHeight: `${unzoomedCssHeight}px`,
                      transform: 'translate3d(0, 0, 0)',
                      WebkitTransform: 'translate3d(0, 0, 0)',
                      pointerEvents: 'none'
                    }}
                  />
                );
              })()}

              {/* Chat Header (Floating iOS Liquid Glass Islands) */}
              <div
                className="absolute top-0 inset-x-0 z-30 pointer-events-none px-3 md:px-5 pt-3.5 sm:pt-4 md:pt-3.5 pb-2 flex items-center justify-between gap-2"
              >
                {/* Left: Friend Profile Island */}
                <div
                  className="pointer-events-auto flex items-center space-x-2 sm:space-x-2.5 cursor-pointer group min-w-0 ios-liquid-glass rounded-full pl-1.5 sm:pl-2 pr-3.5 sm:pr-4 py-1.5 transition-all hover:brightness-105 active:scale-[0.985] max-w-[calc(100%-145px)] sm:max-w-none"
                  onClick={() => setShowChatSettings(true)}
                >
                  <button
                    className="md:hidden p-1.5 -ml-0.5 hover:bg-black/5 active:scale-90 rounded-full transition-all text-gray-800 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveChat(null);
                    }}
                  >
                    <ArrowLeft
                      className="w-5 h-5 text-gray-800"
                      strokeWidth={2.4}
                    />
                  </button>
                  <div className="relative shrink-0">
                    {activeContact?.isGroup && !activeContact.avatar ? (
                      <div className="cursor-pointer group-hover:opacity-90 transition-opacity">
                        <GroupAvatar
                          members={
                            activeConversation?.participantIds
                              ?.filter((id) => id !== currentUser?.uid)
                              .slice(0, 3)
                              .map(
                                (id) =>
                                  userDataCache[id]?.avatar ||
                                  (activeConversation?.participantAvatars || {})[id] ||
                                  `https://ui-avatars.com/api/?name=${encodeURIComponent(userDataCache[id]?.name || (activeConversation?.participantNames || {})[id] || "User")}&background=random`,
                              ) || []
                          }
                          sizeClass="w-9 h-9 sm:w-10 sm:h-10"
                        />
                      </div>
                    ) : (
                      <img
                        src={activeContact?.avatar as string}
                        alt="Avatar"
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover group-hover:opacity-90 transition-opacity shadow-xs border border-white/90"
                      />
                    )}
                    {activeContact?.online && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full shadow-xs" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2
                      className="font-semibold text-[14px] sm:text-[15px] text-gray-900 truncate leading-tight tracking-tight"
                    >
                      {activeContact?.name}
                    </h2>
                    <p
                      className="text-[11.5px] font-medium text-emerald-600 truncate flex items-center gap-1 mt-0.5"
                    >
                      {activeContact?.online ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                          <span>Active now</span>
                        </>
                      ) : activeContact?.lastSeen ? (
                        <span className="text-gray-400 font-normal">Active {formatTime(activeContact.lastSeen)}</span>
                      ) : (
                        <span className="text-gray-400 font-normal">Offline</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Right: Actions Island */}
                <div className="pointer-events-auto flex items-center space-x-1.5 sm:space-x-2 shrink-0">
                  {activeChat === "jarvis" ? (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          const welcome = [{
                            id: "jarvis-welcome-1",
                            senderId: "jarvis",
                            type: "text",
                            content: `কিরে বন্ধু ${currentUser?.name ? currentUser.name : ""}! কী খবর তোর? আমি তোর বেস্ট ফ্রেন্ড এনভো জার্ভিস! আজকে কী করতে চাস বল?`,
                            createdAt: 0,
                            status: "sent"
                          }];
                          setJarvisMessages(welcome);
                          try { localStorage.setItem("jarvis_chat_history", JSON.stringify(welcome)); } catch(e){}
                        }}
                        className="px-3.5 py-1.5 ios-liquid-glass hover:brightness-105 text-purple-700 text-xs font-semibold rounded-full transition-all active:scale-95"
                      >
                        Reset Chat
                      </button>
                    </div>
                  ) : activeContact && !activeContact.isGroup && (
                    <>
                      <button
                        onClick={() => handleStartCall('audio')}
                        title="Audio Call"
                        className="w-9 h-9 sm:w-10 sm:h-10 ios-liquid-glass-button hover:brightness-105 active:scale-90 rounded-full transition-all text-[#007AFF] flex items-center justify-center"
                      >
                        <Phone className="w-4.5 h-4.5" strokeWidth={2.4} />
                      </button>
                      <button
                        onClick={() => handleStartCall('video')}
                        title="Video Call"
                        className="w-9 h-9 sm:w-10 sm:h-10 ios-liquid-glass-button hover:brightness-105 active:scale-90 rounded-full transition-all text-[#007AFF] flex items-center justify-center"
                      >
                        <Video className="w-4.5 h-4.5" strokeWidth={2.4} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setShowChatSettings(true)}
                    title="Chat Details"
                    className="w-9 h-9 sm:w-10 sm:h-10 ios-liquid-glass-button hover:brightness-105 active:scale-90 rounded-full transition-all text-gray-700 flex items-center justify-center"
                  >
                    <Info
                      className="w-4.5 h-4.5 text-gray-700"
                      strokeWidth={2.4}
                    />
                  </button>
                </div>
              </div>

              {/* Messages & Floating Input Overlay Container */}
              <div className="flex-1 relative w-full h-full overflow-hidden">
                {/* Messages Area - Full container height overlay so bubbles scroll underneath header islands and input box */}
                <div
                  ref={messagesContainerRef}
                  className="absolute inset-0 overflow-y-auto px-4 pt-[68px] sm:pt-[72px] md:pt-[68px] space-y-0.5 scrollbar-hide flex flex-col justify-start z-10 overscroll-contain transform-gpu [webkit-overflow-scrolling:touch] transition-[padding-bottom] duration-150 ease-out"
                  style={{ paddingBottom: `${(showStickerModal ? 420 : 110) + (viewportBottomOffset > 0 ? viewportBottomOffset : 0)}px` }}
                  onScroll={(e) => {
                    if (e.currentTarget.scrollTop < 20) {
                      setMessageLimit((prev: number) => prev + 20);
                    }
                    // Update auto-scroll ref based on regular scrolling
                    const { scrollTop, scrollHeight, clientHeight } =
                      e.currentTarget;
                    shouldAutoScrollRef.current =
                      scrollHeight - scrollTop - clientHeight < 200;
                  }}
                >
                  <div className="flex flex-col items-center justify-center py-8">
                    <img
                      src={activeContact?.avatar}
                      className="w-24 h-24 rounded-full object-cover shadow-md mb-4 cursor-pointer hover:opacity-80 transition-opacity"
                      alt="Profile"
                      onClick={() => {
                        if (activeContact?.uid) {
                          setViewingUser({
                            uid: activeContact.uid,
                            name: activeContact.name,
                            avatar: activeContact.avatar,
                          });
                          pushPage("profile");
                        }
                      }}
                    />
                    <h2
                      className={`text-xl font-normal cursor-pointer hover:underline ${chatTheme === "bg-white" ? "text-gray-900" : "text-gray-900"}`}
                      onClick={() => {
                        if (activeContact?.isGroup) {
                          setShowChatSettings(true);
                        } else if (activeContact?.uid) {
                          setViewingUser({
                            uid: activeContact.uid,
                            name: activeContact.name,
                            avatar: activeContact.avatar,
                          });
                          pushPage("profile");
                        }
                      }}
                    >
                      {activeContact?.name}
                    </h2>
                    {!activeContact?.isGroup && (
                      <button
                        onClick={() => {
                          if (activeContact?.uid) {
                            setViewingUser({
                              uid: activeContact.uid,
                              name: activeContact.name,
                              avatar: activeContact.avatar,
                            });
                            pushPage("profile");
                          }
                        }}
                        className="mt-4 bg-black/5 hover:bg-black/10 text-gray-900 font-normal px-4 py-1.5 rounded-lg transition-colors text-sm"
                      >
                        View Profile
                      </button>
                    )}
                  </div>

                  {renderedMessages}

                  {(typingUsers.length > 0 || isJarvisTyping) && (
                    <div className="flex items-center justify-start mt-2.5 mb-1 animate-in fade-in slide-in-from-bottom-2 duration-150">
                      <img
                        src={
                          activeChat === "jarvis"
                            ? "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80"
                            : activeContact?.isGroup
                            ? ((activeConversation as any)?.participantAvatars ||
                                {})[typingUsers[0]] ||
                              userDataCache[typingUsers[0]]?.avatar ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(((activeConversation as any)?.participantNames || {})[typingUsers[0]] || userDataCache[typingUsers[0]]?.name || "User")}&background=random`
                            : activeContact?.avatar
                        }
                        className="w-7 h-7 rounded-full mr-2 self-end mb-0.5 object-cover shadow-xs border border-white/90"
                        alt="Avatar"
                      />
                      <div
                        className="px-3.5 py-2.5 rounded-[18px] rounded-bl-[4px] flex items-center space-x-1.5 ios-liquid-glass"
                      >
                        <div className="w-2 h-2 bg-purple-600/80 rounded-full ios-typing-dot-1" />
                        <div className="w-2 h-2 bg-purple-600/80 rounded-full ios-typing-dot-2" />
                        <div className="w-2 h-2 bg-purple-600/80 rounded-full ios-typing-dot-3" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Floating Input Area */}
                <div
                  className={`absolute inset-x-0 z-30 pb-3 md:pb-4 pt-2 px-3 md:px-6 w-full flex flex-col justify-end pointer-events-none bg-gradient-to-t from-black/[0.02] via-transparent to-transparent transform-gpu ${
                    showStickerModal ? 'bottom-[340px] md:bottom-[360px]' : 'bottom-0'
                  }`}
                  style={{
                    transform: viewportBottomOffset > 0 ? `translate3d(0, -${viewportBottomOffset}px, 0)` : 'translate3d(0, 0, 0)',
                    transition: 'transform 0.26s cubic-bezier(0.33, 1, 0.68, 1), bottom 0.26s cubic-bezier(0.33, 1, 0.68, 1)',
                    willChange: 'transform, bottom'
                  }}
                >
                {/* Smart Sticker Suggestions (shown above input bar when typing keywords/emojis) */}
                {stickerSuggestions.length > 0 && !isRecording && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.18 }}
                    className="pointer-events-auto flex items-center space-x-3 px-3.5 py-2 mx-auto mb-2 max-w-3xl w-full ultra-glass-reply-box overflow-x-auto no-scrollbar shadow-lg rounded-2xl border border-white/90 bg-white/80 backdrop-blur-xl"
                  >
                    <div className="flex items-center space-x-3 py-0.5">
                      {stickerSuggestions.map((stk) => (
                        <button
                          key={stk.id}
                          type="button"
                          onClick={() => handleSendStickerDirect(stk.url, stk.type)}
                          className="shrink-0 p-1.5 bg-white/90 hover:bg-white active:scale-95 rounded-2xl border border-white/90 shadow-xs hover:shadow-md transition-all flex items-center justify-center group"
                          title={`Send "${stk.name}"`}
                        >
                          {stk.type === "video" ? (
                            <video
                              src={stk.url}
                              autoPlay
                              loop
                              muted
                              playsInline
                              className="w-13 h-13 md:w-15 md:h-15 object-contain rounded-xl pointer-events-none"
                            />
                          ) : (
                            <img
                              src={stk.url}
                              alt={stk.name}
                              referrerPolicy="no-referrer"
                              className="w-13 h-13 md:w-15 md:h-15 object-contain pointer-events-none group-hover:scale-110 transition-transform"
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {selectedMediaItems.length > 0 && (
                  <div className="pointer-events-auto flex flex-col bg-white/95 backdrop-blur-xl border border-gray-200/90 rounded-2xl p-2.5 mx-auto mb-2 max-w-3xl w-full shadow-lg relative transition-all">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100 px-0.5">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[12px] font-semibold text-gray-900">
                          {selectedMediaItems.length} {selectedMediaItems.length === 1 ? 'item' : 'items'} selected
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-700 font-medium rounded-full border border-purple-200/60">
                          Ultra HD
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedMediaItems([])}
                        className="text-[11px] font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                      >
                        Clear all
                      </button>
                    </div>
                    <div className="flex items-center space-x-2 pt-2 overflow-x-auto no-scrollbar">
                      {selectedMediaItems.map((item, idx) => (
                        <div key={item.id || idx} className="relative group shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-gray-200 shadow-2xs bg-black">
                          {item.type === "video" ? (
                            <video
                              src={item.url}
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                            />
                          ) : (
                            <img src={item.url} className="w-full h-full object-cover" alt={`Selected ${idx}`} />
                          )}
                          {item.type === "video" && (
                            <div className="absolute bottom-1 left-1 p-0.5 bg-black/60 rounded text-white text-[9px] font-semibold flex items-center">
                              <Play className="w-2.5 h-2.5 fill-white" />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedMediaItems((prev) => prev.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-black active:scale-90 text-white rounded-full transition-all shadow-xs cursor-pointer"
                            title="Remove"
                          >
                            <X className="w-3 h-3 stroke-[2.5]" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="shrink-0 w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 hover:border-purple-400 hover:bg-purple-50/30 flex flex-col items-center justify-center text-gray-400 hover:text-purple-600 transition-all cursor-pointer"
                        title="Add more photos or videos"
                      >
                        <Plus className="w-4 h-4 stroke-[2.2]" />
                        <span className="text-[10px] font-medium mt-0.5">Add</span>
                      </button>
                    </div>
                  </div>
                )}

                {replyingTo && (
                  <div className="pointer-events-auto flex items-center justify-between ultra-glass-reply-box px-3.5 py-2 mx-auto mb-2 max-w-3xl w-full relative overflow-hidden transition-all rounded-2xl shadow-sm border border-purple-100/60 bg-white/90 backdrop-blur-xl">
                    <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-purple-600 rounded-r-full"></div>
                    <div className="flex-1 min-w-0 pl-2.5 flex items-center space-x-2.5">
                      {/* Photo Preview */}
                      {(replyingTo.type === "image" || replyingTo.mediaUrl) && replyingTo.type !== "sticker" && replyingTo.type !== "reel" && replyingTo.type !== "voice" && (
                        <div className="w-8 h-8 rounded-lg shrink-0 overflow-hidden bg-gray-100 border border-gray-200/80 shadow-2xs">
                          <img src={replyingTo.mediaUrl} className="w-full h-full object-cover" alt="Photo preview" referrerPolicy="no-referrer" />
                        </div>
                      )}
                      {/* Sticker Preview */}
                      {(replyingTo.type === "sticker" || replyingTo.stickerUrl) && (
                        <div className="w-8 h-8 shrink-0 flex items-center justify-center p-0.5">
                          {replyingTo.stickerType === "video" ? (
                            <video src={replyingTo.stickerUrl || replyingTo.mediaUrl} autoPlay loop muted playsInline className="w-full h-full object-contain rounded" />
                          ) : (
                            <img src={replyingTo.stickerUrl || replyingTo.mediaUrl} className="w-full h-full object-contain" alt="Sticker preview" referrerPolicy="no-referrer" />
                          )}
                        </div>
                      )}
                      {/* Reel Preview */}
                      {replyingTo.type === "reel" && replyingTo.mediaUrl && (
                        <div className="w-7 h-9 rounded-md shrink-0 overflow-hidden bg-gray-900 border border-gray-200/80 shadow-2xs relative">
                          <video src={`${replyingTo.mediaUrl}#t=0.001`} className="w-full h-full object-cover" preload="metadata" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <Video className="w-3 h-3 text-white fill-white" />
                          </div>
                        </div>
                      )}
                      {/* Voice Preview */}
                      {replyingTo.type === "voice" && (
                        <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 shrink-0 flex items-center justify-center border border-rose-200/60 shadow-2xs">
                          <Mic className="w-4 h-4" />
                        </div>
                      )}

                      <div className="flex flex-col justify-center min-w-0">
                        <span className="text-[11px] font-semibold text-purple-600 tracking-tight leading-none">
                          Replying to{" "}
                          {replyingTo.senderId === currentUser?.uid
                            ? "yourself"
                            : activeContact?.name}
                        </span>
                        <p className="text-[12.5px] font-medium text-gray-800 truncate leading-tight mt-0.5">
                          {replyingTo.content ||
                            (replyingTo.type === "sticker" || replyingTo.stickerUrl
                              ? "Sticker"
                              : replyingTo.type === "image"
                              ? "Photo"
                              : replyingTo.type === "voice"
                              ? "Voice message"
                              : replyingTo.type === "reel"
                              ? "Reel"
                              : "Message")}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      className="p-1.5 hover:bg-gray-200/60 active:scale-90 rounded-full transition-all shrink-0 text-gray-400 hover:text-gray-700 ml-2"
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </button>
                  </div>
                )}

                {/* Incoming Request Acceptance Panel */}
                {Boolean(
                  activeConversation?.isRequest &&
                  activeConversation?.requestStatus === "pending" &&
                  (activeConversation?.requestTo === currentUser?.uid || (!activeConversation?.requestTo && activeConversation?.requestFrom !== currentUser?.uid))
                ) ? (
                  <div className="pointer-events-auto w-full max-w-xl mx-auto bg-white/95 backdrop-blur-md border border-gray-200/90 rounded-3xl p-4 shadow-lg flex flex-col items-center space-y-3 mb-2 transform-gpu">
                    <p className="text-[13.5px] text-gray-700 text-center leading-relaxed font-normal">
                      Do you want to allow <span className="font-semibold text-gray-900">{activeContact?.name}</span> to message you? They won&apos;t know you&apos;ve seen it until you accept.
                    </p>
                    <div className="flex items-center space-x-2.5 w-full max-w-sm justify-center pt-0.5">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!activeConversation || !otherParticipantId) return;
                          if (window.confirm(`Block ${activeContact?.name}? They won't be able to message you or find your profile.`)) {
                            const { blockUser } = await import("../services/followService");
                            const { declineConversationRequest } = await import("../services/chatService");
                            if (currentUser?.uid && otherParticipantId) {
                              await blockUser(currentUser.uid, otherParticipantId, {
                                name: activeContact?.name,
                                avatar: activeContact?.avatar
                              });
                            }
                            await declineConversationRequest(activeConversation.id);
                            setActiveChat(null);
                          }
                        }}
                        className="flex-1 py-2 px-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-[13px] font-semibold transition-all text-center active:scale-95 cursor-pointer"
                      >
                        Block
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!activeConversation) return;
                          const { declineConversationRequest } = await import("../services/chatService");
                          await declineConversationRequest(activeConversation.id);
                          setActiveChat(null);
                        }}
                        className="flex-1 py-2 px-3 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 text-[13px] font-semibold transition-all text-center active:scale-95 cursor-pointer"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!activeConversation) return;
                          const { acceptConversationRequest } = await import("../services/chatService");
                          await acceptConversationRequest(activeConversation.id);
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-gray-900 hover:bg-black text-white text-[13px] font-semibold transition-all text-center shadow-xs active:scale-95 cursor-pointer"
                      >
                        Accept
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {Boolean(
                      activeConversation?.isRequest &&
                      activeConversation?.requestStatus === "pending" &&
                      activeConversation?.requestFrom === currentUser?.uid
                    ) && (
                      <div className="pointer-events-auto max-w-md mx-auto mb-2 px-3.5 py-1.5 bg-purple-50/90 border border-purple-200/80 rounded-2xl text-center shadow-xs">
                        <p className="text-[12px] font-medium text-purple-900">
                          {(activeConversation.requestMessageCount || 0) >= 2
                            ? "Waiting for recipient to accept your message request (2 of 2 messages sent)"
                            : `Message request · You can send up to 2 messages (${activeConversation.requestMessageCount || 0}/2 sent)`}
                        </p>
                      </div>
                    )}

                    <form
                      onSubmit={handleSend}
                      className="pointer-events-auto flex items-end space-x-1.5 w-full max-w-3xl mx-auto ultra-glass-chat-container px-3 py-1.5 transform-gpu"
                    >
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-black bg-white/20 hover:bg-white/40 active:scale-90 rounded-2xl transition-all shrink-0 mb-0.5 border border-white/40 shadow-2xs flex items-center justify-center backdrop-blur-md"
                        title="Attach Photo or Video"
                      >
                        <Plus className="w-5 h-5 stroke-[2.4] text-black" />
                      </button>
                      <input
                        type="file"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleImageSelect}
                        accept="image/*,video/*"
                        multiple
                      />

                      {isRecording ? (
                        <div className="flex-1 flex items-center justify-between bg-red-50/80 backdrop-blur-md border border-red-200/90 rounded-2xl px-3 py-1.5 mr-1 my-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-red-600 text-[13px] font-mono font-semibold tabular-nums">
                              {Math.floor(recordingDuration / 60)}:
                              {(recordingDuration % 60).toString().padStart(2, "0")}
                            </span>
                            <div className="flex items-center space-x-0.5 ml-1">
                              <div className="w-1 h-3 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <div className="w-1 h-4 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <div className="w-1 h-2 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={cancelRecording}
                              className="flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-red-100 border border-red-200 text-red-600 rounded-full text-xs font-medium transition-colors active:scale-95 shadow-2xs"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              <span>Cancel</span>
                            </button>
                            <button
                              type="button"
                              onClick={stopRecording}
                              className="p-2 bg-red-500 hover:bg-red-600 active:scale-90 text-white rounded-full transition-transform shadow-xs flex items-center justify-center"
                              title="Send Voice Message"
                            >
                              <Send className="w-4 h-4" strokeWidth={2.2} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <textarea
                          ref={textareaRef}
                          rows={1}
                          value={inputText}
                          onChange={(e) => {
                            handleTyping(e);
                            e.target.style.height = 'auto';
                            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                          }}
                          onFocus={() => {
                            if (messagesContainerRef.current) {
                              requestAnimationFrame(() => {
                                if (messagesContainerRef.current) {
                                  messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
                                }
                              });
                            }
                          }}
                          onTouchStart={() => {
                            if (messagesContainerRef.current) {
                              requestAnimationFrame(() => {
                                if (messagesContainerRef.current) {
                                  messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
                                }
                              });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSend(e as any);
                              e.currentTarget.style.height = 'auto';
                            }
                          }}
                          placeholder="Message..."
                          className="flex-1 bg-transparent py-2 px-1.5 focus:outline-none focus:ring-0 focus:border-transparent text-[15px] font-normal text-black placeholder:text-black placeholder:font-normal min-w-0 resize-none max-h-[120px] overflow-y-auto no-scrollbar leading-snug"
                        />
                      )}

                      {!isRecording && (
                        <div className="flex items-center space-x-1.5 shrink-0 mb-0.5">
                          {/* STICKER BUTTON ON RIGHT SIDE (SOFT WATER GLASS) */}
                          <button
                            type="button"
                            onClick={() => {
                              if (document.activeElement instanceof HTMLElement) {
                                document.activeElement.blur();
                              }
                              setShowStickerModal((prev) => !prev);
                            }}
                            className="p-2 bg-white/20 hover:bg-white/40 text-black active:scale-90 rounded-2xl transition-all shrink-0 border border-white/40 shadow-2xs flex items-center justify-center group backdrop-blur-md"
                            title="Stickers, Emojis & Creator"
                          >
                            <StickerIcon className="w-5 h-5 text-black transform group-hover:rotate-12 transition-transform" strokeWidth={2.2} />
                          </button>

                          <div className="w-9 h-9 flex items-center justify-center shrink-0">
                            {(inputText.trim() || selectedImagePreview) ? (
                              <motion.button
                                type="submit"
                                whileTap={{ scale: 0.82 }}
                                whileHover={{ scale: 1.06 }}
                                className="w-9 h-9 bg-[#FE2C55] hover:bg-[#E60045] text-white rounded-full transition-all duration-200 flex items-center justify-center shadow-[0_4px_14px_rgba(254,44,85,0.35)] border border-white/40 backdrop-blur-md"
                              >
                                <Send className="w-4 h-4" strokeWidth={2.5} />
                              </motion.button>
                            ) : (
                              <button
                                type="button"
                                onClick={startRecording}
                                className="p-2 text-black bg-white/20 hover:bg-white/40 active:scale-90 rounded-2xl transition-all shrink-0 border border-white/40 shadow-2xs flex items-center justify-center backdrop-blur-md"
                                title="Voice Message"
                              >
                                <Mic className="w-5 h-5 stroke-[2.2] text-black" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </form>
                  </>
                )}
              </div>
            </div>

              {/* Context Menu */}
              <AnimatePresence>
                {contextMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-[240] bg-black/20"
                      onClick={closeContextMenu}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        closeContextMenu();
                      }}
                    ></div>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.1 }}
                      className="fixed bg-white rounded-2xl shadow-xl border border-gray-200 p-2 w-64 z-[250] overflow-hidden"
                      style={{
                        top: Math.max(70, Math.min(contextMenu.y, (window.innerHeight || 800) - 260)),
                        left: Math.max(16, Math.min(contextMenu.x, (window.innerWidth || 400) - 270)),
                      }}
                    >
                      {/* Reaction Emojis Bar */}
                      <div className="flex items-center justify-around px-2 py-1.5 bg-gray-50 rounded-xl mb-1.5 border border-gray-100">
                        {["❤️", "😂", "😮", "😢", "🔥", "👏"].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={async () => {
                              if (activeChat) {
                                try {
                                  const { updateDoc, doc } =
                                    await import("firebase/firestore");
                                  await updateDoc(
                                    doc(
                                      db,
                                      "conversations",
                                      activeChat,
                                      "messages",
                                      contextMenu.msgId,
                                    ),
                                    {
                                      reaction: emoji,
                                    },
                                  );
                                } catch (e) {
                                  console.error("Failed to react", e);
                                }
                              }
                              closeContextMenu();
                            }}
                            className="text-2xl hover:scale-110 active:scale-95 transition-transform p-0.5"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>

                      {/* Action Items */}
                      <div className="space-y-0.5 font-sans">
                        {(() => {
                          const targetMsg = messages.find((m) => m.id === contextMenu.msgId);
                          const isSticker = targetMsg?.type === "sticker" || !!targetMsg?.stickerUrl;
                          const stkUrl = targetMsg?.stickerUrl || targetMsg?.mediaUrl;
                          const currentUserId = currentUser?.uid || "guest";
                          const isAlreadySaved = stkUrl ? isStickerSaved(currentUserId, stkUrl) : false;

                          return (
                            <>
                              {isSticker && stkUrl && (
                                <button
                                  onClick={() => {
                                    toggleSaveSticker(currentUserId, {
                                      id: `stk-${Date.now()}`,
                                      url: stkUrl,
                                      title: "Sticker",
                                      type: targetMsg?.stickerType || "image"
                                    });
                                    closeContextMenu();
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-purple-50 active:bg-purple-100 rounded-xl flex items-center space-x-3 transition-colors text-purple-700"
                                >
                                  <Bookmark className={`w-4 h-4 ${isAlreadySaved ? "fill-purple-600" : ""}`} />
                                  <span className="font-medium text-[14px]">
                                    {isAlreadySaved ? "Remove from Saved Stickers" : "Save to My Stickers"}
                                  </span>
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  if (targetMsg) {
                                    setReplyingTo(targetMsg as any);
                                    setTimeout(() => {
                                      textareaRef.current?.focus();
                                    }, 100);
                                  }
                                  closeContextMenu();
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-gray-100 active:bg-gray-200 rounded-xl flex items-center space-x-3 transition-colors text-gray-800"
                              >
                                <Reply className="w-4 h-4 text-purple-600" />
                                <span className="font-medium text-[14px]">Reply to message</span>
                              </button>

                              {isSticker && stkUrl && (
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(stkUrl);
                                    closeContextMenu();
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-gray-100 active:bg-gray-200 rounded-xl flex items-center space-x-3 transition-colors text-gray-800"
                                >
                                  <Share2 className="w-4 h-4 text-gray-600" />
                                  <span className="font-medium text-[14px]">Share / Copy Sticker Link</span>
                                </button>
                              )}

                              {!isSticker && (
                                <button
                                  onClick={() => {
                                    if (targetMsg?.content) {
                                      navigator.clipboard.writeText(targetMsg.content);
                                    }
                                    closeContextMenu();
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-gray-100 active:bg-gray-200 rounded-xl flex items-center space-x-3 transition-colors text-gray-800"
                                >
                                  <Copy className="w-4 h-4 text-gray-600" />
                                  <span className="font-medium text-[14px]">Copy text</span>
                                </button>
                              )}
                            </>
                          );
                        })()}

                        <div className="h-px bg-gray-100 my-1"></div>

                        <button
                          onClick={async () => {
                            if (activeChat) {
                              try {
                                const targetMsgId = contextMenu.msgId;
                                const { deleteDoc, doc, updateDoc, getDocs, collection, query, orderBy, limit } =
                                  await import("firebase/firestore");
                                await deleteDoc(
                                  doc(
                                    db,
                                    "conversations",
                                    activeChat,
                                    "messages",
                                    targetMsgId,
                                  ),
                                );

                                // Fetch remaining latest message to update conversation preview
                                const q = query(
                                  collection(db, "conversations", activeChat, "messages"),
                                  orderBy("createdAt", "desc"),
                                  limit(1)
                                );
                                const snap = await getDocs(q);
                                let newLastMsg = "";
                                if (!snap.empty) {
                                  const latestData = snap.docs[0].data();
                                  newLastMsg = latestData.content || (latestData.type === "image" ? "Sent a photo" : "Sent a message");
                                }
                                await updateDoc(doc(db, "conversations", activeChat), { lastMessage: newLastMsg });
                              } catch (err) {
                                console.error("Failed to unsend message", err);
                              }
                            }
                            closeContextMenu();
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-red-50 active:bg-red-100 rounded-xl flex items-center space-x-3 transition-colors text-red-600"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                          <span className="font-medium text-[14px]">
                            {messages.find((m) => m.id === contextMenu.msgId)
                              ?.senderId === currentUser?.uid
                              ? "Unsend message"
                              : "Delete for me"}
                          </span>
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </motion.div>
          )
        ) : (
          <div 
            className="hidden md:flex flex-1 flex-col items-center justify-center relative overflow-hidden h-full select-none"
            style={{
              background: 'linear-gradient(135deg, #f1f5f9 0%, #eef2ff 35%, #faf5ff 70%, #fdf4ff 100%)',
            }}
          >
            {/* Ambient artwork floating orbs */}
            <div className="absolute -top-28 -right-28 w-[480px] h-[480px] rounded-full bg-gradient-to-br from-indigo-200/40 via-purple-200/30 to-pink-200/20 blur-3xl pointer-events-none" />
            <div className="absolute top-1/2 -left-32 w-[420px] h-[420px] rounded-full bg-gradient-to-tr from-blue-200/35 via-cyan-100/25 to-purple-200/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 right-1/4 w-[440px] h-[440px] rounded-full bg-gradient-to-t from-purple-200/30 via-pink-100/30 to-amber-100/20 blur-3xl pointer-events-none" />
            <div 
              className="absolute inset-0 opacity-[0.035] pointer-events-none" 
              style={{
                backgroundImage: `radial-gradient(#4f46e5 1px, transparent 1px), radial-gradient(#9333ea 1px, #f8fafc 1px)`,
                backgroundSize: '28px 28px',
                backgroundPosition: '0 0, 14px 14px',
              }}
            />

            <div className="relative z-10 flex flex-col items-center text-center max-w-sm px-8 py-10 rounded-3xl bg-white/75 backdrop-blur-2xl border border-white/90 shadow-xl shadow-purple-500/5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/25 mb-4 text-white">
                <Send className="w-7 h-7 -rotate-12 translate-x-0.5" />
              </div>
              <h3 className="text-xl font-normal text-gray-900 mb-1.5">
                Your Messages
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed font-normal mb-5">
                Send private messages, share reels, and connect seamlessly with friends.
              </p>
              <button 
                onClick={() => setShowCreateGroup(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-normal px-6 py-2.5 rounded-xl transition-all shadow-sm active:scale-95 text-sm"
              >
                Start Conversation
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Chat Context Menu */}
      <AnimatePresence>
        {chatContextMenu && (
          <>
            <div
              className="fixed inset-0 z-[340]"
              onClick={(e) => {
                e.stopPropagation();
                closeContextMenu();
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                closeContextMenu();
              }}
            ></div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: "-50%", y: "-50%" }}
              animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
              exit={{ opacity: 0, scale: 0.95, x: "-50%", y: "-50%" }}
              className="fixed bg-white rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.2)] border border-gray-100 py-2 w-64 z-[350] overflow-hidden left-1/2 top-1/2"
            >
              <button
                onClick={async () => {
                  try {
                    const { deleteDoc, doc } =
                      await import("firebase/firestore");
                    await deleteDoc(
                      doc(db, "conversations", chatContextMenu.convId),
                    );
                    setChatContextMenu(null);
                    if (activeChat === chatContextMenu.convId)
                      setActiveChat(null);
                    setConversations((c) =>
                      c.filter((x) => x.id !== chatContextMenu.convId),
                    );
                  } catch (e) {
                    console.error("Error deleting chat", e);
                  }
                }}
                className="w-full text-left px-4 py-2 hover:bg-red-50 flex items-center space-x-3 transition-colors text-red-600"
              >
                <Trash2 className="w-5 h-5" />
                <span className="font-normal text-[14px]">Delete Chat</span>
              </button>
              {chatContextMenu.otherUid && (
                <button
                  onClick={async () => {
                    try {
                      if (!currentUser) return;
                      const { unfollowUser } =
                        await import("../services/followService");
                      await unfollowUser(
                        currentUser.uid,
                        chatContextMenu.otherUid!,
                      );
                      const { deleteDoc, doc } =
                        await import("firebase/firestore");
                      await deleteDoc(
                        doc(db, "conversations", chatContextMenu.convId),
                      );
                      setChatContextMenu(null);
                      if (activeChat === chatContextMenu.convId)
                        setActiveChat(null);
                      setConversations((c) =>
                        c.filter((x) => x.id !== chatContextMenu.convId),
                      );
                    } catch (e) {
                      console.error("Error deleting friend", e);
                    }
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-red-50 flex items-center space-x-3 transition-colors text-red-600"
                >
                  <UserX className="w-5 h-5" />
                  <span className="font-normal text-[14px]">Delete Friend</span>
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Story Camera Overlay */}
      {showCreateStory && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center animate-in fade-in duration-200 p-4">
          {storyPreview ? (
            <div className="relative w-full max-w-sm max-h-[85vh] h-full overflow-hidden flex flex-col bg-black rounded-3xl shadow-2xl">
              <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 bg-gradient-to-b from-black/50 to-transparent">
                <button
                  onClick={() => {
                    setStoryPreview(null);
                    setStoryFile(null);
                  }}
                  className="p-2 text-white bg-black/40 rounded-full"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 flex items-center justify-center min-h-0 bg-black">
                {storyFile?.type.startsWith("video") ? (
                  <video
                    src={storyPreview}
                    className="max-w-full max-h-full"
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                ) : (
                  <img
                    src={storyPreview}
                    className="max-w-full max-h-full object-contain"
                    alt="Story preview"
                  />
                )}
              </div>
              <div className="p-4 bg-black flex justify-between items-center shrink-0 z-10 border-t border-white/10">
                <button
                  onClick={() => {
                    setStoryPreview(null);
                    setStoryFile(null);
                  }}
                  className="px-6 py-2.5 bg-gray-800 text-white rounded-full font-normal"
                >
                  Discard
                </button>
                <button
                  onClick={async () => {
                    if (!storyFile || !currentUser) return;
                    setStoryUploading(true);
                    try {
                      const { uploadStory } =
                        await import("../services/storyService");
                      await uploadStory(
                        currentUser.uid,
                        currentUser.name,
                        currentUser.avatar || "",
                        storyFile,
                        undefined,
                        "inbox",
                      );
                      setStoryFile(null);
                      setStoryPreview(null);
                      setShowCreateStory(false);
                    } catch (e) {
                      console.error(e);
                      alert("Failed to upload story");
                    } finally {
                      setStoryUploading(false);
                    }
                  }}
                  disabled={storyUploading}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-normal flex items-center space-x-2 transition-colors"
                >
                  {storyUploading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Post</span>
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="relative w-full max-w-sm max-h-[85vh] h-full overflow-hidden bg-black rounded-3xl shadow-2xl">
              <video
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
                ref={(ref) => {
                  if (ref && !ref.srcObject) {
                    navigator.mediaDevices
                      .getUserMedia({
                        video: { facingMode: "user" },
                        audio: true,
                      })
                      .then((stream) => {
                        ref.srcObject = stream;
                      })
                      .catch((err) =>
                        console.error("Camera access denied:", err),
                      );
                  }
                }}
              />
              <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 bg-gradient-to-b from-black/50 to-transparent pt-safe">
                <button
                  onClick={() => setShowCreateStory(false)}
                  className="p-2 text-white"
                >
                  <X className="w-7 h-7" />
                </button>
                <button className="flex items-center space-x-2 bg-black/60 px-4 py-1.5 rounded-full text-white font-normal text-sm">
                  <Music className="w-4 h-4" />
                  <span>Add Sound</span>
                </button>
                <div className="flex flex-col space-y-4 items-center">
                  <button className="flex flex-col items-center text-white">
                    <Type className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-normal">Text</span>
                  </button>
                  <button className="flex flex-col items-center text-white">
                    <Smile className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-normal">Stickers</span>
                  </button>
                  <button className="flex flex-col items-center text-white">
                    <Settings2 className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-normal">Filters</span>
                  </button>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col items-center z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent pb-safe">
                <div className="flex space-x-8 mb-6 text-white/80 font-normal text-sm">
                  <button className="text-white border-b-2 border-white pb-1">
                    Story
                  </button>
                  <button className="hover:text-white">Photo</button>
                  <button className="hover:text-white">Video</button>
                </div>
                <div className="flex items-center justify-between w-full px-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-600 overflow-hidden relative">
                      <input
                        type="file"
                        accept="image/*,video/*"
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setStoryFile(file);
                            setStoryPreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                      <img
                        src="https://picsum.photos/seed/gallery/100/100"
                        className="w-full h-full object-cover"
                        alt="Gallery"
                      />
                    </div>
                    <span className="text-white text-[11px] font-normal mt-2">
                      Upload
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*,video/*"
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setStoryFile(file);
                          setStoryPreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                    <button className="w-20 h-20 rounded-full border-4 border-white/50 flex items-center justify-center transition-transform active:scale-95 bg-white/20">
                      <div className="w-16 h-16 bg-white rounded-full transition-all"></div>
                    </button>
                  </div>
                  <div className="flex flex-col items-center opacity-0">
                    <div className="w-10 h-10"></div>
                    <span className="text-white text-[11px] font-normal mt-2">
                      Effects
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chat Settings Overlay - Soft Rounded 2D Mobile Clean UI */}
      <AnimatePresence>
        {showChatSettings && activeContact && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[120] bg-slate-50 md:bg-white flex flex-col md:w-[380px] md:left-auto md:border-l border-gray-100 shadow-2xl will-change-transform"
          >
            {/* Header */}
            <div className="pt-[calc(env(safe-area-inset-top,0px)+16px)] md:pt-3 pb-3 px-4 min-h-[calc(72px+env(safe-area-inset-top,0px))] md:min-h-[64px] border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10 shadow-2xs">
              <div className="flex items-center space-x-2.5">
                <button
                  onClick={() => {
                    if (showSharedMedia) {
                      setShowSharedMedia(false);
                    } else {
                      setShowChatSettings(false);
                    }
                  }}
                  className="p-2.5 -ml-1 hover:bg-gray-100 rounded-full transition-all active:scale-95 cursor-pointer text-gray-800"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-800" strokeWidth={2.2} />
                </button>
                <h2 className="font-bold text-[16px] md:text-[17px] text-gray-900">
                  {showSharedMedia ? "Shared Media" : (activeContact.isGroup ? "Group Details" : "Conversation Details")}
                </h2>
              </div>
              <button
                onClick={() => setShowChatSettings(false)}
                className="p-2.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {showSharedMedia ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
                {/* Filter Tabs */}
                <div className="flex items-center space-x-1 px-3 py-2 border-b border-gray-100 bg-gray-50/80 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSharedMediaTab("all")}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                      sharedMediaTab === "all"
                        ? "bg-white text-gray-900 shadow-2xs"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    All ({sharedMediaItems.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSharedMediaTab("media")}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                      sharedMediaTab === "media"
                        ? "bg-white text-gray-900 shadow-2xs"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    Photos ({sharedMediaItems.filter((i: any) => i.isImg || i.isVid).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSharedMediaTab("reels")}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                      sharedMediaTab === "reels"
                        ? "bg-white text-gray-900 shadow-2xs"
                        : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    Reels ({sharedMediaItems.filter((i: any) => i.isReel).length})
                  </button>
                </div>

                {/* Media Grid / Empty State */}
                <div className="flex-1 overflow-y-auto p-1.5 scrollbar-thin">
                  {displayedSharedItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                        <ImageIcon className="w-7 h-7 text-gray-400" />
                      </div>
                      <p className="font-semibold text-gray-800 text-sm">
                        {sharedMediaTab === "reels"
                          ? "No shared reels"
                          : sharedMediaTab === "media"
                          ? "No shared photos or videos"
                          : "No shared media yet"}
                      </p>
                      <p className="text-xs text-gray-400 mt-1 max-w-[200px]">
                        Photos, videos, and reels sent in this chat will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1">
                      {displayedSharedItems.map((item: any) => (
                        <div
                          key={item.id}
                          className="relative aspect-square bg-gray-950 overflow-hidden cursor-pointer group rounded-lg"
                          onClick={() => {
                            if (item.isReel) {
                              setViewingReel({
                                id: item.postId || item.id,
                                authorId: item.senderId,
                                authorName: "Reel",
                                authorAvatar: "",
                                media: [item.mediaUrl || item.cover],
                                text: "",
                                type: "reel",
                                single: true,
                              });
                              setViewingReelContext("chat");
                            } else if (item.isVid) {
                              setViewingMedia({
                                type: "video",
                                url: item.mediaUrl || item.cover,
                                user: { name: "", avatar: "" },
                              });
                            } else {
                              setViewingMedia({
                                type: "image",
                                url: item.mediaUrl || item.cover,
                                user: { name: "", avatar: "" },
                              });
                            }
                          }}
                        >
                          {item.isVid && !item.isReel ? (
                            <video
                              src={`${item.cover || item.mediaUrl}#t=0.001`}
                              className="w-full h-full object-cover"
                              preload="metadata"
                              muted
                              playsInline
                            />
                          ) : (
                            <img
                              src={item.cover || item.mediaUrl}
                              alt="Shared media"
                              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          )}

                          {item.isReel && (
                            <div className="absolute top-1 left-1 p-1 bg-black/60 backdrop-blur-xs rounded-md text-white pointer-events-none">
                              <Film className="w-3 h-3" />
                            </div>
                          )}
                          {item.isVid && !item.isReel && (
                            <div className="absolute top-1 left-1 p-1 bg-black/60 backdrop-blur-xs rounded-md text-white pointer-events-none">
                              <Play className="w-3 h-3 fill-white" />
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const ext = item.isVid || item.isReel ? "mp4" : "jpg";
                              downloadMediaFile(
                                item.mediaUrl || item.cover,
                                `shared_${item.mediaType}_${item.id || Date.now()}.${ext}`
                              );
                            }}
                            className="absolute bottom-1 right-1 p-1.5 bg-black/65 hover:bg-black/90 active:scale-90 rounded-full text-white transition-all shadow-md"
                            title="Download"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : activeContact.isGroup ? (
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {/* 2D Soft Card Profile Header */}
                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-2xs flex flex-col items-center text-center">
                  <div className="relative mb-3 cursor-pointer">
                    <input
                      type="file"
                      id="groupAvatarUpload"
                      className="hidden"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file && currentUser) {
                          try {
                            const { uploadMedia } =
                              await import("../services/githubStorage");
                            const { updateDoc, doc } =
                              await import("firebase/firestore");
                            const url = await uploadMedia(
                              file,
                              `group_avatars/${activeContact.id}_${Date.now()}`,
                            );
                            await updateDoc(
                              doc(db, "conversations", activeContact.id),
                              { groupAvatar: url },
                            );
                            if (activeContact) activeContact.avatar = url;
                          } catch (err) {
                            console.error(err);
                          }
                        }
                      }}
                    />
                    {activeContact.avatar ? (
                      <img
                        src={activeContact.avatar}
                        className="w-20 h-20 rounded-2xl object-cover border border-gray-100 shadow-sm"
                        alt={activeContact.name}
                        onClick={() =>
                          document.getElementById("groupAvatarUpload")?.click()
                        }
                      />
                    ) : (
                      <div
                        onClick={() =>
                          document.getElementById("groupAvatarUpload")?.click()
                        }
                      >
                        <GroupAvatar
                          members={
                            activeConversation?.participantIds
                              ?.filter((id) => id !== currentUser?.uid)
                              .slice(0, 3)
                              .map(
                                (id) =>
                                  userDataCache[id]?.avatar ||
                                  (activeConversation?.participantAvatars || {})[id] ||
                                  `https://ui-avatars.com/api/?name=${encodeURIComponent(userDataCache[id]?.name || (activeConversation?.participantNames || {})[id] || "User")}&background=random`,
                              ) || []
                          }
                          sizeClass="w-20 h-20 shadow-sm rounded-2xl"
                        />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/20 rounded-2xl flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                      <Camera className="w-5 h-5 text-white" />
                    </div>
                  </div>

                  <div
                    className="flex items-center space-x-1.5 cursor-pointer group hover:bg-gray-50 px-3 py-1 rounded-xl transition-colors"
                    onClick={async () => {
                      const newName = prompt(
                        "Enter new group name:",
                        activeContact.name,
                      );
                      if (newName && newName.trim() && currentUser) {
                        try {
                          const { updateDoc, doc } =
                            await import("firebase/firestore");
                          await updateDoc(
                            doc(db, "conversations", activeContact.id),
                            { groupName: newName.trim() },
                          );
                        } catch (err) {
                          console.error(err);
                        }
                      }
                    }}
                  >
                    <h3 className="text-lg font-bold text-gray-900">
                      {activeContact.name}
                    </h3>
                    <div className="p-1 bg-gray-100 rounded-lg text-gray-500 group-hover:bg-gray-200 transition-colors">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 font-medium mt-0.5">
                    {activeConversation?.participantIds?.length || 0} Members
                  </span>
                </div>

                {/* Group Members List */}
                <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Members
                    </h4>
                    <button
                      onClick={() => {
                        const currentIds =
                          activeConversation?.participantIds || [];
                        const availableFriends = followers.filter(
                          (f) => !currentIds.includes(f.id),
                        );
                        if (availableFriends.length === 0) {
                          alert("No more friends to add!");
                          return;
                        }
                        const addMenu = document.createElement("div");
                        addMenu.className =
                          "fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm";
                        addMenu.innerHTML = `
                           <div class="bg-white rounded-3xl w-full max-w-sm max-h-[70vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95">
                             <div class="p-4 border-b border-gray-100 flex items-center justify-between">
                               <h3 class="font-bold text-gray-900">Add Members</h3>
                               <button id="closeAdd" class="p-1 hover:bg-gray-100 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-500"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
                             </div>
                             <div class="flex-1 overflow-y-auto p-2" id="addList">
                             </div>
                             <div class="p-4 border-t border-gray-100">
                               <button id="confirmAdd" class="w-full bg-purple-600 text-white font-bold py-3 rounded-xl shadow-md">Add Selected</button>
                             </div>
                           </div>
                         `;
                        document.body.appendChild(addMenu);

                        const list = addMenu.querySelector("#addList");
                        availableFriends.forEach((f) => {
                          const el = document.createElement("label");
                          el.className =
                            "flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-xl cursor-pointer";
                          el.innerHTML = `
                             <input type="checkbox" value="${f.id}" class="add-checkbox w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                             <img src="${f.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(f.name || 'User')}&background=random`}" class="w-10 h-10 rounded-full object-cover" />
                             <span class="font-medium text-gray-900 text-sm">${f.name}</span>
                           `;
                          list?.appendChild(el);
                        });

                        addMenu
                          .querySelector("#closeAdd")
                          ?.addEventListener("click", () => addMenu.remove());
                        addMenu
                          .querySelector("#confirmAdd")
                          ?.addEventListener("click", async () => {
                            const checkboxes = addMenu.querySelectorAll(
                              ".add-checkbox:checked",
                            ) as NodeListOf<HTMLInputElement>;
                            const selectedIds = Array.from(checkboxes).map(
                              (c) => c.value,
                            );
                            if (selectedIds.length > 0) {
                              try {
                                const { doc, updateDoc, getDoc } =
                                  await import("firebase/firestore");
                                const newIds = [...currentIds, ...selectedIds];

                                const pNames = {
                                  ...(activeConversation?.participantNames ||
                                    {}),
                                };
                                const pAvatars = {
                                  ...(activeConversation?.participantAvatars ||
                                    {}),
                                };

                                await Promise.all(
                                  selectedIds.map(async (id) => {
                                    const u = await getDoc(
                                      doc(db, "users", id),
                                    );
                                    if (u.exists()) {
                                      pNames[id] = u.data().name;
                                      pAvatars[id] = u.data().avatar;
                                    }
                                  }),
                                );

                                await updateDoc(
                                  doc(db, "conversations", activeContact.id),
                                  {
                                    participantIds: newIds,
                                    participantNames: pNames,
                                    participantAvatars: pAvatars,
                                  },
                                );
                                addMenu.remove();
                              } catch (e) {
                                console.error(e);
                              }
                            }
                          });
                      }}
                      className="text-purple-600 text-xs font-bold px-2.5 py-1 bg-purple-50 hover:bg-purple-100 rounded-full transition-colors flex items-center space-x-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>

                  {activeConversation?.participantIds?.map((pid) => {
                    const isMe = pid === currentUser?.uid;
                    const pName = isMe
                      ? `${currentUser.name} (You)`
                      : userDataCache[pid]?.name ||
                        (activeConversation.participantNames || {})[pid] ||
                        "User";
                    const pAvatar = isMe
                      ? currentUser.avatar
                      : (activeConversation.participantAvatars || {})[pid] ||
                        userDataCache[pid]?.avatar ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(pName.replace(" (You)", ""))}&background=random`;
                    const isAdmin =
                      activeConversation.participantIds[0] === pid;

                    return (
                      <div
                        key={pid}
                        className="flex items-center justify-between p-2.5 hover:bg-gray-50 rounded-2xl transition-colors cursor-pointer text-left"
                      >
                        <div className="flex items-center space-x-3">
                          <img
                            src={pAvatar}
                            className="w-9 h-9 rounded-full object-cover border border-gray-100"
                          />
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900 text-sm">
                              {isMe ? "You" : pName}
                            </span>
                            {isAdmin && (
                              <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wide">
                                Admin
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Settings & Leave */}
                <div className="bg-white rounded-3xl p-3 border border-gray-100 shadow-2xs space-y-1">
                  <button
                    onClick={() => setShowThemeSettings(true)}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-2xl transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                        <Palette className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-gray-900 text-sm">
                        Chat Theme
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowSharedMedia(true)}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-2xl transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-gray-900 text-sm">
                        Shared Media
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 text-gray-400">
                      {sharedMediaItems.length > 0 && (
                        <span className="text-xs bg-gray-100 text-gray-600 font-semibold px-2 py-0.5 rounded-full">
                          {sharedMediaItems.length}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </button>

                  <button
                    onClick={async () => {
                      if (
                        confirm("Are you sure you want to leave this group?")
                      ) {
                        try {
                          const { doc, getDoc, updateDoc } =
                            await import("firebase/firestore");
                          if (!currentUser) return;
                          const convRef = doc(
                            db,
                            "conversations",
                            activeContact.id,
                          );
                          const snap = await getDoc(convRef);
                          if (snap.exists()) {
                            const d = snap.data();
                            const newIds = d.participantIds.filter(
                              (id: string) => id !== currentUser.uid,
                            );
                            if (newIds.length === 0) {
                              const { deleteDoc } =
                                await import("firebase/firestore");
                              await deleteDoc(convRef);
                            } else {
                              await updateDoc(convRef, {
                                participantIds: newIds,
                              });
                            }
                            setShowChatSettings(false);
                            setActiveChat(null);
                          }
                        } catch (err) {
                          console.error(err);
                        }
                      }
                    }}
                    className="w-full flex items-center space-x-3 p-3 hover:bg-red-50 rounded-2xl transition-colors group text-left cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center group-hover:bg-red-100">
                      <Trash2 className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-red-600 text-sm">
                      Leave Group
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {/* 2D Profile Card */}
                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-2xs flex flex-col items-center text-center">
                  <div className="relative mb-3">
                    <img
                      src={activeContact.avatar}
                      className="w-20 h-20 rounded-2xl object-cover border border-gray-100 shadow-sm"
                      alt={activeContact.name}
                    />
                    {activeContact.online && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></div>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 leading-tight">
                    {activeContact.name}
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">
                    @{activeContact.name.toLowerCase().replace(/ /g, "_")}
                  </p>

                  {/* 3 Quick 2D Action Pills */}
                  <div className="grid grid-cols-3 gap-3 w-full mt-5">
                    <button
                      onClick={() => {
                        if (activeContact.uid === "jarvis") return;
                        setViewingUser({
                          uid: activeContact.uid!,
                          name: activeContact.name,
                          avatar: activeContact.avatar,
                        });
                        pushPage("profile");
                      }}
                      className="flex flex-col items-center justify-center p-3 bg-slate-50 hover:bg-purple-50 hover:text-purple-600 rounded-2xl border border-gray-100 transition-all active:scale-95 group cursor-pointer"
                    >
                      <UserSquare className="w-5 h-5 text-gray-700 group-hover:text-purple-600 mb-1" />
                      <span className="text-[11px] font-semibold text-gray-600 group-hover:text-purple-600">
                        Profile
                      </span>
                    </button>

                    <button
                      className="flex flex-col items-center justify-center p-3 bg-slate-50 hover:bg-purple-50 hover:text-purple-600 rounded-2xl border border-gray-100 transition-all active:scale-95 group cursor-pointer"
                    >
                      <Bell className="w-5 h-5 text-gray-700 group-hover:text-purple-600 mb-1" />
                      <span className="text-[11px] font-semibold text-gray-600 group-hover:text-purple-600">
                        Mute
                      </span>
                    </button>

                    <button
                      className="flex flex-col items-center justify-center p-3 bg-slate-50 hover:bg-purple-50 hover:text-purple-600 rounded-2xl border border-gray-100 transition-all active:scale-95 group cursor-pointer"
                    >
                      <Search className="w-5 h-5 text-gray-700 group-hover:text-purple-600 mb-1" />
                      <span className="text-[11px] font-semibold text-gray-600 group-hover:text-purple-600">
                        Search
                      </span>
                    </button>
                  </div>
                </div>

                {/* Chat Customization Options */}
                <div className="bg-white rounded-3xl p-3 border border-gray-100 shadow-2xs space-y-1">
                  <h4 className="px-3 pt-1 pb-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    Customization
                  </h4>

                  <button
                    onClick={() => setShowThemeSettings(true)}
                    className="w-full flex items-center justify-between p-3 hover:bg-purple-50/50 rounded-2xl transition-colors cursor-pointer text-left group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
                        <Palette className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900 text-sm block">
                          Chat Themes
                        </span>
                        <span className="text-[11px] text-gray-400">
                          Wallpapers, gradients & solids
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600 transition-colors" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowSharedMedia(true)}
                    className="w-full flex items-center justify-between p-3 hover:bg-blue-50/50 rounded-2xl transition-colors cursor-pointer text-left group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900 text-sm block">
                          Shared Media
                        </span>
                        <span className="text-[11px] text-gray-400">
                          Photos, videos & reels
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 text-gray-400">
                      {sharedMediaItems.length > 0 && (
                        <span className="text-xs bg-gray-100 text-gray-600 font-semibold px-2 py-0.5 rounded-full">
                          {sharedMediaItems.length}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </button>
                </div>

                {/* Privacy & Actions */}
                <div className="bg-white rounded-3xl p-3 border border-gray-100 shadow-2xs space-y-1">
                  <h4 className="px-3 pt-1 pb-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    Privacy & Support
                  </h4>

                  <button
                    onClick={() => setIsBlocked(!isBlocked)}
                    className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-2xl transition-colors group cursor-pointer text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-gray-600 flex items-center justify-center">
                      <EyeOff className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-gray-700 text-sm">
                      {isBlocked ? "Unblock" : "Block"} User
                    </span>
                  </button>

                  <button className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-2xl transition-colors group cursor-pointer text-left">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 text-gray-600 flex items-center justify-center">
                      <Shield className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-gray-700 text-sm">
                      Report User
                    </span>
                  </button>

                  <button className="w-full flex items-center space-x-3 p-3 hover:bg-red-50 rounded-2xl transition-colors group cursor-pointer text-left">
                    <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center group-hover:bg-red-100">
                      <Trash2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-red-600 text-sm block">
                        Delete Chat
                      </span>
                      <span className="text-[11px] text-red-400">
                        Clear entire conversation
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Group Modal */}
      <AnimatePresence>
        {showCreateGroup && (
          <motion.div 
            initial={{ y: "100%", opacity: 1 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 1 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[999] flex flex-col bg-white h-[100dvh] w-full"
          >
            <input
              type="file"
              ref={groupPfpInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                  const img = new Image();
                  img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const MAX_WIDTH = 500;
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                    const ctx = canvas.getContext("2d");
                    ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                    setNewGroupAvatar(canvas.toDataURL("image/jpeg", 0.8));
                  };
                  img.src = event.target?.result as string;
                };
                reader.readAsDataURL(file);
              }}
            />

            <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between pt-8 md:pt-4 bg-white shrink-0 z-10">
              <div className="flex items-center">
                <button
                  onClick={() => {
                    setShowCreateGroup(false);
                    setNewGroupAvatar(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors active:scale-95"
                >
                  <ArrowLeft className="w-6 h-6 text-gray-900" />
                </button>
                <h3 className="font-normal text-gray-900 text-[19px] ml-2 tracking-tight">
                  New Group
                </h3>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col no-scrollbar">
              <div className="flex justify-center mt-2 mb-4 shrink-0">
                <button
                  type="button"
                  onClick={() => groupPfpInputRef.current?.click()}
                  className="w-20 h-20 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center relative shadow-sm hover:opacity-90 active:scale-95 transition-all overflow-visible group"
                >
                  {newGroupAvatar ? (
                    <img src={newGroupAvatar} className="w-full h-full rounded-full object-cover" alt="Group PFP" />
                  ) : (
                    <UserPlus className="w-8 h-8 text-blue-500" strokeWidth={1.5} />
                  )}
                  <div className="absolute bottom-0 right-0 w-7 h-7 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center shadow-sm group-hover:bg-blue-600 transition-colors">
                    <Plus className="w-4 h-4 text-white" strokeWidth={2.5} />
                  </div>
                </button>
              </div>

              <input
                type="text"
                placeholder="Group Name"
                className="w-full text-2xl font-normal text-center outline-none border-none placeholder-gray-300 pb-3 mb-4 bg-transparent shrink-0"
                id="groupNameInput"
                autoFocus
              />

              <div className="w-full h-[1px] bg-gray-100 mb-3 shrink-0"></div>

              <h4 className="font-normal text-[13px] text-gray-500 mb-2 uppercase tracking-wider px-2 shrink-0">
                Select Members
              </h4>

              <div className="flex-1 space-y-1.5 overflow-y-auto min-h-[220px] pb-4">
                {followers.map((f) => (
                  <label
                    key={f.id}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-2xl cursor-pointer transition-colors group active:scale-[0.98]"
                  >
                    <div className="flex items-center space-x-3">
                      <img
                        src={
                          f.avatar ||
                          `https://ui-avatars.com/api/?name=${f.name}&background=random`
                        }
                        className="w-[46px] h-[46px] rounded-full object-cover shadow-sm border border-gray-100"
                        alt="Avatar"
                      />
                      <span className="font-normal text-[16px] text-gray-900">
                        {f.name}
                      </span>
                    </div>
                    <div className="relative flex-shrink-0">
                      <input
                        type="checkbox"
                        value={f.id}
                        className="peer sr-only group-checkbox"
                      />
                      <div className="w-6 h-6 rounded-full border-[1.5px] border-gray-300 peer-checked:bg-blue-500 peer-checked:border-blue-500 flex items-center justify-center transition-all shadow-sm">
                        <Check
                          className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 scale-50 peer-checked:scale-100 transition-all duration-200"
                          strokeWidth={3}
                        />
                      </div>
                    </div>
                  </label>
                ))}
                {followers.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400 space-y-3">
                    <UserPlus className="w-8 h-8 opacity-50" />
                    <p className="text-sm font-normal">
                      You need friends to create a group!
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 px-6 py-4 border-t border-gray-100 bg-white z-20 pb-[max(env(safe-area-inset-bottom),16px)]">
              <button
                onClick={async () => {
                  const groupNameInput = document.getElementById(
                    "groupNameInput",
                  ) as HTMLInputElement;
                  const checkboxes = document.querySelectorAll(
                    ".group-checkbox:checked",
                  ) as NodeListOf<HTMLInputElement>;
                  const selectedIds = Array.from(checkboxes).map(
                    (c) => c.value,
                  );
                  if (selectedIds.length > 0 && currentUser) {
                    try {
                      const { createGroupConversation } =
                        await import("../services/chatService");
                      const newChatId = await createGroupConversation(
                        currentUser.uid,
                        selectedIds,
                        groupNameInput.value || "New Group",
                        newGroupAvatar || undefined,
                      );
                      setActiveChat(newChatId);
                      setShowCreateGroup(false);
                      setNewGroupAvatar(null);
                    } catch (err) {}
                  }
                }}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold py-3.5 rounded-2xl transition-all active:scale-98 shadow-lg shadow-purple-500/20 flex items-center justify-center text-[16px]"
              >
                Create Group Chat
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inbox Privacy Sheet */}
      <AnimatePresence>
        {showPrivacySheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-[200]"
              onClick={() => setShowPrivacySheet(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[32px] z-[210] px-6 pt-5 pb-10 shadow-[0_-8px_30px_rgb(0,0,0,0.12)] border-t border-purple-100 animate-in slide-in-from-bottom"
            >
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[19px] font-normal text-gray-950 tracking-tight">
                  Activity Status
                </h3>
                <button
                  onClick={() => setShowPrivacySheet(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <p className="text-[13px] font-normal text-gray-500 mb-6 leading-relaxed">
                Choose who can see when you're active on the app.
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={async () => {
                    setPrivacyMode("public");
                    setShowPrivacySheet(false);
                    if (currentUser) {
                      localStorage.setItem("privacyMode", "public");
                      const { setOnline } =
                        await import("../services/presenceService");
                      setOnline(currentUser.uid);
                      try {
                        const { doc, updateDoc } =
                          await import("firebase/firestore");
                        await updateDoc(doc(db, "users", currentUser.uid), {
                          privacyMode: "public",
                        });
                      } catch (e) {}
                    }
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${privacyMode === "public" ? "border-purple-200 bg-purple-50/40" : "border-gray-100 hover:border-gray-200 bg-white"}`}
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                      <div className="w-3.5 h-3.5 rounded-full bg-green-500 shadow-sm shadow-green-500/50"></div>
                    </div>
                    <div>
                      <span className="font-normal text-[15px] text-gray-900 block leading-none mb-1">Public (Active)</span>
                      <span className="text-[12px] text-gray-500 font-light block leading-tight">Everyone can see when you are online</span>
                    </div>
                  </div>
                  {privacyMode === "public" && (
                    <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4 text-white" strokeWidth={3} />
                    </div>
                  )}
                </button>

                <button
                  onClick={async () => {
                    setPrivacyMode("private");
                    setShowPrivacySheet(false);
                    if (currentUser) {
                      localStorage.setItem("privacyMode", "private");
                      const { setOffline } =
                        await import("../services/presenceService");
                      setOffline(currentUser.uid);
                      try {
                        const { doc, updateDoc } =
                          await import("firebase/firestore");
                        await updateDoc(doc(db, "users", currentUser.uid), {
                          privacyMode: "private",
                        });
                      } catch (e) {}
                    }
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${privacyMode === "private" ? "border-purple-200 bg-purple-50/40" : "border-gray-100 hover:border-gray-200 bg-white"}`}
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                      <EyeOff className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                      <span className="font-normal text-[15px] text-gray-900 block leading-none mb-1">Private (Hidden)</span>
                      <span className="text-[12px] text-gray-500 font-light block leading-tight">Hide your online status from everyone</span>
                    </div>
                  </div>
                  {privacyMode === "private" && (
                    <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4 text-white" strokeWidth={3} />
                    </div>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Status Input Modal */}
      <AnimatePresence>
        {showStatusInput && (
          <motion.div 
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="fixed inset-0 z-[200] flex flex-col bg-gradient-to-b from-[#faf5ff] via-white to-white p-6 font-sans"
          >
            {/* Header */}
            <div className="flex items-center justify-between pt-8 pb-4 border-b border-purple-50/50">
              <button
                onClick={() => setShowStatusInput(false)}
                className="p-2.5 hover:bg-purple-50 rounded-full transition-colors active:scale-90"
              >
                <ArrowLeft className="w-6 h-6 text-gray-900" />
              </button>
              <h2 className="text-xl font-normal text-gray-950 tracking-tight">Create a Note</h2>
              <div className="w-11"></div> {/* Spacer for symmetry */}
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col items-center py-8">
              {/* Note Live Preview over Avatar */}
              <div className="relative mb-10 flex flex-col items-center pt-8">
                <div className="relative">
                  {/* Note Bubble Preview */}
                  <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 px-3 py-1.5 bg-white border border-purple-100 shadow-[0_4px_16px_rgba(168,85,247,0.18)] rounded-full z-20 w-auto max-w-[120px] transition-all duration-300">
                    <span className="text-[11px] font-semibold text-purple-700 leading-tight block text-center truncate max-w-[100px]">
                      {statusNoteText || "Share a thought..."}
                    </span>
                    <div className="absolute -bottom-[3px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white border-b border-r border-purple-100 rotate-45"></div>
                  </div>

                  <img
                    src={
                      currentUser?.avatar ||
                      `https://ui-avatars.com/api/?name=${currentUser?.name || "Me"}&background=random`
                    }
                    className="w-[100px] h-[100px] rounded-full object-cover border-2 border-white shadow-md"
                    alt="Me"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <span className="text-sm font-normal text-gray-500 mt-4">
                  Your note will appear above your picture
                </span>
              </div>

              {/* Input Area */}
              <div className="w-full max-w-sm px-4">
                <input
                  type="text"
                  placeholder="What's on your mind?"
                  value={statusNoteText}
                  onChange={(e) => setStatusNoteText(e.target.value)}
                  maxLength={60}
                  className="w-full text-center text-xl font-normal outline-none border-b-2 border-purple-100 focus:border-purple-500 pb-3 transition-colors placeholder:text-gray-300 bg-transparent text-gray-950"
                  autoFocus
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && currentUser) {
                      try {
                        const { updateDoc, doc } =
                          await import("firebase/firestore");
                        await updateDoc(doc(db, "users", currentUser.uid), {
                          statusNote: statusNoteText,
                        });
                        if ((currentUser as any).statusNote !== undefined) {
                          (currentUser as any).statusNote = statusNoteText;
                        }
                        setShowStatusInput(false);
                      } catch (err) {}
                    }
                  }}
                />
                
                {/* Character Counter */}
                <div className="flex justify-end mt-2 text-xs text-gray-400 font-light">
                  {statusNoteText.length} / 60
                </div>

                {/* Status Suggestions */}
                <div className="mt-8">
                  <p className="text-xs font-semibold text-purple-600/80 uppercase tracking-widest text-center mb-4">
                    Quick suggestions
                  </p>
                  <div className="flex flex-wrap justify-center gap-2.5">
                    {["☕ Chillin", "✍️ Studying", "🎮 Gaming", "🎧 Music", "😴 Sleepy", "✈️ Travel", "✨ Happy", "🔥 Hustling"].map((sug) => (
                      <button
                        key={sug}
                        onClick={() => setStatusNoteText(sug)}
                        className="px-3.5 py-1.5 bg-purple-50/80 hover:bg-purple-100 text-purple-700 rounded-full text-xs font-medium transition-all active:scale-95 border border-purple-100/30 shadow-sm"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions sticky to bottom */}
            <div className="sticky bottom-0 pt-4 pb-[max(env(safe-area-inset-bottom),24px)] w-full max-w-sm mx-auto flex flex-col space-y-3 shrink-0 z-20 bg-white/90 backdrop-blur-lg px-2">
              <button
                onClick={async () => {
                  if (currentUser) {
                    try {
                      const { updateDoc, doc } =
                        await import("firebase/firestore");
                      await updateDoc(doc(db, "users", currentUser.uid), {
                        statusNote: statusNoteText,
                      });
                      if ((currentUser as any).statusNote !== undefined) {
                        (currentUser as any).statusNote = statusNoteText;
                      }
                      setShowStatusInput(false);
                    } catch (err) {}
                  }
                }}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold py-3.5 rounded-2xl transition-all shadow-lg shadow-purple-500/20 active:scale-98 text-center"
              >
                Share Note
              </button>
              {(currentUser as any)?.statusNote && (
                <button
                  onClick={async () => {
                    if (currentUser) {
                      try {
                        const { updateDoc, doc, deleteField } =
                          await import("firebase/firestore");
                        await updateDoc(doc(db, "users", currentUser.uid), {
                          statusNote: deleteField(),
                        });
                        delete (currentUser as any).statusNote;
                        setStatusNoteText("");
                        setShowStatusInput(false);
                      } catch (err) {}
                    }
                  }}
                  className="w-full bg-red-50 hover:bg-red-100 text-red-500 font-medium py-3.5 rounded-2xl transition-all active:scale-98 text-center"
                >
                  Delete Status Note
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-Page Chat Theme Studio Modal (Root Level Overlay) */}
      <ChatThemeStudioModal
        isOpen={showThemeSettings}
        onClose={() => setShowThemeSettings(false)}
        currentTheme={activeConvTheme}
        partnerName={activeContact?.name || "Friend"}
        partnerAvatar={activeContact?.avatar || ""}
        isGroup={!!activeContact?.isGroup}
        onApplyTheme={async (newTheme) => {
          setChatTheme(newTheme);
          if (activeConversation?.id) {
            try {
              await updateConversationTheme(
                activeConversation.id,
                newTheme,
                currentUser?.name,
                currentUser?.uid
              );
            } catch (err) {
              console.error("Theme update error:", err);
            }
          } else if (activeChat === "jarvis") {
            try {
              localStorage.setItem("jarvis_chat_theme", newTheme);
            } catch (e) {}
          }
        }}
      />

      {/* Sticker, GIF & Emoji Picker Modal */}
      <StickerPickerModal
        isOpen={showStickerModal}
        onClose={() => setShowStickerModal(false)}
        onSelectSticker={(url, type) => {
          handleSendStickerDirect(url, type);
        }}
        onSelectEmoji={(emoji) => {
          setInputText((prev) => prev + emoji);
          if (textareaRef.current) {
            textareaRef.current.focus();
          }
        }}
        currentUser={currentUser}
      />
    </div>
  );
}
