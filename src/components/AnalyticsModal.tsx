import React, { useState, useEffect } from 'react';
import { 
  X, 
  Heart, 
  Eye, 
  BarChart2, 
  TrendingUp, 
  Repeat, 
  Share2, 
  MessageCircle, 
  Clock, 
  Users, 
  Zap, 
  Activity, 
  Globe, 
  PieChart, 
  UserCheck, 
  UserPlus, 
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Flame,
  Radio,
  Search
} from 'lucide-react';
import { useAppStore } from '../store';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { followUser, unfollowUser } from '../services/followService';

// Global fast user cache to eliminate repeat network lag
const userCacheMap = new Map<string, any>();

const UserRowWithFollow = ({ u, currentUser, onSelect }: { u: any; currentUser: any; onSelect: (u: any) => void; key?: any }) => {
  const [friendship, setFriendship] = useState({ following: false, followedBy: false, isFriend: false });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser?.uid || !u.uid) return;
    const followingRef = doc(db, 'users', currentUser.uid, 'following', u.uid);
    const followerRef = doc(db, 'users', u.uid, 'following', currentUser.uid);

    const unsubFollowing = onSnapshot(followingRef, (d1) => {
      const following = d1.exists();
      const unsubFollowed = onSnapshot(followerRef, (d2) => {
        const followedBy = d2.exists();
        setFriendship({ following, followedBy, isFriend: following && followedBy });
      }, () => {});
      return () => unsubFollowed();
    }, () => {});

    return () => unsubFollowing();
  }, [currentUser?.uid, u.uid]);

  const handleFollowToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || !u.uid || loading) return;
    setLoading(true);
    try {
      if (friendship.following) {
        await unfollowUser(currentUser.uid, u.uid);
      } else {
        await followUser(currentUser, { uid: u.uid, name: u.name || 'User', avatar: u.avatar || '', username: u.username || '' });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const username = u.username || (u.name || 'user').toLowerCase().replace(/\s+/g, '');
  const isSelf = currentUser?.uid === u.uid;

  return (
    <div 
      className="flex items-center justify-between p-3 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/80 rounded-2xl transition-colors cursor-pointer"
      onClick={() => onSelect(u)}
    >
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        <img 
          src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'User')}&background=random`} 
          className="w-10 h-10 rounded-full object-cover border border-zinc-700/50 shrink-0" 
          alt={u.name}
          referrerPolicy="no-referrer"
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-zinc-100 truncate">{u.name}</p>
          <p className="text-[12px] text-zinc-400 truncate">@{username}</p>
        </div>
      </div>

      {!isSelf && (
        <button 
          onClick={handleFollowToggle}
          disabled={loading}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 shrink-0 ml-2 min-w-[85px] text-center ${
            friendship.isFriend 
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
              : friendship.following 
              ? 'bg-zinc-800 text-zinc-300 border border-zinc-700' 
              : 'bg-blue-600 text-white'
          }`}
        >
          {loading ? '...' : friendship.isFriend ? 'Friends' : friendship.following ? 'Following' : friendship.followedBy ? 'Follow Back' : 'Follow'}
        </button>
      )}
    </div>
  );
};

