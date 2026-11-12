import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Image as ImageIcon,
  Music,
  MapPin,
  UserPlus,
  X,
  Plus,
  Sliders,
  Play,
  Pause,
  Trash2,
  Pipette,
  Palette
} from 'lucide-react';
import { useAppStore } from '../store';
import { createPost } from '../services/postService';
import { Song } from '../types';
import { isMediaVideo } from '../utils';
import { MusicLibraryModal } from '../components/MusicLibraryModal';
import { TagPeopleModal } from '../components/TagPeopleModal';
import { AddLocationModal } from '../components/AddLocationModal';
import { AdvancedSettingsModal, AdvancedSettings } from '../components/AdvancedSettingsModal';

const BIG_TEXT_GRADIENTS = [
  { id: 'none', label: 'Plain', bg: '' },
  { id: 'sky', label: 'Sky Blue', bg: 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500' },
  { id: 'sunset', label: 'Sunset Amber', bg: 'bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600' },
  { id: 'violet', label: 'Royal Violet', bg: 'bg-gradient-to-br from-purple-700 via-indigo-600 to-blue-600' },
  { id: 'cyan', label: 'Neon Cyan', bg: 'bg-gradient-to-r from-cyan-500 via-teal-500 to-blue-600' },
  { id: 'rose', label: 'Berry Rose', bg: 'bg-gradient-to-tr from-rose-600 via-pink-600 to-purple-600' },
  { id: 'ocean', label: 'Deep Ocean', bg: 'bg-gradient-to-tr from-blue-700 via-indigo-800 to-slate-900' },
  { id: 'emerald', label: 'Mint Emerald', bg: 'bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-700' },
  { id: 'fire', label: 'Crimson Flame', bg: 'bg-gradient-to-tr from-red-600 via-orange-500 to-amber-500' },
  { id: 'plum', label: 'Midnight Plum', bg: 'bg-gradient-to-tr from-slate-900 via-purple-950 to-indigo-900' },
  { id: 'lavender', label: 'Lavender Dream', bg: 'bg-gradient-to-tr from-fuchsia-600 via-violet-600 to-indigo-600' },
  { id: 'gold', label: 'Golden Aura', bg: 'bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-600' },
  { id: 'dark', label: 'Pure Black', bg: 'bg-neutral-900' },
  { id: 'cobalt', label: 'Cobalt Blue', bg: 'bg-blue-600' },
];

export default function Create() {
  const { 
    popPage, 
    currentUser, 
    setUploadTask,
    selectedCreateSong, 
    setSelectedCreateSong,
  } = useAppStore();

  const [caption, setCaption] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [selectedBg, setSelectedBg] = useState<string | null>(null);
  const [customColor, setCustomColor] = useState<string>('#2563eb');

  // Accessories
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [taggedUsers, setTaggedUsers] = useState<{ uid: string; name: string; username: string; avatar: string }[]>([]);
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettings>({
    commentsDisabled: false,
    privacy: 'public',
    hideLikes: false,
    allowRemix: true,
    highQuality: true,
    saveToDevice: false,
  });

  // Modals
  const [showMusicModal, setShowMusicModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Audio Playback state for attached song preview
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorPickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedCreateSong) {
      setSelectedSong(selectedCreateSong);
      setSelectedCreateSong(null);
    }
  }, [selectedCreateSong, setSelectedCreateSong]);

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const newFiles: File[] = Array.from(e.target.files);
    const newUrls: string[] = newFiles.map(file => URL.createObjectURL(file));

    setFiles(prev => [...prev, ...newFiles]);
    setPreviewUrls(prev => [...prev, ...newUrls]);
    setSelectedBg(null); // Clear big text background when media files are attached
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const toggleSongPlayback = () => {
    if (!selectedSong?.url) return;
    if (isPlayingAudio) {
      audioPreviewRef.current?.pause();
      setIsPlayingAudio(false);
    } else {
      if (!audioPreviewRef.current) {
        audioPreviewRef.current = new Audio(selectedSong.url);
      } else {
        audioPreviewRef.current.src = selectedSong.url;
      }
      audioPreviewRef.current.play();
      setIsPlayingAudio(true);
      audioPreviewRef.current.onended = () => setIsPlayingAudio(false);
    }
  };

  // Ultra-Fast Optimistic Share Flow
  const handlePublish = () => {
    if (!currentUser) return;
    if (!caption.trim() && files.length === 0) return;

    // Snapshot variables for background job
    const taskId = `task_${Date.now()}`;
    const postCaption = caption.trim();
    const postFiles = [...files];
    const postPreviewUrls = [...previewUrls];
    const postSong = selectedSong;
    const postLocation = location;
    const postTaggedUsers = [...taggedUsers];
    const postSettings = { ...advancedSettings };
    const postBg = postFiles.length === 0 && selectedBg ? selectedBg : undefined;
    const userObj = currentUser;

    // Stop local audio preview
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
    }

    // 1. Immediately initiate upload task indicator
    setUploadTask({
      id: taskId,
      progress: 20,
      title: postCaption.substring(0, 30) || 'Sharing post...',
      type: 'post',
      status: 'uploading'
    });

    // 2. Ultra-Fast: Navigate back immediately so the user doesn't wait!
    popPage();

    // 3. Process in background asynchronously
    (async () => {
      try {
        const isVideoFile = postFiles.length === 1 && postFiles[0].type.startsWith('video');
        const postType = isVideoFile ? 'reel' : 'post';
        await createPost(
          userObj.uid,
          userObj,
          postCaption,
          postFiles,
          postType,
          postSong?.id || undefined,
          {
            location: postLocation || undefined,
            taggedUsers: postTaggedUsers,
            songInfo: postSong || undefined,
            bg: postBg,
            settings: postSettings,
            onProgress: (p) => {
              setUploadTask({
                id: taskId,
                progress: Math.max(20, Math.min(95, p)),
                title: postCaption.substring(0, 30) || 'Uploading...',
                type: 'post',
                status: 'uploading'
              });
            }
          }
        );

        setUploadTask({
          id: taskId,
          progress: 100,
          title: 'Published successfully!',
          type: 'post',
          status: 'completed'
        });

        // Hide task indicator after 2.5 seconds
        setTimeout(() => {
          setUploadTask(null);
        }, 2500);
      } catch (err) {
        console.error('Background post creation failed:', err);
        setUploadTask({
          id: taskId,
          progress: 100,
          title: 'Upload failed. Please retry.',
          type: 'post',
          status: 'error'
        });
        setTimeout(() => {
          setUploadTask(null);
        }, 3500);
      } finally {
        postPreviewUrls.forEach(url => URL.revokeObjectURL(url));
      }
    })();
  };

  const isCustomBg = selectedBg?.startsWith('#') || selectedBg?.startsWith('rgb') || selectedBg?.startsWith('hsl');

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden bg-white dark:bg-black flex flex-col items-center select-none pb-28 pt-2 px-3 sm:px-6 relative">
      
      {/* Unified subtle ambient blue glow fixed at top - Does NOT scroll away! */}
      <div 
        className="pointer-events-none fixed top-0 left-0 right-0 h-[260px] sm:h-[300px] bg-gradient-to-b from-sky-400/[0.14] via-blue-500/[0.05] to-transparent dark:from-blue-600/[0.20] dark:via-blue-800/[0.05] dark:to-transparent z-0" 
        aria-hidden="true" 
      />

      {/* Top Header Bar: Left Arrow • Clean Center Title • Right Text-Only Share Button */}
      <header className="sticky top-0 left-0 right-0 z-40 w-full max-w-[560px] mx-auto bg-transparent border-0 shadow-none px-1 pt-[max(calc(var(--app-safe-top)+6px),10px)] pb-3 flex items-center justify-between">
        {/* Left: Back Button */}
        <button 
          type="button"
          onClick={() => popPage()} 
          className="w-10 h-10 rounded-full bg-white/70 dark:bg-white/10 hover:bg-neutral-100 dark:hover:bg-white/15 backdrop-blur-md flex items-center justify-center text-neutral-800 dark:text-neutral-100 cursor-pointer border-0 shadow-none"
          title="Back"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
        </button>

        {/* Center: Clean Modern Title (No post/story/reel pills) */}
        <div className="flex items-center justify-center">
          <h2 className="text-[17px] sm:text-[18px] font-bold text-neutral-900 dark:text-white tracking-tight">
            New Post
          </h2>
        </div>

        {/* Right: Text-Only Share Button (NO icon, sleek & fast) */}
        <button
          type="button"
          onClick={handlePublish}
          disabled={!caption.trim() && files.length === 0}
          className="px-5 py-2 rounded-full font-bold text-[13.5px] bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white shadow-xs shadow-blue-500/25 transition-all cursor-pointer border-0"
        >
          Share
        </button>
      </header>

      {/* Main Content Area */}
      <div className="w-full max-w-[560px] mx-auto relative z-10 flex flex-col space-y-4">
        
        {/* 1. Author Strip with Privacy & Location Tags */}
        <div className="flex items-center space-x-3 px-2 pt-1">
          <img 
            src={currentUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || 'User')}&background=random`} 
            alt={currentUser?.name || 'User'} 
            className="w-10 h-10 rounded-full object-cover ring-2 ring-white/90 dark:ring-white/10 shadow-xs"
          />
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-[14.5px] text-neutral-900 dark:text-white truncate">
              {currentUser?.name || 'User'}
            </span>
            <div className="flex items-center space-x-1.5 text-[11px] text-neutral-400 dark:text-neutral-500">
              <button
                type="button"
                onClick={() => setShowSettingsModal(true)}
                className="capitalize hover:text-blue-500 cursor-pointer border-0 bg-transparent p-0 text-left"
              >
                {advancedSettings.privacy === 'public' ? 'Public' : advancedSettings.privacy === 'followers' ? 'Friends only' : 'Only me'}
              </button>
              {location && (
                <>
                  <span>•</span>
                  <span className="text-blue-500 truncate max-w-[140px]">{location}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 2. Main Creator Card (Soft blurred container, NO border, NO black glow) */}
        <div className="w-full bg-neutral-100/70 dark:bg-white/[0.04] backdrop-blur-md rounded-[32px] p-4 sm:p-5 shadow-xs border-0 space-y-4">
          
          {/* A. Big Text Mode (When active and no media) */}
          {files.length === 0 && selectedBg ? (
            <div className="w-full px-0.5">
              <div 
                style={isCustomBg ? { background: selectedBg } : undefined}
                className={`w-full min-h-[220px] sm:min-h-[260px] flex items-center justify-center p-7 sm:p-9 text-white rounded-[34px] sm:rounded-[40px] text-center select-text ring-1 ring-black/5 dark:ring-white/10 ${!isCustomBg ? selectedBg : ''}`}
              >
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Type your big text post..."
                  rows={4}
                  className="w-full bg-transparent border-0 text-[20px] sm:text-[23px] font-bold text-white placeholder-white/70 text-center focus:outline-none resize-none leading-relaxed"
                />
              </div>
            </div>
          ) : (
            /* B. Standard Textarea */
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="What's happening? Share thoughts, news, photos or videos..."
              rows={files.length > 0 ? 3 : 5}
              className="w-full bg-transparent border-0 text-[15px] sm:text-[16px] text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none resize-none leading-relaxed"
            />
          )}

          {/* C. Big Text Background Color Selector (when no media files attached) */}
          {files.length === 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                  Card Theme
                </span>
                {selectedBg && (
                  <button
                    type="button"
                    onClick={() => setSelectedBg(null)}
                    className="text-[11px] font-semibold text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer border-0 bg-transparent"
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-3 overflow-x-auto no-scrollbar py-3.5 px-2 min-h-[58px]">
                {/* 1. Custom Color Picker Trigger Button */}
                <div className="relative shrink-0 flex items-center justify-center">
                  <input
                    ref={colorPickerRef}
                    type="color"
                    value={customColor}
                    onChange={(e) => {
                      setCustomColor(e.target.value);
                      setSelectedBg(e.target.value);
                    }}
                    className="absolute inset-0 opacity-0 w-8 h-8 cursor-pointer"
                    title="Pick custom color"
                  />
                  <button
                    type="button"
                    onClick={() => colorPickerRef.current?.click()}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer border-0 shadow-xs ${
                      isCustomBg
                        ? 'scale-110 ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900'
                        : ''
                    }`}
                    style={{ background: 'conic-gradient(from 180deg at 50% 50%, #f43f5e 0deg, #ec4899 60deg, #8b5cf6 120deg, #3b82f6 180deg, #10b981 240deg, #f59e0b 300deg, #f43f5e 360deg)' }}
                    title="Custom color picker"
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-white/90 flex items-center justify-center text-neutral-800">
                      <Plus className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  </button>
                </div>

                {/* 2. Curated Theme Presets */}
                {BIG_TEXT_GRADIENTS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedBg(preset.bg ? preset.bg : null)}
                    className={`w-8 h-8 rounded-full shrink-0 transition-all cursor-pointer border-0 ${
                      preset.bg ? preset.bg : 'bg-neutral-200 dark:bg-white/10 ring-1 ring-black/10'
                    } ${
                      (!isCustomBg && (preset.bg === selectedBg || (!preset.bg && !selectedBg))) 
                        ? 'scale-110 ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900' 
                        : ''
                    }`}
                    title={preset.label}
                  />
                ))}
              </div>
            </div>
          )}

          {/* D. Media Upload / Preview Area */}
          {files.length === 0 ? (
            /* Upload dropzone */
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-7 px-4 rounded-[26px] bg-white/70 dark:bg-white/[0.05] backdrop-blur-md flex flex-col items-center justify-center text-center cursor-pointer hover:bg-white/90 dark:hover:bg-white/[0.08] transition-all border-0 shadow-xs group"
            >
              <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2.5 transition-transform">
                <ImageIcon className="w-6 h-6 stroke-[2]" />
              </div>
              <p className="text-[13.5px] font-bold text-neutral-800 dark:text-neutral-100 mb-0.5">
                Add Photos or Video
              </p>
              <p className="text-[11.5px] text-neutral-400 dark:text-neutral-500">
                Tap to select from device
              </p>
            </div>
          ) : (
            /* Media Previews matching Feed Squircle Shapes */
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                  {files.length} {files.length === 1 ? 'Media file' : 'Media files'}
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center space-x-1 cursor-pointer border-0 bg-transparent"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add more</span>
                </button>
              </div>

              {/* Grid / Single Media Display */}
              <div className={`grid gap-2 ${files.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {previewUrls.map((url, index) => {
                  const file = files[index];
                  const fileType = file?.type || '';
                  const fileName = file?.name || '';
                  const isVideo = fileType.startsWith('video') || isMediaVideo(fileName) || isMediaVideo(url);

                  return (
                    <div 
                      key={index} 
                      className={`relative group rounded-[26px] overflow-hidden bg-neutral-900/10 dark:bg-white/10 ${
                        files.length === 1 ? 'h-[280px] sm:h-[340px]' : 'h-[160px] sm:h-[180px]'
                      }`}
                    >
                      {isVideo ? (
                        <video 
                          src={url} 
                          className="w-full h-full object-cover" 
                          controls={false}
                          playsInline
                          muted 
                        />
                      ) : (
                        <img 
                          src={url} 
                          alt="preview" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.currentTarget;
                            if (file) {
                              const r = new FileReader();
                              r.onload = (evt) => {
                                if (evt.target?.result) target.src = evt.target.result as string;
                              };
                              r.readAsDataURL(file);
                            }
                          }}
                        />
                      )}
                      
                      {/* Delete media button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer border-0 transition-transform"
                        title="Remove file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Attached Audio Preview Pill */}
          {selectedSong && (
            <div className="flex items-center justify-between p-2.5 rounded-[22px] bg-white/70 dark:bg-white/[0.06] backdrop-blur-md">
              <div className="flex items-center space-x-2.5 min-w-0">
                <button
                  type="button"
                  onClick={toggleSongPlayback}
                  className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 cursor-pointer border-0"
                >
                  {isPlayingAudio ? (
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  )}
                </button>
                <div className="flex flex-col min-w-0">
                  <span className="text-[12.5px] font-bold text-neutral-900 dark:text-white truncate">
                    {selectedSong.title}
                  </span>
                  <span className="text-[10.5px] text-neutral-400 dark:text-neutral-500 truncate">
                    {selectedSong.artist}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (audioPreviewRef.current) audioPreviewRef.current.pause();
                  setSelectedSong(null);
                  setIsPlayingAudio(false);
                }}
                className="p-1.5 text-neutral-400 hover:text-rose-500 cursor-pointer border-0 bg-transparent"
                title="Remove music"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Tagged People Chips */}
          {taggedUsers.length > 0 && (
            <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-1">
              <span className="text-[11px] text-neutral-400 shrink-0">With:</span>
              {taggedUsers.map((u) => (
                <div 
                  key={u.uid} 
                  className="flex items-center space-x-1 pl-1.5 pr-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold shrink-0"
                >
                  <span>{u.name}</span>
                  <button 
                    type="button"
                    onClick={() => setTaggedUsers(prev => prev.filter(t => t.uid !== u.uid))}
                    className="p-0.5 hover:text-blue-800 cursor-pointer border-0 bg-transparent"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Quick Accessory Pills (Clean Frosted Glass Buttons, NO hard borders) */}
        <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-1 px-1">
          {/* Music Button */}
          <button
            type="button"
            onClick={() => setShowMusicModal(true)}
            className={`px-3.5 py-2 rounded-full text-xs font-bold flex items-center space-x-1.5 shrink-0 transition-all cursor-pointer border-0 ${
              selectedSong 
                ? 'bg-blue-600 text-white' 
                : 'bg-neutral-100/80 dark:bg-white/[0.05] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/80 dark:hover:bg-white/[0.08]'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>{selectedSong ? 'Audio Added' : 'Add Music'}</span>
          </button>

          {/* Location Button */}
          <button
            type="button"
            onClick={() => setShowLocationModal(true)}
            className={`px-3.5 py-2 rounded-full text-xs font-bold flex items-center space-x-1.5 shrink-0 transition-all cursor-pointer border-0 ${
              location 
                ? 'bg-blue-600 text-white' 
                : 'bg-neutral-100/80 dark:bg-white/[0.05] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/80 dark:hover:bg-white/[0.08]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span className="truncate max-w-[120px]">{location || 'Location'}</span>
          </button>

          {/* Tag People Button */}
          <button
            type="button"
            onClick={() => setShowTagModal(true)}
            className={`px-3.5 py-2 rounded-full text-xs font-bold flex items-center space-x-1.5 shrink-0 transition-all cursor-pointer border-0 ${
              taggedUsers.length > 0 
                ? 'bg-blue-600 text-white' 
                : 'bg-neutral-100/80 dark:bg-white/[0.05] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/80 dark:hover:bg-white/[0.08]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{taggedUsers.length > 0 ? `${taggedUsers.length} Tagged` : 'Tag People'}</span>
          </button>

          {/* Content Settings Button */}
          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="px-3.5 py-2 rounded-full text-xs font-bold flex items-center space-x-1.5 shrink-0 transition-all cursor-pointer border-0 bg-neutral-100/80 dark:bg-white/[0.05] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/80 dark:hover:bg-white/[0.08]"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </div>

      </div>

      {/* Modals with Clean Feed Style */}
      <MusicLibraryModal
        isOpen={showMusicModal}
        onClose={() => setShowMusicModal(false)}
        selectedSongId={selectedSong?.id}
        onSelectSong={(song) => setSelectedSong(song)}
      />

      <AddLocationModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        selectedLocation={location}
        onSelectLocation={(loc) => setLocation(loc)}
      />

      <TagPeopleModal
        isOpen={showTagModal}
        onClose={() => setShowTagModal(false)}
        taggedUsers={taggedUsers}
        onToggleTagUser={(u) => {
          setTaggedUsers(prev => {
            const exists = prev.some(item => item.uid === u.uid);
            if (exists) return prev.filter(item => item.uid !== u.uid);
            return [...prev, u];
          });
        }}
      />

      <AdvancedSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={advancedSettings}
        onChangeSettings={(s) => setAdvancedSettings(s)}
        selectedFiles={files}
        user={currentUser ? { uid: currentUser.uid, name: currentUser.name, avatar: currentUser.avatar } : undefined}
      />

    </div>
  );
}
