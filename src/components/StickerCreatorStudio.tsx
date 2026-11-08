import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Upload,
  Camera,
  RotateCw,
  FlipHorizontal,
  Type,
  Sparkles,
  Send,
  Download,
  Loader2,
  Trash2,
  Brush,
  Undo2,
  Check,
  Palette,
  Sliders,
  Crop,
} from "lucide-react";
import { uploadMedia } from "../services/githubStorage";
import { createCustomSticker } from "../services/stickerService";
import { User } from "../types";

interface StickerCreatorStudioProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onStickerCreated: (url: string, type: "image" | "video" | "animated") => void;
  onSendDirectly?: (url: string, type: "image" | "video" | "animated") => void;
}

type StickerFilter = "none" | "bright" | "contrast" | "bw" | "vibrant";
type StickerStyle = "clean" | "die-cut" | "sky-glow" | "neon";
type StickerCrop = "original" | "square" | "circle";

export const StickerCreatorStudio: React.FC<StickerCreatorStudioProps> = ({
  isOpen,
  onClose,
  currentUser,
  onStickerCreated,
  onSendDirectly,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"image" | "video" | "animated">("image");

  // Editing States
  const [rotation, setRotation] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<StickerFilter>("none");
  const [activeStyle, setActiveStyle] = useState<StickerStyle>("die-cut");
  const [activeCrop, setActiveCrop] = useState<StickerCrop>("square");

  // Caption State
  const [captionText, setCaptionText] = useState<string>("");
  const [captionColor, setCaptionColor] = useState<string>("#FFFFFF");
  const [showCaptionInput, setShowCaptionInput] = useState<boolean>(false);

  // Doodle / Draw State
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(false);
  const [brushColor, setBrushColor] = useState<string>("#0284c7");
  const [brushSize, setBrushSize] = useState<number>(5);
  const [doodlePaths, setDoodlePaths] = useState<{ points: { x: number; y: number }[]; color: string; size: number }[]>([]);

  // Processing & Uploading States
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [stickerTitle, setStickerTitle] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const isMouseDownRef = useRef<boolean>(false);

  // Reset when closing or opening
  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setRotation(0);
      setFlipH(false);
      setActiveFilter("none");
      setActiveStyle("die-cut");
      setActiveCrop("square");
      setCaptionText("");
      setDoodlePaths([]);
      setIsDrawingMode(false);
      setStickerTitle("");
    }
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const isVid = file.type.startsWith("video") || file.name.endsWith(".mp4") || file.name.endsWith(".webm") || file.name.endsWith(".mov");
    const isGif = file.type.includes("gif") || file.name.endsWith(".gif");

    if (isVid) setFileType("video");
    else if (isGif) setFileType("animated");
    else setFileType("image");

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setStickerTitle(file.name.split(".")[0].replace(/[-_]/g, " "));
    setRotation(0);
    setFlipH(false);
    setDoodlePaths([]);
  };

  // Render composite image with all edits onto output canvas
  const generateExportBlob = useCallback(async (): Promise<Blob> => {
    if (!previewUrl || fileType === "video") {
      return selectedFile || new Blob();
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const size = 512;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(selectedFile || new Blob());

        ctx.clearRect(0, 0, size, size);

        // Apply crop clipping path
        ctx.save();
        if (activeCrop === "circle") {
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, size / 2 - 16, 0, Math.PI * 2);
          ctx.clip();
        }

        // Apply filters
        if (activeFilter === "bright") {
          ctx.filter = "brightness(1.25) contrast(1.1)";
        } else if (activeFilter === "contrast") {
          ctx.filter = "contrast(1.4) saturate(1.2)";
        } else if (activeFilter === "bw") {
          ctx.filter = "grayscale(100%) contrast(1.2)";
        } else if (activeFilter === "vibrant") {
          ctx.filter = "saturate(1.8) contrast(1.15)";
        } else {
          ctx.filter = "none";
        }

        // Apply transformations (Rotate & Flip)
        ctx.translate(size / 2, size / 2);
        if (rotation !== 0) {
          ctx.rotate((rotation * Math.PI) / 180);
        }
        if (flipH) {
          ctx.scale(-1, 1);
        }

        // Draw image aspect fit
        const scale = Math.min((size - 40) / img.width, (size - 40) / img.height);
        const w = img.width * scale;
        const h = img.height * scale;

        // Apply style effects (Die-Cut border / Sky glow / Neon)
        if (activeStyle === "die-cut") {
          ctx.shadowColor = "#FFFFFF";
          ctx.shadowBlur = 12;
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
        } else if (activeStyle === "sky-glow") {
          ctx.shadowColor = "#38bdf8";
          ctx.shadowBlur = 16;
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
        } else if (activeStyle === "neon") {
          ctx.shadowColor = "#fe2c55";
          ctx.shadowBlur = 18;
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
        } else {
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
        }

        ctx.restore();

        // Render Doodles / Brush Strokes
        if (doodlePaths.length > 0) {
          ctx.save();
          doodlePaths.forEach((path) => {
            if (path.points.length < 2) return;
            ctx.strokeStyle = path.color;
            ctx.lineWidth = path.size;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            ctx.moveTo(path.points[0].x, path.points[0].y);
            for (let i = 1; i < path.points.length; i++) {
              ctx.lineTo(path.points[i].x, path.points[i].y);
            }
            ctx.stroke();
          });
          ctx.restore();
        }

        // Render Caption Text
        if (captionText.trim()) {
          ctx.save();
          ctx.font = "900 36px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const textY = size - 50;

          // Black stroke around text for meme visibility
          ctx.strokeStyle = "#000000";
          ctx.lineWidth = 7;
          ctx.lineJoin = "round";
          ctx.strokeText(captionText.trim().toUpperCase(), size / 2, textY);

          ctx.fillStyle = captionColor;
          ctx.fillText(captionText.trim().toUpperCase(), size / 2, textY);
          ctx.restore();
        }

        // Export high-quality fast WebP (falls back to PNG)
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else resolve(selectedFile || new Blob());
          },
          "image/webp",
          0.88
        );
      };
      img.onerror = () => resolve(selectedFile || new Blob());
      img.src = previewUrl;
    });
  }, [previewUrl, fileType, selectedFile, activeCrop, activeFilter, rotation, flipH, activeStyle, doodlePaths, captionText, captionColor]);

  // Drawing Canvas Handlers
  const handleDrawStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode || !drawCanvasRef.current) return;
    isMouseDownRef.current = true;
    const rect = drawCanvasRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const scaleX = 512 / rect.width;
    const scaleY = 512 / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    setDoodlePaths((prev) => [
      ...prev,
      { points: [{ x, y }], color: brushColor, size: brushSize },
    ]);
  };

  const handleDrawMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode || !isMouseDownRef.current || !drawCanvasRef.current) return;
    const rect = drawCanvasRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const scaleX = 512 / rect.width;
    const scaleY = 512 / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    setDoodlePaths((prev) => {
      if (prev.length === 0) return prev;
      const last = { ...prev[prev.length - 1] };
      last.points = [...last.points, { x, y }];
      return [...prev.slice(0, prev.length - 1), last];
    });
  };

  const handleDrawEnd = () => {
    isMouseDownRef.current = false;
  };

  // Redraw preview doodles onto drawCanvas
  useEffect(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 512, 512);

    doodlePaths.forEach((path) => {
      if (path.points.length < 2) return;
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();
    });
  }, [doodlePaths]);

  // Save Sticker Action
  const handleSaveSticker = async () => {
    if (!selectedFile && !previewUrl) return;
    setIsSaving(true);
    try {
      const blob = await generateExportBlob();
      const ext = fileType === "video" ? "mp4" : "webp";
      const finalFile = new File([blob], `sticker_${Date.now()}.${ext}`, {
        type: fileType === "video" ? "video/mp4" : "image/webp",
      });

      const mediaUrl = await uploadMedia(finalFile, "stickers");

      if (currentUser?.uid) {
        await createCustomSticker({
          url: mediaUrl,
          title: stickerTitle.trim() || "My Sticker",
          type: fileType,
          authorId: currentUser.uid,
          authorName: currentUser.name,
          authorAvatar: currentUser.avatar,
          tags: ["custom", "sticker"],
        });
      }

      onStickerCreated(mediaUrl, fileType);
      onClose();
    } catch (err) {
      console.error("Failed to save sticker:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Send Directly to Chat Action
  const handleSendDirectlyToChat = async () => {
    if (!selectedFile && !previewUrl) return;
    setIsSending(true);
    try {
      const blob = await generateExportBlob();
      const ext = fileType === "video" ? "mp4" : "webp";
      const finalFile = new File([blob], `sticker_${Date.now()}.${ext}`, {
        type: fileType === "video" ? "video/mp4" : "image/webp",
      });

      const mediaUrl = await uploadMedia(finalFile, "stickers");

      if (currentUser?.uid) {
        createCustomSticker({
          url: mediaUrl,
          title: stickerTitle.trim() || "My Sticker",
          type: fileType,
          authorId: currentUser.uid,
          authorName: currentUser.name,
          authorAvatar: currentUser.avatar,
          tags: ["custom", "chat"],
        }).catch(() => {});
      }

      if (onSendDirectly) {
        onSendDirectly(mediaUrl, fileType);
      } else {
        onStickerCreated(mediaUrl, fileType);
      }
      onClose();
    } catch (err) {
      console.error("Failed to send sticker directly:", err);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[360] bg-gradient-to-b from-sky-100/95 via-sky-50/90 to-white dark:from-slate-950 dark:via-sky-950/40 dark:to-neutral-950 backdrop-blur-2xl flex flex-col h-full w-full overflow-hidden select-none text-slate-800 dark:text-slate-100"
      >
        {/* Top Header - Sky Blur Theme */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-sky-200/60 dark:border-sky-900/40 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shrink-0 z-10">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-sky-500/15 dark:bg-sky-400/20 text-sky-700 dark:text-sky-300 border border-sky-400/30 flex items-center justify-center hover:bg-sky-500/25 active:scale-90 transition-all cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white tracking-tight">
                  Sticker Studio
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-400/30">
                  2D Clean
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
                Create & edit stickers with instant upload
              </p>
            </div>
          </div>

          {/* Action Buttons Top Right */}
          {previewUrl && (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleSaveSticker}
                disabled={isSaving || isSending}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900/40 active:scale-95 transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Save</span>
              </button>

              <button
                type="button"
                onClick={handleSendDirectlyToChat}
                disabled={isSaving || isSending}
                className="px-4 py-1.5 rounded-full text-xs font-bold bg-gradient-to-tr from-[#fe2c55] via-rose-500 to-pink-500 hover:opacity-90 active:scale-95 text-white flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-50"
              >
                {isSending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Send to Chat</span>
              </button>
            </div>
          )}
        </div>

        {/* Hidden File Inputs */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*,video/*,.gif,.mp4,.webm,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          type="file"
          ref={cameraInputRef}
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Main Body */}
        <div className="flex-1 flex flex-col items-center justify-between p-3 sm:p-5 overflow-y-auto no-scrollbar">
          {!previewUrl ? (
            /* Blank State - Sky Blur Selection Area */
            <div className="my-auto w-full max-w-sm flex flex-col items-center text-center p-6 rounded-3xl bg-white/70 dark:bg-slate-900/70 border border-sky-200/80 dark:border-sky-900/50 shadow-lg backdrop-blur-md">
              <div className="w-16 h-16 rounded-3xl bg-sky-500/15 dark:bg-sky-400/20 text-sky-600 dark:text-sky-300 border border-sky-400/30 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 stroke-[1.8]" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Create a Custom Sticker
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-6 max-w-xs">
                Pick any photo, meme, or short clip. Crop, rotate, draw, and add captions!
              </p>

              <div className="grid grid-cols-2 gap-3 w-full">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-3 px-4 rounded-2xl bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 text-sky-700 dark:text-sky-300 border border-sky-300/80 dark:border-sky-800/80 flex flex-col items-center justify-center space-y-1.5 active:scale-95 transition-all cursor-pointer font-semibold text-xs shadow-xs"
                >
                  <Upload className="w-5 h-5" />
                  <span>Choose Photo</span>
                </button>

                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="py-3 px-4 rounded-2xl bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 text-sky-700 dark:text-sky-300 border border-sky-300/80 dark:border-sky-800/80 flex flex-col items-center justify-center space-y-1.5 active:scale-95 transition-all cursor-pointer font-semibold text-xs shadow-xs"
                >
                  <Camera className="w-5 h-5" />
                  <span>Take Photo</span>
                </button>
              </div>
            </div>
          ) : (
            /* Active Editing Workspace */
            <div className="w-full max-w-md flex-1 flex flex-col items-center justify-center my-auto min-h-0">
              {/* Canvas / Preview Stage */}
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl bg-white/60 dark:bg-slate-900/60 border border-sky-200/80 dark:border-sky-900/60 shadow-xl flex items-center justify-center p-4 overflow-hidden backdrop-blur-md">
                {/* Transparency pattern */}
                <div
                  className="absolute inset-0 opacity-20 pointer-events-none"
                  style={{
                    backgroundImage: "radial-gradient(#38bdf8 1px, transparent 1px)",
                    backgroundSize: "14px 14px",
                  }}
                />

                {/* Sticker Render Target */}
                <div
                  className={`relative w-full h-full flex items-center justify-center transition-all ${
                    activeCrop === "circle" ? "rounded-full overflow-hidden" : ""
                  }`}
                >
                  {fileType === "video" ? (
                    <video
                      src={previewUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="max-w-full max-h-full object-contain rounded-2xl pointer-events-none"
                    />
                  ) : (
                    <img
                      src={previewUrl}
                      alt="Sticker"
                      className="max-w-full max-h-full object-contain pointer-events-none transition-all duration-150"
                      style={{
                        transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1})`,
                        filter:
                          activeFilter === "bright"
                            ? "brightness(1.25) contrast(1.1)"
                            : activeFilter === "contrast"
                            ? "contrast(1.4) saturate(1.2)"
                            : activeFilter === "bw"
                            ? "grayscale(100%) contrast(1.2)"
                            : activeFilter === "vibrant"
                            ? "saturate(1.8) contrast(1.15)"
                            : activeStyle === "die-cut"
                            ? "drop-shadow(0 0 10px rgba(255,255,255,0.95)) drop-shadow(0 2px 8px rgba(0,0,0,0.25))"
                            : activeStyle === "sky-glow"
                            ? "drop-shadow(0 0 12px #38bdf8)"
                            : activeStyle === "neon"
                            ? "drop-shadow(0 0 14px #fe2c55)"
                            : "drop-shadow(0 2px 6px rgba(0,0,0,0.15))",
                      }}
                    />
                  )}

                  {/* Caption Overlay */}
                  {captionText.trim() && (
                    <div className="absolute bottom-2 inset-x-2 text-center pointer-events-none z-10">
                      <span
                        className="text-base sm:text-lg font-black uppercase tracking-wider inline-block px-2 py-0.5 rounded-lg"
                        style={{
                          color: captionColor,
                          textShadow:
                            "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 3px 6px rgba(0,0,0,0.8)",
                        }}
                      >
                        {captionText.trim()}
                      </span>
                    </div>
                  )}

                  {/* Interactive Drawing Canvas Layer */}
                  <canvas
                    ref={drawCanvasRef}
                    width={512}
                    height={512}
                    onMouseDown={handleDrawStart}
                    onMouseMove={handleDrawMove}
                    onMouseUp={handleDrawEnd}
                    onTouchStart={handleDrawStart}
                    onTouchMove={handleDrawMove}
                    onTouchEnd={handleDrawEnd}
                    className={`absolute inset-0 w-full h-full z-20 ${
                      isDrawingMode ? "cursor-crosshair pointer-events-auto" : "pointer-events-none"
                    }`}
                  />
                </div>

                {/* Reset button top-right */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                  }}
                  className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white active:scale-90 transition-all cursor-pointer border-0 z-30"
                  title="Remove Image"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Editing Controls Toolbar - Clean 2D Sky Blur */}
              <div className="w-full mt-4 flex flex-col space-y-3">
                {/* 1. Quick Transform Actions */}
                <div className="flex items-center justify-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setRotation((prev) => (prev + 90) % 360)}
                    className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/80 hover:bg-sky-50 dark:hover:bg-sky-950/40 text-slate-700 dark:text-slate-200 border border-sky-200/80 dark:border-sky-900/50 flex items-center space-x-1.5 text-xs font-semibold cursor-pointer active:scale-95 transition-all shadow-xs"
                    title="Rotate 90 degrees"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Rotate</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFlipH((prev) => !prev)}
                    className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/80 hover:bg-sky-50 dark:hover:bg-sky-950/40 text-slate-700 dark:text-slate-200 border border-sky-200/80 dark:border-sky-900/50 flex items-center space-x-1.5 text-xs font-semibold cursor-pointer active:scale-95 transition-all shadow-xs"
                    title="Flip Horizontal"
                  >
                    <FlipHorizontal className="w-3.5 h-3.5" />
                    <span>Flip</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveCrop((prev) => (prev === "square" ? "circle" : "square"))}
                    className={`p-2 rounded-xl border flex items-center space-x-1.5 text-xs font-semibold cursor-pointer active:scale-95 transition-all shadow-xs ${
                      activeCrop === "circle"
                        ? "bg-sky-500 text-white border-sky-500"
                        : "bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 border-sky-200/80 dark:border-sky-900/50"
                    }`}
                    title="Toggle Circle/Square crop"
                  >
                    <Crop className="w-3.5 h-3.5" />
                    <span>{activeCrop === "circle" ? "Circle" : "Square"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsDrawingMode((prev) => !prev)}
                    className={`p-2 rounded-xl border flex items-center space-x-1.5 text-xs font-semibold cursor-pointer active:scale-95 transition-all shadow-xs ${
                      isDrawingMode
                        ? "bg-sky-500 text-white border-sky-500"
                        : "bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 border-sky-200/80 dark:border-sky-900/50"
                    }`}
                    title="Draw on sticker"
                  >
                    <Brush className="w-3.5 h-3.5" />
                    <span>Doodle</span>
                  </button>
                </div>

                {/* 2. Drawing Color Palette (When Drawing Mode Active) */}
                {isDrawingMode && (
                  <div className="flex items-center justify-center space-x-2 p-2 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-sky-200/80 dark:border-sky-900/50">
                    <span className="text-[11px] font-bold text-slate-500 mr-1">Color:</span>
                    {["#0284c7", "#fe2c55", "#eab308", "#10b981", "#FFFFFF", "#000000"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setBrushColor(c)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          brushColor === c ? "scale-110 border-sky-500 ring-2 ring-sky-300" : "border-slate-300 dark:border-slate-700"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    {doodlePaths.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setDoodlePaths([])}
                        className="ml-2 text-xs text-rose-500 hover:text-rose-600 font-bold active:scale-90"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}

                {/* 3. Style Outline Selectors */}
                <div className="flex items-center justify-center space-x-1.5 p-1 bg-white/70 dark:bg-slate-900/70 rounded-2xl border border-sky-200/80 dark:border-sky-900/50">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-2">Style:</span>
                  {(
                    [
                      { id: "die-cut", label: "Die-Cut" },
                      { id: "sky-glow", label: "Sky" },
                      { id: "neon", label: "Neon" },
                      { id: "clean", label: "Clean" },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setActiveStyle(st.id)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        activeStyle === st.id
                          ? "bg-sky-500 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:bg-sky-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                {/* 4. Text Caption Overlay Input */}
                <div className="flex items-center space-x-2 bg-white/80 dark:bg-slate-900/80 rounded-2xl p-1.5 border border-sky-200/80 dark:border-sky-900/50 shadow-xs">
                  <Type className="w-4 h-4 text-sky-500 ml-2 shrink-0" />
                  <input
                    type="text"
                    value={captionText}
                    onChange={(e) => setCaptionText(e.target.value)}
                    placeholder="Add text / meme caption..."
                    maxLength={35}
                    className="flex-1 bg-transparent text-xs font-bold text-slate-800 dark:text-white placeholder-slate-400 outline-none border-0 focus:ring-0"
                  />
                  {captionText && (
                    <button
                      type="button"
                      onClick={() => setCaptionText("")}
                      className="p-1 text-slate-400 hover:text-slate-600 mr-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
