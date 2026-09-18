import React, { useEffect, useMemo } from 'react';
import { Heart, MessageCircle, UserPlus, AtSign, Bookmark, ArrowLeft, Bell, Play } from 'lucide-react';
import { useAppStore } from '../store';
import { subscribeNotifications, markAllRead } from '../services/notificationService';
import { followUser, unfollowUser } from '../services/followService';
import { Notification } from '../types';
import { formatTime } from '../utils';

const getIconForType = (type: string) => {
  switch (type) {
    case 'like': return <div className="bg-red-500 p-1 rounded-full border-2 border-white"><Heart className="w-3 h-3 text-white fill-white" /></div>;
    case 'comment': return <div className="bg-blue-500 p-1 rounded-full border-2 border-white"><MessageCircle className="w-3 h-3 text-white fill-white" /></div>;
    case 'reply': return <div className="bg-blue-400 p-1 rounded-full border-2 border-white"><MessageCircle className="w-3 h-3 text-white" /></div>;
    case 'comment_like': return <div className="bg-red-500 p-1 rounded-full border-2 border-white"><Heart className="w-3 h-3 text-white fill-white" /></div>;
    case 'follow': return <div className="bg-[#0095f6] p-1 rounded-full border-2 border-white"><UserPlus className="w-3 h-3 text-white" /></div>;
    case 'mention': return <div className="bg-purple-500 p-1 rounded-full border-2 border-white"><AtSign className="w-3 h-3 text-white" /></div>;
    case 'favorite': return <div className="bg-yellow-500 p-1 rounded-full border-2 border-white"><Bookmark className="w-3 h-3 text-white fill-white" /></div>;
    default: return <div className="bg-gray-500 p-1 rounded-full border-2 border-white"><Bell className="w-3 h-3 text-white" /></div>;
  }
};

