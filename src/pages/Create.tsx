import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload,
  Video,
  Image as ImageIcon,
  Music,
  Type,
  Smile,
  X,
  Camera,
  FlipHorizontal,
  Zap,
  Timer,
  Settings2,
  CheckCircle2,
  ArrowLeft,
  UserPlus,
  ChevronRight,
  MapPin,
  Play,
  Volume2,
  VolumeX,
  Save,
  Search,
  Check,
  Bookmark,
  AtSign,
  Maximize2,
  Trash2,
  ArrowRight,
  Film,
} from "lucide-react";
import { safeFile, generateVideoThumbnail } from "../utils";
import { motion, AnimatePresence } from "motion/react";
import { useAppStore } from "../store";

import {
  createPost,
  subscribeSongs,
  subscribeFavoriteSongs,
  toggleSongFavorite,
} from "../services/postService";
import { findUserByUsername } from "../services/userService";
import { sendNotification } from "../services/notificationService";
import { uploadStory } from "../services/storyService";
import { Song } from "../types";

// Modals
import { MusicLibraryModal } from "../components/MusicLibraryModal";
import { TagPeopleModal } from "../components/TagPeopleModal";
import { AddLocationModal } from "../components/AddLocationModal";
import { AdvancedSettingsModal, AdvancedSettings } from "../components/AdvancedSettingsModal";

