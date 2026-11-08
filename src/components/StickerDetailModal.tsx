import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Bookmark, BookmarkCheck, Send, Check } from "lucide-react";
import { toggleSaveSticker, isStickerSaved } from "../services/stickerService";
import { User } from "../types";

interface StickerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  stickerUrl: string | null;
  stickerType?: "image" | "video" | "animated";
  title?: string;
  currentUser: User | null;
  onSendToChat?: (url: string, type?: "image" | "video" | "animated") => void;
}

export const StickerDetailModal: React.FC<StickerDetailModalProps> = ({
  isOpen,
  onClose,
  stickerUrl,
  stickerType = "image",
  title,
  currentUser,
  onSendToChat,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !stickerUrl) return null;

  const isSaved = currentUser?.uid ? isStickerSaved(currentUser.uid, stickerUrl) : false;
  let displayUrl = stickerUrl;
  if (displayUrl && displayUrl.includes('/uploads/')) {
    displayUrl = `/uploads/${displayUrl.split('/uploads/')[1]}`;
  }

  const isVid =
    stickerType === "video" ||
    (displayUrl && (displayUrl.endsWith(".mp4") || displayUrl.endsWith(".webm") || displayUrl.includes("video/")));
  const isImgOrVid = displayUrl && (displayUrl.startsWith('http') || displayUrl.startsWith('/') || displayUrl.startsWith('data:') || displayUrl.endsWith('.webp') || displayUrl.endsWith('.png') || displayUrl.endsWith('.gif') || displayUrl.endsWith('.jpg') || displayUrl.endsWith('.jpeg'));

  const handleToggleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser?.uid) return;
    toggleSaveSticker(currentUser.uid, {
      id: stickerUrl,
      url: displayUrl,
      title: title || "Sticker",
      type: (stickerType === "video" || stickerType === "animated") ? stickerType : "image",
    });
  };

  const handleActionSendOrShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSendToChat) {
      onSendToChat(displayUrl, stickerType);
      onClose();
    } else {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(displayUrl);
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
          onClose();
        }, 1200);
      }
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[280] bg-black/35 backdrop-blur-xs flex items-center justify-center p-4 select-none"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[290px] bg-white dark:bg-[#151518] rounded-3xl p-4 shadow-2xl border border-gray-100 dark:border-white/10 flex flex-col items-center relative text-neutral-900 dark:text-white"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-300 hover:text-black dark:hover:text-white active:scale-90 transition-all cursor-pointer border-0"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <span className="text-xs font-bold text-gray-500 dark:text-neutral-400 mb-2 tracking-tight">
            {title || "Sticker"}
          </span>

          {/* Sticker in a clean rounded box */}
          <div className="w-48 h-48 rounded-2xl bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-100 dark:border-neutral-800/80 flex items-center justify-center p-3 shadow-inner my-1 overflow-hidden">
            {isVid ? (
              <video
                src={displayUrl}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-contain pointer-events-none rounded-xl"
              />
            ) : isImgOrVid ? (
              <img
                src={displayUrl}
                alt="Sticker"
                className="w-full h-full object-contain pointer-events-none drop-shadow-md mix-blend-multiply dark:mix-blend-normal"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const el = e.currentTarget;
                  if (displayUrl.includes('/uploads/') && !el.dataset.retried) {
                    el.dataset.retried = 'true';
                    el.src = `/uploads/${displayUrl.split('/uploads/')[1]}`;
                  }
                }}
              />
            ) : (
              <span className="text-5xl select-none">{displayUrl}</span>
            )}
          </div>

          {/* Exactly 2 Clean Buttons */}
          <div className="w-full grid grid-cols-2 gap-2 mt-3 pt-1">
            {/* 1. Save Button */}
            <button
              type="button"
              onClick={handleToggleSave}
              className={`w-full py-2.5 px-2 rounded-2xl text-[12px] font-semibold flex items-center justify-center space-x-1.5 active:scale-95 transition-all cursor-pointer border ${
                isSaved
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                  : "bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-300 border-sky-200/80 dark:border-sky-800/40 hover:bg-sky-100"
              }`}
            >
              {isSaved ? (
                <>
                  <BookmarkCheck className="w-4 h-4 shrink-0" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Bookmark className="w-4 h-4 shrink-0" />
                  <span>Save</span>
                </>
              )}
            </button>

            {/* 2. Send to Chat / Share Button */}
            <button
              type="button"
              onClick={handleActionSendOrShare}
              className="w-full py-2.5 px-2 bg-gradient-to-tr from-[#fe2c55] via-rose-500 to-pink-500 hover:opacity-95 text-white rounded-2xl text-[12px] font-semibold flex items-center justify-center space-x-1.5 active:scale-95 transition-all cursor-pointer border-0 shadow-sm"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Copied</span>
                </>
              ) : onSendToChat ? (
                <>
                  <Send className="w-3.5 h-3.5 shrink-0" />
                  <span>Send</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 shrink-0" />
                  <span>Share</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
