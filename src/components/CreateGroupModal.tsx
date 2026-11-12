import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Check, Camera, Plus, Search, X, Users, UserPlus } from "lucide-react";
import { useAppStore } from "../store";

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  availableCandidates: { id: string; name: string; avatar: string; username?: string }[];
  onGroupCreated?: (newChatId: string) => void;
  onCreated?: (newChatId: string) => void;
}

export default function CreateGroupModal({
  isOpen,
  onClose,
  currentUser,
  availableCandidates,
  onGroupCreated,
  onCreated,
}: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupAvatar, setGroupAvatar] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setIsBottomNavHidden = useAppStore((state) => state.setIsBottomNavHidden);

  // Hide bottom nav while group create is open
  useEffect(() => {
    if (isOpen) {
      setIsBottomNavHidden(true);
      return () => {
        setIsBottomNavHidden(false);
      };
    }
  }, [isOpen, setIsBottomNavHidden]);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setGroupName("");
      setSelectedUserIds([]);
      setSearchQuery("");
      setGroupAvatar(null);
      setErrorMessage(null);
      setIsCreating(false);
    }
  }, [isOpen]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 500;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        setGroupAvatar(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = async () => {
    if (selectedUserIds.length === 0) {
      setErrorMessage("Please select at least 1 friend to form a group.");
      return;
    }
    if (!currentUser) return;

    setIsCreating(true);
    setErrorMessage(null);
    try {
      const { createGroupConversation } = await import("../services/chatService");
      const newChatId = await createGroupConversation(
        currentUser.uid,
        selectedUserIds,
        groupName.trim() || "New Group",
        groupAvatar || undefined
      );
      const cb = onCreated || onGroupCreated;
      if (cb) cb(newChatId);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create group. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="create-group-modal"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 15 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed inset-0 z-[99999] flex flex-col bg-[#f8f9fc] dark:bg-[#090a0f] h-[100dvh] w-full select-none overflow-hidden font-sans [webkit-font-smoothing:antialiased]"
        >
          {/* Seamless ambient soft blue gradient glow matching feed */}
          <div
            className="pointer-events-none fixed top-0 left-0 right-0 h-[320px] bg-gradient-to-b from-sky-400/[0.22] via-blue-500/[0.08] to-transparent dark:from-blue-600/[0.25] dark:via-blue-800/[0.08] dark:to-transparent z-0"
            aria-hidden="true"
          />

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />

          {/* Seamless Header - NO white solid background, NO border line, pure fluid blur */}
          <div className="relative px-4 py-3 flex items-center justify-between pt-[calc(var(--app-safe-top)+12px)] bg-transparent shrink-0 z-20">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.1] dark:hover:bg-white/[0.14] text-neutral-800 dark:text-neutral-200 transition-all flex items-center justify-center cursor-pointer border border-black/[0.04] dark:border-white/10 backdrop-blur-md"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" strokeWidth={2.4} />
              </button>
              <div>
                <h3 className="font-extrabold text-neutral-900 dark:text-white text-[19px] tracking-tight leading-tight">
                  New Group
                </h3>
                <span className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">
                  {selectedUserIds.length === 0
                    ? "Add friends"
                    : `${selectedUserIds.length} ${selectedUserIds.length === 1 ? "friend" : "friends"} selected`}
                </span>
              </div>
            </div>

            {/* Quick Header Create Pill */}
            <button
              type="button"
              disabled={isCreating || selectedUserIds.length === 0}
              onClick={handleCreate}
              className="px-5 py-2 rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold text-[13.5px] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-md border-0"
              title="Create Group"
            >
              {isCreating ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" strokeWidth={2.6} />
                  <span>Create</span>
                </>
              )}
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col scrollbar-hide space-y-3.5 relative z-10 max-w-lg mx-auto w-full">
            {/* Error Banner */}
            {errorMessage && (
              <div className="px-4 py-2.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-[13px] font-semibold flex items-center justify-between">
                <span>{errorMessage}</span>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="p-1 hover:opacity-75"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Group Profile Card - Frosted, Sleek, No white box */}
            <div className="w-full bg-white/80 dark:bg-[#15161c]/80 backdrop-blur-xl rounded-3xl p-4 border border-black/[0.05] dark:border-white/[0.08] shadow-xs flex items-center space-x-3.5">
              {/* Group Avatar Picker */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-16 h-16 rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/10 flex items-center justify-center relative transition-all cursor-pointer shrink-0 group overflow-hidden"
              >
                {groupAvatar ? (
                  <img src={groupAvatar} className="w-full h-full object-cover" alt="Group PFP" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-500">
                    <Camera className="w-6 h-6" strokeWidth={1.8} />
                  </div>
                )}
                <div className="absolute bottom-0 right-0 w-5.5 h-5.5 bg-gradient-to-tr from-sky-400 to-blue-600 text-white rounded-full border-2 border-white dark:border-[#15161c] flex items-center justify-center shadow-xs">
                  <Plus className="w-3 h-3" strokeWidth={3} />
                </div>
              </button>

              {/* Group Name Input */}
              <div className="flex-1 min-w-0">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 block mb-0.5">
                  Group Name
                </label>
                <input
                  type="text"
                  placeholder="Enter group name (optional)..."
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full text-[16px] font-semibold text-neutral-900 dark:text-white placeholder:text-neutral-400 bg-transparent outline-none border-none py-0.5"
                  autoFocus
                />
              </div>
            </div>

            {/* Selected Members Chips Tray */}
            {selectedUserIds.length > 0 && (
              <div className="flex items-center space-x-2 overflow-x-auto scrollbar-hide py-1">
                {selectedUserIds.map((uid) => {
                  const member = availableCandidates.find((c) => c.id === uid);
                  const name = member?.name || "Friend";
                  const avatar =
                    member?.avatar ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
                  return (
                    <div
                      key={uid}
                      className="flex items-center space-x-1.5 pl-1.5 pr-2.5 py-1 rounded-full bg-white/90 dark:bg-neutral-800/90 border border-sky-300/40 dark:border-sky-700/40 shadow-xs shrink-0 backdrop-blur-md"
                    >
                      <img src={avatar} alt={name} className="w-5 h-5 rounded-full object-cover" />
                      <span className="text-[12.5px] font-semibold text-neutral-900 dark:text-white max-w-[95px] truncate">
                        {name.split(" ")[0]}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUserIds((prev) => prev.filter((id) => id !== uid));
                        }}
                        className="w-4 h-4 rounded-full bg-neutral-200/80 dark:bg-neutral-700/80 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Search Friends Field */}
            <div className="w-full bg-white/80 dark:bg-[#15161c]/80 backdrop-blur-xl rounded-2xl px-3.5 py-2.5 flex items-center space-x-2.5 border border-black/[0.05] dark:border-white/[0.08] focus-within:border-sky-500/60 focus-within:ring-2 focus-within:ring-sky-500/20 transition-all shrink-0">
              <Search className="w-4.5 h-4.5 text-neutral-400 shrink-0" strokeWidth={2.2} />
              <input
                type="text"
                placeholder="Search friends to add..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-[14px] text-neutral-900 dark:text-white placeholder:text-neutral-400 bg-transparent outline-none border-none font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="p-1 text-neutral-400 hover:text-neutral-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Friends Header */}
            <div className="flex items-center justify-between px-1 pt-1 shrink-0">
              <span className="text-[13px] font-bold text-neutral-600 dark:text-neutral-400 tracking-tight">
                Suggested Friends
              </span>
              <span className="text-[11px] font-semibold text-neutral-400 px-2 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06]">
                {availableCandidates.length}
              </span>
            </div>

            {/* Friends List - Ultra smooth & lag free */}
            <div className="flex-1 space-y-1.5 overflow-y-auto pb-24">
              {(() => {
                const queryTrimmed = searchQuery.trim().toLowerCase();
                const filtered = availableCandidates.filter((u) => {
                  if (!queryTrimmed) return true;
                  return (
                    u.name.toLowerCase().includes(queryTrimmed) ||
                    (u.username && u.username.toLowerCase().includes(queryTrimmed))
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-neutral-400 space-y-2">
                      <UserPlus className="w-8 h-8 opacity-40" strokeWidth={1.8} />
                      <p className="text-[13px] font-medium">
                        {searchQuery ? "No matching friends found" : "No friends found to add"}
                      </p>
                    </div>
                  );
                }

                return filtered.map((f) => {
                  const isSelected = selectedUserIds.includes(f.id);
                  return (
                    <div
                      key={f.id}
                      onClick={() => {
                        setSelectedUserIds((prev) =>
                          isSelected ? prev.filter((id) => id !== f.id) : [...prev, f.id]
                        );
                        setErrorMessage(null);
                      }}
                      className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all  border backdrop-blur-sm ${
                        isSelected
                          ? "bg-sky-500/[0.12] dark:bg-sky-500/[0.16] border-sky-400/50 shadow-2xs"
                          : "bg-white/70 dark:bg-[#15161c]/70 hover:bg-white dark:hover:bg-[#15161c] border-black/[0.04] dark:border-white/[0.06]"
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <img
                          src={f.avatar}
                          className="w-11 h-11 rounded-full object-cover border border-black/[0.06] dark:border-white/[0.1] shrink-0"
                          alt={f.name}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-[15px] text-neutral-900 dark:text-neutral-100 truncate">
                            {f.name}
                          </span>
                          {f.username && (
                            <span className="text-[12px] text-neutral-400 truncate">
                              @{f.username}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="relative flex-shrink-0 ml-2">
                        <div
                          className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                            isSelected
                              ? "bg-sky-500 border-sky-500 text-white shadow-xs"
                              : "border-neutral-300 dark:border-neutral-700 bg-transparent text-transparent"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Floating Bottom Action Bar - Floating seamless pill, NO white solid bar */}
          <div className="fixed bottom-0 left-0 right-0 z-20 px-4 py-3 bg-gradient-to-t from-[#f8f9fc] via-[#f8f9fc]/90 to-transparent dark:from-[#090a0f] dark:via-[#090a0f]/90 dark:to-transparent pb-[max(var(--app-safe-bottom),14px)] pointer-events-none">
            <div className="max-w-lg mx-auto w-full pointer-events-auto">
              <button
                type="button"
                disabled={isCreating || selectedUserIds.length === 0}
                onClick={handleCreate}
                className="w-full bg-gradient-to-r from-sky-500 via-blue-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold py-3.5 rounded-2xl transition-all flex items-center justify-center space-x-2 text-[15px] cursor-pointer border-0 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isCreating ? (
                  <div className="w-4.5 h-4.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="w-4.5 h-4.5" strokeWidth={2.6} />
                    <span>
                      Create Group {selectedUserIds.length > 0 ? `(${selectedUserIds.length})` : ""}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
