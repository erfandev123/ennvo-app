import React, { useState, useCallback, memo, useEffect, useRef, lazy, Suspense } from 'react';
import { X, Heart, MessageCircle, Share2, Play, ArrowLeft, MoreHorizontal, Send, Bookmark, VolumeX, ChevronUp, ChevronDown, Globe, ImageIcon, UserPlus, MapPin, Share, Trash2, Download, Music, Sparkles, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

// Heavy pages are split into their own chunks so a new user on a slow network
// never has to download the entire app before seeing anything.
const Home = lazy(() => import('./pages/Home'));
const Reels = lazy(() => import('./pages/Reels'));
const Messages = lazy(() => import('./pages/Messages'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Profile = lazy(() => import('./pages/Profile'));
const EditProfile = lazy(() => import('./pages/EditProfile'));
const Create = lazy(() => import('./pages/Create'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const Settings = lazy(() => import('./pages/Settings'));
import Auth from './pages/Auth';
// The admin console lives in its own folder (admin-console/) and is only ever
// downloaded when an administrator opens the admin screen. Normal users never
// receive this code, which keeps the app bundle small and the panel separate.
const AdminApp = lazy(() => import('../admin-console/src/AdminApp'));

import { CallOverlay } from './components/CallOverlay';
import { AccountSwitcherModal } from './components/AccountSwitcherModal';
import { SetPasswordModal } from './components/SetPasswordModal';
import { useAppStore, PageType } from './store';
import { onAuthChange } from './services/authService';
import { 
  FacebookPostSkeleton, 
  FacebookStorySkeleton, 
  FacebookReelSkeleton, 
  FacebookProfileSkeleton, 
  FacebookEditProfileSkeleton,
  FacebookMessageListSkeleton,
  FacebookSearchSkeleton 
} from './components/Skeletons';
import { setOnline } from './services/presenceService';
import { deleteStory } from './services/storyService';
import { subscribeReels } from './services/postService';
import { deviceNotification } from './services/deviceNotification';
import { formatTime, downloadMediaFile } from './utils';
import { doc, onSnapshot, collection, query, where, limit } from 'firebase/firestore';
import { db, auth } from './firebase';
const ReelItem = lazy(() => import('./components/ReelItem').then(m => ({ default: m.ReelItem })));
const SharePortal = lazy(() => import('./components/ReelItem').then(m => ({ default: m.SharePortal })));
const LikesList = lazy(() => import('./components/LikesList').then(m => ({ default: m.LikesList })));
const AnalyticsModal = lazy(() => import('./components/AnalyticsModal').then(m => ({ default: m.AnalyticsModal })));
const ReelCameraModal = lazy(() => import('./components/ReelCameraModal').then(m => ({ default: m.ReelCameraModal })));
const MediaViewerModal = lazy(() => import('./components/MediaViewerModal').then(m => ({ default: m.MediaViewerModal })));
const MiniChat = lazy(() => import('./components/MiniChat'));
import { UploadProgressBar } from './components/UploadProgressBar';
import { getPost } from './services/postService';
import { bridge, PendingSharePayload } from './native/bridge';
import { 
  startNotificationCenter, 
  stopNotificationCenter, 
  setInAppToastListener, 
  setActiveChatInCenter 
} from './services/notificationCenter';
import { registerNativePushAndReplies, unregisterNativePush } from './services/nativePushReplies';
import { initDeepLinkListeners, openFromLink } from './services/deepLinkService';
import { subscribeAppConfig, AndroidAppConfig, notifyAppReady } from './services/appConfigService';
import { ErrorBoundary, initGlobalErrorHandlers } from './components/ErrorBoundary';
import { 
  BannedSuspendedModal, 
  MaintenanceScreen, 
  AppUpdateModal, 
  ShareReceivedSheet, 
  BannedInfo 
} from './components/AppStatusModals';
import { applyRouteSEO } from './services/seoService';
import { shareContent } from './services/shareService';

import { playNotificationSound } from './services/soundService';

const playNotifChime = () => {
  playNotificationSound();
};

const InAppToaster = memo(() => {
  const { currentUser, setViewingMedia, setViewingReel, pushPage, setViewingUser, setHighlightedCommentId, setHighlightedPostId, setActiveChat, activeChat } = useAppStore();
  const [toast, setToast] = useState<any | null>(null);
  const timeoutRef = React.useRef<any>(null);

  const isUserTyping = useCallback(() => {
    if (typeof document === 'undefined') return false;
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return true;
    if ((active as HTMLElement).isContentEditable) return true;
    return false;
  }, []);

  useEffect(() => {
    setInAppToastListener((t) => {
      // Suppress in-app toast if user is actively typing, or if it's a typing indicator toast
      if (isUserTyping() || t?.type === 'typing') {
        return;
      }
      setToast(t);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setToast(null), 4500);
    });

    return () => {
      setInAppToastListener(null);
    };
  }, [isUserTyping]);

  if (!toast) return null;

  const hasMedia = toast.postMedia || toast.mediaUrl;
  const isVideo = hasMedia && (toast.postMedia?.includes('.mp4') || toast.postMedia?.includes('video') || toast.mediaUrl?.includes('.mp4') || toast.mediaUrl?.includes('video'));

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: -70, opacity: 0, scale: 0.92 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -70, opacity: 0, scale: 0.92 }}
        transition={{ type: 'spring', damping: 24, stiffness: 340, mass: 0.6 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.35}
        onDragEnd={(_, info) => {
          if (info.offset.y < -20 || info.velocity.y < -250) {
            setToast(null);
          }
        }}
        className="fixed top-[max(calc(env(safe-area-inset-top,0px)+8px),12px)] left-0 right-0 z-[350] flex justify-center pointer-events-none px-3 sm:px-4"
      >
        <div 
          className="bg-white/95 dark:bg-[#121824]/95 text-neutral-900 dark:text-white shadow-[0_16px_40px_rgba(14,165,233,0.18),0_4px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.45)] border border-sky-200/90 dark:border-sky-500/25 rounded-[26px] p-3.5 pointer-events-auto cursor-pointer max-w-[400px] w-full transition-transform relative overflow-hidden group backdrop-blur-2xl transform-gpu select-none"
          onClick={async () => {
             setToast(null);
             if (toast.type === 'message' || toast.type === 'typing') {
               setActiveChat(toast.conversationId);
               pushPage('messages');
             } else if (toast.postId) {
               try {
                 const post = await getPost(toast.postId);
                 if (toast.type === 'comment' || toast.type === 'reply' || toast.type === 'like' || toast.type === 'comment_like') {
                   setHighlightedPostId(toast.postId);
                   setHighlightedCommentId(toast.targetId);
                 }
                 if (post) {
                   if (post.type === 'reel' || post.media?.[0]?.includes('.mp4') || post.media?.[0]?.includes('video')) {
                      setViewingReel({ ...post, single: true });
                   } else if (post.media && post.media.length > 0) {
                      setViewingMedia({ url: post.media[0], type: 'post', user: { name: post.authorName, avatar: post.authorAvatar } });
                   } else {
                      pushPage('reels');
                   }
                 }
               } catch (e) {
                 console.error(e);
               }
             } else {
               if (toast.actorId) {
                 setViewingUser({ uid: toast.actorId, name: toast.actorName, avatar: toast.actorAvatar });
                 pushPage('profile');
               }
             }
          }}
        >
          {/* Soft Sky Blue Ambient Backlight Glow */}
          <div className="absolute -top-12 -left-12 w-36 h-36 bg-sky-400/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-36 h-36 bg-blue-500/15 rounded-full blur-2xl pointer-events-none" />

          {/* Pull-Up Grabber Bar */}
          <div className="w-8 h-1 rounded-full bg-sky-300/60 dark:bg-sky-500/40 mx-auto -mt-1 mb-2 pointer-events-none" />

          {/* Top App Brand Bar */}
          <div className="flex items-center justify-between px-0.5 mb-2 pointer-events-none">
            <div className="flex items-center space-x-1.5">
              <img 
                src="/icon-192.png?v=5" 
                alt="Ennvo" 
                className="w-4 h-4 rounded-full object-cover ring-1 ring-sky-300/40 shadow-xs" 
              />
              <span className="text-[10.5px] font-black tracking-widest text-sky-600 dark:text-sky-400 uppercase">ENNVO</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-400">now</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center min-w-0 flex-1">
              <div className="relative shrink-0 mr-3">
                <img 
                  src={toast.actorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(toast.actorName || 'User')}&background=random`} 
                  className="w-11 h-11 rounded-full object-cover border-2 border-white dark:border-neutral-800 shadow-sm ring-2 ring-sky-400/40" 
                  alt="avatar" 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 bg-white dark:bg-neutral-900 rounded-full flex items-center justify-center shadow-xs border border-sky-100 dark:border-neutral-800 scale-95">
                  {toast.type === 'typing' ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-ping" />
                  ) : toast.type === 'message' ? (
                    <MessageCircle className="w-2.5 h-2.5 text-sky-500 fill-sky-500" />
                  ) : toast.type === 'like' ? (
                    <Heart className="w-2.5 h-2.5 text-rose-500 fill-rose-500" />
                  ) : (
                    <Sparkles className="w-2.5 h-2.5 text-sky-500 fill-sky-500" />
                  )}
                </div>
              </div>

              {toast.type === 'typing' ? (
                <div className="flex-1 min-w-0 pr-2">
                  <h4 className="text-[13.5px] font-bold text-neutral-900 dark:text-white leading-tight truncate">
                    {toast.actorName || 'Friend'}
                  </h4>
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <span className="text-[12px] font-semibold text-sky-600 dark:text-sky-400 truncate">
                      typing a message...
                    </span>
                    <div className="flex items-center space-x-1 bg-sky-100 dark:bg-sky-950/60 px-1.5 py-0.5 rounded-full">
                      <span className="w-1 h-1 rounded-full bg-sky-500 animate-bounce [animation-delay:0ms]" />
                      <span className="w-1 h-1 rounded-full bg-sky-500 animate-bounce [animation-delay:150ms]" />
                      <span className="w-1 h-1 rounded-full bg-sky-500 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              ) : toast.type === 'message' ? (
                <div className="flex-1 min-w-0 pr-2">
                  <h4 className="text-[13.5px] font-bold text-neutral-900 dark:text-white leading-tight truncate">
                    {toast.actorName || 'User'}
                  </h4>
                  <p className="text-[12px] font-normal text-neutral-600 dark:text-neutral-200 truncate leading-tight mt-0.5">
                    {toast.content}
                  </p>
                </div>
              ) : (
                <div className="flex-1 min-w-0 pr-2">
                  <h4 className="text-[13.5px] font-bold text-neutral-900 dark:text-white leading-tight truncate">
                    {toast.actorName || 'User'}
                  </h4>
                  <p className="text-[12px] text-neutral-600 dark:text-neutral-200 font-normal leading-snug mt-0.5 truncate">
                    {toast.type === 'like' && 'liked your post'}
                    {toast.type === 'comment' && `commented: ${toast.content}`}
                    {toast.type === 'follow' && 'started following you'}
                    {toast.type === 'mention' && 'mentioned you'}
                    {toast.type === 'favorite' && 'saved your post'}
                    {(toast.type as string) === 'repost' && 'reposted your video'}
                  </p>
                </div>
              )}
            </div>

            {/* Right Action / Media Box */}
            {toast.type === 'message' ? (
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setToast(null);
                  setActiveChat(toast.conversationId);
                  pushPage('messages');
                }}
                className="text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 font-semibold text-[11.5px] px-3.5 py-1.5 rounded-full shrink-0 ml-2 transition-transform shadow-sm shadow-sky-500/25"
              >
                Reply
              </button>
            ) : hasMedia ? (
              <div className="w-11 h-11 rounded-2xl bg-neutral-100 dark:bg-black/60 overflow-hidden relative shrink-0 ml-2 border border-sky-200/80 dark:border-white/20 shadow-xs flex items-center justify-center">
                {isVideo ? (
                  <>
                    <video 
                      src={`${hasMedia}#t=0.001`} 
                      className="w-full h-full object-cover" 
                      preload="metadata" 
                      muted 
                      playsInline
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                      <Play className="w-3.5 h-3.5 text-white fill-white drop-shadow-md" />
                    </div>
                  </>
                ) : (
                  <img 
                    src={hasMedia} 
                    className="w-full h-full object-cover" 
                    alt="Thumbnail" 
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
            ) : null}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

import { requestFirebaseNotificationPermission, onMessageListener } from './services/messagingService';

export default function App() {
  const { 
    currentPage, pushPage, 
    viewingMedia, setViewingMedia, 
    viewingStory, setViewingStory, 
    viewingReel, setViewingReel, 
    viewingReelList, setViewingReelList,
    viewingReelContext, setViewingReelContext,
    activeChat, showCreatePost, showReelCamera,
    showLikesList, showAnalytics, miniChatUser,
    isAuthenticated, isAuthLoading, 
    currentUser, setCurrentUser, 
    setNotificationCount,
    setMessageCount,
    isBottomNavHidden,
    popPage,
    cachedReels,
    appTheme
  } = useAppStore();

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Network online/offline listener for TikTok/Facebook style offline browsing
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Hide native Capacitor Splash Screen on mount
  // (the launch splash is owned by AndroidX core-splashscreen and MainActivity;
  //  it is dismissed by Android.appReady() from main.tsx after the first paint)

  // Expose global openChat & incomingCall trigger for Android Native Notification Intents
  useEffect(() => {
    (window as any).openChat = (convId: string) => {
      if (!convId) return;
      const store = useAppStore.getState();
      store.pushPage('messages');
      store.setActiveChat(convId);
    };

    // The native side calls window.onNativeOpen() when a notification is tapped
    // (see MainActivity.handleIntent -> runJs("window.onNativeOpen&&...")).
    (window as any).onNativeOpen = () => {
      try {
        const pending = bridge.consumePendingOpen();
        if (!pending) return;
        const store = useAppStore.getState();

        // Activity notification with a direct target (post/reel/story/profile).
        // Route through the in-app deep-link router so Back closes the overlay
        // instead of reloading the app.
        if (pending.url) {
          import('./services/deepLinkService')
            .then((m) => m.openFromLink(pending.url as string))
            .catch(() => {});
          return;
        }

        if (pending.type === 'activity' || pending.page === 'activity') {
          store.setCurrentPage('notifications');
          return;
        }

        if (pending.convId) {
          store.pushPage('messages');
          store.setActiveChat(pending.convId);
          return;
        }

        if (pending.page) store.setCurrentPage(pending.page as any);
      } catch (e) {
        console.warn('[Native] onNativeOpen error:', e);
      }
    };

    // A notification that carries a deep link (activity, profile, post ...) is
    // routed through the normal in-app router instead of reloading the app.
    (window as any).onNativeDeepLink = (url: string) => {
      if (!url) return;
      import('./services/deepLinkService')
        .then((m) => m.openFromLink(url))
        .catch(() => {});
    };

    // Cold start: the native intent was handled before React mounted, so the
    // pending payload is still waiting. Consume it now that the handlers exist -
    // this is what makes a notification tap open the right chat / activity page
    // instead of the reels feed.
    const consumePending = () => {
      try {
        (window as any).onNativeOpen();
        const callAction = (window as any).onNativeCallAction;
        if (typeof callAction === 'function') callAction();
      } catch (e) {}
    };
    setTimeout(consumePending, 350);
    setTimeout(consumePending, 1600);

    (window as any).handleIncomingCall = (callerName: string, callerAvatar: string, type: string, callId: string) => {
      // Trigger in-app incoming call overlay
      window.dispatchEvent(new CustomEvent('nativeIncomingCall', {
        detail: { callerName, callerAvatar, type, callId }
      }));
    };
  }, []);

  // Prefetch the next likely tab only on a healthy connection. On 2G/3G or
  // data-saver we skip this entirely so it never competes with real requests.
  useEffect(() => {
    if (!isAuthenticated) return;
    const conn = (navigator as any).connection;
    if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) return;

    const timer = setTimeout(() => {
      if (currentPage === 'home') import('./pages/Messages');
      else if (currentPage === 'messages') import('./pages/Notifications');
    }, 4000);
    return () => clearTimeout(timer);
  }, [isAuthenticated, currentPage]);

  const [showExitToast, setShowExitToast] = useState(false);
  const [showGoogleSetPasswordModal, setShowGoogleSetPasswordModal] = useState(false);
  const lastBackPressRef = useRef<number>(0);

  // Auto-prompt Google users who do not have a password set yet
  useEffect(() => {
    if (currentUser && isAuthenticated && (currentUser.authProvider === 'google' || !currentUser.hasPassword)) {
      const hasPrompted = sessionStorage.getItem(`ennvo_pw_prompt_${currentUser.uid}`);
      if (!hasPrompted && !currentUser.hasPassword) {
        sessionStorage.setItem(`ennvo_pw_prompt_${currentUser.uid}`, 'true');
        const timer = setTimeout(() => {
          setShowGoogleSetPasswordModal(true);
        }, 1800);
        return () => clearTimeout(timer);
      }
    }
  }, [currentUser, isAuthenticated]);

  // Meta theme-color synchronization for browsers
  useEffect(() => {
    const isDark = appTheme === 'dark' || currentPage === 'home' || currentPage === 'create' || !!viewingReel || !!viewingMedia;
    const targetColor = isDark ? '#000000' : '#ffffff';

    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', targetColor);
  }, [currentPage, appTheme, viewingReel, viewingMedia]);

  // State for App Updates, Banned Accounts, Native Shares, and Battery Prompt
  const [appConfig, setAppConfig] = useState<AndroidAppConfig | null>(null);
  const [showOptionalUpdate, setShowOptionalUpdate] = useState(false);
  const [bannedInfo, setBannedInfo] = useState<BannedInfo | null>(null);
  const [pendingShare, setPendingShare] = useState<PendingSharePayload | null>(null);
  const [showBatteryPrompt, setShowBatteryPrompt] = useState(false);

  // The "let Ennvo run in the background" popup is gone: it appeared on every
  // fresh install and felt like an ad. The app keeps its foreground service for
  // calls, and the setting is still available manually in Settings.

  // 1. Initialize Error Handlers, Deep Links & Notify App Ready
  useEffect(() => {
    initGlobalErrorHandlers();
    initDeepLinkListeners();
    notifyAppReady();

    // Check for native shares
    const checkShare = () => {
      const s = bridge.getPendingShare();
      if (s && (s.text || (s.files && s.files.length > 0))) {
        setPendingShare(s);
      }
    };
    checkShare();
    (window as any).onShareReceived = () => checkShare();
  }, []);

  // 2. Listen for Remote App Configuration & Update System (PROMPT-1 Task 10)
  useEffect(() => {
    const unsub = subscribeAppConfig((cfg) => {
      setAppConfig(cfg);
      const appInfo = bridge.getAppInfo();
      const currentCode = appInfo.versionCode || 1;
      if (currentCode < cfg.latestVersionCode && !cfg.forceUpdate && currentCode >= cfg.minVersionCode) {
        const dismissedVer = sessionStorage.getItem(`ennvo_update_dismissed_${cfg.latestVersionCode}`);
        if (!dismissedVer) {
          setShowOptionalUpdate(true);
        }
      }
    });
    return () => unsub();
  }, []);

  // 3. Centralized Notification Center & Native Push Token registration (PROMPT-1 Tasks 3 & 4)
  useEffect(() => {
    if (currentUser?.uid) {
      startNotificationCenter(currentUser.uid);
      registerNativePushAndReplies(currentUser.uid);
      bridge.setUserId(currentUser.uid);
    } else {
      stopNotificationCenter();
      bridge.setUserId('');
    }
    return () => {
      stopNotificationCenter();
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    setActiveChatInCenter(activeChat);
  }, [activeChat]);

  // 4. Banned and Disabled Accounts Enforcement (PROMPT-1 Task 11)
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = onSnapshot(doc(db, 'users', currentUser.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const status = data?.status;
        const bannedUntil = data?.bannedUntil;
        const isSuspended = status === 'suspended' && (!bannedUntil || bannedUntil > Date.now());
        const isBanned = status === 'banned';

        if (isBanned || isSuspended) {
          setBannedInfo({
            status: isBanned ? 'banned' : 'suspended',
            bannedUntil: bannedUntil,
            reason: data?.banReason || 'Violation of community safety standards',
          });
          auth.signOut();
        }
      }
    });
    return () => unsub();
  }, [currentUser?.uid]);

  useEffect(() => {
    // Keep history state stack populated for hardware back button (Capacitor & Web popstate)
    if (typeof window !== 'undefined' && !window.history.state) {
      window.history.pushState({ page: 'init' }, '');
    }

    const handleNavigationBack = () => {
      const store = useAppStore.getState();

      // 0. Dispatch custom 'appBackPress' event for open inline modals / sheets / comment boxes / share boxes
      const customEvent = new CustomEvent('appBackPress', { cancelable: true });
      const isHandled = !window.dispatchEvent(customEvent);
      if (isHandled) {
        // A modal or sheet handled the back press and closed itself!
        window.history.pushState({ page: 'init' }, '');
        return;
      }

      // 1. Check viewing profile overlay
      if (store.viewingUser) {
        store.setViewingUser(null);
        window.history.pushState({ page: 'init' }, '');
        return;
      }

      // 2. Fullscreen overlays & modals
      if (store.viewingMedia) {
        store.setViewingMedia(null);
        window.history.pushState({ page: 'init' }, '');
        return;
      }
      if (store.viewingStory) {
        store.setViewingStory(null);
        window.history.pushState({ page: 'init' }, '');
        return;
      }
      if (store.viewingReel) {
        store.setViewingReel(null);
        store.setViewingReelList(null);
        window.history.pushState({ page: 'init' }, '');
        return;
      }
      if (store.showCreatePost) {
        store.setShowCreatePost(false);
        window.history.pushState({ page: 'init' }, '');
        return;
      }
      if (store.showReelCamera) {
        store.setShowReelCamera(false);
        window.history.pushState({ page: 'init' }, '');
        return;
      }
      if (store.showLikesList) {
        store.setShowLikesList(false);
        window.history.pushState({ page: 'init' }, '');
        return;
      }
      if (store.showViewsList) {
        store.setShowViewsList(false);
        window.history.pushState({ page: 'init' }, '');
        return;
      }
      if (store.showAnalytics) {
        store.setShowAnalytics(false);
        window.history.pushState({ page: 'init' }, '');
        return;
      }
      if (store.miniChatUser) {
        store.setMiniChatUser(null);
        window.history.pushState({ page: 'init' }, '');
        return;
      }

      // 3. If inside active chat in Messages -> return to chats list
      if (store.currentPage === 'messages' && store.activeChat) {
        store.setActiveChat(null);
        window.history.pushState({ page: 'init' }, '');
        return;
      }

      // 4. Sub-pages / Detail views (e.g. edit-profile)
      if (store.currentPage === 'edit-profile') {
        store.popPage();
        window.history.pushState({ page: 'init' }, '');
        return;
      }

      // 5. Walk back through the real page stack first (profile -> settings ->
      //    the tab the user came from ...), then fall through to home, then exit.
      //    This is how Android back behaves in the app: it never jumps straight
      //    to home and it never returns to a page the user already left.
      const stack: string[] = (store.navigationStack || ['home']).filter(Boolean);
      if (stack.length > 1) {
        store.backPage();
        window.history.pushState({ page: 'init' }, '');
        return;
      }

      // 6. Main Navigation Tabs (server tabs other than the Reels/home tab)
      if (store.currentPage !== 'home') {
        store.backPage();
        window.history.pushState({ page: 'init' }, '');
        return;
      }

      // 7. Already at Root 'home' -> Double back press within 2.5s to exit
      const now = Date.now();
      if (lastBackPressRef.current && (now - lastBackPressRef.current < 2500)) {
        if (typeof (window as any).AndroidApp?.exitApp === 'function') {
          (window as any).AndroidApp.exitApp();
        } else if (typeof (window as any).AndroidInterface?.exitApp === 'function') {
          (window as any).AndroidInterface.exitApp();
        } else {
          CapApp.exitApp().catch(() => {});
        }
      } else {
        lastBackPressRef.current = now;
        setShowExitToast(true);
        setTimeout(() => setShowExitToast(false), 2500);
        window.history.pushState({ page: 'init' }, '');
      }
    };

    window.addEventListener('popstate', handleNavigationBack);
    (window as any).handleAndroidBack = handleNavigationBack;

    let capBackSub: any = null;
    try {
      CapApp.addListener('backButton', () => {
        handleNavigationBack();
      }).then(sub => {
        capBackSub = sub;
      }).catch(() => {});
    } catch (e) {}

    return () => {
      window.removeEventListener('popstate', handleNavigationBack);
      if (capBackSub && capBackSub.remove) {
        capBackSub.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.uid) return;
    
    // Request device/browser push notification permission
    deviceNotification.requestPermission().catch(() => {});
    requestFirebaseNotificationPermission(currentUser.uid).catch(err => console.warn(err));
    try {
      const msgListener = onMessageListener();
      if (msgListener && typeof (msgListener as any).then === 'function') {
        (msgListener as Promise<any>).then(payload => {
          if (payload) {
            deviceNotification.show({
              title: payload.notification?.title || 'New Message',
              body: payload.notification?.body || '',
              type: 'message'
            });
          }
        }).catch(err => console.warn(err));
      }
    } catch (err) {
      console.warn('onMessageListener notice:', err);
    }

    // NotificationCenter owns live activity notification dispatch (with the
    // actor avatar + exact target URL). This listener only keeps the tab badge
    // count in sync, so activities are never announced twice.
    const unsubscribeNotifs = onSnapshot(
      query(collection(db, 'notifications', currentUser.uid, 'items'), where('isRead', '==', false)),
      (snap) => setNotificationCount(snap.size),
      (err) => console.warn('Notif count error:', err)
    );

    const unsubscribeMessages = onSnapshot(query(collection(db, 'conversations'), where('participantIds', 'array-contains', currentUser.uid)), (snap) => {
      let total = 0;
      snap.docs.forEach(doc => {
        const data = doc.data();
        const unread = data.unreadCount?.[currentUser.uid] || 0;
        total += unread;

      });

      setMessageCount(total);
    }, (err) => console.warn('Msg count error:', err));

    const unsubscribeFollowing = onSnapshot(collection(db, 'users', currentUser.uid, 'following'), (snap) => {
      const ids = snap.docs.map(d => d.id);
      useAppStore.getState().setFollowingIds(ids);
    }, (err) => console.warn('Following count error:', err));

    const unsubscribeFollowers = onSnapshot(collection(db, 'users', currentUser.uid, 'followers'), (snap) => {
      const ids = snap.docs.map(d => d.id);
      useAppStore.getState().setFollowerIds(ids);
    }, (err) => console.warn('Followers count error:', err));

    return () => {
      unsubscribeNotifs();
      unsubscribeMessages();
      unsubscribeFollowing();
      unsubscribeFollowers();
    };
  }, [isAuthenticated, currentUser?.uid, setNotificationCount, setMessageCount]);

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setCurrentUser(user);
      if (user) {
        const privacy = localStorage.getItem('privacyMode');
        if (privacy !== 'private') {
          setOnline(user.uid);
        }
      }
    });
    return () => unsubscribe();
  }, [setCurrentUser]);

  const isNavHidden = isBottomNavHidden || 
    currentPage === 'create' || 
    currentPage === 'edit-profile' ||
    currentPage === 'settings' ||
    currentPage === 'admin' ||
    showCreatePost || 
    showReelCamera ||
    !!viewingStory || 
    !!viewingMedia || 
    !!viewingReel || 
    (currentPage === 'messages' && activeChat !== null && window.innerWidth < 768) ||
    ((currentPage === 'search' || currentPage === 'notifications') && window.innerWidth < 768);

  const isSidebarHidden = isBottomNavHidden ||
    currentPage === 'edit-profile' ||
    currentPage === 'admin' ||
    !!viewingStory || 
    !!viewingMedia || 
    !!viewingReel;

  const isReelsPage = currentPage === 'home';

  // Instant boot: only mount active page first; visited pages persist on navigation
  const [visitedPages, setVisitedPages] = useState<Set<PageType>>(
    () => new Set([currentPage])
  );

  useEffect(() => {
    setVisitedPages(prev => {
      if (prev.has(currentPage)) return prev;
      const updated = new Set(prev);
      updated.add(currentPage);
      return updated;
    });
  }, [currentPage]);

  // Synchronize SEO metadata and robots directives with SPA navigation
  useEffect(() => {
    applyRouteSEO(currentPage, {
      userName: currentUser?.name,
      isAuth: isAuthenticated,
    });
  }, [currentPage, currentUser?.name, isAuthenticated]);

  const getTopBarBgClass = useCallback(() => {
    if (viewingStory || viewingMedia || viewingReel || currentPage === 'home' || currentPage === 'create') {
      return 'bg-black';
    }
    if (appTheme === 'dark') {
      return 'bg-black';
    }
    return 'bg-white dark:bg-black';
  }, [viewingStory, viewingMedia, viewingReel, currentPage, appTheme]);

  const getBottomBarBgClass = useCallback(() => {
    if (viewingStory || viewingMedia || viewingReel || currentPage === 'home' || currentPage === 'create') {
      return 'bg-black';
    }
    if (appTheme === 'dark') {
      return 'bg-black';
    }
    return 'bg-white dark:bg-black';
  }, [viewingStory, viewingMedia, viewingReel, currentPage, appTheme]);

  if (!isAuthenticated && !isAuthLoading) {
    return <Auth />;
  }

  return (
    <ErrorBoundary screenName="Ennvo">
      <div className="flex flex-col h-[100dvh] w-full text-neutral-900 dark:text-white overflow-hidden font-sans relative antialiased bg-black md:bg-white dark:md:bg-black select-none">
        
        {/* Main Middle Content Area */}
        <div className={`flex-1 w-full h-full flex overflow-hidden relative ${isReelsPage ? 'bg-black md:bg-white dark:md:bg-[#08080a]' : 'bg-white dark:bg-black'}`}>
          {/* Offline Status Pill - Informative TikTok/FB style banner */}
          {!isOnline && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[9999] px-3 py-1 bg-amber-500/90 backdrop-blur-md text-white text-[11px] font-semibold rounded-full shadow-md flex items-center space-x-1.5 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-300">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>Offline Mode • Viewing Saved Content</span>
            </div>
          )}

          {!isSidebarHidden && (
            <Sidebar currentPage={currentPage} />
          )}
          <main className="w-full flex-1 h-full overflow-hidden relative gpu-accelerated">
            <Suspense fallback={
              currentPage === 'home' ? (
                <FacebookReelSkeleton />
              ) : currentPage === 'profile' ? (
                <FacebookProfileSkeleton />
              ) : currentPage === 'edit-profile' ? (
                <FacebookEditProfileSkeleton />
              ) : currentPage === 'messages' ? (
                <div className="w-full h-full bg-white max-w-[480px]">
                  <FacebookMessageListSkeleton />
                </div>
              ) : currentPage === 'search' ? (
                <FacebookSearchSkeleton />
              ) : (
                <div className="w-full h-full overflow-hidden bg-white max-w-[620px] mx-auto pt-2 px-3 space-y-4">
                  <FacebookStorySkeleton />
                  <FacebookPostSkeleton />
                </div>
              )
            }>
              {Array.from(visitedPages).map((pageKey) => {
                const isActive = currentPage === pageKey;
                return (
                  <div 
                    key={pageKey} 
                    style={{ display: isActive ? 'block' : 'none', opacity: isActive ? 1 : 0 }}
                    className={`w-full h-full absolute inset-0 ${isActive ? 'z-10 pointer-events-auto opacity-100' : 'z-0 pointer-events-none opacity-0 hidden'} transform-gpu ${pageKey === 'admin' ? 'overflow-y-auto' : ''}`}
                  >
                    {pageKey === 'home' && <Reels />}
                    {pageKey === 'search' && <SearchPage />}
                    {pageKey === 'reels' && <Home />}
                    {pageKey === 'messages' && <Messages />}
                    {pageKey === 'notifications' && <Notifications />}
                    {pageKey === 'create' && (isActive ? <Create /> : null)}
                    {pageKey === 'profile' && <Profile />}
                    {pageKey === 'edit-profile' && (isActive ? <EditProfile /> : null)}
                    {pageKey === 'settings' && (isActive ? <Settings /> : null)}
                    {pageKey === 'admin' && (isActive ? <AdminApp onExitAdmin={() => popPage()} /> : null)}
                  </div>
                );
              })}
            </Suspense>
          </main>
          {!isNavHidden && <BottomNav />}
        </div>

        <AccountSwitcherModal />

      {/* Banned or Suspended Account Screen (PROMPT-1 Task 11) */}
      {bannedInfo && (
        <BannedSuspendedModal
          info={bannedInfo}
          onDismiss={() => {
            setBannedInfo(null);
            localStorage.clear();
            window.location.reload();
          }}
        />
      )}

      {/* Full-Screen Maintenance Mode Screen (PROMPT-1 Task 10) */}
      {appConfig?.maintenance?.enabled && !currentUser?.isAdmin && (
        <MaintenanceScreen message={appConfig.maintenance.message} />
      )}

      {/* Force or Required Update Screen (PROMPT-1 Task 10) */}
      {appConfig && (bridge.getAppInfo().versionCode < appConfig.minVersionCode || (appConfig.forceUpdate && bridge.getAppInfo().versionCode < appConfig.latestVersionCode)) && (
        <AppUpdateModal config={appConfig} forced={true} />
      )}

      {/* Optional New Version Available Modal (PROMPT-1 Task 10) */}
      {showOptionalUpdate && appConfig && (
        <AppUpdateModal
          config={appConfig}
          forced={false}
          onDismiss={() => {
            sessionStorage.setItem(`ennvo_update_dismissed_${appConfig.latestVersionCode}`, 'true');
            setShowOptionalUpdate(false);
          }}
        />
      )}

      {/* Share to Ennvo Sheet from Native Intent (PROMPT-1 Task 9) */}
      {pendingShare && (
        <ShareReceivedSheet
          share={pendingShare}
          onClose={() => setPendingShare(null)}
        />
      )}

      {/* Exit Toast Notification */}
      {showExitToast && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 bg-gray-900/95 text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-2xl z-[200] border border-white/20 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          আর একবার ব্যাক চাপুন অ্যাপ থেকে বের হতে
        </div>
      )}

      {/* Battery Optimization / Background Alerts Dialog */}
      {false && showBatteryPrompt && (
        <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 font-sans">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-100 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Zap className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Background Notifications
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Allow Ennvo to run in the background so you instantly receive incoming calls and direct messages even when the app is closed.
              </p>
            </div>
            <div className="flex flex-col space-y-2 pt-2">
              <button
                onClick={() => {
                  localStorage.setItem('ennvo_battery_prompt_done', 'true');
                  setShowBatteryPrompt(false);
                  bridge.requestBatteryExemption();
                }}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl font-semibold text-sm shadow-lg transition-all"
              >
                Enable Background Calls & Alerts
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('ennvo_battery_prompt_done', 'true');
                  setShowBatteryPrompt(false);
                }}
                className="w-full py-2.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Media Viewer */}
      {viewingMedia && (
        <Suspense fallback={null}>
          <MediaViewerModal
            media={viewingMedia}
            onClose={() => setViewingMedia(null)}
          />
        </Suspense>
      )}

      {/* Global Story Viewer */}
      {viewingStory && (
        <StoryViewer story={viewingStory} onClose={() => setViewingStory(null)} />
      )}

      <InAppToaster />
      <UploadProgressBar />
      <Suspense fallback={null}>
        {showReelCamera && <ReelCameraModal />}
        {showLikesList && <LikesList />}
        {showAnalytics && <AnalyticsModal />}
        {miniChatUser && <MiniChat />}
      </Suspense>
      <ViewsList />
      <CallOverlay />
      <SetPasswordModal 
        isOpen={showGoogleSetPasswordModal} 
        onClose={() => setShowGoogleSetPasswordModal(false)} 
      />

      {/* Global Reel Viewer (Modal) */}
      {viewingReel && (
        <Suspense fallback={<div className="fixed inset-0 z-[100] bg-black" />}>
        <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center animate-in fade-in duration-200">
          {/* Always visible prominent close button for PC & Mobile in top-left */}
          <button 
            type="button"
            onClick={() => { setViewingReel(null); setViewingReelList(null); }}
            className="fixed top-[max(calc(env(safe-area-inset-top,0px)+12px),16px)] left-4 sm:top-6 sm:left-6 z-[160] p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 shadow-2xl transition-transform cursor-pointer flex items-center justify-center group"
            title="Close Reel"
            aria-label="Close Reel"
          >
            <X className="w-5.5 h-5.5 text-white stroke-[2.5]" />
          </button>
          <div id="global-reels-container" className="h-[100dvh] w-full overflow-y-auto reels-scroll-viewport no-scrollbar overscroll-none overflow-x-hidden">
            {/* If we have a single reel or specific list */}
            {viewingReel.single ? (
              <div className="reel-snap-item w-full h-full">
                <ReelItem key={viewingReel.id} reel={viewingReel as any} isModal onClose={() => { setViewingReel(null); setViewingReelList(null); }} />
              </div>
            ) : (
              (() => {
                let reelsList: any[] = [];
                if (viewingReelList && viewingReelList.length > 0) {
                  reelsList = viewingReelList;
                } else if (viewingReelContext && viewingReelContext !== 'all') {
                  reelsList = (cachedReels || []).filter(r => r.authorId === viewingReelContext);
                } else {
                  reelsList = cachedReels || [];
                }

                const activeIndex = viewingReel ? reelsList.findIndex(r => r.id === viewingReel.id) : 0;
                const sortedReels = activeIndex > -1 ? [...reelsList.slice(activeIndex), ...reelsList.slice(0, activeIndex)] : reelsList;

                if (sortedReels.length === 0) {
                  return (
                    <div className="h-full w-full flex flex-col items-center justify-center text-white bg-black">
                      <p className="mb-4">No reels found</p>
                      <button onClick={() => { setViewingReel(null); setViewingReelList(null); }} className="px-6 py-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">Close</button>
                    </div>
                  );
                }

                return sortedReels.map((reel) => (
                  <div key={reel.id} className="reel-snap-item w-full h-full">
                    <ReelItem reel={reel} isModal onClose={() => { setViewingReel(null); setViewingReelList(null); }} />
                  </div>
                ));
              })()
            )}
          </div>
        </div>
        </Suspense>
      )}
      </div>
    </ErrorBoundary>
  );
}

