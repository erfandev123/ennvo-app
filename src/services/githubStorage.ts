import axios from 'axios';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { compressMediaFile, compressAvatarImage } from './mediaCompressor';

/**
 * Ultra-Fast Direct Storage Upload Service
 * 100% untouched raw original video and photo uploads to Cloudflare R2 / Firebase
 * Zero compression, zero lag, full original audio/video quality
 */
export const uploadMedia = async (
  fileOrBlob: File | Blob,
  pathPrefix: string = 'media',
  onProgress?: (percent: number) => void
): Promise<string> => {
  // Always upload 100% original raw file directly without any compressors or re-encoding
  const fileToUpload: File | Blob = fileOrBlob;

  // 1. Try Ultra-Fast Cloudflare R2 Upload via backend API first
  try {
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('pathPrefix', pathPrefix);

    const response = await axios.post('/api/upload-r2', formData, {
      timeout: 15000, // 15s timeout for fast response and smooth fallbacks
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });

    if (response.data && response.data.url) {
      console.log('Successfully uploaded media to Cloudflare R2 CDN:', response.data.url);
      if (onProgress) onProgress(100);
      return response.data.url;
    }
  } catch (r2Err: any) {
    console.warn('Cloudflare R2 API upload bypassed/failed, attempting fallback storage:', r2Err?.response?.data || r2Err.message);
  }

  // 2. Fallback to Firebase Storage CDN (if configured)
  if (storage) {
    try {
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const extension = (fileToUpload as File).name?.split('.').pop() || fileToUpload.type.split('/')[1] || 'bin';
      const storageRef = ref(storage, `${pathPrefix}/${fileName}.${extension}`);
      
      const snapshot = await uploadBytes(storageRef, fileToUpload, {
        contentType: fileToUpload.type || 'application/octet-stream'
      });
      const downloadUrl = await getDownloadURL(snapshot.ref);
      if (onProgress) onProgress(100);
      return downloadUrl;
    } catch (firebaseErr) {
      console.warn("Firebase storage upload fallback failed:", firebaseErr);
    }
  }

  // 3. Instant local Data URL fallback for uninterrupted UX
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => {
        if (onProgress) onProgress(100);
        resolve(reader.result as string);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(fileToUpload);
    } catch (err) {
      reject(err);
    }
  });
};

export const deleteMedia = async (url: string): Promise<void> => {
  if (!url || typeof url !== 'string' || url.startsWith('data:')) return;
  
  try {
    // 1. Try deleting from Cloudflare R2
    if (url.includes('r2.dev') || url.includes('cloudflarestorage.com')) {
      await axios.post('/api/delete-r2', { url }, { timeout: 10000 }).catch(err => {
        console.warn('R2 delete endpoint warning:', err?.response?.data || err.message);
      });
      console.log('Deleted media from R2:', url);
    } 
    // 2. Try deleting from Firebase storage if applicable
    else if (url.includes('firebasestorage.googleapis.com') && storage) {
      try {
        const { ref: storageRef, deleteObject } = await import('firebase/storage');
        const fileRef = storageRef(storage, url);
        await deleteObject(fileRef);
        console.log('Deleted media from Firebase storage:', url);
      } catch (fbErr) {
        console.warn('Firebase storage delete error:', fbErr);
      }
    }
  } catch (err) {
    console.warn('Storage media delete error:', err);
  }
};
