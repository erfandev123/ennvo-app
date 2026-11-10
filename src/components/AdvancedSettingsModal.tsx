import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Globe, 
  Users, 
  Lock, 
  MessageSquare, 
  Heart, 
  Share2, 
  Sparkles, 
  X, 
  Check, 
  DownloadCloud,
  Maximize2,
  Minimize2
} from 'lucide-react';

export interface AdvancedSettings {
  commentsDisabled: boolean;
  privacy: 'public' | 'followers' | 'private';
  hideLikes: boolean;
  allowRemix: boolean;
  highQuality: boolean;
  saveToDevice: boolean;
  publishSong?: boolean;
  songTitle?: string;
  songArtist?: string;
}

interface AdvancedSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AdvancedSettings;
  onChangeSettings: (settings: AdvancedSettings) => void;
  selectedFiles?: File[];
  user?: {
    uid?: string;
    name?: string;
    avatar?: string;
  };
  defaultSongTitle?: string;
}

export const AdvancedSettingsModal: React.FC<AdvancedSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onChangeSettings,
}) => {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 640;
  });

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleBack = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    window.addEventListener('appBackPress', handleBack);
    return () => window.removeEventListener('appBackPress', handleBack);
  }, [isOpen, onClose]);

  const [isFullScreen, setIsFullScreen] = useState(false);

  if (!isOpen) return null;

  const toggle = (key: keyof AdvancedSettings) => {
    if (key === 'privacy') return;
    onChangeSettings({
      ...settings,
      [key]: !settings[key],
    });
  };

  const setPrivacy = (privacy: 'public' | 'followers' | 'private') => {
    onChangeSettings({
      ...settings,
      privacy,
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6">
        {/* Soft frosted glass backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-md"
        />

        {/* Modal Sheet - Perfectly Centered on PC, Smooth Slide Up on Mobile */}
        <motion.div
          initial={isDesktop ? { opacity: 0, scale: 0.95, y: 15 } : { y: '100%' }}
          animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
          exit={isDesktop ? { opacity: 0, scale: 0.95, y: 15 } : { y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 350, mass: 0.7 }}
          drag={isDesktop ? false : "y"}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.15, bottom: 0.4 }}
          onDragEnd={(_, info) => {
            if (isDesktop) return;
            if (info.offset.y < -50 || info.velocity.y < -300) {
              setIsFullScreen(true);
            } else if (info.offset.y > 90 || info.velocity.y > 350) {
              if (isFullScreen) {
                setIsFullScreen(false);
              } else {
                onClose();
              }
            }
          }}
          className={`w-full max-w-[540px] bg-white/95 dark:bg-neutral-950/95 backdrop-blur-2xl flex flex-col overflow-hidden relative shadow-2xl border-0 sm:border sm:border-black/10 sm:dark:border-white/10 z-10 sm:my-auto transition-[height,border-radius] duration-300 ease-out ${
            isFullScreen
              ? 'h-[100dvh] max-h-[100dvh] rounded-none sm:rounded-[32px] sm:h-[90vh]'
              : 'h-[86vh] sm:h-[640px] max-h-[90vh] sm:max-h-[85vh] rounded-t-[34px] sm:rounded-[32px]'
          }`}
        >
          {/* Ambient Blue Glow at Top */}
          <div 
            className="pointer-events-none absolute top-0 left-0 right-0 h-44 bg-gradient-to-b from-sky-400/[0.16] via-blue-500/[0.06] to-transparent dark:from-blue-600/[0.22] dark:via-blue-800/[0.06] dark:to-transparent z-0" 
            aria-hidden="true" 
          />

          {/* Top Drag Handle Bar (Mobile Only) */}
          <div 
            onClick={() => setIsFullScreen(prev => !prev)}
            className="w-full pt-3 pb-1 flex sm:hidden items-center justify-center cursor-pointer select-none group"
            title={isFullScreen ? "Tap or drag down to shrink" : "Tap or drag up for full screen"}
          >
            <div className="w-12 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-700 group-hover:bg-neutral-400 dark:group-hover:bg-neutral-600 transition-colors" />
          </div>

          {/* Header */}
          <div className="relative z-10 px-5 pt-2 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-[18px] font-bold text-neutral-900 dark:text-white tracking-tight">
                Content Settings
              </h2>
              <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                Control audience privacy, comments, and visibility
              </p>
            </div>

            <div className="flex items-center space-x-1.5">
              {/* Fullscreen Expand/Collapse Button */}
              <button
                type="button"
                onClick={() => setIsFullScreen(prev => !prev)}
                className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-white/10 hover:bg-neutral-200 dark:hover:bg-white/15 flex items-center justify-center text-neutral-700 dark:text-neutral-200 cursor-pointer transition-all border-0 shadow-none"
                title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
              >
                {isFullScreen ? (
                  <Minimize2 className="w-4 h-4 stroke-[2.2]" />
                ) : (
                  <Maximize2 className="w-4 h-4 stroke-[2.2]" />
                )}
              </button>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-white/10 hover:bg-neutral-200 dark:hover:bg-white/15 flex items-center justify-center text-neutral-700 dark:text-neutral-200 cursor-pointer transition-all border-0 shadow-none"
                aria-label="Close"
              >
                <X className="w-4 h-4 stroke-[2.2]" />
              </button>
            </div>
          </div>

          {/* Scrollable Settings Content */}
          <div className="relative z-10 flex-1 overflow-y-auto px-5 py-2 space-y-5 no-scrollbar pb-6">
            
            {/* Section 1: Audience & Privacy */}
            <div className="space-y-2">
              <span className="text-[11.5px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider px-1">
                Audience Privacy
              </span>
              <div className="grid grid-cols-1 gap-2">
                {[
                  {
                    id: 'public' as const,
                    title: 'Public',
                    desc: 'Anyone on or off Ennvo can see this post',
                    icon: Globe,
                  },
                  {
                    id: 'followers' as const,
                    title: 'Friends / Followers',
                    desc: 'Only users following you can see this post',
                    icon: Users,
                  },
                  {
                    id: 'private' as const,
                    title: 'Only Me (Private)',
                    desc: 'Only you can view this post',
                    icon: Lock,
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = settings.privacy === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPrivacy(item.id)}
                      className={`w-full p-3.5 rounded-[22px] flex items-center justify-between text-left transition-all cursor-pointer border-0 ${
                        isSelected 
                          ? 'bg-blue-500/10 dark:bg-blue-500/15 ring-2 ring-blue-500 text-neutral-900 dark:text-white' 
                          : 'bg-neutral-100/70 dark:bg-white/[0.04] hover:bg-neutral-100 dark:hover:bg-white/[0.07] text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0 pr-2">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-blue-600 text-white' : 'bg-neutral-200 dark:bg-white/10 text-neutral-600 dark:text-neutral-300'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[13.5px] font-bold truncate">
                            {item.title}
                          </span>
                          <span className="text-[11.5px] text-neutral-500 dark:text-neutral-400 leading-tight">
                            {item.desc}
                          </span>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-blue-600 text-white' : 'border-2 border-neutral-300 dark:border-white/20'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Engagement & Comments */}
            <div className="space-y-2">
              <span className="text-[11.5px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider px-1">
                Engagement & Comments
              </span>
              <div className="bg-neutral-100/70 dark:bg-white/[0.04] rounded-[24px] p-2 space-y-1">
                
                {/* Toggle: Turn Comments On/Off */}
                <div className="p-3 rounded-[18px] flex items-center justify-between">
                  <div className="flex items-center space-x-3 pr-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-neutral-900 dark:text-white">
                        Turn Off Comments
                      </span>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        {settings.commentsDisabled ? 'Comments are disabled for everyone' : 'Allow followers to comment'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle('commentsDisabled')}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer border-0 shrink-0 ${
                      settings.commentsDisabled ? 'bg-blue-600' : 'bg-neutral-300 dark:bg-white/20'
                    }`}
                  >
                    <motion.div
                      animate={{ x: settings.commentsDisabled ? 22 : 2 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="w-5 h-5 rounded-full bg-white shadow-xs"
                    />
                  </button>
                </div>

                {/* Toggle: Hide Likes & View Counts */}
                <div className="p-3 rounded-[18px] flex items-center justify-between">
                  <div className="flex items-center space-x-3 pr-2">
                    <div className="w-8 h-8 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0">
                      <Heart className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-neutral-900 dark:text-white">
                        Hide Like & View Counts
                      </span>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        Only you will be able to see the total counts
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle('hideLikes')}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer border-0 shrink-0 ${
                      settings.hideLikes ? 'bg-blue-600' : 'bg-neutral-300 dark:bg-white/20'
                    }`}
                  >
                    <motion.div
                      animate={{ x: settings.hideLikes ? 22 : 2 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="w-5 h-5 rounded-full bg-white shadow-xs"
                    />
                  </button>
                </div>

                {/* Toggle: Allow Sharing / Remix */}
                <div className="p-3 rounded-[18px] flex items-center justify-between">
                  <div className="flex items-center space-x-3 pr-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <Share2 className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-neutral-900 dark:text-white">
                        Allow Reposts & Remix
                      </span>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        Others can repost or duet this post to their feed
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle('allowRemix')}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer border-0 shrink-0 ${
                      settings.allowRemix ? 'bg-blue-600' : 'bg-neutral-300 dark:bg-white/20'
                    }`}
                  >
                    <motion.div
                      animate={{ x: settings.allowRemix ? 22 : 2 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="w-5 h-5 rounded-full bg-white shadow-xs"
                    />
                  </button>
                </div>

              </div>
            </div>

            {/* Section 3: Media & Quality */}
            <div className="space-y-2">
              <span className="text-[11.5px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider px-1">
                Upload Quality
              </span>
              <div className="bg-neutral-100/70 dark:bg-white/[0.04] rounded-[24px] p-2 space-y-1">
                <div className="p-3 rounded-[18px] flex items-center justify-between">
                  <div className="flex items-center space-x-3 pr-2">
                    <div className="w-8 h-8 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-neutral-900 dark:text-white">
                        Upload in High Quality (HD)
                      </span>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        Upload without heavy compression for crisp details
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle('highQuality')}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer border-0 shrink-0 ${
                      settings.highQuality ? 'bg-blue-600' : 'bg-neutral-300 dark:bg-white/20'
                    }`}
                  >
                    <motion.div
                      animate={{ x: settings.highQuality ? 22 : 2 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="w-5 h-5 rounded-full bg-white shadow-xs"
                    />
                  </button>
                </div>

                <div className="p-3 rounded-[18px] flex items-center justify-between">
                  <div className="flex items-center space-x-3 pr-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <DownloadCloud className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-neutral-900 dark:text-white">
                        Save to Camera Roll
                      </span>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        Automatically keep a copy on your local storage
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle('saveToDevice')}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer border-0 shrink-0 ${
                      settings.saveToDevice ? 'bg-blue-600' : 'bg-neutral-300 dark:bg-white/20'
                    }`}
                  >
                    <motion.div
                      animate={{ x: settings.saveToDevice ? 22 : 2 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="w-5 h-5 rounded-full bg-white shadow-xs"
                    />
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* Footer Done button */}
          <div className="relative z-10 px-5 pt-2 pb-5 bg-white/50 dark:bg-neutral-950/50 backdrop-blur-md">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 rounded-full font-bold text-[14px] bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/25 transition-all cursor-pointer border-0 text-center"
            >
              Done
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
