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

/**
 * Compress base64 image strings to ensure they stay well under Firestore's 1,048,487 byte document limit.
 */
export const compressChatImageBase64 = async (dataUrl: string, maxDim = 1000, quality = 0.75): Promise<string> => {
  if (!dataUrl || typeof dataUrl !== 'string') return dataUrl;
  if (!dataUrl.startsWith('data:image/')) return dataUrl;
  if (dataUrl.length < 600000) return dataUrl; // Already small enough (< 600 KB)

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
      } catch (e) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

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

export const createConversation = async (
  participantIds: string[], 
  participants: { [uid: string]: { name: string, avatar: string } },
  options?: { isRequest?: boolean; requestTo?: string; requestFrom?: string }
) => {
  try {
    // Check if conversation already exists using current user ID for Firestore rule compliance
    const currentUid = auth.currentUser?.uid || participantIds[0];

    // Privacy and blocking validation for direct chats
    if (participantIds.length === 2) {
      const otherId = participantIds.find(id => id !== currentUid);
      if (otherId) {
        try {
          const theirBlockedSnap = await getDoc(doc(db, 'users', otherId, 'blockedUsers', currentUid));
          if (theirBlockedSnap.exists()) {
            throw new Error("You cannot send messages to this account.");
          }
          const myBlockedSnap = await getDoc(doc(db, 'users', currentUid, 'blockedUsers', otherId));
          if (myBlockedSnap.exists()) {
            throw new Error("You have blocked this user. Unblock them first to send a message.");
          }

          const targetSnap = await getDoc(doc(db, 'users', otherId));
          if (targetSnap.exists()) {
            const tData = targetSnap.data();
            if (tData.whoCanMessage === 'no_one') {
              throw new Error("This user doesn't allow direct messages.");
            }
            if (tData.whoCanMessage === 'friends') {
              const myFollow = await getDoc(doc(db, 'users', currentUid, 'following', otherId));
              const theirFollow = await getDoc(doc(db, 'users', otherId, 'following', currentUid));
              if (!myFollow.exists() || !theirFollow.exists()) {
                throw new Error("Only friends can send direct messages to this user.");
              }
            }
          }
        } catch (privErr: any) {
          if (privErr.message?.includes('cannot') || privErr.message?.includes('blocked') || privErr.message?.includes('messages')) {
            throw privErr;
          }
        }
      }
    }

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

    // Check if message request should be flagged
    let isRequest = options?.isRequest || false;
    let requestTo = options?.requestTo;
    let requestFrom = options?.requestFrom || currentUid;

    if (!isRequest && participantIds.length === 2) {
      const otherId = participantIds.find(id => id !== currentUid);
      if (otherId) {
        try {
          // Check if target user is following current user
          const followerCheck = await getDoc(doc(db, 'users', otherId, 'followers', currentUid));
          if (!followerCheck.exists()) {
            isRequest = true;
            requestTo = otherId;
            requestFrom = currentUid;
          }
        } catch (e) {
          // Default to non-request if check fails
        }
      }
    }

    const convPayload: any = {
      participantIds,
      participantNames,
      participantAvatars,
      lastMessage: '',
      unreadCount,
      updatedAt: serverTimestamp(),
    };

    if (isRequest && requestTo) {
      convPayload.isRequest = true;
      convPayload.requestTo = requestTo;
      convPayload.requestFrom = requestFrom;
      convPayload.requestStatus = 'pending';
      convPayload.requestMessageCount = 0;
    }

    const docRef = await addDoc(collection(db, 'conversations'), convPayload);

    return docRef.id;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const sendMessage = async (
  conversationId: string, 
  senderId: string, 
  type: Message['type'], 
  content: string, 
  mediaUrl?: string, 
  postId?: string, 
  replyTo?: any,
  extra?: {
    mediaUrls?: string[];
    mediaItems?: { type: 'image' | 'video'; url: string }[];
  }
) => {
  try {
    const convRef = doc(db, 'conversations', conversationId);
    let convData: any = null;
    try {
      const convSnap = await getDoc(convRef);
      if (convSnap.exists()) {
        convData = convSnap.data();

        // Check if blocked
        if (convData.participantIds?.length === 2) {
          const otherParticipantId = convData.participantIds.find((id: string) => id !== senderId);
          if (otherParticipantId) {
            const blockedCheck = await getDoc(doc(db, 'users', otherParticipantId, 'blockedUsers', senderId));
            if (blockedCheck.exists()) {
              throw new Error("You cannot send messages to this account.");
            }
            const myBlockedCheck = await getDoc(doc(db, 'users', senderId, 'blockedUsers', otherParticipantId));
            if (myBlockedCheck.exists()) {
              throw new Error("You have blocked this user. Unblock them first to send a message.");
            }
          }
        }

        if (convData.isRequest && convData.requestStatus === 'pending') {
          if (convData.requestFrom === senderId) {
            const currentCount = convData.requestMessageCount || 0;
            if (currentCount >= 2) {
              throw new Error("You can only send up to 2 messages until the recipient accepts your message request.");
            }
          }
        }
      }
    } catch (e: any) {
      if (e.message?.includes('up to 2 messages') || e.message?.includes('blocked') || e.message?.includes('cannot send')) {
        throw e;
      }
    }

    let processedMediaUrl = mediaUrl || null;
    if (processedMediaUrl && processedMediaUrl.startsWith('data:image/')) {
      processedMediaUrl = await compressChatImageBase64(processedMediaUrl);
    }

    let processedMediaUrls = extra?.mediaUrls ? [...extra.mediaUrls] : undefined;
    if (processedMediaUrls && processedMediaUrls.length > 0) {
      processedMediaUrls = await Promise.all(
        processedMediaUrls.map(async (u) => u.startsWith('data:image/') ? await compressChatImageBase64(u) : u)
      );
    }

    let processedMediaItems = extra?.mediaItems ? [...extra.mediaItems] : undefined;
    if (processedMediaItems && processedMediaItems.length > 0) {
      processedMediaItems = await Promise.all(
        processedMediaItems.map(async (m) => ({
          ...m,
          url: m.url?.startsWith('data:image/') ? await compressChatImageBase64(m.url) : m.url
        }))
      );
    }

    const messageData: any = {
      senderId,
      type,
      content: content || '',
      mediaUrl: processedMediaUrl,
      createdAt: serverTimestamp(),
      status: 'sent'
    };
    
    if (postId) messageData.postId = postId;
    if (replyTo) messageData.replyTo = replyTo;
    if (processedMediaUrls && processedMediaUrls.length > 0) {
      messageData.mediaUrls = processedMediaUrls;
    }
    if (processedMediaItems && processedMediaItems.length > 0) {
      messageData.mediaItems = processedMediaItems;
      if (!messageData.mediaUrls) {
        messageData.mediaUrls = processedMediaItems.map(m => m.url);
      }
    }

    await addDoc(collection(db, 'conversations', conversationId, 'messages'), messageData);

    // Update conversation and increment unread count for others
    try {
      if (convData) {
        const unreadCount = convData.unreadCount || {};
        
        // Increment for everyone else
        convData.participantIds?.forEach((id: string) => {
          if (id !== senderId) {
            unreadCount[id] = (unreadCount[id] || 0) + 1;
          }
        });

        const totalItemsCount = extra?.mediaUrls?.length || extra?.mediaItems?.length || 0;
        const lastMsgLabel = totalItemsCount > 1
          ? `Sent ${totalItemsCount} photos/videos`
          : (type === 'text' ? content : `Sent a ${type}`);

        const updatePayload: any = {
          lastMessage: lastMsgLabel,
          lastSenderId: senderId,
          lastMessageTime: serverTimestamp(),
          updatedAt: serverTimestamp(),
          unreadCount
        };

        if (convData.isRequest && convData.requestStatus === 'pending' && convData.requestFrom === senderId) {
          updatePayload.requestMessageCount = increment(1);
        }

        await updateDoc(convRef, updatePayload);
      }
    } catch (updateErr) {
      console.warn("Failed updating conversation lastMessage:", updateErr);
    }
  } catch (error: any) {
    console.error("SendMessage Error:", error);
    throw new Error(error.message);
  }
};

export const acceptConversationRequest = async (conversationId: string) => {
  try {
    const convRef = doc(db, 'conversations', conversationId);
    await updateDoc(convRef, {
      isRequest: false,
      requestStatus: 'accepted',
      updatedAt: serverTimestamp()
    });
  } catch (err: any) {
    console.error("acceptConversationRequest error:", err);
    throw new Error(err.message);
  }
};

export const declineConversationRequest = async (conversationId: string) => {
  try {
    const convRef = doc(db, 'conversations', conversationId);
    await updateDoc(convRef, {
      requestStatus: 'declined',
      updatedAt: serverTimestamp()
    });
  } catch (err: any) {
    console.error("declineConversationRequest error:", err);
    throw new Error(err.message);
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
  // 1. Instant Offline Cache Load
  try {
    const cached = localStorage.getItem(`ennvo_offline_msgs_${conversationId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        callback(parsed);
      }
    }
  } catch (e) {}

  const q = query(
    collection(db, 'conversations', conversationId, 'messages'), 
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
    const reversed = messages.reverse();
    try {
      localStorage.setItem(`ennvo_offline_msgs_${conversationId}`, JSON.stringify(reversed.slice(-50)));
    } catch (e) {}
    callback(reversed);
  }, (err) => {
    console.warn("Firestore messages snapshot notice:", err);
  });
};

export const subscribeConversations = (userId: string, callback: (conversations: Conversation[]) => void) => {
  // 1. Instant Offline Cache Load
  try {
    const cached = localStorage.getItem(`ennvo_offline_convs_${userId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        callback(parsed);
      }
    }
  } catch (e) {}

  const q = query(
    collection(db, 'conversations'), 
    where('participantIds', 'array-contains', userId)
  );
  return onSnapshot(q, (snapshot) => {
    const conversations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
    // Sort client-side to avoid index requirement
    conversations.sort((a: any, b: any) => {
      const getT = (item: any) => {
        if (typeof item.updatedAt?.toMillis === 'function') return item.updatedAt.toMillis();
        if (typeof item.lastMessageTime === 'number') return item.lastMessageTime;
        if (typeof item.lastMessageTime?.toMillis === 'function') return item.lastMessageTime.toMillis();
        if (typeof item.createdAt?.toMillis === 'function') return item.createdAt.toMillis();
        if (typeof item.createdAt === 'number') return item.createdAt;
        return 0;
      };
      return getT(b) - getT(a);
    });
    try {
      localStorage.setItem(`ennvo_offline_convs_${userId}`, JSON.stringify(conversations));
    } catch (e) {}
    callback(conversations);
  }, (err) => {
    console.warn("Firestore conversations snapshot notice:", err);
  });
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

export const updateConversationTheme = async (conversationId: string, theme: string, userName?: string, userId?: string) => {
  try {
    const convRef = doc(db, 'conversations', conversationId);
    await updateDoc(convRef, {
      theme,
      updatedAt: serverTimestamp()
    });

    if (userId) {
      await sendMessage(conversationId, userId, 'system', `Wallpaper changed by ${userName || 'User'}`);
    }
  } catch (err: any) {
    console.error('Failed to update conversation theme:', err);
    throw new Error(err.message);
  }
};

export const setTypingStatus = async (conversationId: string, userId: string, isTyping: boolean) => {
  if (!conversationId || !userId) return;
  try {
    const convRef = doc(db, 'conversations', conversationId);
    if (isTyping) {
      await updateDoc(convRef, {
        [`typing.${userId}`]: Date.now()
      }).catch(() => {});
    } else {
      const { deleteField } = await import('firebase/firestore');
      await updateDoc(convRef, {
        [`typing.${userId}`]: deleteField()
      }).catch(() => {});
    }
  } catch (e) {
    // Ignore non-critical typing errors
  }
};

export const subscribeTypingStatus = (conversationId: string, callback: (typingUserIds: string[]) => void) => {
  if (!conversationId) return () => {};
  const convRef = doc(db, 'conversations', conversationId);
  
  return onSnapshot(convRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const data = snapshot.data();
    const typingMap = data.typing || {};
    const now = Date.now();
    const activeTypingUids: string[] = [];

    Object.keys(typingMap).forEach((uid) => {
      const timestamp = typingMap[uid];
      if (timestamp && (now - timestamp < 4000)) {
        activeTypingUids.push(uid);
      }
    });

    callback(activeTypingUids);
  }, (err) => {
    callback([]);
  });
};


