import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { 
  Image as ImageIcon, 
  Video, 
  Smile, 
  MoreHorizontal, 
  Heart, 
  MessageCircle, 
  Send, 
  Bookmark, 
  Plus, 
  Search, 
  X, 
  ChevronDown, 
  ChevronRight, 
  Type, 
  Play, 
  Pause,
  UserPlus, 
  Globe, 
  Share2, 
  Music, 
  Settings2, 
  MoreVertical, 
  ArrowLeft, 
  Bell, 
  Camera,
  Check,
  CheckCheck,
  UserCheck,
  Phone,
  ExternalLink,
  Mic,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { useAppStore } from '../store';
import { db } from '../firebase';
import { subscribeFeed, createPost, subscribeReels } from '../services/postService';
import { subscribeStories, uploadStory, Story } from '../services/storyService';
import { followUser, unfollowUser } from '../services/followService';
import { 
  sendMessage, 
  subscribeMessages, 
  createConversation, 
  markConversationRead, 
  compressChatImageBase64,
  createClientMessageId
} from '../services/chatService';
import { subscribePresence, setTyping, subscribeTyping } from '../services/presenceService';
import { initiateCall } from '../services/callService';
import { playMessageSentSound } from '../services/soundService';
import { formatTime } from '../utils';
import { Post, Comment, User as AppUser, Message } from '../types';
import { PostItem } from '../components/PostItem';
import { CreatePostModal } from '../components/CreatePostModal';
import { PullToRefresh } from '../components/PullToRefresh';
import { FacebookStorySkeleton, FacebookPostSkeleton } from '../components/Skeletons';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { useShallow } from 'zustand/react/shallow';
import { formatMediaUrl } from '../utils';

// --- Dedicated 2D User Search Bar with Live Dropdown ---
export const FeedUserSearchBar: React.FC<{ className?: string; placeholder?: string }> = React.memo(({ 
  className = '', 
  placeholder = 'Search by User ID, name, @...' 
}) => {
  const { pushPage, setViewingUser } = useAppStore(useShallow((s: any) => ({ pushPage: s.pushPage, setViewingUser: s.setViewingUser })));
  const [queryText, setQueryText] = useState('');
  const [searchResults, setSearchResults] = useState<AppUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = queryText.trim().toLowerCase();
    if (!trimmed) {
      setSearchResults([]);
      setIsDropdownOpen(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { collection, getDocs, query: fsQuery, limit } = await import('firebase/firestore');
        const snap = await getDocs(fsQuery(collection(db, 'users'), limit(80)));
        const cleanTrim = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;

        const matched = snap.docs
          .map(d => ({ uid: d.id, ...d.data() } as AppUser))
          .filter(u => {
            const uId = (u.uid || '').toLowerCase();
            const uName = (u.name || '').toLowerCase();
            const uUname = (u.username || '').toLowerCase();
            return uId.includes(cleanTrim) || uName.includes(cleanTrim) || uUname.includes(cleanTrim);
          })
          .slice(0, 6);

        setSearchResults(matched);
        setIsDropdownOpen(true);
      } catch (e) {
        console.error('Search error:', e);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [queryText]);

  const handleSelectUser = (user: AppUser) => {
    setViewingUser({ uid: user.uid, name: user.name, avatar: user.avatar });
    pushPage('profile');
    setIsDropdownOpen(false);
    setQueryText('');
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
        <input 
          type="text" 
          placeholder={placeholder}
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          onFocus={() => { if (searchResults.length > 0) setIsDropdownOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (searchResults.length > 0) {
                handleSelectUser(searchResults[0]);
              } else if (queryText.trim()) {
                pushPage('search');
              }
            }
          }}
          className="w-full bg-neutral-100/90 dark:bg-white/[0.06] border-0 rounded-full pl-9.5 pr-8 py-2.5 text-[13.5px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-neutral-300 dark:focus:ring-white/20 transition-all select-text"
        />
        {queryText && (
          <button 
            onClick={() => { setQueryText(''); setIsDropdownOpen(false); }}
            className="absolute right-3 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Live search dropdown */}
      <AnimatePresence>
        {isDropdownOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-black border border-gray-200/90 dark:border dark:border-white/20 rounded-2xl shadow-xl overflow-hidden z-50 py-1"
          >
            {isSearching ? (
              <div className="p-3 text-center text-xs text-gray-400">Searching...</div>
            ) : searchResults.length === 0 ? (
              <div className="p-3 text-center text-xs text-gray-400">No user found</div>
            ) : (
              searchResults.map(u => (
                <div 
                  key={u.uid}
                  onClick={() => handleSelectUser(u)}
                  className="flex items-center space-x-3 px-3.5 py-2 hover:bg-gray-50 dark:hover:bg-white/10 cursor-pointer transition-colors"
                >
                  <img 
                    src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`} 
                    className="w-9 h-9 rounded-full object-cover border border-gray-200/90 dark:border-white/20 shrink-0" 
                    alt={u.name}
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-1 truncate">
                      <span className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">{u.name}</span>
                      {u.isVerified && <VerifiedBadge className="w-3 h-3" />}
                    </div>
                    <div className="flex items-center space-x-1.5 text-[11px] text-gray-400 truncate">
                      <span>@{u.username || u.name.toLowerCase().replace(/\s+/g, '')}</span>
                      <span>•</span>
                      <span className="font-mono text-[10px] text-gray-400">ID: {u.uid.slice(0, 6)}...</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// --- Memoized Elongated Squircle Story Item matching Screen 3 (Enlarged) ---
const StoryItem = React.memo(({ story, onClick }: { story: any, onClick: () => void }) => {
  if (story.isUser) {
    return (
      <div 
        onClick={onClick} 
        className="relative shrink-0 cursor-pointer group transition-all select-none w-[96px] h-[142px] sm:w-[110px] sm:h-[162px] rounded-[24px] sm:rounded-[26px] overflow-hidden bg-neutral-100 dark:bg-white/[0.06] flex flex-col justify-between p-2.5 shadow-xs ring-1 ring-black/5 dark:ring-white/10"
      >
        <img 
          src={formatMediaUrl(story.bg) || `https://ui-avatars.com/api/?name=${encodeURIComponent(story.name || 'User')}&background=random`} 
          alt="My Story" 
          loading="lazy" 
          decoding="async" 
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300" 
        />
        {/* Top Plus Badge - positioned on the left */}
        <div className="relative z-10 self-start w-8 h-8 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shadow-md ring-2 ring-white/90 dark:ring-black/90 transition-transform">
          <Plus className="w-4 h-4 stroke-[3]" />
        </div>
        {/* Bottom Label */}
        <div className="relative z-10 w-full text-center px-1 pb-0.5">
          <span className="inline-block max-w-full text-[11px] sm:text-[12px] font-semibold text-white tracking-tight leading-tight drop-shadow-[0_1.5px_4px_rgba(0,0,0,0.95)] truncate">
            Add Story
          </span>
        </div>
      </div>
    );
  }

  const avatarImg = story.authorAvatar || story.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(story.authorName || story.name || 'User')}&background=random`;
  const mediaImg = story.thumbnailUrl || story.thumbnail || story.mediaUrl || story.bg || avatarImg;

  return (
    <div 
      onClick={onClick} 
      className="relative shrink-0 cursor-pointer group transition-all select-none w-[96px] h-[142px] sm:w-[110px] sm:h-[162px] rounded-[24px] sm:rounded-[26px] overflow-hidden bg-neutral-100 dark:bg-white/[0.06] flex flex-col justify-between p-2.5 shadow-xs ring-1 ring-black/5 dark:ring-white/10"
    >
      <img 
        src={formatMediaUrl(mediaImg)} 
        alt="Story" 
        loading="lazy" 
        decoding="async" 
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300" 
        onError={(e) => { (e.currentTarget as HTMLImageElement).src = avatarImg; }}
      />
      {/* Top author mini avatar - clean, left side, without blue box */}
      <div className="relative z-10 self-start w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/95 dark:ring-black/90 shadow-sm shrink-0">
        <img 
          src={formatMediaUrl(avatarImg)} 
          alt="" 
          className="w-full h-full object-cover"
        />
      </div>
      {/* Bottom author name - centered at bottom inside box, not on the left, elegant font */}
      <div className="relative z-10 w-full text-center px-1 pb-0.5">
        <span className="inline-block max-w-full text-[11px] sm:text-[12px] font-semibold text-white tracking-tight leading-tight drop-shadow-[0_1.5px_4px_rgba(0,0,0,0.95)] truncate">
          {story.authorName || story.name || 'User'}
        </span>
      </div>
    </div>
  );
});

// --- Suggested Account Card in Right Panel ---
const SuggestedRightItem: React.FC<{ user: AppUser }> = React.memo(({ user }) => {
  const { setViewingUser, currentUser, pushPage, followingIds } = useAppStore(useShallow((s: any) => ({ setViewingUser: s.setViewingUser, currentUser: s.currentUser, pushPage: s.pushPage, followingIds: s.followingIds })));
  const [optimisticFollowing, setOptimisticFollowing] = useState<boolean | null>(null);
  const isFollowing = optimisticFollowing !== null ? optimisticFollowing : (followingIds || []).includes(user.uid);

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    try {
      if (isFollowing) {
        setOptimisticFollowing(false);
        await unfollowUser(currentUser.uid, user.uid);
      } else {
        setOptimisticFollowing(true);
        await followUser(currentUser, user);
      }
    } catch (err) {
      console.error(err);
      setOptimisticFollowing(null);
    }
  };

  return (
    <div 
      className="flex items-center justify-between py-2 px-1 hover:bg-neutral-100/70 dark:hover:bg-white/5 rounded-2xl transition-colors cursor-pointer select-none"
      onClick={() => { 
        setViewingUser({ uid: user.uid, name: user.name, avatar: user.avatar }); 
        pushPage('profile'); 
      }}
    >
      <div className="flex items-center space-x-3 min-w-0 flex-1 pr-2">
        <img 
          src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} 
          className="w-10 h-10 rounded-full object-cover ring-1 ring-black/5 dark:ring-white/10 shrink-0" 
          alt={user.name} 
          referrerPolicy="no-referrer"
        />
        <div className="truncate min-w-0">
          <div className="flex items-center space-x-1 truncate">
            <h4 className="font-bold text-[13.5px] text-gray-900 dark:text-white truncate">{user.name}</h4>
            {user.isVerified && <VerifiedBadge className="w-3.5 h-3.5" />}
          </div>
          <p className="text-[11.5px] text-gray-500 dark:text-gray-400 truncate">
            @{user.username || user.name.toLowerCase().replace(/\s+/g, '')}
          </p>
        </div>
      </div>

      <button 
        onClick={handleFollow}
        className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all  shrink-0 cursor-pointer border-0 ${
          isFollowing 
            ? 'bg-neutral-200 dark:bg-white/10 text-gray-600 dark:text-gray-300 shadow-none' 
            : 'bg-gradient-to-r from-[#ff3b5c] to-[#ff5376] hover:brightness-105 text-white shadow-sm'
        }`}
      >
        {isFollowing ? 'Following' : 'Follow'}
      </button>
    </div>
  );
});

// --- Suggested Accounts Feed Inset (Unique Frameless, No Border Box) ---
const SuggestedAccountItem: React.FC<{ user: AppUser }> = React.memo(({ user }) => {
  const { setViewingUser, currentUser, pushPage, followingIds } = useAppStore(useShallow((s: any) => ({ setViewingUser: s.setViewingUser, currentUser: s.currentUser, pushPage: s.pushPage, followingIds: s.followingIds })));
  const [optimisticFollowing, setOptimisticFollowing] = useState<boolean | null>(null);
  const isFollowing = optimisticFollowing !== null ? optimisticFollowing : (followingIds || []).includes(user.uid);

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;
    try {
      if (isFollowing) {
        setOptimisticFollowing(false);
        await unfollowUser(currentUser.uid, user.uid);
      } else {
        setOptimisticFollowing(true);
        await followUser(currentUser, user);
      }
    } catch (err) {
      console.error(err);
      setOptimisticFollowing(null);
    }
  };

  return (
    <div 
      className="w-[126px] shrink-0 bg-white/70 dark:bg-white/[0.06] backdrop-blur-md hover:bg-white/90 dark:hover:bg-white/[0.09] rounded-[24px] p-3.5 flex flex-col items-center text-center cursor-pointer transition-all border-0 shadow-xs select-none group" 
      onClick={() => { setViewingUser({ uid: user.uid, name: user.name, avatar: user.avatar }); pushPage('profile'); }}
    >
      <div className="relative mb-2">
        <img 
          src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} 
          className="w-12 h-12 rounded-full object-cover ring-2 ring-white/90 dark:ring-white/15 shadow-xs transition-transform" 
          alt={user.name} 
          referrerPolicy="no-referrer"
        />
        {user.isVerified && (
          <div className="absolute -bottom-0.5 -right-0.5">
            <VerifiedBadge className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
      <h4 className="font-bold text-[12.5px] text-neutral-900 dark:text-white truncate w-full mb-0.5">{user.name}</h4>
      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-2.5 truncate w-full">Suggested for you</p>
      <button 
        onClick={handleFollow}
        className={`w-full font-bold py-1.5 rounded-full text-[11px] backdrop-blur-md transition-all  cursor-pointer border-0 shadow-xs ${
          isFollowing 
            ? 'bg-neutral-200/80 dark:bg-white/15 text-neutral-700 dark:text-neutral-200 shadow-none' 
            : 'bg-blue-600/85 hover:bg-blue-600 text-white shadow-blue-500/20'
        }`}
      >
        {isFollowing ? 'Following' : 'Follow'}
      </button>
    </div>
  );
});

const SuggestedAccounts = React.memo(() => {
  const { currentUser, pushPage } = useAppStore(useShallow((s: any) => ({ currentUser: s.currentUser, pushPage: s.pushPage })));
  const [suggested, setSuggested] = useState<AppUser[]>([]);

  useEffect(() => {
    const fetchSuggested = async () => {
      if (!currentUser) return;
      try {
        const { collection, query, limit, getDocs } = await import('firebase/firestore');
        const q = query(collection(db, 'users'), limit(50));
        const snapshot = await getDocs(q);
        const allUsers = snapshot.docs
          .map(d => ({ uid: d.id, ...d.data() } as AppUser))
          .filter(u => u.uid !== currentUser.uid);

        setSuggested(allUsers.slice(0, 10));
      } catch (e) {
        console.error(e);
        setSuggested([]);
      }
    };
    fetchSuggested();
  }, [currentUser]);

  if (suggested.length === 0) return null;

  return (
    <div className="w-full my-3 select-none p-3 sm:p-3.5 rounded-[28px] bg-neutral-100/70 dark:bg-white/[0.04] backdrop-blur-md border-0">
      <div className="flex items-center justify-between mb-2.5 px-1.5">
        <div className="flex items-center space-x-2">
          <UserPlus className="w-4 h-4 text-neutral-800 dark:text-neutral-200 stroke-[2.2]" />
          <h3 className="font-bold text-[14px] text-neutral-900 dark:text-white tracking-tight">Suggested for you</h3>
        </div>
        <button onClick={() => pushPage('search')} className="text-blue-600 dark:text-blue-400 font-semibold text-xs hover:underline transition-colors cursor-pointer">
          See all
        </button>
      </div>
      <div className="flex space-x-2.5 overflow-x-auto no-scrollbar pb-0.5">
        {suggested.map(user => (
          <SuggestedAccountItem key={user.uid} user={user} />
        ))}
      </div>
    </div>
  );
});

// --- Right Panel Inline Mobile-Sized Chat View (Replaces friends list on click, with back button) ---
const RightPanelInlineChat: React.FC<{
  contact: any;
  onBack: () => void;
}> = React.memo(({ contact, onBack }) => {
  const { currentUser, pushPage, setActiveChat, setActiveCallState, setViewingUser } = useAppStore(useShallow((s: any) => ({ currentUser: s.currentUser, pushPage: s.pushPage, setActiveChat: s.setActiveChat, setActiveCallState: s.setActiveCallState, setViewingUser: s.setViewingUser })));
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const recordingIntervalRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSendingRef = useRef(false);

  useEffect(() => {
    if (contact && currentUser) {
      const initChat = async () => {
        try {
          const id = await createConversation(
            [currentUser.uid, contact.uid],
            {
              [currentUser.uid]: { name: currentUser.name, avatar: currentUser.avatar },
              [contact.uid]: { name: contact.name, avatar: contact.avatar }
            }
          );
          setConversationId(id);
        } catch (e) {
          console.error('Failed to init inline chat:', e);
        }
      };
      initChat();

      const unsubPresence = subscribePresence(contact.uid, (data) => {
        setIsOnline(data.isOnline);
        setLastSeen(data.lastSeen);
      });
      return () => unsubPresence();
    }
  }, [contact, currentUser]);

  useEffect(() => {
    if (conversationId && currentUser) {
      const unsubMsgs = subscribeMessages(conversationId, (msgs) => {
        setMessages(msgs);
        markConversationRead(conversationId, currentUser.uid);
      });
      const unsubTyping = subscribeTyping(conversationId, (users) => {
        setTypingUsers(users.filter(uid => uid !== currentUser.uid));
      });
      return () => {
        unsubMsgs();
        unsubTyping();
      };
    }
  }, [conversationId, currentUser]);

  // Fix: scroll ONLY internal message container, never trigger window auto-scroll
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, typingUsers]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (!isTyping && conversationId && currentUser) {
      setIsTyping(true);
      setTyping(conversationId, currentUser.uid, true);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (conversationId && currentUser) setTyping(conversationId, currentUser.uid, false);
    }, 2000);
  };

  const handleStartCall = async (type: 'audio' | 'video') => {
    if (!currentUser || !contact) return;
    try {
      const { callId } = await initiateCall(
        { uid: currentUser.uid, name: currentUser.name, avatar: currentUser.avatar },
        { uid: contact.uid, name: contact.name, avatar: contact.avatar },
        type,
        () => {},
        () => {}
      );
      setActiveCallState({
        callId,
        otherUid: contact.uid,
        otherName: contact.name,
        otherAvatar: contact.avatar,
        type,
        status: 'ringing',
        isCaller: true
      });
    } catch (err) {
      console.error('Call failed:', err);
    }
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordingDuration(0);
    recordingIntervalRef.current = setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);
  };

  const cancelRecording = () => {
    setIsRecording(false);
    clearInterval(recordingIntervalRef.current);
    setRecordingDuration(0);
  };

  const finishRecording = async () => {
    setIsRecording(false);
    clearInterval(recordingIntervalRef.current);
    if (!conversationId || !currentUser) return;
    const dur = recordingDuration;
    setRecordingDuration(0);
    playMessageSentSound();
    await sendMessage(
      conversationId,
      currentUser.uid,
      'voice',
      `Voice message (${dur}s)`,
      undefined,
      undefined,
      undefined,
      { duration: dur, clientMessageId: createClientMessageId(currentUser.uid) }
    );
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId || !currentUser) return;
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const rawBase64 = reader.result as string;
        const compressed = await compressChatImageBase64(rawBase64);
        playMessageSentSound();
        await sendMessage(conversationId, currentUser.uid, 'image', 'Photo', compressed, undefined, undefined, {
          clientMessageId: createClientMessageId(currentUser.uid),
        });
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Failed to send image:', err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !conversationId || !currentUser || isSendingRef.current) return;
    isSendingRef.current = true;
    playMessageSentSound();
    const text = inputText.trim();
    setInputText('');
    setIsTyping(false);
    setTyping(conversationId, currentUser.uid, false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    try {
      await sendMessage(conversationId, currentUser.uid, 'text', text, undefined, undefined, undefined, {
        clientMessageId: createClientMessageId(currentUser.uid),
      });
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      isSendingRef.current = false;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="w-full h-[calc(100vh-24px)] flex flex-col bg-white dark:bg-black border border-gray-200/90 dark:border dark:border-white/30 rounded-3xl overflow-hidden shadow-none select-none"
    >
      {/* Mobile-Sized Inline Chat Header */}
      <div className="px-3.5 py-2.5 bg-white dark:bg-black border-b border-gray-200/90 dark:border-white/20 flex items-center justify-between">
        <div className="flex items-center space-x-2 min-w-0">
          <button 
            onClick={onBack}
            className="p-1 -ml-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-gray-700 dark:text-white transition-colors cursor-pointer"
            title="Back to contacts"
          >
            <ArrowLeft className="w-4.5 h-4.5" strokeWidth={2.3} />
          </button>

          <div 
            className="relative shrink-0 cursor-pointer"
            onClick={() => {
              setViewingUser({ uid: contact.uid, name: contact.name, avatar: contact.avatar });
              pushPage('profile');
            }}
          >
            <img 
              src={contact.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=random`} 
              className="w-8 h-8 rounded-full object-cover border border-gray-200/90 dark:border-white/20" 
              alt={contact.name} 
              referrerPolicy="no-referrer"
            />
            <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-black ${
              isOnline ? 'bg-emerald-500' : 'bg-gray-400'
            }`} />
          </div>

          <div className="truncate min-w-0">
            <div className="flex items-center space-x-1 truncate">
              <h4 className="font-bold text-[13px] text-gray-900 dark:text-white truncate">
                {contact.name}
              </h4>
              {contact.isVerified && <VerifiedBadge className="w-3 h-3" />}
            </div>
            <p className="text-[10px] font-medium leading-none mt-0.5 truncate">
              {isOnline ? (
                <span className="text-emerald-500 font-semibold">Active now</span>
              ) : (
                <span className="text-gray-400">
                  {lastSeen ? `Active ${formatTime({ toMillis: () => lastSeen } as any)}` : 'Offline'}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Compact action icons: Call & Open in full messages */}
        <div className="flex items-center space-x-0.5 shrink-0 text-gray-600 dark:text-gray-300">
          <button 
            onClick={() => handleStartCall('audio')}
            title="Audio Call"
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-blue-600 dark:text-blue-400 transition-colors cursor-pointer"
          >
            <Phone className="w-3 h-3" />
          </button>

          <button 
            onClick={() => handleStartCall('video')}
            title="Video Call"
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full text-purple-600 dark:text-purple-400 transition-colors cursor-pointer"
          >
            <Video className="w-3 h-3" />
          </button>

          <button 
            onClick={() => {
              setActiveChat(conversationId);
              pushPage('messages');
            }}
            title="Open in Full Messages Page"
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Messages Canvas - Uses messagesContainerRef to eliminate auto-scroll page jumping */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-gray-50/50 dark:bg-black no-scrollbar"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <img 
              src={contact.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=random`} 
              alt={contact.name} 
              className="w-14 h-14 rounded-full object-cover border border-gray-200/90 dark:border-white/20 mb-2"
            />
            <h4 className="font-bold text-sm text-gray-900 dark:text-white">{contact.name}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Start your conversation</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.senderId === currentUser?.uid;
            const isLastMsg = idx === messages.length - 1;

            return (
              <div 
                key={msg.id || idx} 
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                {/* Friend Message Bubble is Pure Black with Crisp White Border in Dark Mode */}
                <div 
                  className={`max-w-[84%] px-3.5 py-2 rounded-2xl text-[13px] leading-relaxed break-words shadow-none ${
                    isMe 
                      ? 'bg-blue-600 dark:bg-black text-white border border-transparent dark:border dark:border-white/30 rounded-br-none' 
                      : 'bg-white dark:bg-black text-gray-900 dark:text-white border border-gray-200/90 dark:border dark:border-white/30 rounded-bl-none'
                  }`}
                >
                  {msg.type === 'voice' ? (
                    <div className="flex items-center space-x-2 py-0.5 min-w-[130px]">
                      <button 
                        onClick={() => setPlayingVoiceId(playingVoiceId === msg.id ? null : (msg.id || 'voice'))}
                        className={`p-1.5 rounded-full shrink-0 ${isMe ? 'bg-white/20 text-white' : 'bg-blue-50 dark:bg-white/10 text-blue-600 dark:text-white'}`}
                      >
                        {playingVoiceId === msg.id ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        )}
                      </button>
                      <div className="flex-1 flex flex-col justify-center">
                        <div className={`h-1.5 rounded-full overflow-hidden ${isMe ? 'bg-white/30' : 'bg-gray-200 dark:bg-white/20'}`}>
                          <div className={`h-full ${playingVoiceId === msg.id ? 'w-2/3 animate-pulse' : 'w-1/3'} ${isMe ? 'bg-white' : 'bg-blue-600'}`} />
                        </div>
                        <span className={`text-[9.5px] mt-0.5 ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                          0:{(msg as any).replyTo?.duration || '04'}s
                        </span>
                      </div>
                    </div>
                  ) : msg.mediaUrl ? (
                    <div className="rounded-xl overflow-hidden my-1">
                      <img 
                        src={msg.mediaUrl} 
                        alt="attachment" 
                        className="max-w-full max-h-[160px] object-cover rounded-xl" 
                      />
                      {msg.content && msg.content !== 'Photo' && (
                        <p className="mt-1 text-[13px]">{msg.content}</p>
                      )}
                    </div>
                  ) : (
                    <span>{msg.content}</span>
                  )}
                </div>

                {/* Read receipt checkmark for sender */}
                {isMe && isLastMsg && (
                  <div className="flex items-center space-x-1 mt-0.5 mr-1 text-[10px] text-gray-400">
                    {msg.status === 'seen' ? (
                      <>
                        <CheckCheck className="w-3 h-3 text-blue-500" />
                        <span>Seen</span>
                      </>
                    ) : msg.status === 'delivered' ? (
                      <>
                        <CheckCheck className="w-3 h-3 text-gray-400" />
                        <span>Delivered</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3 h-3 text-gray-400" />
                        <span>Sent</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-black border border-gray-200/90 dark:border-white/30 rounded-2xl rounded-bl-none px-3.5 py-2 flex items-center space-x-1.5">
              <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
              <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
              <motion.div animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Footer Bar - Pure Black with Crisp White Border in Dark Mode */}
      <div className="p-2.5 bg-white dark:bg-black border-t border-gray-200/90 dark:border-white/20 flex items-center space-x-2 relative">
        <input 
          type="file" 
          ref={fileInputRef} 
          accept="image/*" 
          className="hidden" 
          onChange={handleImageSelect} 
        />

        <AnimatePresence>
          {isRecording ? (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="absolute inset-0 bg-white dark:bg-black flex items-center justify-between px-3.5 z-10"
            >
              <div className="flex items-center space-x-2 text-rose-500 animate-pulse">
                <Mic className="w-4 h-4" />
                <span className="font-semibold text-xs">
                  0:{recordingDuration.toString().padStart(2, '0')}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={cancelRecording} 
                  className="p-1.5 text-gray-500 hover:text-rose-500 rounded-full transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={finishRecording} 
                  className="px-3 py-1 bg-blue-600 dark:bg-black dark:border dark:border-white/30 text-white rounded-full text-xs font-semibold transition-transform cursor-pointer"
                >
                  Send
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Attach Photo */}
        <button 
          onClick={() => fileInputRef.current?.click()}
          title="Send Photo"
          className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-colors shrink-0 cursor-pointer"
        >
          <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
        </button>

        {/* Text Input Pill - Pure Black with Crisp White Border in Dark Mode */}
        <div className="flex-1 bg-gray-100 dark:bg-black rounded-full flex items-center px-3.5 py-1.5 border border-gray-200/90 dark:border dark:border-white/30 focus-within:ring-1 focus-within:ring-gray-300 dark:focus-within:ring-white/40 transition-all">
          <input 
            type="text" 
            placeholder="Message..." 
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="w-full bg-transparent outline-none text-[13px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 antialiased"
          />
        </div>

        {/* Send or Voice Record */}
        {inputText.trim() ? (
          <button 
            onClick={handleSend}
            className="p-1.5 rounded-full bg-blue-600 dark:bg-black dark:border dark:border-white/30 text-white shadow-none hover:bg-blue-700 dark:hover:bg-white/10 transition-all cursor-pointer shrink-0"
          >
            <Send className="w-3 h-3 fill-current" />
          </button>
        ) : (
          <button 
            onMouseDown={startRecording}
            title="Hold to record voice"
            className="p-1.5 rounded-full bg-gray-100 dark:bg-black dark:border dark:border-white/30 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-all cursor-pointer shrink-0"
          >
            <Mic className="w-3 h-3 text-blue-500 dark:text-white" />
          </button>
        )}
      </div>
    </motion.div>
  );
});

// --- PC Right Side Panel (NO background box, Mini Chat List, Suggested Friends below it, or Inline Chat on click) ---
const RightPanel = React.memo(() => {
  const { currentUser, setMiniChatUser, pushPage } = useAppStore(useShallow((s: any) => ({ currentUser: s.currentUser, setMiniChatUser: s.setMiniChatUser, pushPage: s.pushPage })));
  const [contacts, setContacts] = useState<any[]>([]);
  const [suggested, setSuggested] = useState<AppUser[]>([]);
  const [presences, setPresences] = useState<{[uid: string]: boolean}>({});
  const [loading, setLoading] = useState(true);
  const [chatSearch, setChatSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<any | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    const fetchData = async () => {
      try {
        const { getFollowing } = await import('../services/followService');
        const following = await getFollowing(currentUser.uid);
        setContacts(following);
        setLoading(false);

        const { subscribePresence } = await import('../services/presenceService');
        following.forEach((contact: any) => {
          subscribePresence(contact.uid, (data) => {
            setPresences(prev => ({ ...prev, [contact.uid]: data.isOnline }));
          });
        });

        // Fetch suggested friends
        const { collection, query, limit, getDocs } = await import('firebase/firestore');
        const q = query(collection(db, 'users'), limit(30));
        const snap = await getDocs(q);
        const followingSet = new Set(following.map((f: any) => f.uid));
        const users = snap.docs
          .map(d => ({ uid: d.id, ...d.data() } as AppUser))
          .filter(u => u.uid !== currentUser.uid && !followingSet.has(u.uid));
        setSuggested(users.slice(0, 5));
      } catch (err) {
        console.error('Error in RightPanel data fetch:', err);
      }
    };
    fetchData();
  }, [currentUser]);

  const filteredContacts = useMemo(() => {
    if (!chatSearch.trim()) return contacts;
    const term = chatSearch.toLowerCase();
    return contacts.filter(c => (c.name || '').toLowerCase().includes(term) || (c.username || '').toLowerCase().includes(term));
  }, [contacts, chatSearch]);

  const onlineCount = useMemo(() => {
    return Object.values(presences).filter(Boolean).length;
  }, [presences]);

  return (
    <aside className="hidden lg:flex flex-col w-[350px] xl:w-[380px] fixed top-4 right-6 xl:right-12 h-[calc(100vh-32px)] space-y-5 pt-1 overflow-y-auto no-scrollbar pb-10 select-none shrink-0 border-0 bg-transparent z-20">
      <AnimatePresence mode="wait">
        {selectedContact ? (
          /* Mobile-Sized Real Chat Page inside PC Right Side Column - Replaces friends list, NO floating popup */
          <RightPanelInlineChat 
            key={selectedContact.uid}
            contact={selectedContact} 
            onBack={() => setSelectedContact(null)} 
          />
        ) : (
          /* Default Friends List & Suggested Friends (Frameless, NO background card box) */
          <motion.div 
            key="friends-list"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.16 }}
            className="flex flex-col space-y-5 w-full"
          >
            {/* 1. Top Search Bar */}
            <div className="pt-1">
              <FeedUserSearchBar placeholder="Search user ID, username..." />
            </div>

            {/* 2. Mini Chat List - Frameless, NO background card box */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-[15px] text-gray-900 dark:text-white tracking-tight">Chats</h3>
                  <span className="flex items-center space-x-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{onlineCount} Online</span>
                  </span>
                </div>
                <button 
                  onClick={() => pushPage('messages')}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Open All
                </button>
              </div>

              {/* Contacts search input */}
              {contacts.length > 4 && (
                <div className="px-1">
                  <input 
                    type="text" 
                    placeholder="Filter chats..." 
                    value={chatSearch}
                    onChange={(e) => setChatSearch(e.target.value)}
                    className="w-full bg-neutral-100 dark:bg-white/[0.06] border-0 rounded-full px-4 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-neutral-300 dark:focus:ring-white/20"
                  />
                </div>
              )}

              {/* Contacts items - Bigger and more spacious */}
              <div className="space-y-1">
                {loading ? (
                  <div className="space-y-2 py-2">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="flex items-center space-x-3 p-2.5 animate-pulse">
                        <div className="w-11 h-11 bg-gray-200 dark:bg-white/10 rounded-full" />
                        <div className="h-4 w-32 bg-gray-200 dark:bg-white/10 rounded" />
                      </div>
                    ))}
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="py-6 text-center text-xs text-gray-400">
                    <p>No contacts yet</p>
                    <button 
                      onClick={() => pushPage('search')} 
                      className="text-blue-600 dark:text-blue-400 font-semibold mt-1 hover:underline cursor-pointer"
                    >
                      Find friends
                    </button>
                  </div>
                ) : (
                  filteredContacts.map(contact => {
                    const isUserOnline = presences[contact.uid];
                    return (
                      <div 
                        key={contact.uid} 
                        className="group flex items-center justify-between p-2.5 px-3 hover:bg-neutral-100/70 dark:hover:bg-white/[0.06] rounded-2xl cursor-pointer transition-all border-0 select-none"
                        onClick={() => {
                          // Prevent separate floating mini chat from opening
                          setMiniChatUser(null);
                          // Replaces the friends list and suggested friends with mobile-sized inline chat view
                          setSelectedContact(contact);
                        }}
                      >
                        <div className="flex items-center space-x-3.5 min-w-0 flex-1 pr-2">
                          <div className="relative shrink-0">
                            <img 
                              src={contact.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.name)}&background=random`} 
                              alt={contact.name} 
                              loading="lazy" 
                              referrerPolicy="no-referrer"
                              className="w-11 h-11 rounded-full object-cover ring-1 ring-black/5 dark:ring-white/10" 
                            />
                            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-black ${
                              isUserOnline ? 'bg-emerald-500' : 'bg-neutral-400'
                            }`} />
                          </div>
                          <div className="truncate min-w-0">
                            <h4 className="text-[14.5px] font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                              {contact.name}
                            </h4>
                            <p className="text-[12px] text-gray-400 dark:text-neutral-400 truncate mt-0.5">
                              {isUserOnline ? <span className="text-emerald-500 font-medium">Active now</span> : 'Tap to chat'}
                            </p>
                          </div>
                        </div>
                        <div className="p-1 text-gray-400 group-hover:text-blue-500 transition-colors">
                          <MessageCircle className="w-4.5 h-4.5 stroke-[2.2]" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 3. Suggested Friends Section (Placed Directly BELOW Mini Chat List) - Frameless */}
            <div className="space-y-2 pt-2 border-0">
              <div className="flex items-center justify-between px-1 mb-1">
                <div className="flex items-center space-x-1.5">
                  <UserPlus className="w-4 h-4 text-neutral-800 dark:text-neutral-200 stroke-[2.2]" />
                  <h3 className="font-bold text-[14.5px] text-gray-900 dark:text-white tracking-tight">Suggested Friends</h3>
                </div>
                <button 
                  onClick={() => pushPage('search')} 
                  className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  See all
                </button>
              </div>

              <div className="space-y-1">
                {suggested.length === 0 ? (
                  <p className="text-xs text-gray-400 px-1 py-2">No suggestions right now</p>
                ) : (
                  suggested.map(user => (
                    <SuggestedRightItem key={user.uid} user={user} />
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
});

export default function Home() {
  const initialCached = (() => {
    try {
      const storeCache = useAppStore.getState().cachedFeed;
      if (storeCache && storeCache.length > 0) return storeCache;
      const local = localStorage.getItem('cached_posts');
      if (local) return JSON.parse(local);
    } catch (e) {}
    return [];
  })();

  const [posts, setPosts] = useState<Post[]>(initialCached);
  const [stories, setStories] = useState<any[]>([]);
  const [isStoriesLoading, setIsStoriesLoading] = useState(true);
  const [fallbackReels, setFallbackReels] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFeedLoading, setIsFeedLoading] = useState(initialCached.length === 0);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const { 
    setViewingStory, 
    showCreatePost, 
    setShowCreatePost, 
    pushPage, 
    currentUser, 
    notificationCount, 
    cachedFeed, 
    setCachedFeed, 
    setViewingUser, 
    setIsBottomNavHidden 
  } = useAppStore(useShallow((s: any) => ({ setViewingStory: s.setViewingStory, showCreatePost: s.showCreatePost, setShowCreatePost: s.setShowCreatePost, pushPage: s.pushPage, currentUser: s.currentUser, notificationCount: s.notificationCount, cachedFeed: s.cachedFeed, setCachedFeed: s.setCachedFeed, setViewingUser: s.setViewingUser, setIsBottomNavHidden: s.setIsBottomNavHidden })));

  const feedScrollY = useAppStore(state => state.feedScrollY);
  const [showCreateStory, setShowCreateStory] = useState(false);

  useEffect(() => {
    if (showCreateStory) {
      setIsBottomNavHidden(true);
      return () => setIsBottomNavHidden(false);
    } else {
      setIsBottomNavHidden(false);
    }
  }, [showCreateStory, setIsBottomNavHidden]);

  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [storyPreview, setStoryPreview] = useState<string | null>(null);
  const [showHeader, setShowHeader] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(feedScrollY);

  useEffect(() => {
    if (scrollContainerRef.current && feedScrollY > 0 && !isFeedLoading) {
      setTimeout(() => {
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTo(0, feedScrollY);
      }, 50);
    }
  }, [isFeedLoading]); // Scroll after loading is done, omit feedScrollY to avoid loop

  // Local Caching: Run strictly once on mount
  useEffect(() => {
    const storeCache = useAppStore.getState().cachedFeed;
    if (storeCache && storeCache.length > 0) {
      setPosts(storeCache);
      setIsFeedLoading(false);
    } else {
      const local = localStorage.getItem('cached_posts');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          setPosts(parsed);
          useAppStore.getState().setCachedFeed(parsed);
          setIsFeedLoading(false);
        } catch (e) {}
      }
    }
  }, []);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsubscribeFeed = subscribeFeed((newPosts) => {
      const filtered = newPosts.filter(p => p.type !== 'reel');
      // Deduplicate posts by ID so same content is never repeated
      const map = new Map<string, any>();
      filtered.forEach(p => {
        if (!map.has(p.id)) map.set(p.id, p);
      });
      const deduplicated = Array.from(map.values());
      deduplicated.sort((a, b) => {
        const aProm = !!(a.isPromoted || (a as any).promoted);
        const bProm = !!(b.isPromoted || (b as any).promoted);
        if (aProm && !bProm) return -1;
        if (!aProm && bProm) return 1;
        const tA = a.createdAt?.seconds || (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() / 1000 : 0);
        const tB = b.createdAt?.seconds || (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() / 1000 : 0);
        return tB - tA;
      });
      setPosts(deduplicated);
      useAppStore.getState().setCachedFeed(deduplicated);
      setIsFeedLoading(false);
      try {
        localStorage.setItem('cached_posts', JSON.stringify(deduplicated.slice(0, 20)));
      } catch (e) {}
    });
    const unsubscribeStories = subscribeStories((newStories) => {
      setStories(newStories);
      setIsStoriesLoading(false);
    });
    const cached = useAppStore.getState().cachedReels;
    if (cached && cached.length > 0) {
      setFallbackReels(cached.slice(0, 4));
      setIsStoriesLoading(false);
    }
    return () => {
      unsubscribeFeed();
      unsubscribeStories();
    };
  }, [currentUser?.uid]);

  const handleRefreshFeed = async () => {
    if (!currentUser) return;
    try {
      const { getFeed } = await import('../services/postService');
      const feedData = await getFeed();
      const freshPosts = feedData.posts || [];
      const filtered = freshPosts.filter((p) => p.type !== 'reel');
      const map = new Map<string, any>();
      filtered.forEach(p => {
        if (!map.has(p.id)) map.set(p.id, p);
      });
      const deduplicated = Array.from(map.values());
      deduplicated.sort((a, b) => {
        const aProm = !!(a.isPromoted || (a as any).promoted);
        const bProm = !!(b.isPromoted || (b as any).promoted);
        if (aProm && !bProm) return -1;
        if (!aProm && bProm) return 1;
        const tA = a.createdAt?.seconds || (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() / 1000 : 0);
        const tB = b.createdAt?.seconds || (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() / 1000 : 0);
        return tB - tA;
      });
      setPosts(deduplicated);
      setCachedFeed(deduplicated);
    } catch (e) {
      console.error(e);
    }
  };

  const [visiblePostsCount, setVisiblePostsCount] = useState(5);
  const isHeaderVisibleRef = useRef(true);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const currentScrollY = target.scrollTop;
    const delta = currentScrollY - lastScrollY.current;
    
    if (currentScrollY <= 10) {
      isHeaderVisibleRef.current = true;
      setShowHeader(true);
    } else if (delta > 8 && currentScrollY > 40 && isHeaderVisibleRef.current) {
      isHeaderVisibleRef.current = false;
      setShowHeader(false);
    } else if (delta < -8 && !isHeaderVisibleRef.current) {
      isHeaderVisibleRef.current = true;
      setShowHeader(true);
    }

    if (target.scrollHeight - currentScrollY <= target.clientHeight * 1.5) {
      setVisiblePostsCount((prev) => (prev < posts.length ? Math.min(prev + 5, posts.length) : prev));
    }

    lastScrollY.current = currentScrollY;
  }, [posts.length]);

  const handleCreateStory = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    setStoryFile(file);
    setStoryPreview(URL.createObjectURL(file));
  };

  const confirmCreateStory = async () => {
    if (!storyFile || !currentUser) return;
    setLoading(true);
    try {
      await uploadStory(currentUser.uid, currentUser.name, currentUser.avatar, storyFile);
      setStoryFile(null);
      setStoryPreview(null);
      setShowCreateStory(false);
    } catch (error: any) {
      console.error('Story upload error:', error);
      alert(`Failed to upload story: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PullToRefresh onRefresh={handleRefreshFeed} className="h-full w-full">
      {/* Offline Alert */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white text-xs font-semibold py-1.5 px-4 text-center z-[70] shadow-none flex items-center justify-center space-x-1.5">
          <span>📡 Offline Mode — Showing cached feed</span>
        </div>
      )}

      <div 
        ref={scrollContainerRef} 
        id="home-scroll-container" 
        className="h-full w-full overflow-y-auto overflow-x-hidden bg-white dark:bg-black flex flex-col items-center px-0 md:px-4 md:pl-24 relative" 
        onScroll={handleScroll}
      >
        {/* Unified, subtle, lag-free ambient soft blue glow from top fading down - FIXED so scrolling down stays in place */}
        <div 
          className="pointer-events-none fixed top-0 left-0 right-0 h-[260px] sm:h-[300px] bg-gradient-to-b from-sky-400/[0.14] via-blue-500/[0.05] to-transparent dark:from-blue-600/[0.20] dark:via-blue-800/[0.05] dark:to-transparent z-0" 
          aria-hidden="true" 
        />

        {/* Screen 3 Top Header: Search Icon (Left) • ennvo brand (Center) • Notification Bell (Right) - Hidden on PC */}
        <header className="lg:hidden sticky top-0 left-0 right-0 z-50 w-full max-w-[560px] mx-auto bg-transparent border-0 shadow-none px-4 pt-[max(calc(var(--app-safe-top)+8px),12px)] pb-2 flex items-center justify-between select-none">
          {/* Left: Search Button (Mobile only) - No animation on click */}
          <button 
            onClick={() => pushPage('search')} 
            className="w-10 h-10 rounded-full bg-white/70 dark:bg-white/10 hover:bg-neutral-100 dark:hover:bg-white/15 flex items-center justify-center text-neutral-800 dark:text-neutral-100 cursor-pointer border-0 shadow-none"
            title="Search"
            aria-label="Search"
          >
            <Search className="w-5 h-5 stroke-[2.2]" />
          </button>

          {/* Center: Brand Name with distinct modern signature dot */}
          <div className="flex-1 flex items-center justify-center">
            <h1 
              onClick={() => {
                scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="font-brand text-[28px] sm:text-[30px] font-[900] tracking-[-0.05em] text-neutral-900 dark:text-white lowercase select-none cursor-pointer text-center leading-none inline-flex items-center gap-2"
            >
              <img src="/icon-96.png?v=5" alt="Ennvo logo" className="w-7 h-7 rounded-full object-cover shadow-[0_2px_8px_rgba(14,165,233,0.35)]" />
              <span>ennvo</span>
              <span className="w-1.5 h-1.5 rounded-full bg-violet-600 dark:bg-violet-400 mb-0.5 self-end" />
            </h1>
          </div>

          {/* Right: Create Post Plus Button (Mobile only) - No animation on click */}
          <button 
            onClick={() => {
              pushPage('create');
            }} 
            className="w-10 h-10 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center relative cursor-pointer shadow-sm hover:opacity-95"
            title="Create Post"
            aria-label="Create Post"
          >
            <Plus className="w-5 h-5 stroke-[2.8]" />
          </button>
        </header>

        {/* Main Feed Container matching Screen 3 with wider PC support */}
        <div className="w-full max-w-[1240px] flex items-start justify-center lg:justify-start space-x-0 lg:space-x-8 pt-1 pb-24 px-2 sm:px-4 box-border relative z-10">
          <div className="flex-1 w-full max-w-[560px] mx-auto lg:mx-0 lg:ml-20 xl:ml-32 lg:pt-6 flex flex-col space-y-4 sm:space-y-5">
            
            {/* 1. TOP: Stories Section - Clean Vertical Squircle Cards */}
            <div className="w-full py-1 overflow-x-auto no-scrollbar select-none">
              {isStoriesLoading && stories.length === 0 ? (
                <FacebookStorySkeleton />
              ) : (
                <div className="flex items-center space-x-3 sm:space-x-3.5 px-1 overflow-x-auto no-scrollbar">
                  <StoryItem 
                    story={{ 
                      isUser: true, 
                      bg: currentUser?.avatar || 'https://picsum.photos/seed/myprofile/200/300', 
                      name: 'Add Story' 
                    }} 
                    onClick={() => {
                      const { setSelectedCreateMode, setShowReelCamera } = useAppStore.getState();
                      setSelectedCreateMode('story');
                      setShowReelCamera(true);
                    }} 
                  />
                  {(() => {
                    // Group stories by author so each user has only ONE story box in the feed tray
                    const seenAuthors = new Set<string>();
                    const uniqueStories: typeof stories = [];
                    for (const st of stories) {
                      const authorKey = (st as any).authorId || (st as any).authorUID || (st as any).userId || st.id;
                      if (!seenAuthors.has(authorKey)) {
                        seenAuthors.add(authorKey);
                        uniqueStories.push(st);
                      }
                    }
                    return uniqueStories.map(story => (
                      <StoryItem key={story.id} story={story} onClick={() => setViewingStory(story)} />
                    ));
                  })()}

                  {/* Fallback stories from reels only if empty */}
                  {stories.length < 1 && (() => {
                    const seenReelAuthors = new Set<string>();
                    const uniqueReels: typeof fallbackReels = [];
                    for (const r of fallbackReels) {
                      const aKey = r.authorId || r.id;
                      if (!seenReelAuthors.has(aKey)) {
                        seenReelAuthors.add(aKey);
                        uniqueReels.push(r);
                      }
                    }
                    return uniqueReels.map((reel) => {
                      const storyObj = {
                        id: reel.id,
                        authorId: reel.authorId,
                        authorName: reel.authorName,
                        authorAvatar: reel.authorAvatar,
                        mediaUrl: reel.media?.[0],
                        thumbnailUrl: reel.thumbnailUrl || reel.thumbnail,
                        type: 'video' as const,
                        text: reel.text,
                        songTitle: reel.songTitle,
                        songArtist: reel.songArtist,
                        songUrl: reel.songUrl
                      };
                      return (
                        <StoryItem 
                          key={`fallback-story-${reel.id}`} 
                          story={storyObj}
                          onClick={() => setViewingStory(storyObj)} 
                        />
                      );
                    });
                  })()}
                </div>
              )}
            </div>



            {/* 2. Feed Posts List (matching Screen 3) */}
            <div className="flex flex-col space-y-6 sm:space-y-7 pb-20">
              {isFeedLoading && posts.length === 0 ? (
                <div className="space-y-6 sm:space-y-7">
                  <FacebookPostSkeleton hasMedia={true} />
                  <FacebookPostSkeleton hasMedia={true} />
                  <FacebookPostSkeleton hasMedia={false} />
                </div>
              ) : (
                <div className="space-y-6 sm:space-y-7">
                  {posts.slice(0, visiblePostsCount).map((post, index) => (
                    <React.Fragment key={post.id}>
                      <PostItem post={post} />
                      {index === 1 && <SuggestedAccounts />}
                    </React.Fragment>
                  ))}

                  {/* Infinite scroll bottom loader when user reaches bottom of feed */}
                  {visiblePostsCount < posts.length && (
                    <div className="pt-1">
                      <FacebookPostSkeleton hasMedia={true} />
                    </div>
                  )}

                  {posts.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
                      <Globe className="w-12 h-12 mb-3 opacity-30" />
                      <p className="font-medium text-sm">No posts yet. Share something with your friends!</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* PC Right Side Panel */}
          <RightPanel />
        </div>

        {/* Create Post Modal */}
        <CreatePostModal
          isOpen={showCreatePost}
          onClose={() => setShowCreatePost(false)}
        />

        {/* Story Camera Overlay */}
        {showCreateStory && (
          <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4">
            {storyPreview ? (
              <div className="relative w-full max-w-sm max-h-[85vh] h-full overflow-hidden flex flex-col bg-black rounded-3xl border border-white/20">
                <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 bg-gradient-to-b from-black/50 to-transparent">
                  <button onClick={() => { setStoryPreview(null); setStoryFile(null); }} className="p-2 text-white bg-black/40 rounded-full cursor-pointer">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="flex-1 flex items-center justify-center min-h-0 bg-black">
                  {storyFile?.type.startsWith('video') ? (
                    <video src={storyPreview} poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E" className="max-w-full max-h-full" autoPlay loop muted playsInline />
                  ) : (
                    <img src={storyPreview} className="max-w-full max-h-full object-contain" alt="Story preview" />
                  )}
                </div>
                <div className="p-4 bg-black flex justify-between items-center shrink-0 z-10 border-t border-white/10">
                  <button onClick={() => { setStoryPreview(null); setStoryFile(null); }} className="px-6 py-2.5 bg-gray-800 text-white rounded-full font-medium cursor-pointer">
                    Discard
                  </button>
                  <button onClick={confirmCreateStory} disabled={loading} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold flex items-center space-x-2 transition-colors cursor-pointer">
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Post</span>
                        <ChevronRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative w-full max-w-sm max-h-[85vh] h-full overflow-hidden bg-black rounded-3xl border border-white/20">
                <video 
                  autoPlay 
                  playsInline 
                  muted 
                  poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E" 
                  className="absolute inset-0 w-full h-full object-cover" 
                  ref={(ref) => { 
                    if (ref && !ref.srcObject) { 
                      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true })
                        .then(stream => { ref.srcObject = stream; })
                        .catch(err => console.error("Camera access denied:", err)); 
                    } 
                  }} 
                />
                <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 bg-gradient-to-b from-black/50 to-transparent pt-safe">
                  <button onClick={() => setShowCreateStory(false)} className="p-2 text-white cursor-pointer"><X className="w-7 h-7" /></button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col items-center z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent pb-safe">
                  <div className="flex items-center justify-between w-full px-4">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-600 overflow-hidden relative">
                        <input type="file" accept="image/*,video/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleCreateStory} />
                        <img src="https://picsum.photos/seed/gallery/100/100" className="w-full h-full object-cover" alt="Gallery" />
                      </div>
                      <span className="text-white text-[11px] font-normal mt-2">Upload</span>
                    </div>
                    <div className="relative">
                      <input type="file" accept="image/*,video/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={handleCreateStory} />
                      <button className="w-18 h-18 rounded-full border-4 border-white/50 flex items-center justify-center transition-transform bg-white/20 cursor-pointer">
                        <div className="w-14 h-14 bg-white rounded-full"></div>
                      </button>
                    </div>
                    <div className="w-10 h-10 opacity-0" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
