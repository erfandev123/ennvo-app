import { ref, onValue, set, onDisconnect, serverTimestamp as rtdbTimestamp } from 'firebase/database';
import { rtdb } from '../firebase';

export const setOnline = (userId: string) => {
  if (!userId) return;
  const presenceRef = ref(rtdb, `presence/${userId}`);
  set(presenceRef, { isOnline: true, lastSeen: rtdbTimestamp() }).catch(() => {});
  onDisconnect(presenceRef).set({ isOnline: false, lastSeen: rtdbTimestamp() }).catch(() => {});
};

export const setOffline = (userId: string) => {
  if (!userId) return;
  const presenceRef = ref(rtdb, `presence/${userId}`);
  set(presenceRef, { isOnline: false, lastSeen: rtdbTimestamp() }).catch(() => {});
};

export const subscribePresence = (userId: string, callback: (data: { isOnline: boolean, lastSeen: number }) => void) => {
  if (!userId) return () => {};
  const presenceRef = ref(rtdb, `presence/${userId}`);
  return onValue(presenceRef, (snapshot) => {
    callback(snapshot.val() || { isOnline: false, lastSeen: 0 });
  }, () => {});
};

export const setTyping = (conversationId: string, userId: string, isTyping: boolean) => {
  if (!conversationId || !userId) return;
  const typingRef = ref(rtdb, `typing/${conversationId}/${userId}`);
  set(typingRef, isTyping).catch(() => {});
  if (isTyping) {
    onDisconnect(typingRef).remove().catch(() => {});
  }
};

export const subscribeTyping = (conversationId: string, callback: (typingUsers: string[]) => void) => {
  if (!conversationId) return () => {};
  const typingRef = ref(rtdb, `typing/${conversationId}`);
  return onValue(typingRef, (snapshot) => {
    const data = snapshot.val() || {};
    const typingUsers = Object.keys(data).filter(uid => data[uid] === true);
    callback(typingUsers);
  }, () => {});
};
