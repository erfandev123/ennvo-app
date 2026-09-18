import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquareOff, EyeOff, Lock, Repeat, Sparkles, ArrowLeft, Shield, Sliders, HardDrive, Zap, Music, X } from 'lucide-react';
import { formatFileSize } from '../utils';

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
  selectedFiles = [],
  user,
  defaultSongTitle = '',
}) => {
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
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="fixed inset-0 z-[200] bg-gray-950 md:bg-black/40 md:backdrop-blur-xl text-white flex flex-col items-center justify-center font-sans overflow-hidden md:p-6 md:pl-28"
      >
        {/* Full Screen Android on mobile, Soft Liquid Water Glass Container on PC */}
        <div 
          className="w-full h-full md:max-w-[760px] md:h-[720px] bg-gray-950 md:bg-zinc-950/85 md:backdrop-blur-2xl md:rounded-[32px] md:border md:border-white/15 flex flex-col overflow-hidden relative shadow-2xl"
          style={{
            boxShadow: '0 25px 60px -15px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.12) inset',
          }}
        >
          {/* Top App Bar */}
          <div className="pt-10 sm:pt-4 px-4 md:px-6 pb-3 bg-gray-950 md:bg-zinc-900/40 border-b border-gray-800/80 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-all active:scale-90"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">Advanced Settings</h2>
                <p className="text-xs text-gray-400 font-normal hidden md:block">Configure distribution, interactions, and media quality</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={onClose}
                className="text-xs font-bold text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 px-4 py-2 rounded-full border border-purple-500/20"
              >
                Done
              </button>
              <button
                onClick={onClose}
                className="hidden md:flex p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content Body - Android Material Design Settings on mobile, Glass cards on PC */}
          <div className="flex-1 overflow-y-auto p-4 md:px-6 space-y-6 no-scrollbar">
            {/* Privacy Section */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 px-1 flex items-center space-x-1.5">
                <Shield className="w-3.5 h-3.5" />
                <span>Audience & Privacy</span>
              </h3>
              <div className="bg-gray-900 md:bg-white/5 border border-gray-800 md:border-white/10 rounded-2xl p-1.5 flex justify-between gap-1 shadow-sm">
                <button
                  onClick={() => setPrivacy('public')}
                  className={`flex-1 py-3 text-xs font-semibold rounded-xl transition-all ${
                    settings.privacy === 'public'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Everyone
                </button>
                <button
                  onClick={() => setPrivacy('followers')}
                  className={`flex-1 py-3 text-xs font-semibold rounded-xl transition-all ${
                    settings.privacy === 'followers'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Friends Only
                </button>
                <button
                  onClick={() => setPrivacy('private')}
                  className={`flex-1 py-3 text-xs font-semibold rounded-xl transition-all ${
                    settings.privacy === 'private'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Only Me
                </button>
              </div>
            </div>

            {/* Interaction Toggles */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 px-1">
                Comments & Interaction
              </h3>

              <div className="bg-gray-900 md:bg-white/5 border border-gray-800 md:border-white/10 rounded-2xl divide-y divide-gray-800/60 md:divide-white/10 overflow-hidden shadow-sm">
              {/* Turn off comments */}
              <div
                onClick={() => toggle('commentsDisabled')}
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-850/60 transition-colors"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                    <MessageSquareOff className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-sm font-semibold text-white">
                      Turn off commenting
                    </h4>
                    <p className="text-xs text-gray-400">
                      Prevent others from leaving comments on this post
                    </p>
                  </div>
                </div>
                {/* Android Material Switch */}
                <div
                  className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
                    settings.commentsDisabled ? 'bg-purple-600' : 'bg-gray-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                      settings.commentsDisabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </div>

              {/* Hide likes */}
              <div
                onClick={() => toggle('hideLikes')}
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-850/60 transition-colors"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center shrink-0">
                    <EyeOff className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-sm font-semibold text-white">
                      Hide like & view counts
                    </h4>
                    <p className="text-xs text-gray-400">
                      Only you will see total likes and view numbers
                    </p>
                  </div>
                </div>
                <div
                  className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
                    settings.hideLikes ? 'bg-purple-600' : 'bg-gray-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                      settings.hideLikes ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </div>

              {/* Allow Remixing */}
              <div
                onClick={() => toggle('allowRemix')}
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-850/60 transition-colors"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                    <Repeat className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-sm font-semibold text-white">
                      Allow audio remixing
                    </h4>
                    <p className="text-xs text-gray-400">
                      Let creators use your video sound in their reels
                    </p>
                  </div>
                </div>
                <div
                  className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
                    settings.allowRemix ? 'bg-purple-600' : 'bg-gray-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                      settings.allowRemix ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Song Publish Section (Original Audio to Music Library) */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 px-1 flex items-center space-x-1.5">
              <Music className="w-3.5 h-3.5" />
              <span>Publish Original Song / Audio</span>
            </h3>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl divide-y divide-gray-800/60 overflow-hidden shadow-sm">
              <div
                onClick={() => toggle('publishSong')}
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-850/60 transition-colors"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                    <Music className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-sm font-semibold text-white">
                      Publish as Original Audio
                    </h4>
                    <p className="text-xs text-gray-400">
                      Add to app audio library with your profile cover
                    </p>
                  </div>
                </div>
                <div
                  className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
                    settings.publishSong ? 'bg-purple-600' : 'bg-gray-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                      settings.publishSong ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </div>

              {settings.publishSong && (
                <div className="p-4 space-y-4 bg-gray-900/90 animate-in fade-in duration-200">
                  <div className="flex items-center space-x-3 bg-gray-950 p-3 rounded-xl border border-gray-800">
                    <img 
                      src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Artist')}`} 
                      alt="Song Cover" 
                      className="w-12 h-12 rounded-xl object-cover border border-purple-500/40"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider block">Auto Album Cover</span>
                      <p className="text-xs text-gray-400 truncate">Defaulted to your profile picture</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1.5">Song Title</label>
                    <input 
                      type="text" 
                      value={settings.songTitle || ''} 
                      onChange={(e) => onChangeSettings({ ...settings, songTitle: e.target.value })}
                      placeholder={defaultSongTitle || `Original Audio - ${user?.name || 'Artist'}`}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1.5">Artist Name</label>
                    <input 
                      type="text" 
                      value={settings.songArtist || ''} 
                      onChange={(e) => onChangeSettings({ ...settings, songArtist: e.target.value })}
                      placeholder={user?.name || 'Artist Name'}
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Media Size & Ultra Compressor Info */}
          {selectedFiles && selectedFiles.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 px-1 flex items-center space-x-1.5">
                <HardDrive className="w-3.5 h-3.5" />
                <span>Media & Compression Info</span>
              </h3>
              <div className="bg-gradient-to-br from-purple-900/40 via-gray-900 to-indigo-900/40 border border-purple-500/30 rounded-2xl p-4 space-y-3 shadow-md">
                {selectedFiles.map((f, idx) => {
                  const origSize = f.size;
                  // Estimated compressed size for heavy video/image
                  let estCompSize = origSize;
                  if (f.type.startsWith('video/') && origSize > 3 * 1024 * 1024) {
                    estCompSize = Math.max(1.5 * 1024 * 1024, origSize * 0.12);
                  } else if (f.type.startsWith('image/') && origSize > 600 * 1024) {
                    estCompSize = Math.min(700 * 1024, origSize * 0.2);
                  }
                  const saved = origSize > estCompSize ? Math.round(((origSize - estCompSize) / origSize) * 100) : 0;

                  return (
                    <div key={idx} className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0">
                          <Zap className="w-4 h-4 fill-purple-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate max-w-[180px]">{f.name}</p>
                          <p className="text-[11px] text-gray-400">
                            Original: <span className="text-gray-200 font-medium">{formatFileSize(origSize)}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-emerald-400 block">
                          ~{formatFileSize(estCompSize)}
                        </span>
                        {saved > 0 && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                            -{saved}% Smaller
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Media Quality */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 px-1">
              Media Quality
            </h3>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-sm">
              <div
                onClick={() => toggle('highQuality')}
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-850/60 transition-colors"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-sm font-semibold text-white">
                      Upload at highest quality (HD)
                    </h4>
                    <p className="text-xs text-gray-400">
                      Upload crisp high definition videos & photos
                    </p>
                  </div>
                </div>
                <div
                  className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
                    settings.highQuality ? 'bg-purple-600' : 'bg-gray-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                      settings.highQuality ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  </AnimatePresence>
);
};
