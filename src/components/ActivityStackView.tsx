import React, { useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { 
  Heart, 
  MessageCircle, 
  UserPlus, 
  Play, 
  RotateCcw, 
  Layers, 
  Sparkles,
  ChevronRight,
  ArrowDownCircle,
  AtSign,
  Bookmark
} from 'lucide-react';
import { Notification } from '../types';
import { formatTime } from '../utils';

interface ActivityStackViewProps {
  items: Notification[];
  totalRemaining?: number;
  onUnpackMore?: () => void;
  onItemClick: (notif: Notification) => void;
  onProfileClick: (actorId: string, actorName: string, actorAvatar?: string) => void;
  followingIds?: string[];
  followerIds?: string[];
  onFollowToggle?: (actorId: string, actorName: string, actorAvatar?: string) => void;
  onDismissItem?: (id: string) => void;
}

// Single Draggable Activity Card in Stack Deck
function DraggableActivityCard({
  notif,
  index,
  total,
  onDismiss,
  onUnpack,
  onItemClick,
  onProfileClick,
  followingIds = [],
  followerIds = [],
  onFollowToggle,
}: {
  key?: React.Key;
  notif: Notification;
  index: number;
  total: number;
  onDismiss: (dir: 'left' | 'right') => void;
  onUnpack?: () => void;
  onItemClick: (notif: Notification) => void;
  onProfileClick: (actorId: string, actorName: string, actorAvatar?: string) => void;
  followingIds?: string[];
  followerIds?: string[];
  onFollowToggle?: (actorId: string, actorName: string, actorAvatar?: string) => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-16, 16]);
  const opacity = useTransform(x, [-200, -80, 0, 80, 200], [0.4, 0.9, 1, 0.9, 0.4]);
  const isTop = index === 0;

  const isFollowing = followingIds.includes(notif.actorId);
  const isFollower = followerIds.includes(notif.actorId) || notif.type === 'follow';
  const isFriend = isFollowing && isFollower;

  const getActionLabel = () => {
    switch (notif.type) {
      case 'like':
        return 'liked your post/reel';
      case 'comment':
        return `commented: "${(notif as any).commentText || notif.content || ''}"`;
      case 'reply':
        return `replied: "${(notif as any).commentText || notif.content || ''}"`;
      case 'follow':
        return 'started following you';
      case 'mention':
        return 'mentioned you';
      case 'comment_like':
        return 'liked your comment';
      case 'repost':
        return 'reposted your video';
      case 'favorite':
        return 'saved your post';
      default:
        return notif.content || 'interacted with you';
    }
  };

  const scale = 1 - Math.min(index, 3) * 0.04;
  const translateY = Math.min(index, 3) * 8;
  const zIndex = 30 - index;

  return (
    <motion.div
      style={{
        zIndex,
        scale,
        y: translateY,
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        opacity: isTop ? opacity : 1 - index * 0.16,
      }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={(_, info) => {
        if (!isTop) return;
        if (info.offset.x > 75 || info.velocity.x > 450) {
          onDismiss('right');
        } else if (info.offset.x < -75 || info.velocity.x < -450) {
          onDismiss('left');
        }
      }}
      onClick={(e) => {
        // Tapping card triggers smooth unpacking of items into list
        if (isTop && onUnpack) {
          onUnpack();
        }
      }}
      className={`absolute inset-x-0 top-0 bg-white dark:bg-[#121212] rounded-3xl p-4 shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.4)] select-none transition-shadow ${
        isTop ? 'cursor-grab active:cursor-grabbing hover:shadow-xl' : 'pointer-events-none'
      }`}
    >
      <div className="flex items-center justify-between mb-2.5 pb-2">
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-gradient-to-r from-rose-500 to-purple-500 animate-pulse" />
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            Stack Card {index + 1} of {total}
          </span>
        </div>
        <span className="text-[11.5px] font-medium text-neutral-400 dark:text-neutral-500">
          {formatTime(notif.createdAt)}
        </span>
      </div>

      <div className="flex items-center justify-between space-x-3">
        {/* Profile Avatar */}
        <div 
          className="relative shrink-0 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onProfileClick(notif.actorId, notif.actorName, notif.actorAvatar);
          }}
        >
          <img
            src={notif.actorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(notif.actorName || 'User')}&background=random`}
            alt={notif.actorName}
            className="w-12 h-12 rounded-full object-cover shrink-0"
            referrerPolicy="no-referrer"
            loading="lazy"
          />
          <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-white dark:bg-[#121212] shadow-xs">
            {notif.type === 'like' || notif.type === 'comment_like' ? (
              <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
            ) : notif.type === 'comment' || notif.type === 'reply' ? (
              <MessageCircle className="w-3 h-3 text-blue-500 fill-blue-500" />
            ) : notif.type === 'follow' ? (
              <UserPlus className="w-3 h-3 text-purple-500" />
            ) : notif.type === 'mention' ? (
              <AtSign className="w-3 h-3 text-indigo-500" />
            ) : notif.type === 'favorite' ? (
              <Bookmark className="w-3 h-3 text-amber-500 fill-amber-500" />
            ) : notif.type === 'repost' ? (
              <RotateCcw className="w-3 h-3 text-emerald-500" />
            ) : (
              <Sparkles className="w-3 h-3 text-amber-500" />
            )}
          </div>
        </div>

        {/* Content Description */}
        <div 
          className="flex-1 min-w-0 pt-0.5 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onItemClick(notif);
          }}
        >
          <p className="text-[13.5px] leading-snug text-neutral-950 dark:text-white">
            <span className="font-bold hover:underline">{notif.actorName}</span>{' '}
            <span className="text-neutral-600 dark:text-neutral-400 font-normal">{getActionLabel()}</span>
          </p>
          <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium mt-1 flex items-center space-x-1">
            <span>👈 Drag or tap to load into list</span>
          </p>
        </div>

        {/* Action Button or Post Media Thumbnail */}
        {notif.type === 'follow' ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFollowToggle?.(notif.actorId, notif.actorName, notif.actorAvatar);
            }}
            className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold tracking-tight transition-all shrink-0 cursor-pointer active:scale-95 ${
              isFriend
                ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                : isFollowing
                ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                : 'bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 shadow-xs'
            }`}
          >
            {isFriend ? 'Friends' : isFollowing ? 'Following' : 'Follow back'}
          </button>
        ) : notif.postMedia ? (
          <div 
            onClick={(e) => {
              e.stopPropagation();
              onItemClick(notif);
            }}
            className="w-11 h-14 rounded-xl overflow-hidden shrink-0 bg-neutral-900 relative cursor-pointer group shadow-xs"
          >
            {notif.postMedia.includes('.mp4') || notif.postMedia.includes('video') ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <video
                  src={`${notif.postMedia}#t=0.001`}
                  className="w-full h-full object-cover pointer-events-none opacity-85"
                  preload="metadata"
                  muted
                  playsInline
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Play className="w-3.5 h-3.5 text-white fill-white" />
                </div>
              </div>
            ) : (
              <img
                src={notif.postMedia}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                alt="thumb"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
            )}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

