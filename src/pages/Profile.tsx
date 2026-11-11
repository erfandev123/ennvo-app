import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, onSnapshot, query, collection, where, orderBy, getDocs, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { Settings, Grid, Bookmark, UserSquare, Link as LinkIcon, Heart, MessageCircle, PlaySquare, Play, ArrowLeft, Globe, MoreHorizontal, Send, CheckCircle2, UserPlus, UserCheck, UserMinus, X, Lock, Eye, Loader2, Music, Image as ImageIcon, Sparkles, Camera, ChevronDown, Plus, Pencil } from 'lucide-react';
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
import { FacebookProfileSkeleton, FacebookPostSkeleton, FacebookGridSkeleton } from '../components/Skeletons';
import { AccountSwitcherModal } from '../components/AccountSwitcherModal';
import { MediaCropModal } from '../components/MediaCropModal';
import { shareContent } from '../services/shareService';

const isVideoMedia = (url?: string | null): boolean => {
  if (!url) return false;
  return /\.(mp4|webm|mov|m4v|ogg)($|\?)/i.test(url) || url.startsWith('data:video') || url.includes('video/mp4') || url.includes('/video');
};

const UserRowWithFollow = React.memo(({ user, currentUser, onSelectUser }: { user: any, currentUser: any, onSelectUser: (user: any) => void }) => {
  const { followingIds, followerIds, setFollowingIds } = useAppStore();
  const [loading, setLoading] = useState(false);

  // Synchronous, instant, glitch-free lookup from synchronized store
  const isFollowing = currentUser && user?.uid ? ((followingIds || []).includes(user.uid)) : false;
  const isFollowedBy = currentUser && user?.uid ? ((followerIds || []).includes(user.uid)) : false;
  const isFriend = isFollowing && isFollowedBy;

  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || !user.uid || loading) return;
    setLoading(true);
    const wasFollowing = isFollowing;
    
    // Instant optimistic update across all components
    if (wasFollowing) {
      setFollowingIds((followingIds || []).filter(id => id !== user.uid));
    } else {
      setFollowingIds([...(followingIds || []), user.uid]);
    }

    try {
      if (wasFollowing) {
        await unfollowUser(currentUser.uid, user.uid);
      } else {
        await followUser(currentUser, { uid: user.uid, name: user.name || 'User', avatar: user.avatar || '', username: user.username || '' });
      }
    } catch (err) {
      console.error(err);
      // Revert on failure
      if (wasFollowing) {
        setFollowingIds([...(followingIds || []), user.uid]);
      } else {
        setFollowingIds((followingIds || []).filter(id => id !== user.uid));
      }
    } finally {
      setLoading(false);
    }
  };

  const username = user.username || (user.name || 'user').toLowerCase().replace(/\s+/g, '_');

  return (
    <div 
      className="flex items-center justify-between py-2 px-2.5 hover:bg-neutral-50/90 active:bg-neutral-100/70 rounded-2xl cursor-pointer transition-colors"
      onClick={() => onSelectUser(user)}
    >
      <div className="flex items-center space-x-3 min-w-0 flex-1 pr-2">
        <img 
          src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random`} 
          className="w-10 h-10 rounded-full object-cover shrink-0 border border-neutral-100" 
          referrerPolicy="no-referrer" 
          loading="lazy"
          alt=""
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[13.5px] text-neutral-900 leading-tight truncate">{user.name || 'User'}</p>
          <p className="text-neutral-500 text-[11.5px] font-normal leading-tight mt-0.5 truncate">@{username}</p>
        </div>
      </div>
      {currentUser?.uid !== user.uid && (
        <div className="flex items-center space-x-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button 
            onClick={handleFollowToggle}
            disabled={loading}
            className={`font-semibold text-[12px] px-3.5 py-1.5 rounded-full transition-all  border-0 ${
              isFriend 
                ? 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200 shadow-none' 
                : isFollowing 
                ? 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200 shadow-none' 
                : isFollowedBy
                ? 'bg-gradient-to-r from-[#ff3b5c] to-[#ff5376] hover:brightness-105 text-white shadow-sm'
                : 'bg-gradient-to-r from-[#ff3b5c] to-[#ff5376] hover:brightness-105 text-white shadow-sm'
            }`}
          >
            {isFriend ? 'Friends' : isFollowing ? 'Following' : isFollowedBy ? 'Follow Back' : 'Follow'}
          </button>
        </div>
      )}
    </div>
  );
});

export default function Profile() {
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'saved' | 'reposts' | 'private'>('reels');
  const { viewingUser, setViewingUser, setViewingMedia, setViewingPost, setViewingReel, setViewingReelList, setViewingReelContext, currentUser, setCurrentUser, pushPage, popPage, setActiveChat, cachedProfilePosts, setCachedProfilePosts, cachedSavedPosts, setCachedSavedPosts, setIsBottomNavHidden, setSelectedCreateSong, setShowAccountSwitcherModal } = useAppStore();
  const isCurrentUser = !viewingUser || viewingUser.uid === currentUser?.uid;
  const targetUserId = isCurrentUser ? currentUser?.uid : viewingUser.uid;
  const [userData, setUserData] = useState<User | null>(null);
  const user = isCurrentUser ? (userData || currentUser) : (userData || viewingUser);

  const [profilePosts, setProfilePosts] = useState<Post[]>(cachedProfilePosts[targetUserId || ''] || []);
  const [savedPosts, setSavedPosts] = useState<Post[]>(cachedSavedPosts[targetUserId || ''] || []);
  const [favoriteSongsList, setFavoriteSongsList] = useState<any[]>([]);
  const [totalLikes, setTotalLikes] = useState(0);
  const followingIds = useAppStore(state => state.followingIds);
  const followerIds = useAppStore(state => state.followerIds);
  const setFollowingIds = useAppStore(state => state.setFollowingIds);
  const [showFollowersList, setShowFollowersList] = useState<'followers' | 'following' | null>(null);
  const [peopleList, setPeopleList] = useState<any[]>([]);
  // Synchronous, glitch-free instant friendship calculation (no flashing or slow state changes)
  const isTargetFollowing = Boolean(!isCurrentUser && targetUserId && (followingIds || []).includes(targetUserId));
  const isTargetFollower = Boolean(!isCurrentUser && targetUserId && (followerIds || []).includes(targetUserId));
  const isTargetFriend = isTargetFollowing && isTargetFollower;
  const friendship = useMemo(() => ({
    following: isTargetFollowing,
    followedBy: isTargetFollower,
    isFriend: isTargetFriend
  }), [isTargetFollowing, isTargetFollower, isTargetFriend]);
  const [isPostsLoading, setIsPostsLoading] = useState(() => !cachedProfilePosts[targetUserId || user?.uid || '']);
  const [loading, setLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(24);
  const [savedSubTab, setSavedSubTab] = useState<'all' | 'reels' | 'posts' | 'songs' | 'stickers'>('all');
  const [playingSongUrl, setPlayingSongUrl] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isCurrentUser && currentUser?.uid && targetUserId) {
      import('../services/followService').then(({ isBlockedEitherWay }) => {
        isBlockedEitherWay(currentUser.uid, targetUserId).then(res => {
          setIsBlocked(Boolean(res));
        });
      });
    } else {
      setIsBlocked(false);
    }
  }, [isCurrentUser, currentUser?.uid, targetUserId]);

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
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingHighlight, setIsUploadingHighlight] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarCropModalOpen, setAvatarCropModalOpen] = useState(false);
  const [avatarCropTargetFile, setAvatarCropTargetFile] = useState<File | null>(null);

  const pressTimer = useRef<any>(null);
  const avatarHoldTimerRef = useRef<any>(null);
  const isHoldTriggeredRef = useRef<boolean>(false);

  const handleAvatarPressStart = () => {
    isHoldTriggeredRef.current = false;
    if (avatarHoldTimerRef.current) {
      clearTimeout(avatarHoldTimerRef.current);
    }
    avatarHoldTimerRef.current = setTimeout(() => {
      isHoldTriggeredRef.current = true;
      const targetUrl = userData?.avatar || profileAvatar;
      if (targetUrl) {
        setViewingMedia({
          url: targetUrl,
          type: isVideoMedia(targetUrl) ? 'video' : 'image'
        });
      }
    }, 450);
  };

  const handleAvatarPressEnd = () => {
    if (avatarHoldTimerRef.current) {
      clearTimeout(avatarHoldTimerRef.current);
      avatarHoldTimerRef.current = null;
    }
  };

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarCropTargetFile(file);
      setAvatarCropModalOpen(true);
    }
    e.target.value = '';
  };

  const handleApplyCroppedAvatar = async (croppedFile: File, previewUrl: string) => {
    if (!user?.uid) return;
    setAvatarCropModalOpen(false);

    // 1. Instant optimistic update in UI (0ms delay)
    setUserData(prev => prev ? ({ ...prev, avatar: previewUrl }) : null);
    if (isCurrentUser && currentUser) {
      setCurrentUser({ ...currentUser, avatar: previewUrl });
    }

    // 2. Background cloud upload & database sync
    setIsUploadingAvatar(true);
    try {
      const url = await uploadMedia(croppedFile, 'avatars');
      await updateDoc(doc(db, 'users', user.uid), {
        avatar: url
      });
      setUserData(prev => prev ? ({ ...prev, avatar: url }) : null);
      if (isCurrentUser && currentUser) {
        setCurrentUser({ ...currentUser, avatar: url });
      }
    } catch (err) {
      console.error('Failed to update avatar:', err);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const CUTE_HIGHLIGHT_TITLES = [
    '♡(> ਊ <)♡',
    '♡•₊˚✦',
    '(⋆˘◡˘⋆).*♡',
    '(◍•ᴗ•◍)✧*。',
    '˗ˏˋ ★ ˎˊ˗',
    '✧(｡•̀ᴗ-)✧',
    '♡ diary ♡',
    '₊˚⊹♡',
  ];

  const handleUploadBanner = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;

    // 1. Instant optimistic update in UI (0ms delay)
    const localPreview = URL.createObjectURL(file);
    setUserData(prev => prev ? ({ ...prev, bannerUrl: localPreview }) : null);
    if (isCurrentUser && currentUser) {
      setCurrentUser({ ...currentUser, bannerUrl: localPreview });
    }

    // 2. Background cloud upload & database sync
    setIsUploadingBanner(true);
    try {
      const url = await uploadMedia(file, 'banners');
      await updateDoc(doc(db, 'users', user.uid), {
        bannerUrl: url
      });
      setUserData(prev => prev ? ({ ...prev, bannerUrl: url }) : null);
      if (isCurrentUser && currentUser) {
        setCurrentUser({ ...currentUser, bannerUrl: url });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleUploadHighlight = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;
    setIsUploadingHighlight(true);
    try {
      const url = await uploadMedia(file, 'highlights');
      await updateDoc(doc(db, 'users', user.uid), {
        highlights: arrayUnion(url)
      });
      setUserData(prev => prev ? ({ ...prev, highlights: [...(prev.highlights || []), url] }) : null);
      if (isCurrentUser && currentUser) {
        setCurrentUser({ ...currentUser, highlights: [...(currentUser.highlights || []), url] });
      }
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

  // Track and fetch profile views (Self view is strictly excluded)
  useEffect(() => {
    if (user?.uid) {
      if (!isCurrentUser && currentUser && currentUser.uid !== user.uid) {
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
        import('firebase/firestore').then(({ collection, onSnapshot, deleteDoc, doc }) => {
          const viewsRef = collection(db, 'users', user.uid, 'profileViews');
          unsubscribeViews = onSnapshot(viewsRef, (snapshot) => {
            // Clean up any self-view document that might have been recorded previously
            snapshot.docs.forEach(d => {
              const data = d.data();
              if (d.id === user.uid || data.uid === user.uid) {
                deleteDoc(doc(db, 'users', user.uid, 'profileViews', d.id)).catch(() => {});
              }
            });

            // Filter out own UID completely so user's own pfp never appears in profile views
            const list = snapshot.docs
              .map(d => ({ ...(d.data() as any), _docId: d.id }))
              .filter((d: any) => d.uid && d.uid !== user.uid && d.uid !== currentUser?.uid && d._docId !== user.uid);
            list.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
            const count = list.length;
            setProfileViewsCount(count);
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

  // Hide bottom navigation bar when viewing Profile Views or Followers/Following list
  useEffect(() => {
    if (showProfileViews || showFollowersList) {
      setIsBottomNavHidden(true);
    } else {
      setIsBottomNavHidden(false);
    }
    return () => {
      setIsBottomNavHidden(false);
    };
  }, [showProfileViews, showFollowersList, setIsBottomNavHidden]);
  
  const [showFriendOptionsModal, setShowFriendOptionsModal] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [customNickname, setCustomNickname] = useState('');
  const [tempNickname, setTempNickname] = useState('');
  const [customHighlightTitles, setCustomHighlightTitles] = useState<Record<number, string>>({});
  const [editingHighlightIndex, setEditingHighlightIndex] = useState<number | null>(null);
  const [tempHighlightTitle, setTempHighlightTitle] = useState('');

  useEffect(() => {
    if (targetUserId) {
      try {
        const raw = localStorage.getItem(`ennvo_hl_titles_${targetUserId}`);
        setCustomHighlightTitles(raw ? JSON.parse(raw) : (userData as any)?.highlightTitles || {});
      } catch {
        setCustomHighlightTitles({});
      }
    }
  }, [targetUserId, userData]);

  const handleSaveHighlightTitle = async (idx: number, newTitle: string) => {
    if (!newTitle.trim()) {
      setEditingHighlightIndex(null);
      return;
    }
    const updated = { ...customHighlightTitles, [idx]: newTitle.trim() };
    setCustomHighlightTitles(updated);
    if (targetUserId) {
      try {
        localStorage.setItem(`ennvo_hl_titles_${targetUserId}`, JSON.stringify(updated));
        if (isCurrentUser && currentUser?.uid) {
          await updateDoc(doc(db, 'users', currentUser.uid), { highlightTitles: updated });
        }
      } catch (e) {
        console.error(e);
      }
    }
    setEditingHighlightIndex(null);
  };

  useEffect(() => {
    if (targetUserId) {
      try {
        const map = JSON.parse(localStorage.getItem('ennvo_custom_nicknames') || '{}');
        setCustomNickname(map[targetUserId] || '');
      } catch {
        setCustomNickname('');
      }
    } else {
      setCustomNickname('');
    }
  }, [targetUserId]);

  const profileName = user?.name || 'User';
  const displayName = customNickname || userData?.name || profileName || 'User';
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
      
      return () => {
        unsubscribePosts();
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
    if (!currentUser || !user || isCurrentUser || loading) return;
    setLoading(true);
    
    // Optimistic update
    const wasFollowing = isTargetFollowing;

    if (wasFollowing) {
      setFollowingIds((followingIds || []).filter(id => id !== user.uid));
    } else {
      setFollowingIds([...(followingIds || []), user.uid]);
    }

    try {
      if (wasFollowing) {
        await unfollowUser(currentUser.uid, user.uid);
      } else {
        await followUser(currentUser, user);
      }
    } catch (error) {
      // Revert on error
      if (wasFollowing) {
        setFollowingIds([...(followingIds || []), user.uid]);
      } else {
        setFollowingIds((followingIds || []).filter(id => id !== user.uid));
      }
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleMessage = () => {
    if (!currentUser || !user || isCurrentUser) return;

    // 1. FAST PATH: the chat already exists in the local conversation cache, so
    //    the screen opens in the same frame - no network round trip.
    try {
      const cached = useAppStore.getState().cachedConversations || [];
      const existing = cached.find((c: any) => {
        const ids: string[] = c?.participantIds || [];
        return (
          ids.length === 2 &&
          ids.includes(currentUser.uid) &&
          ids.includes(user.uid)
        );
      });
      if (existing?.id) {
        setActiveChat(existing.id);
        pushPage('messages');
        return;
      }
    } catch (e) {}

    // 2. No cached thread yet: open Messages immediately and resolve the thread
    //    id in the background, instead of freezing the button for seconds.
    pushPage('messages');
    createConversation(
      [currentUser.uid, user.uid],
      {
        [currentUser.uid]: { name: currentUser.name, avatar: currentUser.avatar },
        [user.uid]: { name: user.name, avatar: user.avatar }
      }
    )
      .then((convId) => {
        if (convId) setActiveChat(convId);
      })
      .catch((error) => console.error(error));
  };

  const handleShare = async () => {
    const handle = profileHandle.replace('@', '');
    await shareContent({
      title: `${profileName}'s Profile`,
      text: `${profileName} on Ennvo`,
      url: `${window.location.origin}/user/${encodeURIComponent(handle)}`,
    });
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
      <div className="h-full w-full overflow-y-auto bg-white flex flex-col items-center relative md:pl-24 profile-page-root animate-in fade-in duration-300" onScroll={handleScroll}>
      <AnimatePresence>
        {/* Profile Views List */}
        {showProfileViews && (
          <div className="fixed inset-0 z-[120] flex flex-col bg-white animate-in slide-in-from-bottom duration-200">
            <div className="h-14 bg-white/95 backdrop-blur-md border-b border-neutral-100 flex items-center justify-between px-3 sticky top-0 z-20 shrink-0">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowProfileViews(false); }} 
                className="w-9 h-9 rounded-full hover:bg-neutral-100 text-neutral-800 flex items-center justify-center transition-colors"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5 text-neutral-900" strokeWidth={2.2} />
              </button>
              <h2 className="font-bold text-[16px] text-neutral-900 tracking-tight">Profile Views</h2>
              <div className="w-9 h-9" />
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-1.5 divide-y divide-neutral-100/70">
              {profileViewers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-neutral-400">
                  <Eye className="w-12 h-12 mb-3 text-neutral-300 stroke-[1.5]" />
                  <p className="font-medium text-sm text-neutral-500">No profile views yet</p>
                  <p className="text-xs text-neutral-400 mt-1">When others view your profile, they will appear here</p>
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
          <div className="fixed inset-0 z-[120] flex flex-col bg-white animate-in slide-in-from-bottom duration-200">
            <div className="h-14 bg-white/95 backdrop-blur-md border-b border-neutral-100 flex items-center justify-between px-3 sticky top-0 z-20 shrink-0">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowFollowersList(null); }} 
                className="w-9 h-9 rounded-full hover:bg-neutral-100 text-neutral-800 flex items-center justify-center transition-colors"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5 text-neutral-900" strokeWidth={2.2} />
              </button>
              <h2 className="font-bold text-[16px] text-neutral-900 capitalize tracking-tight">{showFollowersList}</h2>
              <div className="w-9 h-9" />
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-1.5 divide-y divide-neutral-100/70">
              {peopleList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-neutral-400">
                  <UserPlus className="w-12 h-12 mb-3 text-neutral-300 stroke-[1.5]" />
                  <p className="font-medium text-sm text-neutral-500">No {showFollowersList} yet</p>
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
                      pushPage('profile');
                    }} 
                  />
                ))
              )}
            </div>
          </div>
        )}
      </AnimatePresence>
      
      <div className="w-full max-w-6xl mx-auto px-0 md:px-8 py-0 md:py-6">
          {/* BLOCKED ACCOUNT VIEW */}
          {isBlocked ? (
            <div className="w-full min-h-[60vh] flex flex-col items-center justify-center pt-8 pb-16 px-4 text-center select-none">
              <div className="w-full px-4 pt-5 pb-3 flex items-center justify-between mb-8">
                <button 
                  onClick={() => popPage()} 
                  className="p-2 -ml-2 text-neutral-800 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-all"
                  title="Back"
                >
                  <ArrowLeft className="w-6 h-6 text-neutral-900 dark:text-white" strokeWidth={2.2} />
                </button>
                <span className="font-bold text-base text-neutral-900 dark:text-white">Profile</span>
                <div className="w-8" />
              </div>

              {/* PFP with Ennvo profile icon logo */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 bg-gradient-to-tr from-neutral-200 to-neutral-300 dark:from-neutral-700 dark:to-neutral-800 shadow-md mb-4 flex items-center justify-center overflow-hidden">
                <img 
                  src="/icon-192.png?v=5" 
                  alt="Ennvo Logo" 
                  className="w-16 h-16 sm:w-18 sm:h-18 rounded-full object-cover opacity-90"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>

              <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white mb-1.5">
                Account not found
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mt-1 mb-6 leading-relaxed">
                The link you followed may be broken, or the account may have been removed or blocked.
              </p>

              <button
                onClick={() => popPage()}
                className="px-6 py-2.5 rounded-full bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-black font-semibold text-sm transition-all shadow-sm cursor-pointer"
              >
                Go Back
              </button>
            </div>
          ) : (
            <>
          {/* Feed-matching Ambient Soft Blue Glow for Profiles without a custom banner */}
          {!user?.bannerUrl && (
            <div 
              className="pointer-events-none absolute top-0 left-0 right-0 h-[260px] sm:h-[300px] bg-gradient-to-b from-sky-400/[0.15] via-blue-500/[0.05] to-transparent dark:from-blue-600/[0.22] dark:via-blue-800/[0.06] dark:to-transparent z-0" 
              aria-hidden="true" 
            />
          )}

          {/* MOBILE PROFILE HEADER */}
          <div className="block md:hidden w-full relative">
            {user?.bannerUrl ? (
              /* Top edge-to-edge banner when bannerUrl is set */
              <div className="w-full h-40 sm:h-44 relative overflow-hidden bg-gradient-to-b from-purple-100/70 via-purple-50/40 to-white">
                {/* Filigree ornament flourish at top header */}
                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 pointer-events-none opacity-30 z-10">
                  <svg className="w-20 h-4 text-purple-700/60" viewBox="0 0 100 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <path d="M4 12 C 16 3, 24 21, 35 12 C 42 6, 46 6, 50 12 C 54 18, 58 18, 65 12 C 76 3, 84 21, 96 12" />
                    <circle cx="50" cy="12" r="1.5" fill="currentColor" />
                    <circle cx="4" cy="12" r="1.2" fill="currentColor" />
                    <circle cx="96" cy="12" r="1.2" fill="currentColor" />
                  </svg>
                </div>

                {isVideoMedia(user.bannerUrl) ? (
                  <video 
                    src={user.bannerUrl} 
                    autoPlay 
                    loop 
                    muted 
                    playsInline 
                    className="w-full h-full object-cover pointer-events-none" 
                  />
                ) : (
                  <img 
                    src={user.bannerUrl} 
                    alt="Profile Banner" 
                    className="w-full h-full object-cover" 
                  />
                )}
                {/* Seamless blending: only the bottom edge fades smoothly into the white screen */}
                <div className="absolute bottom-0 left-0 right-0 h-14 pointer-events-none bg-gradient-to-t from-white via-white/60 to-transparent" />

                {/* Floating Top Navigation Bar */}
                <div className="absolute top-0 left-0 right-0 px-3 pt-[max(calc(env(safe-area-inset-top,0px)+18px),26px)] sm:pt-8 pb-2 z-30 flex items-center justify-between pointer-events-auto">
                  {!isCurrentUser ? (
                    <button 
                      onClick={() => popPage()} 
                      className="p-1.5 text-neutral-800 hover:text-neutral-900 transition-all"
                      title="Back"
                    >
                      <ArrowLeft className="w-6 h-6 text-neutral-800" strokeWidth={2.2} />
                    </button>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center space-x-2 ml-auto">
                    {isCurrentUser && (
                      <button 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-800 hover:bg-neutral-100/60 transition-all relative border-0 shadow-none overflow-visible"
                        onClick={() => {
                          localStorage.setItem('lastCheckedProfileViewsCount', profileViewsCount.toString());
                          setUnreadViewsCount(0);
                          setShowProfileViews(true);
                        }}
                        title="Profile views"
                      >
                        {profileViewers.length > 0 ? (
                          <img src={profileViewers[0].avatar} alt="View" className="w-8 h-8 rounded-full object-cover border border-neutral-200" referrerPolicy="no-referrer" />
                        ) : (
                          <Eye className="w-4.5 h-4.5 text-neutral-800" strokeWidth={1.9} />
                        )}
                        {unreadViewsCount > 0 ? (
                          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[8.5px] font-bold px-1 rounded-full border border-white min-w-[14px] h-[14px] flex items-center justify-center">
                            {unreadViewsCount > 99 ? '99+' : unreadViewsCount}
                          </span>
                        ) : null}
                      </button>
                    )}

                    {isCurrentUser && (
                      <button 
                        onClick={() => pushPage('settings')}
                        className="w-8 h-8 rounded-full bg-white/90 hover:bg-neutral-100 text-neutral-700 shadow-xs flex items-center justify-center transition-all backdrop-blur-md border border-neutral-200/50"
                        title="Settings"
                      >
                        <Settings className="w-4 h-4 text-neutral-700" strokeWidth={1.8} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Compact Top Navigation Bar when NO banner is set (NO empty gap at the top!) */
              <div className="w-full px-3 pt-[max(calc(env(safe-area-inset-top,0px)+18px),26px)] sm:pt-8 pb-1 flex items-center justify-between">
                {!isCurrentUser ? (
                  <button 
                    onClick={() => popPage()} 
                    className="p-1.5 text-neutral-800 hover:text-neutral-900 transition-all"
                    title="Back"
                  >
                    <ArrowLeft className="w-6 h-6 text-neutral-800" strokeWidth={2.2} />
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center space-x-2 ml-auto">
                  {isCurrentUser && (
                    <button 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-800 hover:bg-neutral-100/60 transition-all relative border-0 shadow-none overflow-visible"
                      onClick={() => {
                        localStorage.setItem('lastCheckedProfileViewsCount', profileViewsCount.toString());
                        setUnreadViewsCount(0);
                        setShowProfileViews(true);
                      }}
                      title="Profile views"
                    >
                      {profileViewers.length > 0 ? (
                        <img src={profileViewers[0].avatar} alt="View" className="w-8 h-8 rounded-full object-cover border border-neutral-200" referrerPolicy="no-referrer" />
                      ) : (
                        <Eye className="w-4.5 h-4.5 text-neutral-800" strokeWidth={1.9} />
                      )}
                      {unreadViewsCount > 0 ? (
                        <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[8.5px] font-bold px-1 rounded-full border border-white min-w-[14px] h-[14px] flex items-center justify-center">
                          {unreadViewsCount > 99 ? '99+' : unreadViewsCount}
                        </span>
                      ) : null}
                    </button>
                  )}

                  {isCurrentUser && (
                    <button 
                      onClick={() => pushPage('settings')}
                      className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 shadow-none flex items-center justify-center transition-all border-0"
                      title="Settings"
                    >
                      <Settings className="w-4 h-4 text-neutral-700" strokeWidth={1.8} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Mobile Profile Details: Right Avatar if banner exists, LEFT Avatar if NO banner */}
            <div className={`px-4 pb-3 ${user?.bannerUrl ? 'pt-0' : 'pt-1'} relative z-20`}>
              {!user?.bannerUrl ? (
                /* Dedicated layout for users with NO banner:
                   Profile pic on LEFT, Name, Username, and Counters on RIGHT */
                <div className="flex items-center space-x-4">
                  {/* Left Side: Circular Profile Picture */}
                  <div className="relative shrink-0">
                    <div 
                      className="w-[96px] h-[96px] sm:w-[104px] sm:h-[104px] rounded-full p-[2.5px] bg-gradient-to-tr from-sky-400 via-blue-500 to-indigo-600 flex items-center justify-center relative cursor-pointer select-none"
                      onPointerDown={handleAvatarPressStart}
                      onPointerUp={handleAvatarPressEnd}
                      onPointerCancel={handleAvatarPressEnd}
                      onMouseLeave={handleAvatarPressEnd}
                      onTouchStart={handleAvatarPressStart}
                      onTouchEnd={handleAvatarPressEnd}
                      onContextMenu={(e) => {
                        if (isHoldTriggeredRef.current) {
                          e.preventDefault();
                        }
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                      }}
                      title={isCurrentUser ? "Hold to view full photo" : "Hold to view photo"}
                    >
                      <div className="w-full h-full rounded-full p-[2.5px] bg-white dark:bg-black flex items-center justify-center overflow-hidden">
                        {isVideoMedia(userData?.avatar || profileAvatar) ? (
                          <video 
                            src={userData?.avatar || profileAvatar} 
                            autoPlay 
                            loop 
                            muted 
                            playsInline 
                            className="w-full h-full object-cover rounded-full pointer-events-none" 
                          />
                        ) : (
                          <img 
                            src={userData?.avatar || profileAvatar} 
                            alt="Profile" 
                            className="w-full h-full object-cover rounded-full pointer-events-none" 
                            referrerPolicy="no-referrer" 
                          />
                        )}
                      </div>

                      {/* Verified Blue Badge at PFP bottom-right (in place of pencil icon) */}
                      {user?.isVerified ? (
                        <div className="absolute bottom-0 right-0 z-20 pointer-events-none drop-shadow-sm">
                          <VerifiedBadge className="w-6.5 h-6.5 sm:w-7 sm:h-7" />
                        </div>
                      ) : isCurrentUser ? (
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            pushPage('edit-profile');
                          }}
                          className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-neutral-900 text-white hover:bg-neutral-800 shadow-sm flex items-center justify-center transition-all border-2 border-white z-10"
                          title="Edit profile"
                        >
                          <Pencil className="w-3 h-3 text-white" strokeWidth={2.2} />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Right Side: Name, Username, and Stats Counters (Shifted to the right with elegant spacing) */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center pl-2 sm:pl-2.5">
                    <h1 className="text-[23px] sm:text-[26px] font-black text-neutral-950 tracking-tight flex items-center space-x-1.5 truncate leading-tight">
                      <span className="truncate">{displayName}</span>
                      {user?.isVerified && <VerifiedBadge />}
                    </h1>
                    <p className="text-neutral-500 font-medium text-[13px] sm:text-[13.5px] mt-0.5 truncate">
                      @{userData?.username || profileHandle.replace('@', '')}
                    </p>

                    {/* Horizontal Stats counters on right side - Shifted right with balanced spacing */}
                    <div className="flex items-center space-x-5 sm:space-x-6 mt-3">
                      <div 
                        className="flex flex-col cursor-pointer transition-transform"
                        onClick={() => setShowFollowersList('following')}
                      >
                        <span className="text-[17px] sm:text-[18px] font-black text-neutral-900 leading-none">
                          {formatCount(userData?.followingCount ?? user?.followingCount ?? 0)}
                        </span>
                        <span className="text-neutral-500 text-[11px] font-medium mt-1">Following</span>
                      </div>

                      <div 
                        className="flex flex-col cursor-pointer transition-transform"
                        onClick={() => setShowFollowersList('followers')}
                      >
                        <span className="text-[17px] sm:text-[18px] font-black text-neutral-900 leading-none">
                          {formatCount(userData?.followersCount ?? user?.followersCount ?? 0)}
                        </span>
                        <span className="text-neutral-500 text-[11px] font-medium mt-1">Followers</span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[17px] sm:text-[18px] font-black text-neutral-900 leading-none">
                          {formatCount(userData?.totalLikes ?? (totalLikes || profilePosts.reduce((sum, p) => sum + (p.likesCount || 0), 0)))}
                        </span>
                        <span className="text-neutral-500 text-[11px] font-medium mt-1">Likes</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Banner layout: Left Name & Stats, Right overlapping Avatar */
                <div className="flex items-start justify-between">
                  {/* Left Side: Name, Username, Stats */}
                  <div className="flex-1 pr-3 pt-1 min-w-0">
                    <h1 className="text-[22px] sm:text-[25px] font-extrabold text-neutral-900 tracking-tight flex items-center space-x-1.5 truncate leading-tight">
                      <span className="truncate">{displayName}</span>
                      {user?.isVerified && <VerifiedBadge />}
                    </h1>
                    <p className="text-neutral-500 font-medium text-[13.5px] sm:text-[14px] mt-0.5 truncate">
                      @{userData?.username || profileHandle.replace('@', '')}
                    </p>

                    <div className="flex items-center space-x-5 sm:space-x-6 mt-3">
                      <div 
                        className="flex flex-col cursor-pointer transition-transform"
                        onClick={() => setShowFollowersList('following')}
                      >
                        <span className="text-[17px] sm:text-[18px] font-black text-gray-900 leading-none">
                          {formatCount(userData?.followingCount ?? user?.followingCount ?? 0)}
                        </span>
                        <span className="text-gray-500 text-[11px] font-medium mt-1">Following</span>
                      </div>

                      <div 
                        className="flex flex-col cursor-pointer transition-transform"
                        onClick={() => setShowFollowersList('followers')}
                      >
                        <span className="text-[17px] sm:text-[18px] font-black text-gray-900 leading-none">
                          {formatCount(userData?.followersCount ?? user?.followersCount ?? 0)}
                        </span>
                        <span className="text-gray-500 text-[11px] font-medium mt-1">Followers</span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[17px] sm:text-[18px] font-black text-gray-900 leading-none">
                          {formatCount(userData?.totalLikes ?? (totalLikes || profilePosts.reduce((sum, p) => sum + (p.likesCount || 0), 0)))}
                        </span>
                        <span className="text-gray-500 text-[11px] font-medium mt-1">Likes</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Circular Profile Picture with Long-Press View & Edit Pen */}
                  <div className="relative -mt-14 sm:-mt-16 shrink-0">
                    <div 
                      className="w-[114px] h-[114px] sm:w-[120px] sm:h-[120px] rounded-full p-[3px] bg-gradient-to-tr from-sky-400 via-blue-500 to-indigo-600 flex items-center justify-center relative cursor-pointer select-none"
                      onPointerDown={handleAvatarPressStart}
                      onPointerUp={handleAvatarPressEnd}
                      onPointerCancel={handleAvatarPressEnd}
                      onMouseLeave={handleAvatarPressEnd}
                      onTouchStart={handleAvatarPressStart}
                      onTouchEnd={handleAvatarPressEnd}
                      onContextMenu={(e) => {
                        if (isHoldTriggeredRef.current) {
                          e.preventDefault();
                        }
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                      }}
                      title={isCurrentUser ? "Hold to view full photo" : "Hold to view photo"}
                    >
                      <div className="w-full h-full rounded-full p-[3px] bg-white dark:bg-black flex items-center justify-center overflow-hidden">
                        {isVideoMedia(userData?.avatar || profileAvatar) ? (
                          <video 
                            src={userData?.avatar || profileAvatar} 
                            autoPlay 
                            loop 
                            muted 
                            playsInline 
                            className="w-full h-full object-cover rounded-full pointer-events-none" 
                          />
                        ) : (
                          <img 
                            src={userData?.avatar || profileAvatar} 
                            alt="Profile" 
                            className="w-full h-full object-cover rounded-full pointer-events-none" 
                            referrerPolicy="no-referrer" 
                          />
                        )}
                      </div>

                      {/* Verified Blue Badge at PFP bottom-right (in place of pencil icon) */}
                      {user?.isVerified ? (
                        <div className="absolute bottom-0 right-0 z-20 pointer-events-none drop-shadow-sm">
                          <VerifiedBadge className="w-7 h-7 sm:w-7.5 sm:h-7.5" />
                        </div>
                      ) : isCurrentUser ? (
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            pushPage('edit-profile');
                          }}
                          className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-neutral-900 text-white hover:bg-neutral-800 shadow-md flex items-center justify-center transition-all border-2 border-white z-10"
                          title="Edit profile"
                        >
                          <Pencil className="w-3.5 h-3.5 text-white" strokeWidth={2.2} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons Row */}
              <div className="flex items-center space-x-2 w-full mt-4">
                {isCurrentUser ? (
                  <>
                    <button 
                      onClick={() => pushPage('edit-profile')}
                      className="flex-1 bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 text-neutral-800 font-semibold text-[13.5px] py-2.5 px-3 rounded-full transition-all border-0 shadow-none flex items-center justify-center space-x-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5 text-neutral-600" />
                      <span>Edit profile</span>
                    </button>
                    <button 
                      onClick={handleShare}
                      className="flex-1 bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 text-neutral-800 font-semibold text-[13.5px] py-2.5 px-3 rounded-full transition-all border-0 shadow-none flex items-center justify-center"
                    >
                      <span>Share profile</span>
                    </button>
                    <button 
                      onClick={() => setShowAccountSwitcherModal(true)}
                      className="w-10 h-10 bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 text-neutral-800 rounded-full flex items-center justify-center transition-all shrink-0 border-0 shadow-none"
                      title="Switch Account"
                    >
                      <ChevronDown className="w-4.5 h-4.5 text-neutral-700" />
                    </button>
                  </>
                ) : (
                  <>
                    {friendship.isFriend ? (
                      /* If user is Friend: Message button has highlighted follow color, Friends button opens slide-up options */
                      <>
                        <button 
                          onClick={handleMessage}
                          className="flex-1 bg-gradient-to-r from-[#ff3b5c] to-[#ff5376] hover:brightness-105 text-white font-semibold text-[13.5px] py-2.5 px-4 rounded-full shadow-sm flex items-center justify-center space-x-1.5 transition-all"
                        >
                          <MessageCircle className="w-4 h-4 text-white" />
                          <span>Message</span>
                        </button>
                        <button 
                          onClick={() => setShowFriendOptionsModal(true)}
                          className="flex-1 bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 text-neutral-800 font-semibold text-[13.5px] py-2.5 px-4 rounded-full transition-all border-0 shadow-none flex items-center justify-center space-x-1.5"
                        >
                          <span>Friends</span>
                          <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
                        </button>
                      </>
                    ) : (
                      /* Regular Follow / Following / Follow Back */
                      <>
                        <button 
                          onClick={handleFollow}
                          disabled={loading}
                          className={`flex-1 font-semibold text-[13.5px] px-4 py-2.5 rounded-full flex items-center justify-center disabled:opacity-50 transition-all  ${
                            friendship.following 
                              ? 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200 border-0 shadow-none' 
                              : 'bg-gradient-to-r from-[#ff3b5c] to-[#ff5376] hover:brightness-105 text-white shadow-sm'
                          }`}
                        >
                          {friendship.following ? 'Following' : friendship.followedBy ? 'Follow Back' : 'Follow'}
                        </button>
                        <button 
                          onClick={handleMessage}
                          className="flex-1 bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 text-neutral-800 font-semibold text-[13.5px] px-4 py-2.5 rounded-full transition-all border-0 shadow-none flex items-center justify-center"
                        >
                          <span>Message</span>
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Bio Section - Beautiful clean typography */}
              {(userData?.bio || user?.bio || userData?.link || user?.link) && (
                <div className="w-full mt-3 px-0.5">
                  {Boolean(userData?.bio || user?.bio) && (
                    <p className="text-[13.5px] text-neutral-800 leading-relaxed whitespace-pre-line font-normal break-words">
                      {userData?.bio || user?.bio}
                    </p>
                  )}
                  {(userData?.link || user?.link) && (
                    <div className="mt-2 flex items-center">
                      <a 
                        href={(userData?.link || user?.link)?.startsWith('http') ? (userData?.link || user?.link) : `https://${userData?.link || user?.link}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center space-x-1.5 px-3 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[12px] font-medium rounded-full transition-all border border-neutral-200/70"
                      >
                        <LinkIcon className="w-3 h-3 text-neutral-500 shrink-0" />
                        <span className="truncate max-w-[240px]">{(userData?.link || user?.link)?.replace(/^https?:\/\//, '')}</span>
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Story Highlights Section */}
              {(userData?.highlights || user?.highlights || []).length > 0 && (
                <div className="w-full mt-3.5 overflow-x-auto hide-scrollbar pb-1">
                  <div className="flex items-center space-x-3.5 min-w-max">
                    {(userData?.highlights || user?.highlights || []).map((highlight: string, i: number) => {
                      const title = customHighlightTitles[i] || (userData as any)?.highlightTitles?.[i] || CUTE_HIGHLIGHT_TITLES[i % CUTE_HIGHLIGHT_TITLES.length];
                      return (
                        <div 
                          key={i} 
                          className="flex flex-col items-center select-none group cursor-pointer"
                          onPointerDown={() => handleHighlightPressStart(highlight)}
                          onPointerUp={handleHighlightPressEnd}
                          onPointerCancel={handleHighlightPressEnd}
                          onMouseLeave={handleHighlightPressEnd}
                          onTouchStart={() => handleHighlightPressStart(highlight)}
                          onTouchEnd={handleHighlightPressEnd}
                          onContextMenu={(e) => e.preventDefault()}
                          onClick={() => setViewingHighlightUrl(highlight)}
                        >
                          <div className="w-[68px] h-[68px] sm:w-[74px] sm:h-[74px] rounded-[24px] p-[2.5px] bg-gradient-to-tr from-purple-300 via-pink-200 to-indigo-300 shadow-2xs transition-transform duration-200">
                            <div className="w-full h-full rounded-[21px] overflow-hidden bg-white border border-white/80">
                              {isVideoMedia(highlight) ? (
                                <video 
                                  src={highlight} 
                                  autoPlay 
                                  loop 
                                  muted 
                                  playsInline 
                                  className="w-full h-full object-cover pointer-events-none" 
                                />
                              ) : (
                                <img src={highlight} alt="Highlight" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              )}
                            </div>
                          </div>
                          
                          {/* Editable highlight title for current user */}
                          <div 
                            className="flex items-center justify-center space-x-1 mt-1.5 cursor-pointer max-w-[76px]"
                            onClick={(e) => {
                              if (isCurrentUser) {
                                e.stopPropagation();
                                setEditingHighlightIndex(i);
                                setTempHighlightTitle(title);
                              }
                            }}
                            title={isCurrentUser ? "Click to edit title" : undefined}
                          >
                            <span className="text-[11px] font-medium text-neutral-800 tracking-tight text-center truncate">
                              {title}
                            </span>
                            {isCurrentUser && (
                              <Pencil className="w-2.5 h-2.5 text-neutral-400 opacity-60 hover:opacity-100 shrink-0" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* DESKTOP PROFILE HEADER (PC Layout) */}
          <div className="hidden md:block w-full mb-6 bg-white rounded-[32px] border border-neutral-100 shadow-sm overflow-hidden">
            {user?.bannerUrl ? (
              /* Desktop Panoramic Banner */
              <div className="w-full h-56 lg:h-64 relative overflow-hidden bg-gradient-to-r from-purple-100 via-pink-50 to-indigo-100">
                {isVideoMedia(user.bannerUrl) ? (
                  <video src={user.bannerUrl} autoPlay loop muted playsInline className="w-full h-full object-cover pointer-events-none" />
                ) : (
                  <img src={user.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/20" />

                {/* Desktop Banner Actions */}
                <div className="absolute top-4 right-4 flex items-center space-x-2 z-20">
                  <button 
                    onClick={handleShare}
                    className="w-8 h-8 rounded-full bg-white/90 hover:bg-white text-neutral-700 shadow-xs flex items-center justify-center transition-all backdrop-blur-md border-0"
                    title="Share Profile"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                  </button>
                  {isCurrentUser && (
                    <button 
                      onClick={() => pushPage('settings')}
                      className="w-8 h-8 rounded-full bg-white/90 hover:bg-white text-neutral-700 shadow-xs flex items-center justify-center transition-all backdrop-blur-md border-0"
                      title="Settings"
                    >
                      <Settings className="w-4 h-4 text-neutral-700" strokeWidth={1.8} />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Desktop Top Bar when NO banner - Zero gap, clean buttons on right */
              <div className="px-8 pt-4 pb-0 flex items-center justify-end space-x-2">
                <button 
                  onClick={handleShare}
                  className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 flex items-center justify-center transition-all border-0"
                  title="Share Profile"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                </button>
                {isCurrentUser && (
                  <button 
                    onClick={() => pushPage('settings')}
                    className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 flex items-center justify-center transition-all border-0"
                    title="Settings"
                  >
                    <Settings className="w-4 h-4 text-neutral-700" strokeWidth={1.8} />
                  </button>
                )}
              </div>
            )}

            {/* Desktop User Info & Stats */}
            <div className={`px-8 pb-8 ${user?.bannerUrl ? 'pt-0' : 'pt-2'} relative`}>
              <div className={`flex flex-col md:flex-row md:items-end justify-between ${user?.bannerUrl ? '-mt-16' : 'mt-0'} mb-6`}>
                <div className="flex items-end space-x-6">
                  {/* Avatar */}
                  <div className="relative group shrink-0">
                    <div 
                      className="w-32 h-32 rounded-full p-[3.5px] bg-gradient-to-tr from-sky-400 via-blue-500 to-indigo-600 flex items-center justify-center relative cursor-pointer select-none"
                      onPointerDown={handleAvatarPressStart}
                      onPointerUp={handleAvatarPressEnd}
                      onPointerCancel={handleAvatarPressEnd}
                      onMouseLeave={handleAvatarPressEnd}
                      onTouchStart={handleAvatarPressStart}
                      onTouchEnd={handleAvatarPressEnd}
                      onContextMenu={(e) => {
                        if (isHoldTriggeredRef.current) {
                          e.preventDefault();
                        }
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                      }}
                      title={isCurrentUser ? "Hold to view full photo" : "Hold to view photo"}
                    >
                      <div className="w-full h-full rounded-full p-[3px] bg-white dark:bg-black flex items-center justify-center overflow-hidden">
                        {isVideoMedia(userData?.avatar || profileAvatar) ? (
                          <video 
                            src={userData?.avatar || profileAvatar} 
                            autoPlay 
                            loop 
                            muted 
                            playsInline 
                            className="w-full h-full object-cover rounded-full pointer-events-none" 
                          />
                        ) : (
                          <img 
                            src={userData?.avatar || profileAvatar} 
                            alt="Profile" 
                            className="w-full h-full object-cover rounded-full pointer-events-none" 
                            referrerPolicy="no-referrer" 
                          />
                        )}
                      </div>

                      {/* Verified Blue Badge at PFP bottom-right (in place of pencil icon on desktop) */}
                      {user?.isVerified ? (
                        <div className="absolute bottom-1 right-1 z-20 pointer-events-none drop-shadow-sm">
                          <VerifiedBadge className="w-8 h-8" />
                        </div>
                      ) : isCurrentUser ? (
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            pushPage('edit-profile');
                          }}
                          className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-neutral-900 text-white hover:bg-neutral-800 shadow-md flex items-center justify-center transition-all border-2 border-white z-10"
                          title="Edit profile"
                        >
                          <Pencil className="w-3.5 h-3.5 text-white" strokeWidth={2.2} />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Name & Handle */}
                  <div className="pb-1 pl-2">
                    <h1 className="text-3xl font-black text-neutral-950 tracking-tight flex items-center space-x-2">
                      <span>{displayName}</span>
                      {user?.isVerified && <VerifiedBadge />}
                    </h1>
                    <p className="text-neutral-500 font-medium text-sm mt-0.5">
                      @{userData?.username || profileHandle.replace('@', '')}
                    </p>
                  </div>
                </div>

                {/* Desktop Action Buttons - 2D clean buttons */}
                <div className="flex items-center space-x-2.5 mt-4 md:mt-0">
                  {isCurrentUser ? (
                    <>
                      <button 
                        onClick={() => pushPage('edit-profile')}
                        className="px-5 py-2.5 rounded-full bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 text-neutral-800 font-semibold text-sm transition-all border-0 shadow-none flex items-center space-x-1.5"
                      >
                        <Pencil className="w-3.5 h-3.5 text-neutral-600" />
                        <span>Edit profile</span>
                      </button>
                      <button 
                        onClick={handleShare}
                        className="px-5 py-2.5 rounded-full bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 text-neutral-800 font-semibold text-sm transition-all border-0 shadow-none flex items-center justify-center"
                      >
                        <span>Share profile</span>
                      </button>
                      <button 
                        onClick={() => setShowAccountSwitcherModal(true)}
                        className="w-10 h-10 bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 text-neutral-800 rounded-full flex items-center justify-center transition-all shrink-0 border-0 shadow-none"
                        title="Switch Account"
                      >
                        <ChevronDown className="w-4.5 h-4.5 text-neutral-700" />
                      </button>
                    </>
                  ) : (
                    <>
                      {friendship.isFriend ? (
                        <>
                          <button 
                            onClick={handleMessage}
                            className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#ff3b5c] to-[#ff5376] hover:brightness-105 text-white font-semibold text-sm shadow-sm flex items-center space-x-1.5 transition-all"
                          >
                            <MessageCircle className="w-4 h-4 text-white" />
                            <span>Message</span>
                          </button>
                          <button 
                            onClick={() => setShowFriendOptionsModal(true)}
                            className="px-6 py-2.5 rounded-full bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 text-neutral-800 font-semibold text-sm transition-all border-0 shadow-none flex items-center space-x-1.5"
                          >
                            <span>Friends</span>
                            <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={handleFollow}
                            disabled={loading}
                            className={`px-6 py-2.5 rounded-full font-semibold text-sm transition-all  ${
                              friendship.following 
                                ? 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200 border-0 shadow-none' 
                                : 'bg-gradient-to-r from-[#ff3b5c] to-[#ff5376] hover:brightness-105 text-white shadow-sm'
                            }`}
                          >
                            {friendship.following ? 'Following' : friendship.followedBy ? 'Follow Back' : 'Follow'}
                          </button>
                          <button 
                            onClick={handleMessage}
                            className="px-6 py-2.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold text-sm transition-all border-0 shadow-none"
                          >
                            Message
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Stats Row Desktop */}
              <div className="flex items-center space-x-8 py-3 px-5 bg-white/50 backdrop-blur-md rounded-2xl border border-white/80 max-w-lg mb-5 shadow-2xs">
                <div 
                  className="flex items-center space-x-2 cursor-pointer transition-transform"
                  onClick={() => setShowFollowersList('following')}
                >
                  <span className="text-base font-bold text-gray-900">
                    {formatCount(userData?.followingCount ?? user?.followingCount ?? 0)}
                  </span>
                  <span className="text-gray-500 text-xs font-medium">Following</span>
                </div>
                <div className="w-px h-4 bg-purple-200/80" />
                <div 
                  className="flex items-center space-x-2 cursor-pointer transition-transform"
                  onClick={() => setShowFollowersList('followers')}
                >
                  <span className="text-base font-bold text-gray-900">
                    {formatCount(userData?.followersCount ?? user?.followersCount ?? 0)}
                  </span>
                  <span className="text-gray-500 text-xs font-medium">Followers</span>
                </div>
                <div className="w-px h-4 bg-purple-200/80" />
                <div className="flex items-center space-x-2">
                  <span className="text-base font-bold text-gray-900">
                    {formatCount(userData?.totalLikes ?? (totalLikes || profilePosts.reduce((sum, p) => sum + (p.likesCount || 0), 0)))}
                  </span>
                  <span className="text-gray-500 text-xs font-medium">Likes</span>
                </div>
              </div>

              {/* Bio & Link Desktop */}
              {(userData?.bio || user?.bio || userData?.link || user?.link) && (
                <div className="max-w-2xl mb-6">
                  {Boolean(userData?.bio || user?.bio) && (
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line font-normal">
                      {userData?.bio || user?.bio}
                    </p>
                  )}
                  {(userData?.link || user?.link) && (
                    <div className="flex items-center space-x-1.5 text-purple-600 mt-2">
                      <LinkIcon className="w-4 h-4 shrink-0" />
                      <a 
                        href={(userData?.link || user?.link)?.startsWith('http') ? (userData?.link || user?.link) : `https://${userData?.link || user?.link}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-xs font-medium hover:underline"
                      >
                        {(userData?.link || user?.link)?.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Desktop Highlights (without plus button) */}
              {(userData?.highlights || user?.highlights || []).length > 0 && (
                <div className="pt-2 border-t border-purple-100/60">
                  <div className="flex items-center space-x-4 overflow-x-auto hide-scrollbar py-2">
                    {(userData?.highlights || user?.highlights || []).map((highlight: string, i: number) => (
                      <div 
                        key={i} 
                        className="flex flex-col items-center select-none group cursor-pointer"
                        onPointerDown={() => handleHighlightPressStart(highlight)}
                        onPointerUp={handleHighlightPressEnd}
                        onPointerCancel={handleHighlightPressEnd}
                        onMouseLeave={handleHighlightPressEnd}
                        onTouchStart={() => handleHighlightPressStart(highlight)}
                        onTouchEnd={handleHighlightPressEnd}
                        onContextMenu={(e) => e.preventDefault()}
                        onClick={() => setViewingHighlightUrl(highlight)}
                      >
                        <div className="w-16 h-16 rounded-[22px] p-[2.5px] bg-gradient-to-tr from-purple-300 via-pink-200 to-indigo-300 shadow-2xs transition-transform duration-200">
                          <div className="w-full h-full rounded-[19px] overflow-hidden bg-white border border-white/80">
                            {isVideoMedia(highlight) ? (
                              <video src={highlight} autoPlay loop muted playsInline className="w-full h-full object-cover pointer-events-none" />
                            ) : (
                              <img src={highlight} alt="Highlight" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            )}
                          </div>
                        </div>
                        <span className="text-[11px] font-medium text-gray-700 tracking-tight text-center mt-1.5 max-w-[70px] truncate">
                          {CUTE_HIGHLIGHT_TITLES[i % CUTE_HIGHLIGHT_TITLES.length]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
            {/* Clean Edge-to-Edge Screen-Matching Profile Navigation Tab Bar */}
            <div className="w-full border-t border-b border-neutral-200/70 dark:border-neutral-800/80 bg-white/95 dark:bg-black/95 backdrop-blur-md sticky top-0 z-20 select-none">
              <div className="max-w-[600px] mx-auto w-full flex items-center justify-around">
                
                {/* 1. Posts Tab */}
                <button 
                  type="button"
                  onClick={() => setActiveTab('posts')}
                  className={`flex-1 relative py-3 sm:py-3.5 flex flex-col items-center justify-center transition-colors cursor-pointer select-none group  ${
                    activeTab === 'posts' 
                      ? 'text-neutral-950 dark:text-white font-medium' 
                      : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
                  }`}
                  title="Posts"
                  aria-label="Posts"
                >
                  <Grid className="w-5 h-5 transition-transform" strokeWidth={activeTab === 'posts' ? 2.4 : 1.8} />
                  {activeTab === 'posts' && (
                    <motion.div 
                      layoutId="profileActiveTabLine"
                      transition={{ type: "spring", stiffness: 450, damping: 34 }}
                      className="absolute bottom-0 left-3 right-3 h-[2px] bg-neutral-950 dark:bg-white rounded-full"
                    />
                  )}
                </button>

                {/* 2. Reels Tab */}
                <button 
                  type="button"
                  onClick={() => setActiveTab('reels')}
                  className={`flex-1 relative py-3 sm:py-3.5 flex flex-col items-center justify-center transition-colors cursor-pointer select-none group  ${
                    activeTab === 'reels' 
                      ? 'text-neutral-950 dark:text-white font-medium' 
                      : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
                  }`}
                  title="Reels"
                  aria-label="Reels"
                >
                  <PlaySquare className="w-5 h-5 transition-transform" strokeWidth={activeTab === 'reels' ? 2.4 : 1.8} />
                  {activeTab === 'reels' && (
                    <motion.div 
                      layoutId="profileActiveTabLine"
                      transition={{ type: "spring", stiffness: 450, damping: 34 }}
                      className="absolute bottom-0 left-3 right-3 h-[2px] bg-neutral-950 dark:bg-white rounded-full"
                    />
                  )}
                </button>

                {/* 3. Reposts Tab */}
                <button 
                  type="button"
                  onClick={() => setActiveTab('reposts')}
                  className={`flex-1 relative py-3 sm:py-3.5 flex flex-col items-center justify-center transition-colors cursor-pointer select-none group  ${
                    activeTab === 'reposts' 
                      ? 'text-neutral-950 dark:text-white font-medium' 
                      : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
                  }`}
                  title="Reposts"
                  aria-label="Reposts"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={activeTab === 'reposts' ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round" className="transition-transform">
                    <path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>
                  </svg>
                  {activeTab === 'reposts' && (
                    <motion.div 
                      layoutId="profileActiveTabLine"
                      transition={{ type: "spring", stiffness: 450, damping: 34 }}
                      className="absolute bottom-0 left-3 right-3 h-[2px] bg-neutral-950 dark:bg-white rounded-full"
                    />
                  )}
                </button>

                {/* 4. Saved / Favorites Tab */}
                {isCurrentUser && (
                  <button 
                    type="button"
                    onClick={() => setActiveTab('saved')}
                    className={`flex-1 relative py-3 sm:py-3.5 flex flex-col items-center justify-center transition-colors cursor-pointer select-none group  ${
                      activeTab === 'saved' 
                        ? 'text-neutral-950 dark:text-white font-medium' 
                        : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
                    }`}
                    title="Favorites & Saved"
                    aria-label="Favorites & Saved"
                  >
                    <Bookmark className="w-5 h-5 transition-transform" strokeWidth={activeTab === 'saved' ? 2.4 : 1.8} />
                    {activeTab === 'saved' && (
                      <motion.div 
                        layoutId="profileActiveTabLine"
                        transition={{ type: "spring", stiffness: 450, damping: 34 }}
                        className="absolute bottom-0 left-3 right-3 h-[2px] bg-neutral-950 dark:bg-white rounded-full"
                      />
                    )}
                  </button>
                )}

                {/* 5. Private Tab (if private posts exist) */}
                {isCurrentUser && privatePosts.length > 0 && (
                  <button 
                    type="button"
                    onClick={() => setActiveTab('private')}
                    className={`flex-1 relative py-3 sm:py-3.5 flex flex-col items-center justify-center transition-colors cursor-pointer select-none group  ${
                      activeTab === 'private' 
                        ? 'text-purple-600 dark:text-purple-400 font-medium' 
                        : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
                    }`}
                    title="Private Posts"
                    aria-label="Private Posts"
                  >
                    <span className="relative flex items-center justify-center">
                      <Lock className="w-4.5 h-4.5 transition-transform" strokeWidth={activeTab === 'private' ? 2.4 : 1.8} />
                      <span className="absolute -top-1 -right-2 bg-purple-600 text-white text-[9px] font-bold px-1 py-0.2 rounded-full leading-none">
                        {privatePosts.length}
                      </span>
                    </span>
                    {activeTab === 'private' && (
                      <motion.div 
                        layoutId="profileActiveTabLine"
                        transition={{ type: "spring", stiffness: 450, damping: 34 }}
                        className="absolute bottom-0 left-3 right-3 h-[2px] bg-purple-600 rounded-full"
                      />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Posts Feed */}
            {activeTab === 'posts' && (
              <div className="flex flex-col pb-20 max-w-[600px] mx-auto w-full pt-1">
                {isPostsLoading ? (
                  <div className="space-y-3 px-3 py-2">
                    <FacebookPostSkeleton hasMedia={true} />
                    <FacebookPostSkeleton hasMedia={false} />
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
                          const repostReels = repostedPosts.filter(p => p.type === 'reel' || p.media?.[0]?.includes('.mp4') || p.media?.[0]?.includes('video'));
                          setViewingReelList(repostReels.length > 0 ? repostReels : [post]);
                          setViewingReel(post);
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
                            <img src={post.media[0]} className="w-full h-full object-cover transition-transform duration-500" alt="Repost" />
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
                  <div className="col-span-3 sm:col-span-4 md:col-span-5 lg:col-span-6 w-full">
                    <FacebookGridSkeleton count={9} />
                  </div>
                ) : reels.length > 0 ? (
                  reels.slice(0, visibleCount).map((reel) => (
                    <div 
                      key={reel.id} 
                      className="relative aspect-[3/4] md:aspect-[9/16] bg-gray-900 overflow-hidden cursor-pointer group md:rounded-2xl md:border md:border-white/60 md:shadow-xs hover:md:shadow-md transition-all duration-200 hover:md:scale-[1.02]"
                      onClick={() => {
                        setViewingReelList(reels);
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
                {reels.length > visibleCount && (
                  <div className="col-span-3 sm:col-span-4 md:col-span-5 lg:col-span-6 flex justify-center py-6">
                    <button
                      onClick={() => setVisibleCount((prev) => prev + 24)}
                      className="px-6 py-2.5 rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-semibold transition-all cursor-pointer shadow-xs"
                    >
                      Load More Reels ({reels.length - visibleCount} remaining)
                    </button>
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
                              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[11px] font-medium flex items-center space-x-1 shadow-2xs transition-all"
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
                                className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
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
                              const savedReels = filteredSavedPosts.filter(p => p.type === 'reel' || p.media?.[0]?.includes('.mp4') || p.media?.[0]?.includes('video'));
                              setViewingReelList(savedReels.length > 0 ? savedReels : [post]);
                              setViewingReel(post as any);
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
                                <img src={post.media[0]} className="w-full h-full object-cover transition-transform duration-500" alt="Saved" />
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
                              const pReels = privatePosts.filter(p => p.type === 'reel' || p.media?.[0]?.includes('.mp4') || p.media?.[0]?.includes('video'));
                              setViewingReelList(pReels.length > 0 ? pReels : [post]);
                              setViewingReel(post as any);
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
                            <img src={post.media[0]} className="w-full h-full object-cover transition-transform duration-300" alt="Private" />
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
                            className="w-full py-1.5 bg-white/95 hover:bg-white text-gray-900 rounded-xl text-[11px] font-semibold flex items-center justify-center space-x-1 shadow-sm transition-all backdrop-blur-md"
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
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-normal py-2.5 rounded-xl transition-all"
                >
                  Delete
                </button>
                <button 
                  onClick={() => setDeleteHighlightUrl(null)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-normal py-2.5 rounded-xl transition-all"
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
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-all"
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
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white p-2.5 rounded-full transition-all shrink-0 flex items-center justify-center"
                >
                  {sendingHighlightReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Friend Options Bottom Sheet Modal */}
        {showFriendOptionsModal && (
          <div 
            className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-xs flex items-end justify-center animate-in fade-in duration-200"
            onClick={() => {
              setShowFriendOptionsModal(false);
              setShowNicknameModal(false);
            }}
          >
            <div 
              className="w-full max-w-md bg-white rounded-t-[28px] p-5 pb-8 space-y-3 animate-in slide-in-from-bottom duration-300 shadow-2xl border-t border-neutral-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-neutral-200 rounded-full mx-auto mb-3" />
              
              {!showNicknameModal ? (
                <>
                  <div className="text-center pb-2 border-b border-neutral-100">
                    <h3 className="font-bold text-[16px] text-neutral-900">
                      {displayName}
                    </h3>
                    <p className="text-neutral-500 text-xs mt-0.5">
                      @{userData?.username || profileHandle.replace('@', '')}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <button
                      onClick={() => {
                        setTempNickname(customNickname || userData?.name || '');
                        setShowNicknameModal(true);
                      }}
                      className="w-full py-3 px-4 rounded-2xl hover:bg-neutral-100 active:bg-neutral-200 flex items-center space-x-3 text-neutral-800 font-semibold text-[14px] transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-700">
                        <Pencil className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-neutral-900">Set Custom Name</p>
                        <p className="text-xs text-neutral-500">Add a custom nickname for this friend</p>
                      </div>
                    </button>

                    <button
                      onClick={async () => {
                        setShowFriendOptionsModal(false);
                        await handleFollow();
                      }}
                      className="w-full py-3 px-4 rounded-2xl hover:bg-rose-50 active:bg-rose-100 flex items-center space-x-3 text-rose-600 font-semibold text-[14px] transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-rose-100/70 flex items-center justify-center text-rose-600">
                        <UserMinus className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-rose-600">Unfollow</p>
                        <p className="text-xs text-rose-400">Remove from friends & following list</p>
                      </div>
                    </button>
                  </div>

                  <button
                    onClick={() => setShowFriendOptionsModal(false)}
                    className="w-full py-3 rounded-2xl bg-neutral-100 hover:bg-neutral-200 active:bg-neutral-300 text-neutral-800 font-semibold text-[14px] transition-all mt-2"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <div className="space-y-4 pt-1">
                  <div className="text-center">
                    <h3 className="font-bold text-[16px] text-neutral-900">Custom Nickname</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">Only you can see this custom name</p>
                  </div>

                  <input
                    type="text"
                    value={tempNickname}
                    onChange={(e) => setTempNickname(e.target.value)}
                    placeholder="Enter custom nickname..."
                    className="w-full px-4 py-3 rounded-2xl bg-neutral-100 border border-neutral-200 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                    autoFocus
                  />

                  <div className="flex space-x-2 pt-1">
                    <button
                      onClick={() => setShowNicknameModal(false)}
                      className="flex-1 py-3 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold text-sm transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => {
                        if (targetUserId) {
                          try {
                            const currentMap = JSON.parse(localStorage.getItem('ennvo_custom_nicknames') || '{}');
                            if (tempNickname.trim()) {
                              currentMap[targetUserId] = tempNickname.trim();
                              setCustomNickname(tempNickname.trim());
                            } else {
                              delete currentMap[targetUserId];
                              setCustomNickname('');
                            }
                            localStorage.setItem('ennvo_custom_nicknames', JSON.stringify(currentMap));
                          } catch (e) {
                            console.error(e);
                          }
                        }
                        setShowNicknameModal(false);
                        setShowFriendOptionsModal(false);
                      }}
                      className="flex-1 py-3 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-sm transition-all"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        </>
        )}

        {/* Hidden inputs for uploading banner & avatar */}
        <input 
          type="file" 
          ref={bannerInputRef} 
          onChange={handleUploadBanner} 
          accept="image/*,video/*" 
          className="hidden" 
        />
        <input 
          type="file" 
          ref={avatarInputRef} 
          onChange={handleAvatarFileSelect} 
          accept="image/*,video/*" 
          className="hidden" 
        />

        {/* Media Crop Modal for Avatar */}
        <MediaCropModal 
          isOpen={avatarCropModalOpen}
          file={avatarCropTargetFile}
          cropType="avatar"
          onClose={() => setAvatarCropModalOpen(false)}
          onApply={handleApplyCroppedAvatar}
        />

        {/* Edit Highlight Title Modal - 2D Clean */}
        {editingHighlightIndex !== null && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl p-5 max-w-xs w-full shadow-lg border border-neutral-100 space-y-4 animate-in zoom-in-95 duration-150">
              <div className="text-center">
                <h3 className="text-base font-bold text-neutral-900 tracking-tight">Edit Highlight Name</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Customize the title of this highlight</p>
              </div>

              <input 
                type="text" 
                value={tempHighlightTitle} 
                onChange={(e) => setTempHighlightTitle(e.target.value)} 
                placeholder="Highlight name"
                maxLength={30}
                autoFocus
                className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-[14px] text-neutral-900 focus:outline-none focus:border-purple-500 transition-colors"
              />

              <div className="flex space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingHighlightIndex(null)}
                  className="flex-1 py-2.5 rounded-2xl border border-neutral-200 text-neutral-700 font-semibold text-xs hover:bg-neutral-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const newTitle = tempHighlightTitle.trim() || 'Highlight';
                    const newTitles = { ...customHighlightTitles, [editingHighlightIndex]: newTitle };
                    setCustomHighlightTitles(newTitles);
                    try {
                      localStorage.setItem(`ennvo_hl_titles_${user?.uid}`, JSON.stringify(newTitles));
                      if (isCurrentUser && user?.uid) {
                        await updateDoc(doc(db, 'users', user.uid), {
                          highlightTitles: newTitles
                        });
                      }
                    } catch (err) {
                      console.error("Failed to save highlight title:", err);
                    }
                    setEditingHighlightIndex(null);
                  }}
                  className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-[#ff3b5c] to-[#ff5376] hover:brightness-105 text-white font-semibold text-xs transition-all shadow-sm"
                >
                  Save
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
