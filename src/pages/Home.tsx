import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Image as ImageIcon, Video, Smile, MoreHorizontal, Heart, MessageCircle, Send, Bookmark, Plus, Search, X, ChevronDown, ChevronRight, Type, Play, UserPlus, Globe, Share2, Music, Settings2, MoreVertical, ArrowLeft, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { useAppStore } from '../store';
import { db } from '../firebase';
import { subscribeFeed, createPost, subscribeReels } from '../services/postService';
import { subscribeStories, uploadStory, Story } from '../services/storyService';
import { followUser } from '../services/followService';
import { Post, Comment, User as AppUser } from '../types';
import { PostItem } from '../components/PostItem';
import { CreatePostModal } from '../components/CreatePostModal';
import { PullToRefresh } from '../components/PullToRefresh';

const contacts = [
  { id: 1, name: 'cute_coder', avatar: 'https://picsum.photos/seed/cute/32/32', online: true },
  { id: 2, name: 'master_dev', avatar: 'https://picsum.photos/seed/master/32/32', online: true },
  { id: 3, name: 'sarah_ui', avatar: 'https://picsum.photos/seed/sarah/32/32', online: false },
  { id: 4, name: 'alex_dev', avatar: 'https://picsum.photos/seed/alex/32/32', online: true },
  { id: 5, name: 'design_guru', avatar: 'https://picsum.photos/seed/design/32/32', online: true },
];

