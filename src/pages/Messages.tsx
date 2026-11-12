import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import { createPortal } from "react-dom";
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
  SendHorizontal,
  X,
  Heart,
  Type,
  Music,
  MoreHorizontal,
  UserPlus,
  Bell,
  BellOff,
  Pin,
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
  FileText,
  Paperclip,
  Printer,
  Sticker as StickerIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PullToRefresh } from "../components/PullToRefresh";
import StoryNoteViewerModal from "../components/StoryNoteViewerModal";
import CreateGroupModal from "../components/CreateGroupModal";
import StatusNoteModal from "../components/StatusNoteModal";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";
import { subscribeNotifications } from "../services/notificationService";

import { VideoSticker } from "../components/VideoSticker";
import { useAppStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import { safeFile, formatTime, downloadMediaFile, formatMediaUrl } from "../utils";
import ChatMediaImage from "../components/ChatMediaImage";
import {
  subscribeConversations,
  subscribeMessages,
  sendMessage,
  createConversation,
  updateConversationTheme,
  deleteConversation,
} from "../services/chatService";
import { ChatThemeStudioModal } from "../components/ChatThemeStudioModal";
import { StickerPickerModal, StickerViewerModal } from "../components/StickerPickerModal";
import Notifications from "./Notifications";
import { ActivityStackView, FollowerStackView } from "../components/ActivityStackView";
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

// Stable id for optimistic messages. The same id is used as the Firestore
// document id, so retries on a slow network can never create duplicates.
const makeTempMessageId = (uid: string) =>
  `temp_${uid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

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
    const { setViewingUser, pushPage } = useAppStore(useShallow((s: any) => ({
      setViewingUser: s.setViewingUser,
      pushPage: s.pushPage
    })));

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
        className="flex items-center justify-between px-3.5 py-2.5 hover:bg-neutral-50 active:bg-neutral-100/70 border-b border-neutral-100/80 transition-colors cursor-pointer select-none"
        onClick={() => {
          setViewingUser({
            uid: realtimeUser.id || follower.id,
            name: realtimeUser.name || follower.name || "User",
            avatar: realtimeUser.avatar || follower.avatar,
          });
          pushPage("profile");
        }}
      >
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <img
            src={
              realtimeUser.avatar ||
              follower.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(realtimeUser.name || follower.name || "User")}&background=random`
            }
            className="w-11 h-11 rounded-full object-cover shrink-0 border border-neutral-100/80"
            alt="follower"
            referrerPolicy="no-referrer"
          />
          <div className="min-w-0 flex-1 pr-2">
            <p className="font-medium text-[13.5px] text-neutral-900 dark:text-neutral-100 truncate tracking-tight">
              {realtimeUser.name || follower.name || "New Follower"}
            </p>
            <p className="text-[11.5px] text-neutral-500 font-normal truncate mt-0.5">
              Started following you
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOptimisticFollowing(true);
            onFollowBack(follower);
          }}
          className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all  border-0 shrink-0 cursor-pointer ${
            isFriend
              ? "bg-neutral-100 text-neutral-800 hover:bg-neutral-200"
              : isActuallyFollowing
                ? "bg-neutral-100 text-neutral-800 hover:bg-neutral-200"
                : "bg-[#fe2c55] text-white hover:brightness-105 shadow-none"
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
              <video src={`${nextItem2.url}#t=0.001`} className="w-full h-full object-cover" preload="none" playsInline />
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
              <video src={`${nextItem1.url}#t=0.001`} className="w-full h-full object-cover" preload="none" playsInline />
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
              <video src={`${currentItem.url}#t=0.001`} className="w-full h-full object-cover" preload="none" playsInline />
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
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-black/50 hover:bg-black/75 backdrop-blur-md text-white border border-white/20 flex items-center justify-center shadow-md transition-all opacity-80 hover:opacity-100 cursor-pointer"
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
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-black/50 hover:bg-black/75 backdrop-blur-md text-white border border-white/20 flex items-center justify-center shadow-md transition-all opacity-80 hover:opacity-100 cursor-pointer"
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
            className="absolute bottom-2 right-2 z-20 p-1.5 bg-black/60 hover:bg-black/85 text-white rounded-full transition-all shadow-md backdrop-blur-xs"
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

const reelPostCache = new Map<string, any>();
const pendingReelRequests = new Map<string, Promise<any>>();

const ReelMessageBubble = React.memo(({
  msg,
  setViewingReel,
  setViewingReelContext,
}: {
  msg: any;
  setViewingReel: any;
  setViewingReelContext: any;
}) => {
  const cached = msg.postId ? reelPostCache.get(msg.postId) : null;
  const [reel, setReel] = React.useState<any>(cached || null);

  React.useEffect(() => {
    if (!msg.postId || reelPostCache.has(msg.postId)) return;
    let isMounted = true;
    if (!pendingReelRequests.has(msg.postId)) {
      const p = import("../services/postService")
        .then((s) => s.getPost(msg.postId))
        .then((fetchedReel) => {
          if (fetchedReel) reelPostCache.set(msg.postId, fetchedReel);
          return fetchedReel;
        })
        .catch(() => null);
      pendingReelRequests.set(msg.postId, p);
    }
    pendingReelRequests.get(msg.postId)!.then((res) => {
      if (isMounted && res) setReel(res);
    });
    return () => {
      isMounted = false;
    };
  }, [msg.postId]);

  const coverPic = reel?.thumbnailUrl || reel?.thumbnail || reel?.coverUrl || msg.thumbnailUrl || msg.coverUrl || reel?.media?.[0] || msg.mediaUrl;
  const isVideo = Boolean(coverPic && (coverPic.includes('.mp4') || coverPic.includes('.webm') || coverPic.includes('.mov') || coverPic.includes('video/')));

    return (
      <div className="flex flex-col max-w-[145px] will-change-transform">
        <div
          className="relative w-28 sm:w-32 aspect-[9/14] max-h-[165px] rounded-2xl overflow-hidden cursor-pointer bg-neutral-900 group border-0 transition-transform duration-150 shadow-none select-none"
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
                className="w-full h-full object-cover opacity-100 transition-transform duration-200"
                preload="none"
                muted
                playsInline
              />
            ) : (
              <img
                src={coverPic}
                className="w-full h-full object-cover opacity-100 transition-transform duration-200"
                alt="Reel cover"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-7 h-7 rounded-full bg-white/95 text-neutral-900 flex items-center justify-center transition-transform shadow-xs">
                <Play className="w-3.5 h-3.5 fill-neutral-900 translate-x-0.5" />
              </div>
            </div>
          </div>
          
          {/* Author pic and name inside corner overlay */}
          {(reel || msg.senderId) && (
            <div className="absolute top-1.5 left-1.5 z-20 flex items-center space-x-1 bg-black/65 backdrop-blur-xs px-1.5 py-0.5 rounded-full border border-white/20 select-none max-w-[90%]">
              <img
                src={reel?.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(reel?.authorName || "User")}&background=random`}
                className="w-3.5 h-3.5 rounded-full object-cover border border-white/40 shrink-0"
                alt={reel?.authorName || "User"}
                referrerPolicy="no-referrer"
              />
              <span className="text-[9.5px] text-white font-medium truncate leading-none">
                {reel?.authorName || "Reel"}
              </span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 px-2 py-1 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex items-center justify-between pointer-events-none z-10">
            <span className="text-[8.5px] text-white/90 font-bold tracking-wide uppercase">Reel</span>
            <Video
              className="w-3 h-3 text-white/90 drop-shadow-sm"
              strokeWidth={2}
            />
          </div>
        </div>
      </div>
    );
});

const MultipleReelsDeck = React.memo(({
  reels,
  setViewingReel,
  setViewingReelContext,
}: {
  reels: any[];
  setViewingReel: any;
  setViewingReelContext: any;
}) => {
  if (!reels || reels.length === 0) return null;

  // Subtle stylish fanned card angles: -5deg, 4deg, -2deg, 5deg, -3deg ("beke beke")
  const tiltAngles = [-5, 4, -2, 5, -3];

  return (
    <div className="flex flex-col will-change-transform select-none my-1 max-w-[320px]">
      <div className="relative flex items-center h-[170px] px-2 py-1 overflow-x-auto no-scrollbar scroll-smooth">
        {reels.map((item, i) => {
          const rotation = tiltAngles[i % tiltAngles.length];
          const coverPic = item.thumbnailUrl || item.thumbnail || item.coverUrl || item.mediaUrl || item.media?.[0];
          const isVid = Boolean(coverPic && (coverPic.includes('.mp4') || coverPic.includes('.webm') || coverPic.includes('.mov') || coverPic.includes('video/')));

          return (
            <div
              key={item.id || item.postId || i}
              onClick={(e) => {
                e.stopPropagation();
                setViewingReel({
                  id: item.postId || item.id,
                  authorId: item.senderId || item.authorId || '',
                  authorName: item.authorName || 'Reel',
                  authorAvatar: item.authorAvatar || '',
                  media: [coverPic],
                  text: item.text || '',
                  type: 'reel',
                  single: true,
                });
                setViewingReelContext('chat');
              }}
              style={{
                transform: `rotate(${rotation}deg) translateZ(0)`,
                marginLeft: i === 0 ? 0 : '-52px',
                zIndex: i + 1,
              }}
              className="relative w-28 sm:w-32 aspect-[9/14] max-h-[160px] rounded-2xl overflow-hidden cursor-pointer bg-neutral-900 border-2 border-white dark:border-neutral-800 shadow-[0_6px_20px_rgba(0,0,0,0.25)] hover:rotate-0 hover:z-40 transition-all duration-200 transform-gpu shrink-0 group"
            >
              {isVid ? (
                <video
                  src={`${coverPic}#t=0.001`}
                  className="w-full h-full object-cover pointer-events-none"
                  preload="none"
                  muted
                  playsInline
                />
              ) : (
                <img
                  src={coverPic}
                  className="w-full h-full object-cover pointer-events-none"
                  alt="Reel"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20 group-hover:bg-black/10 transition-colors">
                <div className="w-6 h-6 rounded-full bg-white/95 text-neutral-900 flex items-center justify-center shadow-xs">
                  <Play className="w-3 h-3 fill-neutral-900 translate-x-0.5" />
                </div>
              </div>
              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/75 rounded-md text-[9px] text-white font-bold flex items-center space-x-0.5 pointer-events-none">
                <Video className="w-2.5 h-2.5" />
                <span>Reel</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 mt-1 pl-1 flex items-center space-x-1">
        <span>🎬 {reels.length} Reels</span>
      </div>
    </div>
  );
});

const VoiceMessageBubble = ({ msg, isMe }: { msg: any; isMe: boolean; borderRadius?: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(msg.duration || msg.replyTo?.duration || 4);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 60fps smooth continuous scrubber animation without sudden jumps
  useEffect(() => {
    if (!isPlaying) return;
    let rafId: number;
    const smoothStep = () => {
      if (audioRef.current && !isNaN(audioRef.current.currentTime)) {
        setCurrentTime(audioRef.current.currentTime);
      }
      rafId = requestAnimationFrame(smoothStep);
    };
    rafId = requestAnimationFrame(smoothStep);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying]);

  // Deterministic, realistic human speech waveform amplitude envelope (natural peaks, troughs, pauses)
  const waveformHeights = useMemo(() => {
    if (Array.isArray(msg.waveform) && msg.waveform.length >= 16) {
      return msg.waveform;
    }
    const seedStr = (msg.id || '') + (msg.mediaUrl || '') + (msg.duration || '4');
    let hash = 0;
    for (let j = 0; j < seedStr.length; j++) {
      hash = (hash << 5) - hash + seedStr.charCodeAt(j);
      hash |= 0;
    }
    const count = 28;
    const bars: number[] = [];
    for (let i = 0; i < count; i++) {
      // Natural speech envelope: low start, speech peaks, intermittent natural breaths/pauses
      const pseudo = Math.abs(Math.sin((hash + i * 19) * 0.42));
      const pseudo2 = Math.abs(Math.cos((hash + i * 31) * 0.28));
      let height = Math.floor(22 + pseudo * 56 + pseudo2 * 22);
      if ((i + Math.abs(hash)) % 6 === 0) {
        height = Math.max(16, Math.floor(height * 0.32)); // speech pause
      }
      bars.push(Math.min(100, Math.max(18, height)));
    }
    return bars;
  }, [msg.id, msg.mediaUrl, msg.duration, msg.waveform]);

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
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    }
    return `0:${secs.toString().padStart(2, "0")}`;
  };

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      className={`px-3 py-2 inline-flex items-center space-x-2.5 min-w-[210px] sm:min-w-[240px] max-w-[285px] rounded-[22px] select-none transition-all relative ${
        isMe
          ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white"
          : "bg-neutral-100 dark:bg-[#1f242d] text-neutral-900 dark:text-white border border-neutral-200/80 dark:border-neutral-800"
      }`}
    >
      {/* Left Play/Pause Circular Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-8.5 h-8.5 rounded-full flex items-center justify-center shrink-0 cursor-pointer  transition-transform border-0 shadow-xs ${
          isMe
            ? "bg-white text-blue-600"
            : "bg-sky-500 text-white"
        }`}
        title={isPlaying ? "Pause voice message" : "Play voice message"}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Middle Waveform Line-by-Line Visualizer (Vertically centered in middle of box) */}
      <div className="flex-1 flex flex-col justify-center min-w-0 pr-1">
        <div 
          className="relative flex items-center justify-between h-7 w-full cursor-pointer py-0 select-none my-auto"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const pct = Math.max(0, Math.min(1, clickX / rect.width));
            if (audioRef.current && duration > 0) {
              const targetTime = pct * duration;
              audioRef.current.currentTime = targetTime;
              setCurrentTime(targetTime);
            }
          }}
        >
          {waveformHeights.map((h, i) => {
            const barProgress = (i / (waveformHeights.length - 1)) * 100;
            const isFilled = barProgress <= progressPct;
            return (
              <div
                key={i}
                className="flex items-center justify-center h-full px-[0.5px]"
              >
                <div
                  className={`w-[2.2px] sm:w-[2.6px] rounded-full transition-colors duration-150 ${
                    isFilled
                      ? isMe ? "bg-white" : "bg-sky-500 dark:bg-sky-400"
                      : isMe ? "bg-white/35" : "bg-neutral-300 dark:bg-neutral-700"
                  }`}
                  style={{
                    height: `${Math.max(16, h)}%`,
                  }}
                />
              </div>
            );
          })}

          {/* Scrubber Pip - Inside the waveform lines, strictly centered, continuous gliding dot */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none will-change-[left]"
            style={{ left: `${progressPct}%` }}
          >
            <div className={`w-2.5 h-2.5 rounded-full ${isMe ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]' : 'bg-sky-500 dark:bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]'}`} />
          </div>
        </div>

        {/* Right Bottom Voice Duration in Seconds (NO date/time) */}
        <div className="flex justify-end items-center pr-0.5">
          <span className={`text-[10px] font-mono font-medium tracking-tight ${isMe ? 'text-white/80' : 'text-neutral-500 dark:text-neutral-400'}`}>
            {formatSecs(isPlaying ? currentTime : duration)}
          </span>
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
  handleStartCall,
  onViewSticker
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
  onViewSticker?: (url: string, type?: 'image' | 'video' | 'animated') => void;
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
      className={`flex ${isMe ? "justify-end pr-0.5 sm:pr-1" : "justify-start pl-0.5 sm:pl-1"} ${isFirstInGroup ? "mt-2" : "mt-[1px]"} group relative touch-pan-y chat-msg-row-opt`}
      onContextMenu={(e) => onLongPress(e, msg.id)}
    >
      {!isMe && isLastInGroup && avatarUrl && (
        <img
          src={avatarUrl}
          className="w-7 h-7 rounded-full mr-1.5 self-end mb-0.5 object-cover shrink-0"
          alt="Avatar"
          loading="lazy"
        />
      )}
      {!isMe && !isLastInGroup && <div className="w-8.5 shrink-0"></div>}

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
        className={`flex flex-col max-w-[84%] sm:max-w-[80%] ${isMe ? "items-end" : "items-start"} relative group/bubble select-none`}
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
                     msg.replyTo.type === "reel" ? "Reel" : "Attachment")}
                </p>
              </div>
            </div>
          )}

          <div className="max-w-full relative">
            {(() => {
              if (msg.type === "reel" || msg.type === "reels" || msg.type === "multi_reel") {
                if (msg.reels && Array.isArray(msg.reels) && msg.reels.length > 1) {
                  return (
                    <MultipleReelsDeck
                      reels={msg.reels}
                      setViewingReel={setViewingReel}
                      setViewingReelContext={setViewingReelContext}
                    />
                  );
                }
                if (msg.mediaUrls && Array.isArray(msg.mediaUrls) && msg.mediaUrls.length > 1) {
                  return (
                    <MultipleReelsDeck
                      reels={msg.mediaUrls.map((url: string, idx: number) => ({
                        id: `${msg.id}_${idx}`,
                        postId: msg.postId,
                        mediaUrl: url,
                        authorName: senderName || "Reel",
                      }))}
                      setViewingReel={setViewingReel}
                      setViewingReelContext={setViewingReelContext}
                    />
                  );
                }
                return (
                  <ReelMessageBubble
                    msg={msg}
                    setViewingReel={setViewingReel}
                    setViewingReelContext={setViewingReelContext}
                  />
                );
              } else if (msg.type === "voice" || msg.type === "audio") {
                return (
                  <VoiceMessageBubble
                    msg={msg}
                    isMe={isMe}
                  />
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
                      preload="none"
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
                      className="absolute bottom-2 right-2 p-1.5 bg-black/60 hover:bg-black/85 text-white rounded-full transition-all shadow-md backdrop-blur-sm"
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
              } else if (msg.type === "document" || msg.fileName) {
                const fExt = (msg.fileExt || msg.fileName?.split('.').pop() || 'DOC').toUpperCase();
                const fName = msg.fileName || msg.content || "Document File";
                const mediaUser = senderInfo || { name: senderName || "User", avatar: avatarUrl || "" };
                const isMediaDoc = msg.mediaUrl && (
                  msg.mediaUrl.startsWith('data:image') || 
                  msg.mediaUrl.startsWith('data:video') || 
                  Boolean(msg.mediaUrl.match(/\.(jpg|jpeg|png|heic|heif|webp|gif|mp4|webm|mov)/i))
                );

                if (isMediaDoc) {
                  const isVidDoc = msg.mediaUrl?.startsWith('data:video') || Boolean(msg.mediaUrl?.match(/\.(mp4|webm|mov)/i));
                  return (
                    <div
                      className="relative group cursor-pointer rounded-2xl overflow-hidden max-w-[200px] sm:max-w-[220px] shadow-2xs border border-black/10 select-none transition-transform duration-200"
                      onClick={() =>
                        setViewingMedia({
                          type: isVidDoc ? "video" : "image",
                          url: msg.mediaUrl!,
                          user: mediaUser,
                          mediaList: [{ type: isVidDoc ? "video" : "image", url: msg.mediaUrl! }],
                          initialIndex: 0,
                        })
                      }
                    >
                      {isVidDoc ? (
                        <div className="relative w-full h-36 bg-black flex items-center justify-center">
                          <video
                            src={msg.mediaUrl}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                          />
                          <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                            <div className="w-8.5 h-8.5 rounded-full bg-white/90 text-neutral-900 flex items-center justify-center shadow-xs">
                              <Play className="w-4 h-4 fill-neutral-900 translate-x-0.5" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={msg.mediaUrl}
                          alt="Document media"
                          className="w-full h-auto max-h-[200px] object-cover transition-transform duration-300"
                          loading="lazy"
                        />
                      )}

                      {/* Small Document Badge top left */}
                      <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 backdrop-blur-md text-white rounded-lg flex items-center space-x-1 border border-white/20 shadow-xs">
                        <FileText className="w-3 h-3 text-neutral-300" />
                        <span className="text-[9px] font-bold tracking-wider uppercase">{fExt}</span>
                      </div>

                      {/* Download button bottom right */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadMediaFile(msg.mediaUrl!, fName);
                        }}
                        className="absolute bottom-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-full transition-all shadow-xs backdrop-blur-sm border-0 cursor-pointer"
                        title="Download File"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div className={`flex items-center space-x-2 p-2 rounded-2xl ${isMe ? 'bg-neutral-900 dark:bg-black text-white dark:border dark:border-white/30' : 'bg-neutral-100 dark:bg-black text-neutral-900 dark:text-white border border-neutral-200/80 dark:border-white/30'} max-w-[185px] sm:max-w-[200px] select-none shadow-none`}>
                    <div className={`w-7.5 h-7.5 rounded-xl flex items-center justify-center shrink-0 ${isMe ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-800'}`}>
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate leading-tight">{fName}</p>
                      <span className="text-[9px] opacity-75 uppercase">{fExt}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadMediaFile(msg.mediaUrl || msg.content, fName);
                      }}
                      className="p-1 rounded-lg bg-black/10 hover:bg-black/20 text-current transition-all border-0 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                );
              } else if (msg.type === "image") {
                const mediaUser = senderInfo || { name: senderName || "User", avatar: avatarUrl || "" };
                return (
                  <div
                    className="relative group cursor-pointer rounded-2xl overflow-hidden w-[70vw] max-w-[280px] bg-neutral-900/5 border border-neutral-200/70 select-none shadow-xs"
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
                    <ChatMediaImage
                      src={msg.mediaUrl}
                      alt="Sent image"
                      imgClassName="w-full max-h-[320px] object-cover transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-black/15 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <div className="bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm">
                        View
                      </div>
                    </div>
                    {/* Quick Download button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadMediaFile(msg.mediaUrl!, `photo_${msg.id || Date.now()}.jpg`);
                      }}
                      className="absolute bottom-1.5 right-1.5 p-1 bg-black/60 hover:bg-black/85 text-white rounded-full transition-all shadow-xs backdrop-blur-sm border-0 cursor-pointer"
                      title="Download Photo"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                );
              } else if (
                msg.type === "sticker" || 
                !!msg.stickerUrl || 
                (!!msg.mediaUrl && (msg.content === "Sent a sticker" || msg.content === "Sticker" || msg.mediaUrl.includes("/stickers/"))) ||
                (msg.content === "Sent a sticker" && !!msg.mediaUrl)
              ) {
                let stickerSrc = msg.stickerUrl || msg.mediaUrl || "";
                if (!stickerSrc && msg.content && (msg.content.startsWith("http") || msg.content.startsWith("/") || msg.content.startsWith("data:"))) {
                  stickerSrc = msg.content;
                }
                if (stickerSrc.includes("/uploads/")) {
                  stickerSrc = `/uploads/${stickerSrc.split("/uploads/")[1]}`;
                }
                const isVideoSticker = msg.stickerType === "video" || (stickerSrc && (stickerSrc.includes(".mp4") || stickerSrc.includes(".webm") || stickerSrc.includes(".mov")));
                return (
                  <div
                    className="relative group/stk cursor-pointer transition-all duration-200 max-w-[210px] sm:max-w-[240px] select-none bg-transparent border-0 shadow-none outline-none"
                    onClick={() => {
                      if (onViewSticker && stickerSrc) {
                        onViewSticker(stickerSrc, isVideoSticker ? 'video' : 'image');
                      }
                    }}
                    onContextMenu={(e) => onContextMenu(e, msg.id)}
                    title="Click for Sticker preview and actions"
                  >
                    {isVideoSticker ? (
                      <div className="w-40 h-40 sm:w-48 sm:h-48 overflow-hidden bg-transparent border-0 shadow-none flex items-center justify-center">
                        <VideoSticker
                          src={stickerSrc}
                          className="w-full h-full object-contain rounded-2xl pointer-events-none bg-transparent border-0 shadow-none"
                        />
                      </div>
                    ) : (
                      <div className="w-40 h-40 sm:w-48 sm:h-48 overflow-hidden bg-transparent border-0 shadow-none flex items-center justify-center">
                        <ChatMediaImage
                          src={stickerSrc}
                          alt="Sticker"
                          imgClassName="w-full h-full object-contain pointer-events-none select-none rounded-2xl bg-transparent border-0 shadow-none"
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
                  <div className={`p-3 rounded-2xl flex flex-col space-y-2 max-w-[225px] select-none border-0 shadow-none ${
                    isMissed || isDeclined 
                      ? "bg-rose-50 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200" 
                      : isMe 
                        ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white" 
                        : "bg-[#F2F4F7] dark:bg-[#27272A] text-neutral-900 dark:text-white"
                  }`}>
                    <div className="flex items-center space-x-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        isMissed || isDeclined 
                          ? "bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400" 
                          : isMe 
                            ? "bg-white/20 text-white" 
                            : "bg-purple-100 dark:bg-white/10 text-purple-700 dark:text-white"
                      }`}>
                        {isVideoCall ? <Video className="w-4 h-4" /> : (isMissed || isDeclined) ? <PhoneOff className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-[13px] truncate leading-tight text-neutral-900 dark:text-white">{mainLabel}</h4>
                        {durationLabel && (
                          <p className={`text-[11px] font-medium mt-0.5 ${
                            isMissed || isDeclined 
                              ? "text-rose-600 dark:text-rose-400" 
                              : isMe 
                                ? "text-white/80" 
                                : "text-neutral-500 dark:text-neutral-400"
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
                        className={`w-full py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all  border-0 cursor-pointer shadow-none ${
                          isMe 
                            ? "bg-white/20 hover:bg-white/30 text-white" 
                            : "bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-800 dark:text-white"
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
                    className={`px-3.5 py-2 text-[15px] leading-snug whitespace-pre-wrap break-words inline-block ${borderRadius} border-0 shadow-none font-normal ${
                      isMe 
                        ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white" 
                        : "bg-[#F2F4F7] dark:bg-[#27272A] text-neutral-900 dark:text-white"
                    }`}
                  >
                    {msg.content}
                  </div>
                );
              }
            })()}
          </div>

          {(msg as any).reaction && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleReaction(msg.id, (msg as any).reaction);
              }}
              title="Click to remove reaction"
              className={`absolute -bottom-2 ${isMe ? "right-1.5" : "left-1.5"} text-[15px] z-20 bg-transparent border-0 p-0 shadow-none outline-none select-none cursor-pointer   transition-transform`}
            >
              {(msg as any).reaction}
            </button>
          )}
        </div>

        {/* Seen text animation: soft smooth glide and fade-in */}
        {seenStr && (
          <motion.div
            key="seen-indicator"
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="text-[10.5px] text-gray-400 dark:text-zinc-400 font-normal select-none self-end mt-0.5 pr-1 overflow-hidden flex items-center space-x-1 transition-colors"
          >
            <CheckCheck className="w-3 h-3 text-purple-500/80 inline" />
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

let canvasCache: HTMLCanvasElement | null = null;
const getTextWidth = (text: string, font = '15px system-ui, -apple-system, sans-serif'): number => {
  if (typeof document === 'undefined') return text.length * 8.5;
  if (!canvasCache) {
    canvasCache = document.createElement('canvas');
  }
  const context = canvasCache.getContext('2d');
  if (!context) return text.length * 8.5;
  context.font = font;
  return context.measureText(text).width;
};

export default function Messages() {
  // useShallow keeps this screen from re-rendering on every unrelated store
  // change (uploads, media viewer, nav state...). Before, the whole chat
  // screen re-rendered whenever anything in the store changed, which made
  // scrolling and typing stutter.
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
    setActiveCallState,
    followingIds,
    setFollowingIds,
    followerIds
  } = useAppStore(useShallow((s: any) => ({
    chatTheme: s.chatTheme,
    setChatTheme: s.setChatTheme,
    setViewingUser: s.setViewingUser,
    viewingStory: s.viewingStory,
    setViewingStory: s.setViewingStory,
    activeChat: s.activeChat,
    setActiveChat: s.setActiveChat,
    currentUser: s.currentUser,
    pushPage: s.pushPage,
    lastCheckedActivity: s.lastCheckedActivity,
    setLastCheckedActivity: s.setLastCheckedActivity,
    lastCheckedFollowers: s.lastCheckedFollowers,
    setLastCheckedFollowers: s.setLastCheckedFollowers,
    setViewingReel: s.setViewingReel,
    setViewingReelContext: s.setViewingReelContext,
    setViewingMedia: s.setViewingMedia,
    cachedChatMessages: s.cachedChatMessages,
    setCachedChatMessages: s.setCachedChatMessages,
    cachedConversations: s.cachedConversations,
    setCachedConversations: s.setCachedConversations,
    setIsBottomNavHidden: s.setIsBottomNavHidden,
    setActiveCallState: s.setActiveCallState,
    followingIds: s.followingIds,
    setFollowingIds: s.setFollowingIds,
    followerIds: s.followerIds
  })));

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
  const [shatteredLetters, setShatteredLetters] = useState<
    { id: string; char: string; x: number; rot: number; dx: number; dy: number; size?: number; color?: string }[]
  >([]);
  const [typedPops, setTypedPops] = useState<{ id: string; char: string; x: number }[]>([]);
  const [conversationThemeOverrides, setConversationThemeOverrides] = useState<
    Record<string, { theme?: string; blur?: boolean; brightness?: number }>
  >(() => {
    try {
      return JSON.parse(localStorage.getItem('chat_theme_overrides') || '{}');
    } catch {
      return {};
    }
  });
  const [showAttachMenu, setShowAttachMenu] = useState(false);
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
  const activityTouchStartXRef = useRef<number | null>(null);
  const activityTouchStartYRef = useRef<number | null>(null);
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

  const [confirmAction, setConfirmAction] = useState<{
    type: 'clear_chat' | 'delete_friend' | 'delete_chat';
    convId: string;
    otherUid?: string;
    friendName: string;
  } | null>(null);

  // Hide mobile bottom navigation bar when context menu or confirmation modal is open
  useEffect(() => {
    if (chatContextMenu || confirmAction) {
      setIsBottomNavHidden(true);
    } else {
      if (!activeChat) {
        setIsBottomNavHidden(false);
      }
    }
  }, [chatContextMenu, confirmAction, activeChat, setIsBottomNavHidden]);

  useEffect(() => {
    return () => {
      setIsBottomNavHidden(false);
    };
  }, [setIsBottomNavHidden]);

  const [pinnedChatIds, setPinnedChatIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("ennvo_pinned_chats") || "[]");
    } catch {
      return [];
    }
  });

  const [mutedChatIds, setMutedChatIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("ennvo_muted_chats") || "[]");
    } catch {
      return [];
    }
  });

  const togglePinChat = (convId: string) => {
    setPinnedChatIds((prev) => {
      const isPinned = prev.includes(convId);
      const next = isPinned ? prev.filter((id) => id !== convId) : [convId, ...prev];
      try {
        localStorage.setItem("ennvo_pinned_chats", JSON.stringify(next));
      } catch (_) {}
      return next;
    });
    setChatContextMenu(null);
  };

  const toggleMuteChat = (convId: string) => {
    setMutedChatIds((prev) => {
      const isMuted = prev.includes(convId);
      const next = isMuted ? prev.filter((id) => id !== convId) : [convId, ...prev];
      try {
        localStorage.setItem("ennvo_muted_chats", JSON.stringify(next));
      } catch (_) {}
      return next;
    });
    setChatContextMenu(null);
  };
  const [activityTab, setActivityTab] = useState<"activity" | "followers">("activity");
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : false
  );

  // ---- PC only: draggable divider between the chat list and the conversation ----
  const SIDEBAR_MIN = 300;
  const SIDEBAR_MAX = 620;
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem("ennvo_messages_sidebar_w"));
      if (saved >= SIDEBAR_MIN && saved <= SIDEBAR_MAX) return saved;
    } catch (e) {}
    return typeof window !== "undefined" && window.innerWidth >= 1280 ? 410 : 380;
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const sidebarDragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const sidebarWidthRef = useRef<number>(sidebarWidth);
  sidebarWidthRef.current = sidebarWidth;

  const applySidebarWidth = (next: number) => {
    const clamped = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(next)));
    setSidebarWidth(clamped);
    return clamped;
  };

  const handleSidebarResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDesktop) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
    sidebarDragRef.current = { startX: e.clientX, startWidth: sidebarWidth };
    setIsResizingSidebar(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const handleSidebarResizeEnd = (e?: React.PointerEvent<HTMLDivElement>) => {
    if (!sidebarDragRef.current) return;
    sidebarDragRef.current = null;
    setIsResizingSidebar(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    try {
      e?.currentTarget?.releasePointerCapture?.(e.pointerId as number);
    } catch (err) {}
    try {
      localStorage.setItem("ennvo_messages_sidebar_w", String(sidebarWidthRef.current));
    } catch (err) {}
  };

  const resetSidebarWidth = () => {
    const next = applySidebarWidth(380);
    try {
      localStorage.setItem("ennvo_messages_sidebar_w", String(next));
    } catch (err) {}
  };

  // Global listeners keep the drag alive even when the pointer leaves the handle.
  useEffect(() => {
    if (!isResizingSidebar) return;
    const onMove = (ev: PointerEvent) => {
      const drag = sidebarDragRef.current;
      if (!drag) return;
      applySidebarWidth(drag.startWidth + (ev.clientX - drag.startX));
    };
    const onUp = () => handleSidebarResizeEnd();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingSidebar]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const [showThemeSettings, setShowThemeSettings] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showPrivacySheet, setShowPrivacySheet] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [selectedMediaItems, setSelectedMediaItems] = useState<{ id: string; type: 'image' | 'video'; url: string; name?: string; file?: File }[]>([]);
  const selectedImagePreview = selectedMediaItems.length > 0 ? selectedMediaItems[0].url : null;
  const selectedMediaType = selectedMediaItems.length > 0 ? selectedMediaItems[0].type : "image";
  const [showSharedMedia, setShowSharedMedia] = useState(false);
  const [sharedMediaTab, setSharedMediaTab] = useState<"all" | "media" | "reels">("all");
  const [viewportBottomOffset, setViewportBottomOffset] = useState(0);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [liveVolumeLevels, setLiveVolumeLevels] = useState<number[]>(() => [8, 14, 10, 18, 12, 22, 16, 24, 14, 20, 12, 18, 8, 14]);
  const audioContextRef = useRef<any>(null);
  const analyserRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const [viewingStickerUrl, setViewingStickerUrl] = useState<string | null>(null);
  const [viewingStickerType, setViewingStickerType] = useState<'image' | 'video' | 'animated'>('image');
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
      if (messagesContainerRef.current && (shouldAutoScrollRef.current || offset > 0)) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
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
  const [groupName, setGroupName] = useState("");
  const [selectedGroupUserIds, setSelectedGroupUserIds] = useState<string[]>([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupCreateError, setGroupCreateError] = useState<string | null>(null);

  const [showStatusInput, setShowStatusInput] = useState(false);
  const [statusNoteMode, setStatusNoteMode] = useState<"create" | "edit">("create");
  const [statusNoteText, setStatusNoteText] = useState("");
  const [viewingNoteUser, setViewingNoteUser] = useState<{
    id: string;
    name: string;
    avatar: string;
    username?: string;
    statusNote: string;
    timestamp?: number;
  } | null>(null);

  useEffect(() => {
    if (showCreateGroup || showStatusInput || viewingNoteUser) {
      setIsBottomNavHidden(true);
      return () => {
        setIsBottomNavHidden(false);
      };
    }
  }, [showCreateGroup, showStatusInput, viewingNoteUser, setIsBottomNavHidden]);

  useEffect(() => {
    if (!showPrivacySheet && !showCreateGroup && !showThemeSettings && !showChatSettings && !viewingStickerUrl && !viewingNoteUser && selectedMediaItems.length === 0 && !showSharedMedia && !isSearchExpanded) return;
    const handleBack = (e: Event) => {
      e.preventDefault();
      if (viewingNoteUser) setViewingNoteUser(null);
      else if (viewingStickerUrl) setViewingStickerUrl(null);
      else if (showPrivacySheet) setShowPrivacySheet(false);
      else if (showCreateGroup) setShowCreateGroup(false);
      else if (showThemeSettings) setShowThemeSettings(false);
      else if (showChatSettings) setShowChatSettings(false);
      else if (selectedMediaItems.length > 0) setSelectedMediaItems([]);
      else if (showSharedMedia) setShowSharedMedia(false);
      else if (isSearchExpanded) { setIsSearchExpanded(false); setSearchQuery(""); }
    };
    window.addEventListener('appBackPress', handleBack);
    return () => window.removeEventListener('appBackPress', handleBack);
  }, [showPrivacySheet, showCreateGroup, showThemeSettings, showChatSettings, viewingStickerUrl, viewingNoteUser, selectedMediaItems, showSharedMedia, isSearchExpanded]);

  const availableGroupCandidates = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; avatar: string; username?: string }>();
    followers.forEach((f) => {
      const fid = f.id as string;
      if (fid && fid !== currentUser?.uid) {
        map.set(fid, {
          id: fid,
          name: f.name || f.username || "Friend",
          avatar: f.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(f.name || "Friend")}&background=random`,
          username: f.username,
        });
      }
    });
    conversations.forEach((c) => {
      if (!c.isGroup && c.participantIds) {
        c.participantIds.forEach((id: string) => {
          if (id && id !== currentUser?.uid && !map.has(id)) {
            const p = c.participants?.[id] || userDataCache[id];
            map.set(id, {
              id,
              name: p?.name || "Friend",
              avatar: p?.avatar || `https://ui-avatars.com/api/?name=User&background=random`,
            });
          }
        });
      }
    });
    Object.entries(userDataCache).forEach(([uid, u]: [string, any]) => {
      if (uid !== currentUser?.uid && !map.has(uid)) {
        map.set(uid, {
          id: uid,
          name: u?.name || "Friend",
          avatar: u?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u?.name || "Friend")}&background=random`,
        });
      }
    });
    return Array.from(map.values());
  }, [followers, conversations, userDataCache, currentUser?.uid]);

  const handleNoteReply = async (targetUserId: string, messageText: string, noteText: string) => {
    if (!currentUser) return;
    const { createConversation, sendMessage } = await import("../services/chatService");
    
    let targetConv = conversations.find(
      (c) => !c.isGroup && c.participantIds?.includes(targetUserId) && c.participantIds?.length === 2
    );
    let convId = targetConv?.id;
    if (!convId) {
      const targetUser = userDataCache[targetUserId] || followers.find((f) => f.id === targetUserId);
      convId = await createConversation(
        [currentUser.uid, targetUserId],
        {
          [currentUser.uid]: {
            name: currentUser.name || "User",
            avatar: currentUser.avatar || "",
          },
          [targetUserId]: {
            name: targetUser?.name || "User",
            avatar: targetUser?.avatar || "",
          },
        }
      );
    }
    
    const formattedContent = `💬 Replying to note: "${noteText}"\n${messageText}`;
    await sendMessage(convId, currentUser.uid, "text", formattedContent);
  };

  const handleNoteReaction = async (targetUserId: string, emoji: string, noteText: string) => {
    if (!currentUser) return;
    const { createConversation, sendMessage } = await import("../services/chatService");
    
    let targetConv = conversations.find(
      (c) => !c.isGroup && c.participantIds?.includes(targetUserId) && c.participantIds?.length === 2
    );
    let convId = targetConv?.id;
    if (!convId) {
      const targetUser = userDataCache[targetUserId] || followers.find((f) => f.id === targetUserId);
      convId = await createConversation(
        [currentUser.uid, targetUserId],
        {
          [currentUser.uid]: {
            name: currentUser.name || "User",
            avatar: currentUser.avatar || "",
          },
          [targetUserId]: {
            name: targetUser?.name || "User",
            avatar: targetUser?.avatar || "",
          },
        }
      );
    }
    
    await sendMessage(convId, currentUser.uid, "text", `Reacted ${emoji} to your note: "${noteText}"`);
  };

  const [showStickerModal, setShowStickerModal] = useState(false);
  const [communityStickersCache, setCommunityStickersCache] = useState<any[]>([]);

  useEffect(() => {
    if (showStickerModal && messagesContainerRef.current) {
      setTimeout(() => {
        messagesContainerRef.current?.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: "auto"
        });
      }, 100);
    }
  }, [showStickerModal]);

  const [offlineWallpaperUrl, setOfflineWallpaperUrl] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ennvo_offline_wallpaper_b64") || "/chat-background.jpg";
    }
    return "/chat-background.jpg";
  });

  useEffect(() => {
    fetchCommunityStickers().then(setCommunityStickersCache).catch(() => {});
    if (typeof window !== "undefined") {
      const cachedB64 = localStorage.getItem("ennvo_offline_wallpaper_b64");
      if (!cachedB64) {
        fetch("/chat-background.jpg")
          .then((res) => res.blob())
          .then((blob) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              if (typeof reader.result === "string") {
                try {
                  localStorage.setItem("ennvo_offline_wallpaper_b64", reader.result);
                  setOfflineWallpaperUrl(reader.result);
                } catch (e) {}
              }
            };
            reader.readAsDataURL(blob);
          })
          .catch(() => {});
      }
    }
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

    let cleanStickerUrl = stickerUrl;
    if (cleanStickerUrl.includes('/uploads/')) {
      cleanStickerUrl = `/uploads/${cleanStickerUrl.split('/uploads/')[1]}`;
    }

    // Optimistic message in UI
    const tempId = makeTempMessageId(currentUser.uid);
    const optMsg: any = {
      id: tempId,
      tempId: tempId,
      senderId: currentUser.uid,
      type: 'sticker',
      content: cleanStickerUrl,
      mediaUrl: cleanStickerUrl,
      stickerUrl: cleanStickerUrl,
      stickerType: stickerType || 'image',
      createdAt: { toMillis: () => Date.now() },
      status: 'sent',
      pending: true,
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
        cleanStickerUrl,
        cleanStickerUrl,
        undefined,
        replyData,
        { clientMessageId: tempId }
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
  const isPagingRef = useRef(false);
  const isSendingMsgRef = useRef(false);

  const startRecording = async () => {
    isCanceledRef.current = false;
    // Immediate 0ms synchronous UI transition for lag-free responsiveness
    setIsRecording(true);
    setRecordingDuration(0);
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    durationIntervalRef.current = setInterval(() => {
      setRecordingDuration((prev) => prev + 1);
    }, 1000);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (isCanceledRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      // Initialize real Web Audio Analyser for live visualizer
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          if (ctx.state === 'suspended') {
            await ctx.resume().catch(() => {});
          }
          audioContextRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          analyser.smoothingTimeConstant = 0.5;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateLiveMeter = () => {
            if (isCanceledRef.current) return;
            analyser.getByteFrequencyData(dataArray);
            
            // Calculate overall mic energy
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avgEnergy = sum / dataArray.length;
            const boost = Math.min(1.5, Math.max(0.6, avgEnergy / 30));

            const barsCount = 20;
            const step = Math.max(1, Math.floor(dataArray.length / barsCount));
            const levels: number[] = [];
            for (let i = 0; i < barsCount; i++) {
              const val = dataArray[i * step] || 0;
              // Map 0-255 with dynamic boost to 4px - 24px height
              const scaled = Math.round((val / 255) * 22 * boost);
              const h = Math.max(4, Math.min(24, scaled));
              levels.push(h);
            }
            setLiveVolumeLevels(levels);
            animFrameRef.current = requestAnimationFrame(updateLiveMeter);
          };
          animFrameRef.current = requestAnimationFrame(updateLiveMeter);
        }
      } catch (meterErr) {
        console.warn("Audio meter setup:", meterErr);
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }
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
            const tempVoiceId = makeTempMessageId(currentUser.uid);
            const optVoiceMsg = {
              id: tempVoiceId,
              tempId: tempVoiceId,
              senderId: currentUser.uid,
              type: "voice",
              content: "",
              mediaUrl: dataUrl,
              duration: Math.max(1, recordingDuration),
              createdAt: { toMillis: () => Date.now() },
              status: "sent",
              pending: true
            };
            setMessagesCache((prev) => ({
              ...prev,
              [activeChat]: [...(prev[activeChat] || []), optVoiceMsg]
            }));
            sendMessage(
              activeChat,
              currentUser.uid,
              "voice",
              "Sent a voice message",
              dataUrl,
              undefined,
              undefined,
              { duration: Math.max(1, recordingDuration), clientMessageId: tempVoiceId }
            ).catch(console.error);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
    } catch (err) {
      console.warn("Microphone hardware fallback activated", err);
    }
  };

  const stopRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      } else if (!isCanceledRef.current) {
        const synthUrl = "https://actions.google.com/sounds/v1/ambiences/outdoor_park.ogg";
        if (activeChat && currentUser) {
          const tempVoiceId = makeTempMessageId(currentUser.uid);
          const optVoiceMsg = {
            id: tempVoiceId,
            tempId: tempVoiceId,
            senderId: currentUser.uid,
            type: "voice",
            content: "",
            mediaUrl: synthUrl,
            duration: Math.max(1, recordingDuration),
            createdAt: { toMillis: () => Date.now() },
            status: "sent",
            pending: true
          };
          setMessagesCache((prev) => ({
            ...prev,
            [activeChat]: [...(prev[activeChat] || []), optVoiceMsg]
          }));
          sendMessage(
            activeChat,
            currentUser.uid,
            "voice",
            "Sent a voice message",
            synthUrl,
            undefined,
            undefined,
            { duration: Math.max(1, recordingDuration), clientMessageId: tempVoiceId }
          ).catch(console.error);
        }
      }
    }
  };

  const cancelRecording = () => {
    isCanceledRef.current = true;
    setIsRecording(false);
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
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

  const compressImageFileToSafeBase64 = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          try {
            // Adaptive scaling based on original file size
            const isVeryLarge = file.size > 2 * 1024 * 1024;
            let MAX_DIM = isVeryLarge ? 750 : 850;
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
            canvas.width = Math.max(1, width);
            canvas.height = Math.max(1, height);
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              let dataUrl = canvas.toDataURL("image/jpeg", 0.65);
              // If base64 is still over 80KB, downscale more to guarantee Firestore safety
              if (dataUrl.length > 80000) {
                const smallCanvas = document.createElement("canvas");
                smallCanvas.width = Math.max(1, Math.round(width * 0.75));
                smallCanvas.height = Math.max(1, Math.round(height * 0.75));
                const sCtx = smallCanvas.getContext("2d");
                if (sCtx) {
                  sCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
                  dataUrl = smallCanvas.toDataURL("image/jpeg", 0.5);
                }
              }
              resolve(dataUrl);
            } else {
              resolve((event.target?.result as string) || '');
            }
          } catch (e) {
            resolve((event.target?.result as string) || '');
          }
        };
        img.onerror = () => resolve((event.target?.result as string) || '');
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

    const newItems: { id: string; type: 'image' | 'video'; url: string; name?: string; file?: File }[] = [];

    for (const file of files) {
      const isVideo = file.type.startsWith("video/");
      const previewUrl = URL.createObjectURL(file);
      newItems.push({
        id: (isVideo ? 'vid_' : 'img_') + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        type: isVideo ? "video" : "image",
        url: previewUrl,
        name: file.name,
        file: file
      });
    }

    setSelectedMediaItems((prev) => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const docInputRef = useRef<HTMLInputElement>(null);

  const handleDocumentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.target.files || []);
    if (files.length === 0 || !activeChat || !currentUser) return;

    for (const file of files) {
      const extParts = file.name.split('.');
      const ext = extParts.length > 1 ? extParts.pop()!.toUpperCase() : 'FILE';
      let sizeStr = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
      if (file.size < 1024 * 1024) {
        sizeStr = `${Math.round(file.size / 1024)} KB`;
      }

      let docUrl = '';
      try {
        const { uploadMedia } = await import('../services/githubStorage');
        docUrl = await uploadMedia(file, 'chat_documents');
      } catch (err) {
        docUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.onerror = () => resolve('');
          reader.readAsDataURL(file);
        });
      }

      if (docUrl) {
        const tempId = makeTempMessageId(currentUser.uid);
        const replyData = replyingTo ? {
          messageId: replyingTo.id,
          senderName: userDataCache[replyingTo.senderId]?.name || 'User',
          text: replyingTo.content,
          type: replyingTo.type
        } : undefined;

        const optMsg = {
          id: tempId,
          tempId,
          senderId: currentUser.uid,
          type: 'document',
          content: file.name,
          mediaUrl: docUrl,
          fileName: file.name,
          fileSize: sizeStr,
          fileExt: ext,
          createdAt: { toMillis: () => Date.now() },
          status: 'sent',
          pending: true,
          replyTo: replyData
        };

        setMessagesCache((prev) => ({
          ...prev,
          [activeChat]: [...(prev[activeChat] || []), optMsg]
        }));

        await sendMessage(
          activeChat,
          currentUser.uid,
          'document' as any,
          file.name,
          docUrl,
          undefined,
          replyData,
          {
            fileName: file.name,
            fileSize: sizeStr,
            fileExt: ext,
            clientMessageId: tempId
          }
        );
      }
    }
    if (docInputRef.current) docInputRef.current.value = "";
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

  // Only watch profiles that are actually visible: the other person in each
  // direct chat, plus the members of the currently open group. Watching every
  // member of every group made slow networks open dozens of live listeners.
  const watchedProfileIds = React.useMemo(() => {
    if (!currentUser) return [] as string[];
    const ids = new Set<string>();

    conversations.forEach((conv: any) => {
      const isGroup = Boolean(conv.isGroup || conv.participantIds?.length > 2);
      if (!isGroup || conv.id === activeChat) {
        conv.participantIds?.forEach((id: string) => {
          if (id && id !== currentUser.uid) ids.add(id);
        });
      }
    });

    if (activeChat && activeChat !== "jarvis" && activeChat !== "followers" && activeChat !== "activity" && activeChat !== "requests") {
      const activeConv: any = conversations.find((c: any) => c.id === activeChat);
      const directUid = activeConv?.participantIds?.find((id: string) => id !== currentUser.uid);
      if (directUid) ids.add(directUid);
      else if (!activeConv && activeChat.length > 10) ids.add(activeChat);
    }

    return Array.from(ids).sort();
  }, [conversations, currentUser, activeChat]);

  const watchedProfileKey = watchedProfileIds.join("|");

  // Listen in REAL-TIME to user profile changes for visible participants
  useEffect(() => {
    if (!currentUser) return;
    const unsubs: (() => void)[] = [];

    watchedProfileIds.forEach((uid) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedProfileKey, currentUser?.uid]);

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
            const isOptimistic = Boolean(m.pending) || m.id.startsWith('temp_');
            if (!isOptimistic) return false;
            // Exact id match: the Firestore document uses the optimistic id,
            // so the real message has already replaced this one.
            if (newMsgIds.has(m.id) || (m.tempId && newMsgIds.has(m.tempId))) return false;
            // Legacy heuristic for messages sent by older builds
            const isSynced = newMsgs.some(nm =>
              nm.senderId === m.senderId &&
              (nm.type === m.type || (nm.type === 'image' && m.type === 'image')) &&
              (
                nm.content === m.content ||
                (m.mediaUrl && nm.mediaUrl && (nm.mediaUrl === m.mediaUrl || nm.mediaUrl.includes(m.mediaUrl.split('/').pop() || 'xyz'))) ||
                (m.type === 'image' || m.type === 'video' || m.type === 'sticker')
              ) &&
              Math.abs((nm.createdAt?.toMillis?.() || Date.now()) - (m.createdAt?.toMillis?.() || Date.now())) < 30000
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

          // Keep a stable chronological order. Server messages are sorted by
          // createdAt; optimistic (not yet acknowledged) messages always stay at
          // the bottom. Without this the list re-ordered itself on every snapshot
          // and messages visibly jumped around.
          const isPending = (m: any) => Boolean(m?.pending) || String(m?.id || '').startsWith('temp_');
          const timeOf = (m: any) => {
            const c = m?.createdAt;
            if (!c) return 0;
            if (typeof c?.toMillis === 'function') return c.toMillis();
            if (typeof c?.seconds === 'number') return c.seconds * 1000;
            if (typeof c === 'number') return c;
            const parsed = Date.parse(String(c));
            return Number.isFinite(parsed) ? parsed : 0;
          };
          const confirmed = merged.filter((m: any) => !isPending(m));
          const pending = merged.filter((m: any) => isPending(m));
          confirmed.sort((a: any, b: any) => {
            const diff = timeOf(a) - timeOf(b);
            if (diff !== 0) return diff;
            return String(a.id || a.tempId || '').localeCompare(String(b.id || b.tempId || ''));
          });

          // The live subscription only knows the newest messages. The older
          // ones that were loaded with the "load older" action are kept, so
          // scrolling back through the history does not throw them away.
          const oldestLoaded = confirmed.length ? timeOf(confirmed[0]) : Number.MAX_SAFE_INTEGER;
          const older = currentCached.filter(
            (m: any) => !isPending(m) && timeOf(m) < oldestLoaded
          );

          return { ...prev, [activeChat]: [...older, ...confirmed, ...pending] };
        });
        if (currentUser) {
          // Only the messages that actually need it are marked as seen. The
          // previous version read and rewrote 25 documents for every single
          // incoming message, which delayed the next snapshot.
          const unseen = newMsgs
            .filter((m: any) => m.senderId !== currentUser.uid && m.status !== 'seen')
            .map((m: any) => m.id)
            .filter(Boolean);
          if (unseen.length) {
            import("../services/chatService").then((m) =>
              m.markConversationRead(activeChat, currentUser.uid, unseen),
            );
          }
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
          behavior: 'auto'
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
          behavior: 'auto'
        });
      }
    }
  }, [replyingTo]);

  useEffect(() => {
    if (!currentUser) return;
    const currentUnsubs = subscribedPresenceRef.current;
    
    // Subscribe presence for all conversation participants
    conversations.forEach((conv) => {
      const otherId = conv.participantIds?.find((id) => id !== currentUser.uid);
      if (otherId && !currentUnsubs.has(otherId)) {
        const unsub = subscribePresence(otherId, (data) => {
          setPresenceData((prev) => ({ ...prev, [otherId]: data }));
        });
        currentUnsubs.set(otherId, unsub);
      }
    });

    // Also subscribe presence directly for activeChat user if single chat
    if (activeChat && activeChat !== "jarvis" && activeChat !== "followers" && activeChat !== "activity" && activeChat !== "requests") {
      const activeConv = conversations.find((c) => c.id === activeChat);
      const targetUid = activeConv?.participantIds?.find((id) => id !== currentUser.uid) || activeChat;
      if (targetUid && !currentUnsubs.has(targetUid)) {
        const unsub = subscribePresence(targetUid, (data) => {
          setPresenceData((prev) => ({ ...prev, [targetUid]: data }));
        });
        currentUnsubs.set(targetUid, unsub);
      }
    }
  }, [conversations, currentUser, activeChat]);

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
    const tempId = makeTempMessageId(currentUser.uid);
    let optMsg: any;
    if (mediaItemsToSend.length === 1) {
      const single = mediaItemsToSend[0];
      optMsg = {
        id: tempId,
        tempId: tempId,
        senderId: currentUser.uid,
        type: single.type,
        content: textToSend || (single.type === 'video' ? 'Sent a video' : 'Sent a photo'),
        mediaUrl: single.url,
        createdAt: { toMillis: () => Date.now() },
        status: 'sent',
        pending: true,
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
        pending: true,
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
        pending: true,
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
      if (mediaItemsToSend.length > 0) {
        // Parallel media resolution with timeout and lightweight base64 fallback
        const resolvedItems = await Promise.all(
          mediaItemsToSend.map(async (item) => {
            let targetUrl = item.url;
            if (item.file) {
              try {
                const { uploadMedia } = await import("../services/githubStorage");
                const uploadPromise = uploadMedia(item.file, "chat_media");
                const timeoutPromise = new Promise<string>((_, reject) =>
                  setTimeout(() => reject(new Error("upload_timeout")), 6000)
                );
                targetUrl = await Promise.race([uploadPromise, timeoutPromise]);
              } catch (upErr) {
                console.warn("Direct upload error or timeout, compressing to lightweight base64:", upErr);
                if (item.type === "image") {
                  targetUrl = await compressImageFileToSafeBase64(item.file);
                }
              }
            } else if (targetUrl.startsWith("data:image/") && targetUrl.length > 60000) {
              const { compressChatImageBase64 } = await import("../services/chatService");
              targetUrl = await compressChatImageBase64(targetUrl);
            }
            return { type: item.type, url: targetUrl };
          })
        );

        // Safe dispatch: if any URL is base64 data, send individually so Firestore 1MB doc limit is NEVER exceeded
        const hasBase64 = resolvedItems.some((it) => it.url.startsWith("data:"));

        if (resolvedItems.length === 1) {
          const single = resolvedItems[0];
          await sendMessage(
            activeChat,
            currentUser.uid,
            single.type,
            textToSend || (single.type === "video" ? "Sent a video" : "Sent a photo"),
            single.url,
            undefined,
            replyData,
            { clientMessageId: tempId }
          );
        } else if (!hasBase64) {
          // All are remote CDN URLs (tiny strings) -> safe for album
          await sendMessage(
            activeChat,
            currentUser.uid,
            'album',
            textToSend || `Sent ${resolvedItems.length} photos/videos`,
            resolvedItems[0].url,
            undefined,
            replyData,
            {
              mediaUrls: resolvedItems.map((m) => m.url),
              mediaItems: resolvedItems,
              clientMessageId: tempId,
            }
          );
        } else {
          // Each base64 item becomes its own document. Remove the single
          // album placeholder first so the UI does not show a phantom extra.
          setMessagesCache((prev) => ({
            ...prev,
            [activeChat]: (prev[activeChat] || []).filter((m: any) => m.id !== tempId),
          }));

          let isFirst = true;
          for (const item of resolvedItems) {
            await sendMessage(
              activeChat,
              currentUser.uid,
              item.type,
              isFirst ? (textToSend || (item.type === "video" ? "Sent a video" : "Sent a photo")) : (item.type === "video" ? "Sent a video" : "Sent a photo"),
              item.url,
              undefined,
              isFirst ? replyData : undefined
            );
            isFirst = false;
          }
        }
      } else {
        await sendMessage(
          activeChat,
          currentUser.uid,
          "text",
          textToSend,
          undefined,
          undefined,
          replyData,
          { clientMessageId: tempId }
        );
      }
    } catch (error) {
      console.error("Failed sending chat message:", error);
    } finally {
      isSendingMsgRef.current = false;
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
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
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressedRef = useRef(false);

  const handlePrintChat = (convId: string, otherUid?: string) => {
    setChatContextMenu(null);
    const conv = conversations.find((c) => c.id === convId);
    const otherName = conv?.participantNames?.[otherUid || ""] || (conv as any)?.groupName || "Chat";
    const chatMsgs = (convId && messagesCache[convId]) || [];

    try {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        const msgsHtml = chatMsgs
          .map((m: any) => {
            const isMe = m.senderId === currentUser?.uid;
            const sName = isMe ? (currentUser?.name || "You") : otherName;
            const time = m.createdAt
              ? new Date(
                  m.createdAt.seconds ? m.createdAt.seconds * 1000 : (m.createdAt || Date.now())
                ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "";
            return `
              <div style="margin-bottom: 10px; padding: 8px 12px; border-radius: 12px; background: ${isMe ? "#ede9fe" : "#f4f4f5"}; max-width: 80%; margin-${isMe ? "left" : "right"}: auto; font-family: sans-serif;">
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: #71717a; margin-bottom: 4px;">
                  <strong>${sName}</strong>
                  <span>${time}</span>
                </div>
                <div style="font-size: 14px; color: #18181b; word-break: break-word;">
                  ${m.content || (m.type === "reel" ? "🎬 [Reel Shared]" : m.type === "image" ? "📷 [Photo]" : "📎 [Attachment]")}
                </div>
              </div>
            `;
          })
          .join("");

        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Print Chat - ${otherName}</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; max-width: 680px; margin: 0 auto; color: #18181b; }
                h1 { font-size: 18px; margin-bottom: 4px; }
                p.sub { font-size: 12px; color: #71717a; margin-bottom: 20px; border-bottom: 1px solid #e4e4e7; padding-bottom: 12px; }
              </style>
            </head>
            <body>
              <h1>Chat with ${otherName}</h1>
              <p class="sub">Exported from Ennvo • ${new Date().toLocaleDateString()}</p>
              ${msgsHtml || '<p style="color: #a1a1aa; text-align: center; margin-top: 40px;">No messages in this chat yet</p>'}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 300);
      } else {
        window.print();
      }
    } catch (_) {
      window.print();
    }
  };

  const handleChatTouchStart = (
    e: React.TouchEvent | React.MouseEvent,
    convId: string,
    otherUid?: string,
  ) => {
    if ("button" in e && e.button !== 0) return;
    longPressedRef.current = false;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    touchStartPosRef.current = { x: clientX, y: clientY };

    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = setTimeout(() => {
      longPressedRef.current = true;
      if (typeof window !== "undefined" && window.navigator?.vibrate) {
        try { window.navigator.vibrate(28); } catch (_) {}
      }
      setChatContextMenu({ x: clientX, y: clientY, convId, otherUid });
    }, 320);
  };

  const handleChatTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!touchStartPosRef.current) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const dx = Math.abs(clientX - touchStartPosRef.current.x);
    const dy = Math.abs(clientY - touchStartPosRef.current.y);
    if (dx > 12 || dy > 12) {
      if (touchTimerRef.current) {
        clearTimeout(touchTimerRef.current);
        touchTimerRef.current = null;
      }
    }
  };

  const handleChatTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    if (longPressedRef.current) {
      setTimeout(() => {
        longPressedRef.current = false;
      }, 250);
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
      ...(pendingRequestsCount > 0 ? [messageRequestsConvItem] : []),
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
    const list = allUnifiedConversations.filter((conv: any) => {
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

    return list.sort((a: any, b: any) => {
      const aPinned = pinnedChatIds.includes(a.id);
      const bPinned = pinnedChatIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });
  }, [allUnifiedConversations, searchQuery, currentUser?.uid, userDataCache, pinnedChatIds]);

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

  const themeOverride = activeChat ? conversationThemeOverrides[activeChat] : undefined;
  const activeConvTheme = themeOverride?.theme || 
    (activeConversation as any)?.theme || 
    (activeChat === "jarvis" ? (localStorage.getItem("jarvis_chat_theme") || chatTheme) : chatTheme) || 
    "/chat-background.jpg";
  const activeConvThemeBlur = themeOverride?.blur !== undefined
    ? Boolean(themeOverride.blur)
    : Boolean((activeConversation as any)?.themeBlur);
  const activeConvThemeBrightness = typeof themeOverride?.brightness === 'number'
    ? themeOverride.brightness
    : (typeof (activeConversation as any)?.themeBrightness === 'number' ? (activeConversation as any).themeBrightness : 1);

  const scrollToBottom = (force = false) => {
    const el = messagesContainerRef.current;
    if (!el) return;
    if (!force && !shouldAutoScrollRef.current) return;
    // Instant, never smooth: a smooth animation fought with the instant
    // scroll of the previous frame and made the list stutter.
    el.scrollTop = el.scrollHeight;
  };

  // One scroll handler for the whole chat. New messages jump straight to the
  // bottom, older messages are prepended without losing the reading position,
  // and the typing indicator never moves the list.
  useLayoutEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight } = el;
    const grew = scrollHeight > prevScrollHeightRef.current;

    if (grew && scrollTop < 80) {
      // Older messages were prepended: keep the reading position.
      el.scrollTop = scrollTop + (scrollHeight - prevScrollHeightRef.current);
    } else if (shouldAutoScrollRef.current) {
      el.scrollTop = scrollHeight;
    }
    prevScrollHeightRef.current = scrollHeight;
  }, [messages]);

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

        const messageKey = msg.id || msg.tempId || `msg_${idx}`;

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
        // Only truly optimistic messages are "pending"; once Firestore echoes
        // the same document id the flag is gone and animations stop replaying.
        const isTemp = Boolean((msg as any).pending);
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
            <div key={messageKey} className="my-2 flex items-center justify-center select-none">
              <div className="px-3.5 py-1 bg-neutral-100 text-neutral-600 text-[11.5px] font-medium rounded-full border border-neutral-200/80 tracking-tight text-center max-w-[85%]">
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
            onViewSticker={(url, type) => {
              setViewingStickerUrl(url);
              setViewingStickerType(type || 'image');
            }}
          />
        );
      }),
    [messages, currentUser, activeContact, activeConversation, userDataCache, chatTheme, activeChat],
  );

  return (
    <div
      className="h-full w-full flex bg-white dark:bg-black overflow-hidden relative select-none [webkit-font-smoothing:antialiased] [text-rendering:optimizeLegibility]"
      onClick={closeContextMenu}
    >
      {/* Unified subtle lag-free ambient soft blue glow fixed at top matching feed */}
      <div 
        className="pointer-events-none fixed top-0 left-0 right-0 h-[260px] sm:h-[300px] bg-gradient-to-b from-sky-400/[0.14] via-blue-500/[0.05] to-transparent dark:from-blue-600/[0.20] dark:via-blue-800/[0.05] dark:to-transparent z-0" 
        aria-hidden="true" 
      />

      {/* Left Sidebar (Contacts & Stories) - Pure High-White Glass & Solid OLED Dark Mode Seamlessly under PC Dock */}
      <div
        className={`w-full md:w-auto md:pl-[84px] lg:pl-[92px] flex-shrink-0 border-r border-neutral-200/50 dark:border-white/10 flex-col h-full bg-transparent md:bg-white dark:md:bg-[#0b0b0e] z-10 transition-colors ${activeChat ? "hidden md:flex" : "flex"}`}
        style={isDesktop ? { width: sidebarWidth } : undefined}
      >
        {/* Top Controls Area (NO Boxed Header - completely transparent so blur & background flows seamlessly to the top) */}
        <div className="px-3 sm:px-4 pt-[max(calc(var(--app-safe-top)+8px),12px)] pb-2 flex items-center justify-between sticky top-0 bg-transparent border-0 z-20 w-full min-h-[52px] transition-all select-none">
          {isSearchExpanded ? (
            <div className="relative flex items-center flex-1 space-x-2 animate-in fade-in duration-150">
              <div className="relative flex-1 flex items-center">
                <Search
                  className="w-4 h-4 absolute left-3.5 text-neutral-400 dark:text-neutral-500 pointer-events-none"
                  strokeWidth={2.2}
                />
                <input
                  type="text"
                  placeholder="Search chats, people..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/80 hover:bg-white dark:bg-white/10 dark:hover:bg-white/15 dark:border dark:border-white/10 rounded-full pl-9.5 pr-8 py-2 text-[13.5px] font-medium text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none transition-all shadow-none"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-transform cursor-pointer border-0 bg-transparent"
                  >
                    <X className="w-4 h-4" strokeWidth={2.2} />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSearchExpanded(false);
                  setSearchQuery("");
                }}
                className="px-3 py-1.5 text-[13px] font-semibold text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-all cursor-pointer border-0 bg-transparent shrink-0"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              {/* Left Button: Group Icon Button (Styled like feed search button) */}
              <button
                type="button"
                onClick={() => setShowCreateGroup(true)}
                className="w-10 h-10 rounded-full bg-white/70 dark:bg-white/10 hover:bg-neutral-100 dark:hover:bg-white/15 transition-all flex items-center justify-center text-neutral-800 dark:text-neutral-100 cursor-pointer border border-black/5 dark:border-white/10 shadow-xs touch-manipulation shrink-0"
                title="New Group"
              >
                <Users className="w-5 h-5 text-neutral-800 dark:text-neutral-100" strokeWidth={2.1} />
              </button>

              {/* Center: Chats text with down arrow -> opens online/offline/privacy menu on click */}
              <button
                type="button"
                onClick={() => setShowPrivacySheet(true)}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full hover:bg-white/60 dark:hover:bg-white/10 transition-all cursor-pointer border-0 bg-transparent shadow-none touch-manipulation group"
                title="Chats, Online Status & Privacy"
              >
                <h1 className="text-[20px] font-extrabold tracking-[-0.4px] text-neutral-950 dark:text-white leading-none">
                  Chats
                </h1>
                <ChevronDown className="w-4 h-4 text-neutral-500 dark:text-neutral-400 shrink-0 transition-transform group-hover:translate-y-0.5" strokeWidth={2.4} />
                {isOnline && (
                  <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0 ml-0.5" />
                )}
                {(() => {
                  const unreadCount = conversations.reduce((acc, c) => {
                    if (currentUser && c.unreadCount && c.unreadCount[currentUser.uid] > 0) {
                      return acc + 1;
                    }
                    return acc;
                  }, 0);
                  if (unreadCount === 0) return null;
                  return (
                    <span className="px-1.5 py-0.5 text-[10.5px] font-black bg-[#FE2C55] text-white rounded-full leading-none shadow-none ml-1">
                      {unreadCount}
                    </span>
                  );
                })()}
              </button>

              {/* Right Button: Search Icon Button (Styled like feed search button) */}
              <button
                type="button"
                onClick={() => setIsSearchExpanded(true)}
                className="w-10 h-10 rounded-full bg-white/70 dark:bg-white/10 hover:bg-neutral-100 dark:hover:bg-white/15 transition-all flex items-center justify-center text-neutral-800 dark:text-neutral-100 cursor-pointer border border-black/5 dark:border-white/10 shadow-xs touch-manipulation shrink-0"
                title="Search chats"
              >
                <Search className="w-4.5 h-4.5 text-neutral-800 dark:text-neutral-100" strokeWidth={2.2} />
              </button>
            </>
          )}
        </div>

        {/* Scrollable Area (Stories + Contacts) */}
        <PullToRefresh onRefresh={async () => { await new Promise(r => setTimeout(r, 450)); }} className="flex-1 overflow-y-auto scrollbar-hide pb-[80px] [webkit-font-smoothing:antialiased]">
          <div className="w-full">
          {/* Prominent Stories Section - Clean 2D with dedicated headroom so note bubble never touches or hides in header */}
          {!searchQuery.trim() && (
            <div className="w-full pt-5 pb-2 my-0 overflow-x-auto scrollbar-hide px-3.5 bg-transparent">
              <div className="flex space-x-3 min-w-max items-center">
                
                {/* Current User Story + Thought Cloud What's up Note (Clear headroom below header) */}
                <div className="flex flex-col items-center flex-shrink-0 cursor-pointer pt-2 pb-0.5 relative">
                  <div className="relative">
                    {/* Pure Translucent Glass "What's up?" Thought Cloud Bubble - Wraps to nice lines nicely */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        if ((currentUser as any)?.statusNote) {
                          setViewingNoteUser({
                            id: currentUser.uid,
                            name: currentUser.name || "Me",
                            avatar: currentUser.avatar || "",
                            statusNote: (currentUser as any).statusNote,
                            timestamp: Date.now(),
                          });
                        } else {
                          setStatusNoteMode("create");
                          setStatusNoteText("");
                          setShowStatusInput(true);
                        }
                      }}
                      className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-white/85 dark:bg-neutral-900/85 backdrop-blur-md border border-white/70 dark:border-white/20 shadow-sm rounded-[18px] z-30 w-auto min-w-[82px] max-w-[136px] cursor-pointer transition-all flex items-center justify-center select-none text-center"
                      title={(currentUser as any)?.statusNote ? "View your note" : "Share a note"}
                    >
                      <span className="text-[11px] font-bold text-neutral-900 dark:text-white leading-tight line-clamp-2 break-words text-center">
                        {(currentUser as any)?.statusNote ? (
                          (currentUser as any).statusNote
                        ) : (
                          <span className="text-neutral-500 dark:text-neutral-400 font-medium">What's up?</span>
                        )}
                      </span>
                      {/* Thought Bubble Trailing Glass Dots */}
                      <div className="absolute -bottom-1 left-5 w-2 h-2 rounded-full bg-white/85 dark:bg-neutral-900/85 backdrop-blur-xs border border-white/60 dark:border-white/20 pointer-events-none"></div>
                      <div className="absolute -bottom-2 left-3.5 w-1 h-1 rounded-full bg-white/85 dark:bg-neutral-900/85 backdrop-blur-xs border border-white/60 dark:border-white/20 pointer-events-none"></div>
                    </div>

                    {/* Colorful Circle Around Create PFP - Prominent & Enlarged */}
                    <div
                      onClick={() => {
                        const { setSelectedCreateMode, setShowReelCamera } = useAppStore.getState();
                        setSelectedCreateMode('story');
                        setShowReelCamera(true);
                      }}
                      className="cursor-pointer transition-transform relative p-[3px] rounded-full bg-gradient-to-tr from-violet-600 via-pink-500 to-amber-400"
                    >
                      <div className="p-[2.5px] bg-white dark:bg-neutral-950 rounded-full">
                        <img
                          src={
                            currentUser?.avatar ||
                            `https://ui-avatars.com/api/?name=${currentUser?.name || "Me"}&background=random`
                          }
                          className="w-[90px] h-[90px] rounded-full object-cover"
                          alt="Me"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="absolute bottom-0 right-0 w-7.5 h-7.5 bg-gradient-to-tr from-purple-600 via-rose-500 to-pink-500 rounded-full flex items-center justify-center text-white border-2 border-white dark:border-neutral-950 shadow-sm">
                        <Plus className="w-4 h-4 text-white" strokeWidth={3} />
                      </div>
                    </div>
                  </div>
                  <span className="text-[12.5px] font-bold text-neutral-800 dark:text-neutral-200 mt-2 tracking-tight">
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
                        className="flex flex-col items-center flex-shrink-0 cursor-pointer pt-2 pb-0.5 relative touch-manipulation select-none"
                        onClick={() => {
                          if (hasStory && firstStory) {
                            setViewingStory(firstStory);
                            const newViewed = {
                              ...viewedInboxStories,
                              [authorId as string]: true,
                            };
                            setViewedInboxStories(newViewed);
                            try {
                              localStorage.setItem(
                                "viewedInboxStories",
                                JSON.stringify(newViewed),
                              );
                            } catch (e) {}
                          } else if (authorInfo.statusNote) {
                            setViewingNoteUser({
                              id: authorId,
                              name: authorInfo.name,
                              avatar: authorInfo.avatar,
                              statusNote: authorInfo.statusNote,
                              timestamp: Date.now() - 3600000,
                            });
                          } else {
                            setViewingUser({
                              uid: authorId,
                              name: authorInfo.name,
                              avatar: authorInfo.avatar,
                            });
                            pushPage("profile");
                          }
                        }}
                      >
                        <div className="relative">
                          {/* Pure Translucent Glass Thought Bubble for other contacts */}
                          {authorInfo.statusNote && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingNoteUser({
                                  id: authorId,
                                  name: authorInfo.name,
                                  avatar: authorInfo.avatar,
                                  statusNote: authorInfo.statusNote,
                                  timestamp: Date.now() - 3600000,
                                });
                              }}
                              className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-white/85 dark:bg-neutral-900/85 backdrop-blur-md border border-white/70 dark:border-white/20 shadow-sm rounded-[18px] z-30 w-auto min-w-[82px] max-w-[136px] select-none cursor-pointer transition-all flex items-center justify-center text-center group"
                              title={`View ${authorInfo.name}'s note`}
                            >
                              <span className="text-[11px] font-bold text-neutral-900 dark:text-white leading-tight line-clamp-2 break-words text-center">
                                {authorInfo.statusNote}
                              </span>
                              {/* Thought Bubble Dots */}
                              <div className="absolute -bottom-1 left-4 w-2 h-2 rounded-full bg-white/85 dark:bg-neutral-900/85 backdrop-blur-xs border border-white/60 dark:border-white/20 pointer-events-none"></div>
                              <div className="absolute -bottom-2 left-2.5 w-1 h-1 rounded-full bg-white/85 dark:bg-neutral-900/85 backdrop-blur-xs border border-white/60 dark:border-white/20 pointer-events-none"></div>
                            </div>
                          )}
                          <div className={`w-[94px] h-[94px] rounded-full transition-transform  flex items-center justify-center shrink-0 ${
                            hasStory
                              ? isViewed
                                ? "bg-neutral-300 dark:bg-neutral-700"
                                : "bg-gradient-to-tr from-sky-400 via-blue-500 to-indigo-600"
                              : "bg-neutral-200/80 dark:bg-neutral-800"
                          }`}>
                            <div className="w-[88px] h-[88px] bg-white dark:bg-black rounded-full flex items-center justify-center shrink-0">
                              <img
                                src={authorInfo.avatar}
                                alt={authorInfo.name}
                                className="w-[82px] h-[82px] rounded-full object-cover aspect-square block shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          </div>
                        </div>
                        <span className="text-[12.5px] font-semibold text-neutral-800 dark:text-neutral-200 mt-1.5 truncate w-[94px] text-center tracking-tight">
                          {authorInfo.name.split(" ")[0]}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Contacts & Friends List - Exact Match Style */}
          <div className="pt-0 px-1 space-y-[1px]">
            {!searchQuery.trim() && (
              <>
                {/* Activity Option Row */}
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
                      className="flex items-center justify-between px-3 py-2 my-[1px] rounded-[20px] cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.07] active:bg-black/[0.07] dark:active:bg-white/[0.12] transition-colors group md:hidden touch-manipulation select-none"
                    >
                      <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                        <div className="relative flex-shrink-0">
                          <div className="w-[50px] h-[50px] rounded-full bg-rose-500 flex items-center justify-center">
                            <Sparkles className="w-6 h-6 fill-white stroke-white" strokeWidth={1.5} />
                          </div>
                        </div>
                        <div className="flex flex-col min-w-0 pr-2 space-y-0.5 flex-1">
                          <h3 className={`text-[14.5px] ${actUnread > 0 ? "font-semibold text-neutral-900 dark:text-white" : "font-normal text-neutral-700 dark:text-neutral-300"} truncate tracking-tight leading-tight group-hover:text-rose-500 transition-colors`}>
                            Activity
                          </h3>
                          <p className={`truncate max-w-[190px] md:max-w-[240px] text-[11.5px] ${actUnread > 0 ? "font-medium text-neutral-900 dark:text-white" : "font-normal text-neutral-500 dark:text-neutral-400"}`}>
                            {latestText}
                          </p>
                        </div>
                      </div>

                      <div className="flex-shrink-0 ml-2">
                        {actUnread > 0 ? (
                          <div className="bg-rose-500 text-white text-[11.5px] font-bold rounded-full min-w-[22px] h-[22px] px-1.5 flex items-center justify-center shadow-xs">
                            {actUnread > 5 ? "5+" : actUnread}
                          </div>
                        ) : (
                          <span className="text-[13px] font-medium text-neutral-400 dark:text-neutral-500">
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
              <div className="text-center py-12 text-neutral-400 dark:text-neutral-500 text-sm">
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
                      className="flex items-center justify-between px-3.5 py-2.5 my-0.5 rounded-2xl cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.07] active:bg-black/[0.07] dark:active:bg-white/[0.12] transition-colors group touch-manipulation select-none"
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <div className="relative flex-shrink-0">
                          <div className="w-[50px] h-[50px] rounded-full bg-purple-600 flex items-center justify-center">
                            <MessageCircle className="w-6 h-6 text-white" strokeWidth={2.2} />
                          </div>
                        </div>
                        <div className="flex flex-col min-w-0 pr-2 space-y-0.5 flex-1">
                          <h3 className="text-[15.5px] font-bold truncate tracking-tight leading-tight text-neutral-900 dark:text-white">
                            Message Requests
                          </h3>
                          <div className="flex items-center text-[13px] leading-tight">
                            <p className={`truncate max-w-[170px] md:max-w-[220px] text-[13px] ${pendingRequestsCount > 0 ? "font-bold text-purple-600 dark:text-purple-400" : "font-normal text-neutral-500 dark:text-neutral-400"}`}>
                              {pendingRequestsCount > 0
                                ? `${pendingRequestsCount} new message request${pendingRequestsCount > 1 ? 's' : ''}`
                                : "0 pending requests"}
                            </p>
                            {reqTimeStr && (
                              <>
                                <span className="mx-1 text-[11.5px] text-neutral-400 dark:text-neutral-500 font-normal">·</span>
                                <span className="whitespace-nowrap text-[11.5px] font-normal text-neutral-400 dark:text-neutral-500">
                                  {reqTimeStr}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex-shrink-0 ml-2">
                        {pendingRequestsCount > 0 && (
                          <div className="bg-purple-600 text-white text-[11.5px] font-bold rounded-full min-w-[22px] h-[22px] px-1.5 flex items-center justify-center shadow-xs">
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

                const otherStory =
                  otherId && otherId !== "jarvis" ? inboxStories.find((s) => s.authorId === otherId) : null;
                const hasStory = !!otherStory;
                const isStoryViewed = hasStory && otherId ? !!viewedInboxStories[otherId] : false;

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
                      onTouchMove={handleChatTouchMove}
                      onMouseDown={(e) => {
                        if (e.button === 0 && !isJarvis) {
                          handleChatTouchStart(
                            e,
                            conv.id,
                            !isGroup ? otherId : undefined,
                          );
                        }
                      }}
                      onMouseUp={handleChatTouchEnd}
                      className="flex items-center justify-between px-3 py-2 my-[1px] rounded-[18px] cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.07] active:bg-black/[0.07] dark:active:bg-white/[0.12] transition-all duration-75 group touch-manipulation select-none will-change-transform"
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <div
                          className="relative flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isJarvis) {
                              setActiveChat("jarvis");
                            } else if (hasStory && otherStory) {
                              setViewingStory(otherStory);
                              const newViewed = { ...viewedInboxStories, [otherId as string]: true };
                              setViewedInboxStories(newViewed);
                              try {
                                localStorage.setItem("viewedInboxStories", JSON.stringify(newViewed));
                              } catch (err) {}
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
                                sizeClass="w-[50px] h-[50px]"
                              />
                            </div>
                          ) : (() => {
                            const isOnline = !isJarvis && !!otherId && !!(presenceData[otherId]?.isOnline || (presenceData[otherId] as any)?.state === "online" || userDataCache[otherId]?.isOnline);
                            return (
                              <div className={`relative shrink-0 transition-transform  flex items-center justify-center ${
                                hasStory 
                                  ? `w-[56px] h-[56px] rounded-full ${
                                      isStoryViewed 
                                        ? 'bg-neutral-300 dark:bg-neutral-700' 
                                        : 'bg-gradient-to-tr from-sky-400 via-blue-500 to-indigo-600'
                                    }`
                                  : 'w-[48px] h-[48px]'
                              }`}>
                                <div className={hasStory ? "w-[50px] h-[50px] bg-white dark:bg-[#16181f] rounded-full flex items-center justify-center shrink-0" : "w-full h-full rounded-full flex items-center justify-center shrink-0"}>
                                  <img
                                    src={avatar as string}
                                    alt={name}
                                    loading="lazy"
                                    className={hasStory ? "w-[44px] h-[44px] rounded-full object-cover aspect-square block shrink-0" : "w-[48px] h-[48px] rounded-full object-cover aspect-square block shrink-0"}
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                                {!isJarvis && otherId && isOnline && (
                                  <div 
                                    className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#16181f] bg-sky-500 shadow-xs z-10"
                                    title="Online"
                                  />
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        <div className="flex flex-col min-w-0 pr-2 space-y-0.5 flex-1">
                          <div className="flex items-center space-x-1 min-w-0">
                            <h3 className={`truncate tracking-tight leading-tight ${isUnread ? "font-semibold text-neutral-900 dark:text-white text-[13.5px] sm:text-[14px]" : "font-medium text-neutral-800 dark:text-neutral-200 text-[13px] sm:text-[13.5px]"}`}>
                              {name}
                            </h3>
                            {pinnedChatIds.includes(conv.id) && (
                              <Pin className="w-3.5 h-3.5 text-blue-500 fill-blue-500 shrink-0 rotate-45" />
                            )}
                            {mutedChatIds.includes(conv.id) && (
                              <BellOff className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            )}
                          </div>
                        <div className="flex items-center text-[13px] leading-tight">
                          {isOlderThan5Days ? (
                            <p className="truncate max-w-[170px] md:max-w-[220px] text-[13px] text-neutral-400 dark:text-neutral-500 font-normal">
                              {timeStr}
                            </p>
                          ) : isUnread ? (
                            unreadMessages >= 2 ? (
                              <>
                                <p className="truncate max-w-[150px] md:max-w-[200px] text-[12px] sm:text-[12.5px] font-medium text-neutral-900 dark:text-white">
                                  {unreadMessages > 5
                                    ? "5+ new messages"
                                    : `${unreadMessages} new messages`}
                                </p>
                                <span className="mx-1 text-[11.5px] text-neutral-400 dark:text-neutral-500 font-normal">·</span>
                                <span className="whitespace-nowrap text-[11.5px] font-normal text-neutral-400 dark:text-neutral-500">
                                  {timeStr}
                                </span>
                              </>
                            ) : (
                              <>
                                <p className="truncate max-w-[150px] md:max-w-[200px] text-[12px] sm:text-[12.5px] font-medium text-neutral-900 dark:text-white">
                                  {conv.lastMessage || "Sent a message"}
                                </p>
                                <span className="mx-1 text-[11.5px] text-neutral-400 dark:text-neutral-500 font-normal">·</span>
                                <span className="whitespace-nowrap text-[11.5px] font-normal text-neutral-400 dark:text-neutral-500">
                                  {timeStr}
                                </span>
                              </>
                            )
                          ) : (conv as any).lastSenderId === currentUser?.uid ? (() => {
                            const isSeenByOther = otherId && conv.unreadCount && conv.unreadCount[otherId] === 0;
                            return (
                              <p className="truncate max-w-[170px] md:max-w-[220px] text-[13px] text-neutral-400 dark:text-neutral-500 font-normal">
                                {isSeenByOther ? `Seen · ${timeStr}` : `Sent ${timeStr}`}
                              </p>
                            );
                          })() : (
                            <>
                              <p className="truncate max-w-[150px] md:max-w-[200px] text-[13px] text-neutral-500 dark:text-neutral-400 font-normal">
                                {conv.lastMessage || "Sent a message"}
                              </p>
                              <span className="mx-1 text-[11.5px] text-neutral-400 dark:text-neutral-500 font-normal">·</span>
                              <span className="whitespace-nowrap text-[11.5px] font-normal text-neutral-400 dark:text-neutral-500">
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
                        <div className="bg-[#FF2C55] text-white text-[11.5px] font-bold rounded-full min-w-[22px] h-[22px] px-1.5 flex items-center justify-center shadow-xs">
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

      {/* PC only: drag this divider to resize the chat list (double click resets) */}
      {isDesktop && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize chat list"
          title="Drag to resize · double click to reset"
          onPointerDown={handleSidebarResizeStart}
          onDoubleClick={resetSidebarWidth}
          className={`hidden md:flex items-center justify-center w-[9px] -ml-[9px] shrink-0 cursor-col-resize touch-none select-none relative z-30 ${
            isResizingSidebar ? "bg-sky-500/20" : "hover:bg-sky-500/15"
          }`}
        >
          <span
            className={`w-[2px] h-full rounded-full transition-colors duration-150 ${
              isResizingSidebar ? "bg-sky-500" : "bg-neutral-200/80 group-hover:bg-sky-400"
            }`}
          />
        </div>
      )}

      {/* Right Chat Area */}
      <AnimatePresence>
        {activeChat ? (
          (activeChat === "activity" || activeChat === "followers") ? (
            <motion.div
              key="activity-special"
              initial={isDesktop ? { x: 0, opacity: 1 } : { x: "100%", opacity: 0.98 }}
              animate={{ x: 0, opacity: 1 }}
              exit={isDesktop ? { x: 0, opacity: 1 } : { x: "100%", opacity: 0.98 }}
              transition={isDesktop ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-0 z-[100] md:relative md:z-auto flex-1 min-w-0 flex flex-col h-full bg-[#f2f2f7] dark:bg-black will-change-transform select-none"
            >
              <Notifications onBack={() => setActiveChat(null)} isModal={true} />
            </motion.div>
          ) : isSpecialChat ? (
            <motion.div
              key="special"
              initial={isDesktop ? { x: 0, opacity: 1 } : { x: "100%", opacity: 0.98 }}
              animate={{ x: 0, opacity: 1 }}
              exit={isDesktop ? { x: 0, opacity: 1 } : { x: "100%", opacity: 0.98 }}
              transition={isDesktop ? { duration: 0 } : { duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              className="fixed inset-0 z-[100] md:relative md:z-auto flex-1 min-w-0 flex flex-col h-full bg-white will-change-opacity select-none"
              onTouchStart={(e) => {
                if (activeChat === "activity") {
                  activityTouchStartXRef.current = e.touches[0].clientX;
                  activityTouchStartYRef.current = e.touches[0].clientY;
                }
              }}
              onTouchEnd={(e) => {
                if (activeChat === "activity" && activityTouchStartXRef.current !== null && activityTouchStartYRef.current !== null) {
                  const diffX = activityTouchStartXRef.current - e.changedTouches[0].clientX;
                  const diffY = activityTouchStartYRef.current - e.changedTouches[0].clientY;
                  if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
                    if (diffX > 0 && activityTab === "activity") {
                      setActivityTab("followers");
                    } else if (diffX < 0 && activityTab === "followers") {
                      setActivityTab("activity");
                    }
                  }
                  activityTouchStartXRef.current = null;
                  activityTouchStartYRef.current = null;
                }
              }}
            >
              {/* Clean 2D Modern Activity Header with Frosted Glass */}
              <div className="min-h-[56px] md:min-h-[60px] px-3.5 md:px-4 pt-[calc(var(--app-safe-top)+6px)] md:pt-0 pb-1.5 md:pb-0 border-b border-neutral-100/60 flex items-center justify-between bg-white sticky top-0 z-30 select-none">
                <div className="flex items-center space-x-2.5">
                  <button
                    type="button"
                    className="p-1.5 -ml-1 hover:bg-neutral-100 rounded-full transition-all cursor-pointer border-0 bg-transparent flex items-center justify-center text-neutral-800"
                    onClick={() => setActiveChat(null)}
                    title="Back to Chats"
                  >
                    <ArrowLeft className="w-5.5 h-5.5" strokeWidth={2.4} />
                  </button>
                  <h2 className="font-extrabold text-[18px] leading-tight text-neutral-950 tracking-tight">
                    {activeChat === "requests" ? "Message Requests" : "Activity"}
                  </h2>
                </div>
              </div>



              {/* Viewport Content Area - Slide Between Activity & New Followers */}
              <div 
                className="flex-1 overflow-hidden relative flex flex-col w-full h-full bg-white touch-pan-y"
                onTouchStart={(e) => {
                  if (activeChat === "activity") {
                    activityTouchStartXRef.current = e.touches[0].clientX;
                    activityTouchStartYRef.current = e.touches[0].clientY;
                  }
                }}
                onTouchEnd={(e) => {
                  if (activeChat === "activity" && activityTouchStartXRef.current !== null && activityTouchStartYRef.current !== null) {
                    const diffX = activityTouchStartXRef.current - e.changedTouches[0].clientX;
                    const diffY = activityTouchStartYRef.current - e.changedTouches[0].clientY;
                    if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY)) {
                      if (diffX > 0 && activityTab === "activity") {
                        setActivityTab("followers");
                      } else if (diffX < 0 && activityTab === "followers") {
                        setActivityTab("activity");
                      }
                    }
                    activityTouchStartXRef.current = null;
                    activityTouchStartYRef.current = null;
                  }
                }}
              >
                {activeChat === "requests" ? (
                  <div className="flex-1 overflow-y-auto max-w-2xl mx-auto space-y-3 p-3 w-full">
                    <div className="p-3.5 bg-purple-50/70 border border-purple-100 rounded-2xl text-[12.5px] text-purple-900/80 leading-relaxed">
                      Open a message request to see what was sent. The sender won&apos;t know you&apos;ve seen it until you accept. You can choose to accept or block their messages.
                    </div>
                    {pendingRequests.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-neutral-500 space-y-3 py-20 text-center select-none">
                        <div className="w-14 h-14 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shadow-xs">
                          <MessageCircle className="w-7 h-7" />
                        </div>
                        <p className="font-semibold text-[16px] text-neutral-900">No message requests</p>
                        <p className="text-[13px] text-neutral-400 max-w-xs">
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
                            className="flex items-center justify-between p-3.5 rounded-2xl bg-white hover:bg-neutral-50 border border-neutral-100 transition-all cursor-pointer shadow-xs"
                          >
                            <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                              <div className="w-12 h-12 rounded-full overflow-hidden bg-neutral-100 shrink-0 border border-neutral-100">
                                <img src={otherAvatar} alt={otherName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="text-[14px] font-semibold text-neutral-900 truncate">{otherName}</h4>
                                <p className="text-[12.5px] text-neutral-500 truncate mt-0.5">{req.lastMessage || "Sent a message"}</p>
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
                                className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-xl text-[12px] font-medium transition-colors border-0 bg-transparent cursor-pointer"
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
                                className="px-3.5 py-1.5 bg-neutral-900 hover:bg-black text-white rounded-xl text-[12px] font-semibold transition-colors shadow-xs border-0 cursor-pointer"
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
                  /* 2-Panel Smooth Horizontal Slider Between Activity & New Followers */
                  <div className="flex-1 w-full h-full overflow-hidden flex flex-col">
                    <div 
                      className="flex w-[200%] h-full transition-transform duration-300 ease-out will-change-transform transform-gpu"
                      style={{
                        transform: activityTab === "activity" ? "translateX(0%)" : "translateX(-50%)"
                      }}
                    >
                      {/* Panel 1: Activity Notifications Feed (Flush 2D Soft List, Zero Gaps) */}
                      <div 
                        className="w-1/2 h-full overflow-y-auto no-scrollbar pb-28 [webkit-overflow-scrolling:touch]"
                        onScroll={(e) => {
                          if (
                            e.currentTarget.scrollHeight - e.currentTarget.scrollTop <=
                            e.currentTarget.clientHeight + 60
                          ) {
                            setActivityLimit((prev) => prev + 15);
                          }
                        }}
                      >
                        {notifications.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full text-neutral-400 space-y-3 py-24 select-none">
                            <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center">
                              <Bell className="w-7 h-7 text-neutral-400 stroke-[1.8]" />
                            </div>
                            <p className="font-semibold text-[15px] text-neutral-600">No activity yet</p>
                          </div>
                        ) : (
                          <>
                            {notifications.slice(0, Math.min(3, notifications.length)).map((n) => (
                            <div
                              key={n.id}
                              className="flex items-center justify-between space-x-3 px-3.5 py-2.5 hover:bg-neutral-50 active:bg-neutral-100/70 cursor-pointer border-b border-neutral-100/80 transition-colors select-none"
                              onClick={() => {
                                if (n.postId && n.postMedia) {
                                  const {
                                    setHighlightedCommentId,
                                    setHighlightedPostId,
                                    setShowLikesList,
                                    setTargetLikesPostId,
                                    setViewingReel,
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

                                  import("../services/postService").then(({ getPost }) => {
                                    getPost(n.postId!).then((realPost) => {
                                      if (realPost) {
                                        setViewingReel({ ...realPost, single: true });
                                      } else {
                                        setViewingReel({
                                          id: n.postId,
                                          authorId: n.postAuthorId || n.actorId || "",
                                          authorName: postAuthor.name,
                                          authorAvatar: postAuthor.avatar,
                                          media: n.postMedia ? [n.postMedia] : [],
                                          text: n.content || "",
                                          type: isReel ? "reel" : "post",
                                          likesCount: 0,
                                          commentsCount: 0,
                                          single: true,
                                        });
                                      }
                                    });
                                  });
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
                              {/* Avatar with Crisp 2D Badge */}
                              <div className="flex items-center space-x-3 min-w-0 flex-1">
                                <div
                                  className="relative shrink-0"
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
                                    className="w-11 h-11 rounded-full object-cover border border-neutral-100/90 shrink-0"
                                    alt="actor"
                                    referrerPolicy="no-referrer"
                                    loading="lazy"
                                  />
                                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white rounded-full flex items-center justify-center border border-neutral-100 shadow-2xs">
                                    {n.type === "like" && (
                                      <Heart className="w-2.5 h-2.5 text-red-500 fill-red-500" />
                                    )}
                                    {n.type === "comment" && (
                                      <MessageCircle className="w-2.5 h-2.5 text-blue-500 fill-blue-500" />
                                    )}
                                    {n.type === "follow" && (
                                      <UserPlus className="w-2.5 h-2.5 text-purple-600" />
                                    )}
                                  </div>
                                </div>

                                <div className="flex-1 min-w-0 pr-2">
                                  <p className="text-[13.5px] leading-snug">
                                    <span className="font-bold text-neutral-900 hover:underline">
                                      {n.actorName || "User"}
                                    </span>
                                    <span className="text-neutral-600 font-normal ml-1">
                                      {n.type === "like" && "liked your post."}
                                      {n.type === "comment" && `commented: ${n.content}`}
                                      {n.type === "follow" && "started following you."}
                                      {n.type === "mention" && "mentioned you."}
                                      {n.type === "favorite" && "saved your post."}
                                      {n.type === "reply" && `replied to your comment: ${n.content}`}
                                      {n.type === "comment_like" && "liked your comment."}
                                    </span>
                                  </p>
                                  <p className="text-[11.5px] text-neutral-400 mt-0.5 font-normal tracking-tight">
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
                                        const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
                                        if (diff < 60) return "Just now";
                                        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
                                        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
                                        return date.toLocaleDateString();
                                      } catch (e) {
                                        return "Just now";
                                      }
                                    })()}
                                  </p>
                                </div>
                              </div>

                              {/* Right Action: Follow back or Clean 2D Lag-free Media Preview Box */}
                              {n.type === 'follow' ? (
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const isF = (followingIds || []).includes(n.actorId);
                                    const prevF = [...(followingIds || [])];
                                    const willFollow = !isF;

                                    if (willFollow) {
                                      setFollowingIds([...prevF, n.actorId]);
                                    } else {
                                      setFollowingIds(prevF.filter(id => id !== n.actorId));
                                    }

                                    try {
                                      const { followUser, unfollowUser } = await import("../services/followService");
                                      if (willFollow) {
                                        if (currentUser) {
                                          await followUser(currentUser, { uid: n.actorId, name: n.actorName, avatar: n.actorAvatar });
                                        }
                                      } else {
                                        if (currentUser?.uid) {
                                          await unfollowUser(currentUser.uid, n.actorId);
                                        }
                                      }
                                    } catch (err) {
                                      setFollowingIds(prevF);
                                    }
                                  }}
                                  className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all  border-0 shrink-0 cursor-pointer ${
                                    (followingIds || []).includes(n.actorId) && (followerIds || []).includes(n.actorId)
                                      ? 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200'
                                      : (followingIds || []).includes(n.actorId)
                                        ? 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200'
                                        : 'bg-[#fe2c55] text-white hover:brightness-105 shadow-none'
                                  }`}
                                >
                                  {(followingIds || []).includes(n.actorId) && (followerIds || []).includes(n.actorId)
                                    ? 'Friends'
                                    : (followingIds || []).includes(n.actorId)
                                      ? 'Following'
                                      : 'Follow back'}
                                </button>
                              ) : (n.postMedia || n.postId) ? (
                                <div className="w-11 h-14 rounded-xl overflow-hidden shrink-0 border border-neutral-200/90 bg-neutral-900 relative shadow-none select-none">
                                  {n.postMedia && (n.postMedia.includes(".mp4") || n.postMedia.includes("video")) ? (
                                    <div className="relative w-full h-full bg-neutral-950 flex items-center justify-center">
                                      <video
                                        src={`${n.postMedia}#t=0.001`}
                                        className="w-full h-full object-cover pointer-events-none opacity-85"
                                        preload="metadata"
                                        muted
                                        playsInline
                                      />
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                        <Play className="w-3.5 h-3.5 text-white fill-white" />
                                      </div>
                                    </div>
                                  ) : n.postMedia ? (
                                    <img
                                      src={n.postMedia}
                                      className="w-full h-full object-cover pointer-events-none"
                                      alt="thumb"
                                      referrerPolicy="no-referrer"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
                                      <Play className="w-3 h-3 text-neutral-400" />
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          ))}

                          {/* Draggable Stack View for Earlier Activities */}
                          {notifications.length > 3 && (
                            <ActivityStackView
                              items={notifications.slice(3)}
                              onItemClick={(n) => {
                                if (n.postId && n.postMedia) {
                                  const {
                                    setHighlightedCommentId,
                                    setHighlightedPostId,
                                    setShowLikesList,
                                    setTargetLikesPostId,
                                    setViewingReel,
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

                                  import("../services/postService").then(({ getPost }) => {
                                    getPost(n.postId!).then((realPost) => {
                                      if (realPost) {
                                        setViewingReel({ ...realPost, single: true });
                                      }
                                    });
                                  });
                                } else {
                                  setViewingUser({ uid: n.actorId, name: n.actorName, avatar: n.actorAvatar });
                                  pushPage("profile");
                                }
                              }}
                              onProfileClick={(actorId, actorName, actorAvatar) => {
                                setViewingUser({ uid: actorId, name: actorName, avatar: actorAvatar });
                                pushPage("profile");
                              }}
                              followingIds={followingIds}
                              followerIds={followerIds}
                              onFollowToggle={handleFollowBack}
                            />
                          )}
                        </>
                      )}
                    </div>

                      {/* Panel 2: New Followers Feed (Flush 2D Soft List + Draggable Stack View for Earlier Followers) */}
                      <div className="w-1/2 h-full overflow-y-auto no-scrollbar pb-28 [webkit-overflow-scrolling:touch]">
                        {followers.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full text-neutral-400 space-y-3 py-24 select-none">
                            <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center">
                              <UserPlus className="w-7 h-7 text-neutral-400 stroke-[1.8]" />
                            </div>
                            <p className="font-semibold text-[15px] text-neutral-600">No new followers yet</p>
                          </div>
                        ) : (
                          <>
                            {followers.slice(0, Math.min(3, followers.length)).map((f: any) => (
                              <FollowerItem
                                key={f.id}
                                follower={f}
                                currentUser={currentUser}
                                onFollowBack={handleFollowBack}
                              />
                            ))}

                            {/* Draggable Stack View for Earlier Followers */}
                            {followers.length > 3 && (
                              <FollowerStackView
                                followers={followers.slice(3)}
                                onProfileClick={(uid, name, avatar) => {
                                  setViewingUser({ uid, name, avatar });
                                  pushPage("profile");
                                }}
                                followingIds={followingIds}
                                followerIds={followerIds}
                                onFollowToggle={handleFollowBack}
                              />
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Modern Floating Bottom Navigation Bar ("nice navigetion er moto activity or follower button") */}
                    {activeChat === "activity" && (
                      <div className="absolute bottom-5 inset-x-0 z-30 flex justify-center pointer-events-none select-none">
                        <div className="pointer-events-auto flex items-center p-1.5 rounded-full bg-white/85 dark:bg-neutral-900/85 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-700 shadow-[0_8px_30px_rgb(0,0,0,0.12)] space-x-1.5">
                          <button
                            type="button"
                            onClick={() => setActivityTab("activity")}
                            className={`px-4.5 py-2 text-[13px] font-extrabold rounded-full transition-all cursor-pointer flex items-center space-x-1.5  border-0 ${
                              activityTab === "activity"
                                ? "bg-neutral-950 text-white shadow-xs"
                                : "bg-transparent text-neutral-600 hover:text-neutral-950"
                            }`}
                          >
                            <Sparkles className={`w-3.5 h-3.5 ${activityTab === "activity" ? "text-rose-400 fill-rose-400" : "text-neutral-400"}`} />
                            <span>Activity</span>
                            {notifications.filter((n) => !n.isRead).length > 0 && (
                              <span className="bg-rose-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                                {notifications.filter((n) => !n.isRead).length}
                              </span>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setActivityTab("followers")}
                            className={`px-4.5 py-2 text-[13px] font-extrabold rounded-full transition-all cursor-pointer flex items-center space-x-1.5  border-0 ${
                              activityTab === "followers"
                                ? "bg-neutral-950 text-white shadow-xs"
                                : "bg-transparent text-neutral-600 hover:text-neutral-950"
                            }`}
                          >
                            <UserPlus className={`w-3.5 h-3.5 ${activityTab === "followers" ? "text-purple-300" : "text-neutral-400"}`} />
                            <span>New Followers</span>
                            {followers.length > 0 && (
                              <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                                activityTab === "followers" ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-700"
                              }`}>
                                {followers.length}
                              </span>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={`chat-${activeChat}`}
              initial={isDesktop ? { x: 0, opacity: 1 } : { x: "100%", opacity: 0.98 }}
              animate={{ x: 0, opacity: 1 }}
              exit={isDesktop ? { x: 0, opacity: 1 } : { x: "100%", opacity: 0.98 }}
              transition={isDesktop ? { duration: 0 } : { duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="chat-view-container fixed inset-0 z-[100] md:relative md:z-auto flex-1 min-w-0 flex flex-col h-[100dvh] max-h-[100dvh] overflow-hidden bg-white dark:bg-black select-none will-change-transform"
            >
              {/* Chat Background Layer - Mobile & Desktop Theme Wallpaper */}
              {(() => {
                const isImage = 
                  activeConvTheme === 'bg-image' || 
                  activeConvTheme === '/chat-background.jpg' ||
                  activeConvTheme.startsWith('http') || 
                  activeConvTheme.startsWith('/') || 
                  activeConvTheme.startsWith('data:') ||
                  activeConvTheme.includes('.png') ||
                  activeConvTheme.includes('.jpg') ||
                  activeConvTheme.includes('.webp');

                return (
                  <>
                    {/* Background Layer: Image Wallpaper or Gradient Theme */}
                    {isImage ? (
                      <img
                        src={formatMediaUrl(activeConvTheme === 'bg-image' ? '/chat-background.jpg' : activeConvTheme)}
                        alt=""
                        loading="eager"
                        decoding="async"
                        fetchPriority="high"
                        className="absolute inset-0 w-full h-full pointer-events-none z-0 select-none object-cover object-center"
                        style={{
                          // The wallpaper always fills the chat pane. It used to be
                          // pinned to 100lvh, so it was cut off as soon as the
                          // keyboard shrank the pane.
                          filter: activeConvThemeBlur ? `blur(18px) brightness(${activeConvThemeBrightness})` : `brightness(${activeConvThemeBrightness})`,
                          transform: activeConvThemeBlur ? 'scale(1.10)' : 'scale(1)',
                        }}
                        onError={(e) => {
                          const el = e.currentTarget;
                          if (!el.dataset.retried) {
                            el.dataset.retried = 'true';
                            el.src = '/chat-background.jpg';
                          }
                        }}
                      />
                    ) : (activeConvTheme.startsWith('bg-') || activeConvTheme.startsWith('#')) ? (
                      <div 
                        className={`absolute inset-0 pointer-events-none z-0 select-none transition-all duration-300 ${activeConvTheme.startsWith('bg-') ? activeConvTheme : ''}`}
                        style={{ 
                          backgroundColor: activeConvTheme.startsWith('#') ? activeConvTheme : undefined,
                          filter: `brightness(${activeConvThemeBrightness})` 
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 pointer-events-none z-0 select-none bg-slate-50/70 dark:bg-black" />
                    )}
                  </>
                );
              })()}

              {/* Chat Header - Crisp, Crystal Clear, NOT BLURRED, Seamlessly blended with theme */}
              {(() => {
                const isThemeImage = 
                  activeConvTheme === 'bg-image' || 
                  activeConvTheme === '/chat-background.jpg' ||
                  activeConvTheme.startsWith('http') || 
                  activeConvTheme.startsWith('/') || 
                  activeConvTheme.startsWith('data:') ||
                  activeConvTheme.includes('.png') ||
                  activeConvTheme.includes('.jpg') ||
                  activeConvTheme.includes('.webp') ||
                  activeConvTheme.includes('background') ||
                  activeConvTheme.includes('wallpaper');
                const wallpaperImgSrc = isThemeImage 
                  ? (activeConvTheme === 'bg-image' ? '/chat-background.jpg' : activeConvTheme) 
                  : offlineWallpaperUrl;

                return (
                  <div
                    className="sticky top-0 z-40 shrink-0 w-full relative overflow-hidden px-3 md:px-5 pt-[max(10px,calc(var(--app-safe-top)+8px))] pb-2.5 flex items-center justify-between gap-2 select-none border-b-0 shadow-none touch-manipulation"
                  >
                    {/* Header Theme Background Layer - Sharp and crystal clear, NOT BLURRED */}
                    {isThemeImage ? (
                      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                        <img
                          src={wallpaperImgSrc}
                          alt=""
                          className="w-full h-full object-cover object-center absolute inset-0 transition-all duration-300"
                          style={{
                            filter: `brightness(${activeConvThemeBrightness})`,
                            transform: 'scale(1)',
                          }}
                        />
                        {/* Clean translucent sheen that melts into chat background without blur */}
                        <div className="absolute inset-0 bg-gradient-to-b from-white/15 via-white/5 to-transparent" />
                      </div>
                    ) : (activeConvTheme.startsWith('bg-') || activeConvTheme.startsWith('#')) ? (
                      <div 
                        className={`absolute inset-0 pointer-events-none z-0 ${activeConvTheme.startsWith('bg-') ? activeConvTheme : ''} opacity-95`}
                        style={{
                          backgroundColor: activeConvTheme.startsWith('#') ? activeConvTheme : undefined,
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 pointer-events-none z-0 bg-white/95 dark:bg-[#0C0C0E]/95 border-b border-neutral-200/60 dark:border-white/10 backdrop-blur-md" />
                    )}

                    {/* Left: Back button + Friend Profile Info */}
                    <div className="relative z-10 flex items-center space-x-2 min-w-0 flex-1">
                      <button
                        className="md:hidden w-9.5 h-9.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all text-neutral-800 dark:text-neutral-100 shrink-0 flex items-center justify-center cursor-pointer border-0 shadow-none touch-manipulation"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveChat(null);
                        }}
                        title="Back to inbox"
                      >
                        <ArrowLeft
                          className="w-5 h-5 text-neutral-800 dark:text-neutral-100"
                          strokeWidth={2.4}
                        />
                      </button>

                      <div
                        className="flex items-center space-x-2.5 cursor-pointer min-w-0 flex-1 group"
                        onClick={() => setShowChatSettings(true)}
                      >
                        <div className="relative shrink-0">
                          {activeContact?.isGroup && !activeContact.avatar ? (
                            <div className="cursor-pointer transition-transform">
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
                                sizeClass="w-10 h-10 rounded-full"
                              />
                            </div>
                          ) : (
                            <div className="relative w-10 h-10 shrink-0 transition-all flex items-center justify-center">
                              <img
                                src={activeContact?.avatar as string}
                                alt="Avatar"
                                className="w-full h-full rounded-full object-cover"
                              />
                              {activeContact?.online && (
                                <span 
                                  className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-neutral-900 bg-sky-500 shadow-xs z-10" 
                                  title="Online"
                                />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Friend name */}
                        <div className="min-w-0 flex-1 flex flex-col justify-center pl-1">
                          <div className="flex items-center space-x-2">
                            <h2
                              className="font-bold text-[17px] sm:text-[18px] text-neutral-900 dark:text-white truncate tracking-tight text-left leading-tight"
                            >
                              {activeContact?.name}
                            </h2>
                          </div>
                          {(typingUsers.length > 0 || isJarvisTyping) && (
                            <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1 mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                              typing...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Audio Call, Video Call, Details (Clean Soft 2D Buttons) */}
                    <div className="relative z-10 flex items-center space-x-1 shrink-0">
                      {activeChat === "jarvis" ? (
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
                          className="px-3.5 py-1.5 bg-white/90 dark:bg-neutral-800 hover:bg-white dark:hover:bg-neutral-700 text-purple-700 dark:text-purple-300 text-xs font-semibold rounded-full border-0 transition-all cursor-pointer shadow-none touch-manipulation"
                        >
                          Reset Chat
                        </button>
                      ) : activeContact && !activeContact.isGroup ? (
                        <>
                          <button
                            onClick={() => handleStartCall('audio')}
                            title="Audio Call"
                            className="w-9.5 h-9.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-200 hover:text-black dark:hover:text-white flex items-center justify-center shrink-0 cursor-pointer border-0 shadow-none transition-all touch-manipulation"
                          >
                            <Phone className="w-5 h-5" strokeWidth={2.1} />
                          </button>
                          <button
                            onClick={() => handleStartCall('video')}
                            title="Video Call"
                            className="w-9.5 h-9.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-200 hover:text-black dark:hover:text-white flex items-center justify-center shrink-0 cursor-pointer border-0 shadow-none transition-all touch-manipulation"
                          >
                            <Video className="w-5 h-5" strokeWidth={2.1} />
                          </button>
                        </>
                      ) : null}
                      <button
                        onClick={() => setShowChatSettings(true)}
                        title="Chat Details"
                        className="w-9.5 h-9.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-200 hover:text-black dark:hover:text-white flex items-center justify-center shrink-0 cursor-pointer border-0 shadow-none transition-all touch-manipulation"
                      >
                        <Info
                          className="w-5 h-5"
                          strokeWidth={2.1}
                        />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Messages & Input Container */}
              <div className="flex-1 relative w-full h-full overflow-hidden">
                {/* Messages Area - Scrolls Cleanly Below Fixed Header */}
                <div
                  ref={messagesContainerRef}
                  className="absolute inset-0 overflow-y-auto px-1 sm:px-2 md:px-3 py-2 space-y-0.5 scrollbar-hide flex flex-col justify-start z-10 overscroll-contain transform-gpu [webkit-overflow-scrolling:touch] touch-pan-y [overflow-anchor:none] will-change-scroll"
                  style={{ paddingBottom: `${((showStickerModal && !isDesktop) ? 360 : 76) + (viewportBottomOffset > 0 ? viewportBottomOffset : 0)}px` }}
                  onScroll={(e) => {
                    const target = e.currentTarget;
                    if (target.scrollTop < 60 && !isPagingRef.current) {
                      isPagingRef.current = true;
                      // Older messages are fetched with a cursor. Bumping the
                      // limit of the live query re-downloaded the whole
                      // history and re-registered the listener every time.
                      const oldest = messages[0];
                      const oldestTime = oldest?.createdAt?.toMillis?.() ?? (oldest?.createdAt ?? 0);
                      if (oldest && oldestTime) {
                        import("../services/chatService").then((m) =>
                          m.loadOlderMessages(activeChat, oldest.createdAt, 25).then((older) => {
                            if (!older || older.length === 0) return;
                            setMessagesCache((prev) => {
                              const current = prev[activeChat] || [];
                              const known = new Set(current.map((c: any) => c.id));
                              const fresh = older.filter((o: any) => !known.has(o.id));
                              if (!fresh.length) return prev;
                              return { ...prev, [activeChat]: [...fresh, ...current] };
                            });
                          })
                        );
                      }
                      setTimeout(() => {
                        isPagingRef.current = false;
                      }, 800);
                    }
                    const { scrollTop, scrollHeight, clientHeight } = target;
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

                {/* Soft Bottom Ambient Glow & Fade Mask - messages vanish into this glow when scrolling near input box */}
                <div 
                  className="absolute inset-x-0 bottom-0 h-28 pointer-events-none z-20 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-black dark:via-black/80 dark:to-transparent backdrop-blur-[1.5px] [mask-image:linear-gradient(to_top,black_25%,transparent)]"
                />

                {/* Floating Input Area */}
                <div
                  className={`absolute inset-x-0 z-30 pb-2 md:pb-2.5 pt-1 px-2 sm:px-3 md:px-5 w-full flex flex-col justify-end pointer-events-none transform-gpu ${
                    showStickerModal ? 'bottom-[340px] md:bottom-2.5' : 'bottom-2 md:bottom-2.5'
                  }`}
                  style={{
                    transform: viewportBottomOffset > 0 ? `translate3d(0, -${viewportBottomOffset}px, 0)` : 'translate3d(0, 0, 0)',
                    transition: 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), bottom 0.22s ease',
                    willChange: 'transform'
                  }}
                >

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
                            className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-black text-white rounded-full transition-all shadow-xs cursor-pointer"
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
                      className="p-1.5 hover:bg-gray-200/60 rounded-full transition-all shrink-0 text-gray-400 hover:text-gray-700 ml-2"
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
                        className="flex-1 py-2 px-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-[13px] font-semibold transition-all text-center cursor-pointer"
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
                        className="flex-1 py-2 px-3 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 text-[13px] font-semibold transition-all text-center cursor-pointer"
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
                        className="flex-1 py-2 px-3 rounded-xl bg-gray-900 hover:bg-black text-white text-[13px] font-semibold transition-all text-center shadow-xs cursor-pointer"
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

                    {/* Smart Sticker Suggestions (placed directly above input box, tight, transparent, rounded, smooth scroll) */}
                    {stickerSuggestions.length > 0 && !isRecording && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.12 }}
                        className="pointer-events-auto flex items-center space-x-2 px-2.5 py-0.5 mx-auto mb-1 max-w-3xl w-full overflow-x-auto no-scrollbar touch-pan-x overscroll-contain select-none bg-transparent border-0 shadow-none"
                      >
                        {stickerSuggestions.map((stk) => (
                          <button
                            key={stk.id}
                            type="button"
                            onClick={() => handleSendStickerDirect(stk.url, stk.type)}
                            className="shrink-0 p-1 rounded-2xl bg-white/60 dark:bg-neutral-800/60 hover:bg-white dark:hover:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700/50 transition-all cursor-pointer flex items-center justify-center shadow-2xs group"
                            title={stk.title || "Send Sticker"}
                          >
                            {stk.type === "video" ? (
                              <video
                                src={stk.url}
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="w-13 h-13 md:w-15 md:h-15 object-contain rounded-xl pointer-events-none transition-transform"
                              />
                            ) : (
                              <img
                                src={stk.url}
                                alt={stk.title || "Sticker"}
                                referrerPolicy="no-referrer"
                                loading="lazy"
                                className="w-13 h-13 md:w-15 md:h-15 object-contain pointer-events-none rounded-xl transition-transform"
                                onError={(e) => {
                                  const el = e.currentTarget;
                                  if (stk.url.includes('/uploads/') && !el.dataset.retried) {
                                    el.dataset.retried = 'true';
                                    el.src = `/uploads/${stk.url.split('/uploads/')[1]}`;
                                  }
                                }}
                              />
                            )}
                          </button>
                        ))}
                      </motion.div>
                    )}

                    {/* Modern Clean Chat Input Form - Compact, Soft, Perfect Concentric Circles */}
                    <form
                      onSubmit={handleSend}
                      className="pointer-events-auto flex items-center w-full max-w-3xl mx-auto px-2 py-1 select-none"
                    >
                      {/* Main Clean Pill Container - Sleek, not elongated, no bloated box */}
                      <div className="w-full bg-white/95 dark:bg-[#18191d]/95 backdrop-blur-md border border-neutral-200/90 dark:border-white/10 rounded-full px-1.5 py-1 flex items-center space-x-1.5 transition-all min-w-0 min-h-[44px] shadow-xs self-center">
                        
                        {/* Hidden File Inputs */}
                        <input
                          type="file"
                          className="hidden"
                          ref={fileInputRef}
                          onChange={handleImageSelect}
                          accept="image/*,video/*"
                          multiple
                        />
                        <input
                          type="file"
                          className="hidden"
                          ref={docInputRef}
                          onChange={handleDocumentSelect}
                          accept="*/*"
                          multiple
                        />

                        {/* LEFT CIRCLE BUTTON: Cancel when recording, Sky Blur file share when idle */}
                        {isRecording ? (
                          <button
                            type="button"
                            onClick={cancelRecording}
                            className="w-9 h-9 rounded-full bg-rose-500/15 dark:bg-rose-500/25 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-400/30 flex items-center justify-center shrink-0 cursor-pointer transition-all touch-manipulation shadow-none"
                            title="Cancel Voice Recording"
                          >
                            <X className="w-4.5 h-4.5 stroke-[2.2]" />
                          </button>
                        ) : (
                          <div className="relative shrink-0 flex items-center">
                            <button
                              type="button"
                              onClick={() => setShowAttachMenu((prev) => !prev)}
                              className={`w-9 h-9 rounded-full bg-sky-500/15 dark:bg-sky-400/20 backdrop-blur-md text-sky-600 dark:text-sky-300 border border-sky-400/30 hover:bg-sky-500/25  flex items-center justify-center shrink-0 cursor-pointer transition-all touch-manipulation shadow-xs ${showAttachMenu ? 'rotate-45' : ''}`}
                              title="Share File / Media"
                            >
                              <Paperclip className="w-4 h-4 stroke-[2.2]" />
                            </button>

                            <AnimatePresence>
                              {showAttachMenu && (
                                <>
                                  <div
                                    className="fixed inset-0 z-[120]"
                                    onClick={() => setShowAttachMenu(false)}
                                  />
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 8 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 8 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute bottom-12 left-0 z-[130] bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-700 shadow-xl rounded-2xl p-1.5 min-w-[160px] flex flex-col space-y-1 select-none"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowAttachMenu(false);
                                        fileInputRef.current?.click();
                                      }}
                                      className="flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all text-left cursor-pointer border-0 touch-manipulation"
                                    >
                                      <div className="w-7.5 h-7.5 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300 flex items-center justify-center shrink-0">
                                        <ImageIcon className="w-4 h-4" />
                                      </div>
                                      <span className="text-xs font-bold text-neutral-900 dark:text-white">Photos & Videos</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowAttachMenu(false);
                                        docInputRef.current?.click();
                                      }}
                                      className="flex items-center space-x-2.5 px-3 py-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all text-left cursor-pointer border-0 touch-manipulation"
                                    >
                                      <div className="w-7.5 h-7.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 flex items-center justify-center shrink-0">
                                        <FileText className="w-4 h-4" />
                                      </div>
                                      <span className="text-xs font-bold text-neutral-900 dark:text-white">Document</span>
                                    </button>
                                  </motion.div>
                                </>
                              )}
                            </AnimatePresence>
                          </div>
                        )}

                        {/* CENTER AREA: Real Sound Visualizer & Timer when recording, or Textarea when idle */}
                        {isRecording ? (
                          <div className="flex-1 flex items-center justify-between px-2 min-w-0 select-none">
                            {/* Live recording indicator + Timer */}
                            <div className="flex items-center space-x-2 shrink-0">
                              <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                              </span>
                              <span className="text-neutral-900 dark:text-white text-[13px] font-mono font-bold tabular-nums">
                                {Math.floor(recordingDuration / 60)}:
                                {(recordingDuration % 60).toString().padStart(2, "0")}
                              </span>
                            </div>

                            {/* Real Microphone Sound Visualizer Bars */}
                            <div className="flex items-center space-x-[2.5px] px-2 overflow-hidden flex-1 justify-center max-w-[210px] h-6">
                              {liveVolumeLevels.map((lvl, idx) => (
                                <div
                                  key={idx}
                                  className="w-[2.5px] bg-gradient-to-t from-sky-500 to-blue-500 dark:from-sky-400 dark:to-blue-400 rounded-full transition-all duration-75"
                                  style={{
                                    height: `${lvl}px`,
                                    opacity: 0.8 + (idx % 3) * 0.1,
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="relative flex-1 min-w-0 flex items-center self-center">
                              <textarea
                                ref={textareaRef}
                                rows={1}
                                value={inputText}
                                onChange={(e) => {
                                  handleTyping(e);
                                  e.target.style.height = 'auto';
                                  e.target.style.height = `${Math.min(e.target.scrollHeight, 84)}px`;
                                }}
                                onFocus={() => {
                                  if (messagesContainerRef.current) {
                                    requestAnimationFrame(() => {
                                      messagesContainerRef.current?.scrollTo({
                                        top: messagesContainerRef.current.scrollHeight,
                                        behavior: 'auto'
                                      });
                                    });
                                  }
                                }}
                                onClick={() => {
                                  if (messagesContainerRef.current) {
                                    requestAnimationFrame(() => {
                                      messagesContainerRef.current?.scrollTo({
                                        top: messagesContainerRef.current.scrollHeight,
                                        behavior: 'auto'
                                      });
                                    });
                                  }
                                }}
                                onTouchStart={() => {
                                  if (messagesContainerRef.current) {
                                    requestAnimationFrame(() => {
                                      messagesContainerRef.current?.scrollTo({
                                        top: messagesContainerRef.current.scrollHeight,
                                        behavior: 'auto'
                                      });
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
                                className="w-full bg-transparent py-1.5 px-2 border-0 outline-none focus:outline-none focus:ring-0 focus:border-0 text-[14px] font-normal text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 min-w-0 resize-none h-[34px] max-h-[84px] overflow-y-auto no-scrollbar leading-5 flex items-center self-center"
                              />
                            </div>

                            {/* Cute 2D Soft Sticker Button */}
                            <button
                              type="button"
                              onClick={() => {
                                if (document.activeElement instanceof HTMLElement) {
                                  document.activeElement.blur();
                                }
                                setShowStickerModal((prev) => !prev);
                              }}
                              className="w-8 h-8 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 rounded-full transition-all shrink-0 flex items-center justify-center cursor-pointer border-0 shadow-none bg-transparent touch-manipulation"
                              title="Stickers"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                className="w-4.5 h-4.5 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-7-7Z" />
                                <path d="M14 2v6a1 1 0 0 0 1 1h6" />
                                <circle cx="9" cy="13" r="1" fill="currentColor" />
                                <circle cx="15" cy="13" r="1" fill="currentColor" />
                                <path d="M10 16.5c1 .8 3 .8 4 0" />
                              </svg>
                            </button>
                          </>
                        )}

                        {/* RIGHT ACTION BUTTON: Concentric 36x36 Circle (Voice / Send) */}
                        <div className="shrink-0 relative w-9 h-9 flex items-center justify-center">
                          {isRecording ? (
                            /* When recording: Send button appears right here to finish & send voice note */
                            <button
                              type="button"
                              onClick={stopRecording}
                              className="w-9 h-9 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-full flex items-center justify-center cursor-pointer shadow-xs border-0 shrink-0 touch-manipulation transition-all"
                              title="Send Voice Message"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                className="w-4.5 h-4.5 text-white"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  d="M7.4 6.32L15.89 3.49C19.7 2.22 21.77 4.3 20.51 8.11L17.68 16.6C15.78 22.31 12.66 22.31 10.76 16.6L9.92 14.08L7.4 13.24C1.69 11.34 1.69 8.23 7.4 6.32Z"
                                  stroke="currentColor"
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M10.11 13.65L13.69 10.06"
                                  stroke="currentColor"
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          ) : (
                            <>
                              {/* Send Button: Exactly concentric, icon perfectly centered without right-shift, color matching message bubble */}
                              <button
                                type="submit"
                                className={`absolute inset-0 w-9 h-9 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700  text-white rounded-full flex items-center justify-center shadow-xs border-0 cursor-pointer touch-manipulation transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] transform-gpu ${
                                  (inputText.trim() || selectedImagePreview || selectedMediaItems.length > 0)
                                    ? "opacity-100 scale-100 pointer-events-auto"
                                    : "opacity-0 scale-50 pointer-events-none"
                                }`}
                                title="Send Message"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  className="w-4.5 h-4.5 text-white"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    d="M7.4 6.32L15.89 3.49C19.7 2.22 21.77 4.3 20.51 8.11L17.68 16.6C15.78 22.31 12.66 22.31 10.76 16.6L9.92 14.08L7.4 13.24C1.69 11.34 1.69 8.23 7.4 6.32Z"
                                    stroke="currentColor"
                                    strokeWidth="2.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <path
                                    d="M10.11 13.65L13.69 10.06"
                                    stroke="currentColor"
                                    strokeWidth="2.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>

                              {/* Voice Mic Button: Same circle dimensions & sky-blur style as File button */}
                              <button
                                type="button"
                                onClick={startRecording}
                                className={`absolute inset-0 w-9 h-9 rounded-full bg-sky-500/15 dark:bg-sky-400/20 backdrop-blur-md text-sky-600 dark:text-sky-300 border border-sky-400/30 hover:bg-sky-500/25  flex items-center justify-center cursor-pointer shadow-xs touch-manipulation transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] transform-gpu ${
                                  !(inputText.trim() || selectedImagePreview || selectedMediaItems.length > 0)
                                    ? "opacity-100 scale-100 pointer-events-auto"
                                    : "opacity-0 scale-50 pointer-events-none"
                                }`}
                                title="Voice Message"
                              >
                                <Mic className="w-4.5 h-4.5 stroke-[2.2]" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>

              {/* Context Menu (Ultra Glass & Unique Emojis) */}
              <AnimatePresence>
                {contextMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-[240] bg-black/25 backdrop-blur-xs transition-opacity"
                      onClick={closeContextMenu}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        closeContextMenu();
                      }}
                    ></div>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.94, y: 4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.94, y: 4 }}
                      transition={{ duration: 0.12, ease: "easeOut" }}
                      className="fixed bg-white border border-neutral-200/90 rounded-2xl p-2 w-64 md:w-72 z-[250] overflow-hidden shadow-lg select-none"
                      style={{
                        top: Math.max(70, Math.min(contextMenu.y, (window.innerHeight || 800) - 270)),
                        left: Math.max(16, Math.min(contextMenu.x, (window.innerWidth || 400) - 280)),
                      }}
                    >
                      {/* Clean 2D Reaction Emojis Bar */}
                      <div className="flex items-center justify-between px-1.5 py-1 bg-neutral-100 rounded-xl mb-1.5 border border-neutral-200/60 overflow-x-auto no-scrollbar">
                        {["💖", "🔥", "😮", "😭", "⚡", "🚀", "💯", "👍", "📌"].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={async () => {
                              if (activeChat) {
                                try {
                                  const { updateDoc, doc } =
                                    await import("firebase/firestore");
                                  const targetMsg = messages.find((m) => m.id === contextMenu.msgId);
                                  const isSame = (targetMsg as any)?.reaction === emoji;
                                  await updateDoc(
                                    doc(
                                      db,
                                      "conversations",
                                      activeChat,
                                      "messages",
                                      contextMenu.msgId,
                                    ),
                                    {
                                      reaction: isSame ? null : emoji,
                                    },
                                  );
                                } catch (e) {
                                  console.error("Failed to react", e);
                                }
                              }
                              closeContextMenu();
                            }}
                            className="text-[19px] transition-transform p-1 shrink-0 cursor-pointer"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>

                      {/* Action Items - Clean 2D */}
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
                                  className="w-full text-left px-3 py-2 hover:bg-neutral-100 active:bg-neutral-200/80 rounded-xl flex items-center space-x-2.5 transition-colors text-purple-700 cursor-pointer"
                                >
                                  <Bookmark className={`w-4 h-4 ${isAlreadySaved ? "fill-purple-600" : ""}`} />
                                  <span className="font-medium text-[13px]">
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
                                className="w-full text-left px-3 py-2 hover:bg-neutral-100 active:bg-neutral-200/80 rounded-xl flex items-center space-x-2.5 transition-colors text-neutral-800 cursor-pointer"
                              >
                                <Reply className="w-4 h-4 text-purple-600" />
                                <span className="font-medium text-[13px]">Reply to message</span>
                              </button>

                              {isSticker && stkUrl && (
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(stkUrl);
                                    closeContextMenu();
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-neutral-100 active:bg-neutral-200/80 rounded-xl flex items-center space-x-2.5 transition-colors text-neutral-800 cursor-pointer"
                                >
                                  <Share2 className="w-4 h-4 text-neutral-600" />
                                  <span className="font-medium text-[13px]">Share / Copy Link</span>
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
                                  className="w-full text-left px-3 py-2 hover:bg-neutral-100 active:bg-neutral-200/80 rounded-xl flex items-center space-x-2.5 transition-colors text-neutral-800 cursor-pointer"
                                >
                                  <Copy className="w-4 h-4 text-neutral-600" />
                                  <span className="font-medium text-[13px]">Copy text</span>
                                </button>
                              )}
                            </>
                          );
                        })()}

                        <div className="h-px bg-neutral-100 my-1"></div>

                        <button
                          onClick={() => {
                            if (activeChat) {
                              const targetMsgId = contextMenu.msgId;
                              closeContextMenu();
                              // 1. Instant 0ms optimistic local deletion
                              setMessagesCache((prev) => ({
                                ...prev,
                                [activeChat]: (prev[activeChat] || []).filter((m: any) => m.id !== targetMsgId && m.tempId !== targetMsgId)
                              }));

                              // 2. Background Firestore delete
                              (async () => {
                                try {
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
                              })();
                            } else {
                              closeContextMenu();
                            }
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-rose-50 active:bg-rose-100/90 rounded-xl flex items-center space-x-2.5 transition-colors text-rose-600 font-semibold cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 text-rose-500" />
                          <span className="font-semibold text-[13px]">
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
            className="hidden md:flex flex-1 flex-col items-center justify-center relative overflow-hidden h-full select-none bg-white dark:bg-black transition-colors"
          >
            {/* Ambient Lighting Glow at Top (Identical to Notifications Page) */}
            <div className="act-ambient-glow pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center text-center max-w-sm px-8 py-10 rounded-3xl bg-neutral-50/80 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-white/10 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-black flex items-center justify-center mb-3.5 shadow-none">
                <Send className="w-6 h-6 -rotate-12 translate-x-0.5" />
              </div>
              <h3 className="text-[19px] font-bold text-neutral-950 dark:text-white mb-1.5 tracking-tight">
                Your Messages
              </h3>
              <p className="text-[13px] text-neutral-500 dark:text-neutral-400 leading-relaxed font-normal mb-5">
                Send private messages, share reels, and connect seamlessly with friends.
              </p>
              <button 
                type="button"
                onClick={() => setShowCreateGroup(true)}
                className="bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-black font-semibold px-5.5 py-2 rounded-full transition-all shadow-none text-[13px] cursor-pointer"
              >
                Start Conversation
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Ultra Clean & Lag-Free Modern Chat Context Menu (Centered, NOT from bottom) */}
      <AnimatePresence>
        {chatContextMenu && (() => {
          const conv = conversations.find((c) => c.id === chatContextMenu.convId);
          const isJarvis = chatContextMenu.convId === "jarvis";
          const isGroup = !isJarvis && (
            (conv as any)?.isGroup || 
            !!(conv as any)?.groupName || 
            (conv?.participantIds ? conv.participantIds.length > 2 : false)
          );
          const otherUid = chatContextMenu.otherUid || (!isGroup ? conv?.participantIds?.find((id) => id !== currentUser?.uid) : undefined);
          const friendUser = otherUid ? userDataCache[otherUid] : null;
          const friendName = isJarvis 
            ? "Ennvo Jarvis" 
            : isGroup 
            ? (conv as any)?.groupName || "Group Chat"
            : friendUser?.name || (conv?.participantNames || {})[otherUid || ""] || "Friend";
          const rawAvatar = isJarvis
            ? "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80"
            : isGroup
            ? (conv as any)?.groupAvatar
            : friendUser?.avatar || (conv?.participantAvatars || {})[otherUid || ""];
          const friendAvatar = rawAvatar && rawAvatar.trim().length > 0 && !rawAvatar.includes('ui-avatars.com')
            ? rawAvatar
            : `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(friendName)}&backgroundColor=f1f5f9`;
          const friendUsername = (friendUser as any)?.username || (friendUser as any)?.email?.split('@')[0] || (friendName && friendName !== 'Friend' ? friendName.toLowerCase().replace(/[^a-z0-9]/g, '_') : "");
          const isUserOnline = otherUid ? (presenceData[otherUid]?.isOnline || false) : false;
          const isPinned = pinnedChatIds.includes(chatContextMenu.convId);
          const isMuted = mutedChatIds.includes(chatContextMenu.convId);

          return (
            <>
              {/* Soft Dimmed Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                className="fixed inset-0 bg-black/65 backdrop-blur-sm z-[500] touch-manipulation"
                onClick={(e) => {
                  e.stopPropagation();
                  closeContextMenu();
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  closeContextMenu();
                }}
              />

              {/* Centered Modal (Never slides from bottom) */}
              <motion.div
                initial={{ opacity: 0, scale: 0.93, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.93, y: 6 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] max-w-[360px] z-[510] select-none flex flex-col space-y-2.5 will-change-transform transform-gpu pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 1. TOP ROUNDED CARD: Friend Identity */}
                <div className="w-full bg-white dark:bg-[#16171b] rounded-[26px] p-4 shadow-[0_16px_45px_rgba(0,0,0,0.35)] border border-neutral-200/80 dark:border-white/10 flex items-center space-x-3.5 relative overflow-hidden backdrop-blur-xl">
                  {/* Subtle ambient accent glow */}
                  <div className="absolute top-0 right-0 w-28 h-28 bg-purple-500/10 dark:bg-purple-500/15 rounded-full blur-2xl pointer-events-none" />

                  {/* Friend Avatar */}
                  <div className="relative shrink-0">
                    <img 
                      src={friendAvatar} 
                      alt={friendName} 
                      className="w-13 h-13 rounded-full object-cover ring-2 ring-purple-500/30 dark:ring-purple-400/40"
                      referrerPolicy="no-referrer"
                    />
                    {isUserOnline && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-sky-500 rounded-full border-2 border-white dark:border-[#16171b]" />
                    )}
                  </div>

                  {/* Identity Details */}
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center space-x-1.5">
                      <h2 className="text-[15.5px] font-bold text-neutral-900 dark:text-white truncate">
                        {friendName}
                      </h2>
                      {isPinned && (
                        <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[9.5px] font-bold rounded-md shrink-0">
                          Pinned
                        </span>
                      )}
                      {isMuted && (
                        <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-[9.5px] font-bold rounded-md shrink-0">
                          Muted
                        </span>
                      )}
                    </div>

                    {/* Clean Friend Username */}
                    {friendUsername && (
                      <div className="flex items-center space-x-1.5 mt-0.5 truncate">
                        <span className="text-[12.5px] font-semibold text-purple-600 dark:text-purple-400 truncate">
                          @{friendUsername}
                        </span>
                      </div>
                    )}

                    {/* Online status */}
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5 truncate flex items-center space-x-1">
                      {isUserOnline ? (
                        <span className="text-emerald-500 font-semibold">● Active now</span>
                      ) : isGroup ? (
                        <span>Group conversation</span>
                      ) : (
                        <span>Direct friend</span>
                      )}
                    </p>
                  </div>

                  {/* Close button */}
                  <button 
                    type="button" 
                    onClick={closeContextMenu}
                    className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-white/10 dark:hover:bg-white/15 flex items-center justify-center text-neutral-500 dark:text-neutral-300 transition-colors cursor-pointer"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 2. LOWER ROUNDED BOX: Pin, Mute, Clear Chat, Delete Friend */}
                <div className="w-full bg-white dark:bg-[#16171b] rounded-[26px] p-2 shadow-[0_16px_45px_rgba(0,0,0,0.35)] border border-neutral-200/80 dark:border-white/10 flex flex-col space-y-1 backdrop-blur-xl">
                  {/* Pin / Unpin */}
                  <button
                    type="button"
                    onClick={() => togglePinChat(chatContextMenu.convId)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-neutral-100 dark:hover:bg-white/[0.06] rounded-[20px] flex items-center space-x-3.5 transition-colors text-neutral-800 dark:text-neutral-100 cursor-pointer"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isPinned ? 'bg-blue-500 text-white shadow-xs' : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'}`}>
                      <Pin className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[13.5px] leading-tight">
                        {isPinned ? "Unpin Chat" : "Pin"}
                      </div>
                      <div className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate mt-0.5">
                        {isPinned ? "Remove from pinned top" : "Keep conversation pinned at top"}
                      </div>
                    </div>
                  </button>

                  {/* Mute Notification / Unmute Notification */}
                  <button
                    type="button"
                    onClick={() => toggleMuteChat(chatContextMenu.convId)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-neutral-100 dark:hover:bg-white/[0.06] rounded-[20px] flex items-center space-x-3.5 transition-colors text-neutral-800 dark:text-neutral-100 cursor-pointer"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isMuted ? 'bg-amber-500 text-white shadow-xs' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'}`}>
                      {isMuted ? <Bell className="w-4.5 h-4.5" /> : <BellOff className="w-4.5 h-4.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[13.5px] leading-tight">
                        {isMuted ? "Unmute Notification" : "Mute Notification"}
                      </div>
                      <div className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate mt-0.5">
                        {isMuted ? "Turn message alerts back on" : "Silence notifications and alerts"}
                      </div>
                    </div>
                  </button>

                  {/* Clear Chat History */}
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmAction({
                        type: 'clear_chat',
                        convId: chatContextMenu.convId,
                        otherUid,
                        friendName,
                      });
                      setChatContextMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-orange-50 dark:hover:bg-orange-950/20 rounded-[20px] flex items-center space-x-3.5 transition-colors text-neutral-800 dark:text-neutral-100 cursor-pointer group"
                  >
                    <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                      <Layers className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[13.5px] leading-tight group-hover:text-orange-600 dark:group-hover:text-orange-400">
                        Clear Chat History
                      </div>
                      <div className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate mt-0.5">
                        Delete all messages in this conversation
                      </div>
                    </div>
                  </button>

                  {/* Delete Friend */}
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmAction({
                        type: otherUid ? 'delete_friend' : 'delete_chat',
                        convId: chatContextMenu.convId,
                        otherUid,
                        friendName,
                      });
                      setChatContextMenu(null);
                    }}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-[20px] flex items-center space-x-3.5 transition-colors text-rose-600 dark:text-rose-400 cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center shrink-0">
                      <UserX className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[13.5px] leading-tight">
                        {otherUid ? "Delete Friend" : "Delete Chat"}
                      </div>
                      <div className="text-[11px] text-rose-500/80 dark:text-rose-400/70 truncate mt-0.5">
                        {otherUid ? `Unfriend ${friendName} and delete conversation` : "Permanently remove conversation"}
                      </div>
                    </div>
                  </button>
                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>

      {/* Lag-Free Custom In-App Confirmation Modal (Clear History & Delete Friend) */}
      <AnimatePresence>
        {confirmAction && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[520] touch-manipulation"
              onClick={() => setConfirmAction(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 10 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[88%] max-w-[340px] bg-white dark:bg-[#16171b] rounded-[28px] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] border border-neutral-200/80 dark:border-white/10 z-[530] select-none flex flex-col items-center text-center will-change-transform transform-gpu pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Action Icon Badge */}
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3.5 shadow-sm ${
                confirmAction.type === 'clear_chat'
                  ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
              }`}>
                {confirmAction.type === 'clear_chat' ? (
                  <Layers className="w-7 h-7" strokeWidth={2.2} />
                ) : (
                  <Trash2 className="w-7 h-7" strokeWidth={2.2} />
                )}
              </div>

              {/* Title */}
              <h3 className="text-[17px] font-bold text-neutral-900 dark:text-white tracking-tight">
                {confirmAction.type === 'clear_chat'
                  ? 'Clear Chat History?'
                  : confirmAction.type === 'delete_friend'
                  ? 'Delete Friend?'
                  : 'Delete Conversation?'}
              </h3>

              {/* Description */}
              <p className="text-[13px] text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed max-w-[270px]">
                {confirmAction.type === 'clear_chat'
                  ? `All messages with ${confirmAction.friendName} will be cleared permanently.`
                  : confirmAction.type === 'delete_friend'
                  ? `Are you sure you want to remove ${confirmAction.friendName} from your friends? This chat will also be deleted.`
                  : `Are you sure you want to delete this conversation with ${confirmAction.friendName}?`}
              </p>

              {/* Action Buttons (Confirm & Cancel) */}
              <div className="flex items-center space-x-2.5 w-full mt-6">
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 py-3 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-white/10 dark:hover:bg-white/15 text-neutral-700 dark:text-neutral-200 font-semibold text-[13.5px] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const action = confirmAction;
                    setConfirmAction(null);
                    if (action.type === 'clear_chat') {
                      try {
                        const { clearConversationMessages } = await import("../services/chatService");
                        await clearConversationMessages(action.convId);
                        setMessagesCache((prev) => ({ ...prev, [action.convId]: [] }));
                      } catch (err) {
                        console.error("Error clearing chat messages:", err);
                      }
                    } else if (action.type === 'delete_friend') {
                      try {
                        if (currentUser && action.otherUid) {
                          const { unfollowUser } = await import("../services/followService");
                          await unfollowUser(currentUser.uid, action.otherUid);
                        }
                        const { deleteDoc, doc } = await import("firebase/firestore");
                        await deleteDoc(doc(db, "conversations", action.convId));
                        if (activeChat === action.convId) setActiveChat(null);
                        setConversations((c) => c.filter((x) => x.id !== action.convId));
                      } catch (err) {
                        console.error("Error deleting friend:", err);
                      }
                    } else if (action.type === 'delete_chat') {
                      try {
                        const { deleteDoc, doc } = await import("firebase/firestore");
                        await deleteDoc(doc(db, "conversations", action.convId));
                        if (activeChat === action.convId) setActiveChat(null);
                        setConversations((c) => c.filter((x) => x.id !== action.convId));
                      } catch (err) {
                        console.error("Error deleting chat:", err);
                      }
                    }
                  }}
                  className={`flex-1 py-3 rounded-2xl text-white font-bold text-[13.5px] transition-all cursor-pointer  shadow-md ${
                    confirmAction.type === 'clear_chat'
                      ? 'bg-orange-600 hover:bg-orange-500 shadow-orange-600/30'
                      : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                  }`}
                >
                  Confirm
                </button>
              </div>
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
                    <button className="w-20 h-20 rounded-full border-4 border-white/50 flex items-center justify-center transition-transform bg-white/20">
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
            <div className="pt-[calc(var(--app-safe-top)+16px)] md:pt-3 pb-3 px-4 min-h-[calc(72px+var(--app-safe-top))] md:min-h-[64px] border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10 shadow-2xs">
              <div className="flex items-center space-x-2.5">
                <button
                  onClick={() => {
                    if (showSharedMedia) {
                      setShowSharedMedia(false);
                    } else {
                      setShowChatSettings(false);
                    }
                  }}
                  className="p-2.5 -ml-1 hover:bg-gray-100 rounded-full transition-all cursor-pointer text-gray-800"
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
                              className="w-full h-full object-cover transition-transform duration-200"
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
                            className="absolute bottom-1 right-1 p-1.5 bg-black/65 hover:bg-black/90 rounded-full text-white transition-all shadow-md"
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
                      className="flex flex-col items-center justify-center p-3 bg-slate-50 hover:bg-purple-50 hover:text-purple-600 rounded-2xl border border-gray-100 transition-all group cursor-pointer"
                    >
                      <UserSquare className="w-5 h-5 text-gray-700 group-hover:text-purple-600 mb-1" />
                      <span className="text-[11px] font-semibold text-gray-600 group-hover:text-purple-600">
                        Profile
                      </span>
                    </button>

                    <button
                      className="flex flex-col items-center justify-center p-3 bg-slate-50 hover:bg-purple-50 hover:text-purple-600 rounded-2xl border border-gray-100 transition-all group cursor-pointer"
                    >
                      <Bell className="w-5 h-5 text-gray-700 group-hover:text-purple-600 mb-1" />
                      <span className="text-[11px] font-semibold text-gray-600 group-hover:text-purple-600">
                        Mute
                      </span>
                    </button>

                    <button
                      className="flex flex-col items-center justify-center p-3 bg-slate-50 hover:bg-purple-50 hover:text-purple-600 rounded-2xl border border-gray-100 transition-all group cursor-pointer"
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

      {/* Create Group Full-Screen Page Modal */}
      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        currentUser={currentUser}
        availableCandidates={availableGroupCandidates}
        onCreated={(chatId) => {
          setActiveChat(chatId);
          setShowCreateGroup(false);
        }}
      />

      {/* Inbox Privacy Sheet */}
      <AnimatePresence>
        {showPrivacySheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[200]"
              onClick={() => setShowPrivacySheet(false)}
            />
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 md:bottom-auto md:top-1/2 md:-translate-y-1/2 max-w-md mx-auto bg-white dark:bg-[#18181B] rounded-t-[32px] md:rounded-[28px] z-[210] px-6 pt-5 pb-8 shadow-[0_-8px_30px_rgb(0,0,0,0.15)] md:shadow-2xl border-t md:border border-neutral-200/80 dark:border-white/10"
            >
              <div className="w-12 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full mx-auto mb-5 md:hidden"></div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[19px] font-extrabold text-neutral-950 dark:text-white tracking-tight">
                  Activity Status
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPrivacySheet(false)}
                  className="w-8 h-8 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 flex items-center justify-center transition-colors border-0 cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" strokeWidth={2.4} />
                </button>
              </div>
              <p className="text-[13px] font-normal text-neutral-500 dark:text-neutral-400 mb-5 leading-relaxed">
                Choose who can see when you are active on the app.
              </p>
              
              <div className="space-y-2.5">
                <button
                  type="button"
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
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${privacyMode === "public" ? "border-purple-500/40 bg-purple-50/60 dark:bg-purple-950/30" : "border-neutral-200/80 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 bg-transparent"}`}
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center shrink-0">
                      <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></div>
                    </div>
                    <div>
                      <span className="font-bold text-[15px] text-neutral-900 dark:text-white block leading-none mb-1">Public (Online)</span>
                      <span className="text-[12px] text-neutral-500 dark:text-neutral-400 font-normal block leading-tight">Everyone can see when you are online</span>
                    </div>
                  </div>
                  {privacyMode === "public" && (
                    <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5" strokeWidth={3} />
                    </div>
                  )}
                </button>

                <button
                  type="button"
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
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${privacyMode === "private" ? "border-purple-500/40 bg-purple-50/60 dark:bg-purple-950/30" : "border-neutral-200/80 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 bg-transparent"}`}
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                      <EyeOff className="w-5 h-5 text-neutral-600 dark:text-neutral-300" strokeWidth={2.2} />
                    </div>
                    <div>
                      <span className="font-bold text-[15px] text-neutral-900 dark:text-white block leading-none mb-1">Private (Offline)</span>
                      <span className="text-[12px] text-neutral-500 dark:text-neutral-400 font-normal block leading-tight">Hide your online status from everyone</span>
                    </div>
                  </div>
                  {privacyMode === "private" && (
                    <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5" strokeWidth={3} />
                    </div>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Full-Screen Status Note Modal */}
      <StatusNoteModal
        isOpen={showStatusInput}
        onClose={() => setShowStatusInput(false)}
        currentUser={currentUser}
        currentNote={(currentUser as any)?.statusNote || ""}
        mode={statusNoteMode}
        onNoteUpdated={(newNote) => {
          if (currentUser) {
            (currentUser as any).statusNote = newNote;
            useAppStore.getState().setCurrentUser({ ...currentUser, statusNote: newNote } as any);
          }
          setStatusNoteText(newNote);
        }}
      />

      {/* Story-Style Full-Screen Note Viewer Modal */}
      <StoryNoteViewerModal
        isOpen={!!viewingNoteUser}
        onClose={() => setViewingNoteUser(null)}
        noteUser={viewingNoteUser}
        currentUserId={currentUser?.uid}
        onReply={handleNoteReply}
        onSendReaction={handleNoteReaction}
        onDeleteMyNote={() => {
          if (currentUser) {
            (currentUser as any).statusNote = "";
            useAppStore.getState().setCurrentUser({ ...currentUser, statusNote: "" } as any);
            try { localStorage.removeItem(`status_note_${currentUser.uid}`); } catch (err) {}
            setStatusNoteText("");
            import("firebase/firestore").then(({ updateDoc, doc, deleteField }) => {
              updateDoc(doc(db, "users", currentUser.uid), { statusNote: deleteField() }).catch(() => {});
            }).catch(() => {});
          }
        }}
        onNewNote={() => {
          setStatusNoteMode("create");
          setStatusNoteText("");
          setShowStatusInput(true);
        }}
        onEditNote={() => {
          setStatusNoteMode("edit");
          setStatusNoteText((currentUser as any)?.statusNote || "");
          setShowStatusInput(true);
        }}
        onEditMyNote={() => {
          setStatusNoteMode("edit");
          setStatusNoteText((currentUser as any)?.statusNote || "");
          setShowStatusInput(true);
        }}
      />

      {/* Full-Page Chat Theme Studio Modal (Root Level Overlay) */}
      <ChatThemeStudioModal
        isOpen={showThemeSettings}
        onClose={() => setShowThemeSettings(false)}
        currentTheme={activeConvTheme}
        partnerName={activeContact?.name || "Friend"}
        partnerAvatar={activeContact?.avatar || ""}
        isGroup={!!activeContact?.isGroup}
        initialBlur={activeConvThemeBlur}
        initialBrightness={activeConvThemeBrightness}
        onApplyTheme={async (newTheme, options) => {
          setChatTheme(newTheme);
          const blurVal = options?.blur ?? false;
          const brightVal = typeof options?.brightness === 'number' ? options.brightness : 1;

          if (activeChat) {
            setConversationThemeOverrides((prev) => {
              const updated = {
                ...prev,
                [activeChat]: {
                  theme: newTheme,
                  blur: blurVal,
                  brightness: brightVal,
                }
              };
              try { localStorage.setItem('chat_theme_overrides', JSON.stringify(updated)); } catch(e) {}
              return updated;
            });
          }

          if (activeConversation?.id) {
            try {
              await updateConversationTheme(
                activeConversation.id,
                newTheme,
                currentUser?.name,
                currentUser?.uid,
                blurVal,
                brightVal
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

      {/* Sticker Picker Modal (For You, My Stickers, Saved) */}
      <StickerPickerModal
        isOpen={showStickerModal}
        onClose={() => setShowStickerModal(false)}
        onSelectSticker={(url, type) => {
          handleSendStickerDirect(url, type);
        }}
        currentUser={currentUser}
      />

      {/* Global Sticker Click Viewer Modal (Enlarged preview in rounded box with 2 clean buttons: Save Sticker & Share to Chat) */}
      <StickerViewerModal
        isOpen={Boolean(viewingStickerUrl)}
        onClose={() => setViewingStickerUrl(null)}
        stickerUrl={viewingStickerUrl}
        stickerType={viewingStickerType}
        currentUserId={currentUser?.uid}
        onShareToChat={(url, type) => {
          handleSendStickerDirect(url, type);
          setViewingStickerUrl(null);
        }}
        onDeleteSticker={(url) => {
          setCommunityStickersCache((prev) => prev.filter((s) => s.url !== url));
          setViewingStickerUrl(null);
        }}
      />
    </div>
  );
}
