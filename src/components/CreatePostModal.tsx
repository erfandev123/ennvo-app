import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ImageIcon,
  Video,
  Smile,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Music,
  MapPin,
  UserPlus,
  Sliders,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Quote,
  AlignLeft,
  Play,
  Pause,
  Plus,
  AtSign,
  Sparkles,
  Shield,
  Check,
  Maximize2
} from 'lucide-react';
import { useAppStore } from '../store';
import { createPost } from '../services/postService';
import { Song } from '../types';
import { TagPeopleModal } from './TagPeopleModal';
import { AddLocationModal } from './AddLocationModal';
import { AdvancedSettingsModal, AdvancedSettings } from './AdvancedSettingsModal';
import { MusicLibraryModal } from './MusicLibraryModal';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostSuccess?: () => void;
}

const BACKGROUND_PRESETS = [
  { id: 'white', bg: 'bg-white', text: 'text-gray-900', placeholder: 'placeholder-gray-400', label: 'Clean White' },
  { id: 'midnight', bg: 'bg-gradient-to-br from-gray-950 via-gray-900 to-black', text: 'text-white', placeholder: 'placeholder-white/60', label: 'Midnight' },
  { id: 'sunset', bg: 'bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600', text: 'text-white', placeholder: 'placeholder-white/70', label: 'Sunset' },
  { id: 'cyan', bg: 'bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600', text: 'text-white', placeholder: 'placeholder-white/70', label: 'Neon Cyan' },
  { id: 'violet', bg: 'bg-gradient-to-br from-purple-700 via-indigo-600 to-blue-600', text: 'text-white', placeholder: 'placeholder-white/70', label: 'Royal Violet' },
  { id: 'emerald', bg: 'bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-700', text: 'text-white', placeholder: 'placeholder-white/70', label: 'Emerald' },
  { id: 'ruby', bg: 'bg-gradient-to-tr from-rose-600 via-pink-600 to-purple-600', text: 'text-white', placeholder: 'placeholder-white/70', label: 'Ruby' },
  { id: 'golden', bg: 'bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500', text: 'text-white', placeholder: 'placeholder-white/70', label: 'Golden' },
  { id: 'ocean', bg: 'bg-gradient-to-tr from-blue-700 via-indigo-800 to-slate-950', text: 'text-white', placeholder: 'placeholder-white/70', label: 'Ocean' },
  { id: 'cherry', bg: 'bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-400', text: 'text-white', placeholder: 'placeholder-white/70', label: 'Cherry' },
  { id: 'cyber', bg: 'bg-gradient-to-br from-purple-900 via-indigo-950 to-black', text: 'text-white', placeholder: 'placeholder-white/70', label: 'Cyberpunk' },
  { id: 'lime', bg: 'bg-gradient-to-r from-lime-500 via-emerald-500 to-teal-600', text: 'text-white', placeholder: 'placeholder-white/70', label: 'Fresh Lime' },
];

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  onPostSuccess,
}) => {
  const { currentUser } = useAppStore();
  const [postText, setPostText] = useState('');
  const [selectedBg, setSelectedBg] = useState(BACKGROUND_PRESETS[0]);
  const [postFiles, setPostFiles] = useState<File[]>([]);
  const [postPreviews, setPostPreviews] = useState<{ url: string; type: 'image' | 'video' }[]>([]);
  const [currentMediaIdx, setCurrentMediaIdx] = useState(0);

  // Additional Metadata
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [taggedUsers, setTaggedUsers] = useState<{ uid: string; name: string; username: string; avatar: string }[]>([]);
  const [aspectRatioFit, setAspectRatioFit] = useState<'cover' | 'contain'>('cover');
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettings>({
    commentsDisabled: false,
    privacy: 'public',
    hideLikes: false,
    allowRemix: true,
    highQuality: true,
    saveToDevice: false,
  });

  // Modals state
  const [showMusicModal, setShowMusicModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Loading & Progress
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewTouchStartX = useRef<number | null>(null);
  const previewTouchEndX = useRef<number | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    setPostFiles((prev) => [...prev, ...files]);
    const newPreviews = files.map((file) => ({
      url: URL.createObjectURL(file),
      type: file.type.startsWith('video') ? ('video' as const) : ('image' as const),
    }));
    setPostPreviews((prev) => [...prev, ...newPreviews]);
    e.target.value = '';
  };

  const handleRemoveMedia = (index: number) => {
    setPostFiles((prev) => prev.filter((_, i) => i !== index));
    setPostPreviews((prev) => prev.filter((_, i) => i !== index));
    if (currentMediaIdx >= postPreviews.length - 1) {
      setCurrentMediaIdx(Math.max(0, postPreviews.length - 2));
    }
  };

  const handleToggleTagUser = (user: { uid: string; name: string; username: string; avatar: string }) => {
    setTaggedUsers((prev) => {
      const exists = prev.some((u) => u.uid === user.uid);
      if (exists) {
        return prev.filter((u) => u.uid !== user.uid);
      }
      return [...prev, user];
    });
  };

  // Touch swipe support for media preview
  const handlePreviewTouchStart = (e: React.TouchEvent) => {
    previewTouchStartX.current = e.targetTouches[0].clientX;
  };

  const handlePreviewTouchMove = (e: React.TouchEvent) => {
    previewTouchEndX.current = e.targetTouches[0].clientX;
  };

  const handlePreviewTouchEnd = () => {
    if (!previewTouchStartX.current || !previewTouchEndX.current) return;
    const distance = previewTouchStartX.current - previewTouchEndX.current;
    if (distance > 40 && postPreviews.length > 1) {
      setCurrentMediaIdx((prev) => (prev < postPreviews.length - 1 ? prev + 1 : 0));
    } else if (distance < -40 && postPreviews.length > 1) {
      setCurrentMediaIdx((prev) => (prev > 0 ? prev - 1 : postPreviews.length - 1));
    }
    previewTouchStartX.current = null;
    previewTouchEndX.current = null;
  };

  // Formatting tool helper
  const applyFormatting = (prefix: string, suffix: string = prefix) => {
    if (!textareaRef.current) return;
    const input = textareaRef.current;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const text = postText;
    const selected = text.substring(start, end);

    let replacement = '';
    let selectionOffsetStart = 0;
    let selectionOffsetEnd = 0;

    if (selected) {
      replacement = `${prefix}${selected}${suffix}`;
      selectionOffsetStart = start;
      selectionOffsetEnd = start + replacement.length;
    } else {
      replacement = `${prefix}text${suffix}`;
      selectionOffsetStart = start + prefix.length;
      selectionOffsetEnd = selectionOffsetStart + 4;
    }

    const newText = text.substring(0, start) + replacement + text.substring(end);
    setPostText(newText);

    setTimeout(() => {
      input.focus();
      input.setSelectionRange(selectionOffsetStart, selectionOffsetEnd);
    }, 15);
  };

  const handleSongPlayPause = () => {
    if (!selectedSong) return;
    if (isPlayingAudio) {
      audioRef.current?.pause();
      setIsPlayingAudio(false);
    } else {
      if (!audioRef.current) {
        audioRef.current = new Audio(selectedSong.url);
      } else {
        audioRef.current.src = selectedSong.url;
      }
      audioRef.current.play();
      setIsPlayingAudio(true);

      audioRef.current.onended = () => setIsPlayingAudio(false);
    }
  };

  const handleCreatePostSubmit = async () => {
    if (!currentUser || (!postText.trim() && postFiles.length === 0)) return;
    setLoading(true);
    setUploadProgress(10);

    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.muted = true;
      } catch (e) {}
    }
    try {
      document.querySelectorAll('audio, video').forEach((el) => {
        try {
          (el as HTMLMediaElement).pause();
          (el as HTMLMediaElement).muted = true;
        } catch (e) {}
      });
    } catch (e) {}

    try {
      const type = 'post';
      await createPost(currentUser.uid, currentUser, postText, postFiles, type, selectedSong?.id, {
        location: selectedLocation,
        taggedUsers: taggedUsers,
        settings: advancedSettings,
        songInfo: selectedSong,
        aspectRatioFit: aspectRatioFit,
        bg: selectedBg.id !== 'white' ? selectedBg.bg : undefined,
        onProgress: (p) => setUploadProgress(p),
      });

      if (audioRef.current) {
        audioRef.current.pause();
      }

      setPostText('');
      setPostFiles([]);
      setPostPreviews([]);
      setSelectedSong(null);
      setSelectedLocation(null);
      setTaggedUsers([]);
      setSelectedBg(BACKGROUND_PRESETS[0]);
      onClose();
      if (onPostSuccess) onPostSuccess();
    } catch (err: any) {
      console.error('Create post error:', err);
      alert(`Failed to create post: ${err.message || err}`);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const isTextOnlyPost = postPreviews.length === 0;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="fixed inset-0 z-[120] bg-white text-gray-900 flex flex-col font-sans overflow-hidden"
      >
        {/* Android Native Header Bar */}
        <div className="pt-10 sm:pt-4 px-4 pb-3 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                if (audioRef.current) audioRef.current.pause();
                onClose();
              }}
              className="p-2 -ml-2 text-gray-800 hover:bg-gray-100 rounded-full transition-all active:scale-95"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">Create post</h2>
          </div>

          <button
            onClick={handleCreatePostSubmit}
            disabled={loading || (!postText.trim() && postFiles.length === 0)}
            className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-sm px-6 py-2 rounded-full shadow-md shadow-blue-500/20 disabled:opacity-40 disabled:active:scale-100 transition-all flex items-center space-x-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Posting...</span>
              </>
            ) : (
              <span>Post</span>
            )}
          </button>
        </div>

        {/* Upload Progress Bar */}
        {loading && (
          <div className="w-full bg-gray-100 h-1.5 overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}

        {/* Content Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full space-y-4 no-scrollbar pb-24">
          {postPreviews.length > 0 ? (
            /* PHOTO SELECTED MODE: All other UI disappears. Photo front & center with Caption on top! */
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Caption Input at the Top */}
              <div className="bg-gray-50/70 rounded-2xl p-3.5 border border-gray-200/80 focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/10 transition-all shadow-2xs">
                <textarea
                  ref={textareaRef}
                  placeholder="Write a caption..."
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  className="w-full resize-none focus:outline-none bg-transparent text-gray-900 text-base placeholder-gray-400 font-normal leading-relaxed"
                  rows={3}
                  autoFocus
                />
              </div>

              {/* Photo Front & Center */}
              <div className="relative w-full rounded-3xl overflow-hidden bg-black flex flex-col border border-gray-800 shadow-xl">
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900/90 backdrop-blur-md border-b border-gray-800/80 z-10">
                  <span className="text-xs font-semibold text-gray-300">
                    {postPreviews.length > 1 ? `${currentMediaIdx + 1} of ${postPreviews.length}` : 'Selected Photo'}
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setAspectRatioFit((prev) => (prev === 'cover' ? 'contain' : 'cover'))}
                      className="text-xs font-semibold text-purple-300 bg-purple-500/20 hover:bg-purple-500/30 px-3 py-1 rounded-full border border-purple-500/30 flex items-center space-x-1 active:scale-95 transition-all cursor-pointer"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span>{aspectRatioFit === 'cover' ? 'Full' : 'Fit'}</span>
                    </button>
                    <button
                      onClick={() => handleRemoveMedia(currentMediaIdx)}
                      className="p-1.5 bg-white/10 hover:bg-rose-600 rounded-full text-white backdrop-blur-md transition-all active:scale-90 cursor-pointer"
                      title="Remove photo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div
                  onTouchStart={handlePreviewTouchStart}
                  onTouchMove={handlePreviewTouchMove}
                  onTouchEnd={handlePreviewTouchEnd}
                  className="relative w-full h-[360px] sm:h-[460px] bg-black flex items-center justify-center select-none overflow-hidden"
                >
                  {postPreviews[currentMediaIdx]?.type === 'video' ? (
                    <video
                      src={postPreviews[currentMediaIdx].url}
                      className={`w-full h-full transition-all duration-300 ${
                        aspectRatioFit === 'cover' ? 'object-cover' : 'object-contain'
                      }`}
                      controls
                      autoPlay
                      muted
                      playsInline
                      preload="auto"
                    />
                  ) : (
                    <img
                      src={postPreviews[currentMediaIdx]?.url}
                      alt={`Preview ${currentMediaIdx + 1}`}
                      className={`w-full h-full transition-all duration-300 ${
                        aspectRatioFit === 'cover' ? 'object-cover' : 'object-contain'
                      }`}
                    />
                  )}

                  {postPreviews.length > 1 && (
                    <>
                      <button
                        onClick={() =>
                          setCurrentMediaIdx((prev) => (prev > 0 ? prev - 1 : postPreviews.length - 1))
                        }
                        className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur-md transition-all active:scale-90"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() =>
                          setCurrentMediaIdx((prev) => (prev < postPreviews.length - 1 ? prev + 1 : 0))
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur-md transition-all active:scale-90"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>

                {postPreviews.length > 1 && (
                  <div className="p-3 bg-gray-950 border-t border-gray-800/80 flex items-center space-x-2 overflow-x-auto no-scrollbar">
                    {postPreviews.map((media, idx) => (
                      <div
                        key={idx}
                        onClick={() => setCurrentMediaIdx(idx)}
                        className={`relative w-12 h-12 rounded-xl overflow-hidden cursor-pointer shrink-0 transition-all border-2 ${
                          currentMediaIdx === idx ? 'border-blue-500 scale-105 shadow-sm' : 'border-transparent opacity-60'
                        }`}
                      >
                        {media.type === 'video' ? (
                          <video src={media.url} className="w-full h-full object-cover" preload="auto" />
                        ) : (
                          <img src={media.url} alt="Thumb" className="w-full h-full object-cover" />
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-12 h-12 rounded-xl bg-gray-900 border border-dashed border-gray-700 hover:border-blue-400 flex items-center justify-center text-gray-400 hover:text-blue-400 transition-all shrink-0 cursor-pointer"
                      title="Add photo"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Hidden file input for adding more */}
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileSelect}
              />
            </div>
          ) : (
            /* TEXT-ONLY POST MODE: Full text styling & options */
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* User Info Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <img
                    src={
                      currentUser?.avatar ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        currentUser?.name || 'User'
                      )}&background=random`
                    }
                    alt="Avatar"
                    className="w-12 h-12 rounded-full object-cover border border-gray-200 shadow-sm"
                  />
                  <div>
                    <h3 className="font-bold text-gray-900 text-base leading-tight">
                      {currentUser?.name || 'User'}
                    </h3>
                    <button
                      onClick={() => setShowSettingsModal(true)}
                      className="mt-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-1 rounded-full flex items-center space-x-1 transition-colors border border-gray-200/60"
                    >
                      <Shield className="w-3 h-3 text-blue-600" />
                      <span className="capitalize">{advancedSettings.privacy}</span>
                      <ChevronDown className="w-3 h-3 text-gray-500 ml-0.5" />
                    </button>
                  </div>
                </div>

                {/* Quick Actions Badges */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowMusicModal(true)}
                    className={`p-2.5 rounded-full border transition-all ${
                      selectedSong
                        ? 'bg-purple-50 text-purple-600 border-purple-200 shadow-sm'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                    title="Add Music"
                  >
                    <Music className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setShowTagModal(true)}
                    className={`p-2.5 rounded-full border transition-all ${
                      taggedUsers.length > 0
                        ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                    title="Mention Friends"
                  >
                    <UserPlus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Location / Song / Tagged Metadata Badges */}
              {(selectedLocation || selectedSong || taggedUsers.length > 0) && (
                <div className="flex flex-wrap gap-2 items-center bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  {selectedSong && (
                    <div className="bg-purple-100 border border-purple-200 text-purple-900 px-3 py-1.5 rounded-full flex items-center space-x-2 text-xs font-semibold shadow-xs">
                      <button onClick={handleSongPlayPause} className="p-1 bg-purple-600 text-white rounded-full">
                        {isPlayingAudio ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-white ml-0.5" />}
                      </button>
                      <Music className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span className="truncate max-w-[140px]">
                        {selectedSong.title} • {selectedSong.artist}
                      </span>
                      <button
                        onClick={() => {
                          if (audioRef.current) audioRef.current.pause();
                          setSelectedSong(null);
                          setIsPlayingAudio(false);
                        }}
                        className="hover:bg-purple-200 p-0.5 rounded-full text-purple-700"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {selectedLocation && (
                    <div className="bg-emerald-100 border border-emerald-200 text-emerald-900 px-3 py-1.5 rounded-full flex items-center space-x-1.5 text-xs font-semibold shadow-xs">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate max-w-[150px]">{selectedLocation}</span>
                      <button
                        onClick={() => setSelectedLocation(null)}
                        className="hover:bg-emerald-200 p-0.5 rounded-full text-emerald-700"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {taggedUsers.map((u) => (
                    <div
                      key={u.uid}
                      className="bg-blue-100 border border-blue-200 text-blue-900 px-3 py-1.5 rounded-full flex items-center space-x-1.5 text-xs font-bold shadow-xs"
                    >
                      <AtSign className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="text-blue-600 font-bold">@{u.username}</span>
                      <button
                        onClick={() => handleToggleTagUser(u)}
                        className="hover:bg-blue-200 p-0.5 rounded-full text-blue-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Main Input Canvas Area */}
              <div
                className={`w-full min-h-[220px] sm:min-h-[260px] rounded-3xl transition-all duration-300 relative overflow-hidden flex flex-col ${
                  selectedBg.id !== 'white'
                    ? `${selectedBg.bg} p-6 justify-center items-center text-center shadow-lg border border-white/10`
                    : 'bg-white border border-gray-200 p-4 shadow-xs'
                }`}
              >
                <textarea
                  ref={textareaRef}
                  placeholder={
                    selectedBg.id !== 'white'
                      ? `What's on your mind?`
                      : `What's on your mind, ${currentUser?.name?.split(' ')[0] || 'User'}?`
                  }
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  className={`w-full resize-none focus:outline-none bg-transparent ${
                    selectedBg.id !== 'white'
                      ? `${selectedBg.text} text-center text-2xl sm:text-3xl font-bold ${selectedBg.placeholder} leading-snug`
                      : 'text-gray-900 text-lg sm:text-xl placeholder-gray-400 font-normal leading-relaxed'
                  }`}
                  rows={selectedBg.id !== 'white' ? 4 : 5}
                  autoFocus
                />
              </div>

              {/* Rich Text Formatting Toolbar */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-2 flex items-center justify-between overflow-x-auto no-scrollbar shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 px-2 shrink-0">Format:</span>
                <div className="flex items-center space-x-1">
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyFormatting('**')}
                    className="p-2 hover:bg-gray-200/80 active:bg-gray-300 rounded-xl font-bold text-gray-800 transition-colors"
                    title="Bold (**text**)"
                  >
                    <Bold className="w-4 h-4" />
                  </button>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyFormatting('*')}
                    className="p-2 hover:bg-gray-200/80 active:bg-gray-300 rounded-xl text-gray-800 transition-colors"
                    title="Italic (*text*)"
                  >
                    <Italic className="w-4 h-4" />
                  </button>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyFormatting('<u>', '</u>')}
                    className="p-2 hover:bg-gray-200/80 active:bg-gray-300 rounded-xl text-gray-800 transition-colors"
                    title="Underline (<u>text</u>)"
                  >
                    <Underline className="w-4 h-4" />
                  </button>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyFormatting('~~')}
                    className="p-2 hover:bg-gray-200/80 active:bg-gray-300 rounded-xl text-gray-800 transition-colors"
                    title="Strikethrough (~~text~~)"
                  >
                    <Strikethrough className="w-4 h-4" />
                  </button>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyFormatting('> ')}
                    className="p-2 hover:bg-gray-200/80 active:bg-gray-300 rounded-xl text-gray-800 transition-colors"
                    title="Quote (> text)"
                  >
                    <Quote className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Background Colors Bar */}
              <div className="space-y-2 bg-gray-50 border border-gray-200/70 p-3 rounded-2xl">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                    Background Style
                  </span>
                  <span className="text-xs text-blue-600 font-bold">{selectedBg.label}</span>
                </div>
                <div className="flex space-x-2.5 overflow-x-auto no-scrollbar py-1">
                  {BACKGROUND_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setSelectedBg(preset)}
                      className={`w-11 h-11 rounded-2xl shrink-0 transition-all flex items-center justify-center ${preset.bg} ${
                        selectedBg.id === preset.id
                          ? 'ring-4 ring-blue-500 ring-offset-2 scale-105 shadow-md'
                          : 'border border-gray-300/80 hover:scale-105 opacity-90'
                      }`}
                    >
                      {selectedBg.id === preset.id && (
                        <Check className={`w-5 h-5 ${preset.id === 'white' ? 'text-blue-600' : 'text-white'} drop-shadow-sm`} />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom Add Options List */}
              <div className="bg-white border border-gray-200 rounded-3xl p-4 space-y-3 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 px-1">
                  Add to your post
                </span>

                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                />

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center space-x-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-2xl border border-gray-100 transition-all active:scale-95 text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-green-500/10 text-green-600 flex items-center justify-center shrink-0">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">Photo/Video</h4>
                      <p className="text-[10px] text-gray-500">Multiple photos</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setShowMusicModal(true)}
                    className="flex items-center space-x-3 p-3 bg-purple-50/60 hover:bg-purple-100/60 rounded-2xl border border-purple-100 transition-all active:scale-95 text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                      <Music className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-purple-900">Background Music</h4>
                      <p className="text-[10px] text-purple-600">
                        {selectedSong ? 'Change song' : 'Add audio song'}
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => setShowTagModal(true)}
                    className="flex items-center space-x-3 p-3 bg-blue-50/60 hover:bg-blue-100/60 rounded-2xl border border-blue-100 transition-all active:scale-95 text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-blue-900">Mention Friends</h4>
                      <p className="text-[10px] text-blue-600">
                        {taggedUsers.length > 0 ? `${taggedUsers.length} mentioned` : 'Tag @friends'}
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => setShowLocationModal(true)}
                    className="flex items-center space-x-3 p-3 bg-emerald-50/60 hover:bg-emerald-100/60 rounded-2xl border border-emerald-100 transition-all active:scale-95 text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-900">Add Location</h4>
                      <p className="text-[10px] text-emerald-600 truncate max-w-[100px]">
                        {selectedLocation || 'Location check-in'}
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sub-Modals */}
        <MusicLibraryModal
          isOpen={showMusicModal}
          onClose={() => setShowMusicModal(false)}
          onSelectSong={(song) => {
            setSelectedSong(song);
            setShowMusicModal(false);
          }}
          selectedSongId={selectedSong?.id}
        />

        <TagPeopleModal
          isOpen={showTagModal}
          onClose={() => setShowTagModal(false)}
          taggedUsers={taggedUsers}
          onToggleTagUser={handleToggleTagUser}
        />

        <AddLocationModal
          isOpen={showLocationModal}
          onClose={() => setShowLocationModal(false)}
          selectedLocation={selectedLocation}
          onSelectLocation={setSelectedLocation}
        />

        <AdvancedSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          settings={advancedSettings}
          onChangeSettings={setAdvancedSettings}
        />
      </motion.div>
    </AnimatePresence>
  );
};