function ViewsList() {
  const { showViewsList, setShowViewsList, targetViewsPostId, setTargetViewsPostId, setViewingUser, pushPage } = useAppStore();
  const [viewers, setViewers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (showViewsList && targetViewsPostId) {
      setLoading(true);
      const fetchViewers = async () => {
        try {
          const { getDocs, collection, doc, getDoc } = await import('firebase/firestore');
          const viewsCol = collection(db, 'posts', targetViewsPostId, 'views');
          const snapshot = await getDocs(viewsCol);
          const userIds = snapshot.docs.map(d => d.id);
          
          const userPromises = userIds.map(async (uid) => {
            const userDoc = await getDoc(doc(db, 'users', uid));
            const data = userDoc.data();
            return data ? { uid, ...data } : null;
          });
          
          const users = (await Promise.all(userPromises)).filter(Boolean);
          setViewers(users as any[]);
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      fetchViewers();
    }
  }, [showViewsList, targetViewsPostId]);

  return (
    <AnimatePresence>
      {showViewsList && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowViewsList(false)}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-3xl w-full max-w-sm h-full max-h-[500px] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-50 bg-white">
              <div className="flex items-center space-x-2">
                <Play className="w-5 h-5 text-blue-500 fill-blue-500" />
                <h3 className="font-normal text-gray-900 tracking-tight">Views</h3>
              </div>
              <button onClick={() => setShowViewsList(false)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm text-gray-400">Loading viewers...</p>
                </div>
              ) : viewers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <Globe className="w-12 h-12 opacity-10 mb-2" />
                  <p className="text-sm">No views yet</p>
                </div>
              ) : (
                viewers.map((user) => (
                  <div key={user.uid} className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer" onClick={() => { setViewingUser(user); pushPage('profile'); setShowViewsList(false); }}>
                    <img src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} className="w-11 h-11 rounded-full object-cover" alt={user.name} referrerPolicy="no-referrer" />
                    <span className="font-normal text-gray-900">{user.name}</span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

const StoryViewer = memo(({ story, onClose }: { story: any, onClose: () => void }) => {
  const [storiesList, setStoriesList] = useState<any[]>([story]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const { currentUser, pushPage, setActiveChat } = useAppStore();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(15000); // Default 15s
  const [replyText, setReplyText] = useState('');
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isSongSaved, setIsSongSaved] = useState(false);
  const [songToast, setSongToast] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    import('./services/storyService').then((s) => {
      unsub = s.subscribeStories((fetchedStories) => {
        if (fetchedStories && fetchedStories.length > 0) {
          const targetAuthorId = story.authorId || story.authorUID || story.userId;
          const authorStories = fetchedStories.filter((st) => {
            const stAuthorId = st.authorId || (st as any).authorUID || (st as any).userId;
            return targetAuthorId && stAuthorId && targetAuthorId === stAuthorId;
          });

          const finalGroup = authorStories.length > 0 ? authorStories : [story];
          setStoriesList(finalGroup);
          const foundIdx = finalGroup.findIndex((st) => st.id === story.id);
          if (foundIdx !== -1) {
            setCurrentIndex(foundIdx);
          }
        }
      });
    });
    return () => {
      if (unsub) unsub();
    };
  }, [story.id, story.authorId]);

  const currentStory = storiesList[currentIndex] || story;

  const handleSaveSong = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const songTitle = currentStory.songTitle || currentStory.songInfo?.title || 'Story Audio';
    const songUrl = currentStory.songUrl || currentStory.songInfo?.url;
    if (!songUrl) return;

    try {
      const { toggleSongFavorite } = await import('./services/postService');
      const songId = currentStory.songId || currentStory.songInfo?.id || `story_song_${currentStory.id}`;
      const newSaved = !isSongSaved;
      setIsSongSaved(newSaved);
      if (currentUser?.uid) {
        await toggleSongFavorite(songId, currentUser.uid, {
          title: songTitle,
          artist: currentStory.authorName || 'Artist',
          url: songUrl
        });
      }
      setSongToast(newSaved ? '🎵 Song saved to library!' : 'Song removed from library');
      setTimeout(() => setSongToast(null), 2500);
    } catch (err) {
      console.error('Failed to save song:', err);
    }
  };

  const handleNext = useCallback(() => {
    if (currentIndex < storiesList.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentIndex, storiesList.length, onClose]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setProgress(0);
    } else {
      setProgress(0);
    }
  }, [currentIndex]);

  const handleDelete = async () => {
    import('./services/storyService').then(s => s.deleteStory(currentStory.id));
    if (storiesList.length > 1) {
      handleNext();
    } else {
      onClose();
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !currentUser || currentUser.uid === currentStory.authorId) return;
    try {
      const { createConversation, sendMessage } = await import('./services/chatService');
      const convId = await createConversation(
        [currentUser.uid, currentStory.authorId],
        {
          [currentUser.uid]: { name: currentUser.name, avatar: currentUser.avatar },
          [currentStory.authorId]: { name: currentStory.authorName || currentStory.name, avatar: currentStory.authorAvatar || currentStory.avatar }
        }
      );
      await sendMessage(convId, currentUser.uid, 'text', replyText, undefined, undefined, {
         id: currentStory.id, content: currentStory.text || 'Replied to story', type: currentStory.type || 'story', mediaUrl: currentStory.mediaUrl || currentStory.bg
      });
      setReplyText('');
      setActiveChat(convId);
      pushPage('messages');
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  const handleReact = async () => {
    if (!currentUser || currentUser.uid === currentStory.authorId) return;
    setIsLiked(prev => !prev);
    setShowHeartAnim(true);
    setTimeout(() => setShowHeartAnim(false), 1000);
    try {
      const { createConversation, sendMessage } = await import('./services/chatService');
      const convId = await createConversation(
        [currentUser.uid, currentStory.authorId],
        {
          [currentUser.uid]: { name: currentUser.name, avatar: currentUser.avatar },
          [currentStory.authorId]: { name: currentStory.authorName || currentStory.name, avatar: currentStory.authorAvatar || currentStory.avatar }
        }
      );
      await sendMessage(convId, currentUser.uid, 'text', '❤️ Reacted to your story', undefined, undefined, {
         id: currentStory.id, content: currentStory.text || 'Story context', type: currentStory.type || 'story', mediaUrl: currentStory.mediaUrl || currentStory.bg
      });
      setActiveChat(convId);
      pushPage('messages');
      onClose();
    } catch (e) {}
  };

  const handleShare = async () => {
    const mode = await shareContent({
      title: `Story by ${currentStory.authorName || currentStory.name}`,
      text: currentStory.text || 'Check out this story on Ennvo!',
      url: `https://ennvo.vercel.app/story/${currentStory.id || ''}`,
    });
    if (!mode) setShowShareModal(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    const handleBack = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('appBackPress', handleBack);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('appBackPress', handleBack);
    };
  }, [onClose]);

  useEffect(() => {
    let interval: any;
    const startTime = Date.now();
    
    interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = (elapsed / duration) * 100;
      if (newProgress >= 100) {
        clearInterval(interval);
        handleNext();
      } else {
        setProgress(newProgress);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [handleNext, duration, currentIndex]);

  const onVideoLoaded = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setDuration(e.currentTarget.duration * 1000);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX.current;
    touchStartX.current = null;
    if (deltaX < -40) {
      handleNext();
    } else if (deltaX > 40) {
      handlePrev();
    }
  };

  const hasSong = Boolean(currentStory.songTitle || currentStory.songInfo?.title || currentStory.songArtist);

  const quickEmojis = ['❤️', '🔥', '😂', '👏', '😍', '😮'];

  const handleQuickEmoji = async (emoji: string) => {
    if (!currentUser || currentUser.uid === currentStory.authorId) return;
    setShowHeartAnim(true);
    setTimeout(() => setShowHeartAnim(false), 900);
    try {
      const { createConversation, sendMessage } = await import('./services/chatService');
      const convId = await createConversation(
        [currentUser.uid, currentStory.authorId],
        {
          [currentUser.uid]: { name: currentUser.name, avatar: currentUser.avatar },
          [currentStory.authorId]: { name: currentStory.authorName || currentStory.name, avatar: currentStory.authorAvatar || currentStory.avatar }
        }
      );
      await sendMessage(convId, currentUser.uid, 'text', `${emoji} Reacted to your story`, undefined, undefined, {
        id: currentStory.id, content: currentStory.text || 'Story context', type: currentStory.type || 'story', mediaUrl: currentStory.mediaUrl || currentStory.bg
      });
    } catch (_) {}
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black sm:bg-black/90 sm:backdrop-blur-xl p-0 sm:p-4 select-none">
      {/* Toast for Song Saved */}
      {songToast && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[150] bg-neutral-900/95 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-2xl border border-white/20 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
          {songToast}
        </div>
      )}

      {/* PC Floating Close Button */}
      <button 
        type="button"
        onClick={onClose} 
        className="hidden sm:flex fixed top-5 right-5 sm:top-6 sm:right-6 z-[160] p-3 rounded-full bg-white/10 hover:bg-white/25 text-white border border-white/20 shadow-2xl backdrop-blur-md transition-all cursor-pointer"
        title="Close Story (Esc)"
        aria-label="Close Story"
      >
        <X className="w-5 h-5 stroke-[2.5]" />
      </button>

      {/* Main Full-Bleed Story Canvas (Mobile edge-to-edge, PC sleek phone mockup) */}
      <div 
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="w-full h-full sm:w-[390px] md:w-[410px] sm:h-[min(calc(100vh-32px),820px)] sm:max-h-[94vh] bg-black sm:rounded-[32px] overflow-hidden relative shadow-2xl sm:border sm:border-white/10 flex flex-col justify-between my-auto mx-auto"
      >
        {/* Top Segmented Progress Bar */}
        <div className="absolute top-[max(calc(env(safe-area-inset-top,0px)+8px),12px)] left-3 right-3 flex space-x-1.5 z-40">
          {storiesList.map((st, idx) => (
            <div key={st.id || idx} className="h-1 bg-white/30 rounded-full flex-1 overflow-hidden backdrop-blur-xs">
              <div 
                className="h-full bg-white rounded-full transition-all duration-50" 
                style={{ 
                  width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%' 
                }}
              />
            </div>
          ))}
        </div>

        {/* Top Header: Creator Info & Controls */}
        <div className="absolute top-[max(calc(env(safe-area-inset-top,0px)+22px),26px)] left-3 right-3 flex items-center justify-between z-40">
          {/* Creator Pill */}
          <div className="flex items-center space-x-2 bg-black/40 backdrop-blur-md border border-white/15 pl-1.5 pr-3 py-1.5 rounded-full shadow-lg max-w-[80%] min-w-0">
            <div className="p-[1.5px] rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600 shrink-0">
              <img 
                src={currentStory.authorAvatar || currentStory.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentStory.authorName || currentStory.name)}&background=random`} 
                className="w-7 h-7 rounded-full border border-black/50 object-cover" 
                alt="Avatar" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex flex-col min-w-0 pr-1">
              <span className="text-white font-semibold text-[13px] drop-shadow-md truncate">{currentStory.authorName || currentStory.name}</span>
              <span className="text-white/70 text-[10px] font-normal drop-shadow-xs">{currentStory.createdAt ? formatTime(currentStory.createdAt) : 'Just now'}</span>
            </div>

            {/* Song Pill */}
            {hasSong && (
              <button
                type="button"
                onClick={handleSaveSong}
                className="flex items-center space-x-1 bg-white/20 hover:bg-white/30 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/25 text-white transition-transform shrink-0 cursor-pointer shadow-xs max-w-[120px]"
                title="Click to save song"
              >
                <Music className="w-2.5 h-2.5 text-purple-300 animate-spin [animation-duration:5s] shrink-0" />
                <span className="text-[10px] font-medium truncate drop-shadow-xs max-w-[70px]">
                  {currentStory.songTitle || currentStory.songInfo?.title || 'Audio'}
                </span>
                <Bookmark className={`w-2.5 h-2.5 shrink-0 ${isSongSaved ? 'text-amber-300 fill-amber-300' : 'text-white/80'}`} />
              </button>
            )}
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center space-x-1.5 shrink-0">
            {currentUser?.uid === currentStory.authorId && (
              <button 
                onClick={handleDelete} 
                title="Delete Story" 
                className="w-8 h-8 bg-black/40 hover:bg-red-500/80 rounded-full flex items-center justify-center transition-all text-white backdrop-blur-md border border-white/15 shadow-md cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button 
              onClick={onClose} 
              title="Close" 
              className="w-8 h-8 bg-black/40 hover:bg-white/25 rounded-full flex items-center justify-center transition-all text-white backdrop-blur-md border border-white/15 shadow-md cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Audio Element if Story has music */}
        {currentStory.songUrl && currentStory.type !== 'video' && (
          <audio src={currentStory.songUrl} autoPlay loop playsInline className="hidden" />
        )}

        {/* Story Media */}
        {currentStory.type === 'video' || (currentStory.mediaUrl && (currentStory.mediaUrl.match(/\.(mp4|webm|mov|m4v|ogg|3gp)($|#|\?)/i) || currentStory.mediaUrl.includes('/stories/') || currentStory.mediaUrl.includes('video'))) ? (
          <video 
            ref={videoRef}
            src={currentStory.mediaUrl || currentStory.bg} 
            autoPlay 
            playsInline 
            // @ts-ignore
            webkit-playsinline="true"
            // @ts-ignore
            x5-playsinline="true"
            poster={currentStory.thumbnailUrl || undefined}
            preload="auto"
            onLoadedMetadata={onVideoLoaded}
            onCanPlay={() => {
              videoRef.current?.play().catch(() => {});
            }}
            className="w-full h-full object-cover" 
          />
        ) : (
          <img 
            src={currentStory.mediaUrl || currentStory.bg || `https://picsum.photos/seed/${currentStory.id}/800/1600`} 
            className="w-full h-full object-cover" 
            alt="Story content" 
            referrerPolicy="no-referrer"
          />
        )}

        {/* Left / Right Tap Zones for Navigation */}
        <div className="absolute inset-0 flex z-20 pointer-events-auto">
          <div onClick={handlePrev} className="w-[35%] h-[75%] my-auto cursor-pointer" title="Previous Story" />
          <div className="w-[30%] h-[75%] my-auto" />
          <div onClick={handleNext} className="w-[35%] h-[75%] my-auto cursor-pointer" title="Next Story" />
        </div>

        {/* Floating Heart Reaction Pop Animation */}
        {showHeartAnim && (
          <div className="absolute inset-0 flex items-center justify-center p-6 z-[60] pointer-events-none">
            <Heart className="w-32 h-32 text-rose-500 fill-rose-500 animate-ping opacity-0" />
          </div>
        )}

        {/* Bottom Floating Area: Quick Emojis + Modern Reply Input Bar */}
        <div className="absolute bottom-0 left-0 right-0 z-30 pb-[max(calc(env(safe-area-inset-bottom,0px)+10px),14px)] px-3 sm:px-4 space-y-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-8">
          {/* Quick Reaction Emojis */}
          <div className="flex items-center justify-around px-2">
            {quickEmojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleQuickEmoji(emoji)}
                className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-lg transition-transform cursor-pointer shadow-sm"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Reply Form */}
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-white/20 hover:bg-white/25 focus-within:bg-white/30 backdrop-blur-xl border border-white/20 rounded-full px-4 py-2 flex items-center shadow-lg transition-all">
              <input 
                type="text" 
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendReply();
                }}
                placeholder={`Reply to ${currentStory.authorName || currentStory.name}...`} 
                className="flex-1 bg-transparent text-white placeholder-white/70 text-[13.5px] focus:outline-none font-normal" 
              />
              {replyText.trim() && (
                <button onClick={handleSendReply} className="p-1 text-white hover:text-purple-300 transition-colors shrink-0 cursor-pointer">
                  <Send className="w-4 h-4 fill-white" />
                </button>
              )}
            </div>

            <button 
              onClick={handleReact} 
              className="w-10 h-10 bg-black/45 backdrop-blur-xl border border-white/15 rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-all shrink-0 shadow-lg cursor-pointer"
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-rose-500 text-rose-500' : 'text-white'}`} />
            </button>

            <button 
              onClick={handleShare} 
              className="w-10 h-10 bg-black/45 backdrop-blur-xl border border-white/15 rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-all shrink-0 shadow-lg cursor-pointer"
            >
              <Share2 className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {showShareModal && (
          <Suspense fallback={null}>
            <SharePortal reel={currentStory} onClose={() => setShowShareModal(false)} />
          </Suspense>
        )}
      </div>
    </div>
  );
});

