import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Heart, Eye } from 'lucide-react';
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
      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-2xl transition-colors cursor-pointer group"
      onClick={() => onSelect(u)}
    >
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        <img 
          src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'User')}&background=random`} 
          className="w-11 h-11 rounded-full object-cover border border-gray-100 shadow-sm shrink-0" 
          alt={u.name}
          referrerPolicy="no-referrer"
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm text-gray-900 truncate">{u.name}</p>
          <p className="text-[11px] text-gray-400 font-normal truncate">@{username}</p>
        </div>
      </div>

      {!isSelf && (
        <button 
          onClick={handleFollowToggle}
          disabled={loading}
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 shrink-0 ml-2 shadow-xs min-w-[85px] text-center ${
            friendship.isFriend 
              ? 'bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-200' 
              : friendship.following 
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200' 
              : friendship.followedBy 
              ? 'bg-blue-600 text-white hover:bg-blue-700' 
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {loading ? '...' : friendship.isFriend ? 'Friends' : friendship.following ? 'Following' : friendship.followedBy ? 'Follow Back' : 'Follow'}
        </button>
      )}
    </div>
  );
};

export const AnalyticsModal = () => {
  const { showAnalytics, setShowAnalytics, targetAnalyticsPostId, currentUser, setViewingUser, pushPage } = useAppStore();
  const [activeTab, setActiveTab] = useState<'likes' | 'views'>('views');
  const [likes, setLikes] = useState<any[]>([]);
  const [views, setViews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
      setLoading(true);

      const processDocs = async (docs: any[]) => {
        const results = await Promise.all(
          docs.map(async (d) => {
            const uid = d.id;
            const data = d.data() || {};
            
            // Check if document itself already contains user info
            if (data.name || data.userName) {
              const uObj = {
                uid,
                name: data.name || data.userName || 'User',
                username: data.username || data.userHandle || (data.name || 'user').toLowerCase().replace(/\s+/g, ''),
                avatar: data.avatar || data.userAvatar || ''
              };
              userCacheMap.set(uid, uObj);
              return uObj;
            }

            // Check in-memory cache
            if (userCacheMap.has(uid)) {
              return userCacheMap.get(uid);
            }

            // Otherwise fetch from Firestore and cache
            try {
              const userDoc = await getDoc(doc(db, 'users', uid));
              if (userDoc.exists()) {
                const uData = userDoc.data();
                const uObj = {
                  uid,
                  name: uData.name || 'User',
                  username: uData.username || (uData.name || 'user').toLowerCase().replace(/\s+/g, ''),
                  avatar: uData.avatar || ''
                };
                userCacheMap.set(uid, uObj);
                return uObj;
              }
            } catch (e) {
              console.error("User fetch error:", e);
            }

            const fallback = {
              uid,
              name: 'User ' + uid.substring(0, 4),
              username: 'user_' + uid.substring(0, 4),
              avatar: ''
            };
            userCacheMap.set(uid, fallback);
            return fallback;
          })
        );
        return results;
      };
      
      // Listen for likes
      const likesQuery = query(collection(db, 'posts', targetAnalyticsPostId, 'likes'));
      const unsubLikes = onSnapshot(likesQuery, (snapshot) => {
        // Fast initial display from cache/doc data
        const initialFast = snapshot.docs.map(d => {
          if (userCacheMap.has(d.id)) return userCacheMap.get(d.id);
          const data = d.data() || {};
          if (data.name || data.userName) {
            return {
              uid: d.id,
              name: data.name || data.userName,
              username: data.username || (data.name || 'user').toLowerCase().replace(/\s+/g, ''),
              avatar: data.avatar || data.userAvatar || ''
            };
          }
          return { uid: d.id, name: 'Loading...', username: 'user', avatar: '' };
        });
        setLikes(initialFast);

        processDocs(snapshot.docs).then(fullUsers => {
          setLikes(fullUsers);
        });
      }, () => {});

      // Listen for views
      const viewsQuery = query(collection(db, 'posts', targetAnalyticsPostId, 'views'));
      const unsubViews = onSnapshot(viewsQuery, (snapshot) => {
        const initialFast = snapshot.docs.map(d => {
          if (userCacheMap.has(d.id)) return userCacheMap.get(d.id);
          const data = d.data() || {};
          if (data.name || data.userName) {
            return {
              uid: d.id,
              name: data.name || data.userName,
              username: data.username || (data.name || 'user').toLowerCase().replace(/\s+/g, ''),
              avatar: data.avatar || data.userAvatar || ''
            };
          }
          return { uid: d.id, name: 'Loading...', username: 'user', avatar: '' };
        });
        setViews(initialFast);
        setLoading(false);

        processDocs(snapshot.docs).then(fullUsers => {
          setViews(fullUsers);
          setLoading(false);
        });
      }, () => {});

      return () => {
        unsubLikes();
        unsubViews();
      };
    }
  }, [showAnalytics, targetAnalyticsPostId]);

  if (!showAnalytics) return null;

  const currentList = activeTab === 'views' ? views : likes;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
      <div 
        onClick={() => setShowAnalytics(false)}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
      />
      
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="relative bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[80vh] max-h-[600px] z-10"
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <h2 className="font-normal text-lg text-gray-900 tracking-tight">Post Analytics</h2>
          <button onClick={() => setShowAnalytics(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex border-b border-gray-100 bg-white">
          <button 
            onClick={() => setActiveTab('views')}
            className={`flex-1 py-3 text-sm font-normal transition-all relative ${activeTab === 'views' ? 'text-blue-600 font-medium' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <div className="flex items-center justify-center space-x-2">
              <Eye className="w-4 h-4" />
              <span>Views ({views.length})</span>
            </div>
            {activeTab === 'views' && <div className="absolute bottom-0 left-8 right-8 h-0.5 bg-blue-600 rounded-full" />}
          </button>
          <button 
            onClick={() => setActiveTab('likes')}
            className={`flex-1 py-3 text-sm font-normal transition-all relative ${activeTab === 'likes' ? 'text-red-600 font-medium' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <div className="flex items-center justify-center space-x-2">
              <Heart className="w-4 h-4" />
              <span>Likes ({likes.length})</span>
            </div>
            {activeTab === 'likes' && <div className="absolute bottom-0 left-8 right-8 h-0.5 bg-red-600 rounded-full" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {loading && currentList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-3 py-12">
              <div className="w-7 h-7 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-[12px] font-normal text-gray-400">Loading analytics...</p>
            </div>
          ) : currentList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2 py-12">
              {activeTab === 'views' ? <Eye className="w-12 h-12 opacity-15" /> : <Heart className="w-12 h-12 opacity-15" />}
              <p className="text-sm font-normal">No {activeTab} yet</p>
            </div>
          ) : (
            currentList.map((u: any) => (
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
            ))
          )}
        </div>

        <div className="p-3 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-400 text-center font-normal">
          Only you can see these analytics for your own content
        </div>
      </motion.div>
    </div>
  );
};
