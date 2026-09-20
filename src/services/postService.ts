import { 
  collection, 
  addDoc, 
  setDoc, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  startAfter, 
  serverTimestamp, 
  increment, 
  updateDoc,
  deleteDoc,
  where,
  runTransaction,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { Post, Comment, Notification, User, Song } from '../types';
import { uploadMedia, deleteMedia } from './githubStorage';
import { compressMediaFile } from './mediaCompressor';
import { sendNotification } from './notificationService';
import { formatFileSize, generateVideoThumbnail } from '../utils';
import { collection as usersCol, getDocs as getUsers, where as whereUser } from 'firebase/firestore';

export const DEFAULT_SONGS: Song[] = [
  {
    id: 'song_trending_1',
    title: 'Aesthetic Sunset Beats',
    artist: 'Lofi Chillvibes',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop',
    duration: 180,
    creatorId: 'system',
    creatorName: 'Trending Beats',
    createdAt: new Date().toISOString()
  },
  {
    id: 'song_trending_2',
    title: 'Midnight Highway Drive',
    artist: 'Synthwave Dreams',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop',
    duration: 210,
    creatorId: 'system',
    creatorName: 'Viral Sounds',
    createdAt: new Date().toISOString()
  },
  {
    id: 'song_trending_3',
    title: 'Summer Breeze Acoustic',
    artist: 'Sunny Rhythms',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop',
    duration: 165,
    creatorId: 'system',
    creatorName: 'Pop Top 50',
    createdAt: new Date().toISOString()
  },
  {
    id: 'song_trending_4',
    title: 'Urban Groove Bassline',
    artist: 'Street Vibe Crew',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&auto=format&fit=crop',
    duration: 195,
    creatorId: 'system',
    creatorName: 'Trending Beats',
    createdAt: new Date().toISOString()
  },
  {
    id: 'song_trending_5',
    title: 'Deep Focus Ambient Flow',
    artist: 'Zen Garden Beats',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    thumbnail: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300&auto=format&fit=crop',
    duration: 240,
    creatorId: 'system',
    creatorName: 'Chillout Lounge',
    createdAt: new Date().toISOString()
  }
];

export const subscribeSongs = (callback: (songs: Song[]) => void) => {
  const q = query(collection(db, 'songs'), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(q, (snapshot) => {
    let songs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Song));
    if (songs.length === 0) {
      songs = DEFAULT_SONGS;
    }
    for (let i = songs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [songs[i], songs[j]] = [songs[j], songs[i]];
    }
    callback(songs);
  }, () => {
    callback(DEFAULT_SONGS);
  });
};

export const saveSong = async (songData: Omit<Song, 'id' | 'createdAt'>) => {
  try {
    const docRef = await addDoc(collection(db, 'songs'), {
      ...songData,
      createdAt: serverTimestamp()
    });
    return { id: docRef.id, ...songData };
  } catch (e) {
    console.error("Save song error:", e);
    throw e;
  }
};

const detectMentions = async (text: string, actor: User, postId: string, postMedia: string | null, targetId: string) => {
  const mentionRegex = /@(\w+)/g;
  const matches = text.match(mentionRegex);
  if (!matches) return;

  const usernames = matches.map(m => m.slice(1));
  for (const username of usernames) {
    try {
      const q = query(collection(db, 'users'), where('username', '==', username), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const targetDoc = snap.docs[0];
        const targetUserId = targetDoc.id;
        if (targetUserId !== actor.uid) {
          const targetData = targetDoc.data();
          // Check if blocked
          const { isUserBlocked, isFollowing } = await import('./followService');
          const blocked = await isUserBlocked(targetUserId, actor.uid);
          if (blocked) continue;

          // Check whoCanMention privacy settings
          const whoCanMention = targetData.whoCanMention || targetData.settings?.whoCanMention || 'everyone';
          if (whoCanMention === 'no_one') continue;
          if (whoCanMention === 'friends') {
            const isFriendOrFollowed = await isFollowing(targetUserId, actor.uid);
            if (!isFriendOrFollowed) continue;
          }

          await sendNotification(targetUserId, 'mention', actor, targetId, postId, postMedia, `mentioned you: "${text.substring(0, 50)}..."`);
        }
      }
    } catch (e) {
      console.error("Mention detection error:", e);
    }
  }
};