const NotificationItem = React.memo(({ notif, isFollowing }: { notif: Notification; isFollowing: boolean }) => {
  const { 
    setViewingUser, 
    pushPage, 
    setViewingMedia, 
    setViewingReel, 
    currentUser, 
    setHighlightedCommentId, 
    setHighlightedPostId 
  } = useAppStore();

  const handleActorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewingUser({ uid: notif.actorId, name: notif.actorName, avatar: notif.actorAvatar });
    pushPage('profile');
  };

  const handlePostClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (notif.postId) {
      if (['comment', 'reply', 'like', 'comment_like', 'mention'].includes(notif.type)) {
        setHighlightedCommentId(notif.targetId);
        setHighlightedPostId(notif.postId);
      }
      
      try {
        const { getPost } = await import('../services/postService');
        const post = await getPost(notif.postId);
        if (post) {
          setViewingReel({ ...post, single: true });
        } else if (notif.postMedia) {
          setViewingReel({ id: notif.postId, authorId: notif.postAuthorId || '', authorName: notif.postAuthorName || notif.actorName, authorAvatar: notif.postAuthorAvatar || notif.actorAvatar, media: [notif.postMedia], text: '', type: 'reel', single: true });
        }
      } catch (err) {
        console.error("Failed to load post for notification", err);
      }
    } else {
      handleActorClick(e);
    }
  };

  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    try {
      if (isFollowing) {
        await unfollowUser(currentUser.uid, notif.actorId);
      } else {
        await followUser(currentUser, { uid: notif.actorId, name: notif.actorName, avatar: notif.actorAvatar });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const isVideoMedia = notif.postMedia && (notif.postMedia.includes('.mp4') || notif.postMedia.includes('video'));

  return (
    <div 
      onClick={handlePostClick}
      className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50/80 transition-colors cursor-pointer border-b border-gray-50/60 active:bg-gray-100/50 ${!notif.isRead ? 'bg-blue-50/40' : ''}`}
    >
      <div className="flex items-center flex-1 pr-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0" onClick={handleActorClick}>
          <img 
            src={notif.actorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(notif.actorName || 'User')}&background=random`} 
            alt="avatar" 
            className="w-11 h-11 rounded-full object-cover border border-gray-100 shadow-2xs" 
            referrerPolicy="no-referrer" 
            loading="lazy"
          />
          <div className="absolute -bottom-1 -right-1">
            {getIconForType(notif.type)}
          </div>
        </div>

        {/* Text Content */}
        <div className="ml-3 text-[14px] leading-[18px] flex-1">
          <p className={!notif.isRead ? 'text-black font-bold' : 'text-gray-900 font-normal'}>
            <span className={`cursor-pointer hover:underline ${!notif.isRead ? 'font-bold text-black' : 'font-normal text-gray-900'}`} onClick={handleActorClick}>
              {notif.actorName || 'User'}
            </span>
            <span className={`ml-1 tracking-tight ${!notif.isRead ? 'font-bold text-black' : 'text-gray-700 font-normal'}`}>
              {notif.type === 'like' && 'liked your post.'}
              {notif.type === 'comment' && `commented: ${notif.content}`}
              {notif.type === 'follow' && 'started following you.'}
              {notif.type === 'mention' && 'mentioned you in a post.'}
              {notif.type === 'reply' && `replied to your comment: ${notif.content}`}
              {notif.type === 'favorite' && 'added your reel to favorites.'}
              {notif.type === 'comment_like' && 'liked your comment.'}
            </span>
          </p>
          <span className={`text-[11px] mt-0.5 inline-block ${!notif.isRead ? 'font-bold text-black' : 'text-gray-400 font-normal'}`}>
            {formatTime(notif.createdAt)}
          </span>
        </div>
      </div>
      
      {/* Right Action */}
      <div className="flex-shrink-0 ml-3">
        {notif.type === 'follow' ? (
          <button 
            onClick={handleFollowToggle}
            className={`px-4 py-1.5 rounded-xl text-[13px] font-normal transition-all active:scale-95 shadow-2xs ${
               isFollowing
                ? 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                : 'bg-blue-500 text-white hover:bg-blue-600 shadow-blue-100'
            }`}
          >
            {isFollowing ? 'Following' : 'Follow back'}
          </button>
        ) : notif.postMedia ? (
          <div className="w-11 h-14 rounded-lg overflow-hidden border border-gray-200/80 relative bg-gray-100 shadow-2xs">
            {isVideoMedia ? (
              <div className="w-full h-full relative flex items-center justify-center bg-gray-900">
                <Play className="w-4 h-4 text-white fill-white shadow-xs" />
              </div>
            ) : (
              <img 
                src={notif.postMedia} 
                alt="Post" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer" 
                loading="lazy"
              />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
});

export default function Notifications() {
  const { 
    popPage, 
    currentUser, 
    cachedNotifications, 
    setCachedNotifications, 
    followingIds 
  } = useAppStore();

  const followingSet = useMemo(() => new Set(followingIds), [followingIds]);

  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = subscribeNotifications(currentUser.uid, (notifs) => {
      setCachedNotifications(notifs);
    });
    
    // Mark as read after 1.5 seconds
    const timer = setTimeout(() => {
      markAllRead(currentUser.uid);
    }, 1500);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [currentUser, setCachedNotifications]);

  const sections = useMemo(() => [
    { title: 'New', items: cachedNotifications.filter(n => !n.isRead) },
    { title: 'Earlier', items: cachedNotifications.filter(n => n.isRead) }
  ], [cachedNotifications]);

  return (
    <div className="h-full w-full overflow-y-auto bg-white flex flex-col items-center md:pl-24">
      {/* Mobile Header */}
      <div className="sm:hidden w-full px-4 pt-8 pb-3 border-b border-gray-100 flex items-center space-x-3 bg-white sticky top-0 z-20 shadow-2xs">
        <button onClick={() => popPage()} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors active:scale-95">
          <ArrowLeft className="w-5.5 h-5.5 text-gray-900" />
        </button>
        <h2 className="text-xl font-normal text-gray-900">Notifications</h2>
      </div>

      <div className="w-full max-w-[600px] py-2 sm:py-6 px-2 sm:px-4">
        <h2 className="hidden sm:block text-2xl font-semibold text-gray-900 mb-4 px-2">Notifications</h2>
        
        <div className="space-y-4 pb-20">
          {sections.map((group) => group.items.length > 0 && (
            <div key={group.title} className="bg-white rounded-2xl border border-gray-100/90 shadow-2xs overflow-hidden">
              <h3 className="font-semibold text-[13px] text-gray-500 uppercase tracking-wider px-4 py-2.5 bg-gray-50/50 border-b border-gray-100/60">{group.title}</h3>
              <div className="divide-y divide-gray-100/70">
                {group.items.map((notif) => (
                  <NotificationItem 
                    key={notif.id} 
                    notif={notif} 
                    isFollowing={followingSet.has(notif.actorId)} 
                  />
                ))}
              </div>
            </div>
          ))}

          {cachedNotifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400">
              <Bell className="w-14 h-14 text-gray-200 mb-3 stroke-1" />
              <p className="text-base font-normal">No notifications yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
