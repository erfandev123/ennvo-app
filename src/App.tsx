import React, { useState, useCallback, memo, useEffect, useRef, lazy, Suspense } from 'react';
import { X, Heart, MessageCircle, Share2, Play, ArrowLeft, MoreHorizontal, Send, Bookmark, VolumeX, ChevronUp, ChevronDown, Globe, ImageIcon, UserPlus, MapPin, Share, Trash2, Download, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';

const Home = lazy(() => import('./pages/Home'));
const Search = lazy(() => import('./pages/Search'));
const Reels = lazy(() => import('./pages/Reels'));
const Messages = lazy(() => import('./pages/Messages'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Profile = lazy(() => import('./pages/Profile'));
const EditProfile = lazy(() => import('./pages/EditProfile'));
const Create = lazy(() => import('./pages/Create'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const Settings = lazy(() => import('./pages/Settings'));
const Auth = lazy(() => import('./pages/Auth'));

import MiniChat from './components/MiniChat';
import { CallOverlay } from './components/CallOverlay';
import { AccountSwitcherModal } from './components/AccountSwitcherModal';
import { useAppStore, PageType } from './store';
import { onAuthChange } from './services/authService';
import { 
  FacebookPostSkeleton, 
  FacebookStorySkeleton, 
  FacebookReelSkeleton, 
  FacebookProfileSkeleton, 
  FacebookMessageListSkeleton,
  FacebookSearchSkeleton 
} from './components/Skeletons';
import { setOnline } from './services/presenceService';
import { deleteStory } from './services/storyService';
import { subscribeReels } from './services/postService';
import { deviceNotification } from './services/deviceNotification';
import { formatTime, downloadMediaFile } from './utils';
import { doc, onSnapshot, collection, query, where, getDocFromServer } from 'firebase/firestore';
import { db } from './firebase';
import { ReelItem, SharePortal } from './components/ReelItem';
import { LikesList } from './components/LikesList';
import { AnalyticsModal } from './components/AnalyticsModal';
import { UploadProgressBar } from './components/UploadProgressBar';
import { getPost } from './services/postService';

// Test connection strictly once on boot
async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'system', 'connection_test'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore is in offline mode. Please check your configuration.");
    }
  }
}
testFirestoreConnection();

import { playNotificationSound } from './services/soundService';

const playNotifChime = () => {
  playNotificationSound();
};

const InAppToaster = memo(() => {
  const { currentUser, setViewingMedia, setViewingReel, pushPage, setViewingUser, setHighlightedCommentId, setHighlightedPostId, setActiveChat, activeChat } = useAppStore();
  const [toast, setToast] = useState<any | null>(null);
  const initialLoadRef = React.useRef(true);
  const initialMsgLoadRef = React.useRef(true);
  const timeoutRef = React.useRef<any>(null);

  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(collection(db, 'notifications', currentUser.uid, 'items'), (snap) => {
      if (initialLoadRef.current) {
        initialLoadRef.current = false;
        return;
      }
      const changes = snap.docChanges();
      changes.forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (data.createdAt && Date.now() - data.createdAt.toMillis() < 10000) {
             setToast({ id: change.doc.id, ...data });
             playNotifChime();
             if (timeoutRef.current) clearTimeout(timeoutRef.current);
             timeoutRef.current = setTimeout(() => setToast(null), 4500);
          }
        }
      });
    }, (err) => console.warn('Notif toast error:', err));

    const unsubMsg = onSnapshot(query(collection(db, 'conversations'), where('participantIds', 'array-contains', currentUser.uid)), (snap) => {
      if (initialMsgLoadRef.current) {
        initialMsgLoadRef.current = false;
        return;
      }
      const changes = snap.docChanges();
      changes.forEach(change => {
        if (change.type === 'modified') {
          const data = change.doc.data();
          if (data.unreadCount?.[currentUser.uid] > 0 && data.updatedAt && Date.now() - data.updatedAt.toMillis() < 10000 && activeChat !== change.doc.id) {
             const otherId = data.participantIds.find((id: string) => id !== currentUser.uid);
             const name = data.participantNames?.[otherId] || 'User';
             const avatar = data.participantAvatars?.[otherId] || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
             setToast({ 
               id: change.doc.id, 
               type: 'message', 
               actorName: name, 
               actorAvatar: avatar, 
               content: data.lastMessage,
               conversationId: change.doc.id
             });
             playNotifChime();
             if (timeoutRef.current) clearTimeout(timeoutRef.current);
             timeoutRef.current = setTimeout(() => setToast(null), 4500);
          }
        }
      });
    }, (err) => console.warn('Msg toast error:', err));

    return () => { unsub(); unsubMsg(); };
  }, [currentUser, activeChat]);

  if (!toast) return null;

  const hasMedia = toast.postMedia || toast.mediaUrl;
  const isVideo = hasMedia && (toast.postMedia?.includes('.mp4') || toast.postMedia?.includes('video') || toast.mediaUrl?.includes('.mp4') || toast.mediaUrl?.includes('video'));

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: -100, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -100, opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', damping: 24, stiffness: 350 }}
        className="fixed top-10 sm:top-5 left-0 right-0 z-[300] flex justify-center pointer-events-none px-4 pt-safe"
      >
        <div 
          className="bg-white/95 backdrop-blur-2xl shadow-[0_10px_35px_-5px_rgba(0,0,0,0.15)] border border-gray-100 rounded-2xl flex items-center p-3 pointer-events-auto cursor-pointer max-w-sm w-full transition-transform active:scale-95 relative overflow-hidden group"
          onClick={async () => {
             setToast(null);
             if (toast.type === 'message') {
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
          <img 
            src={toast.actorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(toast.actorName || 'User')}&background=random`} 
            className="w-11 h-11 rounded-full object-cover border border-gray-100 shrink-0 ml-0.5" 
            alt="avatar" 
            referrerPolicy="no-referrer"
          />
          
          {toast.type === 'message' ? (
            <>
              <div className="ml-3 flex-1 min-w-0 pr-1 flex flex-col justify-center">
                <h4 className="text-[13px] font-medium text-gray-900 leading-tight truncate">
                  {toast.actorName || 'User'}
                </h4>
                <p className="text-[12px] font-normal text-gray-600 truncate leading-tight mt-0.5">
                  {toast.content}
                </p>
              </div>

              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setToast(null);
                  setActiveChat(toast.conversationId);
                  pushPage('messages');
                }}
                className="text-[#FE2C55] bg-[#FE2C55]/10 hover:bg-[#FE2C55]/20 font-medium text-[12px] px-3 py-1 rounded-full shrink-0 ml-2 transition-colors active:scale-95"
              >
                Reply
              </button>
            </>
          ) : (
            <div className="ml-3 flex-1 min-w-0 pr-1">
              <p className="text-[13px] text-gray-900 font-normal leading-snug">
                <span className="font-normal text-gray-900 mr-1">{toast.actorName || 'User'}</span>
                <span className="text-gray-900 font-normal">
                  {toast.type === 'like' && 'liked your post.'}
                  {toast.type === 'comment' && `commented: ${toast.content}`}
                  {toast.type === 'follow' && 'started following you.'}
                  {toast.type === 'mention' && 'mentioned you.'}
                  {toast.type === 'favorite' && 'saved your post.'}
                </span>
              </p>
            </div>
          )}

          {/* Small side media box displaying strictly an Image/Video Thumbnail for Reels */}
          {toast.type !== 'message' && hasMedia && (
            <div className="w-11 h-11 rounded-xl bg-gray-900 overflow-hidden relative shrink-0 ml-2 border border-gray-100 shadow-xs flex items-center justify-center">
              {isVideo ? (
                <video 
                  src={`${hasMedia}#t=0.001`} 
                  className="w-full h-full object-cover" 
                  preload="metadata" 
                  muted 
                  playsInline
                />
              ) : (
                <img 
                  src={hasMedia} 
                  className="w-full h-full object-cover" 
                  alt="Thumbnail" 
                  referrerPolicy="no-referrer"
                />
              )}
              {isVideo && (
                <div className="absolute inset-0 bg-black/25 flex items-center justify-center pointer-events-none">
                  <Play className="w-3.5 h-3.5 text-white fill-white drop-shadow-md" />
                </div>
              )}
            </div>
          )}
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
    activeChat, showCreatePost, 
    isAuthenticated, isAuthLoading, 
    currentUser, setCurrentUser, 
    setNotificationCount,
    setMessageCount,
    isBottomNavHidden
  } = useAppStore();

  const [showSplash, setShowSplash] = useState(true);

  // Preload all tab page modules immediately on boot so lazy loading is instant
  useEffect(() => {
    import('./pages/Home');
    import('./pages/Reels');
    import('./pages/Messages');
    import('./pages/Profile');
    import('./pages/Create');
    import('./pages/SearchPage');
    import('./pages/Notifications');
    import('./pages/EditProfile');
    import('./pages/Settings');
  }, []);

  useEffect(() => {
    // Hard limit: Splash screen MUST hide after 2 seconds maximum
    const maxTimer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    if (!isAuthLoading) {
      if (isAuthenticated) {
        const timer = setTimeout(() => setShowSplash(false), 1200);
        return () => { clearTimeout(timer); clearTimeout(maxTimer); };
      } else {
        setShowSplash(false);
      }
    }
    return () => clearTimeout(maxTimer);
  }, [isAuthenticated, isAuthLoading]);

  const [showExitToast, setShowExitToast] = useState(false);
  const lastBackPressRef = useRef<number>(0);

  useEffect(() => {
    // Intercept mobile hardware back button
    window.history.pushState({ page: 'init' }, '');
    const handlePopState = () => {
      const store = useAppStore.getState();
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
        window.history.pushState({ page: 'init' }, '');
        return;
      }
      if (store.showCreatePost) {
        store.setShowCreatePost(false);
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
      if (store.currentPage === 'messages' && store.activeChat) {
        store.setActiveChat(null);
        window.history.pushState({ page: 'init' }, '');
        return;
      }
      if (store.navigationStack.length > 1) {
        store.popPage();
        window.history.pushState({ page: 'init' }, '');
        return;
      }

      // Root page double back press to exit handling
      const now = Date.now();
      if (lastBackPressRef.current && (now - lastBackPressRef.current < 2500)) {
        if (typeof (window as any).AndroidApp?.exitApp === 'function') {
          (window as any).AndroidApp.exitApp();
        }
      } else {
        lastBackPressRef.current = now;
        setShowExitToast(true);
        setTimeout(() => setShowExitToast(false), 2500);
        window.history.pushState({ page: 'init' }, '');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
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

    // Real-time user profile sync
    const unsubscribeUserDoc = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        const uData = { uid: docSnap.id, ...docSnap.data() } as any;
        useAppStore.getState().setUserInCache(uData);
        useAppStore.getState().setCurrentUser(uData);
      }
    }, (err) => console.warn('User sync error:', err));

    const unsubscribeNotifs = onSnapshot(query(collection(db, 'notifications', currentUser.uid, 'items'), where('isRead', '==', false)), (snap) => {
      setNotificationCount(snap.size);
    }, (err) => console.warn('Notif count error:', err));

    const unsubscribeMessages = onSnapshot(query(collection(db, 'conversations'), where('participantIds', 'array-contains', currentUser.uid)), (snap) => {
      let total = 0;
      snap.docs.forEach(doc => {
        const data = doc.data();
        total += (data.unreadCount?.[currentUser.uid] || 0);
      });
      setMessageCount(total);
    }, (err) => console.warn('Msg count error:', err));

    const unsubscribeFollowing = onSnapshot(collection(db, 'users', currentUser.uid, 'following'), (snap) => {
      const ids = snap.docs.map(d => d.id);
      useAppStore.getState().setFollowingIds(ids);
    }, (err) => console.warn('Following count error:', err));

    return () => {
      unsubscribeUserDoc();
      unsubscribeNotifs();
      unsubscribeMessages();
      unsubscribeFollowing();
    };
  }, [isAuthenticated, currentUser?.uid, setNotificationCount, setMessageCount]);
  
  const [realReels, setRealReels] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const unsubscribe = subscribeReels((reels) => {
      setRealReels(reels.slice(0, 50));
    });
    return () => unsubscribe();
  }, [isAuthenticated]);

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
    showCreatePost || 
    !!viewingStory || 
    !!viewingMedia || 
    !!viewingReel || 
    (currentPage === 'messages' && activeChat !== null && window.innerWidth < 768) ||
    ((currentPage === 'search' || currentPage === 'notifications') && window.innerWidth < 768);

  const isSidebarHidden = isBottomNavHidden ||
    currentPage === 'edit-profile' ||
    !!viewingStory || 
    !!viewingMedia || 
    !!viewingReel;

  const isReelsPage = currentPage === 'home';

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

  // Splash screen removed as blocking mechanism, only displayed as overlay
  if (!isAuthenticated && !showSplash && !isAuthLoading) {
    return <Auth />;
  }

  return (
    <div className={`flex h-[100dvh] w-full text-black overflow-hidden font-sans relative ${isReelsPage ? 'bg-black md:bg-[#f8f9fa]' : 'bg-[#faf5ff]'}`}>
      <AnimatePresence>
        {showSplash && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="absolute inset-0 z-[99999] flex flex-col items-center justify-center bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white gpu-accelerated"
          >
            <motion.div 
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35, type: "spring", stiffness: 140, damping: 18 }}
              className="flex flex-col items-center justify-center p-6 text-center"
            >
              <div className="w-24 h-24 rounded-3xl overflow-hidden mb-5 shadow-2xl border-2 border-white/30 p-0.5 bg-white/10 backdrop-blur-md">
                <img src="/Ennvo.png" alt="Ennvo Logo" className="w-full h-full object-cover rounded-[22px]" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-lg mb-1">
                Ennvo
              </h1>
              <p className="text-xs text-white/80 font-medium tracking-wide mb-5">
                Connect • Share • Enjoy
              </p>
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isSidebarHidden && (
        <Sidebar currentPage={currentPage} />
      )}
      <main className={`w-full flex-1 h-full overflow-hidden relative gpu-accelerated`}>
        <Suspense fallback={
          currentPage === 'home' ? (
            <FacebookReelSkeleton />
          ) : currentPage === 'profile' ? (
            <FacebookProfileSkeleton />
          ) : currentPage === 'messages' ? (
            <div className="w-full h-full bg-white max-w-[480px]">
              <FacebookMessageListSkeleton count={9} />
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
                style={{ display: isActive ? 'block' : 'none' }}
                className={`w-full h-full absolute inset-0 ${isActive ? 'z-10 pointer-events-auto' : 'z-0 pointer-events-none'} transition-opacity duration-200 ease-out`}
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
              </div>
            );
          })}
        </Suspense>
      </main>
      {!isNavHidden && <BottomNav />}
      <AccountSwitcherModal />

      {/* Exit Toast Notification */}
      {showExitToast && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 bg-gray-900/95 text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-2xl z-[200] border border-white/20 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          আর একবার ব্যাক চাপুন অ্যাপ থেকে বের হতে
        </div>
      )}

      {/* Global Media Viewer */}
      {viewingMedia && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="absolute top-10 right-4 md:top-6 md:right-6 flex items-center space-x-2 z-50">
            <button 
              onClick={() => {
                const isVid = viewingMedia.type === 'video' || viewingMedia.url?.includes('.mp4') || viewingMedia.url?.includes('video');
                downloadMediaFile(viewingMedia.url, `ennvo_${isVid ? 'video' : 'photo'}_${Date.now()}.${isVid ? 'mp4' : 'jpg'}`);
              }} 
              className="p-3 bg-white/10 hover:bg-white/25 active:scale-90 rounded-full transition-all text-white backdrop-blur-md flex items-center justify-center cursor-pointer shadow-md"
              title="Download"
            >
              <Download className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setViewingMedia(null)} 
              className="p-3 bg-white/10 hover:bg-white/20 active:scale-90 rounded-full transition-all text-white backdrop-blur-md flex items-center justify-center cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="w-full h-full flex flex-col relative overflow-hidden">
            {viewingMedia.user && (
              <div className="absolute top-10 left-4 md:top-6 md:left-6 flex items-center space-x-3 bg-black/40 backdrop-blur-md pl-1.5 pr-4 py-1.5 rounded-full border border-white/10 z-20">
                <img 
                  src={viewingMedia.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(viewingMedia.user.name)}&background=random`} 
                  className="w-9 h-9 rounded-full border-2 border-white/80 object-cover" 
                  alt="Avatar" 
                  referrerPolicy="no-referrer"
                />
                <span className="text-white font-normal text-[14px] drop-shadow-md">{viewingMedia.user.name}</span>
              </div>
            )}
            
            <div className="flex-1 relative flex items-center justify-center p-4 md:p-12 overflow-auto no-scrollbar">
              {(viewingMedia.type === 'video' || viewingMedia.url?.includes('.mp4') || viewingMedia.url?.includes('video')) ? (
                <video
                  src={viewingMedia.url}
                  controls
                  autoPlay
                  playsInline
                  className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                />
              ) : (
                <motion.img 
                  drag
                  dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                  dragElastic={0.1}
                  whileTap={{ scale: 1.2 }}
                  src={viewingMedia.url} 
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-full object-contain shadow-2xl rounded-lg cursor-zoom-in" 
                  alt="Media content" 
                />
              )}
              {viewingMedia.type === 'reel' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global Story Viewer */}
      {viewingStory && (
        <StoryViewer story={viewingStory} onClose={() => setViewingStory(null)} />
      )}

      <InAppToaster />
      <UploadProgressBar />
      <LikesList />
      <ViewsList />
      <AnalyticsModal />
      <MiniChat />
      <CallOverlay />

      {/* Global Reel Viewer (Modal) */}
      {viewingReel && (
        <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center animate-in fade-in duration-200">
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
                  reelsList = realReels.filter(r => r.authorId === viewingReelContext);
                } else {
                  reelsList = realReels;
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
      )}
    </div>
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
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    import('./services/storyService').then((s) => {
      unsub = s.subscribeStories((fetchedStories) => {
        if (fetchedStories && fetchedStories.length > 0) {
          setStoriesList(fetchedStories);
          const foundIdx = fetchedStories.findIndex((st) => st.id === story.id);
          if (foundIdx !== -1) {
            setCurrentIndex(foundIdx);
          }
        }
      });
    });
    return () => {
      if (unsub) unsub();
    };
  }, [story.id]);

  const currentStory = storiesList[currentIndex] || story;

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
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Story by ${currentStory.authorName || currentStory.name}`,
          text: currentStory.text || 'Check out this story!',
          url: window.location.href,
        });
      } catch (e) {}
    } else {
      setShowShareModal(true);
    }
  };

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200 select-none">
      <div 
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="w-full h-full sm:h-[92vh] sm:max-w-[420px] bg-zinc-950 sm:rounded-[36px] rounded-[28px] overflow-hidden relative shadow-2xl border border-white/10 flex flex-col justify-between animate-in zoom-in-95 duration-200"
      >
        {/* Top Segmented Progress Bar */}
        <div className="absolute top-4 left-4 right-4 flex space-x-1.5 z-40">
          {storiesList.map((st, idx) => (
            <div key={st.id || idx} className="h-1 bg-white/25 rounded-full flex-1 overflow-hidden backdrop-blur-sm">
              <div 
                className="h-full bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.9)] transition-all duration-50" 
                style={{ 
                  width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%' 
                }}
              ></div>
            </div>
          ))}
        </div>

        {/* Floating Glass Header */}
        <div className="absolute top-8 left-3.5 right-3.5 flex items-center justify-between z-40">
          <div className="flex items-center space-x-2.5 bg-black/45 backdrop-blur-xl border border-white/15 px-3 py-1.5 rounded-full shadow-lg max-w-[75%] min-w-0">
            <div className="p-[1.5px] rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600 shrink-0">
              <img 
                src={currentStory.authorAvatar || currentStory.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentStory.authorName || currentStory.name)}&background=random`} 
                className="w-8 h-8 rounded-full border border-black/50 object-cover" 
                alt="Avatar" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex flex-col min-w-0 pr-1">
              <span className="text-white font-medium text-[13.5px] drop-shadow-md truncate">{currentStory.authorName || currentStory.name}</span>
              <span className="text-white/70 text-[10.5px] font-normal drop-shadow-sm">{currentStory.createdAt ? formatTime(currentStory.createdAt) : 'Just now'}</span>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            {currentUser?.uid === currentStory.authorId && (
              <button 
                onClick={handleDelete} 
                title="Delete Story" 
                className="w-9 h-9 bg-black/40 hover:bg-red-500/80 rounded-full flex items-center justify-center transition-all text-white backdrop-blur-xl border border-white/15 active:scale-90 shadow-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={onClose} 
              title="Close" 
              className="w-9 h-9 bg-black/40 hover:bg-white/25 rounded-full flex items-center justify-center transition-all text-white backdrop-blur-xl border border-white/15 active:scale-90 shadow-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Attached Song Floating Pill */}
        {(currentStory.songTitle || currentStory.songArtist) && (
          <div className="absolute top-20 left-3.5 z-40 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center space-x-2 bg-black/50 backdrop-blur-xl border border-white/15 px-3 py-1.5 rounded-full shadow-lg">
              <Music className="w-3.5 h-3.5 text-purple-400 animate-spin [animation-duration:5s]" />
              <span className="text-white text-xs font-medium max-w-[210px] truncate drop-shadow">
                {currentStory.songTitle} {currentStory.songArtist ? `• ${currentStory.songArtist}` : ''}
              </span>
            </div>
          </div>
        )}

        {/* Audio Element if Story has music */}
        {currentStory.songUrl && currentStory.type !== 'video' && (
          <audio src={currentStory.songUrl} autoPlay loop playsInline className="hidden" />
        )}

        {/* Story Media */}
        {currentStory.type === 'video' || (currentStory.mediaUrl && (currentStory.mediaUrl.includes('.mp4') || currentStory.mediaUrl.includes('video'))) ? (
          <video 
            ref={videoRef}
            src={currentStory.mediaUrl || currentStory.bg} 
            autoPlay 
            playsInline 
            preload="metadata"
            onLoadedMetadata={onVideoLoaded}
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

        {/* Story Text - Placed Elegantly Near Top */}
        {currentStory.text && (
          <div className={`absolute left-3.5 right-3.5 z-30 pointer-events-none transition-all duration-300 ${
            (currentStory.songTitle || currentStory.songArtist) ? 'top-[115px]' : 'top-20'
          }`}>
            <div className="bg-black/60 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-2.5 max-w-[90%] mx-auto shadow-xl">
              <p className="text-white text-sm sm:text-base font-medium text-center drop-shadow leading-snug">
                {currentStory.text}
              </p>
            </div>
          </div>
        )}

        {/* Left / Right Tap Zones for Instant Navigation */}
        <div className="absolute inset-0 flex z-20 pointer-events-auto">
          <div onClick={handlePrev} className="w-[35%] h-[80%] my-auto cursor-pointer" title="Previous Story" />
          <div className="w-[30%] h-[80%] my-auto" />
          <div onClick={handleNext} className="w-[35%] h-[80%] my-auto cursor-pointer" title="Next Story" />
        </div>

        {showHeartAnim && (
          <div className="absolute inset-0 flex items-center justify-center p-6 z-[60] pointer-events-none">
            <Heart className="w-36 h-36 text-red-500 fill-red-500 scale-150 animate-ping opacity-0" />
          </div>
        )}

        {/* Floating Bottom Reply Bar */}
        <div className="absolute bottom-4 sm:bottom-6 left-0 right-0 px-3.5 sm:px-4 flex items-center space-x-2 z-30 pb-[max(env(safe-area-inset-bottom),8px)]">
          <div className="flex-1 bg-black/45 backdrop-blur-xl border border-white/15 rounded-full px-4 py-2 flex items-center shadow-lg">
            <input 
              type="text" 
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendReply();
              }}
              placeholder={`Reply to ${currentStory.authorName || currentStory.name}...`} 
              className="flex-1 bg-transparent text-white placeholder-white/60 text-[13.5px] focus:outline-none font-normal" 
            />
            {replyText.trim() && (
              <button onClick={handleSendReply} className="p-1 text-purple-400 hover:text-purple-300 transition-colors shrink-0">
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
          <button 
            onClick={handleReact} 
            className="w-10 h-10 bg-black/45 backdrop-blur-xl border border-white/15 rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-all active:scale-90 shrink-0 shadow-lg"
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-red-500 text-red-500' : 'text-white'}`} />
          </button>
          <button 
            onClick={handleShare} 
            className="w-10 h-10 bg-black/45 backdrop-blur-xl border border-white/15 rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-all active:scale-90 shrink-0 shadow-lg"
          >
            <Share2 className="w-5 h-5 text-white" />
          </button>
        </div>

        {showShareModal && (
          <SharePortal reel={currentStory} onClose={() => setShowShareModal(false)} />
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
              <Heart className={`w-[28px] h-[28px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] transition-transform active:scale-125 ${liked ? 'fill-red-500 text-red-500' : 'text-white'}`} strokeWidth={2.5} />
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
            <SharePortal reel={reel} onClose={() => setShowShare(false)} />
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
            <p className="text-[14px] text-gray-800 leading-snug">{comment.text}</p>
          </div>
        </div>
      ))}
    </>
  );
};
