export const isMediaVideo = (url?: string | null): boolean => {
  if (!url || typeof url !== 'string') return false;
  const l = url.toLowerCase();
  return l.includes('.mp4') || l.includes('.webm') || l.includes('.mov') || l.includes('/video') || l.startsWith('data:video');
};

export const isValidImageUrl = (url?: string | null): boolean => {
  if (!url || typeof url !== 'string') return false;
  return !isMediaVideo(url);
};

export const safeFile = (blob: Blob, name: string): File => {
  try {
    return new File([blob], name, { type: blob.type });
  } catch (e) {
    const b = blob as any;
    b.name = name;
    b.lastModified = Date.now();
    return b as File;
  }
};

export const formatTime = (timestamp: any) => {
  if (!timestamp) return 'Just now';
  try {
    const date = timestamp?.toDate ? timestamp.toDate() : (timestamp instanceof Date ? timestamp : new Date(typeof timestamp === 'string' || typeof timestamp === 'number' ? timestamp : Date.now()));
    if (isNaN(date.getTime())) return 'Just now';
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 30) return 'Just now';
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return date.toLocaleDateString();
  } catch (e) {
    return 'Just now';
  }
};

export const formatCount = (count: number) => {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return count.toString();
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0 || isNaN(bytes)) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Generates a high-quality, non-black video thumbnail frame from a File or video URL.
 */
export const generateVideoThumbnail = async (fileOrUrl: File | string): Promise<string> => {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';

      let src = typeof fileOrUrl === 'string' ? fileOrUrl : URL.createObjectURL(fileOrUrl);
      if (typeof fileOrUrl === 'string' && !fileOrUrl.startsWith('data:') && !fileOrUrl.startsWith('blob:')) {
        video.crossOrigin = 'anonymous';
      }
      video.src = src;

      let isSeekedOnce = false;

      const cleanup = () => {
        try {
          video.pause();
          video.onseeked = null;
          video.onloadedmetadata = null;
          video.onerror = null;
          video.removeAttribute('src');
          video.load();
        } catch (e) {}
        if (typeof fileOrUrl !== 'string' && src) {
          try { URL.revokeObjectURL(src); } catch (e) {}
        }
      };

      video.onloadedmetadata = () => {
        // Target 1.5s or 20% into duration to bypass initial black frames
        const duration = video.duration || 4;
        const targetTime = Math.min(2.0, Math.max(0.8, duration * 0.25));
        video.currentTime = targetTime;
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          const width = video.videoWidth || 640;
          const height = video.videoHeight || 360;
          canvas.width = Math.min(640, width);
          canvas.height = Math.round((canvas.width * height) / width) || 360;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Brightness check to ensure we didn't capture a pitch-black frame
            if (!isSeekedOnce) {
              try {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                let totalBrightness = 0;
                const sampleStep = Math.max(1, Math.floor(data.length / (100 * 4)));
                let samples = 0;
                for (let i = 0; i < data.length; i += sampleStep * 4) {
                  totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
                  samples++;
                }
                const avgBrightness = samples > 0 ? totalBrightness / samples : 255;

                // If initial sample frame was pitch black (< 10 brightness), seek further once
                if (avgBrightness < 10 && (video.duration || 5) > 3.0 && video.currentTime < 3.0) {
                  isSeekedOnce = true;
                  video.currentTime = 3.0;
                  return;
                }
              } catch (e) {
                // Ignore CORS taint during image data inspection fallback
              }
            }

            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            cleanup();
            return resolve(dataUrl);
          }
        } catch (e) {
          console.warn('Canvas thumbnail generation warning:', e);
        }
        cleanup();
        resolve('');
      };

      video.onerror = () => {
        cleanup();
        resolve('');
      };

      // Timeout safety net (4 seconds)
      setTimeout(() => {
        cleanup();
        resolve('');
      }, 4000);
    } catch (err) {
      resolve('');
    }
  });
};

/**
 * Triggers download of an image or video file across mobile & desktop browsers.
 */
export const downloadMediaFile = async (url: string, filename?: string) => {
  if (!url) return;
  const isVideo = isMediaVideo(url);
  const defaultExt = isVideo ? 'mp4' : 'jpg';
  const finalFilename = filename || `ennvo_media_${Date.now()}.${defaultExt}`;

  try {
    // If it's a data URL or blob URL, trigger instant direct download
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      const a = document.createElement('a');
      a.href = url;
      a.download = finalFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // Try fetching as a blob to force browser download attribute
    const res = await fetch(url, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = finalFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 20000);
    } else {
      throw new Error('Fetch not ok');
    }
  } catch (e) {
    // Direct link fallback (handles CORS restricted domains)
    const a = document.createElement('a');
    a.href = url;
    a.download = finalFilename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
};
