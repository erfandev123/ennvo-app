/**
 * Ennvo Deep Link and Web URL Routing Layer
 * Supports:
 *  - /user/<id or username>, /profile/<id or username>, /account/<username>
 *  - /home
 *  - /feed (Social Feed)
 *  - /reels (Short video reels)
 *  - /messages & /massage (Direct chats, /messages/<chatId>)
 *  - /profile (My Profile)
 *  - /search & /explore
 *  - /notifications
 *  - /settings
 *  - /post/<id>, /reel/<id>
 *  - Native Capacitor appUrlOpen and web browser URL synchronization
 */

import { App as CapApp } from '@capacitor/app';
import { useAppStore, PageType } from '../store';
import { getPost } from './postService';
import { getUserByUsernameOrId } from './userService';

export interface ParsedDeepLink {
  type: 'account' | 'post' | 'reel' | 'chat' | 'page' | 'auth' | 'unknown';
  param?: string;
  originalUrl: string;
}

export const parseDeepLink = (rawUrl: string): ParsedDeepLink => {
  if (!rawUrl) return { type: 'unknown', originalUrl: '' };

  try {
    let path = rawUrl;
    if (rawUrl.includes('://')) {
      const parsed = new URL(rawUrl);
      path = parsed.pathname;
    }

    const segments = path.replace(/^\//, '').split('/').filter(Boolean);

    if (segments.length === 0) {
      return { type: 'page', param: 'home', originalUrl: rawUrl };
    }

    const prefix = segments[0].toLowerCase();
    const param = segments[1];

    if (prefix === 'account' || prefix === 'profile' || prefix === 'user' || prefix === 'u') {
      if (param) {
        return { type: 'account', param, originalUrl: rawUrl };
      }
      return { type: 'page', param: 'profile', originalUrl: rawUrl };
    }
    if (prefix === 'post' || prefix === 'p') {
      return { type: 'post', param: param || '', originalUrl: rawUrl };
    }
    if (prefix === 'reel' || prefix === 'reels' || prefix === 'r') {
      if (param) {
        return { type: 'reel', param, originalUrl: rawUrl };
      }
      return { type: 'page', param: 'home', originalUrl: rawUrl };
    }
    if (prefix === 'feed') {
      return { type: 'page', param: 'reels', originalUrl: rawUrl };
    }
    if (prefix === 'chat' || prefix === 'm' || prefix === 'messages' || prefix === 'massage') {
      return { type: 'chat', param: param || '', originalUrl: rawUrl };
    }
    if (prefix === 'explore') {
      return { type: 'page', param: 'search', originalUrl: rawUrl };
    }
    if (prefix === 'signin' || prefix === 'singin' || prefix === 'login') {
      return { type: 'auth', param: 'signin', originalUrl: rawUrl };
    }
    if (prefix === 'signup' || prefix === 'singup' || prefix === 'register') {
      return { type: 'auth', param: 'signup', originalUrl: rawUrl };
    }
    if (prefix === 'admin') {
      return { type: 'page', param: 'admin', originalUrl: rawUrl };
    }

    const validPages: PageType[] = ['home', 'search', 'reels', 'messages', 'notifications', 'create', 'profile', 'settings', 'edit-profile'];
    if (validPages.includes(prefix as PageType)) {
      return { type: 'page', param: prefix, originalUrl: rawUrl };
    }

    return { type: 'unknown', originalUrl: rawUrl };
  } catch (e) {
    return { type: 'unknown', originalUrl: rawUrl };
  }
};

export const getPageUrl = (page: PageType, viewingUser?: any, activeChat?: string | null): string => {
  if (page === 'profile') {
    if (viewingUser) {
      const idOrUser = viewingUser.username || viewingUser.uid;
      return `/user/${encodeURIComponent(idOrUser)}`;
    }
    return '/profile';
  }
  if (page === 'messages') {
    return activeChat ? `/messages/${encodeURIComponent(activeChat)}` : '/messages';
  }
  if (page === 'home') {
    return '/home';
  }
  if (page === 'reels') {
    return '/feed';
  }
  if (page === 'search') {
    return '/search';
  }
  if (page === 'notifications') {
    return '/notifications';
  }
  if (page === 'settings') {
    return '/settings';
  }
  if (page === 'create') {
    return '/create';
  }
  if (page === 'admin') {
    return '/admin';
  }
  if (page === 'edit-profile') {
    return '/edit-profile';
  }
  return '/home';
};

export const syncBrowserUrl = (page: PageType, viewingUser?: any, activeChat?: string | null, replace: boolean = false) => {
  if (typeof window === 'undefined') return;

  const targetUrl = getPageUrl(page, viewingUser, activeChat);
  const currentPath = window.location.pathname;

  if (currentPath === targetUrl) return;

  try {
    if (replace) {
      window.history.replaceState({ page, viewingUser: viewingUser?.uid, activeChat }, '', targetUrl);
    } else {
      window.history.pushState({ page, viewingUser: viewingUser?.uid, activeChat }, '', targetUrl);
    }
  } catch (err) {
    // Graceful fallback for environments with restricted history
  }
};

export const openFromLink = async (rawUrl: string): Promise<boolean> => {
  const parsed = parseDeepLink(rawUrl);
  const store = useAppStore.getState();

  try {
    if (parsed.type === 'account' && parsed.param) {
      const user = await getUserByUsernameOrId(parsed.param);
      if (user) {
        store.setViewingUser(user);
        store.setCurrentPage('profile');
        syncBrowserUrl('profile', user, null, true);
        return true;
      }
    } else if (parsed.type === 'post' && parsed.param) {
      const post = await getPost(parsed.param);
      if (post) {
        if (post.type === 'reel') {
          store.setViewingReel(post);
        } else {
          store.setViewingPost(post);
        }
        return true;
      }
    } else if (parsed.type === 'reel' && parsed.param) {
      const post = await getPost(parsed.param);
      if (post) {
        store.setViewingReel(post);
        return true;
      }
    } else if (parsed.type === 'chat') {
      if (parsed.param) {
        store.setActiveChat(parsed.param);
      }
      store.setCurrentPage('messages');
      syncBrowserUrl('messages', null, parsed.param || null, true);
      return true;
    } else if (parsed.type === 'auth') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ennvoAuthNavigate', { detail: { screen: parsed.param } }));
      }
      return true;
    } else if (parsed.type === 'page' && parsed.param) {
      store.setCurrentPage(parsed.param as PageType);
      syncBrowserUrl(parsed.param as PageType, null, null, true);
      return true;
    }
  } catch (err) {
    console.warn('[DeepLink] Failed to handle link:', rawUrl, err);
  }

  return false;
};

