import axios from 'axios';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Cloudflare R2 Credentials & Public CDN configurations
const R2_CONFIG = {
  endpoint: 'https://f45c8ffc24470718062d4b2eab12c2cd.r2.cloudflarestorage.com',
  accessKeyId: 'b907a6aad2fb1bd63ab552c6e0ea67c0',
  secretAccessKey: '8b19ea3cf08bc63917e1fdc9f94c357afe5efc07a1c22353687340b75a4543a7',
  bucket: 'ennvo-storage',
  publicDomain: 'https://pub-320091ef45b945e6a22b05cf96d6b9b9.r2.dev',
};

// Lazy client for direct R2 client-side upload (failsafe for Android WebViews, Capacitor, and remote embeds)
let clientR2: S3Client | null = null;
function getClientR2(): S3Client {
  if (!clientR2) {
    clientR2 = new S3Client({
      region: 'auto',
      endpoint: R2_CONFIG.endpoint,
      credentials: {
        accessKeyId: R2_CONFIG.accessKeyId,
        secretAccessKey: R2_CONFIG.secretAccessKey,
      },
    });
  }
  return clientR2;
}

// Generate candidate API endpoints (local relative + live Cloud Run backend for WebViews)
const getCandidateApiEndpoints = (endpointPath: string): string[] => {
  const endpoints: string[] = [];
  const isCapacitorOrLocal = typeof window !== 'undefined' && (
    (window as any).Capacitor?.isNativePlatform?.() ||
    window.location.protocol === 'capacitor:' ||
    (window.location.hostname === 'localhost' && window.location.port !== '3000') ||
    window.location.protocol === 'file:'
  );

  // In standard browser environment, try relative endpoint first
  if (!isCapacitorOrLocal) {
    endpoints.push(endpointPath);
  }

  // Deployed Cloud Run live API base URLs (crucial for Android WebView, Capacitor APKs, and external viewers)
  const remoteBaseUrls = [
    'https://ais-pre-bqejfrjeghyo7rnrdlrosm-663053662809.asia-southeast1.run.app',
    'https://ais-dev-bqejfrjeghyo7rnrdlrosm-663053662809.asia-southeast1.run.app'
  ];

  for (const base of remoteBaseUrls) {
    endpoints.push(`${base}${endpointPath}`);
  }

  if (!endpoints.includes(endpointPath)) {
    endpoints.push(endpointPath);
  }

  return endpoints;
};

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
  const fileToUpload: File | Blob = fileOrBlob;
  const extension = (fileToUpload as File).name?.split('.').pop() || fileToUpload.type.split('/')[1] || 'bin';
  const targetKey = `${pathPrefix}/${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;

  // 1. Try Cloudflare R2 Upload via backend API (testing available candidate endpoints including remote Cloud Run for WebViews)
  const candidateEndpoints = getCandidateApiEndpoints('/api/upload-r2');
  for (const apiEndpoint of candidateEndpoints) {
    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('pathPrefix', pathPrefix);

      const response = await axios.post(apiEndpoint, formData, {
        timeout: 90000,
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percentCompleted);
          }
        },
      });

      if (response.data && response.data.url) {
        let finalUrl = response.data.url;
        if (finalUrl.startsWith('/')) {
          const origin = apiEndpoint.startsWith('http') 
            ? new URL(apiEndpoint).origin 
            : window.location.origin;
          finalUrl = `${origin}${finalUrl}`;
        }
        console.log('Successfully uploaded media via R2 API:', finalUrl);
        if (onProgress) onProgress(100);
        return finalUrl;
      }
    } catch (r2Err: any) {
      console.warn(`Upload attempt failed on endpoint ${apiEndpoint}:`, r2Err?.response?.data || r2Err.message);
    }
  }

  // 2. Direct Cloudflare R2 Client-Side Upload (Direct AWS S3Client PUT to R2 Bucket with CORS)
  // This completely solves the WebView problem where local /api routes do not exist
  try {
    const s3 = getClientR2();
    const arrayBuffer = await fileToUpload.arrayBuffer();
    const putCmd = new PutObjectCommand({
      Bucket: R2_CONFIG.bucket,
      Key: targetKey,
      Body: new Uint8Array(arrayBuffer),
      ContentType: fileToUpload.type || 'application/octet-stream',
    });

    await s3.send(putCmd);
    const directUrl = `${R2_CONFIG.publicDomain}/${targetKey}`;
    console.log('Successfully uploaded directly to Cloudflare R2:', directUrl);
    if (onProgress) onProgress(100);
    return directUrl;
  } catch (directErr: any) {
    console.warn('Direct Cloudflare R2 upload fallback error:', directErr?.message || directErr);
  }

  // 3. Fallback to Firebase Storage CDN (if configured)
  if (storage) {
    try {
      const storageRef = ref(storage, targetKey);
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

  // 4. Instant local Data URL fallback (as absolute last resort for offline/local view)
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

  // 1. Try deleting from Cloudflare R2 (API endpoints first)
  if (url.includes('r2.dev') || url.includes('cloudflarestorage.com')) {
    const candidateEndpoints = getCandidateApiEndpoints('/api/delete-r2');
    let deletedViaApi = false;
    for (const ep of candidateEndpoints) {
      try {
        await axios.post(ep, { url }, { timeout: 10000 });
        deletedViaApi = true;
        console.log(`Deleted media via ${ep}:`, url);
        break;
      } catch (err: any) {
        // try next endpoint
      }
    }

    // Direct S3 client delete fallback
    if (!deletedViaApi) {
      try {
        const s3 = getClientR2();
        let targetKey = url;
        try {
          const urlObj = new URL(url);
          targetKey = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
        } catch (e) {}
        
        await s3.send(new DeleteObjectCommand({
          Bucket: R2_CONFIG.bucket,
          Key: targetKey,
        }));
        console.log('Directly deleted media from Cloudflare R2:', targetKey);
      } catch (dirErr: any) {
        console.warn('Direct R2 delete error:', dirErr?.message || dirErr);
      }
    }
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
};
