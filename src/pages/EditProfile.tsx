import React, { useState, useRef } from 'react';
import { ArrowLeft, Camera, Check, X, Loader2, Globe, Lock, Link as LinkIcon, AtSign, User, Plus, Trash2 } from 'lucide-react';
import { useAppStore } from '../store';
import { updateUserProfile } from '../services/authService';
import { uploadMedia } from '../services/githubStorage';
import { compressAvatarImage } from '../services/mediaCompressor';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';

export default function EditProfile() {
  const { currentUser, setCurrentUser, setCurrentPage } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(currentUser?.name || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [link, setLink] = useState(currentUser?.link || '');
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');
  const [highlights, setHighlights] = useState<string[]>(currentUser?.highlights || []);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isUploadingHighlight, setIsUploadingHighlight] = useState(false);
  const [deleteHighlightUrl, setDeleteHighlightUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const highlightInputRef = useRef<HTMLInputElement>(null);

  const handleUploadHighlight = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.uid) return;
    setIsUploadingHighlight(true);
    try {
      const url = await uploadMedia(file, 'highlights');
      setHighlights(prev => [...prev, url]);
      
      // Update directly to keep it safe, or wait for save. We'll wait for save to batch it, or directly update DB.
      // Let's directly update DB so it's consistent with Profile.tsx
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatar(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      let finalAvatar = avatar;
      if (avatarFile) {
        try {
          const compressed = await compressAvatarImage(avatarFile);
          finalAvatar = await uploadMedia(compressed, 'avatars');
        } catch (uploadErr) {
          console.warn('Avatar upload fallback to data URL:', uploadErr);
          finalAvatar = await new Promise<string>((res) => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result as string);
            reader.onerror = () => res(avatar);
            reader.readAsDataURL(avatarFile);
          });
        }
      }

      const updatedUser = await updateUserProfile(currentUser.uid, {
        name,
        username: username.toLowerCase(),
        bio,
        link,
        avatar: finalAvatar
      });

      setCurrentUser(updatedUser);
      setCurrentPage('profile');
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full bg-gradient-to-b from-[#e9d5ff] via-[#f3e8ff] to-[#faf5ff] flex flex-col overflow-y-auto overflow-x-hidden">
      {/* Header with safe top padding on mobile */}
      <div className="sticky top-0 z-30 bg-white/30 backdrop-blur-xl border-b border-white/60 px-4 pt-8 pb-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => setCurrentPage('profile')} className="p-2 hover:bg-white/50 text-gray-800 rounded-full transition-colors active:scale-90">
            <X className="w-6 h-6" />
          </button>
          <h1 className="text-[18px] font-bold text-gray-900 tracking-tight">Edit Profile</h1>
        </div>
        <button 
          onClick={handleSave}
          disabled={loading}
          className="bg-gradient-to-r from-purple-500 to-purple-400 hover:from-purple-600 hover:to-purple-500 disabled:opacity-50 text-white px-5 py-2 rounded-2xl font-medium text-[14px] shadow-[0_4px_14px_rgba(168,85,247,0.3)] transition-all active:scale-95 flex items-center space-x-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          <span>{loading ? 'Saving...' : 'Done'}</span>
        </button>
      </div>

      {/* Overflow-hidden container to prevent swiping/scrolling shift on mobile */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-50px] left-[-50px] w-64 h-64 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-40 right-[-20px] w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" style={{animationDelay: '2s'}}></div>
      </div>

      <div className="max-w-2xl mx-auto w-full p-6 space-y-8 relative z-10">

        {/* Avatar Section */}
        <div className="flex flex-col items-center relative z-20">
          <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <div className="w-[115px] h-[115px] rounded-full p-1 bg-gradient-to-br from-purple-200 to-purple-400 shadow-[0_0_25px_rgba(168,85,247,0.3)]">
              <div className="w-full h-full rounded-full border-[3px] border-white overflow-hidden bg-white">
                <img src={avatar} alt="Avatar" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              </div>
            </div>
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ml-1 mt-1 w-[107px] h-[107px]">
              <Camera className="w-8 h-8 text-white" />
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
          </div>
          <button onClick={() => fileInputRef.current?.click()} className="mt-4 text-purple-600 font-medium text-[14px] hover:underline">Change Profile Photo</button>
        </div>

        {/* Form Fields */}
        <div className="space-y-5 relative z-20">
          <div className="space-y-2">
            <label className="text-[13px] font-medium text-purple-700 uppercase tracking-wider flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span>Name</span>
            </label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/50 backdrop-blur-md border border-white/80 rounded-2xl px-4 py-3.5 text-[15px] text-gray-800 font-medium focus:ring-2 focus:ring-purple-400 focus:bg-white focus:border-transparent outline-none transition-all shadow-sm"
              placeholder="Your full name"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-medium text-purple-700 uppercase tracking-wider flex items-center space-x-2">
              <AtSign className="w-4 h-4" />
              <span>Username</span>
            </label>
            <div className="relative">
              <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/50 backdrop-blur-md border border-white/80 rounded-2xl px-4 py-3.5 text-[15px] text-gray-800 font-medium focus:ring-2 focus:ring-purple-400 focus:bg-white focus:border-transparent outline-none transition-all shadow-sm"
                placeholder="username"
              />
            </div>
            <p className="text-[11px] text-purple-500/70 font-medium px-2">You can change your username once every 30 days.</p>
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-medium text-purple-700 uppercase tracking-wider flex items-center space-x-2">
              <Globe className="w-4 h-4" />
              <span>Bio</span>
            </label>
            <textarea 
              value={bio} 
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-white/50 backdrop-blur-md border border-white/80 rounded-2xl px-4 py-3.5 text-[15px] text-gray-800 font-medium focus:ring-2 focus:ring-purple-400 focus:bg-white focus:border-transparent outline-none transition-all min-h-[120px] resize-none shadow-sm"
              placeholder="Tell us about yourself..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-medium text-purple-700 uppercase tracking-wider flex items-center space-x-2">
              <LinkIcon className="w-4 h-4" />
              <span>Link</span>
            </label>
            <input 
              type="text" 
              value={link} 
              onChange={(e) => setLink(e.target.value)}
              className="w-full bg-white/50 backdrop-blur-md border border-white/80 rounded-2xl px-4 py-3.5 text-[15px] text-gray-800 font-medium focus:ring-2 focus:ring-purple-400 focus:bg-white focus:border-transparent outline-none transition-all shadow-sm"
              placeholder="https://yourlink.com"
            />
          </div>
        </div>

        {/* Highlights Section */}
        <div className="pt-8 relative z-20">
          <h3 className="text-[15px] font-medium text-purple-800 mb-4 flex items-center space-x-2 px-2">
            <Camera className="w-4 h-4" />
            <span>Highlights</span>
          </h3>
          <div className="bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm p-4">
            <div className="flex flex-wrap gap-4 items-center">
              {/* New Highlight Button */}
              <div className="flex flex-col items-center">
                <div 
                  className="w-[60px] h-[60px] rounded-full border border-dashed border-purple-400 flex items-center justify-center mb-1 text-purple-600 cursor-pointer hover:bg-white/50 transition-colors bg-white/30"
                  onClick={() => highlightInputRef.current?.click()}
                >
                  {isUploadingHighlight ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Plus className="w-6 h-6" />
                  )}
                </div>
                <span className="text-[12px] text-gray-800 font-medium">New</span>
                <input type="file" ref={highlightInputRef} className="hidden" accept="image/*" onChange={handleUploadHighlight} />
              </div>

              {/* Existing Highlights */}
              {highlights.map((highlight: string, i: number) => (
                <div key={i} className="flex flex-col items-center relative group">
                  <div className="w-[60px] h-[60px] rounded-full p-[2px] bg-gradient-to-br from-pink-400 to-purple-500 shadow-sm mb-1">
                    <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-white">
                      <img src={highlight} alt="Highlight" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteHighlight(highlight)}
                    className="absolute -top-1 -right-1 bg-white rounded-full p-1 shadow-md text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors border border-gray-100 opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-purple-500/70 font-medium mt-3 px-1">Add photos to your profile highlights.</p>
          </div>
        </div>

        {/* Private Info Section */}
        <div className="pt-8 relative z-20">
          <h3 className="text-[15px] font-medium text-purple-800 mb-4 flex items-center space-x-2 px-2">
            <Lock className="w-4 h-4" />
            <span>Private Information</span>
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm">
              <span className="text-sm text-purple-600 font-medium">Email</span>
              <span className="text-sm text-gray-800 font-medium">{currentUser?.email}</span>
            </div>
          </div>
        </div>

        {/* Custom Delete Highlight Dialog */}
        {deleteHighlightUrl && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-xs p-6 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <Trash2 className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-normal text-gray-900 mb-2">Delete Highlight?</h3>
              <p className="text-sm text-gray-500 mb-6">Are you sure you want to delete this highlight?</p>
              <div className="flex flex-col space-y-2">
                <button 
                  onClick={async () => {
                    if (currentUser?.uid && deleteHighlightUrl) {
                      setHighlights(prev => prev.filter(h => h !== deleteHighlightUrl));
                      try {
                        await updateDoc(doc(db, 'users', currentUser.uid), {
                          highlights: arrayRemove(deleteHighlightUrl)
                        });
                        setCurrentUser({ ...currentUser, highlights: currentUser.highlights?.filter(h => h !== deleteHighlightUrl) || [] });
                      } catch (err) {
                        console.error(err);
                      }
                    }
                    setDeleteHighlightUrl(null);
                  }}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-normal py-2.5 rounded-xl transition-all active:scale-95"
                >
                  Delete
                </button>
                <button 
                  onClick={() => setDeleteHighlightUrl(null)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-normal py-2.5 rounded-xl transition-all active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