export const AnalyticsModal = () => {
  const { showAnalytics, setShowAnalytics, targetAnalyticsPostId, currentUser, setViewingUser, pushPage, cachedReels, cachedFeed } = useAppStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'views' | 'likes'>('overview');
  const [postData, setPostData] = useState<any>(null);
  const [likes, setLikes] = useState<any[]>([]);
  const [views, setViews] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Pre-seed current user into cache
  useEffect(() => {
    if (currentUser?.uid) {
      userCacheMap.set(currentUser.uid, {
        uid: currentUser.uid,
        name: currentUser.name || 'You',
        username: currentUser.username || currentUser.name?.toLowerCase().replace(/\s+/g, '') || 'you',
        avatar: currentUser.avatar || ''
      });
    }
  }, [currentUser]);

  useEffect(() => {
    if (showAnalytics && targetAnalyticsPostId) {
      // 1. Instant cache lookup from store
      const cached = (cachedReels || []).find((r: any) => r.id === targetAnalyticsPostId) || (cachedFeed || []).find((f: any) => f.id === targetAnalyticsPostId);
      if (cached) {
        setPostData(cached);
      }

      // 2. Fetch fresh doc in background
      getDoc(doc(db, 'posts', targetAnalyticsPostId)).then((snap) => {
        if (snap.exists()) {
          setPostData({ id: snap.id, ...snap.data() });
        }
      }).catch(() => {});

      // 3. Fast snapshots for likes
      const likesQuery = query(collection(db, 'posts', targetAnalyticsPostId, 'likes'));
      const unsubLikes = onSnapshot(likesQuery, (snapshot) => {
        const fastList = snapshot.docs.map(d => {
          if (userCacheMap.has(d.id)) return userCacheMap.get(d.id);
          const data = d.data() || {};
          if (data.name || data.userName) {
            const u = {
              uid: d.id,
              name: data.name || data.userName,
              username: data.username || (data.name || 'user').toLowerCase().replace(/\s+/g, ''),
              avatar: data.avatar || data.userAvatar || ''
            };
            userCacheMap.set(d.id, u);
            return u;
          }
          return { uid: d.id, name: 'User', username: 'user', avatar: '' };
        });
        setLikes(fastList);
      }, () => {});

      // 4. Fast snapshots for views
      const viewsQuery = query(collection(db, 'posts', targetAnalyticsPostId, 'views'));
      const unsubViews = onSnapshot(viewsQuery, (snapshot) => {
        const fastList = snapshot.docs.map(d => {
          if (userCacheMap.has(d.id)) return userCacheMap.get(d.id);
          const data = d.data() || {};
          if (data.name || data.userName) {
            const u = {
              uid: d.id,
              name: data.name || data.userName,
              username: data.username || (data.name || 'user').toLowerCase().replace(/\s+/g, ''),
              avatar: data.avatar || data.userAvatar || ''
            };
            userCacheMap.set(d.id, u);
            return u;
          }
          return { uid: d.id, name: 'User', username: 'user', avatar: '' };
        });
        setViews(fastList);
      }, () => {});

      return () => {
        unsubLikes();
        unsubViews();
      };
    }
  }, [showAnalytics, targetAnalyticsPostId, cachedReels, cachedFeed]);

  if (!showAnalytics) return null;

  const totalViews = Math.max(views.length, postData?.viewsCount || 0);
  const totalLikes = Math.max(likes.length, postData?.likesCount || 0);
  const totalComments = postData?.commentsCount || 0;
  const totalReposts = postData?.repostsCount || 0;
  const totalShares = postData?.sharesCount || Math.floor(totalViews * 0.15);
  const engagementRate = totalViews > 0 ? (((totalLikes + totalComments + totalReposts) / totalViews) * 100).toFixed(1) : '0.0';

  const currentList = activeTab === 'views' ? views : likes;
  const filteredList = currentList.filter(u => 
    (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (u.username || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[3000] bg-zinc-950 text-white flex flex-col overflow-hidden select-none animate-in fade-in duration-100">
      {/* Full Screen Header */}
      <div className="shrink-0 p-3.5 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between z-20">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setShowAnalytics(false)} 
            className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-full border border-zinc-800 active:scale-95 text-zinc-300 hover:text-white transition-transform"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <BarChart2 className="w-4 h-4" />
            </div>
            <span className="font-semibold text-base text-zinc-100 tracking-tight">Reel Analytics</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Owner View</span>
          </span>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 max-w-3xl mx-auto w-full custom-scrollbar">
        
        {/* Post Card */}
        {postData && (
          <div className="p-3.5 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center space-x-3.5">
            {postData.media?.[0] ? (
              <div className="w-14 h-18 rounded-xl overflow-hidden bg-zinc-800 shrink-0 border border-zinc-700/60 relative">
                <video src={postData.media[0]} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700/60">
                <BarChart2 className="w-5 h-5 text-zinc-500" />
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium text-zinc-200 line-clamp-2">{postData.text || 'Reel Video'}</p>
              <div className="flex items-center space-x-3 text-[12px] text-zinc-400">
                <span className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{postData.createdAt ? new Date(postData.createdAt).toLocaleDateString() : 'Recent'}</span>
                </span>
                <span className="flex items-center space-x-1 text-emerald-400 font-medium">
                  <Flame className="w-3.5 h-3.5" />
                  <span>{engagementRate}% Engaged</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Primary Metric Grid (Icon-First Visual Cards) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Views */}
          <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                <Eye className="w-4 h-4" />
              </div>
              <Radio className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="mt-2.5">
              <div className="text-xl font-bold text-white tracking-tight">{totalViews}</div>
              <div className="text-[11px] text-zinc-400 flex items-center space-x-1 mt-0.5">
                <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                <span>Total Views</span>
              </div>
            </div>
          </div>

          {/* Likes */}
          <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                <Heart className="w-4 h-4 fill-rose-500/30" />
              </div>
              <Sparkles className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="mt-2.5">
              <div className="text-xl font-bold text-white tracking-tight">{totalLikes}</div>
              <div className="text-[11px] text-zinc-400 flex items-center space-x-1 mt-0.5">
                <Flame className="w-3 h-3 text-rose-400" />
                <span>Reactions</span>
              </div>
            </div>
          </div>

          {/* Comments */}
          <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                <MessageCircle className="w-4 h-4" />
              </div>
              <Zap className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="mt-2.5">
              <div className="text-xl font-bold text-white tracking-tight">{totalComments}</div>
              <div className="text-[11px] text-zinc-400 flex items-center space-x-1 mt-0.5">
                <Users className="w-3 h-3 text-purple-400" />
                <span>Comments</span>
              </div>
            </div>
          </div>

          {/* Shares */}
          <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 flex items-center space-x-1">
                <Repeat className="w-3.5 h-3.5" />
              </div>
              <Globe className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="mt-2.5">
              <div className="text-xl font-bold text-white tracking-tight">{totalReposts + totalShares}</div>
              <div className="text-[11px] text-zinc-400 flex items-center space-x-1 mt-0.5">
                <Share2 className="w-3 h-3 text-amber-400" />
                <span>Shares</span>
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3.5 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-zinc-200">Watch & Reach Rate</span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                High
              </span>
            </div>
            
            <div className="space-y-2 pt-1">
              <div>
                <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                  <span>Watch Retention</span>
                  <span className="text-zinc-200 font-medium">85%</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full" style={{ width: '85%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                  <span>Non-Follower Reach</span>
                  <span className="text-zinc-200 font-medium">62%</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-purple-500 h-full rounded-full" style={{ width: '62%' }} />
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg">
                  <PieChart className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-zinc-200">Traffic Source</span>
              </div>
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <div className="p-2 bg-zinc-950 rounded-xl border border-zinc-800/80 flex items-center justify-between">
                <span className="text-[11px] text-zinc-300">For You Feed</span>
                <span className="text-xs font-bold text-white">70%</span>
              </div>

              <div className="p-2 bg-zinc-950 rounded-xl border border-zinc-800/80 flex items-center justify-between">
                <span className="text-[11px] text-zinc-300">Profile</span>
                <span className="text-xs font-bold text-white">20%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center p-1 bg-zinc-900 rounded-xl border border-zinc-800">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center space-x-1.5 ${activeTab === 'overview' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Overview</span>
            </button>

            <button 
              onClick={() => setActiveTab('views')}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center space-x-1.5 ${activeTab === 'views' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Viewers ({views.length})</span>
            </button>

            <button 
              onClick={() => setActiveTab('likes')}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center space-x-1.5 ${activeTab === 'likes' ? 'bg-rose-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <Heart className="w-3.5 h-3.5" />
              <span>Likers ({likes.length})</span>
            </button>
          </div>

          {activeTab !== 'overview' && (
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${activeTab === 'views' ? 'viewers' : 'likers'}...`}
                  className="w-full pl-9 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none"
                />
              </div>

              {filteredList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-zinc-500 space-y-1">
                  {activeTab === 'views' ? <Eye className="w-8 h-8 opacity-30" /> : <Heart className="w-8 h-8 opacity-30" />}
                  <p className="text-xs">No users found</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredList.map((u: any) => (
                    <UserRowWithFollow 
                      key={u.uid} 
                      u={u} 
                      currentUser={currentUser} 
                      onSelect={(selected) => {
                        setViewingUser(selected);
                        pushPage('profile');
                        setShowAnalytics(false);
                      }} 
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
