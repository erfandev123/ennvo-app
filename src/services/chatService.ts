import { 
  collection, 
  addDoc, 
  setDoc, 
  doc, 
  getDoc,
  deleteDoc,
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  updateDoc, 
  increment,
  getDocs,
  writeBatch,
  limit
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Conversation, Message } from '../types';

export const createGroupConversation = async (creatorId: string, participantIds: string[], groupName: string, groupAvatar?: string) => {
  try {
    const allIds = [creatorId, ...participantIds];
    const unreadCount: { [uid: string]: number } = {};
    const participantNames: { [uid: string]: string } = {};
    const participantAvatars: { [uid: string]: string } = {};

    // For groups, we should really fetch user names from db. Let's do it right.
    const { getDoc } = await import('firebase/firestore');
    
    await Promise.all(allIds.map(async (id) => {
      unreadCount[id] = 0;
      try {
        const userDoc = await getDoc(doc(db, 'users', id));
        if (userDoc.exists()) {
          const name = userDoc.data().name || userDoc.data().username || 'User';
          participantNames[id] = name;
          participantAvatars[id] = userDoc.data().avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
        }
      } catch (e) {}
    }));

    const docRef = await addDoc(collection(db, 'conversations'), {
      participantIds: allIds,
      participantNames,
      participantAvatars,
      groupName, // Store properly
      groupAvatar: groupAvatar || null,
      isGroup: true,
      lastMessage: 'Group created',
      unreadCount,
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error: any) {
    throw new Error(error.message);
  }
}

export const createConversation = async (participantIds: string[], participants: { [uid: string]: { name: string, avatar: string } }) => {
  try {
    // Check if conversation already exists using current user ID for Firestore rule compliance
    const currentUid = auth.currentUser?.uid || participantIds[0];
    const q = query(
      collection(db, 'conversations'), 
      where('participantIds', 'array-contains', currentUid)
    );
    const querySnapshot = await getDocs(q);
    const existing = querySnapshot.docs.find(doc => {
      const data = doc.data();
      return (data.participantIds?.length === participantIds.length) && 
             participantIds.every(id => data.participantIds?.includes(id));
    });

    if (existing) {
      // Update names/avatars in case they changed
      const convRef = doc(db, 'conversations', existing.id);
      const participantNames: { [uid: string]: string } = {};
      const participantAvatars: { [uid: string]: string } = {};
      Object.entries(participants).forEach(([uid, data]) => {
        participantNames[uid] = data.name;
        participantAvatars[uid] = data.avatar;
      });
      await updateDoc(convRef, { participantNames, participantAvatars });
      return existing.id;
    }

    const unreadCount: { [uid: string]: number } = {};
    const participantNames: { [uid: string]: string } = {};
    const participantAvatars: { [uid: string]: string } = {};
    
    participantIds.forEach(id => {
      unreadCount[id] = 0;
      if (participants[id]) {
        participantNames[id] = participants[id].name;
        participantAvatars[id] = participants[id].avatar;
      }
    });

    const docRef = await addDoc(collection(db, 'conversations'), {
      participantIds,
      participantNames,
      participantAvatars,
      lastMessage: '',
      unreadCount,
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const sendMessage = async (conversationId: string, senderId: string, type: Message['type'], content: string, mediaUrl?: string, postId?: string, replyTo?: any) => {
  try {
    const messageData: any = {
      senderId,
      type,
      content: content || '',
      mediaUrl: mediaUrl || null,
      createdAt: serverTimestamp(),
      status: 'sent'
    };
    
    if (postId) messageData.postId = postId;
    if (replyTo) messageData.replyTo = replyTo;

    await addDoc(collection(db, 'conversations', conversationId, 'messages'), messageData);

    // Update conversation and increment unread count for others
    const convRef = doc(db, 'conversations', conversationId);
    try {
      const convSnap = await getDoc(convRef);
      if (convSnap.exists()) {
        const data = convSnap.data();
        const unreadCount = data.unreadCount || {};
        
        // Increment for everyone else
        data.participantIds?.forEach((id: string) => {
          if (id !== senderId) {
            unreadCount[id] = (unreadCount[id] || 0) + 1;
          }
        });

        await updateDoc(convRef, {
          lastMessage: type === 'text' ? content : `Sent a ${type}`,
          lastSenderId: senderId,
          lastMessageTime: serverTimestamp(),
          updatedAt: serverTimestamp(),
          unreadCount
        });
      }
    } catch (updateErr) {
      console.warn("Failed updating conversation lastMessage:", updateErr);
    }
  } catch (error: any) {
    console.error("SendMessage Error:", error);
    throw new Error(error.message);
  }
};

export const markMessagesDelivered = async (conversationId: string, userId: string) => {
  try {
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      where('senderId', '!=', userId),
      where('status', '==', 'sent')
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach(d => {
        batch.update(d.ref, { status: 'delivered' });
      });
      await batch.commit();
    }
  } catch (error: any) {
    console.error(error);
  }
};

export const markConversationRead = async (conversationId: string, userId: string) => {
  try {
    const convRef = doc(db, 'conversations', conversationId);
    updateDoc(convRef, {
      [`unreadCount.${userId}`]: 0
    }).catch(() => {});

    // Mark unread messages sent by others as seen
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'), 
      orderBy('createdAt', 'desc'),
      limit(25)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      let updated = false;
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.senderId !== userId && data.status !== 'seen') {
          batch.update(d.ref, { status: 'seen' });
          updated = true;
        }
      });
      if (updated) await batch.commit();
    }
  } catch (error: any) {
    console.error(error);
  }
};

export const subscribeMessages = (conversationId: string, callback: (messages: Message[]) => void, limitCount: number = 20) => {
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'), 
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
    callback(messages.reverse());
  }, () => {});
};