export const shareUserProfile = async (usernameOrId: string, name?: string): Promise<boolean> => {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://ennvo.vercel.app';
  const profileUrl = `${base}/user/${encodeURIComponent(usernameOrId)}`;
  const title = name ? `${name} on Ennvo` : `@${usernameOrId} on Ennvo`;
  const text = `Connect with ${name || usernameOrId} on Ennvo: ${profileUrl}`;

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title,
        text,
        url: profileUrl,
      });
      return true;
    } catch (e) {
      // User cancelled or share failed, fallback to clipboard
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(profileUrl);
      return true;
    } catch (e) {}
  }

  return false;
};

export const initDeepLinkListeners = () => {
  // 1. Capacitor native appUrlOpen listener
  try {
    CapApp.addListener('appUrlOpen', (event) => {
      if (event && event.url) {
        openFromLink(event.url);
      }
    });

    CapApp.getLaunchUrl().then((launchUrl) => {
      if (launchUrl && launchUrl.url) {
        openFromLink(launchUrl.url);
      }
    }).catch(() => {});
  } catch (e) {}

  // 2. Web browser URL on initial load
  if (typeof window !== 'undefined' && window.location.pathname) {
    const currentPath = window.location.pathname;
    if (currentPath && currentPath !== '/' && currentPath !== '/index.html') {
      openFromLink(currentPath);
    }
  }
};
