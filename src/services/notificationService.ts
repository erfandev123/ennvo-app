import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, getDoc, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Notification, User } from '../types';

export const sendNotification = async (
  userId: string | undefined | null, 
  type: Notification['type'], 
  actor: User, 
  targetId: string,
  postId: string | null = null,
  postMedia: string | null = null,
  content: string | null = null,
  postAuthorName: string | null = null,
  postAuthorAvatar: string | null = null
) => {
  let targetUid = userId;

  // If userId is missing, automatically resolve from postId
  if ((!targetUid || targetUid === 'undefined') && postId) {
    try {
      const postSnap = await getDoc(doc(db, 'posts', postId));
      if (postSnap.exists()) {
        const pData = postSnap.data();
        targetUid = pData.authorId || pData.authorUID || pData.userId;
      }
    } catch (e) {
      // Ignore lookup error
    }
  }

  // Never notify oneself or empty target
  if (!targetUid || targetUid === actor.uid) return;

  try {
    await addDoc(collection(db, 'notifications', targetUid, 'items'), {
      type,
      actorId: actor.uid,
      actorName: actor.name || 'Ennvo User',
      actorAvatar: actor.avatar || '',
      targetId: targetId || postId || '',
      postId: postId ?? null,
      postMedia: postMedia ?? null,
      postAuthorName: postAuthorName ?? null,
      postAuthorAvatar: postAuthorAvatar ?? null,
      content: content ?? null,
      isRead: false,
      createdAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.warn('[NotificationService] sendNotification error:', error);
  }
};

export const subscribeNotifications = (userId: string, callback: (notifications: Notification[]) => void) => {
  const q = query(
    collection(db, 'notifications', userId, 'items'), 
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
    callback(notifications);
  }, (err) => console.warn('[NotificationService] subscribe error:', err));
};

export const markAllRead = async (userId: string) => {
  try {
    const q = query(collection(db, 'notifications', userId, 'items'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    querySnapshot.docs.forEach((doc) => {
      if (!doc.data().isRead) {
        batch.update(doc.ref, { isRead: true });
      }
    });
    await batch.commit();
  } catch (error: any) {
    console.warn('[NotificationService] markAllRead error:', error);
  }
};
