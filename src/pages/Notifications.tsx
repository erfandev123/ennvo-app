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
          const isVideo = notif.postMedia.includes('.mp4') || notif.postMedia.includes('video');
          setViewingReel({ id: notif.postId, authorId: notif.postAuthorId || '', authorName: notif.postAuthorName || notif.actorName, authorAvatar: notif.postAuthorAvatar || notif.actorAvatar, media: [notif.postMedia], text: notif.content || '', type: isVideo ? 'reel' : 'post', single: true });
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
      className={`flex items-center justify-between px-3.5 py-2.5 hover:bg-gray-50/90 transition-colors cursor-pointer active:bg-gray-100/60 ${!notif.isRead ? 'bg-purple-50/30' : ''}`}
    >
      <div className="flex items-center flex-1 pr-2 min-w-0">
        {/* Flat 2D Avatar */}
        <div className="relative flex-shrink-0 cursor-pointer" onClick={handleActorClick}>
          <img 
            src={notif.actorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(notif.actorName || 'User')}&background=random`} 
            alt="avatar" 
            className="w-10 h-10 rounded-full object-cover" 
            referrerPolicy="no-referrer" 
            loading="lazy"
          />
          <div className="absolute -bottom-0.5 -right-0.5">
            {getIconForType(notif.type)}
          </div>
        </div>

        {/* Text Content */}
        <div className="ml-3 text-[13.5px] leading-snug flex-1 min-w-0">
          <p className="text-gray-900 font-normal">
            <span className="font-semibold text-gray-950 cursor-pointer hover:underline" onClick={handleActorClick}>
              {notif.actorName || 'User'}
            </span>
            <span className="ml-1 text-gray-600 font-normal">
              {notif.type === 'like' && 'liked your post.'}
              {notif.type === 'comment' && `commented: ${notif.content}`}
              {notif.type === 'follow' && 'started following you.'}
              {notif.type === 'mention' && 'mentioned you in a post.'}
              {notif.type === 'reply' && `replied to your comment: ${notif.content}`}
              {notif.type === 'favorite' && 'saved your post.'}
              {notif.type === 'comment_like' && 'liked your comment.'}
            </span>
          </p>
          <span className="text-[11px] text-gray-400 font-normal mt-0.5 inline-block">
            {formatTime(notif.createdAt)}
          </span>
        </div>
      </div>
      
      {/* Right Action */}
      <div className="flex-shrink-0 ml-2">
        {notif.type === 'follow' ? (
          <button 
            onClick={handleFollowToggle}
            className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-medium transition-all active:scale-95 ${
               isFollowing
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-purple-600 text-white hover:bg-purple-700 shadow-xs'
            }`}
          >
            {isFollowing ? 'Following' : 'Follow back'}
          </button>
        ) : notif.postMedia ? (
          <div className="w-10 h-12 rounded-lg overflow-hidden relative bg-gray-100">
            {isVideoMedia ? (
              <div className="w-full h-full relative flex items-center justify-center bg-gray-900">
                <Play className="w-3.5 h-3.5 text-white fill-white" />
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
    <div className="h-full w-full overflow-y-auto bg-white flex flex-col items-center md:pl-28 lg:pl-32">
      {/* Mobile Header */}
      <div className="sm:hidden w-full px-4 pt-8 pb-3 border-b border-gray-100 flex items-center space-x-3 bg-white sticky top-0 z-20">
        <button onClick={() => popPage()} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors active:scale-95">
          <ArrowLeft className="w-5.5 h-5.5 text-gray-900" />
        </button>
        <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
      </div>

      <div className="w-full max-w-[620px] py-2 sm:py-6 px-2 sm:px-4">
        <h2 className="hidden sm:block text-xl font-bold text-gray-900 mb-3 px-2">Notifications</h2>
        
        <div className="space-y-3 pb-20">
          {sections.map((group) => group.items.length > 0 && (
            <div key={group.title} className="bg-white rounded-2xl border border-gray-100/80 overflow-hidden">
              <h3 className="font-semibold text-[12px] text-gray-400 uppercase tracking-wider px-4 py-2 bg-gray-50/60 border-b border-gray-100/60">{group.title}</h3>
              <div className="divide-y divide-gray-100/60">
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
            <div className="flex flex-col items-center justify-center py-24 text-gray-400 space-y-2">
              <Bell className="w-12 h-12 text-gray-200 stroke-1" />
              <p className="text-sm font-normal text-gray-500">No notifications yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
