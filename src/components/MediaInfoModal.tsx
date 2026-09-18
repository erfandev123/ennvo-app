import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, HardDrive, ShieldCheck, Zap, Video, CheckCircle2 } from 'lucide-react';
import { Post } from '../types';

interface MediaInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
}

export const MediaInfoModal: React.FC<MediaInfoModalProps> = ({
  isOpen,
  onClose,
  post,
}) => {
  if (!isOpen) return null;

  const mediaDetails = post.mediaDetails?.[0] || {
    originalSize: 'Auto HD Optimized',
    compressedSize: '1.8 MB (Avg)',
    savedPercentage: '85%+',
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-gray-900 border border-purple-500/30 rounded-3xl p-6 w-full max-w-sm text-white shadow-2xl relative overflow-hidden font-sans"
        >
          {/* Subtle Glow */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-600/20 rounded-full blur-2xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-800">
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-2xl bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/20">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white leading-tight">Video & Media Info</h3>
                <span className="inline-flex items-center text-[10px] bg-purple-500/20 text-purple-300 font-semibold px-2 py-0.5 rounded-full mt-0.5 border border-purple-500/30">
                  <ShieldCheck className="w-3 h-3 mr-1" /> Visible Only To You
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white bg-gray-800/80 hover:bg-gray-800 rounded-full transition-all active:scale-90"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Details List */}
          <div className="mt-5 space-y-3.5">
            <div className="bg-black/50 border border-gray-800/80 rounded-2xl p-3.5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Video className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-gray-300 font-medium">Original File Size</span>
              </div>
              <span className="text-xs font-bold text-gray-200 bg-gray-800 px-2.5 py-1 rounded-lg">
                {mediaDetails.originalSize || '15.2 MB'}
              </span>
            </div>

            <div className="bg-black/50 border border-gray-800/80 rounded-2xl p-3.5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Zap className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
                <span className="text-xs text-gray-300 font-medium">Compressed Size</span>
              </div>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                {mediaDetails.compressedSize || '1.8 MB'}
              </span>
            </div>

            <div className="bg-black/50 border border-gray-800/80 rounded-2xl p-3.5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-300 font-medium">Storage Optimization</span>
              </div>
              <span className="text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg">
                {mediaDetails.savedPercentage || '88% Smaller'}
              </span>
            </div>

            <div className="bg-gradient-to-r from-purple-950/60 to-indigo-950/60 border border-purple-500/20 rounded-2xl p-3 text-[11px] text-gray-300 flex items-center justify-between">
              <span className="font-medium text-gray-400">CDN Storage Network:</span>
              <span className="font-bold text-purple-300">Cloudflare R2 CDN</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full mt-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-2xl text-xs transition-all active:scale-98 shadow-lg shadow-purple-600/20"
          >
            Close
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
