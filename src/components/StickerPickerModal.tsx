import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Search, 
  Plus, 
  Bookmark, 
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
  Play,
  RotateCw,
  FlipHorizontal,
  Wand2,
  Type,
  Paintbrush,
  Eraser,
  Scissors,
  CheckCircle2,
  Camera,
  Film,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { 
  CuratedSticker, 
  fetchCommunityStickers, 
  subscribeCommunityStickers,
  getUserCreatedStickers, 
  createCustomSticker, 
  getSavedStickers, 
  toggleSaveSticker, 
  isStickerSaved,
  deleteCustomSticker
} from '../services/stickerService';
import { CustomSticker, User } from '../types';
import { uploadMedia } from '../services/githubStorage';
import { VideoSticker } from './VideoSticker';

/**
 * Dedicated 2D Soft Sticker Preview & Action Modal
 * Opens when clicking any sticker in chat, comments, etc.
 * Shows enlarged sticker in rounded box with EXACTLY 2 clean buttons:
 * 1. Save Sticker (Bookmark toggle)
 * 2. Share to Chat (or Send to Chat)
 */
export interface StickerViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  stickerUrl: string | null;
  stickerType?: 'image' | 'video' | 'animated';
  currentUserId?: string;
  isMySticker?: boolean;
  onShareToChat?: (url: string, type?: 'image' | 'video' | 'animated') => void;
  onDeleteSticker?: (url: string) => void;
}

