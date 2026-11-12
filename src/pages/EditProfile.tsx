import React, { useState, useRef } from 'react';
import { ArrowLeft, Camera, Check, X, Loader2, Link as LinkIcon, Plus, Trash2 } from 'lucide-react';
import { useAppStore } from '../store';
import { updateUserProfile } from '../services/authService';
import { uploadMedia } from '../services/githubStorage';
import { compressAvatarImage } from '../services/mediaCompressor';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { MediaCropModal } from '../components/MediaCropModal';
import { useShallow } from 'zustand/react/shallow';

const isVideoMedia = (url?: string | null): boolean => {
  if (!url) return false;
  return /\.(mp4|webm|mov|m4v|ogg)($|\?)/i.test(url) || url.startsWith('data:video');
};

export default function EditProfile() {
  const { currentUser, setCurrentUser, setCurrentPage } = useAppStore(useShallow((s: any) => ({ currentUser: s.currentUser, setCurrentUser: s.setCurrentUser, setCurrentPage: s.setCurrentPage })));
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(currentUser?.name || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [link, setLink] = useState(currentUser?.link || '');
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');
  const [bannerUrl, setBannerUrl] = useState(currentUser?.bannerUrl || '');
  const [highlights, setHighlights] = useState<string[]>(currentUser?.highlights || []);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [isUploadingHighlight, setIsUploadingHighlight] = useState(false);
  const [deleteHighlightUrl, setDeleteHighlightUrl] = useState<string | null>(null);

  // Cropper states
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropTargetFile, setCropTargetFile] = useState<File | null>(null);
  const [cropType, setCropType] = useState<'avatar' | 'banner'>('avatar');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const highlightInputRef = useRef<HTMLInputElement>(null);

  const handleUploadHighlight = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.uid) return;
    setIsUploadingHighlight(true);
    try {
      const url = await uploadMedia(file, 'highlights');
      setHighlights(prev => [...prev, url]);
      
      await updateDoc(doc(db, 'users', currentUser.uid), {
        highlights: arrayUnion(url)
      });
      setCurrentUser({ ...currentUser, highlights: [...(currentUser.highlights || []), url] });
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploadingHighlight(false);
    }
  };

  const handleDeleteHighlight = (url: string) => {
    setDeleteHighlightUrl(url);
  };

  // Ultra-Fast image selection with instant optimistic preview
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Instant local preview
      const preview = URL.createObjectURL(file);
      setAvatar(preview);
      setAvatarFile(file);
    }
    e.target.value = '';
  };

  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Instant local preview
      const preview = URL.createObjectURL(file);
      setBannerUrl(preview);
      setBannerFile(file);
    }
    e.target.value = '';
  };

  const handleCropApply = (croppedFile: File, previewUrl: string) => {
    if (cropType === 'avatar') {
      setAvatarFile(croppedFile);
      setAvatar(previewUrl);
    } else {
      setBannerFile(croppedFile);
      setBannerUrl(previewUrl);
    }
  };

  // Ultra Super Fast Optimistic Save
  const handleSave = async () => {
    if (!currentUser) return;
    setLoading(true);

    const snapshotAvatar = avatar;
    const snapshotBanner = bannerUrl;
    const snapshotName = name.trim();
    const snapshotUsername = username.toLowerCase().trim();
    const snapshotBio = bio.trim();
    const snapshotLink = link.trim();

    // 1. Immediately update UI state so user experiences zero delay
    const optimisticUser = {
      ...currentUser,
      name: snapshotName,
      username: snapshotUsername,
      bio: snapshotBio,
      link: snapshotLink,
      avatar: snapshotAvatar,
      bannerUrl: snapshotBanner,
    };
    setCurrentUser(optimisticUser);
    setCurrentPage('profile');

    // 2. Perform background upload and database sync asynchronously
    (async () => {
      try {
        let finalAvatar = snapshotAvatar;
        if (avatarFile) {
          try {
            if (avatarFile.type.startsWith('video/') || avatarFile.name?.toLowerCase().endsWith('.gif')) {
              finalAvatar = await uploadMedia(avatarFile, 'avatars');
            } else {
              const compressed = await compressAvatarImage(avatarFile);
              finalAvatar = await uploadMedia(compressed, 'avatars');
            }
          } catch (uploadErr) {
            console.warn('Avatar upload fallback:', uploadErr);
          }
        }

        let finalBanner = snapshotBanner;
        if (bannerFile) {
          try {
            finalBanner = await uploadMedia(bannerFile, 'banners');
          } catch (bannerErr) {
            console.warn('Banner upload fallback:', bannerErr);
          }
        }

        const updated = await updateUserProfile(currentUser.uid, {
          name: snapshotName,
          username: snapshotUsername,
          bio: snapshotBio,
          link: snapshotLink,
          avatar: finalAvatar,
          bannerUrl: finalBanner
        });

        setCurrentUser(updated);
      } catch (error: any) {
        console.error('Background profile update error:', error);
      }
    })();
  };

  return (
    <div className="h-full w-full bg-white dark:bg-black text-neutral-900 dark:text-white flex flex-col overflow-y-auto overflow-x-hidden relative select-none">
      
      {/* Ambient Soft Blue Glow Fixed at Top extending to very top edge */}
      <div 
        className="pointer-events-none fixed top-0 left-0 right-0 h-[280px] sm:h-[320px] bg-gradient-to-b from-sky-400/[0.22] via-blue-500/[0.08] to-transparent dark:from-blue-600/[0.28] dark:via-blue-800/[0.08] dark:to-transparent z-0" 
        aria-hidden="true" 
      />

      {/* Floating Top Action Controls - No Header Bar so blue gradient flows to the very top */}
      <div className="sticky top-0 z-30 pointer-events-none bg-transparent border-0 px-4 pt-[max(calc(var(--app-safe-top)+8px),14px)] pb-2 flex items-center justify-between select-none [&>*]:pointer-events-auto">
        <button 
          onClick={() => setCurrentPage('profile')} 
          className="w-10 h-10 rounded-full bg-white/75 dark:bg-black/60 hover:bg-white dark:hover:bg-black/80 backdrop-blur-md flex items-center justify-center transition-all text-neutral-900 dark:text-white cursor-pointer border border-black/5 dark:border-white/15 shadow-sm"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
        </button>

        <button 
          onClick={handleSave}
          disabled={loading}
          className="px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shadow-md shadow-blue-500/30 cursor-pointer border-0"
          title="Save changes"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Save</span>}
        </button>
      </div>

      <div className="max-w-xl mx-auto w-full px-4 pt-1 pb-16 space-y-4 relative z-10">
        
        {/* Banner & Avatar Combined Section */}
        <div className="relative w-full">
          {/* Banner Box */}
          <div 
            onClick={() => bannerInputRef.current?.click()}
            className="w-full h-36 sm:h-44 rounded-[28px] overflow-hidden bg-neutral-100 dark:bg-white/[0.05] relative cursor-pointer group shadow-xs"
          >
            {bannerUrl ? (
              isVideoMedia(bannerUrl) ? (
                <video src={bannerUrl} className="w-full h-full object-cover" autoPlay loop muted playsInline />
              ) : (
                <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover transition-transform duration-300" />
              )
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-blue-600/30 via-indigo-600/20 to-sky-500/20 flex items-center justify-center">
                <span className="text-xs text-neutral-400 font-medium">Tap to add cover photo</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-semibold flex items-center space-x-1.5">
                <Camera className="w-3.5 h-3.5" />
                <span>Change Cover</span>
              </div>
            </div>
          </div>

          {/* Avatar Box overlapping Banner */}
          <div className="relative -mt-12 ml-4 w-22 h-22 sm:w-24 sm:h-24">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-full rounded-full ring-4 ring-white dark:ring-black overflow-hidden bg-neutral-200 dark:bg-neutral-800 relative cursor-pointer group shadow-md"
            >
              {avatar ? (
                isVideoMedia(avatar) ? (
                  <video src={avatar} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                ) : (
                  <img src={avatar} alt="Avatar" className="w-full h-full object-cover transition-transform duration-300" />
                )
              ) : (
                <div className="w-full h-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-neutral-400">
                  <Camera className="w-6 h-6" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Hidden File Inputs */}
        <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileSelect} className="hidden" />
        <input ref={bannerInputRef} type="file" accept="image/*,video/*" onChange={handleBannerSelect} className="hidden" />
        <input ref={highlightInputRef} type="file" accept="image/*,video/*" onChange={handleUploadHighlight} className="hidden" />

        {/* Edit Form Fields */}
        <div className="bg-neutral-100/70 dark:bg-white/[0.04] backdrop-blur-md rounded-[28px] p-4 space-y-3.5 border-0 shadow-xs">
          <div>
            <label className="text-[11.5px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider px-1">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full mt-1 px-4 py-2.5 rounded-[18px] bg-white/80 dark:bg-white/[0.06] text-neutral-900 dark:text-white border-0 text-[14.5px] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          <div>
            <label className="text-[11.5px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider px-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
              placeholder="@username"
              className="w-full mt-1 px-4 py-2.5 rounded-[18px] bg-white/80 dark:bg-white/[0.06] text-neutral-900 dark:text-white border-0 text-[14.5px] focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
            />
          </div>

          <div>
            <label className="text-[11.5px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider px-1">
              Bio
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell the world about yourself..."
              className="w-full mt-1 px-4 py-2.5 rounded-[18px] bg-white/80 dark:bg-white/[0.06] text-neutral-900 dark:text-white border-0 text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none leading-relaxed"
            />
          </div>

          <div>
            <label className="text-[11.5px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider px-1">
              Link
            </label>
            <div className="relative mt-1">
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://yourwebsite.com"
                className="w-full pl-9.5 pr-4 py-2.5 rounded-[18px] bg-white/80 dark:bg-white/[0.06] text-neutral-900 dark:text-white border-0 text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <LinkIcon className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
            </div>
          </div>
        </div>

        {/* Highlights Section */}
        <div className="bg-neutral-100/70 dark:bg-white/[0.04] backdrop-blur-md rounded-[28px] p-4 space-y-3 border-0 shadow-xs">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11.5px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              Story Highlights
            </span>
            <button
              type="button"
              onClick={() => highlightInputRef.current?.click()}
              disabled={isUploadingHighlight}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center space-x-1 cursor-pointer border-0 bg-transparent"
            >
              {isUploadingHighlight ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Add</span>
            </button>
          </div>

          <div className="flex items-center space-x-3 overflow-x-auto no-scrollbar py-1">
            {highlights.map((hUrl, i) => (
              <div key={i} className="relative shrink-0 group">
                <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-blue-500/40 p-0.5">
                  <img src={hUrl} alt="Highlight" className="w-full h-full object-cover rounded-full" />
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteHighlight(hUrl)}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center cursor-pointer border-0 shadow-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
            {highlights.length === 0 && (
              <span className="text-xs text-neutral-400 py-2">No highlights added yet</span>
            )}
          </div>
        </div>

      </div>

      {cropModalOpen && cropTargetFile && (
        <MediaCropModal
          file={cropTargetFile}
          aspectRatio={cropType === 'avatar' ? 1 : 16 / 9}
          onApply={handleCropApply}
          onClose={() => setCropModalOpen(false)}
        />
      )}

    </div>
  );
}
