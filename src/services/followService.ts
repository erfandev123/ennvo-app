import { doc, setDoc, deleteDoc, increment, updateDoc, getDoc, serverTimestamp, runTransaction, collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../firebase';

export const followUser = async (currentUser: any, targetUser: any) => {
  if (currentUser.uid === targetUser.uid) return;

  const followingRef = doc(db, 'users', currentUser.uid, 'following', targetUser.uid);
  const followerRef = doc(db, 'users', targetUser.uid, 'followers', currentUser.uid);

  try {
    await runTransaction(db, async (transaction) => {
      // Current user follows target user
      transaction.set(followingRef, { 
        createdAt: serverTimestamp(),
        name: targetUser.name,
        avatar: targetUser.avatar
      });
      // Target user gets a new follower
      transaction.set(followerRef, { 
        createdAt: serverTimestamp(),
        name: currentUser.name,
        avatar: currentUser.avatar
      });
      transaction.set(doc(db, 'users', currentUser.uid), { followingCount: increment(1) }, { merge: true });
      transaction.set(doc(db, 'users', targetUser.uid), { followersCount: increment(1) }, { merge: true });
    });

    // Send notification
    try {
      const { sendNotification } = await import('./notificationService');
      await sendNotification(targetUser.uid, 'follow', currentUser, targetUser.uid);
    } catch (e) {
      console.error('Failed to send follow notification:', e);
    }
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const unfollowUser = async (currentUserId: string, targetUserId: string) => {
  const followingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
  const followerRef = doc(db, 'users', targetUserId, 'followers', currentUserId);

  try {
    await runTransaction(db, async (transaction) => {
      transaction.delete(followingRef);
      transaction.delete(followerRef);
      transaction.set(doc(db, 'users', currentUserId), { followingCount: increment(-1) }, { merge: true });
      transaction.set(doc(db, 'users', targetUserId), { followersCount: increment(-1) }, { merge: true });
    });
  } catch (error: any) {
    console.error("unfollowUser error:", error);
    // Fallback if transaction fails due to count sync
    try {
      await deleteDoc(followingRef);
      await deleteDoc(followerRef);
    } catch (e) {
      console.error("unfollowUser fallback error:", e);
      throw new Error(error.message);
    }
  }
};

export const removeFollower = async (currentUserId: string, followerUserId: string) => {
  const followerRef = doc(db, 'users', currentUserId, 'followers', followerUserId);
  const followingRef = doc(db, 'users', followerUserId, 'following', currentUserId);

  try {
    await runTransaction(db, async (transaction) => {
      transaction.delete(followerRef);
      transaction.delete(followingRef);
      transaction.set(doc(db, 'users', currentUserId), { followersCount: increment(-1) }, { merge: true });
      transaction.set(doc(db, 'users', followerUserId), { followingCount: increment(-1) }, { merge: true });
    });
  } catch (error: any) {
    console.error("removeFollower error:", error);
    try {
      await deleteDoc(followerRef);
      await deleteDoc(followingRef);
    } catch (e) {
      throw new Error(error.message);
    }
  }
};

export const deleteFriend = async (currentUserId: string, friendUserId: string) => {
  try {
    await unfollowUser(currentUserId, friendUserId);
    await removeFollower(currentUserId, friendUserId);
  } catch (error: any) {
    console.error("deleteFriend error:", error);
    throw error;
  }
};

export const blockUser = async (currentUserId: string, targetUserId: string) => {
  try {
    const blockRef = doc(db, 'users', currentUserId, 'blockedUsers', targetUserId);
    await setDoc(blockRef, {
      blockedAt: serverTimestamp()
    });
    // Automatically remove mutual friend/follow relationship when blocking
    try {
      await deleteFriend(currentUserId, targetUserId);
    } catch (e) {}
  } catch (error: any) {
    console.error("blockUser error:", error);
    throw new Error(error.message);
  }
};

export const unblockUser = async (currentUserId: string, targetUserId: string) => {
  try {
    const blockRef = doc(db, 'users', currentUserId, 'blockedUsers', targetUserId);
    await deleteDoc(blockRef);
  } catch (error: any) {
    console.error("unblockUser error:", error);
    throw new Error(error.message);
  }
};

export const isUserBlocked = async (currentUserId: string, targetUserId: string) => {
  try {
    const blockRef = doc(db, 'users', currentUserId, 'blockedUsers', targetUserId);
    const snap = await getDoc(blockRef);
    return snap.exists();
  } catch (error) {
    return false;
  }
};

export const getBlockedUsers = async (currentUserId: string) => {
  try {
    const blockedRef = collection(db, 'users', currentUserId, 'blockedUsers');
    const snap = await getDocs(blockedRef);
    return snap.docs.map(d => d.id);
  } catch (error) {
    console.error("getBlockedUsers error:", error);
    return [];
  }
};

export const isFollowing = async (currentUserId: string, targetUserId: string) => {
  const followingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
  const docSnap = await getDoc(followingRef);
  return docSnap.exists();
};

export const checkFriendship = async (currentUserId: string, targetUserId: string) => {
  const following = await isFollowing(currentUserId, targetUserId);
  const followedBy = await isFollowing(targetUserId, currentUserId);
  return { following, followedBy, isFriend: following && followedBy };
};

export const getFollowing = async (userId: string) => {
  try {
    const followingRef = collection(db, 'users', userId, 'following');
    const q = query(followingRef, limit(50));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ uid: doc.id, ...(doc.data() as any) }));
  } catch (error) {
    console.error("Error fetching following:", error);
    return [];
  }
};