// --- Memoized Components ---
const StoryItem = React.memo(({ story, onClick }: { story: any, onClick: () => void }) => {
  if (story.isUser) {
    return (
      <div 
        onClick={onClick} 
        className="relative w-[110px] h-[190px] sm:w-[125px] sm:h-[215px] rounded-3xl overflow-hidden flex-shrink-0 cursor-pointer group shadow-sm hover:shadow-md border border-gray-100 bg-white flex flex-col transition-all duration-300 transform-gpu active:scale-95"
      >
        {/* Top 68% Image background */}
        <div className="relative w-full h-[68%] overflow-hidden bg-gray-100">
          <img 
            src={story.bg || `https://ui-avatars.com/api/?name=${encodeURIComponent(story.name || 'User')}&background=random`} 
            alt="My Avatar" 
            loading="lazy" 
            decoding="async"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
          />
          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
        </div>

        {/* Plus Button overlapping the split */}
        <div className="absolute top-[68%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md border-2 border-white group-hover:scale-110 transition-transform">
            <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-white" strokeWidth={2.8} />
          </div>
        </div>

        {/* Bottom 32% text label */}
        <div className="w-full h-[32%] bg-white flex items-end justify-center pb-2.5 pt-3 px-1 text-center">
          <span className="text-[11.5px] sm:text-xs font-bold text-gray-900 tracking-tight leading-none">
            Add Story
          </span>
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={onClick} 
      className="relative w-[110px] h-[190px] sm:w-[125px] sm:h-[215px] rounded-3xl overflow-hidden flex-shrink-0 cursor-pointer group shadow-sm hover:shadow-md border border-gray-100/80 bg-gray-900 transition-all duration-300 active:scale-95 transform-gpu"
    >
      {story.mediaUrl && (story.mediaUrl.includes('.mp4') || story.mediaUrl.includes('video')) ? (
        <>
          <video 
            src={story.mediaUrl.includes('#t=') ? story.mediaUrl : `${story.mediaUrl}#t=0.5`} 
            poster={story.thumbnailUrl || story.thumbnail || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-95" 
            muted 
            playsInline 
            // @ts-ignore
            webkit-playsinline="true"
            // @ts-ignore
            x5-playsinline="true"
            preload="metadata"
            onLoadedMetadata={(e) => {
              try { e.currentTarget.currentTime = 0.5; } catch(err) {}
            }}
          />
          {(story.thumbnailUrl || story.thumbnail) && (
            <img 
              src={story.thumbnailUrl || story.thumbnail} 
              alt="Story thumbnail" 
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
            />
          )}
        </>
      ) : (
        <img 
          src={story.mediaUrl || story.bg || `https://picsum.photos/seed/${story.id}/200/300`} 
          alt="Story bg" 
          loading="lazy" 
          decoding="async"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = `https://picsum.photos/seed/${story.id}/200/300`; }}
        />
      )}
      
      {/* Soft gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />
      
      {story.text && (
        <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 pointer-events-none z-10">
          <p className="text-white text-[10px] font-medium text-center line-clamp-3 bg-black/40 px-2 py-1 rounded-xl backdrop-blur-xs shadow-xs border border-white/10">
            {story.text}
          </p>
        </div>
      )}
      
      {/* Author Avatar Badge */}
      <div className="absolute top-2.5 left-2.5 rounded-full p-[2px] bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600 shadow-md z-10">
        <img 
          src={story.authorAvatar || story.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(story.authorName || story.name)}&background=random`} 
          alt={story.authorName || story.name} 
          loading="lazy" 
          referrerPolicy="no-referrer"
          className="w-8 h-8 rounded-full border border-white object-cover" 
        />
      </div>

      <span className="absolute bottom-2.5 left-2 right-2 text-white text-[11.5px] font-semibold truncate drop-shadow-md text-center z-10 tracking-tight">
        {story.authorName || story.name}
      </span>
    </div>
  );
});

const SuggestedAccountItem: React.FC<{ user: AppUser, key?: any }> = React.memo(({ user }) => {
  const { setViewingUser, currentUser, pushPage, followingIds } = useAppStore();
  const isFollowing = useMemo(() => {
    return (followingIds || []).includes(user.uid);
  }, [followingIds, user.uid]);

  const [isFollowingState, setIsFollowingState] = useState(isFollowing);

  useEffect(() => {
    setIsFollowingState(isFollowing);
  }, [isFollowing]);

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    try {
      if (isFollowingState) {
        setIsFollowingState(false);
        await import('../services/followService').then(m => m.unfollowUser(currentUser.uid, user.uid));
      } else {
        setIsFollowingState(true);
        await followUser(currentUser, user);
      }
    } catch (err) {
      console.error(err);
      setIsFollowingState(isFollowing);
    }
  };

  return (
    <div 
      className="w-[110px] flex-shrink-0 bg-white border border-gray-50 rounded-2xl p-2.5 flex flex-col items-center text-center cursor-pointer hover:bg-gray-50 transition-all duration-200 group transform-gpu" 
      onClick={() => { setViewingUser({ uid: user.uid, name: user.name, avatar: user.avatar }); pushPage('profile'); }}
    >
      <div className="relative mb-2">
        <img 
          src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} 
          className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-sm transition-transform group-hover:scale-105" 
          alt="Suggested" 
          referrerPolicy="no-referrer"
          loading="lazy"
        />
      </div>
      <h4 className="font-normal text-[12px] text-gray-900 truncate w-full mb-0.5">{user.name}</h4>
      <p className="text-[10px] text-gray-500 mb-2.5 font-normal tracking-tight">Suggested</p>
      <button 
        onClick={handleFollow}
        className={`w-full font-normal py-1 rounded-xl text-[10px] transition-all active:scale-95 ${isFollowingState ? 'bg-gray-100 text-gray-500' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'}`}
      >
        {isFollowingState ? 'Following' : 'Follow'}
      </button>
    </div>
  );
});

const SuggestedAccounts = React.memo(() => {
  const { currentUser } = useAppStore();
  const [suggested, setSuggested] = useState<AppUser[]>([]);

  useEffect(() => {
    const fetchSuggested = async () => {
      if (!currentUser) return;
      try {
        const { collection, query, limit, getDocs, where } = await import('firebase/firestore');
        const q = query(collection(db, 'users'), limit(20));
        const snapshot = await getDocs(q);
        const users = snapshot.docs
          .map(d => ({ uid: d.id, ...d.data() } as AppUser))
          .filter(u => u.uid !== currentUser.uid)
          .sort(() => Math.random() - 0.5)
          .slice(0, 10);
        setSuggested(users);
      } catch (e) {
        console.error(e);
      }
    };
    fetchSuggested();
  }, [currentUser]);

  if (suggested.length === 0) return null;

  return (
    <div className="bg-white border-b-[8px] border-gray-100 overflow-hidden py-3">
      <div className="flex items-center justify-between px-4 mb-3">
        <div className="flex items-center space-x-2">
          <UserPlus className="w-4 h-4 text-blue-600" />
          <h3 className="font-normal text-[15px] text-gray-900 tracking-tight">Suggested for you</h3>
        </div>
        <button onClick={() => useAppStore.getState().pushPage('search')} className="text-blue-600 font-normal text-xs hover:underline">See All</button>
      </div>
      <div className="flex space-x-2.5 overflow-x-auto no-scrollbar px-4">
        {suggested.map(user => (
          <SuggestedAccountItem key={user.uid} user={user} />
        ))}
      </div>
    </div>
  );
});

const SuggestedReels = React.memo(() => {
  const { setViewingReel, setViewingReelContext, pushPage } = useAppStore();
  const [reels, setReels] = useState<Post[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeReels((fetchedReels) => {
      setReels(fetchedReels.slice(0, 4)); // Only show 4 featured reels
    });
    return () => unsubscribe();
  }, []);

  if (reels.length === 0) return null;

  return (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-3 py-3">
    <div className="flex items-center justify-between px-4 mb-2">
      <div className="flex items-center space-x-2">
        <Play className="w-4 h-4 text-red-500 fill-red-500" />
        <h3 className="font-normal text-[15px] text-gray-900 tracking-tight">Featured Reels</h3>
      </div>
      <button onClick={() => pushPage('reels')} className="text-blue-500 font-normal text-xs hover:underline">Watch All</button>
    </div>
    <div className="flex space-x-2.5 overflow-x-auto no-scrollbar px-4 pb-1">
      {reels.map(reel => (
        <div key={reel.id} onClick={() => {
          setViewingReelContext('all');
          setViewingReel(reel);
        }} className="w-[130px] h-[210px] flex-shrink-0 rounded-xl overflow-hidden relative cursor-pointer group shadow-md border border-white/5 bg-black">
          <video 
            src={reel.media?.[0]} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90" 
            muted
            playsInline
            // @ts-ignore
            webkit-playsinline="true"
            // @ts-ignore
            x5-playsinline="true"
            poster={reel.thumbnailUrl || reel.thumbnail || "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="}
            preload="metadata"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
          <div className="absolute bottom-2 left-2 flex items-center space-x-1.5 text-white">
            <Play className="w-3 h-3 fill-white" />
            <span className="text-[11px] font-normal drop-shadow-md">{reel.viewsCount || 0}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
  );
});

const RightPanel = React.memo(() => {
  const { currentUser } = useAppStore();
  const [contacts, setContacts] = useState<any[]>([]);
  const [presences, setPresences] = useState<{[uid: string]: boolean}>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const fetchContacts = async () => {
      const { getFollowing } = await import('../services/followService');
      const following = await getFollowing(currentUser.uid);
      setContacts(following);
      setLoading(false);

      const { subscribePresence } = await import('../services/presenceService');
      following.forEach((contact: any) => {
        subscribePresence(contact.uid, (data) => {
           setPresences(prev => ({ ...prev, [contact.uid]: data.isOnline }));
        });
      });
    };
    fetchContacts();
  }, [currentUser]);

  return (
    <div className="hidden lg:flex flex-col w-[280px] space-y-6 pt-4 sticky top-0 h-screen overflow-y-auto no-scrollbar pb-20">
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-gray-400 font-normal text-[13px] tracking-[0.1em]">Contacts</h3>
          <div className="flex space-x-3">
            <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><Search className="w-4 h-4 text-gray-500" /></button>
            <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><MoreHorizontal className="w-4 h-4 text-gray-500" /></button>
          </div>
        </div>
        <div className="space-y-1.5 truncate">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center space-x-3 p-2 animate-pulse">
                  <div className="w-9 h-9 bg-gray-100 rounded-full"></div>
                  <div className="h-3 w-24 bg-gray-50 rounded"></div>
                </div>
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-400 text-xs font-normal">No contacts yet</p>
              <button onClick={() => useAppStore.getState().pushPage('search')} className="text-blue-600 text-[11px] font-normal mt-2">Find friends</button>
            </div>
          ) : (
            contacts.map(contact => (
              <div key={contact.uid} className="group flex items-center justify-between p-2 hover:bg-blue-50/50 rounded-2xl cursor-pointer transition-all active:scale-[0.98]" onClick={() => {
                const { setMiniChatUser } = useAppStore.getState();
                setMiniChatUser(contact);
              }}>
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="relative flex-shrink-0">
                    <img 
                      src={contact.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=random`} 
                      alt={contact.name} 
                      loading="lazy" 
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 rounded-full object-cover shadow-sm ring-2 ring-transparent group-hover:ring-blue-100 transition-all" 
                    />
                    <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${presences[contact.uid] ? 'bg-green-500' : 'bg-gray-400'} border-2 border-white rounded-full transition-colors`}></div>
                  </div>
                  <span className="text-[14px] font-normal text-gray-700 group-hover:text-blue-600 transition-colors truncate">{contact.name}</span>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                   <MessageCircle className="w-4 h-4 text-blue-500" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
});



export default function Home() {
  const initialCached = (() => {
    try {
      const storeCache = useAppStore.getState().cachedFeed;
      if (storeCache && storeCache.length > 0) return storeCache;
      const local = localStorage.getItem('cached_posts');
      if (local) return JSON.parse(local);
    } catch (e) {}
    return [];
  })();

  const [posts, setPosts] = useState<Post[]>(initialCached);
  const [stories, setStories] = useState<any[]>([]);
  const [fallbackReels, setFallbackReels] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFeedLoading, setIsFeedLoading] = useState(initialCached.length === 0);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  const { viewingStory, setViewingStory, setViewingReel, showCreatePost, setShowCreatePost, pushPage, currentUser, notificationCount, cachedFeed, setCachedFeed, setViewingUser, setIsBottomNavHidden } = useAppStore();
  const feedScrollY = useAppStore(state => state.feedScrollY);
  const setFeedScrollY = useAppStore(state => state.setFeedScrollY);
  const [showCreateStory, setShowCreateStory] = useState(false);

  useEffect(() => {
    if (showCreateStory) {
      setIsBottomNavHidden(true);
      return () => setIsBottomNavHidden(false);
    } else {
      setIsBottomNavHidden(false);
    }
  }, [showCreateStory, setIsBottomNavHidden]);
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [storyPreview, setStoryPreview] = useState<string | null>(null);
  const [showHeader, setShowHeader] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(feedScrollY);
  const scrollTimeoutRef = useRef<any>(null);

  useEffect(() => {
    // Only attempt scroll restore on initial mount when feed is done
    if (scrollContainerRef.current && feedScrollY > 0 && !isFeedLoading) {
      setTimeout(() => {
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTo(0, feedScrollY);
      }, 50);
    }
  }, [isFeedLoading]); // Scroll after loading is done, omit feedScrollY from deps to avoid jumping

  // --- Local Caching ---
  useEffect(() => {
    if (cachedFeed.length > 0) {
        setPosts(cachedFeed);
        setIsFeedLoading(false);
    } else {
        const local = localStorage.getItem('cached_posts');
        if (local) {
            const parsed = JSON.parse(local);
            setPosts(parsed);
            setCachedFeed(parsed);
            setIsFeedLoading(false);
        }
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const unsubscribeFeed = subscribeFeed((newPosts) => {
      const filtered = newPosts.filter(p => p.type !== 'reel');
      setPosts(filtered);
      setCachedFeed(filtered);
      setIsFeedLoading(false);
      localStorage.setItem('cached_posts', JSON.stringify(filtered.slice(0, 20)));
    });
    const unsubscribeStories = subscribeStories((newStories) => {
      setStories(newStories);
    });
    const unsubscribeReels = subscribeReels((allReels) => {
      setFallbackReels(allReels.slice(0, 4));
    });
    return () => {
      unsubscribeFeed();
      unsubscribeStories();
      unsubscribeReels();
    };
  }, [currentUser, setCachedFeed]);

  const handleRefreshFeed = async () => {
    if (!currentUser) return;
    try {
      const { getFeed } = await import('../services/postService');
      const feedData = await getFeed();
      const freshPosts = feedData.posts || [];
      const filtered = freshPosts.filter((p) => p.type !== 'reel');
      setPosts(filtered);
      setCachedFeed(filtered);
    } catch (e) {
      console.error(e);
    }
  };

  const [visiblePostsCount, setVisiblePostsCount] = useState(5);
  const isHeaderVisibleRef = useRef(true);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const currentScrollY = target.scrollTop;
    const delta = currentScrollY - lastScrollY.current;
    
    if (currentScrollY <= 10) {
      isHeaderVisibleRef.current = true;
      setShowHeader(true);
    } else if (delta > 8 && currentScrollY > 40 && isHeaderVisibleRef.current) {
      isHeaderVisibleRef.current = false;
      setShowHeader(false);
    } else if (delta < -8 && !isHeaderVisibleRef.current) {
      isHeaderVisibleRef.current = true;
      setShowHeader(true);
    }

    if (target.scrollHeight - currentScrollY <= target.clientHeight * 1.5) {
      setVisiblePostsCount((prev) => (prev < posts.length ? Math.min(prev + 5, posts.length) : prev));
    }

    lastScrollY.current = currentScrollY;
  }, [posts.length]);

  const [postText, setPostText] = useState('');
  const [postBg, setPostBg] = useState('bg-white');
  const [postFiles, setPostFiles] = useState<File[]>([]);
  const [postPreviews, setPostPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPostFiles(prev => [...prev, ...files]);
    const urls = files.map((file: File) => URL.createObjectURL(file));
    setPostPreviews(prev => [...prev, ...urls]);
  };

  const handleCreatePost = async () => {
    if (!currentUser || (!postText.trim() && postFiles.length === 0)) return;
    setLoading(true);
    try {
      // Posts created from Home page are always 'post' type, even if they contain video
      const type = 'post';
      
      console.log(`Creating ${type} with files:`, postFiles);
      const post = await createPost(currentUser.uid, currentUser, postText, postFiles, type) as any;
      
      // Mentions Notification
      const mentionMatches = postText.match(/@(\w+)/g);
      if (mentionMatches && post) {
        const { findUserByUsername } = await import('../services/userService');
        const { sendNotification } = await import('../services/notificationService');
        const uniqueMentions = Array.from(new Set(mentionMatches.map(m => m.substring(1)))) as string[];
        uniqueMentions.forEach(async (username) => {
          const mentionedUser = await findUserByUsername(username);
          if (mentionedUser && mentionedUser.uid !== currentUser.uid) {
            await sendNotification(mentionedUser.uid, 'mention', currentUser, post.id, post.id, post.media?.[0], postText, currentUser.name, currentUser.avatar);
          }
        });
      }
      setPostText('');
      setPostFiles([]);
      setPostPreviews([]);
      setShowCreatePost(false);
    } catch (error: any) {
      console.error('Post creation error:', error);
      alert(`Failed to create post: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const bgColors = [
    'bg-white', 
    'bg-gradient-to-tr from-blue-400 to-purple-500', 
    'bg-gradient-to-r from-pink-500 to-orange-400', 
    'bg-gradient-to-br from-gray-900 to-black',
    'bg-gradient-to-r from-green-400 to-blue-500'
  ];

  const handleCreateStory = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    
    setStoryFile(file);
    setStoryPreview(URL.createObjectURL(file));
  };

  const confirmCreateStory = async () => {
    if (!storyFile || !currentUser) return;
    setLoading(true);
    try {
      await uploadStory(currentUser.uid, currentUser.name, currentUser.avatar, storyFile);
      setStoryFile(null);
      setStoryPreview(null);
      setShowCreateStory(false);
    } catch (error: any) {
      console.error('Story upload error:', error);
      alert(`Failed to upload story: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PullToRefresh onRefresh={handleRefreshFeed} className="h-full w-full">
      {/* Offline Banner */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white text-xs font-semibold py-1.5 px-4 text-center z-[70] shadow-sm flex items-center justify-center space-x-1.5">
          <span>📡 No Internet Connection — Showing loaded posts & reels</span>
        </div>
      )}
      <div ref={scrollContainerRef} id="home-scroll-container" className="h-full w-full overflow-y-auto bg-white flex flex-col items-center px-0 md:px-4 md:pl-24" onScroll={handleScroll}>
      {/* Mobile Top Header - Smooth Slide Hide on Scroll */}
      <div 
        className={`sm:hidden fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-md border-b border-gray-100 z-[60] px-5 pt-8 pb-3 flex items-center justify-between transition-transform duration-300 ease-in-out ${
          showHeader && !showCreatePost ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-[10px] overflow-hidden shadow-sm border border-gray-100 flex-shrink-0">
            <img src="/Ennvo.png" alt="Ennvo Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-[24px] font-bold tracking-tight text-gray-900 drop-shadow-sm font-sans">Ennvo</h1>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={() => pushPage('search')} className="p-2 transition-transform active:scale-95">
            <Search className="w-5.5 h-5.5 text-gray-800" strokeWidth={2.5} />
          </button>
          <button onClick={() => pushPage('notifications')} className="p-2 hover:bg-gray-100 rounded-full transition-transform active:scale-95 relative">
            <Bell className="w-5.5 h-5.5 text-gray-800" strokeWidth={2.5} />
            {notificationCount > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-white"></span>}
          </button>
          <button onClick={() => setShowCreatePost(true)} className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-full transition-colors active:scale-95 border border-gray-200/50 flex items-center justify-center"><Plus className="w-5 h-5" strokeWidth={2.5} /></button>
        </div>
      </div>

      <div className="w-full max-w-[1020px] flex justify-between space-x-0 md:space-x-8 pt-[76px] sm:pt-6 pb-24 px-0 sm:px-3">
        <div className="flex-1 w-full max-w-[620px] mx-auto lg:mx-0 flex flex-col space-y-3 sm:space-y-4">
          {/* Create Post Box */}
          <div className="bg-white border-b border-gray-100 md:border md:border-gray-200/80 rounded-none sm:rounded-3xl px-4 py-3.5 shadow-xs transition-all">
            <div className="flex items-center space-x-3">
              <div className="relative group/avatar cursor-pointer shrink-0" onClick={() => { setViewingUser({ uid: currentUser?.uid, name: currentUser?.name, avatar: currentUser?.avatar }); pushPage('profile'); }}>
                <img 
                  src={currentUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || 'User')}&background=random`} 
                  alt="Profile" 
                  loading="lazy" 
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full object-cover shadow-xs border border-gray-200/60 ring-2 ring-transparent group-hover/avatar:ring-blue-100 transition-all" 
                />
              </div>
              <div 
                className="flex-1 bg-gray-50 hover:bg-gray-100/80 transition-all rounded-full px-5 py-2.5 text-[14.5px] font-normal text-gray-500 cursor-pointer border border-gray-200/50 shadow-2xs" 
                onClick={() => setShowCreatePost(true)}
              >
                What's on your mind, {currentUser?.name?.split(' ')[0] || 'User'}?
              </div>
            </div>

            {/* Quick Action Badges Bar */}
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100 text-xs font-semibold text-gray-600">
              <button 
                onClick={() => setShowCreatePost(true)}
                className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-2 hover:bg-gray-50 rounded-xl transition-colors text-emerald-600"
              >
                <ImageIcon className="w-4 h-4 text-emerald-500" />
                <span>Photo/Video</span>
              </button>

              <button 
                onClick={() => setShowCreatePost(true)}
                className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-2 hover:bg-gray-50 rounded-xl transition-colors text-blue-600"
              >
                <UserPlus className="w-4 h-4 text-blue-500" />
                <span>Tag Friends</span>
              </button>

              <button 
                onClick={() => setShowCreatePost(true)}
                className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-2 hover:bg-gray-50 rounded-xl transition-colors text-amber-600"
              >
                <Smile className="w-4 h-4 text-amber-500" />
                <span>Feeling</span>
              </button>
            </div>
          </div>

          {/* Stories List */}
          <div className="bg-white border-b border-gray-100 md:border md:border-gray-200/80 rounded-none sm:rounded-3xl p-3 sm:p-4 shadow-xs overflow-hidden">
            <div className="flex space-x-3 overflow-x-auto no-scrollbar py-0.5 px-1">
              <StoryItem 
                story={{ isUser: true, bg: currentUser?.avatar || 'https://picsum.photos/seed/myprofile/200/300', name: 'Create Story' }} 
                onClick={() => {
                  const { setSelectedCreateMode } = useAppStore.getState();
                  setSelectedCreateMode('story');
                  pushPage('create');
                }} 
              />
              {stories.map(story => (
                <StoryItem key={story.id} story={story} onClick={() => setViewingStory(story)} />
              ))}

              {/* Fallback stories from reels ONLY if there are no active stories */}
              {stories.length < 1 && fallbackReels.map((reel) => {
                const storyObj = {
                  id: reel.id,
                  authorId: reel.authorId,
                  authorName: reel.authorName,
                  authorAvatar: reel.authorAvatar,
                  mediaUrl: reel.media?.[0],
                  thumbnailUrl: reel.thumbnailUrl || reel.thumbnail,
                  type: 'video' as const,
                  text: reel.text,
                  songTitle: reel.songTitle,
                  songArtist: reel.songArtist,
                  songUrl: reel.songUrl
                };
                return (
                  <StoryItem 
                    key={`fallback-story-${reel.id}`} 
                    story={storyObj}
                    onClick={() => setViewingStory(storyObj)} 
                  />
                );
              })}
            </div>
          </div>

          {/* Feed Posts */}
          <div className="flex flex-col pb-20 space-y-3 sm:space-y-4">
            {isFeedLoading ? (
              <>
                {[1, 2, 3].map((key) => (
                  <div key={key} className="bg-white rounded-none sm:rounded-3xl border border-gray-100 md:border-gray-200/80 p-5 shadow-xs animate-pulse">
                    <div className="flex items-center space-x-2 mb-4">
                      <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                      <div className="flex-1 space-y-2">
                        <div className="w-1/3 h-3 bg-gray-200 rounded"></div>
                        <div className="w-1/4 h-2 bg-gray-100 rounded"></div>
                      </div>
                    </div>
                    <div className="w-full h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="w-5/6 h-4 bg-gray-200 rounded mb-4"></div>
                    <div className="w-full h-64 bg-gray-100 rounded-2xl mb-3"></div>
                  </div>
                ))}
              </>
            ) : (
              <>
                {posts.slice(0, visiblePostsCount).map((post, index) => (
                  <React.Fragment key={post.id}>
                    <div className="overflow-hidden bg-white border-b border-gray-100 sm:border md:border-gray-200/80 rounded-none sm:rounded-3xl shadow-xs transition-all duration-200">
                      <PostItem post={post} />
                    </div>
                    {index === 0 && <SuggestedAccounts />}
                  </React.Fragment>
                ))}
                {posts.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                    <Globe className="w-12 h-12 mb-4 opacity-20" />
                    <p className="font-normal">No posts yet. Be the first to post!</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <RightPanel />
      </div>

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={showCreatePost}
        onClose={() => setShowCreatePost(false)}
      />

      {/* Story Camera Overlay */}
      {showCreateStory && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center animate-in fade-in duration-200 p-4">
          {storyPreview ? (
            <div className="relative w-full max-w-sm max-h-[85vh] h-full overflow-hidden flex flex-col bg-black rounded-3xl shadow-2xl">
              <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 bg-gradient-to-b from-black/50 to-transparent">
                <button onClick={() => { setStoryPreview(null); setStoryFile(null); }} className="p-2 text-white bg-black/40 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              <div className="flex-1 flex items-center justify-center min-h-0 bg-black">
                {storyFile?.type.startsWith('video') ? (
                  <video src={storyPreview} poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E" className="max-w-full max-h-full" autoPlay loop muted playsInline />
                ) : (
                  <img src={storyPreview} className="max-w-full max-h-full object-contain" alt="Story preview" />
                )}
              </div>
              <div className="p-4 bg-black flex justify-between items-center shrink-0 z-10 border-t border-white/10">
                <button onClick={() => { setStoryPreview(null); setStoryFile(null); }} className="px-6 py-2.5 bg-gray-800 text-white rounded-full font-normal">Discard</button>
                <button onClick={confirmCreateStory} disabled={loading} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-normal flex items-center space-x-2 transition-colors">
                  {loading ? (
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
              <video autoPlay playsInline muted poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E" className="absolute inset-0 w-full h-full object-cover" ref={(ref) => { if (ref && !ref.srcObject) { navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true }).then(stream => { ref.srcObject = stream; }).catch(err => console.error("Camera access denied:", err)); } }} />
              <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 bg-gradient-to-b from-black/50 to-transparent pt-safe">
                <button onClick={() => setShowCreateStory(false)} className="p-2 text-white"><X className="w-7 h-7" /></button>
                <button className="flex items-center space-x-2 bg-black/60 px-4 py-1.5 rounded-full text-white font-normal text-sm"><Music className="w-4 h-4" /><span>Add Sound</span></button>
                <div className="flex flex-col space-y-4 items-center">
                  <button className="flex flex-col items-center text-white"><Type className="w-6 h-6 mb-1" /><span className="text-[10px] font-normal">Text</span></button>
                  <button className="flex flex-col items-center text-white"><Smile className="w-6 h-6 mb-1" /><span className="text-[10px] font-normal">Stickers</span></button>
                  <button className="flex flex-col items-center text-white"><Settings2 className="w-6 h-6 mb-1" /><span className="text-[10px] font-normal">Filters</span></button>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col items-center z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent pb-safe">
                <div className="flex space-x-8 mb-6 text-white/80 font-normal text-sm">
                  <button className="text-white border-b-2 border-white pb-1">Story</button>
                  <button className="hover:text-white">Photo</button>
                  <button className="hover:text-white">Video</button>
                </div>
                <div className="flex items-center justify-between w-full px-4">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-600 overflow-hidden relative">
                      <input type="file" accept="image/*,video/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleCreateStory} />
                      <img src="https://picsum.photos/seed/gallery/100/100" className="w-full h-full object-cover" alt="Gallery" />
                    </div>
                    <span className="text-white text-[11px] font-normal mt-2">Upload</span>
                  </div>
                  <div className="relative">
                    <input type="file" accept="image/*,video/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleCreateStory} />
                    <button className="w-20 h-20 rounded-full border-4 border-white/50 flex items-center justify-center transition-transform active:scale-95 bg-white/20">
                      <div className="w-16 h-16 bg-white rounded-full transition-all"></div>
                    </button>
                  </div>
                  <div className="flex flex-col items-center opacity-0"><div className="w-10 h-10"></div><span className="text-white text-[11px] font-normal mt-2">Effects</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}
