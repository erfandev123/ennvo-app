/**
 * Media Compressor Service - Direct Original Upload Bypass
 * All video and photo compressors removed per user request.
 * 100% untouched raw original video, audio, and photo files uploaded.
 * Zero sound glitch, zero audio desync, zero lag.
 */

export async function compressAvatarImage(file: File): Promise<File> {
  // Direct original upload
  return file;
}

export async function compressImage(file: File): Promise<File> {
  // Direct original upload
  return file;
}

export async function compressVideo(
  file: File,
  onProgress?: (percent: number) => void
): Promise<File> {
  // 100% original video - NO canvas or captureStream re-encoding
  if (onProgress) onProgress(100);
  return file;
}

export async function compressMediaFile(
  file: File,
  onProgress?: (percent: number) => void
): Promise<File> {
  // Direct original upload
  if (onProgress) onProgress(100);
  return file;
}
