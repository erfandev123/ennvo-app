/**
 * Non-blocking localStorage cache writes.
 *
 * The chat and reels caches used to be serialised on every single update. A
 * single message therefore cost a full JSON.stringify of the whole cache on
 * the main thread, which dropped frames exactly while the user was reading a
 * new message. The writes are now debounced and trimmed, so the UI thread
 * stays free and the cache stays useful.
 */

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Debounced write. The last value wins, nothing is written while typing. */
export const persist = (key: string, value: any, delay = 900): void => {
  if (typeof window === 'undefined') return;
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        // Quota exceeded: drop the cache instead of failing the app.
        try { localStorage.removeItem(key); } catch (e2) {}
      }
    }, delay)
  );
};

/**
 * Keeps the chat cache small: only the last few conversations and the last
 * few messages of each one. Firestore always has the full history, so the
 * cache only exists to make the app open instantly.
 */
export const trimChatCache = (cache: Record<string, any[]>): Record<string, any[]> => {
  const out: Record<string, any[]> = {};
  const ids = Object.keys(cache || {});
  ids.slice(-14).forEach((id) => {
    const list = cache[id] || [];
    out[id] = list.slice(-40);
  });
  return out;
};

/**
 * The reels cache holds base64 thumbnails, so a raw dump is easily over a
 * megabyte. The thumbnail is only used as a placeholder, so it is dropped
 * from the cache and the poster is fetched again when it is needed.
 */
export const trimReelsCache = (reels: any[]): any[] =>
  (reels || []).slice(0, 24).map((reel: any) => {
    if (!reel) return reel;
    if (typeof reel.thumbnailUrl === 'string' && reel.thumbnailUrl.startsWith('data:')) {
      const { thumbnailUrl, ...rest } = reel;
      return rest;
    }
    return reel;
  });
