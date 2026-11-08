import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Maximize2 
} from 'lucide-react';
import { Media } from '../store';
import { bridge } from '../native/bridge';

interface MediaViewerModalProps {
  media: Media;
  onClose: () => void;
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({ media, onClose }) => {
  // Extract all media items (either from mediaList or single url)
  const items = React.useMemo(() => {
    if (media.mediaList && media.mediaList.length > 0) {
      return media.mediaList;
    }
    return [{
      type: (media.type === 'video' || media.url?.includes('.mp4') || media.url?.includes('video')) ? 'video' : 'image',
      url: media.url
    }];
  }, [media]);

  const [currentIndex, setCurrentIndex] = useState(() => {
    if (typeof media.initialIndex === 'number' && media.initialIndex >= 0 && media.initialIndex < items.length) {
      return media.initialIndex;
    }
    return 0;
  });

  const currentItem = items[currentIndex] || items[0];
  const isVideo = currentItem.type === 'video' || currentItem.url?.includes('.mp4') || currentItem.url?.includes('video');

  // Zoom and Pan State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  
  // Touch Pinch state
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartScaleRef = useRef<number>(1);
  const lastTapRef = useRef<number>(0);

  // Container reference
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset zoom on item change
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  // Picture-in-Picture integration for full-screen video
  useEffect(() => {
    if (isVideo) {
      bridge.setPip(true, 9, 16);
    }
    return () => {
      bridge.setPip(false, 0, 0);
    };
  }, [isVideo]);

  // Smooth Zoom In
  const handleZoomIn = () => {
    setScale((prev) => Math.min(4, Number((prev + 0.5).toFixed(2))));
  };

  // Smooth Zoom Out
  const handleZoomOut = () => {
    setScale((prev) => {
      const next = Math.max(1, Number((prev - 0.5).toFixed(2)));
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  // Reset Zoom
  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Double Click / Double Tap to Zoom
  const handleDoubleTap = (e: React.MouseEvent | React.TouchEvent) => {
    if (isVideo) return;
    if (scale > 1) {
      handleResetZoom();
    } else {
      setScale(2.5);
      setPosition({ x: 0, y: 0 });
    }
  };

  // Touch handlers for Pinch to Zoom & Double Tap
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 2 fingers: pinch to zoom
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
      touchStartScaleRef.current = scale;
    } else if (e.touches.length === 1) {
      // Check double tap
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        handleDoubleTap(e);
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;

      // Start drag if zoomed in
      if (scale > 1) {
        setIsDragging(true);
        dragStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          posX: position.x,
          posY: position.y
        };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      // Pinching
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / touchStartDistRef.current;
      const newScale = Math.max(1, Math.min(4, Number((touchStartScaleRef.current * ratio).toFixed(2))));
      setScale(newScale);
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      // Panning
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      
      const maxPanX = (scale - 1) * (window.innerWidth / 2);
      const maxPanY = (scale - 1) * (window.innerHeight / 2);

      setPosition({
        x: Math.max(-maxPanX, Math.min(maxPanX, dragStartRef.current.posX + dx)),
        y: Math.max(-maxPanY, Math.min(maxPanY, dragStartRef.current.posY + dy))
      });
    }
  };

  const handleTouchEnd = () => {
    touchStartDistRef.current = null;
    setIsDragging(false);
  };

  // Mouse Drag to Pan when Zoomed
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1 || isVideo) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    const maxPanX = (scale - 1) * (window.innerWidth / 2);
    const maxPanY = (scale - 1) * (window.innerHeight / 2);

    setPosition({
      x: Math.max(-maxPanX, Math.min(maxPanX, dragStartRef.current.posX + dx)),
      y: Math.max(-maxPanY, Math.min(maxPanY, dragStartRef.current.posY + dy))
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && currentIndex < items.length - 1 && scale === 1) {
        setCurrentIndex(prev => prev + 1);
      } else if (e.key === 'ArrowLeft' && currentIndex > 0 && scale === 1) {
        setCurrentIndex(prev => prev - 1);
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleResetZoom();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, items.length, scale, onClose]);

  // Download media
  const handleDownload = async () => {
    try {
      const url = currentItem.url;
      const filename = `ennvo_${isVideo ? 'video' : 'photo'}_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      window.open(currentItem.url, '_blank');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[#030a1a]/95 backdrop-blur-2xl select-none animate-in fade-in duration-200 overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Ambient Blue Radial Glows */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_0%,rgba(37,99,235,0.28),transparent_70%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_100%,rgba(14,165,233,0.18),transparent_75%)]" aria-hidden="true" />

      {/* Top Bar: User Info & Close / Download */}
      <div className="absolute top-0 inset-x-0 z-50 flex items-center justify-between p-3.5 pt-7 sm:pt-5 sm:p-5 md:p-6 bg-gradient-to-b from-[#030a1a]/90 via-[#071530]/50 to-transparent pointer-events-auto">
        <div className="flex items-center space-x-2.5 sm:space-x-3">
          {media.user ? (
            <div className="flex items-center space-x-2.5 bg-blue-950/70 hover:bg-blue-900/60 transition-colors backdrop-blur-xl pl-1.5 pr-3.5 py-1.5 rounded-full border border-blue-500/30 shadow-[0_4px_20px_rgba(29,78,216,0.3)]">
              <img 
                src={media.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(media.user.name || 'User')}&background=random`} 
                className="w-8 h-8 rounded-full ring-2 ring-blue-400/90 object-cover shrink-0" 
                alt={media.user.name || 'User'} 
                referrerPolicy="no-referrer"
              />
              <span className="text-white font-semibold text-xs md:text-sm drop-shadow-md truncate max-w-[130px] sm:max-w-[200px]">
                {media.user.name || 'User'}
              </span>
            </div>
          ) : null}
          {items.length > 1 && (
            <div className="bg-blue-600/30 backdrop-blur-xl text-blue-200 text-xs font-semibold px-3 py-1.5 rounded-full border border-blue-400/40 shadow-sm tabular-nums">
              {currentIndex + 1} / {items.length}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button 
            type="button"
            onClick={handleDownload} 
            className="p-2.5 bg-blue-950/70 hover:bg-blue-600 active:scale-95 rounded-full transition-all text-blue-100 hover:text-white backdrop-blur-xl shadow-lg shadow-blue-950/40 cursor-pointer border border-blue-500/30"
            title="Download original"
          >
            <Download className="w-5 h-5" />
          </button>
          <button 
            type="button"
            onClick={onClose} 
            className="p-2.5 bg-blue-950/70 hover:bg-red-600/90 active:scale-95 rounded-full transition-all text-blue-100 hover:text-white backdrop-blur-xl shadow-lg shadow-blue-950/40 cursor-pointer border border-blue-500/30"
            title="Close viewer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Navigation Arrows for Multiple Media */}
      {items.length > 1 && currentIndex > 0 && scale === 1 && (
        <button
          type="button"
          onClick={() => setCurrentIndex(prev => prev - 1)}
          className="absolute left-3 md:left-6 z-40 p-3 rounded-full bg-blue-950/80 hover:bg-blue-600 active:scale-90 text-white backdrop-blur-xl border border-blue-400/30 shadow-[0_4px_24px_rgba(29,78,216,0.45)] transition-all cursor-pointer"
          title="Previous photo"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {items.length > 1 && currentIndex < items.length - 1 && scale === 1 && (
        <button
          type="button"
          onClick={() => setCurrentIndex(prev => prev + 1)}
          className="absolute right-3 md:right-6 z-40 p-3 rounded-full bg-blue-950/80 hover:bg-blue-600 active:scale-90 text-white backdrop-blur-xl border border-blue-400/30 shadow-[0_4px_24px_rgba(29,78,216,0.45)] transition-all cursor-pointer"
          title="Next photo"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Center Media Stage */}
      <div 
        ref={containerRef}
        className="w-full h-full flex items-center justify-center p-2 sm:p-6 md:p-10 overflow-hidden cursor-default relative touch-none z-10"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        {isVideo ? (
          <div className="relative max-w-full max-h-[85vh] flex items-center justify-center">
            <video
              src={currentItem.url}
              controls
              autoPlay
              playsInline
              className="max-w-full max-h-[85vh] object-contain shadow-2xl rounded-2xl ring-1 ring-blue-500/20"
            />
          </div>
        ) : (
          <div 
            className="w-full h-full flex items-center justify-center transform-gpu"
            style={{
              cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
            }}
            onDoubleClick={handleDoubleTap}
          >
            <img
              src={currentItem.url}
              alt="Media full view"
              referrerPolicy="no-referrer"
              draggable={false}
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-[0_25px_70px_-15px_rgba(29,78,216,0.35)] ring-1 ring-blue-500/30 select-none transform-gpu"
              style={{
                transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
                transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
                willChange: 'transform',
                imageRendering: 'auto'
              }}
            />
          </div>
        )}
      </div>

      {/* Bottom Floating Control Pill (Ultra Fast Smooth Zoom Controls) */}
      {!isVideo && (
        <div className={`absolute ${items.length > 1 ? 'bottom-16 sm:bottom-20' : 'bottom-4 sm:bottom-6'} inset-x-0 z-50 flex items-center justify-center pointer-events-none px-4 transition-all duration-200`}>
          <div className="pointer-events-auto flex items-center space-x-2 bg-blue-950/80 backdrop-blur-2xl border border-blue-500/40 px-3.5 py-1.5 rounded-full shadow-[0_8px_32px_rgba(29,78,216,0.35)] text-blue-100">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={scale <= 1}
              className="p-1.5 hover:bg-blue-600/40 active:scale-90 rounded-full transition-all disabled:opacity-30 cursor-pointer text-blue-200 hover:text-white"
              title="Zoom out (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleResetZoom}
              className="px-2.5 py-0.5 text-xs font-bold bg-blue-600/30 hover:bg-blue-600/50 active:scale-95 rounded-full transition-all cursor-pointer tabular-nums text-blue-100 border border-blue-400/25"
              title="Click to reset (100%)"
            >
              {Math.round(scale * 100)}%
            </button>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={scale >= 4}
              className="p-1.5 hover:bg-blue-600/40 active:scale-90 rounded-full transition-all disabled:opacity-30 cursor-pointer text-blue-200 hover:text-white"
              title="Zoom in (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            {scale > 1 && (
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1.5 hover:bg-blue-600/40 active:scale-90 rounded-full transition-all ml-1 cursor-pointer text-sky-300 hover:text-white"
                title="Reset zoom"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Thumbnail Bar if Album has multiple items */}
      {items.length > 1 && scale === 1 && (
        <div className="absolute bottom-3 sm:bottom-4 inset-x-0 z-40 flex items-center justify-center pointer-events-none px-4">
          <div className="pointer-events-auto flex items-center space-x-2 max-w-sm overflow-x-auto no-scrollbar p-1.5 bg-blue-950/70 backdrop-blur-2xl rounded-2xl border border-blue-500/30 shadow-2xl">
            {items.map((it, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer relative ${
                  currentIndex === idx ? 'border-blue-400 scale-105 shadow-[0_0_12px_rgba(59,130,246,0.6)]' : 'border-transparent opacity-60 hover:opacity-90'
                }`}
              >
                {it.type === 'video' || it.url.includes('.mp4') ? (
                  <div className="w-full h-full bg-blue-950/90 flex items-center justify-center">
                    <Play className="w-4 h-4 text-white fill-white" />
                  </div>
                ) : (
                  <img src={it.url} alt={`thumb ${idx}`} className="w-full h-full object-cover" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
