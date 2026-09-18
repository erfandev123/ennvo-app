import React, { useState, useEffect, useRef } from 'react';
import { isValidImageUrl, isMediaVideo } from '../utils';

interface ReelCoverThumbnailProps {
  mediaUrl?: string;
  thumbnailUrl?: string;
  alt?: string;
  className?: string;
}

const thumbnailCache = new Map<string, string>();

export const ReelCoverThumbnail: React.FC<ReelCoverThumbnailProps> = ({
  mediaUrl,
  thumbnailUrl,
  alt = "Cover",
  className = "w-full h-full object-cover"
}) => {
  const [imgError, setImgError] = useState(false);
  const [generatedThumb, setGeneratedThumb] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const validImage = !imgError && isValidImageUrl(thumbnailUrl) ? thumbnailUrl : null;
  const targetVideoUrl = isMediaVideo(mediaUrl) ? mediaUrl : (isMediaVideo(thumbnailUrl) ? thumbnailUrl : null);

  useEffect(() => {
    if (!validImage && targetVideoUrl) {
      if (thumbnailCache.has(targetVideoUrl)) {
        setGeneratedThumb(thumbnailCache.get(targetVideoUrl)!);
        return;
      }

      // Generate video frame snapshot via HTML5 Canvas
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = `${targetVideoUrl}#t=0.5`;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';

      const handleSeeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 360;
          canvas.height = video.videoHeight || 640;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            thumbnailCache.set(targetVideoUrl, dataUrl);
            setGeneratedThumb(dataUrl);
          }
        } catch (e) {
          // Cross-origin fallback for video element
        } finally {
          video.removeEventListener('seeked', handleSeeked);
        }
      };

      video.addEventListener('seeked', handleSeeked);
      video.load();
    }
  }, [validImage, targetVideoUrl]);

  if (validImage) {
    return (
      <img
        src={validImage}
        alt={alt}
        className={className}
        onError={() => setImgError(true)}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    );
  }

  if (generatedThumb) {
    return (
      <img
        src={generatedThumb}
        alt={alt}
        className={className}
        loading="lazy"
      />
    );
  }

  if (targetVideoUrl) {
    const videoSrc = targetVideoUrl.includes('#t=') ? targetVideoUrl : `${targetVideoUrl}#t=0.5`;
    return (
      <video
        ref={videoRef}
        src={videoSrc}
        className={`${className} bg-gray-950`}
        muted
        playsInline
        // @ts-ignore
        webkit-playsinline="true"
        // @ts-ignore
        x5-playsinline="true"
        preload="metadata"
      />
    );
  }

  if (mediaUrl && isValidImageUrl(mediaUrl)) {
    return <img src={mediaUrl} alt={alt} className={className} loading="lazy" referrerPolicy="no-referrer" />;
  }

  return (
    <div className={`bg-gradient-to-br from-gray-900 to-purple-950 flex items-center justify-center text-gray-400 ${className}`}>
      <span className="text-xs font-medium text-purple-300/70">Reel</span>
    </div>
  );
};
