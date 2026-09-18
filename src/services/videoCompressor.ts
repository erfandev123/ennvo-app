import { compressVideo, compressMediaFile, compressImage } from './mediaCompressor';

export async function compressVideoIfNeeded(
  file: File,
  onProgress?: (percent: number) => void
): Promise<File> {
  return compressVideo(file, onProgress);
}

export { compressVideo, compressMediaFile, compressImage };
