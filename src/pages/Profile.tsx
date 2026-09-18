import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, onSnapshot, query, collection, where, orderBy, getDocs, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { Settings, Grid, Bookmark, UserSquare, Link as LinkIcon, Heart, MessageCircle, PlaySquare, Play, ArrowLeft, Globe, MoreHorizontal, Send, CheckCircle2, UserPlus, X, Lock, Eye, Loader2, Music, Image as ImageIcon, Sparkles } from 'lucide-react';
import { useAppStore } from '../store';
import { PostItem } from '../components/PostItem';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { ReelCoverThumbnail } from '../components/ReelCoverThumbnail';
import { PullToRefresh } from '../components/PullToRefresh';
import { followUser, unfollowUser, checkFriendship } from '../services/followService';
import { getFeed, subscribeUserPosts, getUserTotalLikes, getSavedPosts, getRepostedPosts, subscribeFavoriteSongsList, toggleSongFavorite } from '../services/postService';
import { createConversation, sendMessage } from '../services/chatService';
import { uploadMedia } from '../services/githubStorage';
import { Post, User } from '../types';
import { formatTime, formatCount } from '../utils';

const UserRowWithFollow = React.memo(({ user, currentUser, onSelectUser }: { user: any, currentUser: any, onSelectUser: (user: any) => void }) => {
  const [friendship, setFriendship] = useState({ following: false, followedBy: false, isFriend: false });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser?.uid || !user?.uid) return;
    checkFriendship(currentUser.uid, user.uid).then(setFriendship).catch(() => {});
  }, [currentUser?.uid, user?.uid]);

  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || !user.uid || loading) return;
    setLoading(true);
    try {
      if (friendship.following) {
        await unfollowUser(currentUser.uid, user.uid);
      } else {
        await followUser(currentUser, { uid: user.uid, name: user.name || 'User', avatar: user.avatar || '', username: user.username || '' });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const username = user.username || (user.name || 'user').toLowerCase().replace(/\s+/g, '_');

  return (
    <div 
      className="flex items-center justify-between p-2.5 hover:bg-white/40 rounded-2xl cursor-pointer transition-colors border border-transparent hover:border-purple-200/40 my-1"
      onClick={() => onSelectUser(user)}
    >
      <div className="flex items-center space-x-3 min-w-0">
        <img 
          src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random`} 
          className="w-12 h-12 rounded-full object-cover border border-purple-200/50 shadow-sm shrink-0" 
          referrerPolicy="no-referrer" 
        />
        <div className="truncate">
          <p className="font-normal text-[14px] text-gray-900 leading-tight truncate">{user.name || 'User'}</p>
          <p className="text-gray-500 text-[11px] font-normal leading-tight mt-1 truncate">@{username}</p>
        </div>
      </div>
      {currentUser?.uid !== user.uid && (
        <button 
          onClick={handleFollowToggle}
          className={`px-4 py-1.5 rounded-full text-xs font-normal transition-all active:scale-95 shadow-sm min-w-[95px] ${
            friendship.isFriend 
              ? 'bg-purple-200/60 text-purple-800 border border-purple-300/40 hover:bg-purple-200' 
              : friendship.following 
              ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' 
              : friendship.followedBy 
              ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-sm' 
              : 'bg-purple-600 text-white hover:bg-purple-700'
          }`}
        >
          {friendship.isFriend ? 'Friends' : friendship.following ? 'Following' : friendship.followedBy ? 'Follow Back' : 'Follow'}
        </button>
      )}
    </div>
  );
});

export default function Profile() {
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'saved' | 'reposts' | 'private'>('reels');
  const { viewingUser, setViewingUser, setViewingMedia, setViewingPost, setViewingReel, setViewingReelContext, currentUser, pushPage, popPage, setActiveChat, cachedProfilePosts, setCachedProfilePosts, cachedSavedPosts, setCachedSavedPosts, setIsBottomNavHidden, setSelectedCreateSong } = useAppStore();
  const isCurrentUser = !viewingUser || viewingUser.uid === currentUser?.uid;
  const targetUserId = isCurrentUser ? currentUser?.uid : viewingUser.uid;
  const [profilePosts, setProfilePosts] = useState<Post[]>(cachedProfilePosts[targetUserId || ''] || []);
  const [savedPosts, setSavedPosts] = useState<Post[]>(cachedSavedPosts[targetUserId || ''] || []);
  const [favoriteSongsList, setFavoriteSongsList] = useState<any[]>([]);
  const [totalLikes, setTotalLikes] = useState(0);
  const followingIds = useAppStore(state => state.followingIds);
  const [showFollowersList, setShowFollowersList] = useState<'followers' | 'following' | null>(null);
  const [peopleList, setPeopleList] = useState<any[]>([]);
  const [friendship, setFriendship] = useState(() => {
    if (!isCurrentUser && targetUserId) {
      const isFollowing = followingIds?.includes(targetUserId) || false;
      return { following: isFollowing, followedBy: false, isFriend: false };
    }
    return { following: false, followedBy: false, isFriend: false };
  });
  const [isFriendshipLoading, setIsFriendshipLoading] = useState(!isCurrentUser);
  const [isPostsLoading, setIsPostsLoading] = useState(() => !cachedProfilePosts[targetUserId || user?.uid || '']);

  useEffect(() => {
    if (!isCurrentUser && targetUserId) {
      const isFollowing = followingIds?.includes(targetUserId) || false;
      setFriendship({ following: isFollowing, followedBy: false, isFriend: false });
    }
  }, [targetUserId, isCurrentUser, followingIds]);
  const [loading, setLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(24);
  const [savedSubTab, setSavedSubTab] = useState<'all' | 'reels' | 'posts' | 'songs' | 'stickers'>('all');
  const [playingSongUrl, setPlayingSongUrl] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
    };
  }, []);

  const handleTogglePlaySong = (url: string) => {
    if (!url) return;
    if (playingSongUrl === url) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setPlayingSongUrl(null);
    } else {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.play().catch(console.error);
      setPlayingSongUrl(url);
      audio.onended = () => setPlayingSongUrl(null);
    }
  };

  const filteredSavedPosts = React.useMemo(() => {
    if (savedSubTab === 'reels') {
      return savedPosts.filter(p => p.type === 'reel' || p.media?.[0]?.includes('.mp4') || p.media?.[0]?.includes('video'));
    }
    if (savedSubTab === 'posts') {
      return savedPosts.filter(p => p.type !== 'reel' && !p.media?.[0]?.includes('.mp4') && !p.media?.[0]?.includes('video'));
    }
    if (savedSubTab === 'songs') {
      return savedPosts.filter(p => !!((p as any).songTitle || (p as any).songUrl || (p as any).songInfo || (p as any).bgMusic));
    }
    if (savedSubTab === 'stickers') {
      return savedPosts.filter(p => !!((p as any).isSticker || (p as any).stickerUrl || p.text?.toLowerCase().includes('sticker') || p.media?.[0]?.toLowerCase().includes('sticker')));
    }
    return savedPosts;
  }, [savedPosts, savedSubTab]);

  const allSavedSongs = React.useMemo(() => {
    const list: any[] = [];
    const seenUrls = new Set<string>();

    favoriteSongsList.forEach(s => {
      const songUrl = s.url || '';
      if (songUrl && !seenUrls.has(songUrl)) {
        seenUrls.add(songUrl);
        list.push({
          id: s.id,
          title: s.title || 'Original Audio',
          artist: s.artist || 'Audio',
          url: songUrl,
          cover: s.cover || '',
          isFavoriteSong: true,
          createdAt: s.createdAt
        });
      }
    });

    savedPosts.forEach(p => {
      const songUrl = (p as any).songUrl || (p as any).audioUrl || ((p as any).bgMusic?.url);
      const songTitle = (p as any).songTitle || (p as any).songInfo?.title || ((p as any).bgMusic?.title);
      if (songUrl && !seenUrls.has(songUrl)) {
        seenUrls.add(songUrl);
        list.push({
          id: p.id,
          title: songTitle || 'Audio from Post',
          artist: (p as any).songArtist || p.authorName || 'Audio',
          url: songUrl,
          cover: (p as any).songCover || p.thumbnailUrl || p.media?.[0] || '',
          isFavoriteSong: false,
          postId: p.id
        });
      }
    });

    return list;
  }, [favoriteSongsList, savedPosts]);

  const highlightInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingHighlight, setIsUploadingHighlight] = useState(false);
  const pressTimer = useRef<any>(null);

  const handleUploadHighlight = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;
    setIsUploadingHighlight(true);
    try {
      const url = await uploadMedia(file, 'highlights');
      await updateDoc(doc(db, 'users', user.uid), {
        highlights: arrayUnion(url)
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploadingHighlight(false);
    }
  };

  const handleHighlightPressStart = (url: string) => {
    if (!isCurrentUser) return;
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      setDeleteHighlightUrl(url);
    }, 600);
  };

  const handleHighlightPressEnd = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 300) {
      setVisibleCount(prev => prev + 15);
    }
  };

  // Profile views states
  const [profileViewsCount, setProfileViewsCount] = useState(0);
  const [showProfileViews, setShowProfileViews] = useState(false);
  const [profileViewers, setProfileViewers] = useState<any[]>([]);
  const [unreadViewsCount, setUnreadViewsCount] = useState(0);

  const [userData, setUserData] = useState<User | null>(null);
  const [repostedPosts, setRepostedPosts] = useState<Post[]>([]);
  const [deleteHighlightUrl, setDeleteHighlightUrl] = useState<string | null>(null);
  const [viewingHighlightUrl, setViewingHighlightUrl] = useState<string | null>(null);
  const [highlightReplyText, setHighlightReplyText] = useState('');
  const [sendingHighlightReply, setSendingHighlightReply] = useState(false);

  useEffect(() => {
    if (viewingHighlightUrl) {
      setIsBottomNavHidden(true);
      return () => setIsBottomNavHidden(false);
    } else {
      setIsBottomNavHidden(false);
    }
  }, [viewingHighlightUrl, setIsBottomNavHidden]);

  const handleSendHighlightReply = async () => {
    if (!currentUser || !viewingHighlightUrl || !user?.uid || sendingHighlightReply || !highlightReplyText.trim()) return;
    setSendingHighlightReply(true);
    try {
      const convId = await createConversation(
        [currentUser.uid, user.uid],
        {
          [currentUser.uid]: { name: currentUser.name || 'User', avatar: currentUser.avatar || '' },
          [user.uid]: { name: user.name || 'User', avatar: user.avatar || '' }
        }
      );
      await sendMessage(convId, currentUser.uid, 'image', highlightReplyText.trim(), viewingHighlightUrl);
      setActiveChat(convId);
      setViewingHighlightUrl(null);
      setHighlightReplyText('');
      pushPage('messages');
    } catch (e) {
      console.error("Failed to send highlight reply:", e);
    } finally {
      setSendingHighlightReply(false);
    }
  };

  useEffect(() => {
    if (targetUserId) {
      const unsubscribe = onSnapshot(doc(db, 'users', targetUserId), (doc) => {
        if (doc.exists()) {
          setUserData({ uid: doc.id, ...doc.data() } as User);
        }
      }, () => {});
      return () => unsubscribe();
    }
  }, [targetUserId]);

  const user = isCurrentUser ? (userData || currentUser) : (userData || viewingUser);

  useEffect(() => {
    if (user?.uid) {
      const unsub = onSnapshot(collection(db, 'users', user.uid, 'reposts'), () => {
        getRepostedPosts(user.uid).then(posts => {
          setRepostedPosts(posts);
        });
      }, () => {});
      return () => unsub();
    }
  }, [activeTab, user?.uid]);

  // Track and fetch profile views
  useEffect(() => {
    if (user?.uid) {
      if (!isCurrentUser && currentUser) {
        import('firebase/firestore').then(({ setDoc, doc }) => {
          setDoc(doc(db, 'users', user.uid, 'profileViews', currentUser.uid), {
            uid: currentUser.uid,
            name: currentUser.name,
            avatar: currentUser.avatar,
            timestamp: Date.now()
          }, { merge: true }).catch(console.error);
        });
      }

      if (isCurrentUser) {
        let unsubscribeViews = () => {};
        import('firebase/firestore').then(({ collection, onSnapshot }) => {
          const viewsRef = collection(db, 'users', user.uid, 'profileViews');
          unsubscribeViews = onSnapshot(viewsRef, (snapshot) => {
            const count = snapshot.docs.length;
            setProfileViewsCount(count);
            
            const list = snapshot.docs.map(d => d.data());
            list.sort((a: any, b: any) => b.timestamp - a.timestamp);
            setProfileViewers(list);

            const lastChecked = parseInt(localStorage.getItem('lastCheckedProfileViewsCount') || '0', 10);
            if (count > lastChecked) {
              setUnreadViewsCount(count - lastChecked);
            } else if (count < lastChecked) {
               // In case users delete their accounts or views reset
               localStorage.setItem('lastCheckedProfileViewsCount', count.toString());
               setUnreadViewsCount(0);
            } else {
              setUnreadViewsCount(0);
            }
          }, () => {});
        });
        return () => unsubscribeViews();
      }
    }
  }, [user?.uid, isCurrentUser, currentUser]);
  
  const profileName = user?.name || 'User';
  const profileAvatar = user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileName)}&background=random`;
  const profileHandle = user?.username ? `@${user.username}` : (user?.name ? `@${user.name.toLowerCase().replace(/\s+/g, '_')}` : '@user');

  const privatePosts = React.useMemo(() => {
    if (!isCurrentUser) return [];
    return profilePosts.filter(p => p.privacy === 'private' || (p as any).isPrivate === true);
  }, [isCurrentUser, profilePosts]);

  const publicProfilePosts = React.useMemo(() => {
    return profilePosts.filter(p => p.privacy !== 'private' && !(p as any).isPrivate);
  }, [profilePosts]);

  const reels = React.useMemo(() => {
    return publicProfilePosts.filter(p => p.type === 'reel');
  }, [publicProfilePosts]);

  const regularPosts = React.useMemo(() => {
    return publicProfilePosts.filter(p => p.type !== 'reel');
  }, [publicProfilePosts]);

  useEffect(() => {
    if (activeTab === 'private' && privatePosts.length === 0) {
      setActiveTab('reels');
    }
  }, [privatePosts.length, activeTab]);

  useEffect(() => {
    if (isCurrentUser && user?.uid) {
      const unsubFav = subscribeFavoriteSongsList(user.uid, (songs) => {
        setFavoriteSongsList(songs || []);
      });
      return () => unsubFav();
    }
  }, [isCurrentUser, user?.uid]);

  useEffect(() => {
    if (user?.uid) {
      if (!cachedProfilePosts[user.uid]) {
        setIsPostsLoading(true);
      }
      // Subscribe to user posts
      const unsubscribePosts = subscribeUserPosts(user.uid, (posts) => {
        setProfilePosts(posts);
        setCachedProfilePosts(user.uid, posts);
        setIsPostsLoading(false);
      });

      // Real-time total likes
      const qLikes = query(collection(db, 'posts'), where('authorId', '==', user.uid));
      const unsubscribeLikes = onSnapshot(qLikes, (snapshot) => {
        let total = 0;
        snapshot.docs.forEach((doc) => {
          total += doc.data().likesCount || 0;
        });
        setTotalLikes(total);
      }, () => {});

      // Fetch followers/following list if open
      let unsubscribePeople: () => void = () => {};
      if (showFollowersList) {
        const qPeople = query(collection(db, 'users', user.uid, showFollowersList), orderBy('createdAt', 'desc'));
        unsubscribePeople = onSnapshot(qPeople, (snapshot) => {
          const list = snapshot.docs.map(d => ({ uid: d.id, ...d.data() }));
          setPeopleList(list);
        }, () => {});
      }
      
      // Check friendship with real-time subscription for ultra speed
      let unsubscribeFriendship: () => void = () => {};
      if (!isCurrentUser && currentUser) {
        const followingRef = doc(db, 'users', currentUser.uid, 'following', user.uid);
        const followerRef = doc(db, 'users', user.uid, 'following', currentUser.uid);

        const unsubFollowing = onSnapshot(followingRef, (doc1) => {
          const following = doc1.exists();
          const unsubFollowed = onSnapshot(followerRef, (doc2) => {
            const followedBy = doc2.exists();
            setFriendship({ following, followedBy, isFriend: following && followedBy });
            setIsFriendshipLoading(false);
          }, () => { setIsFriendshipLoading(false); });
          unsubscribeFriendship = () => { unsubFollowing(); unsubFollowed(); };
        }, () => { setIsFriendshipLoading(false); });
      }

      return () => {
        unsubscribePosts();
        unsubscribeFriendship();
        unsubscribeLikes();
        unsubscribePeople();
      };
    }
  }, [user?.uid, currentUser?.uid, isCurrentUser, showFollowersList]);

  useEffect(() => {
    if (isCurrentUser && activeTab === 'saved' && user?.uid) {
      // Real-time snapshot to ensure favorites are always up-to-date across navigation
      const unsub = onSnapshot(collection(db, 'users', user.uid, 'favorites'), () => {
        getSavedPosts(user.uid).then(posts => {
           setSavedPosts(posts);
           setCachedSavedPosts(user.uid, posts);
        });
      }, () => {});
      return () => unsub();
    }
  }, [activeTab, isCurrentUser, user?.uid, setCachedSavedPosts]);

  const handleFollow = async () => {
    if (!currentUser || !user || isCurrentUser) return;
    
    // Optimistic update
    const wasFollowing = friendship.following;
    setFriendship(prev => ({ 
      ...prev, 
      following: !wasFollowing, 
      isFriend: !wasFollowing ? prev.followedBy : false 
    }));

    try {
      if (wasFollowing) {
        await unfollowUser(currentUser.uid, user.uid);
      } else {
        await followUser(currentUser, user);
      }
    } catch (error) {
      // Revert on error
      setFriendship(prev => ({ 
        ...prev, 
        following: wasFollowing, 
        isFriend: wasFollowing ? prev.followedBy : false 
      }));
      console.error(error);
    }
  };

  const handleMessage = async () => {
    if (!currentUser || !user || isCurrentUser) return;
    try {
      const convId = await createConversation(
        [currentUser.uid, user.uid],
        {
          [currentUser.uid]: { name: currentUser.name, avatar: currentUser.avatar },
          [user.uid]: { name: user.name, avatar: user.avatar }
        }
      );
      setActiveChat(convId);
      pushPage('messages');
    } catch (error) {
      console.error(error);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profileName}'s Profile`,
          url: `${window.location.origin}/profile/${profileHandle.replace('@', '')}`
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleRefreshProfile = async () => {
    if (!user?.uid) return;
    try {
      const { getFeed } = await import('../services/postService');
      const feedData = await getFeed(100, null, user.uid);
      if (feedData?.posts) {
        setProfilePosts(feedData.posts);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <PullToRefresh onRefresh={handleRefreshProfile} className="h-full w-full">
      <div className="h-full w-full overflow-y-auto bg-gradient-to-b from-[#e9d5ff] via-[#f3e8ff] to-[#faf5ff] flex flex-col items-center relative md:pl-24" onScroll={handleScroll}>
      <AnimatePresence>
        {/* Profile Views List */}
        {showProfileViews && (
          <div className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-b from-[#e9d5ff] via-[#f3e8ff] to-[#faf5ff] animate-in slide-in-from-bottom duration-300">
            <div className="min-h-[88px] md:min-h-[60px] pt-8 pb-3 md:pt-0 md:pb-0 bg-white/40 backdrop-blur-xl border-b border-white/60 flex items-center px-4 sticky top-0 z-10">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowProfileViews(false); }} 
                className="p-2 -ml-2 rounded-full hover:bg-white/50 text-gray-800 transition-colors"
              >
                <ArrowLeft className="w-6 h-6 text-gray-900" />
              </button>
              <h2 className="flex-1 text-center font-normal text-lg capitalize mr-10 text-gray-900">Profile Views</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
              {profileViewers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-purple-600/50">
                  <Globe className="w-16 h-16 mb-4 opacity-30" />
                  <p className="font-normal">No views yet</p>
                </div>
              ) : (
                profileViewers.map((viewer) => (
                  <UserRowWithFollow 
                    key={viewer.uid} 
                    user={viewer} 
                    currentUser={currentUser} 
                    onSelectUser={(u) => {
                      setViewingUser({ uid: u.uid, name: u.name, avatar: u.avatar });
                      setShowProfileViews(false);
                      pushPage('profile');
                    }} 
                  />
                ))
              )}
            </div>
          </div>
        )}
        {showFollowersList && (
          <div className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-b from-[#e9d5ff] via-[#f3e8ff] to-[#faf5ff] animate-in slide-in-from-bottom duration-300">
            <div className="min-h-[88px] md:min-h-[60px] pt-8 pb-3 md:pt-0 md:pb-0 bg-white/40 backdrop-blur-xl border-b border-white/60 flex items-center px-4 sticky top-0 z-10">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowFollowersList(null); }} 
                className="p-2 -ml-2 rounded-full hover:bg-white/50 text-gray-800 transition-colors"
              >
                <ArrowLeft className="w-6 h-6 text-gray-900" />
              </button>
              <h2 className="flex-1 text-center font-normal text-lg capitalize mr-10 text-gray-900">{showFollowersList}</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
              {peopleList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-purple-600/50">
                  <UserPlus className="w-16 h-16 mb-4 opacity-30" />
                  <p className="font-normal">No {showFollowersList} yet</p>
                </div>
              ) : (
                peopleList.map((person) => (
                  <UserRowWithFollow 
                    key={person.uid} 
                    user={person} 
                    currentUser={currentUser} 
                    onSelectUser={(u) => {
                      setViewingUser({ uid: u.uid, name: u.name, avatar: u.avatar });
                      setShowFollowersList(null);
                    }} 
                  />
                ))
              )}
            </div>
          </div>
        )}
      </AnimatePresence>
      
      <div className="w-full max-w-6xl mx-auto px-0 md:px-8 py-0 md:py-6">
          {/* NEW Profile Header exact match to image, liquid glass on PC */}
          <div className="relative overflow-hidden mb-0 md:mb-6 pb-2 pt-4 md:pt-8 md:pb-6 flex flex-col items-center w-full md:bg-white/40 md:backdrop-blur-2xl md:rounded-[32px] md:border md:border-white/80 md:shadow-[0_12px_36px_rgba(147,51,234,0.06)]">
            
            {/* Background decorations */}
            <div className="absolute top-[-50px] left-[-50px] w-64 h-64 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
            <div className="absolute top-[-20px] right-[-20px] w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" style={{animationDelay: '2s'}}></div>
            
            {/* Abstract curved lines (Top Left) */}
            <div className="absolute top-0 left-0 w-64 h-64 z-0 opacity-40 pointer-events-none">
              <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full fill-transparent stroke-white" strokeWidth="2">
                <path d="M-20 80 Q 40 120 100 40 T 220 20" />
                <path d="M-20 110 Q 50 150 120 70 T 220 50" strokeWidth="1" />
              </svg>
            </div>

            {/* Moon decoration */}
            <div className="absolute top-24 right-10 z-10 opacity-70 pointer-events-none">
               <svg width="40" height="40" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                 <path d="M21.2 15.5c-3.7 3.5-9.6 3.1-12.9-.1-3.3-3.3-3.7-9.2-.1-12.9C5.4 3.9 3 7.6 3 12c0 5 4 9 9 9 4.4 0 8.1-2.4 9.2-5.5z"/>
               </svg>
            </div>

            {!isCurrentUser && (
              <button 
                onClick={() => popPage()}
                className="absolute top-12 left-4 z-30 text-gray-800 p-1 hover:text-purple-600 transition-colors rounded-full active:scale-90"
              >
                <ArrowLeft className="w-6 h-6" strokeWidth={2.5} />
              </button>
            )}

            {/* Top Right Icons */}
            <div className="absolute top-12 right-4 z-30 flex items-center space-x-3">
              <button className="p-1.5 text-gray-800 hover:text-purple-600 transition-colors">
                <LinkIcon className="w-[22px] h-[22px]" strokeWidth={2.5} />
              </button>
              <button 
                className="p-1.5 text-gray-800 hover:text-purple-600 transition-colors relative flex items-center justify-center"
                onClick={() => {
                  if (isCurrentUser) {
                    localStorage.setItem('lastCheckedProfileViewsCount', profileViewsCount.toString());
                    setUnreadViewsCount(0);
                    setShowProfileViews(true);
                  }
                }}
              >
                {isCurrentUser && profileViewers.length > 0 ? (
                  <div className="w-[24px] h-[24px] rounded-full overflow-hidden border border-gray-300 bg-white">
                    <img src={profileViewers[0].avatar} alt="View" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                ) : (
                  <Eye className="w-[22px] h-[22px]" strokeWidth={2.5} />
                )}
                {(isCurrentUser && unreadViewsCount > 0) ? (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-normal px-1 rounded-full border-2 border-[#f3e8ff] min-w-[14px] h-[14px] flex items-center justify-center">
                    {unreadViewsCount > 99 ? '99+' : unreadViewsCount}
                  </span>
                ) : null}
              </button>
              {isCurrentUser && (
                <button 
                  onClick={() => pushPage('settings')}
                  className="p-1.5 text-gray-800 hover:text-purple-600 transition-colors"
                >
                  <Settings className="w-[22px] h-[22px]" strokeWidth={2.5} />
                </button>
              )}
            </div>

            {/* Profile Picture */}
            <div className="relative mt-14 mb-1 z-20">
              <div className="w-[115px] h-[115px] rounded-full p-1 bg-gradient-to-br from-purple-200 to-purple-400 ">
                <div className="w-full h-full rounded-full border-[3px] border-white overflow-hidden bg-white">
                  <img src={userData?.avatar || profileAvatar} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
              </div>
              {isCurrentUser && (
                <div 
                  className="absolute bottom-0 right-0 p-2 bg-white rounded-full  border border-gray-100 cursor-pointer text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
                  onClick={() => pushPage('edit-profile')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                </div>
              )}
            </div>

            {/* Name & Username */}
            <div className="text-center mb-1 z-20">
              <h1 className="text-[17px] font-normal text-gray-900 tracking-tight flex items-center justify-center">
                {userData?.name || profileName || 'User'}
                {user?.isVerified && (
                  <VerifiedBadge />
                )}
              </h1>
              <p className="text-purple-600 font-normal text-[13px] mt-0">@{userData?.username || profileHandle.replace('@', '')}</p>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-center space-x-5 md:space-x-8 mb-2 z-20 w-full px-6">
              <div 
                className="flex flex-col items-center cursor-pointer hover:opacity-70 transition-opacity"
                onClick={() => setShowFollowersList('following')}
              >
                {!userData && (user?.followingCount === undefined || user?.followingCount === null) ? (
                  <div className="w-10 h-4 bg-purple-200/60 rounded animate-pulse my-0.5" />
                ) : (
                  <span className="text-[14px] font-normal text-gray-900 leading-tight">
                    {formatCount(userData?.followingCount ?? user?.followingCount ?? 0)}
                  </span>
                )}
                <span className="text-gray-500 text-[11px] font-normal mt-0.5">Following</span>
              </div>
              <div 
                className="flex flex-col items-center cursor-pointer hover:opacity-70 transition-opacity"
                onClick={() => setShowFollowersList('followers')}
              >
                {!userData && (user?.followersCount === undefined || user?.followersCount === null) ? (
                  <div className="w-10 h-4 bg-purple-200/60 rounded animate-pulse my-0.5" />
                ) : (
                  <span className="text-[14px] font-normal text-gray-900 leading-tight">
                    {formatCount(userData?.followersCount ?? user?.followersCount ?? 0)}
                  </span>
                )}
                <span className="text-gray-500 text-[11px] font-normal mt-0.5">Followers</span>
              </div>
              <div className="flex flex-col items-center cursor-pointer">
                {!userData && totalLikes === 0 && profilePosts.length === 0 ? (
                  <div className="w-10 h-4 bg-purple-200/60 rounded animate-pulse my-0.5" />
                ) : (
                  <span className="text-[14px] font-normal text-gray-900 leading-tight">
                    {formatCount(userData?.totalLikes ?? (totalLikes || profilePosts.reduce((sum, p) => sum + (p.likesCount || 0), 0)))}
                  </span>
                )}
                <span className="text-gray-500 text-[11px] font-normal mt-0.5">Likes</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-center space-x-3 w-full px-6 mb-2 z-20 max-w-[320px]">
              {isCurrentUser ? (
                <>
                  <button 
                    onClick={() => pushPage('edit-profile')}
                    className="flex-1 bg-purple-100 hover:bg-purple-200 active:bg-purple-300 text-purple-700 font-normal text-[13px] px-3 py-2 rounded-full flex items-center justify-center transition-colors"
                  >
                    <span>Edit profile</span>
                  </button>
                  <button 
                    onClick={handleShare}
                    className="flex-1 bg-purple-100 hover:bg-purple-200 active:bg-purple-300 text-purple-700 font-normal text-[13px] px-3 py-2 rounded-full flex items-center justify-center transition-colors"
                  >
                    <span>Share profile</span>
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={handleFollow}
                    disabled={loading}
                    className={`flex-1 font-normal text-[13px] px-3 py-2.5 rounded-full flex items-center justify-center disabled:opacity-50 transition-all active:scale-95 ${
                      friendship.following 
                        ? 'bg-purple-100 hover:bg-purple-200 active:bg-purple-300 text-purple-700' 
                        : 'bg-purple-600 text-white hover:bg-purple-700 shadow-sm'
                    }`}
                  >
                    {friendship.isFriend ? 'Friends' : friendship.following ? 'Following' : friendship.followedBy ? 'Follow Back' : 'Follow'}
                  </button>
                  <button 
                    onClick={handleMessage}
                    className="flex-1 bg-purple-100 hover:bg-purple-200 active:bg-purple-300 text-purple-700 font-normal text-[13px] px-3 py-2 rounded-full flex items-center justify-center transition-colors"
                  >
                    <span>Message</span>
                  </button>
                </>
              )}
            </div>

            {/* Glass Bio Card */}
            {(userData?.bio || user?.bio || userData?.link || user?.link) && (
              <div className="w-full px-5 md:px-8 z-20 max-w-[500px]">
                <div className="bg-white/30 backdrop-blur-xl border border-white/60  rounded-2xl p-4 relative overflow-hidden">
                  <div className="absolute top-1 left-3 text-purple-400 font-serif text-3xl leading-none">“</div>
                  <div className="absolute bottom-4 right-4 text-purple-400 font-serif text-3xl leading-none rotate-180">“</div>
                  
                  <p className="text-center text-[14px] font-normal text-gray-800 leading-relaxed px-6 py-2 z-10 relative whitespace-pre-line">
                    {userData?.bio || user?.bio}
                  </p>
                  
                  {(userData?.link || user?.link) && (
                    <>
                      <div className="flex items-center justify-center my-3 relative z-10">
                        <div className="h-[1px] bg-purple-200 w-12"></div>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400 mx-2"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                        <div className="h-[1px] bg-purple-200 w-12"></div>
                      </div>
                      
                      <div className="flex items-center justify-center space-x-2 text-purple-500 pb-1 relative z-10">
                        <LinkIcon className="w-3.5 h-3.5" />
                        <a href={(userData?.link || user?.link)?.startsWith('http') ? (userData?.link || user?.link) : `https://${userData?.link || user?.link}`} target="_blank" rel="noopener noreferrer" className="text-[13px] font-normal hover:underline">
                          {(userData?.link || user?.link)?.replace(/^https?:\/\//, '')}
                        </a>
                        {isCurrentUser && (
                          <div className="bg-purple-500 rounded-full p-1 ml-4  text-white cursor-pointer active:scale-95" onClick={() => pushPage('edit-profile')}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  
                  {/* Floral Corner Deco */}
                  <div className="absolute -bottom-2 -right-4 w-28 h-28 opacity-60 pointer-events-none mix-blend-multiply">
                     <svg viewBox="0 0 100 100" className="w-full h-full fill-purple-300">
                        <path d="M 50 100 Q 40 80 10 70 Q 40 60 50 20 Q 60 60 90 70 Q 60 80 50 100 Z" />
                        <path d="M 80 100 Q 70 90 50 85 Q 70 80 75 60 Q 80 80 95 85 Q 80 90 80 100 Z" fill="#d8b4fe"/>
                        <path d="M 20 100 Q 30 90 50 85 Q 30 80 25 60 Q 20 80 5 85 Q 20 90 20 100 Z" fill="#e9d5ff" opacity="0.6"/>
                     </svg>
                  </div>
                </div>
              </div>
            )}
            
            {/* Highlights Row */}
            {((userData?.highlights || user?.highlights || []).length > 0) && (
              <div className="w-full mt-1 px-4 md:px-8 z-20 flex flex-wrap gap-4 items-center justify-center max-w-[500px]">
                 {/* Map actual highlights here */}
                 {(userData?.highlights || user?.highlights || []).map((highlight: string, i: number) => (
                   <div 
                     key={i} 
                     className="flex flex-col items-center justify-center h-[60px] select-none"
                     onPointerDown={() => handleHighlightPressStart(highlight)}
                     onPointerUp={handleHighlightPressEnd}
                     onPointerCancel={handleHighlightPressEnd}
                     onMouseLeave={handleHighlightPressEnd}
                     onTouchStart={() => handleHighlightPressStart(highlight)}
                     onTouchEnd={handleHighlightPressEnd}
                     onContextMenu={(e) => e.preventDefault()}
                     onClick={() => setViewingHighlightUrl(highlight)}
                   >
                     <div className="w-[60px] h-[60px] rounded-full p-[2px] bg-gradient-to-br from-pink-400 to-purple-500 cursor-pointer hover:scale-105 transition-transform">
                       <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-white">
                         <img src={highlight} alt="Highlight" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                       </div>
                     </div>
                   </div>
                 ))}

                 {/* New Highlight + Button - ONLY shown if highlights exist */}
                 {isCurrentUser && (
                   <div className="flex flex-col items-center justify-center h-[60px]">
                     <div 
                       className="w-[60px] h-[60px] rounded-full border border-dashed border-gray-400 flex items-center justify-center text-gray-700 cursor-pointer hover:bg-white/20 transition-colors"
                       onClick={() => highlightInputRef.current?.click()}
                     >
                       {isUploadingHighlight ? (
                         <Loader2 className="w-5 h-5 animate-spin" />
                       ) : (
                         <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                       )}
                     </div>
                     <input type="file" ref={highlightInputRef} className="hidden" accept="image/*" onChange={handleUploadHighlight} />
                   </div>
                 )}
              </div>
            )}
          </div>

        {/* Modern Tabs */}
        {(!isCurrentUser && userData?.isPrivate && !friendship.following) ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500 border-t border-gray-100 w-full">
            <Lock className="w-16 h-16 mb-4 text-gray-200" />
            <h2 className="text-xl font-normal text-gray-900 mb-2">This account is private</h2>
            <p className="text-[14px]">Follow this account to see their photos and videos.</p>
          </div>
        ) : (
          <>
            <div className="flex w-full mt-0 border-t border-gray-100 md:border-none md:bg-white/60 md:backdrop-blur-xl md:rounded-2xl md:p-1.5 md:max-w-md md:mx-auto md:mb-6 md:border md:border-white/80 md:shadow-2xs">
              <button 
                onClick={() => setActiveTab('posts')}
                className={`flex-1 flex justify-center items-center py-3 md:py-2 md:rounded-xl border-b-2 md:border-b-0 transition-all ${activeTab === 'posts' ? 'border-black text-black md:bg-white md:shadow-xs md:text-purple-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
              >
                <Grid className="w-5 h-5 mx-auto" />
              </button>
              <button 
                onClick={() => setActiveTab('reels')}
                className={`flex-1 flex justify-center items-center py-3 md:py-2 md:rounded-xl border-b-2 md:border-b-0 transition-all ${activeTab === 'reels' ? 'border-black text-black md:bg-white md:shadow-xs md:text-purple-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
              >
                <PlaySquare className="w-5 h-5 mx-auto" />
              </button>
              <button 
                onClick={() => setActiveTab('reposts')}
                className={`flex-1 flex justify-center items-center py-3 md:py-2 md:rounded-xl border-b-2 md:border-b-0 transition-all ${activeTab === 'reposts' ? 'border-black text-black md:bg-white md:shadow-xs md:text-purple-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>
              </button>
              {isCurrentUser && (
                <button 
                  onClick={() => setActiveTab('saved')}
                  className={`flex-1 flex justify-center items-center py-3 md:py-2 md:rounded-xl border-b-2 md:border-b-0 transition-all ${activeTab === 'saved' ? 'border-black text-black md:bg-white md:shadow-xs md:text-purple-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                  <Bookmark className="w-5 h-5 mx-auto" />
                </button>
              )}
              {isCurrentUser && privatePosts.length > 0 && (
                <button 
                  onClick={() => setActiveTab('private')}
                  title="Private Posts & Reels"
                  className={`flex-1 flex justify-center items-center py-3 md:py-2 md:rounded-xl border-b-2 md:border-b-0 transition-all relative ${activeTab === 'private' ? 'border-purple-600 text-purple-600 md:bg-white md:shadow-xs' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                  <Lock className="w-5 h-5 mx-auto" />
                  <span className="absolute top-2 right-1/4 bg-purple-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full shadow-xs">
                    {privatePosts.length}
                  </span>
                </button>
              )}
            </div>

            {/* Posts Feed */}
            {activeTab === 'posts' && (
              <div className="flex flex-col pb-20 max-w-[600px] mx-auto w-full pt-1">
                {isPostsLoading ? (
                  <div className="space-y-4 px-4 py-3">
                    {[1, 2, 3].map((k) => (
                      <div key={k} className="bg-white rounded-3xl border border-gray-100 p-4 animate-pulse">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-full"></div>
                          <div className="flex-1 space-y-1.5">
                            <div className="w-28 h-3.5 bg-purple-100 rounded"></div>
                            <div className="w-16 h-2.5 bg-purple-50 rounded"></div>
                          </div>
                        </div>
                        <div className="w-full h-48 bg-purple-50/70 rounded-2xl"></div>
                      </div>
                    ))}
                  </div>
                ) : regularPosts.length > 0 ? (
                  regularPosts.slice(0, visibleCount).map((post) => (
                    <PostItem key={post.id} post={post} theme="purple" />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <Grid className="w-12 h-12 mb-3 text-purple-300/40" />
                    <h3 className="text-base font-normal text-gray-800 mb-1">No Posts Yet</h3>
                    <p className="text-xs text-gray-400">Photos and videos shared will appear here</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reposts' && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-px md:gap-3.5 pb-20 w-full">
                {repostedPosts.slice(0, visibleCount).map((post) => {
                  const isReel = post.type === 'reel' || post.media?.[0]?.includes('.mp4') || post.media?.[0]?.includes('video');
                  return (
                    <div 
                      key={post.id} 
                      className="relative aspect-[3/4] md:aspect-[9/16] bg-gray-900 overflow-hidden cursor-pointer group md:rounded-2xl md:border md:border-white/60 md:shadow-xs hover:md:shadow-md transition-all duration-200 hover:md:scale-[1.02]"
                      onClick={() => {
                        if (isReel) {
                          setViewingReel({ ...post, single: true });
                        } else {
                          setViewingMedia({ type: 'post', url: post.media?.[0] || '', user: { name: post.authorName, avatar: post.authorAvatar } });
                        }
                      }}
                    >
                      {isReel ? (
                        <>
                          <ReelCoverThumbnail 
                            mediaUrl={post.media?.[0]} 
                            thumbnailUrl={post.thumbnailUrl || post.thumbnail} 
                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300" 
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none"></div>
                          <div className="absolute bottom-2 left-2 flex items-center text-white font-normal text-[13px]">
                            <Play className="w-3.5 h-3.5 mr-1 fill-transparent stroke-white stroke-2" /> {post.viewsCount || 0}
                          </div>
                        </>
                      ) : (
                        <>
                          {post.media?.[0] ? (
                            <img src={post.media[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Repost" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center p-4 bg-gradient-to-br from-purple-500 to-indigo-600 text-white text-[10px] text-center font-normal">
                              {post.text?.substring(0, 40)}...
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
                {repostedPosts.length === 0 && (
                  <div className="col-span-3 sm:col-span-4 md:col-span-5 lg:col-span-6 flex flex-col items-center justify-center py-20 text-gray-500 w-full">
                    <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30 mb-4 text-purple-600"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>
                    <h2 className="text-lg font-normal text-gray-900 mb-1">No Reposts</h2>
                    <p className="text-[14px]">Reposted reels and photos will show up here</p>
                  </div>
                )}
              </div>
            )}

            {/* Reels Grid - Responsive compact 5/6 columns on PC */}
            {activeTab === 'reels' && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-px md:gap-3.5 pb-20 w-full">
                {isPostsLoading ? (
                  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((k) => (
                    <div key={k} className="aspect-[3/4] md:aspect-[9/16] bg-purple-100/60 md:rounded-2xl animate-pulse" />
                  ))
                ) : reels.length > 0 ? (
                  reels.slice(0, visibleCount).map((reel) => (
                    <div 
                      key={reel.id} 
                      className="relative aspect-[3/4] md:aspect-[9/16] bg-gray-900 overflow-hidden cursor-pointer group md:rounded-2xl md:border md:border-white/60 md:shadow-xs hover:md:shadow-md transition-all duration-200 hover:md:scale-[1.02]"
                      onClick={() => {
                        setViewingReelContext(user?.uid || 'all');
                        setViewingReel(reel);
                      }}
                    >
                      <ReelCoverThumbnail 
                        mediaUrl={reel.media?.[0]} 
                        thumbnailUrl={reel.thumbnailUrl || reel.thumbnail} 
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none"></div>
                      <div className="absolute bottom-2 left-2 flex items-center text-white font-normal text-[13px]">
                        <Play className="w-3.5 h-3.5 mr-1 fill-transparent stroke-white stroke-2" /> {reel.viewsCount || 0}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-3 sm:col-span-4 md:col-span-5 lg:col-span-6 flex flex-col items-center justify-center py-20 text-gray-400 w-full">
                    <PlaySquare className="w-12 h-12 mb-3 text-purple-300/40" />
                    <h3 className="text-base font-normal text-gray-800 mb-1">No Reels Yet</h3>
                    <p className="text-xs text-gray-400">Reels created will appear here</p>
                  </div>
                )}
              </div>
            )}

            {/* Saved Section with Sub-Tabs */}
            {activeTab === 'saved' && (
              <div className="w-full pb-20">
                {/* Sub-Tabs Pills */}
                <div className="flex items-center space-x-2 px-3 py-2.5 overflow-x-auto hide-scrollbar bg-gray-50/80 border-b border-gray-100 w-full mb-1">
                  <button
                    onClick={() => setSavedSubTab('all')}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium flex items-center space-x-1.5 transition-all shrink-0 ${
                      savedSubTab === 'all'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-100'
                    }`}
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span>All ({savedPosts.length})</span>
                  </button>

                  <button
                    onClick={() => setSavedSubTab('reels')}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium flex items-center space-x-1.5 transition-all shrink-0 ${
                      savedSubTab === 'reels'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-100'
                    }`}
                  >
                    <PlaySquare className="w-3.5 h-3.5" />
                    <span>Reels</span>
                  </button>

                  <button
                    onClick={() => setSavedSubTab('posts')}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium flex items-center space-x-1.5 transition-all shrink-0 ${
                      savedSubTab === 'posts'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-100'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Posts</span>
                  </button>

                  <button
                    onClick={() => setSavedSubTab('songs')}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium flex items-center space-x-1.5 transition-all shrink-0 ${
                      savedSubTab === 'songs'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-100'
                    }`}
                  >
                    <Music className="w-3.5 h-3.5" />
                    <span>Songs</span>
                  </button>

                  <button
                    onClick={() => setSavedSubTab('stickers')}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium flex items-center space-x-1.5 transition-all shrink-0 ${
                      savedSubTab === 'stickers'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white text-gray-600 border border-gray-200/80 hover:bg-gray-100'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Stickers</span>
                  </button>
                </div>

                {/* Sub-Tab Content: Songs vs Regular Grid */}
                {savedSubTab === 'songs' ? (
                  <div className="flex flex-col space-y-2.5 px-3 py-2 w-full">
                    {allSavedSongs.map((song) => {
                      const isPlaying = playingSongUrl === song.url;
                      return (
                        <div 
                          key={song.id} 
                          className="bg-white rounded-2xl p-3 border border-purple-100/70 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between space-x-3 group"
                        >
                          <div className="flex items-center space-x-3 min-w-0 flex-1">
                            {/* Song Cover / Play Button */}
                            <div className="relative w-12 h-12 rounded-2xl overflow-hidden bg-purple-100 shrink-0 border border-purple-200/50 shadow-xs">
                              <img 
                                src={song.cover || `https://ui-avatars.com/api/?name=${encodeURIComponent(song.title)}&background=8b5cf6&color=fff`} 
                                className="w-full h-full object-cover" 
                                alt={song.title}
                                referrerPolicy="no-referrer"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTogglePlaySong(song.url);
                                }}
                                className="absolute inset-0 bg-black/40 hover:bg-black/50 flex items-center justify-center transition-colors text-white"
                              >
                                {isPlaying ? (
                                  <div className="w-3.5 h-3.5 bg-white rounded-xs animate-pulse" />
                                ) : (
                                  <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                                )}
                              </button>
                            </div>

                            {/* Song Meta */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-1.5">
                                <h4 className="font-semibold text-xs text-gray-900 truncate leading-tight">
                                  {song.title}
                                </h4>
                                {song.isFavoriteSong && (
                                  <span className="bg-purple-100 text-purple-700 text-[9px] font-bold px-1.5 py-0.2 rounded-full shrink-0">
                                    Saved
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-500 truncate mt-0.5 flex items-center space-x-1">
                                <Music className="w-2.5 h-2.5 text-purple-500 shrink-0" />
                                <span className="truncate">{song.artist}</span>
                              </p>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center space-x-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCreateSong({
                                  id: song.id,
                                  title: song.title,
                                  artist: song.artist,
                                  url: song.url,
                                  cover: song.cover
                                });
                                pushPage('create');
                              }}
                              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white rounded-xl text-[11px] font-medium flex items-center space-x-1 shadow-2xs transition-all"
                            >
                              <span>Use Audio</span>
                            </button>

                            {isCurrentUser && currentUser && (
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await toggleSongFavorite(song.id, currentUser.uid, song);
                                  } catch (err) {
                                    console.error("Failed to toggle song fav:", err);
                                  }
                                }}
                                title="Remove from favorites"
                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors active:scale-90"
                              >
                                <Heart className="w-4 h-4 fill-rose-500" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {allSavedSongs.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-16 text-gray-500 w-full">
                        <div className="w-14 h-14 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center mb-3">
                          <Music className="w-7 h-7 text-purple-600" />
                        </div>
                        <h3 className="text-sm font-semibold text-gray-800 mb-1">No Favorite Songs Yet</h3>
                        <p className="text-xs text-gray-400 text-center max-w-xs">
                          When you favorite music from any reel or post, it will be neatly organized right here.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-px md:gap-3.5 w-full">
                    {filteredSavedPosts.slice(0, visibleCount).map((post) => {
                      const isReel = post.type === 'reel' || post.media?.[0]?.includes('.mp4') || post.media?.[0]?.includes('video');
                      return (
                        <div 
                          key={post.id} 
                          className="relative aspect-[3/4] md:aspect-[9/16] bg-gray-900 overflow-hidden cursor-pointer group md:rounded-2xl md:border md:border-white/60 md:shadow-xs hover:md:shadow-md transition-all duration-200 hover:md:scale-[1.02]"
                          onClick={() => {
                            if (isReel) {
                              setViewingReel({ ...post, single: true } as any);
                            } else {
                              setViewingPost(post);
                            }
                          }}
                        >
                          {isReel ? (
                            <>
                              <ReelCoverThumbnail 
                                mediaUrl={post.media?.[0]} 
                                thumbnailUrl={post.thumbnailUrl || post.thumbnail} 
                                className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-300" 
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none"></div>
                              <div className="absolute bottom-2 left-2 flex items-center text-white font-normal text-[12px]">
                                <Play className="w-3 h-3 mr-1 fill-white text-white" /> {post.viewsCount || 0}
                              </div>
                            </>
                          ) : (
                            <>
                              {post.media?.[0] ? (
                                <img src={post.media[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Saved" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center p-4 bg-gradient-to-br from-blue-600 to-purple-700 text-white text-[11px] font-medium text-center">
                                  {post.text?.substring(0, 50)}...
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Heart className="w-5 h-5 text-white fill-white" />
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                    {filteredSavedPosts.length === 0 && (
                      <div className="col-span-3 sm:col-span-4 md:col-span-5 lg:col-span-6 flex flex-col items-center justify-center py-16 text-gray-500 w-full">
                        {savedSubTab === 'reels' ? (
                          <PlaySquare className="w-12 h-12 mb-3 text-purple-500/30" />
                        ) : savedSubTab === 'stickers' ? (
                          <Sparkles className="w-12 h-12 mb-3 text-purple-500/30" />
                        ) : (
                          <Bookmark className="w-12 h-12 mb-3 text-purple-500/30" />
                        )}
                        <h3 className="text-base font-medium text-gray-800 mb-1">
                          No Saved {savedSubTab.charAt(0).toUpperCase() + savedSubTab.slice(1)}
                        </h3>
                        <p className="text-[13px] text-gray-400">Items you save in this category will appear here</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Private Section (Only Me) */}
            {activeTab === 'private' && isCurrentUser && (
              <div className="w-full pb-20 pt-2 px-3">
                <div className="bg-purple-50/70 border border-purple-200/60 rounded-2xl p-3.5 mb-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-900 flex items-center space-x-1">
                        <span>Private Posts & Reels</span>
                        <span className="text-[10px] bg-purple-200 text-purple-800 px-1.5 py-0.2 rounded-full font-bold">
                          {privatePosts.length}
                        </span>
                      </h4>
                      <p className="text-[11px] text-gray-500">Only you can see these. Tap 'Make Public' to restore to public reels/feed in real time.</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3.5 w-full">
                  {privatePosts.map((post) => {
                    const isReel = post.type === 'reel' || post.media?.[0]?.includes('.mp4') || post.media?.[0]?.includes('video');
                    return (
                      <div 
                        key={post.id} 
                        className="relative aspect-[3/4] md:aspect-[9/16] bg-gray-900 rounded-2xl overflow-hidden shadow-xs border border-gray-100 group flex flex-col justify-between"
                      >
                        {/* Click to open preview */}
                        <div 
                          className="absolute inset-0 cursor-pointer"
                          onClick={() => {
                            if (isReel) {
                              setViewingReel({ ...post, single: true } as any);
                            } else {
                              setViewingPost(post);
                            }
                          }}
                        >
                          {isReel ? (
                            <ReelCoverThumbnail 
                              mediaUrl={post.media?.[0]} 
                              thumbnailUrl={post.thumbnailUrl || post.thumbnail} 
                              className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" 
                            />
                          ) : post.media?.[0] ? (
                            <img src={post.media[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="Private" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center p-2 bg-gradient-to-br from-gray-800 to-gray-900 text-white text-[10px] text-center">
                              {post.text?.substring(0, 30)}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
                        </div>

                        {/* Top Badge: Private */}
                        <div className="relative z-10 p-2 flex items-center justify-between pointer-events-none">
                          <div className="bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full flex items-center space-x-1 text-[10px] text-purple-300 border border-white/10 font-medium">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Only Me</span>
                          </div>
                        </div>

                        {/* Bottom Action: Real-time Make Public button */}
                        <div className="relative z-10 p-2 pointer-events-auto">
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await updateDoc(doc(db, 'posts', post.id), { privacy: 'public', isPrivate: false });
                                window.dispatchEvent(new CustomEvent('reelPrivacyUpdated', { detail: { id: post.id, privacy: 'public', isPrivate: false } }));
                              } catch (err) {
                                console.error("Failed to make public:", err);
                              }
                            }}
                            className="w-full py-1.5 bg-white/95 hover:bg-white active:scale-95 text-gray-900 rounded-xl text-[11px] font-semibold flex items-center justify-center space-x-1 shadow-sm transition-all backdrop-blur-md"
                          >
                            <Globe className="w-3 h-3 text-purple-600" />
                            <span>Make Public</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Custom Delete Highlight Dialog */}
        {deleteHighlightUrl && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setDeleteHighlightUrl(null)}>
            <div className="bg-white rounded-2xl w-full max-w-xs p-6 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-normal text-gray-900 mb-2">Delete Highlight?</h3>
              <p className="text-sm text-gray-500 mb-6">Are you sure you want to delete this highlight photo?</p>
              <div className="flex flex-col space-y-2">
                <button 
                  onClick={async () => {
                    if (user?.uid && deleteHighlightUrl) {
                      try {
                        await updateDoc(doc(db, 'users', user.uid), {
                          highlights: arrayRemove(deleteHighlightUrl)
                        });
                      } catch (err) {
                        console.error(err);
                      }
                    }
                    setDeleteHighlightUrl(null);
                  }}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-normal py-2.5 rounded-xl transition-all active:scale-95"
                >
                  Delete
                </button>
                <button 
                  onClick={() => setDeleteHighlightUrl(null)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-normal py-2.5 rounded-xl transition-all active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Full-View Highlight Lightbox Modal */}
        {viewingHighlightUrl && (
          <div 
            className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-md flex flex-col justify-between items-center p-4 animate-in fade-in duration-200"
            onClick={() => setViewingHighlightUrl(null)}
          >
            {/* Top Bar */}
            <div className="w-full max-w-md flex items-center justify-between pt-12 sm:pt-4 px-2 z-10" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center space-x-3">
                <img 
                  src={user?.avatar || profileAvatar} 
                  className="w-10 h-10 rounded-full object-cover border-2 border-white/80 shadow-md" 
                  alt={profileName} 
                  referrerPolicy="no-referrer"
                />
                <div className="text-white drop-shadow-md">
                  <p className="font-semibold text-sm leading-tight">{profileName}</p>
                  <p className="text-[11px] text-white/70 font-normal">Highlight Photo</p>
                </div>
              </div>
              <button 
                onClick={() => setViewingHighlightUrl(null)}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all active:scale-90"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Main Highlight Image */}
            <div className="flex-1 flex items-center justify-center w-full max-w-md my-4 relative" onClick={(e) => e.stopPropagation()}>
              <img 
                src={viewingHighlightUrl} 
                alt="Highlight Full View" 
                className="max-h-[72vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl border border-white/10"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Bottom Reply Bar */}
            <div className="w-full max-w-md pb-4 px-2 z-10" onClick={(e) => e.stopPropagation()}>
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-full p-1.5 flex items-center space-x-2 shadow-2xl">
                <input 
                  type="text" 
                  placeholder={`Send message to ${profileName}...`}
                  value={highlightReplyText}
                  onChange={(e) => setHighlightReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendHighlightReply()}
                  className="flex-1 bg-transparent px-4 py-2 text-sm text-white placeholder-white/50 focus:outline-none"
                />
                <button 
                  onClick={handleSendHighlightReply}
                  disabled={!highlightReplyText.trim() || sendingHighlightReply}
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white p-2.5 rounded-full transition-all active:scale-95 shrink-0 flex items-center justify-center"
                >
                  {sendingHighlightReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
    </PullToRefresh>
  );
}