export function ActivityStackView({
  items,
  totalRemaining,
  onUnpackMore,
  onItemClick,
  onProfileClick,
  followingIds,
  followerIds,
  onFollowToggle,
  onDismissItem,
}: ActivityStackViewProps) {
  const [internalItems, setInternalItems] = useState<Notification[]>(items);

  // Sync internal items when parent items change
  React.useEffect(() => {
    setInternalItems(items);
  }, [items]);

  if (!internalItems || internalItems.length === 0) return null;

  const visibleCards = internalItems.slice(0, 4);

  const handleDismiss = (_dir: 'left' | 'right') => {
    const dismissed = internalItems[0];
    if (dismissed && onDismissItem) {
      onDismissItem(dismissed.id);
    }
    setInternalItems((prev) => prev.slice(1));
  };

  return (
    <div className="w-full my-4 px-2 sm:px-3">
      {/* Sleek Header Banner: Tapping expands into the list above */}
      <div 
        onClick={() => onUnpackMore?.()}
        className="flex items-center justify-between mb-3 px-1.5 cursor-pointer group select-none"
      >
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-[13.5px] font-extrabold text-neutral-900 dark:text-white flex items-center space-x-1.5">
              <span>Earlier Activity Stack</span>
              {totalRemaining !== undefined && (
                <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                  ({totalRemaining} older)
                </span>
              )}
            </h4>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
              Tap card or click here to expand into list
            </p>
          </div>
        </div>

        {onUnpackMore && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUnpackMore();
            }}
            className="px-3 py-1.5 rounded-full text-[12px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center space-x-1 transition-all active:scale-95 border-0 cursor-pointer"
          >
            <ArrowDownCircle className="w-3.5 h-3.5 text-purple-500" />
            <span>Load More</span>
          </button>
        )}
      </div>

      {/* Stack Cards Deck */}
      <div className="relative w-full h-[150px] select-none">
        <AnimatePresence>
          {visibleCards.map((notif, idx) => (
            <DraggableActivityCard
              key={notif.id}
              notif={notif}
              index={idx}
              total={internalItems.length}
              onDismiss={handleDismiss}
              onUnpack={onUnpackMore}
              onItemClick={onItemClick}
              onProfileClick={onProfileClick}
              followingIds={followingIds}
              followerIds={followerIds}
              onFollowToggle={onFollowToggle}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Interactive Draggable Stack View for Earlier Followers
interface FollowerStackViewProps {
  followers: any[];
  totalRemaining?: number;
  onUnpackMore?: () => void;
  onProfileClick: (uid: string, name: string, avatar?: string) => void;
  followingIds?: string[];
  followerIds?: string[];
  onFollowToggle?: (uid: string, name: string, avatar?: string) => void;
  onDismissFollower?: (id: string) => void;
}

export function FollowerStackView({
  followers,
  totalRemaining,
  onUnpackMore,
  onProfileClick,
  followingIds = [],
  followerIds = [],
  onFollowToggle,
  onDismissFollower,
}: FollowerStackViewProps) {
  const [internalList, setInternalList] = useState<any[]>(followers);

  React.useEffect(() => {
    setInternalList(followers);
  }, [followers]);

  if (!internalList || internalList.length === 0) return null;

  const visibleCards = internalList.slice(0, 4);

  const handleDismiss = (_dir: 'left' | 'right') => {
    const dismissed = internalList[0];
    if (dismissed && onDismissFollower) {
      onDismissFollower(dismissed.id);
    }
    setInternalList((prev) => prev.slice(1));
  };

  return (
    <div className="w-full my-4 px-2 sm:px-3">
      {/* Header with expand trigger */}
      <div 
        onClick={() => onUnpackMore?.()}
        className="flex items-center justify-between mb-3 px-1.5 cursor-pointer select-none"
      >
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <UserPlus className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-[13.5px] font-extrabold text-neutral-900 dark:text-white flex items-center space-x-1.5">
              <span>Follower Stack</span>
              {totalRemaining !== undefined && (
                <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                  ({totalRemaining} older)
                </span>
              )}
            </h4>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
              Tap card or click to expand into list
            </p>
          </div>
        </div>

        {onUnpackMore && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUnpackMore();
            }}
            className="px-3 py-1.5 rounded-full text-[12px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center space-x-1 transition-all active:scale-95 border-0 cursor-pointer"
          >
            <ArrowDownCircle className="w-3.5 h-3.5 text-blue-500" />
            <span>Load More</span>
          </button>
        )}
      </div>

      <div className="relative w-full h-[145px] select-none">
        <AnimatePresence>
          {visibleCards.map((f, idx) => {
            const isTop = idx === 0;
            const isFollowing = followingIds.includes(f.id);
            const isFollower = followerIds.includes(f.id) || true;
            const isFriend = isFollowing && isFollower;

            return (
              <motion.div
                key={f.id}
                style={{
                  zIndex: 30 - idx,
                  scale: 1 - Math.min(idx, 3) * 0.04,
                  y: Math.min(idx, 3) * 8,
                  opacity: isTop ? 1 : 1 - idx * 0.16,
                }}
                drag={isTop ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.8}
                onDragEnd={(_, info) => {
                  if (!isTop) return;
                  if (Math.abs(info.offset.x) > 75 || Math.abs(info.velocity.x) > 450) {
                    handleDismiss(info.offset.x > 0 ? 'right' : 'left');
                  }
                }}
                onClick={() => {
                  if (isTop && onUnpackMore) onUnpackMore();
                }}
                className={`absolute inset-x-0 top-0 bg-white dark:bg-[#121212] rounded-3xl p-4 shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.4)] select-none ${
                  isTop ? 'cursor-grab active:cursor-grabbing hover:shadow-xl' : 'pointer-events-none'
                }`}
              >
                <div className="flex items-center justify-between mb-2.5 pb-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                    Follower Card {idx + 1} of {internalList.length}
                  </span>
                  <span className="text-[11px] text-neutral-400 dark:text-neutral-500 font-medium">
                    {f.createdAt ? formatTime(f.createdAt) : 'Recently'}
                  </span>
                </div>

                <div className="flex items-center justify-between space-x-3">
                  <div 
                    className="flex items-center space-x-3 min-w-0 flex-1 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onProfileClick(f.id, f.name, f.avatar);
                    }}
                  >
                    <img
                      src={f.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(f.name || 'User')}&background=random`}
                      alt={f.name}
                      className="w-12 h-12 rounded-full object-cover shrink-0"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[14px] text-neutral-950 dark:text-white truncate hover:underline">
                        {f.name}
                      </p>
                      <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 truncate">
                        {f.username ? `@${f.username}` : 'Followed you'}
                      </p>
                      <p className="text-[10.5px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">
                        👈 Drag or tap to load into list
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFollowToggle?.(f.id, f.name, f.avatar);
                    }}
                    className={`px-4 py-1.5 rounded-full text-[12px] font-bold tracking-tight transition-all shrink-0 cursor-pointer active:scale-95 ${
                      isFriend
                        ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                        : isFollowing
                        ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                        : 'bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 shadow-xs'
                    }`}
                  >
                    {isFriend ? 'Friends' : isFollowing ? 'Following' : 'Follow back'}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
