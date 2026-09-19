import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Search as SearchIcon, 
  Image as ImageIcon, 
  Play, 
  User, 
  Hash, 
  ArrowLeft, 
  X, 
  Clock, 
  TrendingUp, 
  Sparkles, 
  ChevronRight,
  UserCheck,
  UserPlus,
  MapPin,
  Compass,
  Navigation,
  Radio
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { followUser, unfollowUser } from '../services/followService';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { FacebookSearchSkeleton } from '../components/Skeletons';

const POPULAR_TRENDS = [
  '#funny', '#music', '#dance', '#tech', 
  '#lifestyle', '#art', '#nature', '#viral', 
  '#travel', '#photography', '#gaming', '#reels'
];

const SUGGESTED_KEYWORDS = [
  'trending videos', 'funny moments', 'tech news', 
  'dance reels', 'best music', 'travel vlog', 
  'art & design', 'fitness tips', 'photography'
];

const searchCacheMap = new Map<string, { users: any[]; posts: any[] }>();

// Skeleton Loader Component for fast visual feedback
const SearchSkeleton = () => (
  <FacebookSearchSkeleton />
);

// Memoized User Card
const SearchUserCard = React.memo(({ user, onUserClick, currentUser, isFollowing }: { user: any; onUserClick: (u: any) => void; currentUser: any; isFollowing: boolean }) => {
  const [following, setFollowing] = useState(isFollowing);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFollowing(isFollowing);
  }, [isFollowing]);

  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || loading) return;
    setLoading(true);
    const nextState = !following;
    setFollowing(nextState);

    try {
      if (!nextState) {
        await unfollowUser(currentUser.uid, user.uid);
      } else {
        await followUser(currentUser, user);
      }
    } catch (err) {
      console.error(err);
      setFollowing(!nextState);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.15 }}
      className="bg-white p-3.5 rounded-2xl shadow-2xs border border-gray-100/90 flex items-center justify-between hover:border-gray-200 transition-all cursor-pointer active:scale-[0.995]"
      onClick={() => onUserClick(user)}
    >
      <div className="flex items-center space-x-3.5 min-w-0 flex-1 pr-2">
        <img 
          src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random`} 
          className="w-12 h-12 rounded-full object-cover border border-gray-100 shadow-2xs shrink-0" 
          alt={user.name || 'User'} 
          referrerPolicy="no-referrer" 
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-1.5 truncate">
            <h4 className="font-semibold text-gray-900 text-[14.5px] truncate">{user.name || 'User'}</h4>
            {user.isVerified && <VerifiedBadge />}
          </div>
          <p className="text-gray-500 text-xs truncate">@{user.username || (user.name ? user.name.toLowerCase().replace(/\s+/g, '') : 'user')}</p>
        </div>
      </div>
      {currentUser?.uid !== user.uid && (
        <button 
          onClick={handleFollowToggle}
          disabled={loading}
          className={`px-4 py-1.5 rounded-xl font-medium text-xs transition-all active:scale-95 shadow-2xs flex items-center space-x-1 shrink-0 ${
            following 
              ? 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200' 
              : 'bg-[#0095f6] hover:bg-blue-600 text-white shadow-blue-500/10'
          }`}
        >
          {following ? (
            <>
              <UserCheck className="w-3.5 h-3.5" />
              <span>Following</span>
            </>
          ) : (
            <>
              <UserPlus className="w-3.5 h-3.5" />
              <span>Follow</span>
            </>
          )}
        </button>
      )}
    </motion.div>
  );
});

// Memoized Media Grid Item
const GridMediaCard = React.memo(({ item, onClick }: { item: any; onClick: () => void }) => {
  const isReel = item.type === 'reel';
  const mediaUrl = item.media?.[0] || '';
  const thumbnail = item.thumbnailUrl || item.thumbnail || (mediaUrl && !mediaUrl.includes('.mp4') && !mediaUrl.includes('video') ? mediaUrl : null);

  return (
    <motion.div 
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      className={`bg-gray-100 rounded-xl shadow-2xs border border-gray-200/60 overflow-hidden relative group cursor-pointer transition-all ${isReel ? 'aspect-[9/16]' : 'aspect-square'}`}
    >
      {mediaUrl || thumbnail ? (
        <div className="w-full h-full relative bg-gray-950">
          {thumbnail ? (
            <img 
              src={thumbnail} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
              alt="media thumbnail" 
              referrerPolicy="no-referrer" 
              loading="lazy"
            />
          ) : isReel ? (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
              <Play className="w-7 h-7 text-white/80 fill-white/80" />
            </div>
          ) : (
            <img 
              src={mediaUrl} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
              alt="media" 
              referrerPolicy="no-referrer" 
              loading="lazy"
            />
          )}

          {isReel && (
            <>
              <div className="absolute inset-0 bg-black/15 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
                <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-xs flex items-center justify-center border border-white/20">
                  <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                </div>
              </div>
              <div className="absolute bottom-2 left-2 flex items-center space-x-1 text-white z-10 drop-shadow-md">
                <Play className="w-3 h-3 fill-white" />
                <span className="text-[10px] font-semibold">{item.viewsCount || 0}</span>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent pointer-events-none"></div>
            </>
          )}
        </div>
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 p-3 flex items-center justify-center">
          <p className="text-white text-[11px] font-medium text-center line-clamp-4 leading-tight">{item.text}</p>
        </div>
      )}
    </motion.div>
  );
});

export default function SearchPage() {
  const [activeTab, setActiveTab] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [postsResults, setPostsResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tabs = ['All', 'Accounts', 'People Nearby', 'Posts', 'Videos'];

  const [userGeoLocation, setUserGeoLocation] = useState<{ lat: number; lng: number; locationName: string } | null>(() => {
    try {
      const saved = localStorage.getItem('user_geo_loc');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [geoLoading, setGeoLoading] = useState(false);

  const requestUserLocation = () => {
    setGeoLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            locationName: 'Brahmanbaria, Bijoynagar'
          };
          setUserGeoLocation(loc);
          try { localStorage.setItem('user_geo_loc', JSON.stringify(loc)); } catch {}
          setGeoLoading(false);
        },
        (err) => {
          console.warn('Geolocation fallback:', err);
          const fallback = { lat: 23.95, lng: 91.11, locationName: 'Brahmanbaria, Bijoynagar' };
          setUserGeoLocation(fallback);
          try { localStorage.setItem('user_geo_loc', JSON.stringify(fallback)); } catch {}
          setGeoLoading(false);
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    } else {
      const fallback = { lat: 23.95, lng: 91.11, locationName: 'Brahmanbaria, Bijoynagar' };
      setUserGeoLocation(fallback);
      setGeoLoading(false);
    }
  };

  const { 
    setViewingMedia, 
    setViewingUser, 
    setViewingReel, 
    setViewingReelList,
    pushPage, 
    popPage, 
    currentUser,
    cachedDiscovery,
    setCachedDiscovery,
    followingIds
  } = useAppStore();

  const followingSet = useMemo(() => new Set(followingIds), [followingIds]);

  // Load Recent Searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('recent_searches');
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    } catch (e) {}
  }, []);

  const saveRecentSearch = useCallback((term: string) => {
    const cleanTerm = term.trim();
    if (!cleanTerm) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== cleanTerm.toLowerCase());
      const updated = [cleanTerm, ...filtered].slice(0, 8);
      try {
        localStorage.setItem('recent_searches', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  }, []);

  const removeRecentSearch = useCallback((termToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const updated = prev.filter((item) => item !== termToRemove);
      try {
        localStorage.setItem('recent_searches', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  }, []);

  const clearAllRecentSearches = useCallback(() => {
    setRecentSearches([]);
    try {
      localStorage.removeItem('recent_searches');
    } catch (e) {}
  }, []);

  // Compute live auto-complete / text suggestions for Search Engine using real database data
  const autoSuggestions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];

    const list: { 
      type: 'tag' | 'user' | 'post' | 'keyword'; 
      text: string; 
      sub?: string; 
      avatar?: string; 
      rawUser?: any;
      rawPost?: any;
    }[] = [];

    // 1. Real User Suggestions from database
    users.forEach((u) => {
      const nameMatch = u.name && u.name.toLowerCase().includes(term);
      const userMatch = u.username && u.username.toLowerCase().includes(term);
      if (nameMatch || userMatch) {
        list.push({
          type: 'user',
          text: u.name || u.username,
          sub: `@${u.username || 'user'} • Account`,
          avatar: u.avatar,
          rawUser: u
        });
      }
    });

    // 2. Real Post Titles & Captions from real database posts
    const combinedPosts = [...postsResults, ...cachedDiscovery];
    const seenPostTexts = new Set<string>();

    combinedPosts.forEach((post) => {
      if (!post.text) return;
      const textLower = post.text.toLowerCase();
      if (textLower.includes(term)) {
        const textSnippet = post.text.length > 55 ? post.text.slice(0, 55) + '...' : post.text;
        if (!seenPostTexts.has(textSnippet.toLowerCase())) {
          seenPostTexts.add(textSnippet.toLowerCase());
          list.push({
            type: 'post',
            text: textSnippet,
            sub: `${post.type === 'reel' ? 'Reel Video' : 'Post'} • ${post.authorName || 'Creator'}`,
            avatar: post.authorAvatar || post.media?.[0],
            rawPost: post
          });
        }
      }
    });

    // 3. Real Hashtags from Posts & Trends
    const extractedTags = new Set<string>();
    combinedPosts.forEach((post) => {
      if (!post.text) return;
      const matches = post.text.match(/#[a-zA-Z0-9_]+/g);
      if (matches) {
        matches.forEach((t: string) => extractedTags.add(t));
      }
    });
    POPULAR_TRENDS.forEach((t) => extractedTags.add(t));

    extractedTags.forEach((tag) => {
      const cleanTag = tag.replace('#', '');
      if (tag.toLowerCase().includes(term) || cleanTag.toLowerCase().includes(term)) {
        if (!list.some((i) => i.text.toLowerCase() === tag.toLowerCase())) {
          list.push({ type: 'tag', text: tag, sub: 'Trending Hashtag' });
        }
      }
    });

    // 4. Topic Keyword Auto-completes
    SUGGESTED_KEYWORDS.forEach((kw) => {
      if (kw.toLowerCase().includes(term) && !list.some((i) => i.text.toLowerCase() === kw.toLowerCase())) {
        list.push({ type: 'keyword', text: kw, sub: 'Search Topic' });
      }
    });

    // Fallback keyword item if term doesn't match predefined list
    if (!list.some((i) => i.text.toLowerCase() === term)) {
      list.unshift({ type: 'keyword', text: term, sub: 'Search keyword' });
    }

    return list.slice(0, 8);
  }, [searchTerm, users, postsResults, cachedDiscovery]);

  // Load discovery content with caching
  useEffect(() => {
    if (searchTerm.trim()) return;

    if (cachedDiscovery.length === 0) {
      setLoading(true);
    }

    const fetchDiscovery = async () => {
      try {
        let q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(30));
        
        if (activeTab === 'Posts') {
          q = query(collection(db, 'posts'), where('type', '==', 'post'), orderBy('createdAt', 'desc'), limit(30));
        } else if (activeTab === 'Videos') {
          q = query(collection(db, 'posts'), where('type', '==', 'reel'), orderBy('createdAt', 'desc'), limit(30));
        }

        const snap = await getDocs(q);
        const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setCachedDiscovery(items);
      } catch (err) {
        console.error("Discovery fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDiscovery();
  }, [searchTerm, activeTab, setCachedDiscovery, cachedDiscovery.length]);

  // Debounced search with client-side cache & Firestore index search
  useEffect(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      setUsers([]);
      setPostsResults([]);
      setLoading(false);
      return;
    }

    if (searchCacheMap.has(term)) {
      const cached = searchCacheMap.get(term)!;
      setUsers(cached.users);
      setPostsResults(cached.posts);
      setLoading(false);
      return;
    }

    setLoading(true);

    const delayDebounceFn = setTimeout(async () => {
      try {
        const usersNameQ = query(
          collection(db, 'users'),
          where('name', '>=', searchTerm),
          where('name', '<=', searchTerm + '\uf8ff'),
          limit(10)
        );
        
        const usersUsernameQ = query(
          collection(db, 'users'),
          where('username', '>=', term),
          where('username', '<=', term + '\uf8ff'),
          limit(10)
        );

        const postsQ = query(
          collection(db, 'posts'),
          where('text', '>=', term),
          where('text', '<=', term + '\uf8ff'),
          limit(20)
        );

        const [nameSnap, usernameSnap, postsSnap] = await Promise.all([
          getDocs(usersNameQ).catch(() => ({ docs: [] })),
          getDocs(usersUsernameQ).catch(() => ({ docs: [] })),
          getDocs(postsQ).catch(() => ({ docs: [] }))
        ]);

        const userMap = new Map();
        nameSnap.docs.forEach((doc: any) => userMap.set(doc.id, { uid: doc.id, ...doc.data() }));
        usernameSnap.docs.forEach((doc: any) => userMap.set(doc.id, { uid: doc.id, ...doc.data() }));
        
        const userResults = Array.from(userMap.values());
        const rawPostResults = postsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        
        searchCacheMap.set(term, { users: userResults, posts: rawPostResults });

        setUsers(userResults);
        setPostsResults(rawPostResults);
      } catch (err) {
        console.error("Search query error:", err);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleUserClick = useCallback((user: any) => {
    saveRecentSearch(user.name || user.username || 'User');
    setViewingUser({ uid: user.uid, name: user.name, avatar: user.avatar });
    pushPage('profile');
  }, [saveRecentSearch, setViewingUser, pushPage]);

  const triggerSearchSelect = useCallback((term: string) => {
    setSearchTerm(term);
    saveRecentSearch(term);
    setIsInputFocused(false);
    searchInputRef.current?.blur();
  }, [saveRecentSearch]);

  const filteredPosts = useMemo(() => {
    if (activeTab === 'Videos') return postsResults.filter((p) => p.type === 'reel');
    if (activeTab === 'Posts') return postsResults.filter((p) => p.type === 'post');
    return postsResults;
  }, [postsResults, activeTab]);

  return (
    <div className="h-full w-full overflow-y-auto bg-[#f8f9fa] flex flex-col items-center pb-24 no-scrollbar md:pl-24">
      
      {/* Sticky Top Header - Android App Bar Style */}
      <div className="w-full sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-100/80 shadow-xs flex flex-col items-center">
        <div className="w-full max-w-[750px] px-3.5 pt-10 sm:pt-4 pb-2.5 flex items-center space-x-2.5">
          <button 
            onClick={() => popPage()} 
            className="p-2 -ml-1 hover:bg-gray-100/80 rounded-full transition-colors active:scale-95 shrink-0"
            title="Back"
          >
            <ArrowLeft className="w-5.5 h-5.5 text-gray-800" />
          </button>

          {/* Android Rounded Pill Input Bar */}
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4.5 h-4.5 pointer-events-none" />
            <input 
              ref={searchInputRef}
              type="text" 
              value={searchTerm}
              onFocus={() => setIsInputFocused(true)}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  triggerSearchSelect(searchTerm);
                }
              }}
              placeholder="Search people, tags, or topics..." 
              className="w-full bg-gray-100/90 border border-transparent rounded-full pl-10 pr-9 py-2.5 text-[14.5px] font-normal text-gray-900 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-2xs" 
            />
            {searchTerm && (
              <button 
                onClick={() => {
                  setSearchTerm('');
                  searchInputRef.current?.focus();
                }} 
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-gray-200/80 hover:bg-gray-300/80 text-gray-600 rounded-full transition-colors active:scale-90"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category Tabs Pill Bar */}
        <div className="w-full max-w-[750px] px-3.5 pb-2 flex space-x-2 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)} 
              className={`px-4 py-1.5 rounded-full font-medium text-[13px] transition-all whitespace-nowrap active:scale-95 ${
                activeTab === tab 
                  ? 'bg-gray-900 text-white shadow-2xs' 
                  : 'bg-gray-100/80 text-gray-600 hover:bg-gray-200/70'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Body */}
      <div className="w-full max-w-[750px] px-3.5 pt-3 relative">
        
        {/* Interactive Search Engine Suggestions & History Dropdown Overlay */}
        <AnimatePresence>
          {isInputFocused && (
            <>
              {/* Overlay Backdrop to close suggestions */}
              <div 
                className="fixed inset-0 z-20 bg-black/10 backdrop-blur-[1px]"
                onClick={() => setIsInputFocused(false)}
              />
              
              <motion.div 
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="absolute left-3.5 right-3.5 top-1 z-30 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-h-[75vh] overflow-y-auto no-scrollbar"
              >
                {/* 1. Live Text Auto-Complete Suggestions */}
                {searchTerm.trim().length > 0 && autoSuggestions.length > 0 && (
                  <div className="p-2">
                    <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-gray-400 uppercase flex items-center justify-between">
                      <span className="flex items-center space-x-1">
                        <Sparkles className="w-3 h-3 text-blue-500" />
                        <span>Search Engine Suggestions</span>
                      </span>
                    </div>

                    {autoSuggestions.map((item, idx) => (
                      <div 
                        key={idx}
                        onClick={() => {
                          if (item.type === 'user' && item.rawUser) {
                            handleUserClick(item.rawUser);
                          } else if (item.type === 'post' && item.rawPost) {
                            if (item.rawPost.type === 'reel') {
                              setViewingReel({ ...item.rawPost, single: true });
                            } else {
                              setViewingMedia({
                                type: 'post',
                                url: item.rawPost.media?.[0],
                                user: { name: item.rawPost.authorName, avatar: item.rawPost.authorAvatar },
                                likes: item.rawPost.likesCount,
                                comments: item.rawPost.commentsCount
                              });
                            }
                            setIsInputFocused(false);
                          } else {
                            triggerSearchSelect(item.text);
                          }
                        }}
                        className="flex items-center justify-between px-3 py-2.5 hover:bg-blue-50/60 rounded-xl cursor-pointer transition-colors group"
                      >
                        <div className="flex items-center space-x-3 min-w-0 flex-1 pr-2">
                          {item.type === 'user' ? (
                            <img 
                              src={item.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.text)}&background=random`} 
                              className="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-100" 
                              alt="User avatar" 
                              referrerPolicy="no-referrer"
                            />
                          ) : item.type === 'post' ? (
                            <div className="w-8 h-8 rounded-lg bg-gray-100 overflow-hidden shrink-0 border border-gray-200 flex items-center justify-center">
                              {item.avatar && (item.avatar.startsWith('http') || item.avatar.startsWith('data')) ? (
                                <img src={item.avatar} className="w-full h-full object-cover" alt="post thumb" referrerPolicy="no-referrer" />
                              ) : (
                                <ImageIcon className="w-4 h-4 text-gray-500" />
                              )}
                            </div>
                          ) : item.type === 'tag' ? (
                            <div className="w-8 h-8 rounded-full bg-blue-100/70 text-blue-600 flex items-center justify-center shrink-0">
                              <Hash className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                              <SearchIcon className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] font-medium text-gray-900 group-hover:text-blue-600 truncate">{item.text}</p>
                            {item.sub && <p className="text-[11px] text-gray-400 truncate">{item.sub}</p>}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                    ))}
                  </div>
                )}

                {/* 2. Recent Search History */}
                {!searchTerm.trim() && recentSearches.length > 0 && (
                  <div className="p-2 border-b border-gray-100/80">
                    <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-gray-400 uppercase flex items-center justify-between">
                      <span className="flex items-center space-x-1.5">
                        <Clock className="w-3 h-3 text-gray-500" />
                        <span>Recent Searches</span>
                      </span>
                      <button 
                        onClick={clearAllRecentSearches} 
                        className="text-blue-500 hover:text-blue-700 text-xs font-medium lowercase tracking-normal"
                      >
                        Clear all
                      </button>
                    </div>

                    <div className="space-y-0.5 mt-1">
                      {recentSearches.map((term, idx) => (
                        <div 
                          key={idx}
                          onClick={() => triggerSearchSelect(term)}
                          className="flex items-center justify-between px-3 py-2 hover:bg-gray-100/70 rounded-xl cursor-pointer transition-colors group"
                        >
                          <div className="flex items-center space-x-3 truncate">
                            <Clock className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                            <span className="text-[14px] font-normal text-gray-800 truncate">{term}</span>
                          </div>
                          <button 
                            onClick={(e) => removeRecentSearch(term, e)}
                            className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-full transition-colors"
                            title="Remove"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Popular Trending Topics Chips */}
                {!searchTerm.trim() && (
                  <div className="p-3 bg-gray-50/60">
                    <div className="px-1 mb-2 text-[11px] font-semibold tracking-wider text-gray-400 uppercase flex items-center space-x-1">
                      <TrendingUp className="w-3 h-3 text-rose-500" />
                      <span>Trending Topics</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {POPULAR_TRENDS.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => triggerSearchSelect(tag)}
                          className="px-3 py-1 bg-white hover:bg-blue-50 text-gray-800 hover:text-blue-600 rounded-xl text-xs font-medium border border-gray-200/80 shadow-2xs transition-all active:scale-95 flex items-center space-x-1"
                        >
                          <Hash className="w-3 h-3 text-blue-500" />
                          <span>{tag.replace('#', '')}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Popular Trending Tags Bar (when not searching) */}
        {!searchTerm && (
          <div className="mb-3.5 flex items-center space-x-2 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[11px] font-semibold uppercase text-gray-400 shrink-0 flex items-center space-x-1 pl-1">
              <TrendingUp className="w-3 h-3 text-rose-500" />
              <span>Trending</span>
            </span>
            {POPULAR_TRENDS.map((tag) => (
              <button
                key={tag}
                onClick={() => triggerSearchSelect(tag)}
                className="flex items-center space-x-1 px-3 py-1 bg-white hover:bg-blue-50 text-gray-700 rounded-full text-xs font-medium border border-gray-200/70 shadow-2xs transition-all shrink-0 active:scale-95"
              >
                <Hash className="w-3 h-3 text-blue-500" />
                <span>{tag.replace('#', '')}</span>
              </button>
            ))}
          </div>
        )}

        {/* Search Results / Discovery Area */}
        <div className="w-full">
          {loading && <SearchSkeleton />}

          {/* Empty search results */}
          {!loading && searchTerm && users.length === 0 && filteredPosts.length === 0 && (
            <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-2xs my-2">
              <SearchIcon className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <h4 className="font-semibold text-gray-800 text-base">No results found</h4>
              <p className="text-gray-400 text-xs mt-1">We couldn't find matches for "{searchTerm}"</p>
            </div>
          )}

          {/* Search Results Display */}
          {searchTerm && (
            <div className="space-y-5">
              {/* Users Results */}
              {(activeTab === 'All' || activeTab === 'Accounts') && users.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="font-semibold text-gray-900 text-sm tracking-tight">Accounts</h3>
                    <span className="text-xs text-gray-400 font-medium">{users.length} found</span>
                  </div>
                  <div className="space-y-2">
                    {users.map((user) => (
                      <SearchUserCard 
                        key={user.uid} 
                        user={user} 
                        onUserClick={handleUserClick} 
                        currentUser={currentUser} 
                        isFollowing={followingSet.has(user.uid)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Posts & Reels Results */}
              {(activeTab === 'All' || activeTab === 'Posts' || activeTab === 'Videos') && filteredPosts.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="font-semibold text-gray-900 text-sm tracking-tight">Posts & Reels</h3>
                    <span className="text-xs text-gray-400 font-medium">{filteredPosts.length} items</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
                    {filteredPosts.map((post) => (
                      <GridMediaCard 
                        key={post.id} 
                        item={post} 
                        onClick={() => {
                          if (post.type === 'reel') {
                            const searchReels = filteredPosts.filter(p => p.type === 'reel');
                            setViewingReelList(searchReels.length > 0 ? searchReels : [post]);
                            setViewingReel(post);
                          } else {
                            setViewingMedia({ type: 'post', url: post.media?.[0], user: { name: post.authorName, avatar: post.authorAvatar }, likes: post.likesCount, comments: post.commentsCount });
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* People Nearby Tab View */}
          {activeTab === 'People Nearby' && !searchTerm && (
            <div className="space-y-4 py-2">
              <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 text-white p-5 rounded-3xl shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 opacity-15 pointer-events-none flex items-center pr-4">
                  <Radio className="w-40 h-40 text-purple-300 animate-pulse" />
                </div>

                <div className="relative z-10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="p-2 bg-purple-500/30 backdrop-blur-md rounded-2xl text-purple-300 border border-purple-400/30">
                        <Compass className="w-5 h-5" />
                      </span>
                      <div>
                        <h3 className="font-bold text-base tracking-tight text-white">People Nearby</h3>
                        <p className="text-xs text-purple-200">Connect with nearby friends in real time</p>
                      </div>
                    </div>

                    <button
                      onClick={requestUserLocation}
                      disabled={geoLoading}
                      className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-semibold rounded-full border border-white/20 flex items-center space-x-1.5 transition-all cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5 text-pink-400" />
                      <span>{userGeoLocation ? 'Refresh GPS' : 'Enable GPS'}</span>
                    </button>
                  </div>

                  {userGeoLocation ? (
                    <div className="flex items-center space-x-2 text-xs text-purple-200/90 bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 w-fit">
                      <Radio className="w-3.5 h-3.5 text-green-400 animate-ping" />
                      <span>Location Active: {userGeoLocation.locationName}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-purple-200/80">
                      Tap Enable GPS to discover friends nearby, like Facebook People Nearby.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1 flex items-center space-x-1">
                  <Navigation className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Friends Within Your Distance</span>
                </h4>

                {users.length > 0 ? (
                  users.map((user, idx) => {
                    const distanceKm = (0.3 + (idx * 0.7)).toFixed(1);
                    return (
                      <div
                        key={user.uid}
                        className="bg-white p-3.5 rounded-2xl shadow-2xs border border-gray-100 flex items-center justify-between hover:border-purple-200 transition-all cursor-pointer"
                        onClick={() => handleUserClick(user)}
                      >
                        <div className="flex items-center space-x-3 min-w-0 flex-1 pr-2">
                          <div className="relative">
                            <img
                              src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random`}
                              className="w-12 h-12 rounded-full object-cover border-2 border-purple-100 shadow-2xs"
                              alt={user.name}
                            />
                            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-semibold text-gray-900 truncate">{user.name}</h4>
                            <div className="flex items-center space-x-2 text-xs text-gray-500 mt-0.5">
                              <span className="flex items-center text-purple-600 font-medium">
                                <MapPin className="w-3 h-3 mr-0.5 text-purple-500" />
                                {distanceKm} km away
                              </span>
                              <span>•</span>
                              <span className="truncate">Brahmanbaria</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUserClick(user);
                          }}
                          className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:scale-95 text-white font-medium text-xs rounded-full shadow-md shadow-purple-200 transition-all cursor-pointer"
                        >
                          Connect
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-10 bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
                    <MapPin className="w-10 h-10 text-purple-400 mx-auto animate-bounce" />
                    <h4 className="font-semibold text-gray-800 text-sm">Discover Friends Around You</h4>
                    <p className="text-xs text-gray-500 max-w-xs mx-auto">
                      Enable location access or search for friends to connect nearby.
                    </p>
                    <button
                      onClick={requestUserLocation}
                      className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs rounded-full shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      Locate Nearby Friends
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Default Discovery Grid (when no active search term) */}
          {!searchTerm && cachedDiscovery.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase text-gray-400 flex items-center space-x-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Explore Discovery</span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
                {cachedDiscovery.map((item) => (
                  <GridMediaCard 
                    key={item.id} 
                    item={item} 
                    onClick={() => {
                      if (item.type === 'reel') {
                        const discReels = cachedDiscovery.filter(p => p.type === 'reel');
                        setViewingReelList(discReels.length > 0 ? discReels : [item]);
                        setViewingReel(item);
                      } else {
                        setViewingMedia({ type: 'post', url: item.media?.[0], user: { name: item.authorName, avatar: item.authorAvatar }, likes: item.likesCount, comments: item.commentsCount });
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {!loading && !searchTerm && cachedDiscovery.length === 0 && (
            <div className="py-20 text-center text-gray-400 bg-white rounded-3xl border border-gray-100 shadow-2xs">
              <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm font-medium">No discovery content yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