export const getPost = async (postId: string) => {
  try {
    const postSnap = await getDoc(doc(db, 'posts', postId));
    if (postSnap.exists()) {
      return { id: postSnap.id, ...postSnap.data() } as Post;
    }
    return null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

export const createPost = async (
  userId: string, 
  user: User, 
  text: string, 
  files: File[], 
  type: 'post' | 'reel' = 'post', 
  songId?: string,
  extra?: {
    location?: string | null;
    taggedUsers?: { uid: string; name: string; username: string; avatar: string }[];
    settings?: {
      commentsDisabled?: boolean;
      privacy?: 'public' | 'followers' | 'private';
      hideLikes?: boolean;
      allowRemix?: boolean;
      highQuality?: boolean;
      publishSong?: boolean;
      songTitle?: string;
      songArtist?: string;
    };
    songInfo?: Song | null;
    bg?: string | null;
    aspectRatioFit?: 'cover' | 'contain' | string | null;
    thumbnailUrl?: string | null;
    onProgress?: (progress: number) => void;
  }
) => {
  try {
    if (extra?.onProgress) extra.onProgress(15);

    const mediaDetailsList: any[] = [];
    let generatedThumbnailUrl: string | null = null;

    const mediaUrls = await Promise.all(
      files.map(async (file, idx) => {
        const origSizeBytes = file.size;
        const origSizeStr = formatFileSize(origSizeBytes);

        // Upload raw original file directly (NO compression, 100% original full video quality)
        const url = await uploadMedia(
          file, 
          type === 'reel' ? 'reels' : 'posts',
          (fileProgress) => {
            if (extra?.onProgress) {
              const base = 20 + (idx / files.length) * 75;
              extra.onProgress(Math.round(base + (fileProgress / 100) * (75 / files.length)));
            }
          }
        );

        mediaDetailsList.push({
          originalSize: origSizeStr,
          compressedSize: origSizeStr,
          savedPercentage: 'Full Original HD Quality',
          type: file.type.startsWith('video/') ? 'video' : 'image'
        });

        return url;
      })
    );

    const postData: any = {
      authorId: userId,
      authorName: user.name,
      authorAvatar: user.avatar,
      text,
      media: mediaUrls,
      type,
      likesCount: 0,
      commentsCount: 0,
      createdAt: serverTimestamp(),
      mediaDetails: mediaDetailsList,
    };

    if (generatedThumbnailUrl) {
      postData.thumbnailUrl = generatedThumbnailUrl;
      postData.thumbnail = generatedThumbnailUrl;
    }
    if (extra?.thumbnailUrl) {
      postData.thumbnailUrl = extra.thumbnailUrl;
      postData.thumbnail = extra.thumbnailUrl;
    }

    if (songId) postData.songId = songId;
    if (extra?.songInfo) {
      postData.songId = extra.songInfo.id;
      postData.songTitle = extra.songInfo.title;
      postData.songArtist = extra.songInfo.artist;
      postData.songUrl = extra.songInfo.url;
    }
    if (extra?.location) postData.location = extra.location;
    if (extra?.bg) postData.bg = extra.bg;
    if (extra?.aspectRatioFit) postData.aspectRatioFit = extra.aspectRatioFit;
    if (extra?.taggedUsers && extra.taggedUsers.length > 0) {
      postData.taggedUsers = extra.taggedUsers;
    }
    if (extra?.settings) {
      if (extra.settings.commentsDisabled !== undefined) postData.commentsDisabled = extra.settings.commentsDisabled;
      if (extra.settings.privacy) postData.privacy = extra.settings.privacy;
      if (extra.settings.hideLikes !== undefined) postData.hideLikes = extra.settings.hideLikes;
      if (extra.settings.allowRemix !== undefined) postData.allowRemix = extra.settings.allowRemix;
    }

    // If author requested to publish this as original song/audio to the sound library
    if (extra?.settings?.publishSong) {
      const songTitle = extra.settings.songTitle?.trim() || text.trim().substring(0, 40) || `Original Audio - ${user.name}`;
      const songArtist = extra.settings.songArtist?.trim() || user.name;
      const songThumbnail = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=5633D8&color=fff`;
      const songUrl = mediaUrls[0] || '';
      try {
        const saved = await saveSong({
          title: songTitle,
          artist: songArtist,
          thumbnail: songThumbnail,
          url: songUrl,
          duration: 180,
          creatorId: user.uid,
          creatorName: user.name,
        });
        postData.songId = saved.id;
        postData.songTitle = songTitle;
        postData.songArtist = songArtist;
        postData.songThumbnail = songThumbnail;
        postData.songUrl = songUrl;
      } catch (songErr) {
        console.warn("Song publish error:", songErr);
      }
    }

    if (extra?.onProgress) extra.onProgress(85);

    // Keep natural original audio info for reels without creating a duplicate audio stream
    if (type === 'reel' && !songId && !extra?.songInfo && !postData.songTitle) {
      postData.songTitle = `Original audio - ${user.name}`;
      postData.songArtist = user.name;
    }

    const docRef = await addDoc(collection(db, 'posts'), postData);
    
    // Detect mentions in post text
    await detectMentions(text, user, docRef.id, mediaUrls[0] || null, docRef.id);

    // Send direct mention notification to explicitly tagged users
    if (extra?.taggedUsers && extra.taggedUsers.length > 0) {
      for (const taggedUser of extra.taggedUsers) {
        if (taggedUser.uid !== userId) {
          try {
            await sendNotification(
              taggedUser.uid,
              'mention',
              user,
              docRef.id,
              docRef.id,
              mediaUrls[0] || null,
              `tagged you in a ${type}: "${text.substring(0, 50)}"`
            );
          } catch (e) {
            console.error("Tag notification error:", e);
          }
        }
      }
    }
    
    // Increment user post count
    await setDoc(doc(db, 'users', userId), {
      postsCount: increment(1)
    }, { merge: true });

    if (extra?.onProgress) extra.onProgress(100);

    return { id: docRef.id, ...postData };
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const deletePost = async (postId: string, userId: string) => {
  try {
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    if (!postSnap.exists()) throw new Error('Post not found');
    const postData = postSnap.data();
    if (postData.authorId !== userId) throw new Error('Unauthorized');

    // 1. Delete media files from R2/Firebase Storage
    const mediaUrls: string[] = postData.mediaUrls || postData.media || [];
    if (postData.thumbnailUrl) mediaUrls.push(postData.thumbnailUrl);
    
    mediaUrls.forEach(url => {
      deleteMedia(url).catch(e => console.warn('Media deletion warning:', e));
    });

    // 2. Delete associated song from 'songs' collection if created with this reel
    const songIdToDelete = postData.createdSongId || postData.songId;
    if (songIdToDelete) {
      try {
        const songRef = doc(db, 'songs', songIdToDelete);
        const songSnap = await getDoc(songRef);
        if (songSnap.exists()) {
          const songData = songSnap.data();
          if (songData.creatorId === userId || songData.url === mediaUrls[0]) {
            await deleteDoc(songRef);
            console.log(`🎵 Deleted associated song: ${songIdToDelete}`);
          }
        }
      } catch (songErr) {
        console.warn('Associated song deletion warning:', songErr);
      }
    } else if (mediaUrls[0]) {
      // Cleanup any song with matching URL created by this user
      try {
        const songsQuery = query(
          collection(db, 'songs'),
          where('url', '==', mediaUrls[0]),
          where('creatorId', '==', userId)
        );
        const songsSnap = await getDocs(songsQuery);
        songsSnap.forEach(async (sDoc) => {
          await deleteDoc(doc(db, 'songs', sDoc.id));
        });
      } catch (e) {}
    }

    // 3. Delete Firestore post document
    await deleteDoc(postRef);
    
    // Decrement user post count
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists() && userSnap.data().postsCount > 0) {
      await updateDoc(userRef, {
        postsCount: increment(-1)
      });
    }
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const updatePost = async (postId: string, userId: string, text: string) => {
  try {
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    if (!postSnap.exists()) throw new Error('Post not found');
    if (postSnap.data().authorId !== userId) throw new Error('Unauthorized');

    await updateDoc(postRef, { text, updatedAt: serverTimestamp() });
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const getFeed = async (pageSize: number = 10, lastDoc: any = null, userId?: string) => {
  let q;
  
  if (userId) {
    // If userId is provided, we might hit index issues with orderBy
    // For now, we fetch and sort client-side if we can't guarantee index
    q = query(collection(db, 'posts'), where('authorId', '==', userId), limit(pageSize * 2));
  } else {
    q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(pageSize));
  }

  if (lastDoc && !userId) {
    q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(pageSize));
  }
  
  const querySnapshot = await getDocs(q);
  let posts = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Post));
  
  if (userId) {
    posts.sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
    posts = posts.slice(0, pageSize);
  }

  return {
    posts,
    lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1]
  };
};

export const subscribeFeed = (callback: (posts: Post[]) => void, pageSize: number = 30) => {
  const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(pageSize));
  return onSnapshot(q, (snapshot) => {
    const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
    callback(posts);
  }, (error) => {
    console.error("Feed subscription error:", error);
  });
};

export const toggleLike = async (postId: string, userId: string, user?: { name?: string; avatar?: string }) => {
  const likeRef = doc(db, 'posts', postId, 'likes', userId);
  const postRef = doc(db, 'posts', postId);

  try {
    const likeDoc = await getDoc(likeRef);
    if (likeDoc.exists()) {
      await deleteDoc(likeRef);
      await updateDoc(postRef, { likesCount: increment(-1) });
      return false;
    } else {
      await setDoc(likeRef, { 
        createdAt: serverTimestamp(),
        userId,
        userName: user?.name || 'User',
        userAvatar: user?.avatar || ''
      });
      await updateDoc(postRef, { likesCount: increment(1) });
      return true;
    }
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const toggleRepost = async (
  postId: string, 
  userId: string, 
  user?: { name?: string; avatar?: string }, 
  text?: string
): Promise<boolean> => {
  const repostRef = doc(db, 'posts', postId, 'reposts', userId);
  const userRepostRef = doc(db, 'users', userId, 'reposts', postId);
  const postRef = doc(db, 'posts', postId);

  try {
    const repostDoc = await getDoc(repostRef);
    if (repostDoc.exists() && text === undefined) {
      await deleteDoc(repostRef);
      await deleteDoc(userRepostRef);
      await updateDoc(postRef, { repostsCount: increment(-1) });
      return false; // Not reposted anymore
    } else {
      const payload = {
        createdAt: serverTimestamp(),
        userId,
        userName: user?.name || 'User',
        userAvatar: user?.avatar || '',
        text: text ? text.trim() : ''
      };
      await setDoc(repostRef, payload);
      await setDoc(userRepostRef, payload);
      if (!repostDoc.exists()) {
        await updateDoc(postRef, { repostsCount: increment(1) });
      }
      return true; // Reposted successfully
    }
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const getRepostedPosts = async (userId: string): Promise<Post[]> => {
  try {
    const repostsSnap = await getDocs(collection(db, 'users', userId, 'reposts'));
    const postIds = repostsSnap.docs.map(d => d.id);
    if (postIds.length === 0) return [];
    
    const posts = await Promise.all(
      postIds.map(async id => {
        const pSnap = await getDoc(doc(db, 'posts', id));
        return pSnap.exists() ? { id: pSnap.id, ...pSnap.data() } as Post : null;
      })
    );
    return posts.filter(p => p !== null) as Post[];
  } catch(e) {
    console.error("Error fetching reposted posts:", e);
    return [];
  }
};

export const checkHasReposted = async (postId: string, userId: string): Promise<boolean> => {
  if (!userId) return false;
  try {
    const repostDoc = await getDoc(doc(db, 'posts', postId, 'reposts', userId));
    return repostDoc.exists();
  } catch {
    return false;
  }
};

export const addComment = async (
  postId: string, 
  userId: string, 
  user: User, 
  text: string, 
  parentId?: string | null,
  extraData?: { imageUrl?: string; audioUrl?: string; audioDuration?: number; stickerUrl?: string; replyToName?: string; replyToAuthorId?: string }
) => {
  try {
    // Check if user is allowed to comment on this post
    const postSnap = await getDoc(doc(db, 'posts', postId));
    if (!postSnap.exists()) throw new Error("Post not found");
    const postData = postSnap.data();
    const postAuthorId = postData?.authorId;

    if (postAuthorId && postAuthorId !== userId) {
      const { isUserBlocked } = await import('./followService');
      const blocked = await isUserBlocked(postAuthorId, userId);
      if (blocked) {
        throw new Error("You cannot comment on this post.");
      }

      const authorDoc = await getDoc(doc(db, 'users', postAuthorId));
      if (authorDoc.exists()) {
        const authorData = authorDoc.data();
        const whoCanComment = authorData.whoCanComment || authorData.settings?.whoCanComment || 'everyone';
        if (whoCanComment === 'no_one') {
          throw new Error("Comments are turned off for this post.");
        } else if (whoCanComment === 'friends') {
          const { isFollowing } = await import('./followService');
          const isUserFollowing = await isFollowing(postAuthorId, userId);
          if (!isUserFollowing) {
            throw new Error("Only friends can comment on this post.");
          }
        }
      }
    }

    const commentData: any = {
      authorId: userId,
      authorName: user.name,
      authorAvatar: user.avatar,
      text,
      createdAt: serverTimestamp(),
      parentId: parentId || null,
      ...(extraData || {})
    };

    const docRef = await addDoc(collection(db, 'posts', postId, 'comments'), commentData);
    await updateDoc(doc(db, 'posts', postId), { commentsCount: increment(1) });

    // Detect mentions in comment
    const postMedia = postData?.media?.[0] || null;
    await detectMentions(text, user, postId, postMedia, docRef.id);

    return { id: docRef.id, ...commentData };
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const getComments = async (postId: string) => {
  const q = query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
};

export const deleteComment = async (postId: string, commentId: string) => {
  try {
    await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
    await updateDoc(doc(db, 'posts', postId), { commentsCount: increment(-1) });
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const toggleCommentLike = async (postId: string, commentId: string, userId: string) => {
  const likeRef = doc(db, 'posts', postId, 'comments', commentId, 'likes', userId);
  const commentRef = doc(db, 'posts', postId, 'comments', commentId);

  try {
    const likeDoc = await getDoc(likeRef);
    if (likeDoc.exists()) {
      await deleteDoc(likeRef);
      await updateDoc(commentRef, { likesCount: increment(-1) });
      return false;
    } else {
      await setDoc(likeRef, { createdAt: serverTimestamp() });
      await updateDoc(commentRef, { likesCount: increment(1) });
      return true;
    }
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const toggleFavorite = async (postId: string, userId: string) => {
  const favRef = doc(db, 'users', userId, 'favorites', postId);
  const postRef = doc(db, 'posts', postId);

  try {
    const favDoc = await getDoc(favRef);
    if (favDoc.exists()) {
      await deleteDoc(favRef);
      await updateDoc(postRef, { favoritesCount: increment(-1) });
      return false;
    } else {
      await setDoc(favRef, { createdAt: serverTimestamp() });
      await updateDoc(postRef, { favoritesCount: increment(1) });
      return true;
    }
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const getSavedPosts = async (userId: string) => {
  try {
    const favsSnap = await getDocs(collection(db, 'users', userId, 'favorites'));
    const postIds = favsSnap.docs.map(d => d.id);
    if (postIds.length === 0) return [];
    
    const posts = await Promise.all(
      postIds.map(async id => {
        const pSnap = await getDoc(doc(db, 'posts', id));
        return pSnap.exists() ? { id: pSnap.id, ...pSnap.data() } as Post : null;
      })
    );
    return posts.filter(p => p !== null) as Post[];
  } catch(e) {
    console.error(e);
    return [];
  }
};

const viewedReelsCache = new Set<string>();

export const incrementViewCount = async (postId: string, userId: string) => {
  if (!userId || viewedReelsCache.has(`${postId}_${userId}`)) return;
  const viewRef = doc(db, 'posts', postId, 'views', userId);
  const postRef = doc(db, 'posts', postId);

  try {
    const viewDoc = await getDoc(viewRef);
    if (!viewDoc.exists()) {
      await setDoc(viewRef, { createdAt: serverTimestamp() });
      await updateDoc(postRef, { viewsCount: increment(1) });
    }
    viewedReelsCache.add(`${postId}_${userId}`);
  } catch (error: any) {
    console.error("Error incrementing view count:", error);
  }
};

export const subscribeUserPosts = (userId: string, callback: (posts: Post[]) => void) => {
  // We remove orderBy to avoid index requirement, and sort client-side
  const q = query(collection(db, 'posts'), where('authorId', '==', userId), limit(50));
  return onSnapshot(q, (snapshot) => {
    const posts = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Post))
      .sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
    callback(posts);
  }, (error) => {
    console.error("User posts subscription error:", error);
  });
};

export const subscribeReels = (callback: (reels: Post[]) => void, pageSize: number = 50) => {
  const q = query(collection(db, 'posts'), where('type', '==', 'reel'), limit(pageSize));
  return onSnapshot(q, (snapshot) => {
    let reels = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
    reels.sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
    callback(reels);
  }, (error) => {
    console.error("Reels subscription error:", error);
  });
};

export const searchPosts = async (searchTerm: string) => {
  const q = query(
    collection(db, 'posts'),
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  try {
    const snapshot = await getDocs(q);
    const termLower = searchTerm.toLowerCase();
    const results = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Post))
      .filter(post => post.text?.toLowerCase().includes(termLower));
    
    return results;
  } catch (e) {
    console.error("Search error:", e);
    return [];
  }
};

export const toggleSongFavorite = async (songId: string, userId: string, songData?: any) => {
  const favRef = doc(db, 'users', userId, 'favoriteSongs', songId);
  try {
    const favDoc = await getDoc(favRef);
    if (favDoc.exists()) {
      await deleteDoc(favRef);
      return false;
    } else {
      await setDoc(favRef, { 
        id: songId,
        title: songData?.title || 'Original Audio',
        artist: songData?.artist || 'Audio',
        url: songData?.url || '',
        cover: songData?.cover || '',
        createdAt: serverTimestamp()
      });
      return true;
    }
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const subscribeFavoriteSongs = (userId: string, callback: (songIds: string[]) => void) => {
  if (!userId) return () => {};
  const q = query(collection(db, 'users', userId, 'favoriteSongs'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => doc.id));
  }, () => {});
};

export const subscribeFavoriteSongsList = (userId: string, callback: (songs: any[]) => void) => {
  if (!userId) return () => {};
  const q = query(collection(db, 'users', userId, 'favoriteSongs'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, () => {});
};

export const getUserTotalLikes = async (userId: string) => {
  try {
    const q = query(collection(db, 'posts'), where('authorId', '==', userId));
    const querySnapshot = await getDocs(q);
    let totalLikes = 0;
    querySnapshot.forEach((doc) => {
      totalLikes += doc.data().likesCount || 0;
    });
    return totalLikes;
  } catch (error) {
    console.error("Error getting total likes:", error);
    return 0;
  }
};