export const subscribeConversations = (userId: string, callback: (conversations: Conversation[]) => void) => {
  const q = query(
    collection(db, 'conversations'), 
    where('participantIds', 'array-contains', userId)
  );
  return onSnapshot(q, (snapshot) => {
    const conversations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
    // Sort client-side to avoid index requirement
    conversations.sort((a, b) => {
      const timeA = a.updatedAt?.toMillis?.() || 0;
      const timeB = b.updatedAt?.toMillis?.() || 0;
      return timeB - timeA;
    });
    callback(conversations);
  }, () => {});
};

export const logCallMessageInChat = async (
  caller: { uid: string; name: string; avatar: string },
  receiver: { uid: string; name: string; avatar: string },
  callType: 'audio' | 'video',
  status: 'accepted' | 'rejected' | 'ended' | 'missed',
  durationSecs: number = 0
) => {
  try {
    const convId = await createConversation(
      [caller.uid, receiver.uid],
      {
        [caller.uid]: { name: caller.name, avatar: caller.avatar },
        [receiver.uid]: { name: receiver.name, avatar: receiver.avatar }
      }
    );

    const icon = callType === 'video' ? '📹' : '📞';
    const typeLabel = callType === 'video' ? 'Video call' : 'Audio call';
    let text = '';

    const mins = Math.floor(durationSecs / 60);
    const secs = durationSecs % 60;
    let durationFormatted = '';
    if (mins > 0 && secs > 0) {
      durationFormatted = `${mins} min ${secs} sec`;
    } else if (mins > 0) {
      durationFormatted = `${mins} min`;
    } else {
      durationFormatted = `${secs} sec`;
    }

    if (status === 'missed') {
      text = `📵 Missed ${typeLabel.toLowerCase()} • 0 sec`;
    } else if (status === 'rejected') {
      text = `🚫 Declined ${typeLabel.toLowerCase()} • 0 sec`;
    } else {
      text = `${icon} ${typeLabel} • ${durationFormatted}`;
    }

    await sendMessage(convId, caller.uid, 'text', text);
  } catch (err) {
    console.error('Failed to log call message in chat:', err);
  }
};

export const leaveGroup = async (conversationId: string, userId: string, userName?: string) => {
  try {
    const convRef = doc(db, 'conversations', conversationId);
    const convSnap = await getDoc(convRef);
    if (!convSnap.exists()) return;
    const data = convSnap.data();

    const currentParticipants: string[] = data.participantIds || [];
    const updatedParticipants = currentParticipants.filter(id => id !== userId);

    if (updatedParticipants.length === 0) {
      await deleteDoc(convRef);
      return;
    }

    const participantNames = { ...(data.participantNames || {}) };
    const participantAvatars = { ...(data.participantAvatars || {}) };
    const unreadCount = { ...(data.unreadCount || {}) };

    delete participantNames[userId];
    delete participantAvatars[userId];
    delete unreadCount[userId];

    await updateDoc(convRef, {
      participantIds: updatedParticipants,
      participantNames,
      participantAvatars,
      unreadCount,
      lastMessage: `${userName || 'A member'} left the group`,
      updatedAt: serverTimestamp()
    });

    // Send system message in chat
    await sendMessage(conversationId, userId, 'text', `🚪 ${userName || 'User'} left the group`);
  } catch (err: any) {
    console.error('Failed to leave group:', err);
    throw new Error(err.message);
  }
};

export const deleteConversation = async (conversationId: string) => {
  try {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'conversations', conversationId));
  } catch (err: any) {
    console.error('Failed to delete conversation:', err);
    throw new Error(err.message);
  }
};

export const addParticipantsToGroup = async (conversationId: string, newParticipantIds: string[]) => {
  try {
    const convRef = doc(db, 'conversations', conversationId);
    const convSnap = await getDoc(convRef);
    if (!convSnap.exists()) return;
    const data = convSnap.data();

    const currentIds: string[] = data.participantIds || [];
    const combined = Array.from(new Set([...currentIds, ...newParticipantIds]));

    const participantNames = { ...(data.participantNames || {}) };
    const participantAvatars = { ...(data.participantAvatars || {}) };
    const unreadCount = { ...(data.unreadCount || {}) };

    await Promise.all(newParticipantIds.map(async (id) => {
      unreadCount[id] = 0;
      try {
        const userDoc = await getDoc(doc(db, 'users', id));
        if (userDoc.exists()) {
          const u = userDoc.data();
          const name = u.name || u.username || 'User';
          participantNames[id] = name;
          participantAvatars[id] = u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
        }
      } catch (e) {}
    }));

    await updateDoc(convRef, {
      participantIds: combined,
      participantNames,
      participantAvatars,
      unreadCount,
      updatedAt: serverTimestamp()
    });
  } catch (err: any) {
    console.error('Failed to add members to group:', err);
    throw new Error(err.message);
  }
};
