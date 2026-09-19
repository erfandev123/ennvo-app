import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp, 
  doc, 
  setDoc, 
  deleteDoc,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import { CustomSticker } from '../types';

export interface CuratedSticker {
  id: string;
  url: string;
  title: string;
  category: 'trending' | 'anime' | 'cats' | 'memes' | 'love' | 'live' | '3d';
  tags: string[];
  type: 'image' | 'animated' | 'video';
}

// Curated Emojis Categorized
export const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    name: 'Smileys',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', 
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', 
      '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', 
      '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', 
      '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', 
      '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', 
      '🧐', '😕', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '😦', 
      '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞'
    ]
  },
  {
    id: 'love',
    name: 'Love & Hearts',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', 
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💌', 
      '💋', '💍', '💐', '🌹', '🥀', '🌺', '🌸', '✨', '⭐', '🌟'
    ]
  },
  {
    id: 'gestures',
    name: 'Hands & People',
    icon: '👍',
    emojis: [
      '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', 
      '👆', '🖕', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏', 
      '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', 
      '👑', '🔥', '💯', '✨', '💥', '🎉', '🎊', '🎈', '🏆', '🥇'
    ]
  },
  {
    id: 'animals',
    name: 'Animals & Pets',
    icon: '🐱',
    emojis: [
      '🐱', '🐶', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', 
      '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', 
      '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋'
    ]
  },
  {
    id: 'food',
    name: 'Food & Drinks',
    icon: '🍕',
    emojis: [
      '🍕', '🍔', '🍟', '🌭', '🍿', '🥓', '🍳', '🥞', '🧇', '🧀', 
      '🥗', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🍤', '🍙', 
      '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🍫', '🍬', 
      '☕', '🍵', '🧃', '🥤', '🍺', '🍻', '🥂', '🍷', '🥃', '🍹'
    ]
  },
  {
    id: 'activities',
    name: 'Fun & Cool',
    icon: '🎮',
    emojis: [
      '🎮', '🕹️', '🎯', '🎲', '🎰', ' bowling', '⚽', '🏀', '🏈', '⚾', 
      '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥊', '🥋', '🛹', '🚴', 
      '🎸', '🎹', '🥁', '🎷', '🎺', '🎤', '🎧', '🎬', '🎨', '🚀'
    ]
  }
];

// Local storage keys
const getSavedStickersStorageKey = (userId: string) => `ennvo_stickers_saved_${userId}`;
const getCreatedStickersStorageKey = (userId: string) => `ennvo_stickers_created_${userId}`;

/**
 * Fetch user-created stickers from Firestore (no external APIs)
 */
export const fetchCommunityStickers = async (): Promise<CustomSticker[]> => {
  try {
    const q = query(
      collection(db, 'stickers'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    const snap = await getDocs(q);
    const list: CustomSticker[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        url: data.url,
        title: data.title || 'User Sticker',
        type: data.type || 'image',
        authorId: data.authorId || 'community',
        authorName: data.authorName || 'Creator',
        authorAvatar: data.authorAvatar,
        tags: data.tags || [],
        isPublic: true,
        createdAt: data.createdAt
      });
    });
    return list;
  } catch (err) {
    console.warn('Failed to fetch stickers from Firestore:', err);
    return [];
  }
};

/**
 * Save / Publish a new Custom Sticker to Firestore database
 */
export const createCustomSticker = async (
  sticker: Omit<CustomSticker, 'id' | 'createdAt'>
): Promise<CustomSticker> => {
  try {
    const docData = {
      ...sticker,
      isPublic: true,
      createdAt: serverTimestamp()
    };
    const docRef = await addDoc(collection(db, 'stickers'), docData);
    
    const newSticker: CustomSticker = {
      id: docRef.id,
      ...sticker,
      isPublic: true,
      createdAt: new Date().toISOString()
    };

    // Cache locally as well
    try {
      const localKey = getCreatedStickersStorageKey(sticker.authorId);
      const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
      localStorage.setItem(localKey, JSON.stringify([newSticker, ...existing]));
    } catch (e) {}

    return newSticker;
  } catch (err: any) {
    console.error('Error creating custom sticker in Firestore:', err);
    const offlineId = `stk_local_${Date.now()}`;
    const newSticker: CustomSticker = {
      id: offlineId,
      ...sticker,
      isPublic: true,
      createdAt: new Date().toISOString()
    };
    try {
      const localKey = getCreatedStickersStorageKey(sticker.authorId);
      const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
      localStorage.setItem(localKey, JSON.stringify([newSticker, ...existing]));
    } catch (e) {}
    return newSticker;
  }
};