export const StickerViewerModal: React.FC<StickerViewerModalProps> = ({
  isOpen,
  onClose,
  stickerUrl,
  stickerType = 'image',
  currentUserId,
  isMySticker = false,
  onShareToChat,
  onDeleteSticker,
}) => {
  const [isSaved, setIsSaved] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [canDelete, setCanDelete] = useState(isMySticker);

  useEffect(() => {
    if (isOpen && stickerUrl && currentUserId) {
      setIsSaved(isStickerSaved(currentUserId, stickerUrl));
      setJustSaved(false);
      
      if (isMySticker) {
        setCanDelete(true);
      } else {
        getUserCreatedStickers(currentUserId).then((created) => {
          const match = created.some(c => c.url === stickerUrl || c.id === stickerUrl);
          setCanDelete(match);
        }).catch(() => setCanDelete(false));
      }
    }
  }, [isOpen, stickerUrl, currentUserId, isMySticker]);

  if (!isOpen || !stickerUrl) return null;

  let displayUrl = stickerUrl;
  if (displayUrl && displayUrl.includes('/uploads/')) {
    displayUrl = `/uploads/${displayUrl.split('/uploads/')[1]}`;
  }

  const isVideo = stickerType === 'video' || (displayUrl ? (displayUrl.endsWith('.mp4') || displayUrl.endsWith('.webm') || displayUrl.endsWith('.mov')) : false);
  const isImgOrVid = displayUrl ? (displayUrl.startsWith('http') || displayUrl.startsWith('/') || displayUrl.startsWith('data:') || displayUrl.endsWith('.webp') || displayUrl.endsWith('.png') || displayUrl.endsWith('.gif') || displayUrl.endsWith('.jpg') || displayUrl.endsWith('.jpeg')) : false;

  const handleToggleSave = () => {
    if (!currentUserId) return;
    toggleSaveSticker(currentUserId, {
      id: `stk_${Date.now()}`,
      url: stickerUrl,
      title: 'Saved Sticker',
      type: isVideo ? 'video' : 'image'
    });
    const nextSaved = isStickerSaved(currentUserId, stickerUrl);
    setIsSaved(nextSaved);
    if (nextSaved) {
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1800);
    }
  };

  const handleShare = () => {
    if (onShareToChat) {
      onShareToChat(stickerUrl, isVideo ? 'video' : 'image');
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(stickerUrl);
    }
    onClose();
  };

  const handleDelete = async () => {
    if (!currentUserId || !stickerUrl) return;
    if (window.confirm("Delete this sticker? It will be removed from community and your stickers list.")) {
      await deleteCustomSticker(currentUserId, stickerUrl);
      if (onDeleteSticker) {
        onDeleteSticker(stickerUrl);
      }
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[320] bg-sky-950/25 backdrop-blur-md flex items-center justify-center p-4 transition-all"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 8 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-[#16181e] border border-sky-400/20 dark:border-sky-500/20 rounded-[28px] p-5 w-full max-w-[290px] flex flex-col items-center select-none shadow-[0_8px_30px_rgba(56,189,248,0.12)] relative"
        >
          {/* Top Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center justify-center transition-all border-0 cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Enlarged Sticker inside Soft Rounded Box */}
          <div className="w-48 h-48 sm:w-52 sm:h-52 rounded-2xl bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200/40 dark:border-sky-800/30 p-3.5 flex items-center justify-center overflow-hidden my-1">
            {isVideo ? (
              <video
                src={displayUrl}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-contain rounded-xl"
              />
            ) : isImgOrVid ? (
              <img
                src={displayUrl}
                alt="Sticker"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain drop-shadow-xs"
                onError={(e) => {
                  const el = e.currentTarget;
                  if (displayUrl.includes('/uploads/') && !el.dataset.retried) {
                    el.dataset.retried = 'true';
                    el.src = `/uploads/${displayUrl.split('/uploads/')[1]}`;
                  }
                }}
              />
            ) : (
              <span className="text-6xl select-none">{displayUrl}</span>
            )}
          </div>

          {/* Clean Action Buttons */}
          <div className="w-full space-y-2 mt-4">
            {/* 1. Save / Favorite Sticker Button */}
            <button
              type="button"
              onClick={handleToggleSave}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-all  cursor-pointer border ${
                isSaved
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300/40'
                  : 'bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 border-sky-400/30'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
              <span>{isSaved ? (justSaved ? 'Saved to Favorites!' : 'Saved to Favorites') : 'Save Sticker'}</span>
            </button>

            {/* 2. Share to Chat Button */}
            <button
              type="button"
              onClick={handleShare}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white flex items-center justify-center space-x-2 transition-all cursor-pointer border-0 shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Share to Chat</span>
            </button>

            {/* 3. Delete Option if user created this sticker */}
            {canDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="w-full py-2 px-4 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                title="Delete your sticker"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Sticker</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export interface StickerPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSticker: (stickerUrl: string, stickerType?: 'image' | 'video' | 'animated') => void;
  onSelectEmoji?: (emoji: string) => void;
  currentUser: User | null;
}

export const StickerPickerModal: React.FC<StickerPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectSticker,
  currentUser,
}) => {
  // Pure sticker tabs: For You (all), My Stickers (my), Saved (saved) - NO emoji tab
  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'saved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Community & Custom Stickers State
  const [communityStickers, setCommunityStickers] = useState<CustomSticker[]>([]);
  const [myStickers, setMyStickers] = useState<CustomSticker[]>([]);
  const [savedStickersList, setSavedStickersList] = useState<{ id: string; url: string; title?: string; type?: 'image' | 'video' | 'animated' }[]>([]);
  const [isLoadingStickers, setIsLoadingStickers] = useState(false);

  // Sticker Creator Full Screen Studio State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatorFile, setCreatorFile] = useState<File | null>(null);
  const [creatorPreviewUrl, setCreatorPreviewUrl] = useState<string | null>(null);
  const [creatorFileType, setCreatorFileType] = useState<'image' | 'video' | 'animated'>('image');
  const [creatorTitle, setCreatorTitle] = useState('');
  const [stickerStyle, setStickerStyle] = useState<'die-cut' | 'clean' | 'circle'>('clean');
  const [stickerCaption, setStickerCaption] = useState('');
  const [captionColor, setCaptionColor] = useState<string>('#ffffff');
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [isFlippedH, setIsFlippedH] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [videoDuration, setVideoDuration] = useState<number>(5);
  const [videoTrimStart, setVideoTrimStart] = useState<number>(0);
  const [isUploadingSticker, setIsUploadingSticker] = useState(false);
  const [isSendingDirectly, setIsSendingDirectly] = useState(false);
  
  // Drawing / Doodle State on Sticker
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [brushColor, setBrushColor] = useState('#FE2C55');
  const [isEraser, setIsEraser] = useState(false);
  
  // Sticker Click Action / Viewer Modal State
  const [viewingStickerUrl, setViewingStickerUrl] = useState<string | null>(null);
  const [viewingStickerType, setViewingStickerType] = useState<'image' | 'video' | 'animated'>('image');

  const creatorFileInputRef = useRef<HTMLInputElement>(null);
  const cameraFileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);

  // Load & subscribe stickers on open
  useEffect(() => {
    if (!isOpen) return;
    
    if (currentUser?.uid) {
      setSavedStickersList(getSavedStickers(currentUser.uid));
    }

    setIsLoadingStickers(true);

    const unsubscribe = subscribeCommunityStickers((comm) => {
      setCommunityStickers(comm);
      setIsLoadingStickers(false);
    });

    if (currentUser?.uid) {
      getUserCreatedStickers(currentUser.uid).then((my) => {
        setMyStickers(my);
      }).catch(() => {});
    }

    return () => {
      unsubscribe();
    };
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

  // Fast client-side image baking & compression into ultra-lightweight WebP / PNG
  const prepareFinalStickerFile = async (
    file: File,
    style: 'die-cut' | 'clean' | 'circle',
    caption: string,
    rotation: number,
    flip: boolean,
    zoom: number = 1
  ): Promise<File> => {
    if (file.type.startsWith('video')) {
      return file;
    }
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement('canvas');
        const size = 384; // Optimized lightweight size for 0-latency uploads
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);

        ctx.save();
        ctx.translate(size / 2, size / 2);
        if (rotation !== 0) ctx.rotate((rotation * Math.PI) / 180);
        if (flip) ctx.scale(-1, 1);
        if (zoom !== 1) ctx.scale(zoom, zoom);
        ctx.translate(-size / 2, -size / 2);

        // Calculate aspect fit with margin
        const pad = style === 'circle' ? 36 : 40;
        const scale = Math.min((size - pad * 2) / img.width, (size - pad * 2) / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (size - w) / 2;
        const y = (size - h) / 2 - (caption.trim() ? 20 : 0);

        if (style === 'circle') {
          ctx.beginPath();
          ctx.arc(size / 2, size / 2 - (caption.trim() ? 20 : 0), Math.min(w, h) / 2 + 6, 0, Math.PI * 2);
          ctx.clip();
        }

        if (style === 'die-cut') {
          ctx.shadowColor = 'rgba(255,255,255,0.7)';
          ctx.shadowBlur = 4;
          ctx.drawImage(img, x, y, w, h);
        } else {
          ctx.drawImage(img, x, y, w, h);
        }

        // Overlay drawing doodles if any
        if (drawCanvasRef.current) {
          ctx.drawImage(drawCanvasRef.current, 0, 0, size, size);
        }

        ctx.restore();

        // Caption overlay
        if (caption.trim()) {
          ctx.save();
          ctx.font = '900 28px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const textY = size - 32;
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 6;
          ctx.lineJoin = 'round';
          ctx.strokeText(caption.trim(), size / 2, textY);
          ctx.fillStyle = captionColor || '#FFFFFF';
          ctx.fillText(caption.trim(), size / 2, textY);
          ctx.restore();
        }

        // Fast WebP conversion with robust PNG fallback
        canvas.toBlob((blob) => {
          if (!blob) {
            canvas.toBlob((pngBlob) => {
              if (!pngBlob) return resolve(file);
              const fallbackFile = new File([pngBlob], `sticker_${Date.now()}.png`, { type: 'image/png' });
              resolve(fallbackFile);
            }, 'image/png');
            return;
          }
          const finalFile = new File([blob], `sticker_${Date.now()}.webp`, { type: 'image/webp' });
          resolve(finalFile);
        }, 'image/webp', 0.88);
      };
      img.onerror = () => resolve(file);
      img.src = objectUrl;
    });
  };

  // Remove solid background (Magic Transparentizer)
  const handleRemoveBackground = () => {
    if (!creatorPreviewUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, c.width, c.height);
      const data = imgData.data;

      // Sample 4 corner pixels to determine background color
      const cornerR = data[0];
      const cornerG = data[1];
      const cornerB = data[2];

      const threshold = 40;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const diff = Math.abs(r - cornerR) + Math.abs(g - cornerG) + Math.abs(b - cornerB);
        // Also check if near pure white or near dark background
        const isNearCorner = diff < threshold * 2;
        const isNearWhite = r > 240 && g > 240 && b > 240;
        if (isNearCorner || isNearWhite) {
          data[i + 3] = 0; // Alpha 0 (transparent)
        }
      }
      ctx.putImageData(imgData, 0, 0);
      c.toBlob((blob) => {
        if (!blob) return;
        const newFile = new File([blob], `nobg_${Date.now()}.png`, { type: 'image/png' });
        setCreatorFile(newFile);
        setCreatorPreviewUrl(URL.createObjectURL(newFile));
      }, 'image/png');
    };
    img.src = creatorPreviewUrl;
  };

  // Handle Video Metadata & 5s Loop Trimming
  const handleVideoLoadedMetadata = () => {
    if (videoPreviewRef.current) {
      const dur = videoPreviewRef.current.duration || 5;
      setVideoDuration(dur);
      setVideoTrimStart(0);
      videoPreviewRef.current.currentTime = 0;
    }
  };

  const handleVideoTimeUpdate = () => {
    if (videoPreviewRef.current) {
      const cur = videoPreviewRef.current.currentTime;
      const maxEnd = Math.min(videoDuration, videoTrimStart + 5);
      if (cur >= maxEnd || cur < videoTrimStart) {
        videoPreviewRef.current.currentTime = videoTrimStart;
        videoPreviewRef.current.play().catch(() => {});
      }
    }
  };

  // Handle Sticker File Selection for Creator
  const handleCreatorFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCreatorFile(file);
    
    const isVid = file.type.startsWith('video') || file.name.endsWith('.mp4') || file.name.endsWith('.webm') || file.name.endsWith('.mov');
    const isGif = file.type.includes('gif') || file.name.endsWith('.gif');
    
    if (isVid) {
      setCreatorFileType('video');
    } else if (isGif) {
      setCreatorFileType('animated');
    } else {
      setCreatorFileType('image');
    }
    
    const preview = URL.createObjectURL(file);
    setCreatorPreviewUrl(preview);
    setRotationAngle(0);
    setIsFlippedH(false);
    setZoomLevel(1);
    setVideoTrimStart(0);
    if (!creatorTitle) {
      setCreatorTitle(file.name.split('.')[0].replace(/[-_]/g, ' '));
    }
  };

  // Submit and Upload Custom Sticker
  const handleCreateStickerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatorFile || !currentUser) return;
    setIsUploadingSticker(true);
    try {
      const fileToUpload = await prepareFinalStickerFile(
        creatorFile, 
        stickerStyle, 
        stickerCaption, 
        rotationAngle, 
        isFlippedH,
        zoomLevel
      );
      const mediaUrl = await uploadMedia(fileToUpload, 'stickers');
      
      const newStk = await createCustomSticker({
        url: mediaUrl,
        title: creatorTitle.trim() || 'Custom Sticker',
        type: creatorFileType,
        authorId: currentUser.uid,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar,
        tags: ['sticker', 'custom', creatorTitle.toLowerCase().trim()]
      });

      setMyStickers(prev => [newStk, ...prev]);
      setCommunityStickers(prev => [newStk, ...prev]);
      
      // Reset & Return to Stickers List
      setShowCreateModal(false);
      setCreatorFile(null);
      setCreatorPreviewUrl(null);
      setCreatorTitle('');
      setStickerCaption('');
      setZoomLevel(1);
      setActiveTab('all');
    } catch (err) {
      console.error("Failed to upload custom sticker:", err);
    } finally {
      setIsUploadingSticker(false);
    }
  };

  // Instant Send Live Sticker Directly to Active Chat
  const handleSendDirectly = async () => {
    if (!creatorFile) return;
    setIsSendingDirectly(true);
    try {
      const fileToUpload = await prepareFinalStickerFile(
        creatorFile, 
        stickerStyle, 
        stickerCaption, 
        rotationAngle, 
        isFlippedH,
        zoomLevel
      );
      const mediaUrl = await uploadMedia(fileToUpload, 'stickers');
      
      if (currentUser) {
        createCustomSticker({
          url: mediaUrl,
          title: creatorTitle.trim() || 'My Sticker',
          type: creatorFileType,
          authorId: currentUser.uid,
          authorName: currentUser.name,
          authorAvatar: currentUser.avatar,
          tags: ['custom', 'direct']
        }).then((newStk) => {
          setMyStickers(prev => [newStk, ...prev]);
        }).catch(() => {});
      }

      onSelectSticker(mediaUrl, creatorFileType);
      setShowCreateModal(false);
      setCreatorFile(null);
      setCreatorPreviewUrl(null);
      setCreatorTitle('');
      setStickerCaption('');
      setZoomLevel(1);
      onClose();
    } catch (err) {
      console.error('Failed to send live sticker directly:', err);
    } finally {
      setIsSendingDirectly(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        {/* Soft dismissal backdrop for PC and Mobile */}
        <div 
          className="fixed inset-0 z-[290] bg-black/20 md:bg-black/10 transition-opacity" 
          onClick={onClose} 
        />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="fixed bottom-0 inset-x-0 z-[300] md:fixed md:bottom-20 md:right-8 md:inset-x-auto md:w-[380px] md:h-[480px] bg-white dark:bg-[#16181f] rounded-t-[28px] md:rounded-[24px] flex flex-col h-[340px] md:h-[480px] overflow-hidden transform-gpu border-t md:border border-sky-100 dark:border-sky-900/40 text-neutral-900 dark:text-white select-none shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800/80 shrink-0 bg-neutral-50/60 dark:bg-neutral-900/60">
            <div className="flex items-center space-x-2">
              <div className="w-6.5 h-6.5 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-300 flex items-center justify-center">
                <StickerIcon className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-neutral-800 dark:text-neutral-100 tracking-tight">Stickers</span>
            </div>

            {/* Action Icons Right */}
            <div className="flex items-center space-x-1.5">
              {currentUser && (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="px-2.5 py-1 rounded-full bg-sky-500/15 hover:bg-sky-500/25 text-sky-600 dark:text-sky-300 border border-sky-400/30 flex items-center space-x-1 transition-all text-xs font-semibold cursor-pointer"
                  title="Create Sticker"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Create</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 bg-neutral-200/70 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-full transition-colors flex items-center justify-center cursor-pointer border-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 3 Clean Soft Rounded Tabs - NO EMOJI TAB */}
          <div className="flex items-center justify-around px-3 py-1.5 bg-neutral-50/90 dark:bg-neutral-900/90 border-b border-neutral-100 dark:border-neutral-800/80 shrink-0">
            <button
              type="button"
              onClick={() => { setActiveTab('all'); setSearchQuery(''); }}
              className={`px-3 py-1.5 rounded-xl transition-all text-xs font-semibold flex items-center space-x-1.5 cursor-pointer border-0 ${
                activeTab === 'all' 
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-black shadow-xs' 
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-800 bg-transparent'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>For You</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('my'); setSearchQuery(''); }}
              className={`px-3 py-1.5 rounded-xl transition-all text-xs font-semibold flex items-center space-x-1.5 cursor-pointer border-0 ${
                activeTab === 'my' 
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-black shadow-xs' 
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-800 bg-transparent'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>My Stickers</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('saved'); setSearchQuery(''); }}
              className={`px-3 py-1.5 rounded-xl transition-all text-xs font-semibold flex items-center space-x-1.5 cursor-pointer border-0 ${
                activeTab === 'saved' 
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-black shadow-xs' 
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-800 bg-transparent'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Saved</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="px-3 py-1.5 border-b border-neutral-100 dark:border-neutral-800/80 shrink-0 bg-white dark:bg-[#16181f]">
            <div className="relative flex items-center bg-neutral-100/90 dark:bg-neutral-800/90 rounded-full px-3 py-1 text-xs text-neutral-800 dark:text-neutral-100">
              <Search className="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search stickers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none w-full border-0"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} className="p-0.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 border-0 bg-transparent cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Main Content Body */}
          <div className="flex-1 overflow-y-auto p-3 no-scrollbar bg-white dark:bg-[#16181f]">
            {/* For You / All Stickers */}
            {activeTab === 'all' && (
              <div>
                {isLoadingStickers ? (
                  <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                    <Loader2 className="w-6 h-6 animate-spin text-sky-500 mb-2" />
                    <p className="text-[11px]">Loading stickers...</p>
                  </div>
                ) : filteredAllStickers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                    <div className="w-12 h-12 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-500 flex items-center justify-center mb-2">
                      <StickerIcon className="w-6 h-6 opacity-60" />
                    </div>
                    <h4 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">No Stickers Yet</h4>
                    <p className="text-[11px] text-neutral-500 mt-0.5 mb-3">
                      Create your own custom stickers in seconds!
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(true)}
                      className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-400 text-white rounded-full text-xs font-medium transition-all cursor-pointer border-0"
                    >
                      + Create Sticker
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2.5 items-center justify-items-center">
                    {filteredAllStickers.map((stk) => (
                      <div
                        key={stk.id}
                        className="group relative flex flex-col items-center justify-center p-1 rounded-2xl hover:bg-sky-50/50 dark:hover:bg-neutral-800/50 transition-all duration-150 cursor-pointer select-none w-full"
                        onClick={() => {
                          onSelectSticker(stk.url, stk.type);
                          onClose();
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setViewingStickerUrl(stk.url);
                          setViewingStickerType(stk.type || 'image');
                        }}
                      >
                        <div className="w-full aspect-square max-w-[76px] p-1 flex items-center justify-center overflow-hidden rounded-2xl mx-auto">
                          {stk.type === 'video' ? (
                            <VideoSticker 
                              src={stk.url} 
                              className="w-full h-full object-cover rounded-2xl pointer-events-none drop-shadow-2xs" 
                            />
                          ) : (
                            <img 
                              src={stk.url} 
                              alt={stk.title} 
                              loading="lazy" 
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-contain pointer-events-none drop-shadow-xs transition-transform" 
                              onError={(e) => {
                                const el = e.currentTarget;
                                if (stk.url?.includes('/uploads/') && !el.dataset.retried) {
                                  el.dataset.retried = 'true';
                                  el.src = `/uploads/${stk.url.split('/uploads/')[1]}`;
                                }
                              }}
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
                {myStickers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                    <div className="w-12 h-12 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-500 flex items-center justify-center mb-2">
                      <ImageIcon className="w-6 h-6 opacity-60" />
                    </div>
                    <h4 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">No Stickers Created</h4>
                    <p className="text-[11px] text-neutral-500 mt-0.5 mb-3">
                      Design your own photo & live stickers!
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(true)}
                      className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-400 text-white rounded-full text-xs font-medium transition-all cursor-pointer border-0"
                    >
                      + Create Sticker
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2.5 items-center justify-items-center">
                    {myStickers.map((stk) => (
                      <div
                        key={stk.id}
                        className="group relative flex flex-col items-center justify-center p-1 rounded-2xl hover:bg-sky-50/50 dark:hover:bg-neutral-800/50 transition-all cursor-pointer select-none w-full"
                        onClick={() => {
                          onSelectSticker(stk.url, stk.type);
                          onClose();
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setViewingStickerUrl(stk.url);
                          setViewingStickerType(stk.type || 'image');
                        }}
                      >
                        <div className="w-full aspect-square max-w-[76px] p-1 flex items-center justify-center overflow-hidden rounded-2xl mx-auto">
                          {stk.type === 'video' ? (
                            <VideoSticker 
                              src={stk.url} 
                              className="w-full h-full object-cover rounded-2xl pointer-events-none drop-shadow-2xs" 
                            />
                          ) : (
                            <img 
                              src={stk.url} 
                              alt={stk.title} 
                              loading="lazy" 
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-contain pointer-events-none drop-shadow-xs transition-transform" 
                              onError={(e) => {
                                const el = e.currentTarget;
                                if (stk.url?.includes('/uploads/') && !el.dataset.retried) {
                                  el.dataset.retried = 'true';
                                  el.src = `/uploads/${stk.url.split('/uploads/')[1]}`;
                                }
                              }}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Saved Stickers Tab */}
            {activeTab === 'saved' && (
              <div>
                {savedStickersList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                    <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center mb-2">
                      <Bookmark className="w-6 h-6 opacity-60" />
                    </div>
                    <h4 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">No Saved Stickers</h4>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      Click any sticker in chat to save it here!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2.5 items-center justify-items-center">
                    {savedStickersList.map((stk) => (
                      <div
                        key={stk.id}
                        className="group relative flex flex-col items-center justify-center p-1 rounded-2xl hover:bg-sky-50/50 dark:hover:bg-neutral-800/50 transition-all cursor-pointer select-none w-full"
                        onClick={() => {
                          onSelectSticker(stk.url, stk.type);
                          onClose();
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setViewingStickerUrl(stk.url);
                          setViewingStickerType(stk.type || 'image');
                        }}
                      >
                        <div className="w-full aspect-square max-w-[76px] p-1 flex items-center justify-center overflow-hidden rounded-2xl mx-auto">
                          {stk.type === 'video' ? (
                            <VideoSticker 
                              src={stk.url} 
                              className="w-full h-full object-cover rounded-2xl pointer-events-none drop-shadow-2xs" 
                            />
                          ) : (
                            <img 
                              src={stk.url} 
                              alt={stk.title || 'Saved'} 
                              loading="lazy" 
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-contain pointer-events-none drop-shadow-xs transition-transform" 
                              onError={(e) => {
                                const el = e.currentTarget;
                                if (stk.url?.includes('/uploads/') && !el.dataset.retried) {
                                  el.dataset.retried = 'true';
                                  el.src = `/uploads/${stk.url.split('/uploads/')[1]}`;
                                }
                              }}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* FULL-SCREEN STICKER CREATOR STUDIO PAGE (Sky Blur 2D Theme, NO Black Glow) */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed inset-0 z-[360] bg-sky-950/75 dark:bg-slate-950/85 backdrop-blur-2xl text-white flex flex-col h-full w-full overflow-hidden select-none"
          >
            {/* Sky Blur Frosted Studio Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-sky-400/20 bg-sky-900/30 backdrop-blur-xl shrink-0">
              <div className="flex items-center space-x-3">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreatorFile(null);
                    setCreatorPreviewUrl(null);
                    setStickerCaption('');
                  }}
                  className="p-2 rounded-full bg-sky-900/40 hover:bg-sky-800/60 text-sky-200 hover:text-white transition-all border border-sky-400/30 cursor-pointer"
                  title="Close Sticker Studio"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-base tracking-tight text-white">Sticker Studio</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-sky-300" /> Editor
                  </span>
                </div>
              </div>
            </div>

            {/* Hidden File, Camera & Video Inputs */}
            <input
              type="file"
              ref={creatorFileInputRef}
              accept="image/*,.gif"
              className="hidden"
              onChange={handleCreatorFileChange}
            />
            <input
              type="file"
              ref={cameraFileInputRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleCreatorFileChange}
            />
            <input
              type="file"
              ref={videoFileInputRef}
              accept="video/*,.mp4,.webm,.mov"
              className="hidden"
              onChange={handleCreatorFileChange}
            />

            {/* Studio Body */}
            <div className="flex-1 flex flex-col items-center justify-between p-4 overflow-y-auto no-scrollbar">
              {/* Canvas / Preview Stage */}
              <div className="w-full max-w-md flex-1 flex flex-col items-center justify-center my-auto min-h-[250px]">
                {creatorPreviewUrl ? (
                  <div className="relative w-full aspect-square max-w-[290px] sm:max-w-[320px] rounded-3xl bg-sky-900/25 border border-sky-400/30 flex items-center justify-center p-3.5 overflow-hidden shadow-[0_8px_32px_rgba(56,189,248,0.12)]">
                    {/* Checkerboard transparency hint */}
                    <div 
                      className="absolute inset-0 opacity-10 pointer-events-none"
                      style={{
                        backgroundImage: 'radial-gradient(#ffffff 1.5px, transparent 1.5px)',
                        backgroundSize: '16px 16px'
                      }}
                    />

                    {/* Transformed Sticker Image / Video with Zoom to Fill */}
                    <div 
                      className="relative w-full h-full rounded-2xl flex items-center justify-center transition-transform duration-100 overflow-hidden"
                      style={{
                        transform: `rotate(${rotationAngle}deg) scaleX(${isFlippedH ? -1 : 1}) scale(${zoomLevel})`
                      }}
                    >
                      {creatorFileType === 'video' ? (
                        <video 
                          ref={videoPreviewRef}
                          src={creatorPreviewUrl} 
                          autoPlay 
                          loop 
                          muted 
                          playsInline 
                          onLoadedMetadata={handleVideoLoadedMetadata}
                          onTimeUpdate={handleVideoTimeUpdate}
                          className="w-full h-full object-cover rounded-2xl pointer-events-none" 
                          style={{
                            filter: stickerStyle === 'die-cut'
                              ? 'drop-shadow(0 0 4px rgba(255,255,255,0.8))'
                              : 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))'
                          }}
                        />
                      ) : (
                        <img 
                          src={creatorPreviewUrl} 
                          alt="Sticker Preview" 
                          className={`w-full h-full object-cover transition-all duration-200 pointer-events-none ${stickerStyle === 'circle' ? 'rounded-full' : 'rounded-2xl'}`}
                          style={{
                            filter: stickerStyle === 'die-cut'
                              ? 'drop-shadow(0 0 4px rgba(255,255,255,0.85)) drop-shadow(0 1px 3px rgba(0,0,0,0.2))'
                              : 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
                          }}
                        />
                      )}

                      {/* Text Caption Overlay */}
                      {stickerCaption.trim() && (
                        <div className="absolute bottom-2 inset-x-2 text-center pointer-events-none z-10">
                          <span 
                            className="text-base md:text-lg font-black uppercase tracking-wider inline-block px-2 py-0.5 rounded-lg"
                            style={{
                              color: captionColor,
                              textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 2px 6px rgba(0,0,0,0.7)'
                            }}
                          >
                            {stickerCaption.trim()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Initial Minimal Welcome Page: Select Photo or Video with Pure Icon Buttons */
                  <div className="w-full max-w-[320px] aspect-square rounded-3xl border-2 border-dashed border-sky-400/35 bg-sky-900/20 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4 shadow-[0_8px_30px_rgba(56,189,248,0.08)]">
                    <div className="w-16 h-16 rounded-full bg-sky-500/15 border border-sky-400/30 text-sky-400 flex items-center justify-center shadow-xs">
                      <Sparkles className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-white">Select Your Photo or Video</h3>
                      <p className="text-xs text-sky-200/70 mt-1 max-w-[230px]">
                        Choose a picture, take a snap, or pick a video clip
                      </p>
                    </div>

                    {/* Pure Clean Icon Buttons */}
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => creatorFileInputRef.current?.click()}
                        className="w-13 h-13 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white flex items-center justify-center transition-all cursor-pointer border-0 shadow-xs"
                        title="Choose Photo"
                      >
                        <ImageIcon className="w-6 h-6" />
                      </button>

                      <button
                        type="button"
                        onClick={() => cameraFileInputRef.current?.click()}
                        className="w-13 h-13 rounded-2xl bg-sky-900/50 hover:bg-sky-800/60 text-sky-200 hover:text-white flex items-center justify-center border border-sky-400/30 transition-all cursor-pointer"
                        title="Take Photo with Camera"
                      >
                        <Camera className="w-6 h-6" />
                      </button>

                      <button
                        type="button"
                        onClick={() => videoFileInputRef.current?.click()}
                        className="w-13 h-13 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-all cursor-pointer border-0 shadow-xs"
                        title="Choose Video (5s Clip)"
                      >
                        <Video className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Editing Controls Toolbar - Pure Icon Buttons */}
              {creatorPreviewUrl && (
                <div className="w-full max-w-md bg-sky-900/30 backdrop-blur-xl border border-sky-400/20 rounded-3xl p-3.5 space-y-3 mt-2 select-none">
                  {/* Row 1: Pure Icon Action Buttons (Rotate, Flip, Cutout, Zoom Out, Zoom Slider, Zoom In, Replace) */}
                  <div className="flex items-center justify-between border-b border-sky-400/20 pb-2.5">
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={() => setRotationAngle((prev) => (prev + 90) % 360)}
                        className="w-9 h-9 rounded-full bg-sky-800/40 hover:bg-sky-700/50 text-sky-200 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-sky-400/20"
                        title="Rotate 90°"
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsFlippedH((prev) => !prev)}
                        className={`w-9 h-9 rounded-full  flex items-center justify-center transition-all cursor-pointer border ${
                          isFlippedH 
                            ? 'bg-sky-500 text-white border-sky-400 shadow-xs' 
                            : 'bg-sky-800/40 text-sky-200 border-sky-400/20 hover:bg-sky-700/50'
                        }`}
                        title="Flip Horizontal"
                      >
                        <FlipHorizontal className="w-4 h-4" />
                      </button>

                      {creatorFileType === 'image' && (
                        <button
                          type="button"
                          onClick={handleRemoveBackground}
                          className="w-9 h-9 rounded-full bg-gradient-to-r from-sky-400/30 to-blue-500/30 hover:bg-sky-600/40 text-sky-100 flex items-center justify-center transition-all cursor-pointer border border-sky-400/30"
                          title="Magic Cutout (Remove Solid Background)"
                        >
                          <Wand2 className="w-4 h-4 text-sky-300" />
                        </button>
                      )}
                    </div>

                    {/* Zoom In/Out to Fill Box */}
                    <div className="flex items-center space-x-1 bg-sky-950/40 px-2 py-1 rounded-full border border-sky-400/20">
                      <button
                        type="button"
                        onClick={() => setZoomLevel((prev) => Math.max(1, +(prev - 0.25).toFixed(2)))}
                        className="w-7 h-7 rounded-full hover:bg-sky-800/50 text-sky-300 flex items-center justify-center cursor-pointer border-0"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>

                      <input
                        type="range"
                        min="1"
                        max="2.5"
                        step="0.05"
                        value={zoomLevel}
                        onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                        className="w-16 sm:w-20 accent-sky-400 h-1.5 bg-sky-900/60 rounded-full cursor-pointer"
                        title={`Zoom: ${zoomLevel.toFixed(2)}x`}
                      />

                      <button
                        type="button"
                        onClick={() => setZoomLevel((prev) => Math.min(2.5, +(prev + 0.25).toFixed(2)))}
                        className="w-7 h-7 rounded-full hover:bg-sky-800/50 text-sky-300 flex items-center justify-center cursor-pointer border-0"
                        title="Zoom In (Fill Rounded Box)"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => creatorFileInputRef.current?.click()}
                      className="w-9 h-9 rounded-full bg-sky-800/40 hover:bg-sky-700/50 text-sky-200 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-sky-400/20"
                      title="Choose Another Media"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Video 5-Second Segment Selector (Lag-Free) */}
                  {creatorFileType === 'video' && (
                    <div className="bg-sky-950/40 border border-sky-400/25 rounded-2xl p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-sky-200">
                        <div className="flex items-center space-x-1.5 font-bold">
                          <Film className="w-3.5 h-3.5 text-sky-400" />
                          <span>5-Second Video Clip</span>
                        </div>
                        <span className="font-mono text-sky-300 font-bold">
                          {videoTrimStart.toFixed(1)}s - {(videoTrimStart + Math.min(5, Math.max(0.1, videoDuration - videoTrimStart))).toFixed(1)}s
                        </span>
                      </div>
                      <input 
                        type="range"
                        min={0}
                        max={Math.max(0, videoDuration - 5)}
                        step={0.1}
                        value={videoTrimStart}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setVideoTrimStart(v);
                          if (videoPreviewRef.current) {
                            videoPreviewRef.current.currentTime = v;
                          }
                        }}
                        className="w-full accent-sky-400 h-1.5 bg-sky-900/60 rounded-full cursor-pointer"
                        title="Select 5-second segment"
                      />
                    </div>
                  )}

                  {/* Style Presets - Pure Clean Pills */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-sky-200/80">Style</span>
                    <div className="flex items-center space-x-1.5">
                      {[
                        { id: 'die-cut', label: 'Die-Cut' },
                        { id: 'circle', label: 'Circle' },
                        { id: 'clean', label: 'Clean' },
                      ].map((style) => (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => setStickerStyle(style.id as any)}
                          className={`py-1 px-3 rounded-full text-[11px] font-medium transition-all text-center cursor-pointer border ${
                            stickerStyle === style.id
                              ? 'bg-sky-500 text-white border-sky-300 shadow-xs'
                              : 'bg-sky-950/40 text-sky-200/70 border-sky-400/20 hover:bg-sky-800/40'
                          }`}
                        >
                          {style.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sticker Title Input */}
                  <div className="space-y-1">
                    <input
                      type="text"
                      placeholder="Sticker title (e.g. Happy Cat)..."
                      value={creatorTitle}
                      onChange={(e) => setCreatorTitle(e.target.value)}
                      className="w-full bg-sky-950/50 border border-sky-400/30 rounded-full px-3.5 py-1.5 text-xs text-white placeholder-sky-300/40 focus:outline-none focus:border-sky-400"
                      maxLength={40}
                    />
                  </div>

                  {/* Bottom Save & Send Actions */}
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCreateStickerSubmit}
                      disabled={isUploadingSticker || isSendingDirectly}
                      className="flex-1 py-2 px-3 rounded-full bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 hover:text-white border border-sky-400/30 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                      title="Save to My Stickers"
                    >
                      {isUploadingSticker ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Bookmark className="w-3.5 h-3.5" />
                      )}
                      <span>{isUploadingSticker ? 'Saving...' : 'Save Sticker'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSendDirectly}
                      disabled={isUploadingSticker || isSendingDirectly}
                      className="flex-1 py-2 px-3 rounded-full bg-gradient-to-r from-sky-400 to-blue-600 hover:from-sky-500 hover:to-blue-700 text-white text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer border-0 shadow-xs"
                      title="Share Sticker to Chat"
                    >
                      {isSendingDirectly ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>{isSendingDirectly ? 'Sending...' : 'Share to Chat'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Sticker Click Viewer Modal (Enlarged preview with 2 clean buttons) */}
      <StickerViewerModal
        isOpen={!!viewingStickerUrl}
        onClose={() => setViewingStickerUrl(null)}
        stickerUrl={viewingStickerUrl}
        stickerType={viewingStickerType}
        currentUserId={currentUser?.uid}
        onShareToChat={(url, type) => {
          onSelectSticker(url, type);
          setViewingStickerUrl(null);
          onClose();
        }}
        onDeleteSticker={(url) => {
          setMyStickers((prev) => prev.filter((s) => s.url !== url));
          setCommunityStickers((prev) => prev.filter((s) => s.url !== url));
          setViewingStickerUrl(null);
        }}
      />
    </>
  );
};