const GlobalReelItem = memo(({ reel }: { reel: any }) => {
  const [liked, setLiked] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [likesCount, setLikesCount] = useState(reel.likesCount || 0);
  const [commentsCount, setCommentsCount] = useState(reel.commentsCount || 0);
  const [saved, setSaved] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [floatingHearts, setFloatingHearts] = useState<{ id: number, x: number, y: number, color: string }[]>([]);
  const { setViewingUser, setCurrentPage, setViewingReel, currentUser } = useAppStore();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'posts', reel.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setLikesCount(data.likesCount || 0);
        setCommentsCount(data.commentsCount || 0);
      }
    }, () => {});

    if (currentUser) {
      import('firebase/firestore').then(m => {
        const likeRef = m.doc(db, 'posts', reel.id, 'likes', currentUser.uid);
        const favRef = m.doc(db, 'users', currentUser.uid, 'favorites', reel.id);
        const followRef = m.doc(db, 'users', currentUser.uid, 'following', reel.authorId || reel.authorUID);

        m.onSnapshot(likeRef, (s) => setLiked(s.exists()), () => {});
        m.onSnapshot(favRef, (s) => setSaved(s.exists()), () => {});
        m.onSnapshot(followRef, (s) => setIsFollowingUser(s.exists()), () => {});
      });
    }
    return () => unsub();
  }, [reel.id, currentUser]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setPlaying(true);
            import('./services/postService').then(m => m.incrementViewCount(reel.id, currentUser?.uid || 'anonymous'));
          } else {
            setPlaying(false);
            if (videoRef.current) {
              videoRef.current.pause();
              videoRef.current.currentTime = 0;
            }
          }
        });
      },
      { threshold: 0.8 }
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [reel.id]);

  useEffect(() => {
    if (videoRef.current) {
      if (playing) videoRef.current.play().catch(() => setPlaying(false));
      else videoRef.current.pause();
    }
  }, [playing]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(p);
    }
  };

  const handleLike = async () => {
    if (!currentUser) return;
    try {
      const { toggleLike } = await import('./services/postService');
      const { sendNotification } = await import('./services/notificationService');
      const newLiked = !liked;
      setLiked(newLiked);
      setLikesCount(prev => newLiked ? prev + 1 : prev - 1);
      await toggleLike(reel.id, currentUser.uid);
      if (newLiked) {
        await sendNotification(reel.authorId || reel.authorUID, 'like', currentUser, reel.id, reel.id, reel.media?.[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleVideoClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (e.detail === 1) {
      setPlaying(!playing);
    } else {
      const colors = ['#ff0000', '#ff69b4', '#ff1493', '#ff4500', '#ff8c00', '#00ff00', '#00ffff', '#ffff00'];
      const newHeart = {
        id: Date.now() + Math.random(),
        x,
        y,
        color: colors[Math.floor(Math.random() * colors.length)]
      };
      setFloatingHearts(prev => [...prev, newHeart]);
      if (!liked) handleLike();
      setTimeout(() => setFloatingHearts(prev => prev.filter(h => h.id !== newHeart.id)), 1000);
    }
  };

  const isCurrentUser = currentUser?.uid === (reel.authorId || reel.authorUID);
  const { setHighlightedCommentId, highlightedCommentId, highlightedPostId, setHighlightedPostId } = useAppStore();

  useEffect(() => {
    if (highlightedPostId === reel.id && highlightedCommentId && currentUser) {
      setShowComments(true);
    }
  }, [highlightedCommentId, highlightedPostId, reel.id, currentUser]);

  useEffect(() => {
    return () => {
      if (highlightedPostId === reel.id) {
        setHighlightedPostId(null);
        setHighlightedCommentId(null);
      }
    };
  }, [reel.id, highlightedPostId, setHighlightedPostId, setHighlightedCommentId]);

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    try {
      const { deletePost } = await import('./services/postService');
      await deletePost(reel.id, currentUser!.uid);
      setViewingReel(null);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full snap-start snap-always flex items-center justify-center relative">
      {/* Main Video Container - Slim/Compact */}
      <div 
        onClick={handleVideoClick}
        className="relative w-full h-full sm:h-[90%] sm:max-h-[850px] sm:w-[340px] aspect-[9/16] bg-black sm:rounded-[40px] overflow-hidden flex shadow-2xl shrink-0 border border-white/5 cursor-pointer"
      >
          <video 
            ref={videoRef}
            src={reel.media?.[0]} 
            loop 
            muted={muted}
            playsInline
            preload="metadata"
            onTimeUpdate={handleTimeUpdate}
            className={`w-full h-full object-contain transition-opacity duration-200 ${playing ? 'opacity-100' : 'opacity-80'}`}
          />
          
          {/* Clean view without giant play overlay */}

          <AnimatePresence>
            {floatingHearts.map(heart => (
              <motion.div
                key={heart.id}
                initial={{ opacity: 1, scale: 0.5, y: 0 }}
                animate={{ opacity: 0, scale: 2.5, y: -200, rotate: (Math.random() - 0.5) * 60 }}
                className="absolute z-50 pointer-events-none"
                style={{ left: heart.x - 20, top: heart.y - 20 }}
              >
                <Heart className="w-12 h-12 fill-current drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]" style={{ color: heart.color }} />
              </motion.div>
            ))}
          </AnimatePresence>

          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 pointer-events-none"></div>
          
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-30">
            <div className="h-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-50" style={{ width: `${progress}%` }}></div>
          </div>

          <div className="absolute bottom-6 left-6 right-16 z-10">
            <div className="flex items-center space-x-3 mb-4">
              <img 
                onClick={(e) => { e.stopPropagation(); setViewingUser({ uid: reel.authorId, name: reel.authorName, avatar: reel.authorAvatar }); setViewingReel(null); setCurrentPage('profile'); }}
                src={reel.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(reel.authorName || 'User')}&background=random`} 
                className="w-11 h-11 rounded-full border-2 border-white shadow-lg object-cover cursor-pointer" 
                alt="avatar" 
                referrerPolicy="no-referrer"
              />
              <span onClick={(e) => { e.stopPropagation(); setViewingUser({ uid: reel.authorId, name: reel.authorName, avatar: reel.authorAvatar }); setViewingReel(null); setCurrentPage('profile'); }} className="text-white font-normal text-[16px] drop-shadow-lg cursor-pointer">{reel.authorName}</span>
              {!isCurrentUser && (
                <button 
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!currentUser) return;
                    const { followUser, unfollowUser } = await import('./services/followService');
                    if (isFollowingUser) {
                      await unfollowUser(currentUser.uid, reel.authorId || reel.authorUID);
                    } else {
                      await followUser(currentUser, { uid: reel.authorId, name: reel.authorName, avatar: reel.authorAvatar });
                    }
                  }}
                  className={`px-4 py-1.5 rounded-xl text-[13px] font-normal transition-all backdrop-blur-md border ${isFollowingUser ? 'bg-white/10 border-white/30 text-white' : 'bg-white border-white text-black'}`}
                >
                  {isFollowingUser ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
            <p className="text-white text-[14px] leading-relaxed drop-shadow-lg font-normal mb-4 line-clamp-3">
              {reel.text}
            </p>
          </div>

          <div 
            onClick={(e) => { e.stopPropagation(); setMuted(!muted); }}
            className="absolute bottom-4 right-4 p-2 bg-black/40 rounded-full backdrop-blur-sm cursor-pointer hover:bg-black/60 transition-colors z-20"
          >
            {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white" />}
          </div>

          <div className="absolute right-4 bottom-20 flex flex-col items-center space-y-7 z-20">
            <button onClick={(e) => { e.stopPropagation(); handleLike(); }} className="flex flex-col items-center group">
              <Heart className={`w-[28px] h-[28px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] transition-transform  ${liked ? 'fill-red-500 text-red-500' : 'text-white'}`} strokeWidth={2.5} />
              <span className="text-xs font-normal mt-1 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{likesCount}</span>
            </button>
            <button onClick={(e) => { e.stopPropagation(); setShowComments(true); }} className="flex flex-col items-center group">
              <MessageCircle className="w-[28px] h-[28px] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" strokeWidth={2.5} />
              <span className="text-xs font-normal mt-1 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{commentsCount}</span>
            </button>
            <button onClick={(e) => { e.stopPropagation(); setShowShare(true); }} className="flex flex-col items-center group">
              <Share className="w-[28px] h-[28px] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" strokeWidth={2.5} />
            </button>
            {isCurrentUser && (
              <button onClick={(e) => { e.stopPropagation(); handleDelete(); }} className={`flex flex-col items-center group ${confirmDelete ? 'text-red-600' : 'text-red-500'}`}>
                <Trash2 className="w-[28px] h-[28px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" strokeWidth={2.5} />
                <span className="text-[9px] font-normal mt-1 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-tight text-center">{confirmDelete ? 'Confirm?' : ''}</span>
              </button>
            )}
          </div>

          {showComments && (
            <div onClick={(e) => e.stopPropagation()} className="absolute bottom-0 left-0 right-0 h-[70%] z-50 bg-white rounded-t-3xl animate-in slide-in-from-bottom duration-300 flex flex-col shadow-2xl">
              <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1"></div>
              <div className="flex items-center justify-between p-4 border-b border-gray-50">
                <span className="font-normal text-gray-900">Comments</span>
                <button onClick={() => setShowComments(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                <CommentsFeed postId={reel.id} />
              </div>
            </div>
          )}
          {showShare && (
            <Suspense fallback={null}>
              <SharePortal reel={reel} onClose={() => setShowShare(false)} />
            </Suspense>
          )}
        </div>
      </div>
  );
});

const CommentsFeed = ({ postId }: { postId: string }) => {
  const [comments, setComments] = useState<any[]>([]);
  const { currentUser } = useAppStore();

  useEffect(() => {
    import('./services/postService').then(m => m.getComments(postId)).then(setComments);
  }, [postId]);

  const handleDeleteComment = async (commentId: string) => {
    if (!currentUser) return;
    try {
      const { deleteComment } = await import('./services/postService');
      await deleteComment(postId, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (e) {
      console.error(e);
    }
  };

  if (comments.length === 0) return <div className="text-center text-gray-400 py-10">No comments yet</div>;

  return (
    <>
      {comments.map(comment => (
        <div key={comment.id} className="flex space-x-3 group relative">
          <img src={comment.authorAvatar} className="w-8 h-8 rounded-full object-cover" alt="" referrerPolicy="no-referrer" />
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <p className="text-[13px] font-normal text-gray-900">{comment.authorName}</p>
              {currentUser?.uid === comment.authorId && (
                <button onClick={() => handleDeleteComment(comment.id)} className="text-[10px] text-gray-400 hover:text-red-500 uppercase font-normal">Delete</button>
              )}
            </div>
            {comment.text && <p className="text-[14px] text-gray-800 leading-snug">{comment.text}</p>}
            {comment.stickerUrl && (() => {
              let stkUrl = comment.stickerUrl;
              if (stkUrl.includes('/uploads/')) {
                stkUrl = `/uploads/${stkUrl.split('/uploads/')[1]}`;
              }
              const isVid = stkUrl.endsWith('.mp4') || stkUrl.endsWith('.webm') || stkUrl.endsWith('.mov');
              const isImg = stkUrl.startsWith('http') || stkUrl.startsWith('/') || stkUrl.startsWith('data:') || stkUrl.endsWith('.webp') || stkUrl.endsWith('.png') || stkUrl.endsWith('.gif') || stkUrl.endsWith('.jpg') || stkUrl.endsWith('.jpeg');
              return (
                <div className="my-1">
                  {isVid ? (
                    <video src={stkUrl} autoPlay loop muted playsInline className="h-16 w-16 object-contain rounded-xl shadow-xs" />
                  ) : isImg ? (
                    <img 
                      src={stkUrl} 
                      className="h-16 w-16 object-contain rounded-xl shadow-xs" 
                      alt="Sticker" 
                      referrerPolicy="no-referrer" 
                      onError={(e) => {
                        const el = e.currentTarget;
                        if (stkUrl.includes('/uploads/') && !el.dataset.retried) {
                          el.dataset.retried = 'true';
                          el.src = `/uploads/${stkUrl.split('/uploads/')[1]}`;
                        }
                      }}
                    />
                  ) : (
                    <span className="text-2xl">{stkUrl}</span>
                  )}
                </div>
              );
            })()}
            {comment.imageUrl && (
              <img src={comment.imageUrl} className="mt-1 max-h-36 max-w-[180px] rounded-xl object-cover border border-gray-100" alt="Attachment" />
            )}
          </div>
        </div>
      ))}
    </>
  );
};
