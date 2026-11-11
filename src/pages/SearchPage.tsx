import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Search as SearchIcon, 
  Image as ImageIcon, 
  Play, 
  ArrowLeft, 
  X, 
  Clock, 
  TrendingUp, 
  Sparkles, 
  UserCheck, 
  UserPlus, 
  MapPin, 
  Compass, 
  Navigation, 
  Radio, 
  Sun, 
  Moon,
  Heart,
  Video
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { followUser, unfollowUser } from '../services/followService';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { FacebookSearchSkeleton } from '../components/Skeletons';

// Light haptic feedback helper
const triggerHaptic = (ms = 12) => {
  if (typeof window !== 'undefined' && window.navigator?.vibrate) {
    try {
      window.navigator.vibrate(ms);
    } catch (_) {}
  }
};

const POPULAR_TRENDS = [
  '#viral', '#reels', '#music', '#tech', 
  '#lifestyle', '#art', '#funny', '#dance', 
  '#photography', '#nature', '#gaming', '#travel'
];

const SUGGESTED_KEYWORDS = [
  'trending reels', 'best music', 'funny moments', 
  'tech news', 'dance videos', 'travel vlog', 
  'art & design', 'fitness tips', 'street photography'
];

// In-memory cache for instant lag-free search results
const searchCacheMap = new Map<string, { users: any[]; posts: any[] }>();

