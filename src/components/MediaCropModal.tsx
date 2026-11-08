import React, { useState, useRef, useEffect } from 'react';
import { X, Check, ZoomIn, ZoomOut, RotateCw, Loader2 } from 'lucide-react';

interface MediaCropModalProps {
  isOpen: boolean;
  file: File | null;
  cropType: 'avatar' | 'banner';
  onClose: () => void;
  onApply: (croppedFile: File, previewUrl: string) => void;
}

export const MediaCropModal: React.FC<MediaCropModalProps> = ({
  isOpen,
  file,
  cropType,
  onClose,
  onApply,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [processing, setProcessing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!file) {
      setPreviewSrc(null);
      return;
    }

    const ext = (file.name || '').split('.').pop()?.toLowerCase() || '';
    const isVid = (file.type && file.type.startsWith('video/')) || ['mp4', 'mov', 'webm', 'mkv', '3gp', 'avi', 'm4v'].includes(ext);
    setIsVideo(isVid);

    let objectUrl = '';
    let isCancelled = false;

    try {
      objectUrl = URL.createObjectURL(file);
      setPreviewSrc(objectUrl);
    } catch (err) {
      console.warn('URL.createObjectURL failed in crop modal, fallback to FileReader:', err);
      const reader = new FileReader();
      reader.onload = () => {
        if (!isCancelled && typeof reader.result === 'string') {
          setPreviewSrc(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }

    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });

    return () => {
      isCancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file]);

  if (!isOpen || !file || !previewSrc) return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPan({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleApplyCrop = async () => {
    const isAnimatedOrVideo = isVideo || file?.type === 'image/gif' || Boolean(file?.name?.toLowerCase().endsWith('.gif'));
    if (isAnimatedOrVideo) {
      // For video or animated live image, preserve original media to maintain real live motion
      if (file && previewSrc) {
        onApply(file, previewSrc);
      }
      onClose();
      return;
    }

    const img = imageRef.current;
    if (!img) return;

    setProcessing(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      const isAvatar = cropType === 'avatar';
      const targetWidth = isAvatar ? 600 : 1200;
      const targetHeight = isAvatar ? 600 : 540;

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      // Draw background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      ctx.save();
      ctx.translate(targetWidth / 2, targetHeight / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(zoom, zoom);

      // Scale pan relative to target size vs display size
      const displayWidth = isAvatar ? 280 : 320;
      const scaleFactor = targetWidth / displayWidth;
      ctx.translate(pan.x * scaleFactor, pan.y * scaleFactor);

      // Draw image centered
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const targetAspect = targetWidth / targetHeight;

      let drawWidth = targetWidth;
      let drawHeight = targetHeight;

      if (imgAspect > targetAspect) {
        drawHeight = targetHeight;
        drawWidth = targetHeight * imgAspect;
      } else {
        drawWidth = targetWidth;
        drawHeight = targetWidth / imgAspect;
      }

      ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      ctx.restore();

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const cropped = new File([blob], file.name.replace(/\.[^/.]+$/, "") + "_cropped.jpg", {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            const newUrl = URL.createObjectURL(cropped);
            onApply(cropped, newUrl);
            onClose();
          }
          setProcessing(false);
        },
        'image/jpeg',
        0.92
      );
    } catch (err) {
      console.error('Crop error:', err);
      setProcessing(false);
      onApply(file, previewSrc);
      onClose();
    }
  };

  const isAvatar = cropType === 'avatar';

  return (
    <div className="fixed inset-0 z-[150] bg-black/85 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="w-full max-w-md flex items-center justify-between text-white py-2">
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/10 active:scale-95 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        <span className="font-semibold text-base">
          {isAvatar ? 'Adjust Profile Picture' : 'Adjust Banner'}
        </span>
        <button
          onClick={handleApplyCrop}
          disabled={processing}
          className="px-4 py-1.5 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 font-bold text-sm text-white shadow-md active:scale-95 transition-all flex items-center space-x-1"
        >
          {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          <span>Done</span>
        </button>
      </div>

      {/* Center Crop Viewport */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`relative overflow-hidden cursor-move touch-none flex items-center justify-center border-2 border-white/60 shadow-2xl transition-all ${
          isAvatar ? 'w-[280px] h-[280px] rounded-full' : 'w-full max-w-[340px] sm:max-w-[420px] h-[190px] rounded-2xl'
        }`}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
          className="w-full h-full flex items-center justify-center pointer-events-none select-none"
        >
          {isVideo ? (
            <video
              ref={videoRef}
              src={previewSrc}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              ref={imageRef}
              src={previewSrc}
              alt="Crop preview"
              className="w-full h-full object-cover"
              draggable={false}
            />
          )}
        </div>

        {/* Circular Guide overlay if avatar */}
        {isAvatar && (
          <div className="absolute inset-0 rounded-full border border-white/40 pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
        )}
      </div>

      {/* Bottom Controls */}
      <div className="w-full max-w-md bg-white/10 backdrop-blur-md rounded-3xl p-4 flex flex-col space-y-3.5 border border-white/10 text-white">
        {/* Zoom Slider */}
        <div className="flex items-center space-x-3 px-2">
          <ZoomOut className="w-4 h-4 text-white/70 shrink-0" />
          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-full accent-pink-500 cursor-pointer h-1.5 bg-white/20 rounded-lg"
          />
          <ZoomIn className="w-4 h-4 text-white/70 shrink-0" />
        </div>

        {/* Rotate and Reset Tools */}
        <div className="flex items-center justify-between text-xs font-medium px-2">
          <button
            onClick={() => setRotation((prev) => (prev + 90) % 360)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors active:scale-95"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Rotate</span>
          </button>

          <span className="text-white/60 text-[11px]">Drag to reposition</span>

          <button
            onClick={() => {
              setZoom(1);
              setRotation(0);
              setPan({ x: 0, y: 0 });
            }}
            className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors active:scale-95"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};
