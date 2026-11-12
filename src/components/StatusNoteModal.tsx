import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, Sparkles, Trash2, Send } from "lucide-react";
import { useAppStore } from "../store";
import { db } from "../firebase";

interface StatusNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  currentNote?: string;
  mode?: "create" | "edit";
  onNoteUpdated: (newNote: string) => void;
}

const NOTE_SUGGESTIONS = [
  "☕ Coffee break",
  "🎧 Vibing to music",
  "🎮 Gaming session",
  "✨ In my zone",
  "😴 Low battery",
  "🔥 On the grind",
  "🏖️ Weekend chill",
  "📚 Focus mode",
  "🍕 Food coma",
  "✈️ Traveling",
];

export default function StatusNoteModal({
  isOpen,
  onClose,
  currentUser,
  currentNote = "",
  mode = "create",
  onNoteUpdated,
}: StatusNoteModalProps) {
  const [noteText, setNoteText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const setIsBottomNavHidden = useAppStore((state) => state.setIsBottomNavHidden);

  useEffect(() => {
    if (isOpen) {
      if (mode === "edit") {
        const textToEdit = currentNote || (currentUser as any)?.statusNote || "";
        setNoteText(textToEdit);
      } else {
        // "create" mode: start completely fresh
        setNoteText("");
      }
      setIsBottomNavHidden(true);

      // Auto-focus textarea smoothly
      const timer = setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          if (mode === "edit") {
            const len = textareaRef.current.value.length;
            textareaRef.current.setSelectionRange(len, len);
          }
        }
      }, 100);

      return () => {
        clearTimeout(timer);
        setIsBottomNavHidden(false);
      };
    }
  }, [isOpen, mode, currentNote, currentUser, setIsBottomNavHidden]);

  if (typeof document === "undefined") return null;

  const handleShareNote = async () => {
    const trimmed = noteText.trim();
    if (!trimmed || !currentUser || isSaving) return;

    setIsSaving(true);
    try {
      try {
        localStorage.setItem(`status_note_${currentUser.uid}`, trimmed);
      } catch (err) {}

      onNoteUpdated(trimmed);

      const { updateDoc, doc } = await import("firebase/firestore");
      await updateDoc(doc(db, "users", currentUser.uid), {
        statusNote: trimmed,
        statusNoteUpdatedAt: Date.now(),
      });
      onClose();
    } catch (err) {
      console.error("Failed to update status note:", err);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!currentUser || isSaving) return;

    setIsSaving(true);
    try {
      try {
        localStorage.removeItem(`status_note_${currentUser.uid}`);
      } catch (err) {}

      setNoteText("");
      onNoteUpdated("");

      const { updateDoc, doc, deleteField } = await import("firebase/firestore");
      await updateDoc(doc(db, "users", currentUser.uid), {
        statusNote: deleteField(),
      });
      onClose();
    } catch (err) {
      console.error("Failed to delete note:", err);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="status-note-modal"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 15 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="fixed inset-0 z-[99999] flex flex-col bg-[#f8f9fc] dark:bg-[#090a0f] h-[100dvh] w-full select-none overflow-hidden font-sans [webkit-font-smoothing:antialiased]"
        >
          {/* Seamless lag-free ambient top soft blue gradient glow matching feed */}
          <div
            className="pointer-events-none fixed top-0 left-0 right-0 h-[320px] bg-gradient-to-b from-sky-400/[0.22] via-blue-500/[0.08] to-transparent dark:from-blue-600/[0.25] dark:via-blue-800/[0.08] dark:to-transparent z-0"
            aria-hidden="true"
          />

          {/* Seamless Header - NO white solid background, NO border line, pure fluid blur */}
          <div className="relative px-4 py-3 flex items-center justify-between pt-[calc(var(--app-safe-top)+12px)] bg-transparent z-20 shrink-0">
            {/* Close round frosted button */}
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.1] dark:hover:bg-white/[0.14] text-neutral-800 dark:text-neutral-200 transition-all flex items-center justify-center cursor-pointer border border-black/[0.04] dark:border-white/10 backdrop-blur-md"
              title="Close"
            >
              <X className="w-5 h-5" strokeWidth={2.4} />
            </button>

            {/* Title floating seamlessly */}
            <div className="flex flex-col items-center">
              <h3 className="font-extrabold text-neutral-900 dark:text-white text-[18px] tracking-tight leading-tight">
                {mode === "edit" ? "Edit note" : "New note"}
              </h3>
              <span className="text-[11.5px] font-medium text-neutral-500 dark:text-neutral-400">
                {mode === "edit" ? "Update your thought" : "Share with friends"}
              </span>
            </div>

            {/* Share gradient action button */}
            <button
              type="button"
              disabled={!noteText.trim() || isSaving}
              onClick={handleShareNote}
              className="px-5 py-2 rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold text-[14px] disabled:opacity-40 disabled:cursor-not-allowed transition-all border-0 shadow-md cursor-pointer"
            >
              {isSaving ? "Saving..." : mode === "edit" ? "Save" : "Share"}
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col items-center justify-between relative z-10 scrollbar-hide max-w-lg mx-auto w-full">
            <div className="w-full flex flex-col items-center">
              {/* Note Live Preview with Thought Bubble pinned to avatar */}
              <div className="relative mt-2 mb-6 flex flex-col items-center">
                <div className="relative">
                  {/* Dynamic expanding thought bubble */}
                  <motion.div
                    layout
                    className="absolute -top-7 left-1/2 -translate-x-1/2 px-4 py-2.5 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl border border-white/90 dark:border-white/20 shadow-[0_8px_24px_rgba(0,0,0,0.12)] rounded-[24px] z-20 w-auto min-w-[90px] max-w-[240px] flex items-center justify-center transition-all duration-150"
                  >
                    <span className="text-[13px] font-bold text-neutral-900 dark:text-white leading-snug block text-center break-words whitespace-pre-wrap max-w-[220px]">
                      {noteText.trim() || (mode === "edit" ? "Edit thought..." : "What's on your mind?")}
                    </span>
                    {/* Thought Dots */}
                    <div className="absolute -bottom-1.5 left-7 w-2.5 h-2.5 rounded-full bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border border-white/90 dark:border-white/20 shadow-xs pointer-events-none" />
                    <div className="absolute -bottom-3.5 left-5 w-1.5 h-1.5 rounded-full bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border border-white/90 dark:border-white/20 shadow-xs pointer-events-none" />
                  </motion.div>

                  {/* Avatar */}
                  <div className="p-1 rounded-full bg-gradient-to-tr from-sky-400 via-blue-500 to-indigo-600 shadow-md mt-3">
                    <img
                      src={
                        currentUser?.avatar ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || "Me")}&background=random`
                      }
                      className="w-[84px] h-[84px] rounded-full object-cover border-2 border-white dark:border-neutral-950"
                      alt="Me"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
                <span className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400 mt-3 text-center">
                  Visible to friends above your profile for 24h
                </span>
              </div>

              {/* Seamless Text Input Card */}
              <div className="w-full bg-white/85 dark:bg-[#15161c]/85 backdrop-blur-md rounded-3xl p-4.5 border border-black/[0.05] dark:border-white/[0.08] focus-within:border-sky-500/80 focus-within:ring-2 focus-within:ring-sky-500/20 transition-all mt-2 shadow-xs">
                <textarea
                  ref={textareaRef}
                  rows={3}
                  placeholder={mode === "edit" ? "Edit your note..." : "Share a thought..."}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  maxLength={100}
                  className="w-full text-center text-[17px] sm:text-[18px] font-semibold outline-none resize-none transition-colors placeholder:text-neutral-400 bg-transparent text-neutral-950 dark:text-white leading-relaxed no-scrollbar"
                />
                <div className="flex justify-between items-center pt-2.5 border-t border-black/[0.04] dark:border-white/[0.06] text-[11.5px] text-neutral-400 font-medium">
                  <div className="flex items-center space-x-1">
                    <Sparkles className="w-3 h-3 text-sky-400" />
                    <span>{mode === "edit" ? "Editing note" : "Short & sweet"}</span>
                  </div>
                  <span className={noteText.length >= 95 ? "text-amber-500 font-bold" : ""}>
                    {noteText.length} / 100
                  </span>
                </div>
              </div>

              {/* Status Mood / Vibe Suggestions */}
              <div className="w-full mt-4">
                <span className="text-[12px] font-bold text-neutral-500 dark:text-neutral-400 mb-2 block text-center">
                  Quick suggestions
                </span>
                <div className="flex flex-wrap justify-center gap-2">
                  {NOTE_SUGGESTIONS.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setNoteText(sug)}
                      className="px-3.5 py-1.5 bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-neutral-800 dark:text-neutral-200 rounded-full text-[12.5px] font-medium transition-all border border-black/[0.04] dark:border-white/5 cursor-pointer backdrop-blur-xs"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="w-full mt-8 flex flex-col items-center space-y-3 pb-[max(var(--app-safe-bottom),16px)]">
              <div className="px-3.5 py-1.5 rounded-full bg-white/70 dark:bg-[#15161c]/70 border border-black/[0.04] dark:border-white/5 text-[11.5px] text-neutral-500 dark:text-neutral-400 font-medium backdrop-blur-sm">
                Shared with: Friends you follow back
              </div>

              {(currentNote || (currentUser as any)?.statusNote) && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleDeleteNote}
                  className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-semibold py-3 rounded-2xl transition-all text-center text-[13.5px] cursor-pointer border border-red-500/20 disabled:opacity-50 flex items-center justify-center space-x-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete current note</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
