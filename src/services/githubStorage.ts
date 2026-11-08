import axios from 'axios';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { getApiEndpoint, formatMediaUrl } from '../utils';
import { uploadDirectToR2 } from './r2Client';

/**
 * Ultra-Fast Direct Storage Upload Service
 * 1. Primary: Direct High-Speed Cloudflare R2 Upload (S3 Protocol directly to R2 edge)
 *    - Works 100% natively on Android APK / WebView, Mobile Browser, and Desktop Web.
 *    - Bypasses Cloud Run proxies, session cookies, and local timeout restrictions.
 * 2. Secondary: Server-side proxy (/api/upload-r2)
 * 3. Resilient fallback: Firebase Storage
 * 4. Image-only fallback: Compressed Base64 Data URL (<1MB)
 */
export const uploadMedia = async (
  fileOrBlob: File | Blob,
  pathPrefix: string = 'media',
  onProgress?: (percent: number) => void
): Promise<string> => {
  const fileToUpload: File | Blob = fileOrBlob;
  let extension = (fileToUpload as File).name?.split('.').pop() || fileToUpload.type.split('/')[1] || 'bin';
  if (extension === 'quicktime') extension = 'mov';
  if (extension.includes(';')) extension = extension.split(';')[0];
  
  const targetKey = `${pathPrefix}/${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;

  if (onProgress) onProgress(15);

  // 1. PRIMARY: Direct Edge Cloudflare R2 Upload (Fastest, zero-proxy, works on Android APK)
  try {
    const directR2Url = await uploadDirectToR2(
      fileToUpload,
      targetKey,
      fileToUpload.type,
      onProgress
    );
    if (directR2Url) {
      if (onProgress) onProgress(100);
      return directR2Url;
    }
  } catch (r2DirectErr: any) {
    console.warn('[Storage] Direct R2 edge upload attempt warning:', r2DirectErr?.message || r2DirectErr);
  }

  // 2. SECONDARY: Server-side API endpoint (/api/upload-r2)
  const fileObj = fileToUpload as File;
  const fileName = fileObj.name || `${pathPrefix}_${Date.now()}.${extension}`;

  const primaryEndpoint = getApiEndpoint('/api/upload-r2');
  const endpointsToTry: string[] = [primaryEndpoint];
  if (primaryEndpoint !== '/api/upload-r2') {
    endpointsToTry.push('/api/upload-r2');
  }

  for (const endpoint of endpointsToTry) {
    try {
      const formData = new FormData();
      formData.append('file', fileToUpload, fileName);
      formData.append('pathPrefix', pathPrefix);

      const response = await axios.post(endpoint, formData, {
        timeout: 180000,
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(Math.min(94, Math.max(20, percentCompleted)));
          }
        },
      });

      if (response.data && response.data.url) {
        let finalUrl = String(response.data.url);
        finalUrl = formatMediaUrl(finalUrl);
        if (onProgress) onProgress(100);
        return finalUrl;
      }
    } catch (e: any) {
      console.warn(`[Storage] Upload attempt to ${endpoint} notice:`, e?.message);
    }
  }

  // 3. Fallback: Firebase Storage
  try {
    const storageRef = ref(storage, targetKey);
    const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

    const downloadUrl = await Promise.race([
      new Promise<string>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            if (snapshot.totalBytes > 0 && onProgress) {
              const p = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              onProgress(Math.min(95, Math.max(30, p)));
            }
          },
          (error) => reject(error),
          async () => {
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(url);
            } catch (e) {
              reject(e);
            }
          }
        );
      }),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Firebase Storage timeout after 60s')), 60000)
      )
    ]);

    if (onProgress) onProgress(100);
    return downloadUrl;
  } catch (firebaseErr: any) {
    console.warn('[Storage] Firebase direct upload fallback passed:', firebaseErr?.message);
  }

  // 4. Fallback: Compact Base64 Data URL (Only for images, resized to fit Firestore < 1MB limit)
  if (fileToUpload.type.startsWith('image/')) {
    return new Promise<string>((resolve) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
        img.onload = () => {
          const maxDim = 1080;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);
            if (onProgress) onProgress(100);
            resolve(compressedBase64);
            return;
          }
          resolve(e.target?.result as string);
        };
        img.onerror = () => resolve(e.target?.result as string);
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(fileToUpload);
    });
  }

  // For video or audio files, never generate oversized base64 strings that crash Firestore
  throw new Error('Video upload failed. Please verify your network connection and try again.');
};

/**
 * Delete media file
 */
export const deleteMedia = async (urlOrPath: string): Promise<boolean> => {
  try {
    if (!urlOrPath) return false;
    if (urlOrPath.includes('firebasestorage.googleapis.com')) {
      const { ref, deleteObject } = await import('firebase/storage');
      const storageRef = ref(storage, urlOrPath);
      await deleteObject(storageRef);
      return true;
    }
    const endpoint = getApiEndpoint('/api/delete-media');
    await axios.post(endpoint, { url: urlOrPath }).catch(() => {});
    return true;
  } catch (err) {
    console.warn('[Storage] Failed to delete media:', err);
    return false;
  }
};
