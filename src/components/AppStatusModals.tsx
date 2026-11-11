import React, { useState, useEffect } from 'react';
import { 
  Download, 
  AlertCircle, 
  ShieldAlert, 
  Hammer, 
  ExternalLink, 
  X, 
  Share2, 
  MessageSquare, 
  PlusSquare,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AndroidAppConfig } from '../services/appConfigService';
import { bridge, PendingSharePayload } from '../native/bridge';
import { useAppStore } from '../store';
import { formatTime } from '../utils';

export interface BannedInfo {
  status: 'banned' | 'suspended';
  bannedUntil?: number;
  reason?: string;
}

// 1. Banned or Suspended Account Screen
export const BannedSuspendedModal: React.FC<{ info: BannedInfo; onDismiss: () => void }> = ({
  info,
  onDismiss
}) => {
  const isSuspended = info.status === 'suspended';
  const untilFormatted = info.bannedUntil ? new Date(info.bannedUntil).toLocaleString() : 'Permanent';

  return (
    <div className="fixed inset-0 z-[99999] bg-black/80 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-2xl border border-red-200 dark:border-red-900/50 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/60 flex items-center justify-center text-red-600 mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {isSuspended ? 'Account Temporarily Suspended' : 'Account Permanently Suspended'}
        </h2>

        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          {info.reason || 'Your account was flagged for violating Ennvo community guidelines and safety rules.'}
        </p>

        {isSuspended && info.bannedUntil && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-3 mb-4 text-xs text-amber-800 dark:text-amber-200">
            Suspension ends on: <span className="font-semibold">{untilFormatted}</span>
          </div>
        )}

        <div className="space-y-2.5">
          <a
            href="mailto:ennvoapp@gmail.com?subject=Appeal%20Account%20Suspension"
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center space-x-2 transition-colors cursor-pointer"
          >
            <span>Submit Appeal to Support</span>
            <ExternalLink className="w-4 h-4" />
          </a>

          <button
            onClick={onDismiss}
            className="w-full py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-sm font-medium transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// 2. Full-Screen Maintenance Mode Screen
export const MaintenanceScreen: React.FC<{ message?: string }> = ({ message }) => {
  return (
    <div className="fixed inset-0 z-[99998] bg-white dark:bg-black flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 rounded-3xl bg-purple-50 dark:bg-purple-950/40 flex items-center justify-center text-purple-600 mb-6 shadow-xl border border-purple-100 dark:border-purple-900/40">
        <Hammer className="w-10 h-10 animate-bounce" />
      </div>

      <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-3">
        Ennvo Under Maintenance
      </h1>

      <p className="text-sm text-gray-600 dark:text-gray-300 max-w-sm mb-8 leading-relaxed">
        {message || 'We are performing scheduled infrastructure upgrades to make Ennvo even faster. Please check back shortly!'}
      </p>

      <div className="flex items-center space-x-2 text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 px-4 py-2 rounded-full">
        <Sparkles className="w-4 h-4" />
        <span>Bijoynagar & Global Cloud Systems</span>
      </div>
    </div>
  );
};

// 3. App Version Update Dialog (Forced or Optional)
export const AppUpdateModal: React.FC<{
  config: AndroidAppConfig;
  forced: boolean;
  onDismiss?: () => void;
}> = ({ config, forced, onDismiss }) => {
  const [lang, setLang] = useState<'bn' | 'en'>('bn');
  const releaseNote = config.releaseNotes?.[lang] || config.releaseNotes?.en || 'Performance improvements and bug fixes.';

  const handleUpdate = () => {
    if (config.storeUrl) {
      bridge.openStore();
    } else if (config.apkUrl) {
      bridge.openUrl(config.apkUrl);
    }
  };

  return (
    <div className="fixed inset-0 z-[99997] bg-black/75 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-2xl border border-purple-100 dark:border-purple-900/40 text-center relative"
      >
        {!forced && onDismiss && (
          <button
            onClick={onDismiss}
            className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-purple-500/25">
          <Download className="w-8 h-8" />
        </div>

        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
          {forced ? 'Update Required' : 'New Update Available'}
        </h3>
        <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold mb-4">
          Version {config.latestVersionName} (Build {config.latestVersionCode})
        </p>

        {/* Language selector for release notes */}
        <div className="flex justify-center space-x-2 mb-3">
          <button
            onClick={() => setLang('bn')}
            className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
              lang === 'bn' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
            }`}
          >
            বাংলা
          </button>
          <button
            onClick={() => setLang('en')}
            className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
              lang === 'en' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
            }`}
          >
            English
          </button>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800/60 rounded-2xl p-3 mb-6 text-left text-xs text-gray-600 dark:text-gray-300 max-h-36 overflow-y-auto leading-relaxed border border-gray-100 dark:border-white/5">
          {releaseNote}
        </div>

        <div className="space-y-2">
          <button
            onClick={handleUpdate}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl text-sm shadow-lg shadow-purple-500/25 transition-all cursor-pointer flex items-center justify-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>{forced ? 'Update Now to Continue' : 'Update Ennvo'}</span>
          </button>

          {!forced && onDismiss && (
            <button
              onClick={onDismiss}
              className="w-full py-2.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 cursor-pointer"
            >
              Maybe Later
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// 4. Share to Ennvo Sheet (Triggered by Native Intent)
export const ShareReceivedSheet: React.FC<{
  share: PendingSharePayload;
  onClose: () => void;
}> = ({ share, onClose }) => {
  const { pushPage, setShowCreatePost } = useAppStore();

  const handleShareToPost = () => {
    onClose();
    setShowCreatePost(true);
  };

  const handleShareToChat = () => {
    onClose();
    pushPage('messages');
  };

  const fileCount = share.files?.length || 0;

  return (
    <div className="fixed inset-0 z-[99996] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ y: 200, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 200, opacity: 0 }}
        className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-white/10"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Share2 className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-base text-gray-900 dark:text-white">Share to Ennvo</h3>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {share.text && (
          <p className="text-xs text-gray-600 dark:text-gray-300 mb-3 bg-gray-50 dark:bg-gray-800/70 p-3 rounded-xl border border-gray-100 dark:border-white/5 line-clamp-3">
            {share.text}
          </p>
        )}

        {fileCount > 0 && (
          <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-4">
            {fileCount} {fileCount === 1 ? 'file' : 'files'} attached
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleShareToPost}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 text-purple-700 dark:text-purple-300 font-semibold text-xs border border-purple-200 dark:border-purple-800/40 transition-colors cursor-pointer"
          >
            <PlusSquare className="w-6 h-6 mb-2" />
            <span>New Post / Reel</span>
          </button>

          <button
            onClick={handleShareToChat}
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-semibold text-xs border border-indigo-200 dark:border-indigo-800/40 transition-colors cursor-pointer"
          >
            <MessageSquare className="w-6 h-6 mb-2" />
            <span>Send in Chat</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