/**
 * Get User Created Stickers (from Firestore + Local Cache)
 */
export const getUserCreatedStickers = async (userId: string): Promise<CustomSticker[]> => {
  const localKey = getCreatedStickersStorageKey(userId);
  const localList: CustomSticker[] = JSON.parse(localStorage.getItem(localKey) || '[]');
  
  try {
    const q = query(
      collection(db, 'stickers'),
      where('authorId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    const remoteList: CustomSticker[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      remoteList.push({
        id: docSnap.id,
        url: d.url,
        title: d.title || 'My Sticker',
        type: d.type || 'image',
        authorId: d.authorId,
        authorName: d.authorName,
        authorAvatar: d.authorAvatar,
        tags: d.tags || [],
        isPublic: true,
        createdAt: d.createdAt
      });
    });

    const merged = [...remoteList];
    localList.forEach(loc => {
      if (!merged.some(m => m.id === loc.id || m.url === loc.url)) {
        merged.push(loc);
      }
    });
    return merged;
  } catch (e) {
    return localList;
  }
};

/**
 * User Saved / Favorite Stickers
 */
export const getSavedStickers = (userId: string): { id: string; url: string; title?: string; type?: 'image' | 'video' | 'animated' }[] => {
  if (!userId) return [];
  try {
    const key = getSavedStickersStorageKey(userId);
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
};

export const isStickerSaved = (userId: string, stickerUrl: string): boolean => {
  if (!userId || !stickerUrl) return false;
  const list = getSavedStickers(userId);
  return list.some(s => s.url === stickerUrl);
};

export const toggleSaveSticker = (
  userId: string, 
  sticker: { id: string; url: string; title?: string; type?: 'image' | 'video' | 'animated' }
): boolean => {
  if (!userId || !sticker.url) return false;
  const key = getSavedStickersStorageKey(userId);
  const list = getSavedStickers(userId);
  const existsIndex = list.findIndex(s => s.url === sticker.url);
  
  let nowSaved = false;
  if (existsIndex >= 0) {
    list.splice(existsIndex, 1);
    nowSaved = false;
  } else {
    list.unshift(sticker);
    nowSaved = true;
  }
  
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch (e) {}

  try {
    const sanitizedId = btoa(encodeURIComponent(sticker.url)).replace(/[/+=]/g, '_').substring(0, 60);
    const saveDocRef = doc(db, 'users', userId, 'saved_stickers', sanitizedId);
    if (nowSaved) {
      setDoc(saveDocRef, { ...sticker, savedAt: serverTimestamp() }).catch(() => {});
    } else {
      deleteDoc(saveDocRef).catch(() => {});
    }
  } catch (e) {}

  return nowSaved;
};

/**
 * Delete a user created sticker
 */
export const deleteCustomSticker = async (userId: string, stickerId: string): Promise<boolean> => {
  try {
    await deleteDoc(doc(db, 'stickers', stickerId));
  } catch (e) {}

  try {
    const localKey = getCreatedStickersStorageKey(userId);
    const existing: CustomSticker[] = JSON.parse(localStorage.getItem(localKey) || '[]');
    const updated = existing.filter(s => s.id !== stickerId);
    localStorage.setItem(localKey, JSON.stringify(updated));
  } catch (e) {}

  return true;
};

/**
 * Smart Instant Sticker Suggestions based strictly on user created stickers
 */
export const getSmartStickerSuggestions = (
  inputText: string, 
  communityStickers: CustomSticker[] = []
): CuratedSticker[] => {
  if (!inputText || !inputText.trim()) return [];
  const queryText = inputText.trim().toLowerCase();
  
  const allAvailable: CuratedSticker[] = communityStickers.map(c => ({
    id: c.id,
    url: c.url,
    title: c.title || 'User Sticker',
    category: 'trending' as const,
    tags: c.tags || ['custom', 'community'],
    type: c.type || 'image'
  }));

  const matches = allAvailable.filter(stk => {
    if (stk.title.toLowerCase().includes(queryText)) return true;
    return stk.tags.some(tag => tag.toLowerCase().includes(queryText) || queryText.includes(tag.toLowerCase()));
  });

  return matches.slice(0, 8);
};
