import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Check, 
  Upload, 
  Sparkles, 
  Image as ImageIcon, 
  Palette, 
  Moon, 
  Loader2,
  Eye,
  Send,
  X
} from 'lucide-react';

export interface ChatThemeOption {
  id: string;
  name: string;
  type: 'image' | 'gradient' | 'solid';
  value: string;
  thumbnail: string;
  badge?: string;
  isDark?: boolean;
}

export const CHAT_THEMES: ChatThemeOption[] = [
  {
    id: 'default-wallpaper',
    name: 'Classic Aesthetic',
    type: 'image',
    value: '/chat-background.png',
    thumbnail: '/chat-background.png',
    badge: 'Default',
  },
  {
    id: 'bg-1',
    name: 'Fantasy Dream',
    type: 'image',
    value: '/Chat-background pic/background 1.jpg',
    thumbnail: '/Chat-background pic/background 1.jpg',
    badge: 'Wallpaper 1',
  },
  {
    id: 'bg-2',
    name: 'Cyber Horizon',
    type: 'image',
    value: '/Chat-background pic/Background 2.jpg',
    thumbnail: '/Chat-background pic/Background 2.jpg',
    badge: 'Wallpaper 2',
  },
  {
    id: 'bg-3',
    name: 'Astral Twilight',
    type: 'image',
    value: '/Chat-background pic/background 3.jpg',
    thumbnail: '/Chat-background pic/background 3.jpg',
    badge: 'Wallpaper 3',
  },
  {
    id: 'bg-4',
    name: 'Sunset Mirage',
    type: 'image',
    value: '/Chat-background pic/background 4.jpg',
    thumbnail: '/Chat-background pic/background 4.jpg',
    badge: 'Wallpaper 4',
  },
  {
    id: 'bg-5',
    name: 'Ethereal Glow',
    type: 'image',
    value: '/Chat-background pic/background 5.jpg',
    thumbnail: '/Chat-background pic/background 5.jpg',
    badge: 'Wallpaper 5',
  },
  {
    id: 'bg-6',
    name: 'Cosmic Mystique',
    type: 'image',
    value: '/Chat-background pic/background 6.jpg',
    thumbnail: '/Chat-background pic/background 6.jpg',
    badge: 'Wallpaper 6',
    isDark: true,
  },
  {
    id: 'grad-lavender',
    name: 'Lavender Dusk',
    type: 'gradient',
    value: 'bg-gradient-to-br from-purple-100 via-pink-50 to-indigo-100',
    thumbnail: 'linear-gradient(135deg, #f3e8ff 0%, #fdf2f8 50%, #e0e7ff 100%)',
  },
  {
    id: 'grad-ocean',
    name: 'Ocean Breeze',
    type: 'gradient',
    value: 'bg-gradient-to-br from-cyan-100 via-blue-50 to-sky-100',
    thumbnail: 'linear-gradient(135deg, #cffafe 0%, #eff6ff 50%, #e0f2fe 100%)',
  },
  {
    id: 'grad-sunset',
    name: 'Sunset Peach',
    type: 'gradient',
    value: 'bg-gradient-to-br from-amber-100 via-orange-50 to-rose-100',
    thumbnail: 'linear-gradient(135deg, #fef3c7 0%, #fff7ed 50%, #ffe4e6 100%)',
  },
  {
    id: 'grad-midnight',
    name: 'Midnight Nebula',
    type: 'gradient',
    value: 'bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950',
    thumbnail: 'linear-gradient(135deg, #020617 0%, #1e1b4b 50%, #3b0764 100%)',
    isDark: true,
  },
  {
    id: 'grad-emerald',
    name: 'Mint Emerald',
    type: 'gradient',
    value: 'bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-100',
    thumbnail: 'linear-gradient(135deg, #d1fae5 0%, #f0fdfa 50%, #cffafe 100%)',
  },
  {
    id: 'solid-white',
    name: 'Pure Minimal Light',
    type: 'solid',
    value: 'bg-white',
    thumbnail: '#ffffff',
  },
  {
    id: 'solid-dark',
    name: 'OLED Pitch Dark',
    type: 'solid',
    value: 'bg-gray-950',
    thumbnail: '#030712',
    isDark: true,
  },
];

interface ChatThemeStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: string;
  partnerName?: string;
  partnerAvatar?: string;
  isGroup?: boolean;
  onApplyTheme: (themeValue: string) => Promise<void> | void;
}

