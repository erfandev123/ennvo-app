/**
 * Offline Media & Video Storage Service
 * Enables TikTok-like offline video and photo caching using CacheStorage & IndexedDB
 */

const CACHE_NAME = 'ennvo-offline-media-v1';
const INDEX_KEY = 'ennvo_offline_media_index_v1';

export interface OfflineMediaItem {
  id: string;
  originalUrl: string;
  type: 'video' | 'image' | 'audio';
  title?: string;
  authorName?: string;
  authorAvatar?: string;
  savedAt: number;
  sizeBytes?: number;
}

// Get the index of offline saved items
export const getOfflineMediaIndex = (): OfflineMediaItem[] => {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

// Check if a URL or ID is saved offline
export const isMediaOffline = (idOrUrl: string): boolean => {
  const index = getOfflineMediaIndex();
  return index.some(item => item.id === idOrUrl || item.originalUrl === idOrUrl);
};

// Save a media file into CacheStorage for offline playback
export const saveMediaOffline = async (
  item: {
    id: string;
    url: string;
    type?: 'video' | 'image' | 'audio';
    title?: string;
    authorName?: string;
    authorAvatar?: string;
  },
  onProgress?: (progress: number) => void
): Promise<boolean> => {
  if (!item.url || typeof window === 'undefined') return false;

  try {
    if (!('caches' in window)) {
      console.warn('CacheStorage not supported in this environment');
      return false;
    }

    const cache = await caches.open(CACHE_NAME);

    // Fetch media with CORS
    const response = await fetch(item.url, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`Failed to fetch media: ${response.statusText}`);
    }

    // Clone response to put into cache
    await cache.put(item.url, response.clone());

    // Update metadata index
    const index = getOfflineMediaIndex();
    const existingIdx = index.findIndex(i => i.id === item.id || i.originalUrl === item.url);
    const mediaType = item.type || (item.url.includes('.mp4') || item.url.includes('video') ? 'video' : 'image');

    const newItem: OfflineMediaItem = {
      id: item.id,
      originalUrl: item.url,
      type: mediaType,
      title: item.title || '',
      authorName: item.authorName || '',
      authorAvatar: item.authorAvatar || '',
      savedAt: Date.now(),
    };

    if (existingIdx > -1) {
      index[existingIdx] = newItem;
    } else {
      index.unshift(newItem);
    }

    localStorage.setItem(INDEX_KEY, JSON.stringify(index.slice(0, 100)));
    return true;
  } catch (err) {
    console.error('saveMediaOffline error:', err);
    return false;
  }
};

// Retrieve an offline cached Blob URL for a media file
export const getOfflineMediaBlobUrl = async (url: string): Promise<string | null> => {
  if (!url || typeof window === 'undefined' || !('caches' in window)) return null;

  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(url);
    if (cachedResponse) {
      const blob = await cachedResponse.blob();
      return URL.createObjectURL(blob);
    }
  } catch (err) {
    console.warn('Error reading from offline media cache:', err);
  }
  return null;
};

// Remove a media item from offline storage
export const removeOfflineMedia = async (idOrUrl: string): Promise<boolean> => {
  if (typeof window === 'undefined' || !('caches' in window)) return false;

  try {
    const cache = await caches.open(CACHE_NAME);
    const index = getOfflineMediaIndex();
    const target = index.find(i => i.id === idOrUrl || i.originalUrl === idOrUrl);

    if (target) {
      await cache.delete(target.originalUrl);
      const newIndex = index.filter(i => i.id !== target.id && i.originalUrl !== target.originalUrl);
      localStorage.setItem(INDEX_KEY, JSON.stringify(newIndex));
      return true;
    }
  } catch (e) {
    console.error('Failed to remove offline media:', e);
  }
  return false;
};
