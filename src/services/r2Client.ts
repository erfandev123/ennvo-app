import axios from 'axios';
import { getApiEndpoint } from '../utils';

/**
 * Direct High-Speed Cloudflare R2 Edge Upload
 * The server issues a short-lived presigned URL, so no storage credentials
 * are ever shipped to the browser bundle or the Android APK.
 * Operates on Web, Mobile Chrome/Safari, and Android WebView APK.
 */
export const uploadDirectToR2 = async (
  fileOrBlob: File | Blob,
  key: string,
  contentType?: string,
  onProgress?: (percent: number) => void
): Promise<string> => {
  const finalContentType = contentType || fileOrBlob.type || 'application/octet-stream';
  if (onProgress) onProgress(15);

  // 1. Ask our backend for a short-lived presigned PUT URL
  const presignResponse = await axios.post(
    getApiEndpoint('/api/r2-presign'),
    { key, contentType: finalContentType },
    { timeout: 30000 }
  );

  const uploadUrl = presignResponse.data?.uploadUrl;
  const publicUrl = presignResponse.data?.publicUrl;

  if (!uploadUrl || !publicUrl) {
    throw new Error('Could not get an R2 upload URL');
  }

  // 2. Upload the bytes straight to the R2 edge
  await axios.put(uploadUrl, fileOrBlob, {
    headers: { 'Content-Type': finalContentType },
    timeout: 300000,
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(Math.min(95, Math.max(20, percent)));
      }
    },
  });

  if (onProgress) onProgress(98);
  return publicUrl as string;
};
