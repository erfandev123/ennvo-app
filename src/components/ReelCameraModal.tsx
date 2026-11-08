import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  SwitchCamera, 
  Zap, 
  ZapOff, 
  Music, 
  Image as ImageIcon, 
  RotateCcw, 
  RotateCw,
  Play, 
  Pause, 
  Send,
  Loader2,
  Sparkles,
  Sliders,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  MapPin,
  UserPlus,
  Settings2,
  Trash2,
  ArrowLeft,
  Film,
  Crop,
  Check,
  RefreshCw,
  Maximize2
} from 'lucide-react';
import { useAppStore } from '../store';
import { createPost } from '../services/postService';
import { uploadStory } from '../services/storyService';
import { MusicLibraryModal } from './MusicLibraryModal';
import { AddLocationModal } from './AddLocationModal';
import { TagPeopleModal } from './TagPeopleModal';
import { AdvancedSettingsModal, AdvancedSettings } from './AdvancedSettingsModal';
import { Song } from '../types';
import { generateVideoThumbnail } from '../utils';

// Aspect Ratio Options
type AspectRatioType = '9:16' | '1:1' | '16:9' | 'original';

export const ReelCameraModal: React.FC = () => {
  const { 
    showReelCamera, 
    setShowReelCamera, 
    currentUser, 
    setUploadTask,
    selectedCreateMode,
    setSelectedCreateMode 
  } = useAppStore();

  // Workflow Stages: 'camera' -> 'preview' -> 'details'
  const [stage, setStage] = useState<'camera' | 'preview' | 'details'>('camera');
  
  // Creation Mode: 'story' | 'reel' | 'post'
  const [mode, setMode] = useState<'story' | 'reel' | 'post'>('reel');

  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 768;
  });

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (selectedCreateMode) {
      setMode(selectedCreateMode);
    }
  }, [selectedCreateMode]);

  // Aspect Ratio Selection in Preview: default '9:16' (Full Screen)
  const [aspectRatio, setAspectRatio] = useState<AspectRatioType>('9:16');
  const [showSizeMenu, setShowSizeMenu] = useState(false);

  // Quick Photo/Video Editing Tools State
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [brightness, setBrightness] = useState(0); // -50 to +50
  const [contrast, setContrast] = useState(0);     // -50 to +50
  const [saturation, setSaturation] = useState(0);   // -50 to +50
  const [rotation, setRotation] = useState(0);       // 0, 90, 180, 270

  // Camera Settings
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [torchOn, setTorchOn] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);

  // Coming Soon Toast for Filters
  const [filterToast, setFilterToast] = useState<string | null>(null);

  // Captured / Selected Media State
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isVideo, setIsVideo] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);

  // Video Cover Custom Scrubber
  const [videoCoverUrl, setVideoCoverUrl] = useState<string | null>(null);
  const [coverScrubTime, setCoverScrubTime] = useState<number>(0.5);

  // Post & Story Details State
  const [caption, setCaption] = useState('');
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

  // Secondary Modals
  const [showMusicModal, setShowMusicModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // In-Modal Uploading State for Smooth Visual Feedback
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState(25);
  const [publishStatusText, setPublishStatusText] = useState('Publishing...');

  // Touch Swipe for multi-photo carousel
  const touchStartXRef = useRef<number>(0);
  const touchEndXRef = useRef<number>(0);

  // References
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const coverExtractorVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const coverImageInputRef = useRef<HTMLInputElement>(null);

  // Sync initial mode with store's selectedCreateMode when opened
  useEffect(() => {
    if (showReelCamera) {
      if (selectedCreateMode) {
        setMode(selectedCreateMode);
      } else {
        setMode('reel');
      }
      setAspectRatio('9:16');
      setShowSizeMenu(false);
      setShowEditDrawer(false);
      resetEditFilters();
    }
  }, [showReelCamera, selectedCreateMode]);

  const resetEditFilters = () => {
    setBrightness(0);
    setContrast(0);
    setSaturation(0);
    setRotation(0);
  };

  // Clean teardown for camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try { track.stop(); } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Smooth Lag-Free HD Camera Boot (Mobile Only - Never on PC)
  const startCamera = useCallback(async () => {
    if (isDesktop) return; // Never spin up camera hardware on PC
    stopCamera();
    try {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: isMuted ? false : { echoCancellation: true, noiseSuppression: true },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 854, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: isMuted ? false : true,
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn('Camera stream initialisation notice:', err);
    }
  }, [facingMode, isMuted, stopCamera, isDesktop]);

  useEffect(() => {
    if (showReelCamera && stage === 'camera' && !isDesktop) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [showReelCamera, stage, startCamera, stopCamera, isDesktop]);

  // Flip Camera
  const handleFlipCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Toggle Torch/Flashlight
  const handleToggleTorch = async () => {
    if (!streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack && 'applyConstraints' in videoTrack) {
      try {
        const capabilities: any = (videoTrack as any).getCapabilities ? (videoTrack as any).getCapabilities() : {};
        if (capabilities.torch) {
          const next = !torchOn;
          await (videoTrack as any).applyConstraints({
            advanced: [{ torch: next }],
          });
          setTorchOn(next);
        } else {
          setTorchOn((prev) => !prev);
        }
      } catch {
        setTorchOn((prev) => !prev);
      }
    } else {
      setTorchOn((prev) => !prev);
    }
  };

  // Trigger Filter Toast (Clean Real Filter Coming Soon)
  const handleFilterClick = () => {
    setFilterToast('✨ AI Filters & AR Effects coming soon in next update!');
    setTimeout(() => {
      setFilterToast(null);
    }, 2400);
  };

  // Video Recording Logic
  const startRecording = () => {
    if (!streamRef.current || isRecording) return;
    chunksRef.current = [];

    try {
      let mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : '';
      }

      const recorder = mimeType 
        ? new MediaRecorder(streamRef.current, { mimeType }) 
        : new MediaRecorder(streamRef.current);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const type = recorder.mimeType || 'video/mp4';
        const blob = new Blob(chunksRef.current, { type });
        const file = new File([blob], `${mode}_${Date.now()}.mp4`, { type });
        const url = URL.createObjectURL(blob);

        setMediaFiles([file]);
        setPreviewUrls([url]);
        setActivePhotoIndex(0);
        setIsVideo(true);
        setStage('preview');
        stopCamera();

        // Generate lightweight initial video cover
        generateVideoThumbnail(file)
          .then((thumb) => setVideoCoverUrl(thumb))
          .catch(() => {});
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordDuration(0);

      const maxLimit = mode === 'story' ? 30 : 60; // 30s max for story, 60s for reel
      timerRef.current = setInterval(() => {
        setRecordDuration((prev) => {
          if (prev >= maxLimit) {
            stopRecording();
            return maxLimit;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    setIsRecording(false);
  };

  // File & Media selection handler (both drag-and-drop and file input)
  const handleDropFiles = (files: FileList | File[]) => {
    const filesArray = Array.from(files);
    if (filesArray.length === 0) return;
    const firstFile = filesArray[0];
    const isVid = firstFile.type.startsWith('video');

    if (isVid) {
      // Single video
      const url = URL.createObjectURL(firstFile);
      setMediaFiles([firstFile]);
      setPreviewUrls([url]);
      setActivePhotoIndex(0);
      setIsVideo(true);
      setStage('preview');
      stopCamera();

      generateVideoThumbnail(firstFile)
        .then((thumb) => setVideoCoverUrl(thumb))
        .catch(() => {});
    } else {
      // Multiple or single photos
      const photoFiles = filesArray.filter((f) => f.type.startsWith('image'));
      const urls = photoFiles.map((f) => URL.createObjectURL(f));
      setMediaFiles(photoFiles);
      setPreviewUrls(urls);
      setActivePhotoIndex(0);
      setIsVideo(false);
      setStage('preview');
      stopCamera();
    }
  };

  // Gallery Picker (Photos and Videos, supports multiple photos)
  const handleSelectFromGallery = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleDropFiles(e.target.files);
    }
    e.target.value = '';
  };

  // Video Cover Custom Scrubber Seek
  const handleCoverScrub = (time: number) => {
    setCoverScrubTime(time);
    if (!coverExtractorVideoRef.current) return;
    coverExtractorVideoRef.current.currentTime = time;
  };

  const handleCoverSeeked = () => {
    if (!coverExtractorVideoRef.current) return;
    const v = coverExtractorVideoRef.current;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 360;
      canvas.height = 640;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.68);
        setVideoCoverUrl(dataUrl);
      }
    } catch (e) {
      console.warn('Cover frame capture warning:', e);
    }
  };

  // Custom Cover Image Upload from Disk
  const handleSelectCustomCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVideoCoverUrl(url);
    e.target.value = '';
  };

  // Multi-Photo Carousel Touch Gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const deltaX = touchStartXRef.current - touchEndXRef.current;
    if (Math.abs(deltaX) > 40) {
      if (deltaX > 0 && activePhotoIndex < previewUrls.length - 1) {
        setActivePhotoIndex(prev => prev + 1);
      } else if (deltaX < 0 && activePhotoIndex > 0) {
        setActivePhotoIndex(prev => prev - 1);
      }
    }
  };

  // Remove Photo from Multi-selection
  const handleRemovePhoto = (index: number) => {
    if (previewUrls.length <= 1) {
      handleRetake();
      return;
    }
    URL.revokeObjectURL(previewUrls[index]);
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
    setActivePhotoIndex(prev => Math.max(0, Math.min(prev, previewUrls.length - 2)));
  };

  // Discard & Retake
  const handleRetake = () => {
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setPreviewUrls([]);
    setMediaFiles([]);
    setVideoCoverUrl(null);
    setRecordDuration(0);
    setIsRecording(false);
    setStage('camera');
    setActivePhotoIndex(0);
    setShowSizeMenu(false);
    setShowEditDrawer(false);
    resetEditFilters();
  };

  // Full Dismissal & Cleanup
  const handleClose = () => {
    stopCamera();
    if (timerRef.current) clearInterval(timerRef.current);
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setPreviewUrls([]);
    setMediaFiles([]);
    setCaption('');
    setSelectedSong(null);
    setLocation(null);
    setTaggedUsers([]);
    setIsRecording(false);
    setRecordDuration(0);
    setStage('camera');
    setShowSizeMenu(false);
    setShowEditDrawer(false);
    setIsPublishing(false);
    resetEditFilters();
    setShowReelCamera(false);
  };

  // Super Fast Optimistic Share (Instant 0ms Dismissal + Progressive Reliable Background Upload)
  const handleShare = () => {
    if (!currentUser || mediaFiles.length === 0) return;

    const taskId = `${mode}_${Date.now()}`;
    const targetMode = mode;
    const finalFiles = [...mediaFiles];
    const finalCaption = caption.trim() || (targetMode === 'story' ? 'My Story' : 'New Post');
    const finalSong = selectedSong;
    const finalLocation = location;
    const finalTagged = taggedUsers;
    const finalSettings = advancedSettings;
    const finalThumbnailUrl = videoCoverUrl;
    const finalAspectRatio = aspectRatio;
    const user = currentUser;

    // Show stylish in-modal upload feedback briefly, then smooth auto-close
    setIsPublishing(true);
    setPublishProgress(30);
    setPublishStatusText('Optimizing media...');

    // 1. Instantly register upload task in store
    setUploadTask({
      id: taskId,
      progress: 30,
      title: finalCaption.substring(0, 30),
      type: targetMode === 'story' ? 'story' : 'reel',
      status: 'uploading',
    });

    // 2. Smooth transition: after short visual feedback, close modal so user is not blocked
    setTimeout(() => {
      handleClose();
    }, 450);

    // 3. Asynchronously execute upload in background
    (async () => {
      try {
        if (targetMode === 'story') {
          // Real story upload to Firestore 'stories' collection (24-hour expiry)
          const primaryFile = finalFiles[0];
          await uploadStory(
            user.uid,
            user.name,
            user.avatar,
            primaryFile,
            finalCaption,
            'home',
            finalSong?.id,
            finalSong ? {
              title: finalSong.title,
              artist: finalSong.artist,
              thumbnail: finalSong.thumbnail,
              url: finalSong.url
            } : undefined
          );
        } else {
          // Real reel or post upload to Firestore 'posts' collection
          await createPost(
            user.uid,
            user,
            finalCaption,
            finalFiles,
            targetMode === 'reel' ? 'reel' : 'post',
            finalSong?.id,
            {
              location: finalLocation,
              taggedUsers: finalTagged,
              settings: finalSettings,
              songInfo: finalSong || undefined,
              aspectRatioFit: finalAspectRatio,
              thumbnailUrl: finalThumbnailUrl,
              onProgress: (p) => {
                setUploadTask({
                  id: taskId,
                  progress: Math.max(30, Math.min(95, p)),
                  title: finalCaption.substring(0, 30),
                  type: targetMode === 'story' ? 'story' : 'reel',
                  status: 'uploading',
                });
              },
            }
          );
        }

        // Complete notification
        setUploadTask({
          id: taskId,
          progress: 100,
          title: targetMode === 'story' ? 'Story published!' : `${targetMode === 'reel' ? 'Reel' : 'Post'} published!`,
          type: targetMode === 'story' ? 'story' : 'reel',
          status: 'completed',
        });

        setTimeout(() => {
          setUploadTask(null);
        }, 2500);
      } catch (err) {
        console.error('Background upload error:', err);
        setUploadTask({
          id: taskId,
          progress: 100,
          title: 'Upload failed. Please retry.',
          type: targetMode === 'story' ? 'story' : 'reel',
          status: 'error',
        });
        setTimeout(() => {
          setUploadTask(null);
        }, 3500);
      }
    })();
  };

  if (!showReelCamera) return null;

  const maxRecordLimit = mode === 'story' ? 30 : 60;
  const progressRatio = Math.min(1, recordDuration / maxRecordLimit);

  // Dynamic Media Filter & Transform Style
  const mediaFilterStyle = `brightness(${1 + brightness / 100}) contrast(${1 + contrast / 100}) saturate(${1 + saturation / 100})`;
  const mediaTransformStyle = `rotate(${rotation}deg)`;

  // Frame container class based on selected Aspect Ratio (Full Screen presence vs Aspect Box)
  const getPreviewFrameClasses = () => {
    switch (aspectRatio) {
      case '9:16':
        // Full screen edge-to-edge presentation
        return 'w-full h-full object-cover';
      case '1:1':
        // True sharp 1:1 square with NO rounded corners - authentic real video
        return 'w-full max-w-[min(100vw,calc(100vh-180px))] aspect-square object-cover rounded-none shadow-none';
      case '16:9':
        // True sharp landscape presentation with NO rounded corners
        return 'w-full max-w-[100vw] aspect-video object-cover rounded-none shadow-none';
      case 'original':
      default:
        // Natural fit
        return 'max-w-full max-h-full object-contain';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[1000] bg-black text-white flex flex-col select-none overflow-hidden font-sans"
      >
        {/* Soft Ambient Cyan/Blue Glow extending through the entire top area */}
        <div 
          className="pointer-events-none fixed top-0 left-0 right-0 h-[240px] bg-gradient-to-b from-sky-400/[0.22] via-blue-500/[0.08] to-transparent z-10" 
          aria-hidden="true" 
        />

        {/* Global Toast for Filters Coming Soon */}
        <AnimatePresence>
          {filterToast && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-black/85 backdrop-blur-xl border border-white/20 text-white text-xs font-semibold shadow-2xl pointer-events-none flex items-center space-x-2"
            >
              <span>{filterToast}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ========================================================================= */}
        {/* STAGE 1: LIVE CAMERA VIEWPORT & CLEAN RECORDING CONTROLS                  */}
        {/* ========================================================================= */}
        {stage === 'camera' && isDesktop ? (
          <div className="relative flex-1 w-full h-full bg-neutral-950 flex flex-col justify-between p-6 sm:p-8 overflow-hidden select-none">
            {/* Desktop Top Header Bar */}
            <div className="relative z-20 w-full max-w-4xl mx-auto flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center shadow-md">
                  <Film className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">Upload {mode === 'story' ? 'Story' : mode === 'reel' ? 'Reel' : 'Post'}</h2>
                  <p className="text-xs text-white/50">Select video or photos directly from your computer</p>
                </div>
              </div>

              {/* Mode Switcher Tabs */}
              <div className="flex items-center bg-white/10 p-1 rounded-full border border-white/10">
                {(['reel', 'story', 'post'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMode(m);
                      setSelectedCreateMode(m);
                    }}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-all cursor-pointer ${
                      mode === m
                        ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-sm'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {/* Close button */}
              <button
                type="button"
                onClick={handleClose}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Desktop Center Dropzone */}
            <div className="flex-1 flex items-center justify-center p-6">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const droppedFiles = e.dataTransfer.files;
                  if (droppedFiles && droppedFiles.length > 0) {
                    handleDropFiles(droppedFiles);
                  }
                }}
                onClick={() => galleryInputRef.current?.click()}
                className="w-full max-w-xl p-10 rounded-[32px] bg-white/[0.04] hover:bg-white/[0.07] border-2 border-dashed border-white/20 hover:border-sky-400/80 transition-all cursor-pointer flex flex-col items-center justify-center text-center group shadow-2xl relative overflow-hidden"
              >
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-sky-500/20 via-blue-600/20 to-indigo-600/20 text-sky-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-inner">
                  <Film className="w-10 h-10 stroke-[1.8]" />
                </div>

                <h3 className="text-xl font-bold text-white mb-2 tracking-tight">
                  Select video or photos to upload
                </h3>
                <p className="text-sm text-white/50 max-w-md mb-6 leading-relaxed">
                  Drag and drop your {mode === 'story' ? 'story' : mode === 'reel' ? 'reel' : 'post'} file here, or click to browse files from your computer.
                </p>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    galleryInputRef.current?.click();
                  }}
                  className="px-8 py-3.5 rounded-full bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-sky-500/25 active:scale-95 transition-all flex items-center space-x-2.5 cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Select from Computer</span>
                </button>

                <div className="mt-8 flex items-center space-x-4 text-[11px] text-white/40">
                  <span>MP4, WebM, MOV, JPG, PNG</span>
                  <span>•</span>
                  <span>Up to 4K Ultra HD</span>
                  <span>•</span>
                  <span>No Camera Required</span>
                </div>
              </div>
            </div>
          </div>
        ) : stage === 'camera' ? (
          <div className="relative flex-1 w-full h-full bg-neutral-950 flex flex-col justify-between overflow-hidden">
            {/* Live Camera Feed */}
            <div className="absolute inset-0 w-full h-full overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-transform ${
                  facingMode === 'user' ? 'scale-x-[-1]' : ''
                }`}
              />
            </div>

            {/* Top Bar: Close (Left) & Add Sound with Cancel button (Center) */}
            <div className="relative z-20 px-4 pt-[max(calc(env(safe-area-inset-top,0px)+12px),16px)] pb-3 flex items-center justify-between">
              {/* Left: Close Button */}
              <button
                type="button"
                onClick={handleClose}
                className="w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer border-0 shadow-md"
                title="Close studio"
              >
                <X className="w-5 h-5 stroke-[2.4]" />
              </button>

              {/* Center: Soft Glass "Add Sound / Music" Button with Cancel (X) button */}
              <div className="relative flex items-center">
                <button
                  type="button"
                  onClick={() => setShowMusicModal(true)}
                  className="px-3.5 py-1.5 rounded-full bg-black/45 hover:bg-black/65 backdrop-blur-md text-white text-xs font-semibold flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer border border-white/10 shadow-md max-w-[210px]"
                >
                  <Music className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate">{selectedSong ? selectedSong.title : 'Add Sound'}</span>
                  {selectedSong && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSong(null);
                      }}
                      className="ml-1 p-0.5 rounded-full hover:bg-white/20 text-white/70 hover:text-white transition-colors cursor-pointer"
                      title="Cancel sound"
                    >
                      <X className="w-3 h-3 stroke-[2.5]" />
                    </span>
                  )}
                </button>
              </div>

              {/* Spacer for 3-column balance */}
              <div className="w-10 h-10" />
            </div>

            {/* Right Tool Rail: Flashlight, Flip Camera, Effects/Filters (Coming Soon), Mic/Sound */}
            <div className="absolute right-4 top-[max(calc(env(safe-area-inset-top,0px)+74px),78px)] z-20 flex flex-col items-center space-y-3.5">
              {/* 1. Flashlight Button */}
              <button
                type="button"
                onClick={handleToggleTorch}
                className={`w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center transition-all active:scale-90 cursor-pointer border border-white/10 shadow-md ${
                  torchOn ? 'bg-amber-400 text-black' : 'bg-black/45 text-white hover:bg-black/65'
                }`}
                title="Toggle Flashlight"
              >
                {torchOn ? <Zap className="w-4.5 h-4.5 fill-current" /> : <ZapOff className="w-4.5 h-4.5" />}
              </button>

              {/* 2. Camera Back/Front Flip Button */}
              <button
                type="button"
                onClick={handleFlipCamera}
                className="w-10 h-10 rounded-full bg-black/45 hover:bg-black/65 backdrop-blur-md text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer border border-white/10 shadow-md"
                title="Flip Camera"
              >
                <SwitchCamera className="w-4.5 h-4.5" />
              </button>

              {/* 3. Filters / Effects Button -> Clean Toast: "Coming Soon" */}
              <button
                type="button"
                onClick={handleFilterClick}
                className="w-10 h-10 rounded-full bg-black/45 hover:bg-black/65 backdrop-blur-md text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer border border-white/10 shadow-md"
                title="Filters (Coming Soon)"
              >
                <Sparkles className="w-4.5 h-4.5 text-purple-300" />
              </button>

              {/* 4. Mic / Audio Toggle Button */}
              <button
                type="button"
                onClick={() => setIsMuted(prev => !prev)}
                className={`w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center transition-all active:scale-90 cursor-pointer border border-white/10 shadow-md ${
                  isMuted ? 'bg-rose-600/80 text-white' : 'bg-black/45 text-white hover:bg-black/65'
                }`}
                title={isMuted ? 'Mic Muted' : 'Mic Active'}
              >
                {isMuted ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5" />}
              </button>
            </div>

            {/* Live Recording Timer Pill */}
            {isRecording && (
              <div className="absolute top-18 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1 rounded-full bg-rose-600/95 text-white text-xs font-bold flex items-center space-x-2 shadow-lg animate-pulse">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span>00:{recordDuration.toString().padStart(2, '0')} / 00:{maxRecordLimit}</span>
              </div>
            )}

            {/* Bottom Controls Area: Record Button (Center) & Gallery (Left), followed by Clean Mode Text Below */}
            <div className="relative z-20 px-6 pb-[max(calc(env(safe-area-inset-bottom,0px)+18px),24px)] pt-6 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex flex-col items-center space-y-4">
              
              {/* Main Shutter & Gallery Row */}
              <div className="w-full flex items-center justify-between px-4">
                {/* 1. Gallery Media Picker Button (Left) */}
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="w-12 h-12 rounded-[20px] bg-white/15 hover:bg-white/25 backdrop-blur-md flex flex-col items-center justify-center text-white transition-all active:scale-90 cursor-pointer border border-white/20 shadow-md group"
                  title="Choose from gallery"
                >
                  <ImageIcon className="w-6 h-6 stroke-[2]" />
                </button>

                {/* 2. Main Shutter / Video Record Button with Rotating Circular Progress Ring (Center) */}
                <div className="relative w-22 h-22 flex items-center justify-center">
                  {/* Outer SVG Circular Progress Ring */}
                  <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 88 88">
                    <circle
                      cx="44"
                      cy="44"
                      r="40"
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.22)"
                      strokeWidth="3.5"
                    />
                    <circle
                      cx="44"
                      cy="44"
                      r="40"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="4.5"
                      strokeDasharray={2 * Math.PI * 40}
                      strokeDashoffset={2 * Math.PI * 40 * (1 - (isRecording ? progressRatio : 0))}
                      strokeLinecap="round"
                      className="transition-all duration-300"
                    />
                  </svg>

                  {/* Center Shutter Button */}
                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    className="relative z-10 w-17 h-17 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer border-0 shadow-xl"
                    title={isRecording ? 'Stop Recording' : 'Record'}
                  >
                    <div
                      className={`transition-all duration-300 ${
                        isRecording
                          ? 'w-7 h-7 rounded-lg bg-red-600 animate-pulse shadow-md shadow-red-500/50'
                          : 'w-15 h-15 rounded-full bg-white hover:scale-105 shadow-md shadow-white/20'
                      }`}
                    />
                  </button>
                </div>

                {/* 3. Empty spacer on right for clean balance */}
                <div className="w-12 h-12" />
              </div>

              {/* Clean Text Mode Selector BELOW the Record Button (Clean Typography, NO background box) */}
              <div className="flex items-center space-x-7 pt-1">
                {(['story', 'reel', 'post'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMode(m);
                      setSelectedCreateMode(m);
                    }}
                    className={`transition-all cursor-pointer capitalize font-sans tracking-wide ${
                      mode === m
                        ? 'text-white font-extrabold text-sm scale-110 drop-shadow-[0_0_10px_rgba(255,255,255,0.85)]'
                        : 'text-white/45 font-semibold text-xs hover:text-white/75'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* ========================================================================= */}
        {/* STAGE 2: FULL-SCREEN PREVIEW WITH SIDE SIZE SELECTOR & EDIT OPTIONS       */}
        {/* ========================================================================= */}
        {stage === 'preview' && (
          <div className="relative flex-1 w-full h-full bg-black flex flex-col justify-between overflow-hidden">
            
            {/* Edge-to-Edge Media Viewport Container */}
            <div 
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden bg-black"
            >
              {isVideo ? (
                /* Video Preview */
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                  <video
                    ref={previewVideoRef}
                    src={previewUrls[0]}
                    autoPlay
                    loop
                    playsInline
                    muted={isMuted}
                    style={{ 
                      filter: mediaFilterStyle, 
                      transform: mediaTransformStyle 
                    }}
                    className={`${getPreviewFrameClasses()} transition-all duration-300`}
                  />

                  {/* Mode Badge in Top-Left Corner */}
                  <div className="absolute top-[max(calc(env(safe-area-inset-top,0px)+74px),78px)] left-4 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-white border border-white/10 shadow-sm z-10 pointer-events-none">
                    {mode} • {aspectRatio}
                  </div>
                </div>
              ) : (
                /* Multi-Photo / Single-Photo Swipe Carousel with Lag-Free Smooth Sliding */
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                  <div
                    className="flex h-full w-full transition-transform duration-250 ease-out will-change-transform"
                    style={{ transform: `translateX(-${activePhotoIndex * 100}%)` }}
                  >
                    {previewUrls.map((url, idx) => (
                      <div
                        key={idx}
                        className="w-full h-full shrink-0 flex items-center justify-center overflow-hidden"
                      >
                        <img
                          src={url}
                          alt={`Photo ${idx + 1}`}
                          style={{ 
                            filter: mediaFilterStyle, 
                            transform: mediaTransformStyle 
                          }}
                          className={`${getPreviewFrameClasses()} select-none pointer-events-none`}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Delete Current Photo (if multi-photo) */}
                  {previewUrls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(activePhotoIndex)}
                      className="absolute top-[max(calc(env(safe-area-inset-top,0px)+74px),78px)] left-4 w-8 h-8 rounded-full bg-black/60 hover:bg-rose-600/80 backdrop-blur-md text-white flex items-center justify-center transition-all cursor-pointer border border-white/10 shadow-md z-10"
                      title="Remove this photo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  {/* Left / Right Nav Arrows for fast swiping */}
                  {previewUrls.length > 1 && (
                    <>
                      {activePhotoIndex > 0 && (
                        <button
                          type="button"
                          onClick={() => setActivePhotoIndex(prev => prev - 1)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/55 hover:bg-black/80 backdrop-blur-md text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer border border-white/10 shadow-md z-20"
                          title="Previous photo"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                      )}
                      {activePhotoIndex < previewUrls.length - 1 && (
                        <button
                          type="button"
                          onClick={() => setActivePhotoIndex(prev => prev + 1)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/55 hover:bg-black/80 backdrop-blur-md text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer border border-white/10 shadow-md z-20"
                          title="Next photo"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      )}
                    </>
                  )}

                  {/* Bottom Multi-Photo Pagination Dots & Counter */}
                  {previewUrls.length > 1 && (
                    <div className="absolute bottom-[max(calc(env(safe-area-inset-bottom,0px)+78px),86px)] left-1/2 -translate-x-1/2 flex flex-col items-center space-y-1.5 z-20 pointer-events-none">
                      <div className="px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold text-white border border-white/15">
                        {activePhotoIndex + 1} / {previewUrls.length}
                      </div>
                      <div className="flex items-center space-x-1.5">
                        {previewUrls.map((_, i) => (
                          <div
                            key={i}
                            className={`h-1.5 rounded-full transition-all duration-200 ${
                              i === activePhotoIndex ? 'w-4 bg-white shadow-xs' : 'w-1.5 bg-white/40'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Top Bar Controls Overlay */}
            <div className="relative z-30 px-4 pt-[max(calc(env(safe-area-inset-top,0px)+12px),16px)] pb-2 flex items-center justify-between">
              {/* Retake Button */}
              <button
                type="button"
                onClick={handleRetake}
                className="w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer border border-white/10 shadow-md"
                title="Retake"
              >
                <RotateCcw className="w-4.5 h-4.5 stroke-[2.2]" />
              </button>

              {/* Add Sound Pill with Cancel button */}
              <div className="relative flex items-center">
                <button
                  type="button"
                  onClick={() => setShowMusicModal(true)}
                  className="px-3.5 py-1.5 rounded-full bg-black/45 hover:bg-black/65 backdrop-blur-md text-white text-xs font-semibold flex items-center space-x-1.5 transition-all active:scale-95 cursor-pointer border border-white/10 shadow-md max-w-[200px]"
                >
                  <Music className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate">{selectedSong ? selectedSong.title : 'Add Sound'}</span>
                  {selectedSong && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSong(null);
                      }}
                      className="ml-1 p-0.5 rounded-full hover:bg-white/20 text-white/70 hover:text-white transition-colors cursor-pointer"
                      title="Cancel sound"
                    >
                      <X className="w-3 h-3 stroke-[2.5]" />
                    </span>
                  )}
                </button>
              </div>

              {/* Top-Right Tools: Edit Button & Sound Toggle */}
              <div className="flex items-center space-x-2">
                {/* Edit Button (Adjustments: Brightness, Contrast, Saturation, Rotate) */}
                <button
                  type="button"
                  onClick={() => setShowEditDrawer(prev => !prev)}
                  className={`w-10 h-10 rounded-full backdrop-blur-md text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer border border-white/10 shadow-md ${
                    showEditDrawer || brightness !== 0 || contrast !== 0 || saturation !== 0 || rotation !== 0
                      ? 'bg-blue-600 text-white'
                      : 'bg-black/40 hover:bg-black/60'
                  }`}
                  title="Edit photo/video adjustments"
                >
                  <Sliders className="w-4.5 h-4.5" />
                </button>

                {/* Sound Toggle (if video) */}
                {isVideo && (
                  <button
                    type="button"
                    onClick={() => setIsMuted(prev => !prev)}
                    className="w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer border border-white/10 shadow-md"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX className="w-4.5 h-4.5 text-rose-400" /> : <Volume2 className="w-4.5 h-4.5 text-white" />}
                  </button>
                )}
              </div>
            </div>

            {/* Right Side Floating Size / Aspect Ratio Selector Button */}
            <div className="absolute right-4 top-[max(calc(env(safe-area-inset-top,0px)+74px),78px)] z-30 flex flex-col items-end">
              <button
                type="button"
                onClick={() => setShowSizeMenu(prev => !prev)}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-full backdrop-blur-md border border-white/15 text-xs font-bold transition-all shadow-lg active:scale-95 cursor-pointer ${
                  showSizeMenu ? 'bg-blue-600 text-white' : 'bg-black/50 hover:bg-black/70 text-white'
                }`}
                title="Select screen size / aspect ratio"
              >
                <Crop className="w-3.5 h-3.5" />
                <span>{aspectRatio}</span>
              </button>

              {/* Size Selection Popover Menu */}
              <AnimatePresence>
                {showSizeMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 5 }}
                    transition={{ duration: 0.15 }}
                    className="mt-2 p-1.5 rounded-2xl bg-neutral-900/95 backdrop-blur-xl border border-white/15 shadow-2xl flex flex-col space-y-1 min-w-[130px]"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setAspectRatio('9:16');
                        setShowSizeMenu(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                        aspectRatio === '9:16' ? 'bg-blue-600 text-white font-bold' : 'text-neutral-300 hover:bg-white/10'
                      }`}
                    >
                      <span>9:16 Full</span>
                      {aspectRatio === '9:16' && <Check className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAspectRatio('1:1');
                        setShowSizeMenu(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                        aspectRatio === '1:1' ? 'bg-blue-600 text-white font-bold' : 'text-neutral-300 hover:bg-white/10'
                      }`}
                    >
                      <span>1:1 Square</span>
                      {aspectRatio === '1:1' && <Check className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAspectRatio('16:9');
                        setShowSizeMenu(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                        aspectRatio === '16:9' ? 'bg-blue-600 text-white font-bold' : 'text-neutral-300 hover:bg-white/10'
                      }`}
                    >
                      <span>16:9 Wide</span>
                      {aspectRatio === '16:9' && <Check className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAspectRatio('original');
                        setShowSizeMenu(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                        aspectRatio === 'original' ? 'bg-blue-600 text-white font-bold' : 'text-neutral-300 hover:bg-white/10'
                      }`}
                    >
                      <span>Original Fit</span>
                      {aspectRatio === 'original' && <Check className="w-3.5 h-3.5" />}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Quick Photo & Video Adjustment Drawer */}
            <AnimatePresence>
              {showEditDrawer && (
                <motion.div
                  initial={{ y: 80, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 80, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="relative z-30 mx-4 mb-3 p-4 rounded-3xl bg-neutral-900/90 backdrop-blur-xl border border-white/15 shadow-2xl space-y-3"
                >
                  <div className="flex items-center justify-between pb-1 border-b border-white/10">
                    <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                      <Sliders className="w-3.5 h-3.5 text-blue-400" />
                      <span>Adjust & Edit Media</span>
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setRotation(r => (r + 90) % 360)}
                        className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs flex items-center space-x-1 transition-colors cursor-pointer"
                        title="Rotate 90 degrees"
                      >
                        <RotateCw className="w-3 h-3" />
                        <span className="text-[10px] font-semibold">{rotation}°</span>
                      </button>
                      <button
                        type="button"
                        onClick={resetEditFilters}
                        className="text-[11px] text-neutral-400 hover:text-white transition-colors cursor-pointer"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowEditDrawer(false)}
                        className="p-1 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-1">
                    {/* Brightness */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-neutral-400 font-medium">
                        <span>Brightness</span>
                        <span>{brightness > 0 ? `+${brightness}` : brightness}</span>
                      </div>
                      <input
                        type="range"
                        min={-40}
                        max={40}
                        value={brightness}
                        onChange={(e) => setBrightness(parseInt(e.target.value))}
                        className="w-full accent-blue-500 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Contrast */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-neutral-400 font-medium">
                        <span>Contrast</span>
                        <span>{contrast > 0 ? `+${contrast}` : contrast}</span>
                      </div>
                      <input
                        type="range"
                        min={-40}
                        max={40}
                        value={contrast}
                        onChange={(e) => setContrast(parseInt(e.target.value))}
                        className="w-full accent-blue-500 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    {/* Saturation */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-neutral-400 font-medium">
                        <span>Saturation</span>
                        <span>{saturation > 0 ? `+${saturation}` : saturation}</span>
                      </div>
                      <input
                        type="range"
                        min={-40}
                        max={40}
                        value={saturation}
                        onChange={(e) => setSaturation(parseInt(e.target.value))}
                        className="w-full accent-blue-500 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom Controls Bar: Retake (Left) & Soft Lag-Free Next Button (Right) */}
            <div className="relative z-30 px-6 pb-[max(calc(env(safe-area-inset-bottom,0px)+18px),22px)] pt-3 bg-gradient-to-t from-black/90 via-black/45 to-transparent flex items-center justify-between">
              <button
                type="button"
                onClick={handleRetake}
                className="px-5 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95 cursor-pointer border border-white/10 backdrop-blur-md"
              >
                Retake
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowSizeMenu(false);
                  setShowEditDrawer(false);
                  setStage('details');
                }}
                className="px-6 py-2.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5 shadow-xl shadow-blue-500/30 transition-all active:scale-95 cursor-pointer border border-white/15"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 3: UPLOAD DETAILS SCREEN WITH SEAMLESS BLUE GLOW & TOP SHARE BUTTON */}
        {/* ========================================================================= */}
        {stage === 'details' && (
          <div className="relative flex-1 w-full h-full bg-neutral-950 flex flex-col justify-between overflow-y-auto no-scrollbar">
            
            {/* Seamless Top Header: Soft Blue Ambient Glow Flows Right Through! */}
            <div className="sticky top-0 z-30 px-4 pt-[max(calc(env(safe-area-inset-top,0px)+12px),16px)] pb-3 bg-neutral-950/40 backdrop-blur-md border-b border-white/5 flex items-center justify-between">
              {/* Back to Preview */}
              <button
                type="button"
                onClick={() => setStage('preview')}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer border-0 shadow-sm"
                title="Back to Preview"
              >
                <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
              </button>

              {/* Title Header */}
              <div className="flex flex-col items-center">
                <span className="text-sm font-bold text-white capitalize">
                  {mode === 'story' ? 'New Story' : mode === 'reel' ? 'New Reel' : 'New Post'}
                </span>
                <span className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">
                  Publishing as {currentUser?.name || 'You'}
                </span>
              </div>

              {/* Top-Right Share Button */}
              <button
                type="button"
                disabled={isPublishing}
                onClick={handleShare}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-blue-500/30 transition-all active:scale-95 cursor-pointer border-0 disabled:opacity-50"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sharing...</span>
                  </>
                ) : (
                  <>
                    <span>Share</span>
                    <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                  </>
                )}
              </button>
            </div>

            {/* In-Modal Upload Progress Overlay (Lag-Free & Clean) */}
            {isPublishing && (
              <div className="px-4 pt-3 pb-1">
                <div className="p-3.5 rounded-2xl bg-blue-950/40 border border-blue-500/30 backdrop-blur-xl flex items-center space-x-3 animate-in fade-in duration-200">
                  <div className="relative w-8 h-8 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs font-bold text-white mb-1">
                      <span>{publishStatusText}</span>
                      <span className="text-blue-400 font-mono">{publishProgress}%</span>
                    </div>
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300" 
                        style={{ width: `${publishProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Scrollable Body Content */}
            <div className="flex-1 px-4 py-5 space-y-5 max-w-lg mx-auto w-full">
              
              {/* Media Thumbnail & Caption Card */}
              <div className="bg-white/5 border border-white/10 rounded-[24px] p-3.5 flex space-x-3.5">
                {/* Media Thumbnail */}
                <div className="relative w-24 h-32 rounded-[16px] overflow-hidden bg-neutral-900 shrink-0 border border-white/10">
                  {videoCoverUrl ? (
                    <img src={videoCoverUrl} alt="Cover" className="w-full h-full object-cover" />
                  ) : previewUrls[0] ? (
                    isVideo ? (
                      <video src={previewUrls[0]} className="w-full h-full object-cover" />
                    ) : (
                      <img src={previewUrls[0]} alt="Media" className="w-full h-full object-cover" />
                    )
                  ) : null}

                  {/* Video Badge / Photo Count */}
                  {isVideo ? (
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[9px] font-bold text-white">
                      Reel
                    </div>
                  ) : previewUrls.length > 1 ? (
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[9px] font-bold text-white">
                      +{previewUrls.length}
                    </div>
                  ) : null}
                </div>

                {/* Caption / Title Textarea */}
                <div className="flex-1 flex flex-col justify-between">
                  <textarea
                    rows={4}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder={
                      mode === 'story'
                        ? 'Add a story note or caption...'
                        : 'Write a caption, #hashtags, @mentions...'
                    }
                    className="w-full bg-transparent border-0 text-xs sm:text-sm text-white placeholder-white/45 focus:outline-none resize-none leading-relaxed"
                  />
                  <div className="text-[10px] text-white/40 text-right">
                    {caption.length} / 2200
                  </div>
                </div>
              </div>

              {/* Video Cover Scrubber & Custom Cover Picker (For Video/Reel) */}
              {isVideo && previewUrls[0] && (
                <div className="bg-white/5 border border-white/10 rounded-[20px] p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                      <Film className="w-3.5 h-3.5 text-blue-400" />
                      <span>Select Video Cover</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => coverImageInputRef.current?.click()}
                      className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                    >
                      Upload Image
                    </button>
                  </div>

                  {/* Scrubber Range Slider */}
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min={0}
                      max={videoDuration > 0 ? videoDuration : 30}
                      step={0.1}
                      value={coverScrubTime}
                      onChange={(e) => handleCoverScrub(parseFloat(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer h-1.5 bg-white/20 rounded-lg appearance-none"
                    />
                  </div>

                  {/* Hidden Video element for thumbnail extraction */}
                  <video
                    ref={coverExtractorVideoRef}
                    src={previewUrls[0]}
                    onLoadedMetadata={(e) => {
                      setVideoDuration(e.currentTarget.duration || 30);
                    }}
                    onSeeked={handleCoverSeeked}
                    className="hidden"
                    muted
                  />
                  <input
                    ref={coverImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleSelectCustomCover}
                    className="hidden"
                  />
                </div>
              )}

              {/* Accessory Action Options */}
              <div className="space-y-2 pb-6">
                {/* 1. Add Music / Sound */}
                <button
                  type="button"
                  onClick={() => setShowMusicModal(true)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-[18px] bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                      <Music className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-semibold">
                        {selectedSong ? selectedSong.title : 'Add Music'}
                      </div>
                      <div className="text-[10px] text-white/50">
                        {selectedSong ? selectedSong.artist : 'Select audio track'}
                      </div>
                    </div>
                  </div>
                  {selectedSong ? (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSong(null);
                      }}
                      className="text-white/40 hover:text-white p-1"
                    >
                      <X className="w-4 h-4" />
                    </span>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-white/40" />
                  )}
                </button>

                {/* 2. Add Location */}
                <button
                  type="button"
                  onClick={() => setShowLocationModal(true)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-[18px] bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-semibold">
                        {location || 'Add Location'}
                      </div>
                      <div className="text-[10px] text-white/50">
                        {location ? 'Tagged location' : 'Share where you are'}
                      </div>
                    </div>
                  </div>
                  {location ? (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(null);
                      }}
                      className="text-white/40 hover:text-white p-1"
                    >
                      <X className="w-4 h-4" />
                    </span>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-white/40" />
                  )}
                </button>

                {/* 3. Tag People */}
                <button
                  type="button"
                  onClick={() => setShowTagModal(true)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-[18px] bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-semibold">
                        {taggedUsers.length > 0
                          ? `${taggedUsers.length} People Tagged`
                          : 'Tag People'}
                      </div>
                      <div className="text-[10px] text-white/50">
                        {taggedUsers.length > 0
                          ? taggedUsers.map((u) => u.name).join(', ')
                          : 'Mention friends in this post'}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/40" />
                </button>

                {/* 4. Advanced Settings */}
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(true)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-[18px] bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                      <Settings2 className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-semibold">Advanced Settings</div>
                      <div className="text-[10px] text-white/50">
                        Privacy ({advancedSettings.privacy}), Comments ({advancedSettings.commentsDisabled ? 'Off' : 'On'})
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/40" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Hidden Gallery Input (Photos and Videos, supports multiple) */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="video/*,image/*"
          multiple
          onChange={handleSelectFromGallery}
          className="hidden"
        />

        {/* Music Selector Modal */}
        <MusicLibraryModal
          isOpen={showMusicModal}
          onClose={() => setShowMusicModal(false)}
          selectedSongId={selectedSong?.id}
          onSelectSong={(song) => setSelectedSong(song)}
        />

        {/* Location Picker Modal */}
        <AddLocationModal
          isOpen={showLocationModal}
          onClose={() => setShowLocationModal(false)}
          selectedLocation={location}
          onSelectLocation={(loc) => setLocation(loc)}
        />

        {/* Tag People Modal */}
        <TagPeopleModal
          isOpen={showTagModal}
          onClose={() => setShowTagModal(false)}
          taggedUsers={taggedUsers}
          onToggleTagUser={(user) => {
            setTaggedUsers((prev) => {
              const exists = prev.some((u) => u.uid === user.uid);
              if (exists) {
                return prev.filter((u) => u.uid !== user.uid);
              }
              return [...prev, user];
            });
          }}
        />

        {/* Advanced Settings Modal */}
        <AdvancedSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          settings={advancedSettings}
          onChangeSettings={(s) => setAdvancedSettings(s)}
          user={currentUser || undefined}
        />
      </motion.div>
    </AnimatePresence>
  );
};
