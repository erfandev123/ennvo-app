import { create } from 'zustand';
import { User as AppUser } from './types';

export type PageType = 'home' | 'search' | 'reels' | 'messages' | 'notifications' | 'create' | 'profile' | 'settings' | 'edit-profile';

export type Media = {
  type: 'post' | 'reel' | 'image' | 'video';
  url: string;
  user?: { name: string; avatar: string };
  likes?: number;
  comments?: number;
};

export type CachedUser = {
  uid: string;
  name: string;
  avatar: string;
  username?: string;
  isVerified?: boolean;
};

type AppState = {
  currentPage: PageType;
  setCurrentPage: (page: PageType) => void;
  currentUser: AppUser | null;
  setCurrentUser: (user: AppUser | null) => void;
  userCache: Record<string, CachedUser>;
  setUserInCache: (user: Partial<CachedUser> & { uid: string }) => void;
  viewingUser: any | null;
  setViewingUser: (user: any | null) => void;
  viewingMedia: Media | null;
  setViewingMedia: (media: Media | null) => void;
  viewingPost: any | null;
  setViewingPost: (post: any | null) => void;
  chatTheme: string;
  setChatTheme: (theme: string) => void;
  viewingStory: any | null;
  setViewingStory: (story: any | null) => void;
  viewingReel: any | null;
  setViewingReel: (reel: any | null) => void;
  viewingReelList: any[] | null;
  setViewingReelList: (list: any[] | null) => void;
  viewingReelContext: 'all' | string; // 'all' or userId
  setViewingReelContext: (ctx: 'all' | string) => void;
  activeChat: string | null;
  setActiveChat: (chatId: string | null) => void;
  showCreatePost: boolean;
  setShowCreatePost: (show: boolean) => void;
  isAuthenticated: boolean;
  setIsAuthenticated: (val: boolean) => void;
  isAuthLoading: boolean;
  setIsAuthLoading: (val: boolean) => void;
  navigationStack: PageType[];
  pushPage: (page: PageType) => void;
  popPage: () => void;
  highlightedCommentId: string | null;
  setHighlightedCommentId: (id: string | null) => void;
  highlightedPostId: string | null;
  setHighlightedPostId: (id: string | null) => void;
  showLikesList: boolean;
  setShowLikesList: (show: boolean) => void;
  targetLikesPostId: string | null;
  setTargetLikesPostId: (id: string | null) => void;
  showViewsList: boolean;
  setShowViewsList: (show: boolean) => void;
  targetViewsPostId: string | null;
  setTargetViewsPostId: (id: string | null) => void;
  showAnalytics: boolean;
  setShowAnalytics: (show: boolean) => void;
  targetAnalyticsPostId: string | null;
  setTargetAnalyticsPostId: (id: string | null) => void;
  notificationCount: number;
  setNotificationCount: (count: number) => void;
  messageCount: number;
  setMessageCount: (count: number) => void;
  lastCheckedActivity: number;
  setLastCheckedActivity: (time: number) => void;
  lastCheckedFollowers: number;
  setLastCheckedFollowers: (time: number) => void;
  cachedFeed: any[];
  setCachedFeed: (posts: any[]) => void;
  cachedReels: any[];
  setCachedReels: (reels: any[]) => void;
  feedScrollY: number;
  setFeedScrollY: (y: number) => void;
  reelsScrollY: number;
  setReelsScrollY: (y: number) => void;
  globalMuted: boolean;
  setGlobalMuted: (val: boolean) => void;
  miniChatUser: any | null;
  setMiniChatUser: (user: any | null) => void;
  cachedChatMessages: Record<string, any[]>;
  setCachedChatMessages: (updater: (prev: Record<string, any[]>) => Record<string, any[]>) => void;
  cachedProfilePosts: Record<string, any[]>;
  setCachedProfilePosts: (id: string, posts: any[]) => void;
  cachedSavedPosts: Record<string, any[]>;
  setCachedSavedPosts: (id: string, posts: any[]) => void;
  cachedConversations: any[];
  setCachedConversations: (updater: any[] | ((prev: any[]) => any[])) => void;
  cachedNotifications: any[];
  setCachedNotifications: (notifs: any[]) => void;
  cachedDiscovery: any[];
  setCachedDiscovery: (items: any[]) => void;
  followingIds: string[];
  setFollowingIds: (ids: string[]) => void;
  isBottomNavHidden: boolean;
  setIsBottomNavHidden: (val: boolean) => void;
  isReelsCleanZoom: boolean;
  setIsReelsCleanZoom: (val: boolean) => void;
  uploadTask: { id: string; progress: number; title: string; type: 'post' | 'reel' | 'story'; status: 'uploading' | 'completed' | 'error' } | null;
  setUploadTask: (task: any) => void;
  selectedCreateSong: any | null;
  setSelectedCreateSong: (song: any | null) => void;
  selectedCreateMode: 'reel' | 'post' | 'story' | null;
  setSelectedCreateMode: (mode: 'reel' | 'post' | 'story' | null) => void;
  activeCallState: {
    callId: string;
    otherUid?: string;
    otherName: string;
    otherAvatar: string;
    type: 'audio' | 'video';
    status: 'ringing' | 'accepted' | 'rejected' | 'ended';
    isCaller: boolean;
  } | null;
  setActiveCallState: (state: any) => void;
  navStyle: 'classic' | 'glass';
  setNavStyle: (style: 'classic' | 'glass') => void;
  showAccountSwitcherModal: boolean;
  setShowAccountSwitcherModal: (show: boolean) => void;
};