export default function Create() {
  const { pushPage, currentUser, setUploadTask, selectedCreateSong, setSelectedCreateSong, selectedCreateMode, setSelectedCreateMode } = useAppStore();
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : true);
  const [forceCameraMode, setForceCameraMode] = useState(false);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const [isMirrored, setIsMirrored] = useState(true);
  const [wasRecordedMirrored, setWasRecordedMirrored] = useState(false);

  // New Interactive Feature States
  const [taggedUsers, setTaggedUsers] = useState<{ uid: string; name: string; username: string; avatar: string }[]>([]);
  const [location, setLocation] = useState<string | null>(null);
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettings>({
    commentsDisabled: false,
    privacy: "public",
    hideLikes: false,
    allowRemix: true,
    highQuality: true,
    saveToDevice: false,
    publishSong: false,
    songTitle: "",
    songArtist: "",
  });

  // Modal Visibility
  const [showMusicLibraryModal, setShowMusicLibraryModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);

  useEffect(() => {
    activeStreamRef.current = activeStream;
  }, [activeStream]);

  const stopCameraStreamOnly = useCallback(() => {
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch (e) {}
    }
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => {
        try { track.stop(); } catch (e) {}
      });
      activeStreamRef.current = null;
    }
    if (activeStream) {
      activeStream.getTracks().forEach((track) => {
        try { track.stop(); } catch (e) {}
      });
      setActiveStream(null);
    }
  }, [activeStream]);

  const stopCameraTracks = useCallback(() => {
    stopCameraStreamOnly();
    if (previewVideoRef.current) {
      try {
        previewVideoRef.current.pause();
      } catch (e) {}
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch (e) {}
    }
  }, [stopCameraStreamOnly]);

  useEffect(() => {
    return () => {
      stopCameraTracks();
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.src = "";
        } catch (e) {}
      }
    };
  }, [stopCameraTracks]);

  const [flashActive, setFlashActive] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"reel" | "post" | "story">("reel");
  const [step, setStep] = useState<"capture" | "preview" | "details">("capture");
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [aspectRatioFit, setAspectRatioFit] = useState<"cover" | "contain">("contain");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const captureCurrentFrameAsThumbnail = useCallback(() => {
    if (previewVideoRef.current && previewVideoRef.current.videoWidth > 0) {
      try {
        const v = previewVideoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(1080, v.videoWidth || 1080);
        canvas.height = Math.round((canvas.width * (v.videoHeight || 1920)) / (v.videoWidth || 1080));
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const thumb = canvas.toDataURL("image/jpeg", 0.95);
          if (thumb && thumb.length > 100) {
            setVideoThumbnail(thumb);
            return thumb;
          }
        }
      } catch (e) {}
    }
    return null;
  }, []);

  useEffect(() => {
    if (files.length === 0) {
      setPreviewUrls((prev) => {
        prev.forEach((u) => {
          try { URL.revokeObjectURL(u); } catch (e) {}
        });
        return [];
      });
      setVideoThumbnail(null);
      setStep("capture");
    }
  }, [files]);

  // Handle hardware / browser back button so user returns to preview from details without losing progress
  useEffect(() => {
    const handlePopState = () => {
      if (step === "details") {
        setStep("preview");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [step]);

  // When returning to preview, resume video playback smoothly
  useEffect(() => {
    if (step === "preview" && previewVideoRef.current) {
      previewVideoRef.current.play().catch(() => {});
    }
  }, [step]);

  useEffect(() => {
    if (selectedSong && step === "preview" && audioRef.current) {
      audioRef.current.src = selectedSong.url;
      audioRef.current.loop = true;
      audioRef.current.play().catch(() => {});
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
  }, [selectedSong, step]);

  useEffect(() => {
    if (selectedCreateSong) {
      setSelectedSong(selectedCreateSong);
      setSelectedCreateSong(null);
    }
  }, [selectedCreateSong, setSelectedCreateSong]);

  useEffect(() => {
    if (selectedCreateMode) {
      setMode(selectedCreateMode);
      setSelectedCreateMode(null);
    }
  }, [selectedCreateMode, setSelectedCreateMode]);

  useEffect(() => {
    if (selectedSong) {
      setIsMuted(true);
    }
  }, [selectedSong]);

  // Instant Upload Handler (Background Async Processing)
  const handleUpload = async () => {
    if (!currentUser || files.length === 0) return;

    // Capture upload task data before navigating
    const uploadFiles = [...files];
    const uploadCaption = caption;
    const uploadMode = mode;
    const uploadSong = selectedSong;
    const uploadLocation = location;
    const uploadTagged = [...taggedUsers];
    const uploadSettings = { ...advancedSettings };
    const uploadAspectRatio = aspectRatioFit;
    const uploadThumbnail = videoThumbnail;
    const uploadUserId = currentUser.uid;
    const uploadUser = { ...currentUser };

    const taskId = `upload_${Date.now()}`;

    // 1. Immediately initiate top progress indicator
    setUploadTask({
      id: taskId,
      progress: 15,
      title: uploadCaption.substring(0, 30) || (uploadMode === "reel" ? "New Reel" : "New Story"),
      type: uploadMode === "reel" ? "reel" : "story",
      status: "uploading",
    });

    // Stop all media audio/video playback immediately
    stopCameraTracks();

    // Reset Create Page State so returning later starts fresh ("potom teke ashe")
    setFiles([]);
    setPreviewUrls([]);
    setVideoThumbnail(null);
    setCaption("");
    setSelectedSong(null);
    setLocation(null);
    setTaggedUsers([]);
    setStep("capture");
    setRecordedChunks([]);
    setCurrentImageIndex(0);
    setAspectRatioFit("cover");

    // Instantly navigate user away
    pushPage(uploadMode === "reel" ? "home" : "reels");

    // 3. Perform actual upload in background async thread
    try {
      if (uploadMode === "reel" || uploadMode === "post") {
        await createPost(
          uploadUserId,
          uploadUser,
          uploadCaption,
          uploadFiles,
          uploadMode === "reel" ? "reel" : "post",
          uploadSong?.id,
          {
            location: uploadLocation,
            taggedUsers: uploadTagged,
            settings: uploadSettings,
            songInfo: uploadSong,
            aspectRatioFit: uploadAspectRatio,
            thumbnailUrl: uploadThumbnail,
            onProgress: (p) => {
              setUploadTask((prev: any) =>
                prev && prev.id === taskId ? { ...prev, progress: p } : prev
              );
            },
          }
        );
      } else {
        const storySongData = uploadSettings?.publishSong ? {
          title: uploadSettings.songTitle?.trim() || uploadCaption?.trim() || `Original Audio - ${uploadUser.name}`,
          artist: uploadSettings.songArtist?.trim() || uploadUser.name,
          thumbnail: uploadUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(uploadUser.name)}&background=5633D8&color=fff`,
          url: "",
        } : (uploadSong ? {
          title: uploadSong.title,
          artist: uploadSong.artist,
          thumbnail: uploadSong.cover || uploadSong.thumbnail || uploadUser.avatar || '',
          url: uploadSong.url,
        } : undefined);

        await uploadStory(
          uploadUserId,
          uploadUser.name,
          uploadUser.avatar || "",
          uploadFiles[0],
          uploadCaption || undefined,
          "home",
          uploadSong?.id,
          storySongData
        );
      }

      // Complete progress animation
      setUploadTask({
        id: taskId,
        progress: 100,
        title: uploadCaption.substring(0, 30) || "Uploaded",
        type: uploadMode === "reel" ? "reel" : (uploadMode === "post" ? "post" : "story"),
        status: "completed",
      });

      setTimeout(() => {
        setUploadTask(null);
      }, 3000);
    } catch (error) {
      console.error("Background upload error:", error);
      setUploadTask({
        id: taskId,
        progress: 100,
        title: "Upload Failed",
        type: uploadMode === "reel" ? "reel" : "story",
        status: "error",
      });
      setTimeout(() => {
        setUploadTask(null);
      }, 4000);
    }
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const [cameraError, setCameraError] = useState(false);

  useEffect(() => {
    let currentStream: MediaStream | null = null;

    if ((isMobile || forceCameraMode) && files.length === 0) {
      const startCamera = async () => {
        setCameraError(false);
        try {
          const constraints = {
            video: {
              facingMode: facingMode,
              width: { ideal: 1920, max: 3840 },
              height: { ideal: 1080, max: 2160 },
              frameRate: { ideal: 60, max: 60 },
            },
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          };

          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          currentStream = stream;
          setActiveStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }

          // Select best supported MIME type with Opus/AAC audio codec preservation
          const mimeTypes = [
            'video/mp4;codecs=avc1.640028,mp4a.40.2',
            'video/mp4;codecs=avc1,mp4a',
            'video/mp4',
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm',
          ];
          let bestMime = '';
          for (const m of mimeTypes) {
            if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) {
              bestMime = m;
              break;
            }
          }

          const recorderOptions: MediaRecorderOptions = {
            mimeType: bestMime || undefined,
            videoBitsPerSecond: 12000000, // 12 Mbps Ultra-HD High Bitrate!
            audioBitsPerSecond: 192000,
          };
          const recorder = new MediaRecorder(stream, recorderOptions);
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              setRecordedChunks((prev) => [...prev, e.data]);
            }
          };
          recorder.onstop = () => {
            setRecording(false);
          };
          setMediaRecorder(recorder);
        } catch (err: any) {
          console.error("Camera access error:", err);
          try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: true,
            });
            currentStream = fallbackStream;
            setActiveStream(fallbackStream);
            if (videoRef.current) {
              videoRef.current.srcObject = fallbackStream;
            }
          } catch (fallbackErr) {
            console.error("Fallback camera access error:", fallbackErr);
            setCameraError(true);
          }
        }
      };

      startCamera();
    }

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
      setActiveStream(null);
    };
  }, [isMobile, forceCameraMode, files, facingMode]);

  useEffect(() => {
    if (recordedChunks.length > 0 && !recording) {
      const mimeType = recordedChunks[0]?.type || mediaRecorder?.mimeType || "video/webm";
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(recordedChunks, { type: mimeType });
      const recordedFile = safeFile(blob, `recorded-video-${Date.now()}.${ext}`);
      setFiles([recordedFile]);
      setRecordedChunks([]);
    }
  }, [recordedChunks, recording, mediaRecorder]);

  const toggleRecording = () => {
    if (!mediaRecorder) return;

    if (recording) {
      mediaRecorder.stop();
      setRecording(false);
    } else {
      setRecordedChunks([]);
      setWasRecordedMirrored(isMirrored);
      mediaRecorder.start(100);
      setRecording(true);
    }
  };

  const toggleFlash = () => {
    if (!activeStream) return;
    const track = activeStream.getVideoTracks()[0];
    if (track) {
      try {
        const capabilities = track.getCapabilities() as any;
        if (capabilities.torch) {
          const nextFlash = !flashActive;
          track
            .applyConstraints({
              advanced: [{ torch: nextFlash }],
            } as any)
            .then(() => setFlashActive(nextFlash))
            .catch(() => setFlashActive(!flashActive));
        } else {
          setFlashActive(!flashActive);
        }
      } catch (err) {
        setFlashActive(!flashActive);
      }
    }
  };

  const startTimerCountdown = () => {
    if (recording) {
      toggleRecording();
      return;
    }
    setCountdown(3);
  };

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && mediaRecorder && !recording && recordedChunks.length === 0) {
      setRecordedChunks([]);
      mediaRecorder.start();
      setRecording(true);
    }
  }, [countdown]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const selectFiles = (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    // Release active camera stream immediately so device hardware is 100% free
    stopCameraStreamOnly();

    // Revoke previous URLs safely to avoid memory leak
    previewUrls.forEach((u) => {
      try { URL.revokeObjectURL(u); } catch (e) {}
    });

    const urls = newFiles.map((f) => URL.createObjectURL(f));
    setFiles(newFiles);
    setPreviewUrls(urls);
    setStep("preview");

    // Ultra-fast background thumbnail extraction
    if (newFiles[0]?.type.startsWith("video")) {
      generateVideoThumbnail(newFiles[0]).then((thumb) => {
        if (thumb) setVideoThumbnail(thumb);
      }).catch(() => {});
    } else if (urls[0]) {
      setVideoThumbnail(urls[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      selectFiles(Array.from(e.dataTransfer.files) as File[]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files) as File[];
      selectFiles(selected);
      e.target.value = "";
    }
  };

  const handleToggleTagUser = (user: { uid: string; name: string; username: string; avatar: string }) => {
    if (taggedUsers.some((u) => u.uid === user.uid)) {
      setTaggedUsers(taggedUsers.filter((u) => u.uid !== user.uid));
    } else {
      setTaggedUsers([...taggedUsers, user]);
      if (!caption.includes(`@${user.username}`)) {
        setCaption((prev) => (prev ? `${prev} @${user.username}` : `@${user.username}`));
      }
    }
  };

  if (isMobile || forceCameraMode) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col overflow-hidden">
        {step === "capture" && (
          <div className="relative flex-1 overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                activeStream ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
              style={{ transform: isMirrored ? "scaleX(-1)" : "scaleX(1)" }}
            />

            {/* Starting Camera Loading Indicator */}
            {!activeStream && !cameraError && (
              <div className="absolute inset-0 bg-black flex flex-col items-center justify-center pointer-events-none z-10 space-y-3">
                <div className="w-12 h-12 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin flex items-center justify-center">
                  <Camera className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-white/60 text-xs font-medium tracking-wide">Starting Camera...</span>
              </div>
            )}

            {/* Webview Camera Error / Permission Fallback Banner */}
            {cameraError && (
              <div className="absolute inset-0 bg-gray-950 flex flex-col items-center justify-center p-6 text-center z-30 space-y-4">
                {/* Top Close Button */}
                <button
                  type="button"
                  onClick={() => {
                    stopCameraTracks();
                    setCameraError(false);
                    if (forceCameraMode) {
                      setForceCameraMode(false);
                    } else {
                      pushPage("home");
                    }
                  }}
                  className="absolute top-12 left-4 p-2.5 text-white bg-white/10 hover:bg-white/20 active:scale-90 rounded-full backdrop-blur-md transition-all border border-white/15 shadow-xl z-40 cursor-pointer"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="w-16 h-16 rounded-full bg-purple-900/40 border border-purple-500/30 flex items-center justify-center text-purple-300 shadow-xl">
                  <Camera className="w-8 h-8" />
                </div>
                <div className="space-y-1 max-w-xs">
                  <h3 className="text-white font-semibold text-lg">Camera Unavailable</h3>
                  <p className="text-gray-400 text-xs font-normal">
                    Camera permission blocked in webview or browser. Select a video or photo from gallery.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
                  <label className="bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-medium px-6 py-3 rounded-2xl flex items-center space-x-2 text-sm shadow-lg cursor-pointer transition-all">
                    <Upload className="w-4 h-4" />
                    <span>Choose Photo / Video</span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      onChange={handleChange}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      stopCameraTracks();
                      setCameraError(false);
                      if (forceCameraMode) {
                        setForceCameraMode(false);
                      } else {
                        pushPage("home");
                      }
                    }}
                    className="bg-white/10 hover:bg-white/20 active:scale-95 text-white font-medium px-6 py-3 rounded-2xl flex items-center space-x-2 text-sm border border-white/15 transition-all shadow-md cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    <span>Close</span>
                  </button>
                </div>
              </div>
            )}

            {flashActive && (
              <div className="absolute inset-0 bg-white/20 pointer-events-none mix-blend-overlay z-20 animate-pulse" />
            )}

            <AnimatePresence>
              {countdown > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.5 }}
                  className="absolute inset-0 z-30 bg-black/40 backdrop-blur-sm flex items-center justify-center pointer-events-none"
                >
                  <motion.div
                    key={countdown}
                    initial={{ scale: 0.3, opacity: 0 }}
                    animate={{ scale: 1.2, opacity: 1 }}
                    exit={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 0.65, ease: "easeOut" }}
                    className="flex flex-col items-center"
                  >
                    <span className="text-9xl font-black text-yellow-400 drop-shadow-[0_4px_20px_rgba(0,0,0,0.6)] font-sans">
                      {countdown}
                    </span>
                    <span className="text-white text-lg uppercase font-bold tracking-widest mt-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                      Ticking...
                    </span>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mobile Top Controls Bar with Safety Padding */}
            <div className="absolute inset-0 px-4 pt-12 sm:pt-6 pb-4 flex flex-col justify-between z-10 bg-gradient-to-b from-black/70 via-transparent to-black/80 font-sans">
              <div className="flex items-start justify-between">
                <button
                  onClick={() => {
                    stopCameraTracks();
                    if (forceCameraMode) {
                      setForceCameraMode(false);
                    } else {
                      pushPage("home");
                    }
                  }}
                  className="p-3 text-white bg-black/30 hover:bg-black/50 rounded-full backdrop-blur-md active:scale-90 transition-transform shadow-lg border border-white/10"
                >
                  <X className="w-6 h-6" />
                </button>

                <button
                  onClick={() => setShowMusicLibraryModal(true)}
                  className="flex items-center space-x-2 bg-black/40 backdrop-blur-md px-5 py-2.5 rounded-full text-white font-medium text-sm border border-white/20 active:scale-95 transition-all shadow-lg"
                >
                  <Music className="w-4 h-4 text-purple-400" />
                  <span className="truncate max-w-[130px]">
                    {selectedSong ? selectedSong.title : "Add Sound"}
                  </span>
                </button>

                {/* Right Camera Toolbar */}
                <div className="flex flex-col space-y-4 bg-black/40 backdrop-blur-md px-2.5 py-4 rounded-3xl border border-white/10 shadow-lg">
                  <button
                    onClick={() =>
                      setFacingMode((prev) => (prev === "user" ? "environment" : "user"))
                    }
                    className="flex flex-col items-center group text-white hover:text-purple-400 transition-colors"
                  >
                    <div className="p-2.5 bg-white/10 rounded-full group-active:scale-90 transition-transform">
                      <Camera className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-medium mt-1 uppercase tracking-wider scale-90">Flip</span>
                  </button>

                  <button
                    onClick={() => setIsMirrored((prev) => !prev)}
                    className={`flex flex-col items-center group transition-colors ${
                      isMirrored ? "text-purple-400" : "text-white hover:text-purple-400"
                    }`}
                  >
                    <div
                      className={`p-2.5 rounded-full group-active:scale-90 transition-transform ${
                        isMirrored ? "bg-purple-500/20" : "bg-white/10"
                      }`}
                    >
                      <FlipHorizontal className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-medium mt-1 uppercase tracking-wider scale-90">Mirror</span>
                  </button>

                  <button
                    onClick={toggleFlash}
                    className={`flex flex-col items-center group transition-colors ${
                      flashActive ? "text-yellow-400" : "text-white hover:text-yellow-400"
                    }`}
                  >
                    <div
                      className={`p-2.5 rounded-full group-active:scale-90 transition-transform ${
                        flashActive ? "bg-yellow-500/20" : "bg-white/10"
                      }`}
                    >
                      <Zap className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-medium mt-1 uppercase tracking-wider scale-90">Flash</span>
                  </button>

                  <button
                    onClick={startTimerCountdown}
                    className={`flex flex-col items-center group transition-colors ${
                      countdown > 0 ? "text-green-400 animate-pulse" : "text-white hover:text-green-400"
                    }`}
                  >
                    <div
                      className={`p-2.5 rounded-full group-active:scale-90 transition-transform ${
                        countdown > 0 ? "bg-green-500/20" : "bg-white/10"
                      }`}
                    >
                      <Timer className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-medium mt-1 uppercase tracking-wider scale-90">
                      {countdown > 0 ? `${countdown}s` : "Timer"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Bottom Capture Bar */}
              <div className="flex items-center justify-between px-8 pb-12 w-full max-w-lg mx-auto">
                <div className="flex flex-col items-center">
                  <label 
                    htmlFor="mobile-gallery-upload-input"
                    className="w-14 h-14 rounded-2xl bg-gray-900 border-2 border-white/40 overflow-hidden relative shadow-2xl active:scale-90 transition-transform cursor-pointer group flex items-center justify-center"
                  >
                    <input
                      id="mobile-gallery-upload-input"
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                      onChange={handleChange}
                    />
                    <img
                      src="https://picsum.photos/seed/gallery/100/100"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                      alt="Gallery"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                      <Upload className="w-6 h-6 text-white" />
                    </div>
                  </label>
                </div>

                <button
                  className="relative flex items-center justify-center focus:outline-none select-none group"
                  onClick={toggleRecording}
                >
                  <motion.div
                    animate={
                      recording ? { scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] } : { scale: 1 }
                    }
                    transition={
                      recording ? { repeat: Infinity, duration: 1.5, ease: "easeInOut" } : {}
                    }
                    className={`absolute rounded-full border-[6px] ${
                      recording ? "border-red-500 bg-red-500/10" : "border-white bg-white/10"
                    } transition-all duration-300 w-24 h-24 shadow-lg`}
                  />
                  <motion.div
                    animate={{
                      scale: recording ? 0.65 : 1,
                      borderRadius: recording ? "14px" : "50%",
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="w-16 h-16 bg-red-600 shadow-inner flex items-center justify-center z-10"
                  />
                </button>

                <button
                  onClick={() => setMode((prev) => (prev === "reel" ? "story" : "reel"))}
                  className="px-4 py-2 bg-black/40 backdrop-blur-md border border-white/20 text-xs font-bold uppercase tracking-widest text-white rounded-full active:scale-95 transition-transform"
                >
                  {mode}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP PREVIEW: Top control buttons lowered below mobile status bar! */}
        {step === "preview" && files.length > 0 && (
          <div className="relative flex-1 bg-black flex flex-col font-sans">
            <div className="relative flex-1 flex items-center justify-center overflow-hidden">
              {files[0].type.startsWith("video") ? (
                <video
                  ref={previewVideoRef}
                  key={previewUrls[0]}
                  src={previewUrls[0] || ""}
                  className={`w-full max-h-[100dvh] transition-all duration-300 ${
                    aspectRatioFit === "cover" ? "h-full object-cover" : "object-contain bg-black"
                  }`}
                  style={{ transform: wasRecordedMirrored ? "scaleX(-1)" : "none" }}
                  autoPlay
                  loop
                  muted={isMuted}
                  playsInline
                  preload="auto"
                  onLoadedMetadata={(e) => {
                    const el = e.currentTarget;
                    el.play().catch(() => {
                      el.muted = true;
                      el.play().catch(() => {});
                    });
                    setTimeout(() => {
                      captureCurrentFrameAsThumbnail();
                    }, 120);
                  }}
                />
              ) : (
                <div
                  className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar w-full h-full items-center"
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    const index = Math.round(el.scrollLeft / el.clientWidth);
                    setCurrentImageIndex(index);
                  }}
                >
                  {previewUrls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      className={`w-full max-h-[100dvh] shrink-0 snap-center transition-all duration-300 ${
                        aspectRatioFit === "cover" ? "h-full object-cover" : "object-contain bg-black"
                      }`}
                      alt="Preview"
                    />
                  ))}
                </div>
              )}

              {files.length > 1 && !files[0].type.startsWith("video") && (
                <div className="absolute bottom-24 left-0 right-0 flex justify-center space-x-2 z-20 pointer-events-none">
                  {files.map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 rounded-full transition-all ${
                        i === currentImageIndex ? "w-6 bg-white" : "w-2 bg-white/50"
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Lowered Top Control Bar (pt-12 sm:pt-6) so it sits below notification bar! */}
              <div className="absolute top-0 left-0 right-0 p-4 pt-12 sm:pt-6 flex justify-between items-start z-30 bg-gradient-to-b from-black/80 via-black/30 to-transparent">
                <button
                  onClick={() => setFiles([])}
                  className="p-3 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full text-white active:scale-90 transition-transform shadow-lg border border-white/10"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>

                <button
                  onClick={() => setShowMusicLibraryModal(true)}
                  className="flex items-center space-x-2 bg-black/50 backdrop-blur-md px-5 py-2.5 rounded-full text-white font-medium text-sm border border-white/20 active:scale-95 transition-all shadow-lg"
                >
                  <Music className="w-4 h-4 text-purple-400" />
                  <span className="truncate max-w-[130px]">
                    {selectedSong ? selectedSong.title : "Add Sound"}
                  </span>
                </button>

                <div className="flex flex-col space-y-3">
                  <button
                    onClick={() => setAspectRatioFit((prev) => (prev === "cover" ? "contain" : "cover"))}
                    className="p-3 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full text-white shadow-lg border border-white/10 active:scale-90 transition-transform flex items-center justify-center group"
                    title={aspectRatioFit === "cover" ? "Full Screen (9:16)" : "Original Size"}
                  >
                    <Maximize2 className={`w-5 h-5 ${aspectRatioFit === "cover" ? "text-purple-400" : "text-white"}`} />
                  </button>
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-3 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full text-white shadow-lg border border-white/10 active:scale-90 transition-transform"
                  >
                    {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                  </button>
                  <button
                    onClick={() => setShowMusicLibraryModal(true)}
                    className="p-3 bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full text-white shadow-lg border border-white/10 active:scale-90 transition-transform"
                  >
                    <Music className="w-6 h-6 text-purple-400" />
                  </button>
                </div>
              </div>

              {selectedSong && (
                <div className="absolute top-24 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/70 backdrop-blur-md rounded-full border border-white/20 flex items-center space-x-3 z-30 shadow-xl max-w-[90%]">
                  <Music className="w-4 h-4 text-purple-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-white font-medium text-xs truncate max-w-[150px]">
                      {selectedSong.title}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedSong(null)}
                    className="p-1 hover:bg-white/20 rounded-full transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              )}

              {/* Bottom Icon Buttons */}
              <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between z-20">
                <button
                  onClick={() => setFiles([])}
                  title="Discard"
                  className="p-3.5 bg-rose-600/80 hover:bg-rose-600 backdrop-blur-md text-white rounded-full shadow-xl border border-white/20 active:scale-90 transition-all flex items-center justify-center"
                >
                  <Trash2 className="w-6 h-6" />
                </button>

                <button
                  onClick={() => {
                    captureCurrentFrameAsThumbnail();
                    setStep("details");
                    try {
                      window.history.pushState({ ennvoCreateStep: "details" }, "");
                    } catch (e) {}
                  }}
                  title="Next"
                  className="p-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-full shadow-xl active:scale-90 transition-all flex items-center justify-center"
                >
                  <ArrowRight className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP DETAILS: Top Header lowered below mobile status bar! */}
        {step === "details" && (
          <div className="flex-1 bg-white flex flex-col animate-in slide-in-from-right duration-300 font-sans overflow-y-auto no-scrollbar">
            {/* Lowered Header with pt-12 sm:pt-6 */}
            <div className="flex items-center justify-between p-4 pt-12 sm:pt-6 border-b border-gray-100 bg-white sticky top-0 z-20 shadow-sm">
              <button
                onClick={() => setStep("preview")}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ArrowLeft className="w-6 h-6 text-gray-900" />
              </button>
              <h2 className="font-semibold text-lg text-gray-900 tracking-tight">
                New {mode === "reel" ? "Reel" : "Story"}
              </h2>
              <button
                onClick={handleUpload}
                disabled={loading}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-6 py-2 rounded-full font-bold text-sm disabled:opacity-50 active:scale-95 transition-all shadow-lg shadow-purple-200"
              >
                Post
              </button>
            </div>

            {/* Media thumbnail + Caption Input */}
            <div className="p-4 flex space-x-4 border-b border-gray-100 bg-gray-50/40">
              <div className="w-24 h-36 bg-neutral-900 rounded-2xl overflow-hidden shrink-0 shadow-lg border-2 border-white relative group">
                {videoThumbnail ? (
                  <img
                    src={videoThumbnail}
                    className="w-full h-full object-cover"
                    alt="Reel Cover Thumbnail"
                  />
                ) : files[0]?.type.startsWith("video") ? (
                  <video
                    src={previewUrls[0] || ""}
                    className="w-full h-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                  />
                ) : (
                  <img
                    src={previewUrls[0] || ""}
                    className="w-full h-full object-cover"
                    alt="Preview"
                  />
                )}
                {/* Visual Cover Badge */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none flex flex-col justify-between p-2">
                  <div className="self-end bg-black/60 backdrop-blur-xs px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white uppercase tracking-wider flex items-center space-x-1">
                    <Film className="w-2.5 h-2.5 text-purple-400" />
                    <span>Cover</span>
                  </div>
                  <div className="flex items-center space-x-1 text-white text-[11px] font-semibold drop-shadow-sm">
                    <Play className="w-3 h-3 fill-white text-white" />
                    <span>{mode === "reel" ? "Reel" : "Story"}</span>
                  </div>
                </div>
              </div>
              <div className="flex-1 flex flex-col">
                <textarea
                  placeholder="Write a caption... Type @ to tag friends"
                  className="w-full flex-1 resize-none outline-none text-sm font-normal pt-1 bg-transparent placeholder-gray-400"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            {/* Tagged / Mentioned users chips */}
            {taggedUsers.length > 0 && (
              <div className="p-4 border-b border-gray-100 flex flex-wrap gap-2 items-center bg-blue-50/40">
                <span className="text-xs font-bold text-blue-600 flex items-center space-x-1">
                  <AtSign className="w-3.5 h-3.5" />
                  <span>Mentioned:</span>
                </span>
                {taggedUsers.map((u) => (
                  <div
                    key={u.uid}
                    className="px-3 py-1 bg-blue-100 text-blue-600 font-bold text-xs rounded-full flex items-center space-x-1.5 shadow-xs border border-blue-200"
                  >
                    <span className="text-blue-600 font-bold">@{u.username}</span>
                    <button
                      onClick={() => handleToggleTagUser(u)}
                      className="hover:bg-blue-200 p-0.5 rounded-full text-blue-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Interactive Options List */}
            <div className="flex-1 p-4 space-y-2">
              {/* Mention friends */}
              <button
                onClick={() => setShowTagModal(true)}
                className="flex items-center justify-between w-full p-4 hover:bg-gray-50 rounded-2xl transition-all border border-transparent hover:border-gray-100 group"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <span className="font-semibold text-sm text-gray-900 block">
                      Mention friends
                    </span>
                    <span className="text-xs text-blue-600 font-medium">
                      {taggedUsers.length > 0
                        ? `${taggedUsers.length} mentioned`
                        : "Mention friends in caption"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </button>

              {/* Add location */}
              <button
                onClick={() => setShowLocationModal(true)}
                className="flex items-center justify-between w-full p-4 hover:bg-gray-50 rounded-2xl transition-all border border-transparent hover:border-gray-100 group"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <span className="font-medium text-sm text-gray-900 block">
                      Add location
                    </span>
                    <span className="text-xs text-gray-400 truncate max-w-[180px]">
                      {location || "Select city or venue"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {location && (
                    <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 truncate max-w-[100px]">
                      {location}
                    </span>
                  )}
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </button>

              {/* Add music */}
              <button
                onClick={() => setShowMusicLibraryModal(true)}
                className="flex items-center justify-between w-full p-4 hover:bg-gray-50 rounded-2xl transition-all border border-transparent hover:border-gray-100 group"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 group-hover:scale-110 transition-transform">
                    <Music className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <span className="font-medium text-sm text-gray-900 block">
                      Add music
                    </span>
                    <span className="text-xs text-gray-400">
                      {selectedSong ? selectedSong.artist : "Select background audio track"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {selectedSong && (
                    <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-100 truncate max-w-[100px]">
                      {selectedSong.title}
                    </span>
                  )}
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </button>

              {/* Advanced Settings */}
              <button
                onClick={() => setShowAdvancedModal(true)}
                className="flex items-center justify-between w-full p-4 hover:bg-gray-50 rounded-2xl transition-all border border-transparent hover:border-gray-100 group"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-2.5 rounded-xl bg-gray-100 text-gray-600 group-hover:scale-110 transition-transform">
                    <Settings2 className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <span className="font-medium text-sm text-gray-900 block">
                      Advanced settings
                    </span>
                    <span className="text-xs text-gray-400">
                      Comments, privacy, remixing & HD quality
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Integrated Modals */}
        <MusicLibraryModal
          isOpen={showMusicLibraryModal}
          onClose={() => setShowMusicLibraryModal(false)}
          onSelectSong={(song) => setSelectedSong(song)}
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
          selectedLocation={location}
          onSelectLocation={setLocation}
        />

        <AdvancedSettingsModal
          isOpen={showAdvancedModal}
          onClose={() => setShowAdvancedModal(false)}
          settings={advancedSettings}
          onChangeSettings={setAdvancedSettings}
          selectedFiles={files}
          user={currentUser || undefined}
          defaultSongTitle={caption || undefined}
        />

        <audio ref={audioRef} className="hidden" />
      </div>
    );
  }

  // DESKTOP VIEW
  return (
    <div className="h-full w-full bg-[#f8f9fa] flex flex-col items-center overflow-y-auto pb-20 no-scrollbar font-sans md:pl-24">
      {/* PC Header */}
      <div className="w-full bg-white/90 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-[1000px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <button
              onClick={() => pushPage("home")}
              className="p-3 hover:bg-gray-100 rounded-full transition-all active:scale-90 text-gray-900 group"
            >
              <ArrowLeft className="w-7 h-7 group-hover:-translate-x-1 transition-transform" />
            </button>
            <div>
              <h1 className="text-2xl font-normal text-gray-900 tracking-tight">
                Create
              </h1>
              <p className="text-gray-400 text-sm font-normal -mt-1 uppercase tracking-[0.1em]">
                {mode} selection
              </p>
            </div>
          </div>

          <div className="flex items-center bg-gray-100/80 rounded-2xl p-1.5 shadow-inner">
            <button
              onClick={() => {
                setMode("reel");
                setStep("capture");
                setFiles([]);
              }}
              className={`px-6 py-2 rounded-xl text-[14px] font-medium transition-all ${
                mode === "reel"
                  ? "bg-white text-purple-600 shadow-md transform scale-105"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              Reel
            </button>
            <button
              onClick={() => {
                setMode("post");
                setStep("capture");
                setFiles([]);
              }}
              className={`px-6 py-2 rounded-xl text-[14px] font-medium transition-all ${
                mode === "post"
                  ? "bg-white text-blue-600 shadow-md transform scale-105"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              Post
            </button>
            <button
              onClick={() => {
                setMode("story");
                setStep("capture");
                setFiles([]);
              }}
              className={`px-6 py-2 rounded-xl text-[14px] font-medium transition-all ${
                mode === "story"
                  ? "bg-white text-purple-600 shadow-md transform scale-105"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              Story
            </button>
          </div>

          <div className="w-12"></div>
        </div>
      </div>

      <div className="w-full max-w-[900px] mt-6 px-4 flex flex-col lg:flex-row gap-6 items-start">
        {/* Upload/Preview Stage */}
        <div className="flex-1 w-full bg-white rounded-[24px] border border-gray-100 shadow-md overflow-hidden flex flex-col min-h-[480px] relative group border-2 border-transparent hover:border-purple-100 transition-all duration-500">
          {files.length === 0 ? (
            <div
              className={`flex-1 flex flex-col items-center justify-center p-8 transition-all duration-500 ${
                dragActive ? "bg-purple-50/50 scale-[0.98]" : "bg-white"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="w-32 h-32 mb-6 relative group-hover:scale-105 transition-transform duration-700">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-full animate-blob"></div>
                <div className="absolute inset-3 bg-white rounded-full flex items-center justify-center shadow-md border border-gray-50">
                  <Video className="w-10 h-10 text-purple-600" strokeWidth={1.5} />
                </div>
              </div>
              <h2 className="text-xl font-medium text-gray-900 mb-1 tracking-tight">
                Post your creation
              </h2>
              <p className="text-gray-400 mb-6 text-center font-normal text-sm">
                MP4, WebM or High Quality Photos
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
                <label className="bg-gray-900 hover:bg-black text-white font-medium py-3 px-8 rounded-2xl cursor-pointer transition-all shadow-lg active:scale-95 flex items-center space-x-2.5 text-sm">
                  <Upload className="w-4 h-4" />
                  <span>Choose files</span>
                  <input
                    type="file"
                    accept="video/*,image/*"
                    multiple
                    className="hidden"
                    onChange={handleChange}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setForceCameraMode(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-8 rounded-2xl cursor-pointer transition-all shadow-lg active:scale-95 flex items-center space-x-2.5 text-sm"
                >
                  <Camera className="w-4 h-4" />
                  <span>Record with Camera</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[500px]">
              {files[0].type.startsWith("video") ? (
                <video
                  key={previewUrls[0]}
                  src={previewUrls[0] || ""}
                  className="w-full max-h-[100dvh] object-contain"
                  style={{ transform: wasRecordedMirrored ? "scaleX(-1)" : "none" }}
                  autoPlay
                  loop
                  muted={isMuted}
                  playsInline
                  preload="auto"
                  onLoadedMetadata={(e) => {
                    const el = e.currentTarget;
                    el.play().catch(() => {
                      el.muted = true;
                      el.play().catch(() => {});
                    });
                  }}
                />
              ) : (
                <div
                  className="w-full h-full flex overflow-x-auto snap-x snap-mandatory hide-scrollbar items-center"
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    const index = Math.round(el.scrollLeft / el.clientWidth);
                    setCurrentImageIndex(index);
                  }}
                >
                  {previewUrls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      className="w-full max-h-[100dvh] object-contain shrink-0 snap-center"
                      alt="Preview"
                    />
                  ))}
                </div>
              )}

              <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-20">
                <button
                  onClick={() => setFiles([])}
                  className="p-2.5 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full text-white transition-all active:scale-90 border border-white/20 shadow-lg"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-2.5 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full text-white transition-all active:scale-90 border border-white/20 shadow-lg"
                  >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => setShowMusicLibraryModal(true)}
                    className="p-2.5 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full text-white transition-all active:scale-90 border border-white/20 shadow-lg"
                  >
                    <Music className="w-5 h-5 text-purple-400" />
                  </button>
                </div>
              </div>

              {selectedSong && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/70 backdrop-blur-md rounded-full border border-white/20 flex items-center space-x-3 z-10 shadow-xl max-w-[90%]">
                  <Music className="w-4 h-4 text-purple-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-white font-medium text-xs truncate max-w-[150px]">
                      {selectedSong.title}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedSong(null)}
                    className="p-1 hover:bg-white/20 rounded-full transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Info & Options Panel */}
        <div className="w-full lg:w-[340px] flex flex-col space-y-4">
          <div className="bg-white rounded-[24px] border border-gray-100 shadow-md p-5 space-y-5">
            <div className="flex items-center space-x-3 pb-3 border-b border-gray-100">
              <img
                src={
                  currentUser?.avatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    currentUser?.name || "User"
                  )}&background=random`
                }
                alt="Profile"
                className="w-11 h-11 rounded-full object-cover border border-gray-100"
              />
              <div className="text-left">
                <h4 className="font-semibold text-sm text-gray-900 leading-tight">
                  {currentUser?.name || "Creator"}
                </h4>
                <p className="text-gray-400 uppercase text-[10px] tracking-widest mt-0.5">
                  Publishing {mode}
                </p>
              </div>
            </div>

            <textarea
              placeholder="Write a caption... Type @ to mention friends"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full h-28 resize-none bg-gray-50 rounded-2xl p-3.5 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-all font-normal text-sm placeholder:text-gray-400 border border-transparent"
            />

            {/* Config Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={() => setShowTagModal(true)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-xs font-medium text-gray-700 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <UserPlus className="w-4 h-4 text-blue-500" />
                  <span className="text-blue-600 font-semibold">Mention friends ({taggedUsers.length})</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              <button
                onClick={() => setShowLocationModal(true)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-xs font-medium text-gray-700 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-emerald-500" />
                  <span className="truncate max-w-[160px]">{location || "Add Location"}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              <button
                onClick={() => setShowMusicLibraryModal(true)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-xs font-medium text-gray-700 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Music className="w-4 h-4 text-purple-500" />
                  <span className="truncate max-w-[160px]">
                    {selectedSong ? selectedSong.title : "Add Music"}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>

              <button
                onClick={() => setShowAdvancedModal(true)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-xs font-medium text-gray-700 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Settings2 className="w-4 h-4 text-gray-500" />
                  <span>Advanced Settings</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <button
              onClick={handleUpload}
              disabled={loading || files.length === 0}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40 text-white font-medium py-3.5 rounded-2xl text-base transition-all shadow-lg shadow-purple-500/20 active:scale-[0.98] flex items-center justify-center space-x-2"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>Publish {mode === "reel" ? "Reel" : (mode === "post" ? "Post" : "Story")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* PC Modals */}
      <MusicLibraryModal
        isOpen={showMusicLibraryModal}
        onClose={() => setShowMusicLibraryModal(false)}
        onSelectSong={(song) => setSelectedSong(song)}
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
        selectedLocation={location}
        onSelectLocation={setLocation}
      />

      <AdvancedSettingsModal
        isOpen={showAdvancedModal}
        onClose={() => setShowAdvancedModal(false)}
        settings={advancedSettings}
        onChangeSettings={setAdvancedSettings}
        selectedFiles={files}
        user={currentUser || undefined}
        defaultSongTitle={caption || undefined}
      />

      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
