import { getRtdbInstance } from '../firebase';

type RtdbApi = typeof import('firebase/database') & { db: any };
let rtdbApi: Promise<RtdbApi> | null = null;

const rtdb = (): Promise<RtdbApi> => {
  if (!rtdbApi) {
    rtdbApi = (async () => {
      const [api, db] = await Promise.all([import('firebase/database'), getRtdbInstance()]);
      return { ...api, db };
    })();
  }
  return rtdbApi;
};

export const setOnline = (userId: string) => {
  if (!userId) return;
  rtdb().then(({ ref, set, onDisconnect, serverTimestamp, db }) => {
    const presenceRef = ref(db, `presence/${userId}`);
    set(presenceRef, { isOnline: true, lastSeen: serverTimestamp() }).catch(() => {});
    onDisconnect(presenceRef).set({ isOnline: false, lastSeen: serverTimestamp() }).catch(() => {});
  }).catch(() => {});
};

export const setOffline = (userId: string) => {
  if (!userId) return;
  rtdb().then(({ ref, set, serverTimestamp, db }) => {
    const presenceRef = ref(db, `presence/${userId}`);
    set(presenceRef, { isOnline: false, lastSeen: serverTimestamp() }).catch(() => {});
  }).catch(() => {});
};

export const subscribePresence = (userId: string, callback: (data: { isOnline: boolean, lastSeen: number }) => void) => {
  if (!userId) return () => {};
  let unsubscribe: (() => void) | null = null;
  let cancelled = false;
  rtdb().then(({ ref, onValue, db }) => {
    if (cancelled) return;
    unsubscribe = onValue(ref(db, `presence/${userId}`), (snapshot: any) => {
      callback(snapshot.val() || { isOnline: false, lastSeen: 0 });
    }, () => {});
  }).catch(() => {});
  return () => {
    cancelled = true;
    if (unsubscribe) unsubscribe();
  };
};

export const setTyping = (conversationId: string, userId: string, isTyping: boolean) => {
  if (!conversationId || !userId) return;
  rtdb().then(({ ref, set, onDisconnect, db }) => {
    const typingRef = ref(db, `typing/${conversationId}/${userId}`);
    set(typingRef, isTyping).catch(() => {});
    if (isTyping) {
      onDisconnect(typingRef).remove().catch(() => {});
    }
  }).catch(() => {});
  // Sync to Firestore conversation doc for real-time background and in-app toasts
  import('./chatService').then(({ setTypingStatus }) => {
    setTypingStatus(conversationId, userId, isTyping).catch(() => {});
  }).catch(() => {});
};

export const subscribeTyping = (conversationId: string, callback: (typingUsers: string[]) => void) => {
  if (!conversationId) return () => {};
  let unsubscribe: (() => void) | null = null;
  let cancelled = false;
  rtdb().then(({ ref, onValue, db }) => {
    if (cancelled) return;
    unsubscribe = onValue(ref(db, `typing/${conversationId}`), (snapshot: any) => {
      const data = snapshot.val() || {};
      callback(Object.keys(data).filter((uid) => data[uid] === true));
    }, () => {});
  }).catch(() => {});
  return () => {
    cancelled = true;
    if (unsubscribe) unsubscribe();
  };
};