export const ChatThemeStudioModal: React.FC<ChatThemeStudioModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  partnerName = 'Friend',
  partnerAvatar = '',
  onApplyTheme,
}) => {
  const [selectedThemeValue, setSelectedThemeValue] = useState<string>(
    currentTheme || '/chat-background.png'
  );
  const [activeTab, setActiveTab] = useState<'all' | 'wallpapers' | 'gradients' | 'colors'>('all');
  const [isApplying, setIsApplying] = useState(false);
  const [customUploadUrl, setCustomUploadUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  if (!isOpen) return null;

  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setCustomUploadUrl(result);
        setSelectedThemeValue(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await onApplyTheme(selectedThemeValue);
      setIsPreviewOpen(false);
      onClose();
    } catch (e) {
      console.error('Error applying theme:', e);
    } finally {
      setIsApplying(false);
    }
  };

  const selectedThemeObj = CHAT_THEMES.find(t => t.value === selectedThemeValue);
  const isImageTheme = selectedThemeValue.startsWith('http') || 
                       selectedThemeValue.startsWith('/') || 
                       selectedThemeValue.startsWith('data:');

  const filteredThemes = CHAT_THEMES.filter(theme => {
    if (activeTab === 'all') return true;
    if (activeTab === 'wallpapers') return theme.type === 'image';
    if (activeTab === 'gradients') return theme.type === 'gradient';
    if (activeTab === 'colors') return theme.type === 'solid';
    return true;
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[500] bg-slate-50 flex flex-col h-[100dvh] w-full select-none overflow-hidden"
      >
        {/* Top Header */}
        <div className="pt-[calc(env(safe-area-inset-top,0px)+16px)] md:pt-3 pb-3 px-4 min-h-[calc(72px+env(safe-area-inset-top,0px))] md:min-h-[64px] border-b border-gray-100 flex items-center justify-between bg-white shrink-0 z-20 shadow-2xs">
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="p-2.5 -ml-1 rounded-full hover:bg-gray-100 active:scale-95 transition-all cursor-pointer text-gray-800"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" strokeWidth={2.2} />
            </button>
            <div>
              <h2 className="text-[16px] md:text-[17px] font-bold text-gray-900 leading-tight">
                Chat Theme & Wallpaper
              </h2>
              <p className="text-[11px] md:text-[12px] text-gray-500 font-normal">
                Choose a wallpaper to customize your conversation
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Theme Boxes Gallery */}
        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-6 pb-28">
          <div className="max-w-4xl mx-auto">
            {/* Filter Pills */}
            <div className="flex items-center space-x-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: 'all', label: 'All Themes', icon: Sparkles },
                { id: 'wallpapers', label: 'Wallpapers', icon: ImageIcon },
                { id: 'gradients', label: 'Gradients', icon: Palette },
                { id: 'colors', label: 'Solid', icon: Moon },
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      isActive
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Upload Custom Wallpaper Box */}
            <label
              htmlFor="customThemeUpload"
              className="flex items-center justify-between p-3.5 md:p-4 mb-5 bg-white hover:bg-purple-50/40 border border-dashed border-purple-300 rounded-2xl cursor-pointer transition-all active:scale-[0.99] group shadow-2xs"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs md:text-sm font-bold text-gray-900">
                    Upload Custom Photo
                  </h4>
                  <p className="text-[11px] md:text-xs text-gray-500">
                    Pick any picture or photo from your device
                  </p>
                </div>
              </div>
              <span className="text-[11px] md:text-xs font-semibold text-purple-600 bg-purple-50 px-3 py-1.5 rounded-full group-hover:bg-purple-600 group-hover:text-white transition-colors">
                Choose Photo
              </span>
              <input
                id="customThemeUpload"
                type="file"
                accept="image/*"
                onChange={handleCustomUpload}
                className="hidden"
              />
            </label>

            {/* Grid of Theme Boxes */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 md:gap-4">
              {/* Custom Uploaded Card */}
              {customUploadUrl && (
                <div
                  onClick={() => setSelectedThemeValue(customUploadUrl)}
                  className={`relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer border-2 transition-all transform duration-200 ${
                    selectedThemeValue === customUploadUrl
                      ? '-translate-y-1.5 border-purple-600 ring-4 ring-purple-500/25 shadow-xl scale-[1.02]'
                      : 'border-white bg-white shadow-xs hover:border-gray-200 hover:-translate-y-0.5'
                  }`}
                >
                  <img
                    src={customUploadUrl}
                    alt="Custom Upload"
                    className="w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent flex flex-col justify-end p-2.5">
                    <span className="text-[11px] font-bold text-white truncate">
                      Custom Upload
                    </span>
                  </div>
                  {selectedThemeValue === customUploadUrl && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-md">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </div>
              )}

              {/* Curated Themes */}
              {filteredThemes.map(theme => {
                const isSelected = selectedThemeValue === theme.value;
                const isImg = theme.type === 'image';

                return (
                  <div
                    key={theme.id}
                    onClick={() => setSelectedThemeValue(theme.value)}
                    className={`relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer border-2 transition-all transform duration-200 ${
                      isSelected
                        ? '-translate-y-1.5 border-purple-600 ring-4 ring-purple-500/25 shadow-xl scale-[1.02]'
                        : 'border-white bg-white shadow-xs hover:border-gray-200 hover:-translate-y-0.5'
                    }`}
                  >
                    {/* Visual Card */}
                    {isImg ? (
                      <img
                        src={theme.thumbnail}
                        alt={theme.name}
                        className="w-full h-full object-cover object-center"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="w-full h-full"
                        style={{
                          background: theme.thumbnail,
                        }}
                      />
                    )}

                    {/* Gradient Overlay & Name */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent flex flex-col justify-between p-2.5">
                      <div className="flex justify-between items-start">
                        {theme.badge ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-600/90 text-white backdrop-blur-xs">
                            {theme.badge}
                          </span>
                        ) : <div />}

                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-md">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="text-[12px] font-bold text-white drop-shadow-sm leading-tight truncate">
                          {theme.name}
                        </h4>
                        <span className="text-[10px] text-gray-200 font-medium capitalize">
                          {theme.type}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Floating Bottom Action Bar (Mobile-App Style) */}
        <div className="fixed bottom-0 left-0 right-0 p-3 md:p-4 bg-white/95 backdrop-blur-md border-t border-gray-200 z-30 shadow-lg">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            {/* Selected Info Thumbnail */}
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-gray-200 shrink-0 shadow-2xs">
                {isImageTheme ? (
                  <img
                    src={selectedThemeValue}
                    alt="Selected"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full"
                    style={{
                      background: selectedThemeObj?.thumbnail || '#fff',
                    }}
                  />
                )}
              </div>
              <div className="min-w-0 hidden sm:block">
                <h4 className="text-xs font-bold text-gray-900 truncate">
                  {selectedThemeObj?.name || 'Custom Theme'}
                </h4>
                <p className="text-[10px] text-gray-500 truncate">
                  Click Preview or Apply
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2.5 ml-auto">
              <button
                onClick={() => setIsPreviewOpen(true)}
                className="px-4 py-2.5 rounded-full border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold text-xs transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
              >
                <Eye className="w-3.5 h-3.5 text-purple-600" />
                <span>Preview</span>
              </button>

              <button
                onClick={handleApply}
                disabled={isApplying}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs rounded-full shadow-md active:scale-95 transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Applying...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Apply Theme</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Fullscreen Live Preview Modal */}
        <AnimatePresence>
          {isPreviewOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[600] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-2 sm:p-4 select-none"
            >
              <div className="relative w-full max-w-[360px] h-[86vh] max-h-[700px] bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl border-4 border-slate-800 flex flex-col">
                {/* Background inside Preview */}
                {isImageTheme ? (
                  <img
                    src={selectedThemeValue}
                    alt="Preview"
                    className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
                  />
                ) : (
                  <div className={`absolute inset-0 w-full h-full ${selectedThemeValue}`} />
                )}

                {/* Top Mock Chat Header */}
                <div className="relative z-10 px-3.5 py-3 bg-white/80 backdrop-blur-md border-b border-white/40 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <img
                      src={partnerAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}
                      alt="Avatar"
                      className="w-8 h-8 rounded-full object-cover border border-white"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 leading-tight">
                        {partnerName}
                      </h4>
                      <span className="text-[10px] text-emerald-600 font-medium">
                        ● Active now
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsPreviewOpen(false)}
                    className="w-7 h-7 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center text-gray-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Mock Message Flow */}
                <div className="relative z-10 flex-1 p-3.5 flex flex-col justify-end space-y-3">
                  <div className="flex items-end space-x-2 max-w-[85%]">
                    <img
                      src={partnerAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}
                      alt=""
                      className="w-6 h-6 rounded-full object-cover shrink-0"
                    />
                    <div className="bg-white/95 text-gray-800 text-xs px-3.5 py-2.5 rounded-2xl rounded-bl-sm shadow-md border border-white/60">
                      <p>Hey! How does this new wallpaper look? 😊</p>
                      <span className="text-[9px] text-gray-400 block text-right mt-1">10:42 AM</span>
                    </div>
                  </div>

                  <div className="self-end max-w-[85%]">
                    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs px-3.5 py-2.5 rounded-2xl rounded-br-sm shadow-md">
                      <p>It looks super clean and beautiful! 🔥</p>
                      <span className="text-[9px] text-purple-200 block text-right mt-1">10:43 AM · Seen</span>
                    </div>
                  </div>
                </div>

                {/* Mock Chat Input */}
                <div className="relative z-10 p-2.5 bg-white/80 backdrop-blur-md border-t border-white/40 flex items-center space-x-2">
                  <div className="flex-1 bg-white text-gray-400 text-xs px-3.5 py-2 rounded-full border border-gray-200 shadow-inner">
                    Type a message...
                  </div>
                  <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white shadow-xs">
                    <Send className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Apply bar inside preview */}
                <div className="relative z-10 p-3 bg-white border-t border-gray-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setIsPreviewOpen(false)}
                    className="flex-1 py-2 rounded-full border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    Back to Themes
                  </button>
                  <button
                    onClick={handleApply}
                    disabled={isApplying}
                    className="flex-1 py-2 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md flex items-center justify-center space-x-1"
                  >
                    {isApplying ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Apply</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};
