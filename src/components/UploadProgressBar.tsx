import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useAppStore } from '../store';

export const UploadProgressBar: React.FC = () => {
  const { uploadTask } = useAppStore();

  if (!uploadTask) return null;

  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (uploadTask.progress / 100) * circumference;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -50, scale: 0.8, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: -50, scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 350 }}
        className="fixed top-3 left-1/2 -translate-x-1/2 z-[99999] pointer-events-none"
      >
        <div className="bg-black/90 backdrop-blur-xl border border-white/20 rounded-full px-3.5 py-1.5 text-white shadow-2xl flex items-center space-x-2.5 pointer-events-auto border-solid">
          {uploadTask.status === 'uploading' && (
            <div className="relative w-6 h-6 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 transform -rotate-90" viewBox="0 0 28 28">
                <circle
                  cx="14"
                  cy="14"
                  r={radius}
                  className="text-white/20 stroke-current"
                  strokeWidth="3"
                  fill="transparent"
                />
                <circle
                  cx="14"
                  cy="14"
                  r={radius}
                  className="text-purple-400 stroke-current transition-all duration-300"
                  strokeWidth="3"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
            </div>
          )}

          {uploadTask.status === 'completed' && (
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          )}

          {uploadTask.status === 'error' && (
            <div className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
          )}

          <div className="flex items-center space-x-1.5 text-xs font-medium tracking-tight">
            <span className="text-white font-semibold">
              {uploadTask.status === 'uploading' && `Uploading`}
              {uploadTask.status === 'completed' && `Uploaded! 🎉`}
              {uploadTask.status === 'error' && `Failed`}
            </span>
            {uploadTask.status === 'uploading' && (
              <span className="text-purple-300 font-mono text-[11px] font-bold">
                {uploadTask.progress}%
              </span>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
