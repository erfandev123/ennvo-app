import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, Send, Trash2, Edit3, MessageCircle, Sparkles, Plus } from "lucide-react";
import { useAppStore } from "../store";

interface StoryNoteViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteUser: {
    id: string;
    name: string;
    avatar: string;
    username?: string;
    statusNote: string;
    timestamp?: number;
  } | null;
  currentUserId?: string;
  onReply?: (targetUserId: string, messageText: string, noteText: string) => Promise<void>;
  onSendReaction?: (targetUserId: string, emoji: string, noteText: string) => Promise<void>;
  onDeleteMyNote?: () => void;
  onEditMyNote?: () => void;
  onNewNote?: () => void;
  onEditNote?: () => void;
}

const QUICK_EMOJIS = ["❤️", "😂", "🔥", "👏", "😮", "😢", "😍", "🎉"];

export default function StoryNoteViewerModal({
  isOpen,
  onClose,
  noteUser,
  currentUserId,
  onReply,
  onSendReaction,
  onDeleteMyNote,
  onEditMyNote,
  onNewNote,
  onEditNote,
}: StoryNoteViewerModalProps) {
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressIntervalRef = useRef<any>(null);

  const setIsBottomNavHidden = useAppStore((state) => state.setIsBottomNavHidden);

  const isMe = currentUserId && noteUser && currentUserId === noteUser.id;

  // Hide mobile bottom navigation completely while viewing note
  useEffect(() => {
    if (isOpen) {
      setIsBottomNavHidden(true);
      return () => {
        setIsBottomNavHidden(false);
      };
    }
  }, [isOpen, setIsBottomNavHidden]);

  // Auto-progress bar (Story style: 7 seconds total)
  useEffect(() => {
    if (!isOpen || !noteUser) {
      setProgress(0);
      return;
    }

    setProgress(0);
    const DURATION = 7000; // 7 seconds
    const STEP = 50;

    progressIntervalRef.current = setInterval(() => {
      if (isPaused) return;
      setProgress((prev) => {
        const next = prev + (STEP / DURATION) * 100;
        if (next >= 100) {
          clearInterval(progressIntervalRef.current);
          onClose();
          return 100;
        }
        return next;
      });
    }, STEP);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isOpen, noteUser, isPaused, onClose]);

  // Clean toast timer
  useEffect(() => {
    if (!showToast) return;
    const timer = setTimeout(() => setShowToast(null), 2500);
    return () => clearTimeout(timer);
  }, [showToast]);

  const triggerFloatingEmoji = (emoji: string) => {
    const id = Date.now() + Math.random();
    const x = Math.floor(Math.random() * 120) - 60;
    setFloatingEmojis((prev) => [...prev, { id, emoji, x }]);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((item) => item.id !== id));
    }, 1800);
  };

  const handleSendReaction = async (emoji: string) => {
    if (!noteUser) return;
    triggerFloatingEmoji(emoji);
    if (onSendReaction) {
      try {
        await onSendReaction(noteUser.id, emoji, noteUser.statusNote);
        setShowToast(`Sent ${emoji} to ${noteUser.name}`);
      } catch (e) {
        setShowToast(`Reacted ${emoji}`);
      }
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !noteUser || isSending) return;
    setIsSending(true);
    try {
      if (onReply) {
        await onReply(noteUser.id, replyText.trim(), noteUser.statusNote);
      }
      setReplyText("");
      setShowToast(`Message sent to ${noteUser.name}`);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (e) {
      setShowToast("Failed to send reply");
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen || !noteUser) return null;
  if (typeof document === "undefined") return null;

  const modalContent = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[99999] flex flex-col justify-between bg-black/95 text-white select-none overflow-hidden touch-manipulation font-sans [webkit-font-smoothing:antialiased]"
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
      >
        {/* Soft Ambient Colorful Top & Center Glow matching feed */}
        <div 
          className="pointer-events-none fixed top-0 left-0 right-0 h-[360px] bg-gradient-to-b from-sky-500/25 via-blue-600/10 to-transparent z-0" 
          aria-hidden="true" 
        />
        <div 
          className="pointer-events-none fixed -top-20 left-1/2 -translate-x-1/2 w-[340px] h-[340px] rounded-full bg-blue-500/20 blur-[100px] z-0" 
          aria-hidden="true" 
        />

        {/* Floating Emojis Burst Overlay */}
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          {floatingEmojis.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 1, y: "70vh", scale: 0.8, x: `calc(50% + ${item.x}px)` }}
              animate={{ opacity: 0, y: "25vh", scale: 1.6, x: `calc(50% + ${item.x * 1.5}px)` }}
              transition={{ duration: 1.6, ease: "easeOut" }}
              className="absolute text-5xl"
            >
              {item.emoji}
            </motion.div>
          ))}
        </div>

        {/* Story Top Progress Bar */}
        <div className="relative z-20 px-3.5 pt-[calc(env(safe-area-inset-top,0px)+10px)] pb-2 flex items-center space-x-1">
          <div className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-[width] duration-75 ease-linear rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Story Header */}
        <div className="relative z-20 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-[2px] rounded-full bg-gradient-to-tr from-sky-400 via-blue-500 to-indigo-500">
              <img
                src={noteUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(noteUser.name)}&background=random`}
                alt={noteUser.name}
                className="w-10 h-10 rounded-full object-cover border border-black/40"
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-[15px] text-white tracking-tight leading-tight">
                  {noteUser.name}
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-sky-500/30 text-sky-300 text-[10px] font-bold uppercase tracking-wider">
                  Note
                </span>
              </div>
              <span className="text-[11.5px] text-neutral-400">
                {isMe ? "Your note · Active for 24h" : "Active today"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 transition-all flex items-center justify-center text-white cursor-pointer border-0"
            title="Close"
          >
            <X className="w-5 h-5" strokeWidth={2.4} />
          </button>
        </div>

        {/* Center Stage: Aesthetic Story Note Card (Note box on TOP, Profile photo BELOW) */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="flex flex-col items-center max-w-sm w-full"
          >
            {/* 1. Giant Frosted Glass Note Bubble on TOP */}
            <div className="w-full bg-white/15 dark:bg-white/10 backdrop-blur-2xl border border-white/25 rounded-[32px] p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute top-3 right-4 opacity-25">
                <Sparkles className="w-5 h-5 text-sky-300" />
              </div>

              <p className="text-[21px] sm:text-[23px] font-extrabold text-white leading-relaxed tracking-tight break-words whitespace-pre-wrap max-w-full">
                "{noteUser.statusNote}"
              </p>

              <div className="mt-4 pt-3 border-t border-white/10 w-full flex items-center justify-center space-x-1.5 text-neutral-300 text-[12px] font-medium">
                <MessageCircle className="w-3.5 h-3.5 text-sky-400" />
                <span>Status Note</span>
              </div>
            </div>

            {/* 2. Thought Dots pointing DOWNWARD to profile */}
            <div className="flex flex-col items-center space-y-1.5 my-3 pointer-events-none">
              <div className="w-3.5 h-3.5 rounded-full bg-white/80 backdrop-blur-md shadow-xs" />
              <div className="w-2 h-2 rounded-full bg-white/60 backdrop-blur-md shadow-xs" />
            </div>

            {/* 3. Profile Avatar & Name BELOW (nice) */}
            <div className="flex flex-col items-center mt-1">
              <div className="p-1 rounded-full bg-gradient-to-tr from-sky-400 via-blue-500 to-indigo-600 shadow-xl">
                <img
                  src={noteUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(noteUser.name)}&background=random`}
                  alt={noteUser.name}
                  className="w-20 h-20 rounded-full object-cover border-2 border-black/80"
                />
              </div>
              <span className="mt-2.5 font-bold text-white text-[15px] tracking-tight drop-shadow-sm">
                {noteUser.name}
              </span>
            </div>
          </motion.div>
        </div>

        {/* Bottom Interaction Bar */}
        <div className="relative z-20 px-4 pt-2 pb-[max(env(safe-area-inset-bottom),18px)] flex flex-col space-y-3 bg-gradient-to-t from-black via-black/85 to-transparent">
          {/* Toast Notification */}
          <AnimatePresence>
            {showToast && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="self-center px-4 py-1.5 rounded-full bg-sky-500/90 text-white text-[12.5px] font-bold shadow-lg backdrop-blur-md"
              >
                {showToast}
              </motion.div>
            )}
          </AnimatePresence>

          {isMe ? (
            /* Current user actions: Small compact icon buttons (not giant full-width button) */
            <div className="flex flex-col items-center space-y-2 w-full max-w-xs mx-auto py-1">
              <div className="flex items-center justify-center space-x-3.5">
                {/* Small sleek circular Add New Note icon button */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onNewNote) onNewNote();
                    else onEditMyNote?.();
                  }}
                  className="w-12 h-12 rounded-full bg-gradient-to-tr from-sky-400 to-blue-600 hover:from-sky-500 hover:to-blue-700 active:scale-90 text-white transition-all flex items-center justify-center cursor-pointer shadow-lg border border-white/20"
                  title="New note"
                >
                  <Plus className="w-6 h-6" strokeWidth={2.6} />
                </button>

                {/* Small sleek Edit icon button */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onEditNote) onEditNote();
                    else onEditMyNote?.();
                  }}
                  className="w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 active:scale-90 text-white transition-all flex items-center justify-center cursor-pointer border border-white/20 shadow-md"
                  title="Edit note"
                >
                  <Edit3 className="w-5 h-5" strokeWidth={2.2} />
                </button>

                {/* Small sleek Delete icon button */}
                <button
                  type="button"
                  onClick={() => {
                    onDeleteMyNote?.();
                    onClose();
                  }}
                  className="w-12 h-12 rounded-full bg-red-500/20 hover:bg-red-500/30 active:scale-90 text-red-300 transition-all flex items-center justify-center cursor-pointer border border-red-500/30 shadow-md"
                  title="Delete note"
                >
                  <Trash2 className="w-5 h-5" strokeWidth={2.2} />
                </button>
              </div>
              <span className="text-[11.5px] text-neutral-400 font-medium">
                Tap + to share a new note
              </span>
            </div>
          ) : (
            /* Other user actions: Quick emojis + DM reply input */
            <div className="flex flex-col space-y-3 w-full max-w-md mx-auto">
              {/* Quick Emojis Bar */}
              <div className="flex items-center justify-around py-1 px-2 bg-white/10 backdrop-blur-xl rounded-full border border-white/15">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSendReaction(emoji)}
                    className="text-[22px] sm:text-[24px] hover:scale-130 active:scale-90 transition-transform p-1 cursor-pointer"
                    title={`React ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* DM Reply Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendReply();
                }}
                className="flex items-center space-x-2 bg-white/15 backdrop-blur-2xl border border-white/20 rounded-full px-4 py-1.5 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-400/30 transition-all"
              >
                <input
                  type="text"
                  placeholder={`Reply to ${noteUser.name.split(" ")[0]}...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onFocus={() => setIsPaused(true)}
                  onBlur={() => setIsPaused(false)}
                  className="flex-1 bg-transparent text-[14.5px] text-white placeholder:text-neutral-400 outline-none border-none py-1.5"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || isSending}
                  className="w-8 h-8 rounded-full bg-sky-500 hover:bg-sky-400 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed active:scale-90 transition-all border-0 cursor-pointer shrink-0"
                  title="Send reply"
                >
                  <Send className="w-4 h-4 translate-x-0.5" strokeWidth={2.2} />
                </button>
              </form>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
