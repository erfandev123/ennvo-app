import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Search, 
  Plus, 
  Bookmark, 
  Smile, 
  Sparkles, 
  Share2, 
  Check, 
  Upload, 
  Image as ImageIcon,
  Loader2,
  Trash2,
  Send,
  Sticker as StickerIcon,
  Video,
  Play
} from 'lucide-react';
import { 
  EMOJI_CATEGORIES, 
  CuratedSticker, 
  fetchCommunityStickers, 
  getUserCreatedStickers, 
  createCustomSticker, 
  getSavedStickers, 
  toggleSaveSticker, 
  isStickerSaved,
  deleteCustomSticker
} from '../services/stickerService';
import { CustomSticker, User } from '../types';
import { uploadMedia } from '../services/githubStorage';

interface StickerPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSticker: (stickerUrl: string, stickerType?: 'image' | 'video' | 'animated') => void;
  onSelectEmoji: (emoji: string) => void;
  currentUser: User | null;
}

export const StickerPickerModal: React.FC<StickerPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectSticker,
  onSelectEmoji,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'saved' | 'emoji'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState<string>('smileys');
  
  // Community & Custom Stickers State
  const [communityStickers, setCommunityStickers] = useState<CustomSticker[]>([]);
  const [myStickers, setMyStickers] = useState<CustomSticker[]>([]);
  const [savedStickersList, setSavedStickersList] = useState<{ id: string; url: string; title?: string; type?: 'image' | 'video' | 'animated' }[]>([]);
  const [isLoadingStickers, setIsLoadingStickers] = useState(false);

  // Sticker Creator Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatorFile, setCreatorFile] = useState<File | null>(null);
  const [creatorPreviewUrl, setCreatorPreviewUrl] = useState<string | null>(null);
  const [creatorFileType, setCreatorFileType] = useState<'image' | 'video' | 'animated'>('image');
  const [creatorTitle, setCreatorTitle] = useState('');
  const [creatorTags, setCreatorTags] = useState('');
  const [isUploadingSticker, setIsUploadingSticker] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const creatorFileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  // Action / Context Menu for Sticker Click / Long-press
  const [activeMenuSticker, setActiveMenuSticker] = useState<{
    id: string;
    url: string;
    title?: string;
    type?: 'image' | 'video' | 'animated';
    authorId?: string;
  } | null>(null);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Load stickers on open
  useEffect(() => {
    if (!isOpen) return;
    
    // Load saved stickers
    if (currentUser?.uid) {
      setSavedStickersList(getSavedStickers(currentUser.uid));
    }

    // Load user created community stickers
    const loadData = async () => {
      setIsLoadingStickers(true);
      try {
        const comm = await fetchCommunityStickers();
        setCommunityStickers(comm);
        if (currentUser?.uid) {
          const my = await getUserCreatedStickers(currentUser.uid);
          setMyStickers(my);
        }
      } catch (e) {
        console.error("Error loading stickers:", e);
      } finally {
        setIsLoadingStickers(false);
      }
    };
    loadData();
  }, [isOpen, currentUser?.uid]);

  // Filtered Community Stickers
  const filteredAllStickers = useMemo(() => {
    if (!searchQuery.trim()) {
      return communityStickers;
    }
    const q = searchQuery.toLowerCase().trim();
    return communityStickers.filter(s => 
      s.title.toLowerCase().includes(q) || 
      (s.tags && s.tags.some(t => t.toLowerCase().includes(q)))
    );
  }, [searchQuery, communityStickers]);

  // Handle Sticker File Selection for Creator (Image, Video, GIF)
  const handleCreatorFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCreatorFile(file);
    
    const isGif = file.type.includes('gif') || file.name.endsWith('.gif');
    const isVid = file.type.startsWith('video') || file.name.endsWith('.mp4') || file.name.endsWith('.webm') || file.name.endsWith('.mov');
    
    if (isVid) {
      setCreatorFileType('video');
    } else if (isGif) {
      setCreatorFileType('animated');
    } else {
      setCreatorFileType('image');
    }
    
    const preview = URL.createObjectURL(file);
    setCreatorPreviewUrl(preview);
    if (!creatorTitle) {
      setCreatorTitle(file.name.split('.')[0].replace(/[-_]/g, ' '));
    }

    // Measure video duration if video
    if (isVid) {
      const tempVideo = document.createElement('video');
      tempVideo.src = preview;
      tempVideo.onloadedmetadata = () => {
        setVideoDuration(tempVideo.duration);
      };
    } else {
      setVideoDuration(0);
    }
  };

  // Enforce 5-second max clip loop for video stickers during playback
  const handleVideoTimeUpdate = () => {
    if (videoPreviewRef.current) {
      if (videoPreviewRef.current.currentTime >= 5) {
        videoPreviewRef.current.currentTime = 0;
      }
    }
  };

  // Submit and Upload Custom Sticker
  const handleCreateStickerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatorFile || !currentUser) return;
    setIsUploadingSticker(true);
    try {
      const mediaUrl = await uploadMedia(creatorFile, 'stickers');
      const tagsArray = creatorTags
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(Boolean);
      
      const newStk = await createCustomSticker({
        url: mediaUrl,
        title: creatorTitle.trim() || 'Custom Sticker',
        type: creatorFileType,
        authorId: currentUser.uid,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar,
        tags: tagsArray.length > 0 ? tagsArray : ['custom', creatorTitle.toLowerCase().trim()]
      });

      setMyStickers(prev => [newStk, ...prev]);
      setCommunityStickers(prev => [newStk, ...prev]);
      
      // Reset form
      setShowCreateModal(false);
      setCreatorFile(null);
      setCreatorPreviewUrl(null);
      setCreatorTitle('');
      setCreatorTags('');
      setActiveTab('all');
    } catch (err) {
      console.error("Failed to upload custom sticker:", err);
    } finally {
      setIsUploadingSticker(false);
    }
  };

  // Handle Save / Unsave Sticker
  const handleToggleSave = (sticker: { id: string; url: string; title?: string; type?: 'image' | 'video' | 'animated' }) => {
    if (!currentUser?.uid) return;
    toggleSaveSticker(currentUser.uid, sticker);
    setSavedStickersList(getSavedStickers(currentUser.uid));
  };

  // Handle Share / Copy Sticker Link
  const handleShareSticker = async (stickerUrl: string) => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(stickerUrl);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2000);
    }
  };

  // Handle Delete Sticker
  const handleDeleteSticker = async (stickerId: string) => {
    if (!currentUser?.uid) return;
    await deleteCustomSticker(currentUser.uid, stickerId);
    setMyStickers(prev => prev.filter(s => s.id !== stickerId));
    setCommunityStickers(prev => prev.filter(s => s.id !== stickerId));
    setActiveMenuSticker(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: '0%' }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 350 }}
        onClick={(e) => e.stopPropagation()}
        className="fixed bottom-0 inset-x-0 z-[220] bg-white/98 backdrop-blur-md rounded-t-[32px] shadow-[0_-12px_36px_rgba(0,0,0,0.18)] flex flex-col h-[340px] md:h-[360px] overflow-hidden transform-gpu border-t border-gray-200/80"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 shrink-0 bg-gray-50/60">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
              <StickerIcon className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-gray-800 tracking-tight">Stickers</span>
          </div>

          {/* Action Icons Right */}
          <div className="flex items-center space-x-2">
            {currentUser && (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center hover:scale-105 active:scale-90 transition-all shadow-2xs"
                title="Create Live Sticker"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 bg-gray-200/70 hover:bg-gray-300 text-gray-600 rounded-full transition-colors active:scale-90"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 4 Clean Soft Rounded Tabs - ICON ONLY */}
        <div className="flex items-center justify-around px-4 py-1.5 bg-gray-50/90 border-b border-gray-100 shrink-0">
          <button
            type="button"
            onClick={() => { setActiveTab('all'); setSearchQuery(''); }}
            className={`p-2 rounded-2xl transition-all ${
              activeTab === 'all' 
                ? 'bg-gray-900 text-white shadow-xs scale-105' 
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
            title="For You"
          >
            <Sparkles className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('my'); setSearchQuery(''); }}
            className={`p-2 rounded-2xl transition-all ${
              activeTab === 'my' 
                ? 'bg-gray-900 text-white shadow-xs scale-105' 
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
            title="My Sticker"
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('saved'); setSearchQuery(''); }}
            className={`p-2 rounded-2xl transition-all ${
              activeTab === 'saved' 
                ? 'bg-gray-900 text-white shadow-xs scale-105' 
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
            title="Saved"
          >
            <Bookmark className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('emoji'); setSearchQuery(''); }}
            className={`p-2 rounded-2xl transition-all ${
              activeTab === 'emoji' 
                ? 'bg-gray-900 text-white shadow-xs scale-105' 
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/60'
            }`}
            title="Emoji"
          >
            <Smile className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        {activeTab !== 'emoji' && (
          <div className="px-3 py-1.5 border-b border-gray-100 shrink-0 bg-white">
            <div className="relative flex items-center bg-gray-100/80 rounded-full px-3 py-1 text-xs text-gray-800">
              <Search className="w-3.5 h-3.5 text-gray-400 mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search stickers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs text-gray-800 placeholder-gray-400 focus:outline-none w-full"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} className="p-0.5 text-gray-400 hover:text-gray-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Emoji Category Pills */}
        {activeTab === 'emoji' && (
          <div className="flex items-center space-x-1 px-3 py-1.5 border-b border-gray-100 overflow-x-auto no-scrollbar shrink-0 bg-white">
            {EMOJI_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedEmojiCategory(cat.id)}
                className={`flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs shrink-0 transition-all ${
                  selectedEmojiCategory === cat.id
                    ? 'bg-gray-900 text-white font-medium'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span className="text-xs">{cat.icon}</span>
                <span className="text-[11px]">{cat.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Main Content Body */}
        <div className="flex-1 overflow-y-auto p-3 no-scrollbar bg-white">
          {/* For You / All Stickers */}
          {activeTab === 'all' && (
            <div>
              {isLoadingStickers ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-600 mb-2" />
                  <p className="text-[11px]">Loading stickers...</p>
                </div>
              ) : filteredAllStickers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                  <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center mb-2">
                    <StickerIcon className="w-6 h-6 opacity-60" />
                  </div>
                  <h4 className="text-xs font-semibold text-gray-800">No Stickers Yet</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5 mb-3">
                    Be the first to upload photos or live video stickers!
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="px-3.5 py-1.5 bg-gray-900 text-white rounded-full text-xs font-medium shadow-2xs hover:scale-105 active:scale-95 transition-all"
                  >
                    + Create Live Sticker
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2.5">
                  {filteredAllStickers.map((stk) => (
                    <div
                      key={stk.id}
                      className="group relative flex flex-col items-center justify-center p-1 rounded-2xl hover:bg-purple-50/40 transition-all duration-150 cursor-pointer active:scale-90 select-none"
                      onClick={() => {
                        onSelectSticker(stk.url, stk.type);
                        onClose();
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setActiveMenuSticker(stk);
                      }}
                    >
                      <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center overflow-hidden rounded-2xl">
                        {stk.type === 'video' ? (
                          <video 
                            src={stk.url} 
                            autoPlay 
                            loop 
                            muted 
                            playsInline 
                            className="w-full h-full object-cover rounded-2xl pointer-events-none drop-shadow-2xs" 
                          />
                        ) : (
                          <img 
                            src={stk.url} 
                            alt={stk.title} 
                            loading="lazy" 
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain pointer-events-none drop-shadow-2xs mix-blend-multiply dark:mix-blend-normal hover:scale-110 transition-transform" 
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* My Stickers Tab */}
          {activeTab === 'my' && (
            <div>
              <div 
                onClick={() => setShowCreateModal(true)}
                className="mb-3 p-2.5 rounded-2xl bg-gray-50 border border-gray-200/80 flex items-center justify-between cursor-pointer hover:bg-gray-100 transition-all active:scale-[0.99]"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gray-900 text-white flex items-center justify-center shrink-0">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-900">Create Live Sticker</h4>
                    <p className="text-[10px] text-gray-500">Upload photo, GIF, or short video clip</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-gray-700 px-2.5 py-0.5 bg-white rounded-full border border-gray-200 shadow-2xs">Upload</span>
              </div>

              {myStickers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400 text-center">
                  <ImageIcon className="w-8 h-8 opacity-20 mb-1.5" />
                  <p className="text-xs font-medium text-gray-600">You haven't created any stickers yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2.5">
                  {myStickers.map((stk) => (
                    <div
                      key={stk.id}
                      className="group relative flex flex-col items-center justify-center p-1 rounded-2xl hover:bg-pink-50/40 transition-all duration-150 cursor-pointer active:scale-90 select-none"
                      onClick={() => {
                        onSelectSticker(stk.url, stk.type);
                        onClose();
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setActiveMenuSticker(stk);
                      }}
                    >
                      <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center overflow-hidden rounded-2xl">
                        {stk.type === 'video' ? (
                          <video 
                            src={stk.url} 
                            autoPlay 
                            loop 
                            muted 
                            playsInline 
                            className="w-full h-full object-cover rounded-2xl pointer-events-none drop-shadow-2xs" 
                          />
                        ) : (
                          <img 
                            src={stk.url} 
                            alt={stk.title || 'Sticker'} 
                            loading="lazy" 
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain pointer-events-none drop-shadow-2xs mix-blend-multiply dark:mix-blend-normal hover:scale-110 transition-transform" 
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Saved Tab */}
          {activeTab === 'saved' && (
            <div>
              {savedStickersList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400 text-center">
                  <Bookmark className="w-8 h-8 opacity-20 mb-1.5" />
                  <p className="text-xs font-medium text-gray-600">No saved stickers yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2.5">
                  {savedStickersList.map((stk) => (
                    <div
                      key={stk.id}
                      className="group relative flex flex-col items-center justify-center p-1 rounded-2xl hover:bg-amber-50/40 transition-all duration-150 cursor-pointer active:scale-90 select-none"
                      onClick={() => {
                        onSelectSticker(stk.url, stk.type);
                        onClose();
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setActiveMenuSticker(stk);
                      }}
                    >
                      <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center overflow-hidden rounded-2xl">
                        {stk.type === 'video' ? (
                          <video 
                            src={stk.url} 
                            autoPlay 
                            loop 
                            muted 
                            playsInline 
                            className="w-full h-full object-cover rounded-2xl pointer-events-none drop-shadow-2xs" 
                          />
                        ) : (
                          <img 
                            src={stk.url} 
                            alt={stk.title || 'Saved'} 
                            loading="lazy" 
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain pointer-events-none drop-shadow-2xs mix-blend-multiply dark:mix-blend-normal hover:scale-110 transition-transform" 
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Emojis Tab */}
          {activeTab === 'emoji' && (
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
              {EMOJI_CATEGORIES.find(c => c.id === selectedEmojiCategory)?.emojis.map((em, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectEmoji(em)}
                  className="text-2xl p-2 rounded-2xl hover:bg-gray-100 hover:scale-110 active:scale-90 transition-all text-center flex items-center justify-center"
                >
                  {em}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sticker Context / Options Menu Popup */}
        <AnimatePresence>
          {activeMenuSticker && (
            <div 
              className="fixed inset-0 z-[260] bg-black/40 flex items-center justify-center p-4 backdrop-blur-xs"
              onClick={() => setActiveMenuSticker(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl p-4 w-full max-w-xs shadow-2xl border border-gray-100 flex flex-col items-center text-center"
              >
                {/* Sticker Preview */}
                <div className="w-20 h-20 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center p-1.5 mb-2 shadow-2xs">
                  {activeMenuSticker.type === 'video' ? (
                    <video 
                      src={activeMenuSticker.url} 
                      autoPlay 
                      loop 
                      muted 
                      playsInline 
                      className="w-full h-full object-cover rounded-xl" 
                    />
                  ) : (
                    <img 
                      src={activeMenuSticker.url} 
                      alt="Sticker" 
                      className="w-full h-full object-contain mix-blend-multiply" 
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>

                <h4 className="text-xs font-semibold text-gray-900 mb-0.5">{activeMenuSticker.title || 'Sticker'}</h4>

                {/* Actions */}
                <div className="w-full flex flex-col space-y-1.5 mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSticker(activeMenuSticker.url, activeMenuSticker.type);
                      setActiveMenuSticker(null);
                      onClose();
                    }}
                    className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-gray-900 text-white font-medium text-xs rounded-xl active:scale-95 transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Sticker</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleToggleSave(activeMenuSticker);
                      setActiveMenuSticker(null);
                    }}
                    className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium text-xs rounded-xl active:scale-95 transition-all"
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${isStickerSaved(currentUser?.uid || '', activeMenuSticker.url) ? 'fill-amber-500 text-amber-500' : ''}`} />
                    <span>{isStickerSaved(currentUser?.uid || '', activeMenuSticker.url) ? 'Remove from Saved' : 'Save to My Stickers'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleShareSticker(activeMenuSticker.url)}
                    className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium text-xs rounded-xl active:scale-95 transition-all border border-gray-200/60"
                  >
                    {copiedNotification ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Share2 className="w-3.5 h-3.5" />}
                    <span>{copiedNotification ? 'Link Copied!' : 'Copy Link'}</span>
                  </button>

                  {activeMenuSticker.authorId === currentUser?.uid && (
                    <button
                      type="button"
                      onClick={() => handleDeleteSticker(activeMenuSticker.id)}
                      className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 font-medium text-xs rounded-xl active:scale-95 transition-all border border-red-200/50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Sticker</span>
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Sticker Maker Modal */}
        <AnimatePresence>
          {showCreateModal && (
            <div 
              className="fixed inset-0 z-[280] bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs"
              onClick={() => setShowCreateModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl p-4 w-full max-w-xs shadow-2xl border border-gray-100 flex flex-col"
              >
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-3">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <h3 className="font-semibold text-gray-900 text-xs">Create Live Sticker</h3>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setShowCreateModal(false)}
                    className="p-1 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <form onSubmit={handleCreateStickerSubmit} className="flex flex-col space-y-2.5">
                  <input
                    type="file"
                    ref={creatorFileInputRef}
                    accept="image/*,video/*,.gif,.mp4,.webm,.mov"
                    className="hidden"
                    onChange={handleCreatorFileChange}
                  />

                  {creatorPreviewUrl ? (
                    <div className="relative w-full h-32 rounded-2xl bg-gray-50 border border-purple-200 flex items-center justify-center overflow-hidden p-1.5 group">
                      {creatorFileType === 'video' ? (
                        <video 
                          ref={videoPreviewRef}
                          src={creatorPreviewUrl} 
                          autoPlay 
                          loop 
                          muted 
                          playsInline 
                          onTimeUpdate={handleVideoTimeUpdate}
                          className="w-full h-full object-cover rounded-xl" 
                        />
                      ) : (
                        <img 
                          src={creatorPreviewUrl} 
                          alt="Preview" 
                          className="w-full h-full object-contain mix-blend-multiply" 
                        />
                      )}
                      
                      {videoDuration > 5 && (
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/75 text-white text-[9px] rounded-full backdrop-blur-xs">
                          Trimmed to 5s clip
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setCreatorFile(null);
                          setCreatorPreviewUrl(null);
                        }}
                        className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-black text-white rounded-full text-xs shadow-md"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => creatorFileInputRef.current?.click()}
                      className="w-full h-32 rounded-2xl border-2 border-dashed border-gray-200 hover:border-purple-400 bg-gray-50/50 hover:bg-purple-50/20 flex flex-col items-center justify-center cursor-pointer transition-all p-3"
                    >
                      <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mb-1.5">
                        <Upload className="w-4 h-4" />
                      </div>
                      <p className="text-xs font-semibold text-gray-800">Photo, GIF or Video Clip</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Supports MP4, WebM, GIF, PNG (Max 5s)</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-medium text-gray-600 mb-0.5">Sticker Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Cute Reaction"
                      value={creatorTitle}
                      onChange={(e) => setCreatorTitle(e.target.value)}
                      required
                      className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!creatorFile || isUploadingSticker}
                    className="w-full flex items-center justify-center space-x-2 py-2 bg-gray-900 hover:bg-black disabled:opacity-50 text-white font-medium text-xs rounded-xl shadow-xs active:scale-95 transition-all mt-1"
                  >
                    {isUploadingSticker ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Publishing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Publish Live Sticker</span>
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};
