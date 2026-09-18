import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User as UserIcon, Heart, Search } from 'lucide-react';
import { useAppStore } from '../store';
import { collection, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { followUser, unfollowUser } from '../services/followService';

// Global fast user cache to eliminate repeat network lag
const userCacheMap = new Map<string, any>();

const UserRowWithFollow = ({ user, currentUser, onSelect }: { user: any; currentUser: any; onSelect: (u: any) => void; key?: any }) => {
  const [friendship, setFriendship] = useState({ following: false, followedBy: false, isFriend: false });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser?.uid || !user.uid) return;
    const followingRef = doc(db, 'users', currentUser.uid, 'following', user.uid);
    const followerRef = doc(db, 'users', user.uid, 'following', currentUser.uid);

    const unsubFollowing = onSnapshot(followingRef, (d1) => {
      const following = d1.exists();
      const unsubFollowed = onSnapshot(followerRef, (d2) => {
        const followedBy = d2.exists();
        setFriendship({ following, followedBy, isFriend: following && followedBy });
      }, () => {});
      return () => unsubFollowed();
    }, () => {});

    return () => unsubFollowing();
  }, [currentUser?.uid, user.uid]);

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

  const username = user.username || (user.name || 'user').toLowerCase().replace(/\s+/g, '');
  const isSelf = currentUser?.uid === user.uid;

  return (
    <div 
      className="flex items-center justify-between p-2.5 hover:bg-gray-50 rounded-2xl cursor-pointer transition-all active:scale-[0.98] group"
      onClick={() => onSelect(user)}
    >
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        <img 
          src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random`} 
          className="w-11 h-11 rounded-full object-cover shadow-sm border border-gray-100 shrink-0"
          referrerPolicy="no-referrer"
          alt={user.name}
        />
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-medium text-gray-900 text-sm tracking-tight truncate">{user.name}</span>
          <span className="text-gray-400 text-[11px] truncate">@{username}</span>
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

export const LikesList = () => {
  const { showLikesList, setShowLikesList, targetLikesPostId, setTargetLikesPostId, setViewingUser, pushPage, currentUser } = useAppStore();
  const [likers, setLikers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (showLikesList && targetLikesPostId) {
      setLoading(true);
      const fetchLikers = async () => {
        try {
          const likesCol = collection(db, 'posts', targetLikesPostId, 'likes');
          const snapshot = await getDocs(likesCol);
          
          // Fast cached check
          const initialCached = snapshot.docs
            .map(d => {
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
              return null;
            })
            .filter(Boolean);

          if (initialCached.length > 0) {
            setLikers(initialCached);
            setLoading(false);
          }

          const userPromises = snapshot.docs.map(async (d) => {
            const uid = d.id;
            const data = d.data() || {};
            if (data.name || data.userName) {
              const uObj = {
                uid,
                name: data.name || data.userName,
                username: data.username || (data.name || 'user').toLowerCase().replace(/\s+/g, ''),
                avatar: data.avatar || data.userAvatar || ''
              };
              userCacheMap.set(uid, uObj);
              return uObj;
            }

            if (userCacheMap.has(uid)) {
              return userCacheMap.get(uid);
            }

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
              console.error("Error fetching liker:", e);
            }

            const fallback = {
              uid,
              name: 'User ' + uid.substring(0, 4),
              username: 'user_' + uid.substring(0, 4),
              avatar: ''
            };
            userCacheMap.set(uid, fallback);
            return fallback;
          });
          
          const users = await Promise.all(userPromises);
          setLikers(users);
        } catch (err) {
          console.error("Failed to fetch likers:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchLikers();
    }
  }, [showLikesList, targetLikesPostId]);

  const handleClose = () => {
    setShowLikesList(false);
    setTargetLikesPostId(null);
  };

  const filteredLikers = likers.filter(l => 
    (l.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (l.username && l.username.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <AnimatePresence>
      {showLikesList && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={handleClose}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-3xl w-full max-w-sm h-full max-h-[500px] flex flex-col overflow-hidden shadow-2xl border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-50 bg-white sticky top-0 z-10">
              <div className="flex items-center space-x-2">
                <Heart className="w-5 h-5 text-red-500 fill-red-500" />
                <h3 className="font-normal text-gray-900 tracking-tight">Likes</h3>
              </div>
              <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search likers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-100 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all border border-transparent focus:border-blue-400"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm text-gray-400 font-normal">Loading likers...</p>
                </div>
              ) : filteredLikers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <UserIcon className="w-12 h-12 opacity-10 mb-2" />
                  <p className="text-sm">No likers found</p>
                </div>
              ) : (
                filteredLikers.map((user) => (
                  <UserRowWithFollow 
                    key={user.uid} 
                    user={user} 
                    currentUser={currentUser} 
                    onSelect={(selected) => {
                      setViewingUser(selected);
                      pushPage('profile');
                      handleClose();
                    }} 
                  />
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