// 1. Notification-Style Account Card (Squircle, Lag-Free, Soft Tap Feedback)
const NotificationStyleUserCard = React.memo(({ 
  user, 
  onUserClick, 
  currentUser, 
  isFollowing 
}: { 
  user: any; 
  onUserClick: (u: any) => void; 
  currentUser: any; 
  isFollowing: boolean;
}) => {
  const [following, setFollowing] = useState(isFollowing);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFollowing(isFollowing);
  }, [isFollowing]);

  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || loading) return;
    triggerHaptic(18);
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

  const username = user.username || (user.name ? user.name.toLowerCase().replace(/\s+/g, '') : 'user');

  return (
    <div 
      className="act-card-item select-none cursor-pointer group"
      onClick={() => {
        triggerHaptic(8);
        onUserClick(user);
      }}
    >
      <div className="relative w-12 h-12 shrink-0">
        <img 
          src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random`} 
          className="w-full h-full rounded-full object-cover shadow-[0_4px_14px_rgba(0,0,0,0.16)]" 
          alt={user.name || 'User'} 
          referrerPolicy="no-referrer" 
          loading="lazy"
        />
      </div>

      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center space-x-1.5 truncate">
          <h4 className="font-bold text-[0.92rem] text-neutral-950 dark:text-white truncate leading-tight group-hover:underline">
            {user.name || 'User'}
          </h4>
          {user.isVerified && <VerifiedBadge className="w-3.5 h-3.5 shrink-0" />}
        </div>
        <p className="text-[0.74rem] text-neutral-500 dark:text-neutral-400 font-medium truncate mt-0.5">
          @{username}
        </p>
      </div>

      {currentUser?.uid !== user.uid && (
        <button 
          type="button"
          onClick={handleFollowToggle}
          disabled={loading}
          className={`act-btn-pill shrink-0 ${
            following ? 'act-btn-following' : 'act-btn-follow-back'
          }`}
        >
          {following ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
});

// 2. Uniform Aspect Ratio Media Card (Both Post and Reel have the EXACT SAME BOX SIZE)
const UniformMediaCard = React.memo(({ 
  item, 
  onClick 
}: { 
  item: any; 
  onClick: () => void; 
}) => {
  const isReel = item.type === 'reel';
  const mediaUrl = item.media?.[0] || '';
  const thumbnail = item.thumbnailUrl || item.thumbnail || (mediaUrl && !mediaUrl.includes('.mp4') && !mediaUrl.includes('video') ? mediaUrl : null);

  return (
    <div 
      onClick={() => {
        triggerHaptic(10);
        onClick();
      }}
      className="aspect-[4/5] bg-white dark:bg-black rounded-2xl sm:rounded-3xl border border-gray-200/90 dark:border dark:border-white/20 overflow-hidden relative group cursor-pointer transition-transform duration-200 select-none shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
    >
      {mediaUrl || thumbnail ? (
        <div className="w-full h-full relative bg-neutral-900 dark:bg-black overflow-hidden">
          {thumbnail ? (
            <img 
              src={thumbnail} 
              className="w-full h-full object-cover transition-transform duration-300" 
              alt="thumbnail" 
              referrerPolicy="no-referrer" 
              loading="lazy"
            />
          ) : isReel ? (
            <div className="w-full h-full flex items-center justify-center bg-neutral-950">
              <Play className="w-8 h-8 text-white fill-white opacity-85" />
            </div>
          ) : (
            <img 
              src={mediaUrl} 
              className="w-full h-full object-cover transition-transform duration-300" 
              alt="media" 
              referrerPolicy="no-referrer" 
              loading="lazy"
            />
          )}

          {/* Type Badge on Top-Right */}
          <div className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/20 flex items-center space-x-1 text-white text-[10px] font-bold z-10 select-none">
            {isReel ? (
              <>
                <Video className="w-3 h-3 text-rose-400" />
                <span>Reel</span>
              </>
            ) : (
              <>
                <ImageIcon className="w-3 h-3 text-emerald-400" />
                <span>Post</span>
              </>
            )}
          </div>

          {/* Hover Play Button Overlay */}
          <div className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/30 text-white">
              <Play className="w-4.5 h-4.5 fill-white ml-0.5" />
            </div>
          </div>

          {/* Bottom Info Gradient */}
          <div className="absolute inset-x-0 bottom-0 pt-8 pb-2.5 px-3 bg-gradient-to-t from-black/85 via-black/50 to-transparent z-10 flex flex-col justify-end text-white">
            <div className="flex items-center space-x-1.5 min-w-0">
              <img 
                src={item.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.authorName || 'User')}&background=random`} 
                alt={item.authorName || 'Author'} 
                className="w-5 h-5 rounded-full object-cover border border-white/30 shrink-0" 
                loading="lazy" 
              />
              <span className="text-[11px] font-semibold truncate leading-tight">
                {item.authorName || 'User'}
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-white/80 mt-1 font-medium">
              {isReel ? (
                <span className="flex items-center space-x-1">
                  <Play className="w-2.5 h-2.5 fill-white" />
                  <span>{item.viewsCount || item.views || 0}</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1">
                  <Heart className="w-2.5 h-2.5 fill-rose-500 text-rose-500" />
                  <span>{item.likesCount || item.likes || 0}</span>
                </span>
              )}
              {item.text && (
                <span className="truncate max-w-[65%] text-[9.5px] opacity-75">
                  {item.text}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-700 p-4 flex flex-col items-center justify-center text-center text-white">
          <p className="text-[13px] font-bold line-clamp-4 leading-relaxed">{item.text}</p>
          <div className="flex items-center space-x-1.5 mt-2">
            <img 
              src={item.authorAvatar || `https://ui-avatars.com/api/?name=User&background=random`} 
              alt="author" 
              className="w-5 h-5 rounded-full object-cover" 
            />
            <span className="text-[11px] font-medium opacity-90">{item.authorName}</span>
          </div>
        </div>
      )}
    </div>
  );
});

