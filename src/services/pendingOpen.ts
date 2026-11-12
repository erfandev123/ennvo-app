/**
 * Applies the notification or deep link that opened the app.
 *
 * It runs before the very first render, so tapping a chat notification opens
 * the chat directly and tapping an activity notification opens that post
 * instead of showing the reels feed first.
 */
import { bridge } from '../native/bridge';
import { useAppStore } from '../store';

let applied = false;

export const applyPendingOpen = (force = false): void => {
  if (applied && !force) return;
  applied = true;
  try {
    const pending = bridge.consumePendingOpen();
    if (!pending) return;
    const store = useAppStore.getState();

    // Activity notification with a direct target (post, reel, story, profile).
    if (pending.url) {
      import('./deepLinkService')
        .then((m) => m.openFromLink(pending.url as string))
        .catch(() => {});
      return;
    }

    if (pending.type === 'chat' && pending.convId) {
      store.pushPage('messages');
      store.setActiveChat(pending.convId);
      return;
    }

    if (pending.type === 'activity' || pending.page === 'activity') {
      store.pushPage('notifications');
      return;
    }

    if (pending.page) store.setCurrentPage(pending.page as any);
  } catch (e) {
    console.warn('[PendingOpen] could not be applied:', e);
  }
};
