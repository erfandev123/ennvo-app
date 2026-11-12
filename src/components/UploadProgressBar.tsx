import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, EyeOff, Eye, UploadCloud } from 'lucide-react';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';

export const UploadProgressBar: React.FC = () => {
  const { uploadTask, setUploadTask } = useAppStore(useShallow((s: any) => ({ uploadTask: s.uploadTask, setUploadTask: s.setUploadTask })));
  const [isMinimized, setIsMinimized] = useState(false);

  if (!uploadTask) return null;

  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (uploadTask.progress / 100) * circumference;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -40, scale: 0.9, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: -40, scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 380 }}
        className="fixed top-2 sm:top-3 left-1/2 -translate-x-1/2 z-[99999] pointer-events-none px-3 max-w-sm w-full flex justify-center pt-safe"
      >
        {isMinimized ? (
          /* Minimized discreet floating pill */
          <div 
            onClick={() => setIsMinimized(false)}
            className="pointer-events-auto cursor-pointer bg-neutral-900/90 hover:bg-neutral-900 text-white border border-white/20 rounded-full px-2.5 py-1 flex items-center space-x-1.5 shadow-xl backdrop-blur-xl transition-all transform-gpu"
            title="Click to view upload progress"
          >
            <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            <UploadCloud className="w-3.5 h-3.5 text-violet-300" />
            <span className="text-[11px] font-bold text-violet-200">{uploadTask.progress}%</span>
            <Eye className="w-3 h-3 text-neutral-400 ml-0.5" />
          </div>
        ) : (
          /* Sleek compact modern upload card */
          <div className="pointer-events-auto bg-[#0d0f17]/95 text-white border border-white/15 rounded-full pl-3 pr-2 py-1.5 shadow-2xl backdrop-blur-xl flex items-center space-x-2.5 max-w-[340px] w-auto transform-gpu select-none">
            {/* Circular Progress Ring */}
            {uploadTask.status === 'uploading' && (
              <div className="relative w-5 h-5 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 transform -rotate-90" viewBox="0 0 24 24">
                  <circle
                    cx="12"
                    cy="12"
                    r={radius}
                    className="text-white/15 stroke-current"
                    strokeWidth="2.5"
                    fill="transparent"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r={radius}
                    className="text-gradient-purple stroke-current transition-all duration-200"
                    stroke="#a855f7"
                    strokeWidth="2.5"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
              </div>
            )}

            {uploadTask.status === 'completed' && (
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            )}

            {uploadTask.status === 'error' && (
              <div className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
            )}

            {/* Title & percentage */}
            <div className="flex items-center space-x-2 min-w-0 pr-1">
              <span className="text-[12px] font-medium text-neutral-200 truncate max-w-[150px]">
                {uploadTask.status === 'uploading' && (uploadTask.title || 'Uploading...')}
                {uploadTask.status === 'completed' && 'Uploaded! 🎉'}
                {uploadTask.status === 'error' && 'Upload Failed'}
              </span>
              {uploadTask.status === 'uploading' && (
                <span className="text-purple-400 font-mono text-[11.5px] font-bold shrink-0">
                  {uploadTask.progress}%
                </span>
              )}
            </div>

            {/* Hide / Minimize button or Dismiss on error/completed */}
            {uploadTask.status === 'uploading' ? (
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="p-1 hover:bg-white/10 text-neutral-400 hover:text-white rounded-full transition-colors cursor-pointer shrink-0"
                title="Hide popup (Upload continues in background)"
              >
                <EyeOff className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setUploadTask(null)}
                className="p-1 hover:bg-white/10 text-neutral-400 hover:text-white rounded-full transition-colors cursor-pointer shrink-0"
                title="Dismiss"
              >
                <span className="text-xs font-bold leading-none px-1">✕</span>
              </button>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
