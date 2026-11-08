import React, { useRef, useEffect } from 'react';
import { formatMediaUrl } from '../utils';

interface VideoStickerProps {
  src: string;
  className?: string;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent | React.TouchEvent) => void;
  title?: string;
}

export const VideoSticker: React.FC<VideoStickerProps> = ({
  src,
  className = 'w-full h-full object-contain rounded-2xl pointer-events-none bg-transparent border-0 shadow-none',
  onClick,
  onContextMenu,
  title,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const formattedSrc = formatMediaUrl(src);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.defaultMuted = true;
      video.play().catch(() => {});
    }

    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (videoRef.current) {
            if (entry.isIntersecting) {
              videoRef.current.play().catch(() => {});
            } else {
              videoRef.current.pause();
            }
          }
        });
      },
      { threshold: 0.05 }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (videoRef.current) {
        try {
          videoRef.current.pause();
        } catch (e) {}
      }
    };
  }, [formattedSrc]);

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={title}
      className="w-full h-full flex items-center justify-center overflow-hidden bg-transparent border-0 shadow-none transform-gpu"
    >
      <video
        ref={videoRef}
        src={formattedSrc}
        autoPlay
        loop
        muted
        playsInline
        // @ts-ignore
        webkit-playsinline="true"
        preload="auto"
        disablePictureInPicture
        controls={false}
        className={`${className} transform-gpu`}
      />
    </div>
  );
};