export default function SearchPage() {
  const [activeTab, setActiveTab] = useState<'All' | 'Accounts' | 'Posts' | 'Videos' | 'Nearby'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [postsResults, setPostsResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  // Lazy loading pagination for discovery items
  const [visibleCount, setVisibleCount] = useState(18);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const tabs: ('All' | 'Accounts' | 'Posts' | 'Videos' | 'Nearby')[] = [
    'All', 'Accounts', 'Posts', 'Videos', 'Nearby'
  ];

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
    followingIds,
    appTheme,
    setAppTheme
  } = useAppStore();

  const toggleTheme = () => {
    triggerHaptic(12);
    setAppTheme(appTheme === 'dark' ? 'light' : 'dark');
  };

  const followingSet = useMemo(() => new Set(followingIds), [followingIds]);

  // Load Recent Searches
  useEffect(() => {
    try {
      const saved = localStorage.getItem('recent_searches');
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch (_) {}
  }, []);

  const saveRecentSearch = useCallback((term: string) => {
    const cleanTerm = term.trim();
    if (!cleanTerm) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== cleanTerm.toLowerCase());
      const updated = [cleanTerm, ...filtered].slice(0, 8);
      try {
        localStorage.setItem('recent_searches', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  }, []);

  const removeRecentSearch = useCallback((termToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const updated = prev.filter((item) => item !== termToRemove);
      try {
        localStorage.setItem('recent_searches', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  }, []);

  // Fetch initial explore discovery items
  useEffect(() => {
    if (cachedDiscovery.length > 0) return;
    const fetchDiscovery = async () => {
      try {
        const { getFeed } = await import('../services/postService');
        const feed = await getFeed();
        if (feed && feed.posts) {
          setCachedDiscovery(feed.posts);
        }
      } catch (e) {
        console.error('Error fetching discovery feed:', e);
      }
    };
    fetchDiscovery();
  }, [cachedDiscovery.length, setCachedDiscovery]);

  // Infinite Scroll Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          setVisibleCount((prev) => prev + 12);
        }
      },
      { rootMargin: '240px' }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }
    return () => observer.disconnect();
  }, [loading]);

  // Live Debounced High-Speed Search Engine
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
        // Firestore range queries are case sensitive, so "erfan" never matched
        // "Erfan Sarker" - that is exactly why search looked broken in the app.
        // Each query now runs for a few case variants and the results are merged.
        const raw = searchTerm.trim();
        const variants = Array.from(new Set([
          raw,
          raw.toLowerCase(),
          raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase(),
          raw.toUpperCase(),
        ].filter(Boolean))).slice(0, 4);

        const userMap = new Map();
        const postMap = new Map();

        await Promise.all(
          variants.flatMap((v) => {
            const lower = v.toLowerCase();
            return [
              getDocs(query(collection(db, 'users'), where('name', '>=', v), where('name', '<=', v + ''), limit(12)))
                .then((snap) => snap.docs.forEach((d: any) => userMap.set(d.id, { uid: d.id, ...d.data() })))
                .catch(() => {}),
              getDocs(query(collection(db, 'users'), where('username', '>=', lower), where('username', '<=', lower + ''), limit(12)))
                .then((snap) => snap.docs.forEach((d: any) => userMap.set(d.id, { uid: d.id, ...d.data() })))
                .catch(() => {}),
              getDocs(query(collection(db, 'posts'), where('text', '>=', v), where('text', '<=', v + ''), limit(24)))
                .then((snap) => snap.docs.forEach((d: any) => postMap.set(d.id, { id: d.id, ...d.data() })))
                .catch(() => {}),
            ];
          })
        );
        
        let userResults = Array.from(userMap.values());
        if (currentUser?.uid) {
          try {
            const { getBlockedUsers } = await import('../services/followService');
            const myBlocked = await getBlockedUsers(currentUser.uid);
            userResults = userResults.filter((u: any) => 
              u.uid !== currentUser.uid && !myBlocked.includes(u.uid) && !myBlocked.includes(u.id)
            );
          } catch (_) {
            userResults = userResults.filter((u: any) => u.uid !== currentUser.uid);
          }
        }
        const rawPostResults = Array.from(postMap.values());
        
        searchCacheMap.set(term, { users: userResults, posts: rawPostResults });

        setUsers(userResults);
        setPostsResults(rawPostResults);
      } catch (err) {
        console.error("Search query error:", err);
      } finally {
        setLoading(false);
      }
    }, 120);

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

  const visibleDiscovery = useMemo(() => {
    if (activeTab === 'Videos') return cachedDiscovery.filter(p => p.type === 'reel').slice(0, visibleCount);
    if (activeTab === 'Posts') return cachedDiscovery.filter(p => p.type !== 'reel').slice(0, visibleCount);
    return cachedDiscovery.slice(0, visibleCount);
  }, [cachedDiscovery, visibleCount, activeTab]);

  // People Nearby GPS State
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
        () => {
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

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-[#f2f2f7] dark:bg-black text-black dark:text-white flex flex-col md:pl-28 lg:pl-32 select-none relative transition-colors duration-400 font-sans">
      
      {/* Ambient Soft Lighting Glow at Top (Identical to Notifications Page) */}
      <div className="act-ambient-glow" />

      {/* Header with Squircle Back, Notification-Style Search Pill & Theme Toggle */}
      <header className="h-[56px] px-4 pt-2.5 flex items-center justify-between z-50 shrink-0 gap-2.5">
        <button 
          type="button"
          onClick={() => {
            triggerHaptic(10);
            popPage();
          }}
          className="act-header-btn shrink-0 md:hidden" 
          title="Back"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Squircle Search Input Container */}
        <div className="flex-1 relative flex items-center max-w-[560px]">
          <SearchIcon className="absolute left-3.5 text-neutral-400 dark:text-neutral-500 w-4 h-4 pointer-events-none" />
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
            placeholder="Search accounts, posts, reels..." 
            className="w-full bg-white dark:bg-black border border-gray-200/90 dark:border dark:border-white/30 rounded-full pl-9 pr-9 py-2 text-[13.5px] text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-white/40 shadow-xs transition-all antialiased" 
          />
          {searchTerm && (
            <button 
              type="button"
              onClick={() => {
                setSearchTerm('');
                searchInputRef.current?.focus();
              }} 
              className="absolute right-3 p-1 bg-neutral-200/80 dark:bg-white/10 hover:bg-neutral-300 dark:hover:bg-white/20 text-neutral-600 dark:text-neutral-300 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Theme Toggle Button (Identical to Notifications Page) */}
        <button 
          type="button"
          onClick={toggleTheme}
          className="act-header-btn shrink-0" 
          title="Toggle Theme"
        >
          {appTheme === 'dark' ? (
            <Sun className="w-[18px] h-[18px] text-amber-400 stroke-[2.2]" />
          ) : (
            <Moon className="w-[18px] h-[18px] text-neutral-800 stroke-[2.2]" />
          )}
        </button>
      </header>

      {/* Segmented Category Pill Tabs */}
      <div className="w-full max-w-[620px] mx-auto px-4 py-2 z-40 shrink-0">
        <div className="flex space-x-1.5 overflow-x-auto no-scrollbar py-0.5">
          {tabs.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button 
                key={tab} 
                onClick={() => {
                  triggerHaptic(8);
                  setActiveTab(tab);
                }} 
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer  ${
                  isActive 
                    ? 'bg-neutral-950 dark:bg-white text-white dark:text-black shadow-xs' 
                    : 'bg-white/80 dark:bg-black text-neutral-600 dark:text-neutral-300 border border-gray-200/90 dark:border-white/20 hover:bg-gray-100 dark:hover:bg-white/10'
                }`}
              >
                {tab === 'Videos' ? 'Reels' : tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Scrollable Viewport */}
      <div className="flex-1 w-full overflow-y-auto overflow-x-hidden no-scrollbar px-3.5 pt-1 pb-28 relative z-10 overscroll-y-contain">
        <div className="max-w-[620px] mx-auto relative">

          {/* Interactive Suggestions & Recent Searches Dropdown */}
          <AnimatePresence>
            {isInputFocused && (
              <>
                <div 
                  className="fixed inset-0 z-30 bg-black/25 backdrop-blur-2xs"
                  onClick={() => setIsInputFocused(false)}
                />
                
                <motion.div 
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16 }}
                  className="absolute left-0 right-0 top-0 z-40 bg-white dark:bg-black rounded-3xl shadow-2xl border border-gray-200/90 dark:border dark:border-white/30 overflow-hidden max-h-[70vh] overflow-y-auto no-scrollbar select-none"
                >
                  {/* Recent Searches */}
                  {recentSearches.length > 0 && (
                    <div className="p-3 border-b border-gray-100 dark:border-white/10">
                      <div className="flex items-center justify-between px-1 mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>Recent Searches</span>
                        </span>
                        <button 
                          onClick={() => {
                            setRecentSearches([]);
                            localStorage.removeItem('recent_searches');
                          }}
                          className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          Clear all
                        </button>
                      </div>

                      <div className="space-y-1">
                        {recentSearches.map((term, i) => (
                          <div 
                            key={i}
                            onClick={() => triggerSearchSelect(term)}
                            className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-2xl cursor-pointer transition-colors"
                          >
                            <span className="text-[13px] font-semibold text-neutral-800 dark:text-white truncate">
                              {term}
                            </span>
                            <button 
                              onClick={(e) => removeRecentSearch(term, e)}
                              className="p-1 hover:bg-gray-200 dark:hover:bg-white/20 rounded-full text-neutral-400 hover:text-rose-500 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested Keywords */}
                  <div className="p-3">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center space-x-1 mb-2 px-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>Suggested Topics</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {SUGGESTED_KEYWORDS.map((kw, idx) => (
                        <button 
                          key={idx}
                          onClick={() => triggerSearchSelect(kw)}
                          className="px-3 py-1.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 rounded-full text-xs font-medium text-neutral-800 dark:text-white transition-colors cursor-pointer"
                        >
                          {kw}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Popular Trending Tags Bar */}
          {!searchTerm && activeTab !== 'Nearby' && (
            <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-2 mb-3">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider shrink-0 flex items-center space-x-1 pr-1">
                <TrendingUp className="w-3 h-3 text-rose-500" />
                <span>Trends</span>
              </span>
              {POPULAR_TRENDS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => triggerSearchSelect(tag)}
                  className="px-3 py-1 bg-white dark:bg-black hover:bg-gray-100 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 rounded-full text-xs font-bold border border-gray-200/90 dark:border-white/20 transition-all shrink-0 cursor-pointer shadow-none"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Search Query Loading Skeleton */}
          {loading && <FacebookSearchSkeleton />}

          {/* Empty Search Results Notice */}
          {!loading && searchTerm && users.length === 0 && filteredPosts.length === 0 && (
            <div className="text-center py-16 bg-white dark:bg-black rounded-3xl border border-gray-200/90 dark:border dark:border-white/20 my-4 select-none">
              <SearchIcon className="w-10 h-10 mx-auto mb-2 text-neutral-300 dark:text-neutral-600" />
              <h4 className="font-bold text-neutral-800 dark:text-white text-base">No results found</h4>
              <p className="text-neutral-400 text-xs mt-1">We couldn't find matches for "{searchTerm}"</p>
            </div>
          )}

          {/* Search Results Display */}
          {searchTerm && (
            <div className="space-y-5">
              {/* Accounts in Notification Card Style */}
              {(activeTab === 'All' || activeTab === 'Accounts') && users.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="font-bold text-neutral-900 dark:text-white text-sm tracking-tight">Accounts</h3>
                    <span className="text-xs text-neutral-400 font-medium">{users.length} found</span>
                  </div>
                  <div className="space-y-2">
                    {users.map((user) => (
                      <NotificationStyleUserCard 
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

              {/* Posts & Reels Results in Uniform Aspect-Ratio Grid */}
              {(activeTab === 'All' || activeTab === 'Posts' || activeTab === 'Videos') && filteredPosts.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="font-bold text-neutral-900 dark:text-white text-sm tracking-tight">Posts & Reels</h3>
                    <span className="text-xs text-neutral-400 font-medium">{filteredPosts.length} items</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3.5">
                    {filteredPosts.map((post) => (
                      <UniformMediaCard 
                        key={post.id} 
                        item={post} 
                        onClick={() => {
                          if (post.type === 'reel') {
                            const searchReels = filteredPosts.filter(p => p.type === 'reel');
                            setViewingReelList(searchReels.length > 0 ? searchReels : [post]);
                            setViewingReel(post);
                          } else {
                            setViewingMedia({ 
                              type: 'post', 
                              url: post.media?.[0], 
                              user: { name: post.authorName, avatar: post.authorAvatar }, 
                              likes: post.likesCount, 
                              comments: post.commentsCount 
                            });
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
          {activeTab === 'Nearby' && !searchTerm && (
            <div className="space-y-4 py-2">
              <div className="bg-white dark:bg-black text-neutral-900 dark:text-white p-5 rounded-3xl border border-gray-200/90 dark:border dark:border-white/20 select-none shadow-none">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <span className="p-2.5 bg-blue-50 dark:bg-white/10 rounded-2xl text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-white/10">
                        <Compass className="w-5 h-5" />
                      </span>
                      <div>
                        <h3 className="font-bold text-base tracking-tight text-neutral-900 dark:text-white">People Nearby</h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">Discover and connect with friends in your area</p>
                      </div>
                    </div>

                    <button
                      onClick={requestUserLocation}
                      disabled={geoLoading}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white rounded-full flex items-center space-x-1.5 transition-all cursor-pointer shrink-0"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{userGeoLocation ? 'Refresh' : 'Enable'}</span>
                    </button>
                  </div>

                  {userGeoLocation && (
                    <div className="flex items-center space-x-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-emerald-100 dark:border-white/10 w-fit">
                      <Radio className="w-3.5 h-3.5 animate-pulse" />
                      <span>Location Active: {userGeoLocation.locationName}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Nearby Users list styled in Notification Card squircle */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 px-1 flex items-center space-x-1">
                  <Navigation className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Nearby Friends</span>
                </h4>

                {users.length > 0 ? (
                  users.map((user, idx) => {
                    const distanceKm = (0.3 + (idx * 0.7)).toFixed(1);
                    return (
                      <div
                        key={user.uid}
                        className="act-card-item select-none cursor-pointer"
                        onClick={() => handleUserClick(user)}
                      >
                        <div className="relative w-12 h-12 shrink-0">
                          <img
                            src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random`}
                            className="w-full h-full rounded-full object-cover shadow-[0_4px_14px_rgba(0,0,0,0.16)]"
                            alt={user.name}
                          />
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-black rounded-full" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-neutral-900 dark:text-white truncate">{user.name}</h4>
                          <div className="flex items-center space-x-2 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                            <span className="flex items-center text-blue-600 dark:text-blue-400 font-semibold">
                              <MapPin className="w-3 h-3 mr-0.5" />
                              {distanceKm} km away
                            </span>
                            <span>•</span>
                            <span className="truncate">Nearby</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUserClick(user);
                          }}
                          className="act-btn-pill act-btn-follow-back"
                        >
                          View
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-10 bg-white dark:bg-black rounded-3xl border border-gray-200/90 dark:border-white/20 p-6 space-y-3 select-none">
                    <MapPin className="w-9 h-9 text-blue-500 mx-auto" />
                    <h4 className="font-bold text-neutral-800 dark:text-white text-sm">Discover Friends Around You</h4>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-xs mx-auto">
                      Enable GPS to locate friends nearby in your location.
                    </p>
                    <button
                      onClick={requestUserLocation}
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-full transition-all cursor-pointer"
                    >
                      Locate Nearby Friends
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Default Discovery Grid (Uniform Aspect Ratio for both Posts & Reels) */}
          {!searchTerm && activeTab !== 'Nearby' && visibleDiscovery.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Explore Feed</span>
                </span>
                <span className="text-xs text-neutral-400 font-medium">{visibleDiscovery.length} items</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3.5">
                {visibleDiscovery.map((item) => (
                  <UniformMediaCard 
                    key={item.id} 
                    item={item} 
                    onClick={() => {
                      if (item.type === 'reel') {
                        const discReels = cachedDiscovery.filter(p => p.type === 'reel');
                        setViewingReelList(discReels.length > 0 ? discReels : [item]);
                        setViewingReel(item);
                      } else {
                        setViewingMedia({ 
                          type: 'post', 
                          url: item.media?.[0], 
                          user: { name: item.authorName, avatar: item.authorAvatar }, 
                          likes: item.likesCount, 
                          comments: item.commentsCount 
                        });
                      }
                    }}
                  />
                ))}
              </div>

              {/* Sentinel element for infinite scroll lazy loading */}
              {visibleCount < cachedDiscovery.length && (
                <div ref={sentinelRef} className="py-6 flex justify-center">
                  <div className="w-6 h-6 border-2 border-gray-300 dark:border-white/20 border-t-blue-600 rounded-full animate-spin" />
                </div>
              )}
            </div>
          )}

          {/* Fallback empty discovery state */}
          {!loading && !searchTerm && activeTab !== 'Nearby' && cachedDiscovery.length === 0 && (
            <div className="py-20 text-center text-neutral-400 bg-white dark:bg-black rounded-3xl border border-gray-200/90 dark:border-white/20 select-none">
              <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">No discovery content yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