const getInitialPage = (): PageType => {
  const last = sessionStorage.getItem('lastVisitedPage');
  if (last === 'home' || last === 'reels') return last as PageType;
  return Math.random() > 0.5 ? 'home' : 'reels';
};

const getInitialUserCache = (): Record<string, CachedUser> => {
  try {
    const raw = localStorage.getItem('userCache');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const getInitialCachedFeed = (): any[] => {
  try {
    const raw = localStorage.getItem('cachedFeed');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const getInitialCachedReels = (): any[] => {
  try {
    const raw = localStorage.getItem('cachedReels');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const getInitialChatMessages = (): Record<string, any[]> => {
  try {
    const raw = localStorage.getItem('cachedChatMessages');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const getInitialConversations = (): any[] => {
  try {
    const raw = localStorage.getItem('cachedConversations');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const useAppStore = create<AppState>((set) => ({
  currentPage: getInitialPage(),
  setCurrentPage: (page) => {
    sessionStorage.setItem('lastVisitedPage', page);
    set({ currentPage: page });
  },
  currentUser: null,
  setCurrentUser: (user) => set((state) => {
    let nextCache = state.userCache;
    if (user && user.uid) {
      nextCache = {
        ...state.userCache,
        [user.uid]: {
          uid: user.uid,
          name: user.name,
          avatar: user.avatar,
          username: user.username,
          isVerified: user.isVerified
        }
      };
      try {
        localStorage.setItem('userCache', JSON.stringify(nextCache));
      } catch (e) {}
    }
    return { currentUser: user, isAuthenticated: !!user, isAuthLoading: false, userCache: nextCache };
  }),
  userCache: getInitialUserCache(),
  setUserInCache: (user) => set((state) => {
    if (!user || !user.uid) return state;
    const existing = state.userCache[user.uid] || {};
    const updatedUser = { ...existing, ...user } as CachedUser;
    const nextCache = { ...state.userCache, [user.uid]: updatedUser };
    try {
      localStorage.setItem('userCache', JSON.stringify(nextCache));
    } catch (e) {}
    return { userCache: nextCache };
  }),
  viewingUser: null,
  setViewingUser: (user) => set((state) => {
    let nextCache = state.userCache;
    if (user && user.uid) {
      nextCache = {
        ...state.userCache,
        [user.uid]: {
          uid: user.uid,
          name: user.name,
          avatar: user.avatar,
          username: user.username,
          isVerified: user.isVerified
        }
      };
      try {
        localStorage.setItem('userCache', JSON.stringify(nextCache));
      } catch (e) {}
    }
    return { viewingUser: user, userCache: nextCache };
  }),
  viewingMedia: null,
  setViewingMedia: (media) => {
    if (media) try { window.history.pushState({ modal: 'media' }, ''); } catch (e) {}
    set({ viewingMedia: media });
  },
  viewingPost: null,
  setViewingPost: (post) => {
    if (post) try { window.history.pushState({ modal: 'post' }, ''); } catch (e) {}
    set({ viewingPost: post });
  },
  chatTheme: (typeof window !== 'undefined' && localStorage.getItem('chatTheme')) || 'bg-image',
  setChatTheme: (theme) => {
    try { localStorage.setItem('chatTheme', theme); } catch (e) {}
    set({ chatTheme: theme });
  },
  viewingStory: null,
  setViewingStory: (story) => {
    if (story) try { window.history.pushState({ modal: 'story' }, ''); } catch (e) {}
    set({ viewingStory: story });
  },
  viewingReel: null,
  setViewingReel: (reel) => {
    if (reel) try { window.history.pushState({ modal: 'reel' }, ''); } catch (e) {}
    set({ viewingReel: reel });
  },
  viewingReelList: null,
  setViewingReelList: (list) => set({ viewingReelList: list }),
  viewingReelContext: 'all',
  setViewingReelContext: (ctx) => set({ viewingReelContext: ctx }),
  activeChat: null,
  setActiveChat: (chatId) => {
    if (chatId) try { window.history.pushState({ chat: chatId }, ''); } catch (e) {}
    set({ activeChat: chatId });
  },
  showCreatePost: false,
  setShowCreatePost: (show) => {
    if (show) try { window.history.pushState({ modal: 'create' }, ''); } catch (e) {}
    set({ showCreatePost: show });
  },
  isAuthenticated: false,
  setIsAuthenticated: (val) => set({ isAuthenticated: val }),
  isAuthLoading: true,
  setIsAuthLoading: (val) => set({ isAuthLoading: val }),
  navigationStack: ['home'],
  pushPage: (page) => set((state) => {
    sessionStorage.setItem('lastVisitedPage', page);
    if (state.currentPage === page) return state;
    try { window.history.pushState({ page }, ''); } catch (e) {}
    return { 
      currentPage: page, 
      navigationStack: [...state.navigationStack, page] 
    };
  }),
  popPage: () => set((state) => {
    if (state.navigationStack.length <= 1) {
      sessionStorage.setItem('lastVisitedPage', 'home');
      return { currentPage: 'home', navigationStack: ['home'] };
    }
    const newStack = [...state.navigationStack];
    newStack.pop();
    const prevPage = newStack[newStack.length - 1];
    sessionStorage.setItem('lastVisitedPage', prevPage);
    return { 
      currentPage: prevPage, 
      navigationStack: newStack 
    };
  }),
  highlightedCommentId: null,
  setHighlightedCommentId: (id) => set({ highlightedCommentId: id }),
  highlightedPostId: null,
  setHighlightedPostId: (id) => set({ highlightedPostId: id }),
  showLikesList: false,
  setShowLikesList: (show) => set({ showLikesList: show }),
  targetLikesPostId: null,
  setTargetLikesPostId: (id) => set({ targetLikesPostId: id }),
  showViewsList: false,
  setShowViewsList: (show) => set({ showViewsList: show }),
  targetViewsPostId: null,
  setTargetViewsPostId: (id) => set({ targetViewsPostId: id }),
  showAnalytics: false,
  setShowAnalytics: (show) => set({ showAnalytics: show }),
  targetAnalyticsPostId: null,
  setTargetAnalyticsPostId: (id) => set({ targetAnalyticsPostId: id }),
  notificationCount: 0,
  setNotificationCount: (count) => set({ notificationCount: count }),
  messageCount: 0,
  setMessageCount: (count) => set({ messageCount: count }),
  lastCheckedActivity: Number(localStorage.getItem('lastCheckedActivity')) || 0,
  setLastCheckedActivity: (time) => {
    localStorage.setItem('lastCheckedActivity', time.toString());
    set({ lastCheckedActivity: time });
  },
  lastCheckedFollowers: Number(localStorage.getItem('lastCheckedFollowers')) || 0,
  setLastCheckedFollowers: (time) => {
    localStorage.setItem('lastCheckedFollowers', time.toString());
    set({ lastCheckedFollowers: time });
  },
  cachedFeed: getInitialCachedFeed(),
  setCachedFeed: (posts) => set(() => {
    try {
      localStorage.setItem('cachedFeed', JSON.stringify(posts.slice(0, 30)));
    } catch (e) {}
    return { cachedFeed: posts };
  }),
  cachedReels: getInitialCachedReels(),
  setCachedReels: (reels) => set(() => {
    try {
      localStorage.setItem('cachedReels', JSON.stringify(reels.slice(0, 30)));
    } catch (e) {}
    return { cachedReels: reels };
  }),
  feedScrollY: 0,
  setFeedScrollY: (y) => {
    set({ feedScrollY: y });
  },
  reelsScrollY: 0,
  setReelsScrollY: (y) => {
    set({ reelsScrollY: y });
  },
  globalMuted: false,
  setGlobalMuted: (val) => set({ globalMuted: val }),
  miniChatUser: null,
  setMiniChatUser: (user) => set({ miniChatUser: user }),
  cachedChatMessages: getInitialChatMessages(),
  setCachedChatMessages: (updater) => set((state) => {
    const next = updater(state.cachedChatMessages);
    try {
      localStorage.setItem('cachedChatMessages', JSON.stringify(next));
    } catch (e) {}
    return { cachedChatMessages: next };
  }),
  cachedConversations: getInitialConversations(),
  setCachedConversations: (updater) => set((state) => {
    const next = typeof updater === 'function' ? updater(state.cachedConversations) : updater;
    try {
      localStorage.setItem('cachedConversations', JSON.stringify(next));
    } catch (e) {}
    return { cachedConversations: next };
  }),
  cachedProfilePosts: {},
  setCachedProfilePosts: (id, posts) => set((state) => ({ cachedProfilePosts: { ...state.cachedProfilePosts, [id]: posts } })),
  cachedSavedPosts: {},
  setCachedSavedPosts: (id, posts) => set((state) => ({ cachedSavedPosts: { ...state.cachedSavedPosts, [id]: posts } })),
  cachedNotifications: [],
  setCachedNotifications: (notifs) => set({ cachedNotifications: notifs }),
  cachedDiscovery: [],
  setCachedDiscovery: (items) => set({ cachedDiscovery: items }),
  followingIds: [],
  setFollowingIds: (ids) => set({ followingIds: ids }),
  isBottomNavHidden: false,
  setIsBottomNavHidden: (val) => set({ isBottomNavHidden: val }),
  isReelsCleanZoom: false,
  setIsReelsCleanZoom: (val) => set({ isReelsCleanZoom: val }),
  uploadTask: null,
  setUploadTask: (task) => set((state) => ({ uploadTask: typeof task === 'function' ? task(state.uploadTask) : task })),
  selectedCreateSong: null,
  setSelectedCreateSong: (song) => set({ selectedCreateSong: song }),
  selectedCreateMode: null,
  setSelectedCreateMode: (mode) => set({ selectedCreateMode: mode }),
  activeCallState: null,
  setActiveCallState: (state) => set({ activeCallState: state }),
  navStyle: (typeof window !== 'undefined' && (localStorage.getItem('ennvo_nav_style') as 'classic' | 'glass')) || 'glass',
  setNavStyle: (style) => {
    try { localStorage.setItem('ennvo_nav_style', style); } catch (e) {}
    set({ navStyle: style });
  },
  showAccountSwitcherModal: false,
  setShowAccountSwitcherModal: (show) => set({ showAccountSwitcherModal: show }),
}));

