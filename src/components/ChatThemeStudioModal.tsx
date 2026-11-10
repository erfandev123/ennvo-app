import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Image as ImageIcon, 
  Sun,
  ChevronUp,
  ChevronDown,
  X,
  Check,
  Palette
} from 'lucide-react';

export interface ChatThemeOption {
  id: string;
  name: string;
  type: 'image' | 'solid';
  value: string;
  thumbnail: string;
}

export interface SolidColorOption {
  id: string;
  name: string;
  value: string;
  colorHex: string;
}

export const SOLID_COLORS: SolidColorOption[] = [
  { id: 'pure-white', name: 'Pure White', value: 'bg-white', colorHex: '#FFFFFF' },
  { id: 'sky-blue', name: 'Sky Blue', value: 'bg-[#EBF5FF]', colorHex: '#EBF5FF' },
  { id: 'royal-blue', name: 'Royal Blue', value: 'bg-[#2563EB]', colorHex: '#2563EB' },
  { id: 'deep-navy', name: 'Deep Navy', value: 'bg-[#0F172A]', colorHex: '#0F172A' },
  { id: 'soft-violet', name: 'Lavender', value: 'bg-[#F3E8FF]', colorHex: '#F3E8FF' },
  { id: 'vivid-purple', name: 'Vivid Purple', value: 'bg-[#7C3AED]', colorHex: '#7C3AED' },
  { id: 'soft-rose', name: 'Soft Rose', value: 'bg-[#FDF2F8]', colorHex: '#FDF2F8' },
  { id: 'neon-pink', name: 'Neon Pink', value: 'bg-[#EC4899]', colorHex: '#EC4899' },
  { id: 'mint-fresh', name: 'Mint Green', value: 'bg-[#ECFDF5]', colorHex: '#ECFDF5' },
  { id: 'deep-emerald', name: 'Emerald', value: 'bg-[#047857]', colorHex: '#047857' },
  { id: 'warm-peach', name: 'Warm Peach', value: 'bg-[#FEF3C7]', colorHex: '#FEF3C7' },
  { id: 'midnight-black', name: 'Pure Dark', value: 'bg-[#0B0914]', colorHex: '#0B0914' },
];

export const CHAT_THEMES: ChatThemeOption[] = [
  {
    id: 'pink-blossom',
    name: 'Pink blossom',
    type: 'image',
    value: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?q=80&w=1000&auto=format&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?q=80&w=400&auto=format&fit=crop',
  },
  {
    id: 'lazy-cat',
    name: 'Lazy cat',
    type: 'image',
    value: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=1000&auto=format&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=400&auto=format&fit=crop',
  },
  {
    id: 'curious-pups',
    name: 'Curious pups',
    type: 'image',
    value: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=1000&auto=format&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=400&auto=format&fit=crop',
  },
  {
    id: 'meadow-nap',
    name: 'Meadow nap',
    type: 'image',
    value: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1000&auto=format&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=400&auto=format&fit=crop',
  },
  {
    id: 'melty-encounter',
    name: 'Melty encounter',
    type: 'image',
    value: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=1000&auto=format&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?q=80&w=400&auto=format&fit=crop',
  },
  {
    id: 'pastel-hearts',
    name: 'Pastel hearts',
    type: 'image',
    value: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=1000&auto=format&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=400&auto=format&fit=crop',
  },
  {
    id: 'soft-jazz',
    name: 'Soft jazz',
    type: 'image',
    value: '/Chat-background pic/background 1.jpg',
    thumbnail: '/Chat-background pic/background 1.jpg',
  },
  {
    id: 'cyber-horizon',
    name: 'Cyber horizon',
    type: 'image',
    value: '/Chat-background pic/Background 2.jpg',
    thumbnail: '/Chat-background pic/Background 2.jpg',
  },
  {
    id: 'sunset-mirage',
    name: 'Sunset mirage',
    type: 'image',
    value: '/Chat-background pic/background 4.jpg',
    thumbnail: '/Chat-background pic/background 4.jpg',
  },
  {
    id: 'ethereal-glow',
    name: 'Ethereal glow',
    type: 'image',
    value: '/Chat-background pic/background 5.jpg',
    thumbnail: '/Chat-background pic/background 5.jpg',
  },
  {
    id: 'ocean-waves',
    name: 'Ocean waves',
    type: 'image',
    value: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1000&auto=format&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=400&auto=format&fit=crop',
  },
];

interface ChatThemeStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: string;
  partnerName?: string;
  partnerAvatar?: string;
  isGroup?: boolean;
  initialBlur?: boolean;
  initialBrightness?: number;
  onApplyTheme: (themeValue: string, options?: { blur?: boolean; brightness?: number }) => Promise<void> | void;
}

export const ChatThemeStudioModal: React.FC<ChatThemeStudioModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  partnerAvatar = '',
  initialBlur = false,
  initialBrightness = 1,
  onApplyTheme,
}) => {
  const [selectedThemeValue, setSelectedThemeValue] = useState<string>(
    currentTheme || '/chat-background.png'
  );
  const [isBlur, setIsBlur] = useState<boolean>(initialBlur);
  const [brightness, setBrightness] = useState<number>(initialBrightness);
  const [showBrightnessSlider, setShowBrightnessSlider] = useState<boolean>(false);
  const [isSheetExpanded, setIsSheetExpanded] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'wallpapers' | 'colors'>('wallpapers');
  const [isApplying, setIsApplying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const touchStartYRef = useRef<number>(0);

  // Sync state whenever modal opens or initial props change
  useEffect(() => {
    if (isOpen) {
      const theme = currentTheme || '/chat-background.png';
      setSelectedThemeValue(theme);
      setIsBlur(Boolean(initialBlur));
      setBrightness(typeof initialBrightness === 'number' ? initialBrightness : 1);
      // Auto-select tab depending on current theme type
      if (theme.startsWith('bg-') || SOLID_COLORS.some(c => c.value === theme)) {
        setActiveTab('colors');
      } else {
        setActiveTab('wallpapers');
      }
    }
  }, [isOpen, currentTheme, initialBlur, initialBrightness]);

  if (!isOpen) return null;

  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setSelectedThemeValue(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setIsApplying(true);
    try {
      await onApplyTheme(selectedThemeValue, { blur: isBlur, brightness });
      onClose();
    } catch (e) {
      console.error('Error saving wallpaper:', e);
    } finally {
      setIsApplying(false);
    }
  };

  const isImageTheme = 
    selectedThemeValue.startsWith('http') || 
    selectedThemeValue.startsWith('/') || 
    selectedThemeValue.startsWith('data:');

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    if (deltaY < -25) {
      setIsSheetExpanded(true);
    } else if (deltaY > 25) {
      setIsSheetExpanded(false);
    }
  };

  // Helper preview renderer used on both PC dialog and mobile view
  const renderPreviewBackground = () => (
    <div className="absolute inset-0 z-0 overflow-hidden bg-neutral-100 dark:bg-neutral-900">
      {isImageTheme ? (
        <img
          src={selectedThemeValue}
          alt="Wallpaper preview"
          className="w-full h-full object-cover object-center"
          style={{
            filter: isBlur ? `blur(18px) brightness(${brightness})` : `brightness(${brightness})`,
            transform: isBlur ? 'scale(1.10)' : 'scale(1)',
            transition: 'filter 0.2s ease, transform 0.2s ease',
          }}
        />
      ) : (
        <div 
          className={`w-full h-full transition-all duration-300 ${selectedThemeValue}`}
          style={{
            filter: isBlur ? `blur(18px) brightness(${brightness})` : `brightness(${brightness})`,
            transform: isBlur ? 'scale(1.10)' : 'scale(1)',
          }}
        />
      )}
    </div>
  );

  const renderSampleMessages = () => (
    <div className="relative z-10 w-full max-w-sm mx-auto px-4 pt-5 flex flex-col space-y-3 pointer-events-none select-none">
      {/* Sent message */}
      <div className="flex justify-end">
        <div className="bg-[#007AFF] text-white rounded-[20px] rounded-br-xs px-4 py-2.5 text-[13.5px] font-normal shadow-sm max-w-[82%] leading-snug">
          How do you like this chat theme? ✨
        </div>
      </div>

      {/* Received message */}
      <div className="flex items-end space-x-2">
        <div className="w-7.5 h-7.5 rounded-full overflow-hidden bg-neutral-300 shrink-0 shadow-xs">
          {partnerAvatar ? (
            <img src={partnerAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-600 text-xs font-bold">
              U
            </div>
          )}
        </div>
        <div className="bg-white text-neutral-900 rounded-[20px] rounded-bl-xs px-4 py-2.5 text-[13.5px] font-normal shadow-sm max-w-[82%] leading-snug">
          Looks completely clean and beautiful!
        </div>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-xs flex items-center justify-center select-none overflow-hidden"
      >
        {/* Hidden File Picker for "Album" */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleCustomUpload}
        />

        {/* ========================================================
            PC / DESKTOP SPECIALIZED FLOATING DIALOG (md:flex)
            ======================================================== */}
        <div className="hidden md:flex flex-row w-[920px] max-w-[95vw] h-[620px] max-h-[90vh] bg-white dark:bg-neutral-900 rounded-[28px] shadow-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 animate-in fade-in zoom-in-95 duration-200">
          
          {/* Left Pane: Phone-framed Live Chat Preview */}
          <div className="w-[360px] h-full relative flex flex-col justify-between p-4 bg-neutral-100 dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800 shrink-0">
            {/* Phone Screen Mockup */}
            <div className="relative w-full flex-1 rounded-[24px] overflow-hidden shadow-lg border border-neutral-300/80 dark:border-neutral-700/80 flex flex-col justify-between bg-black">
              {renderPreviewBackground()}
              {renderSampleMessages()}

              {/* Floating Controls Over Phone Preview */}
              <div className="relative z-10 w-full px-3 pb-3 flex items-center justify-between pointer-events-auto">
                {/* 100% Working Blur Toggle Pill */}
                <button
                  type="button"
                  onClick={() => setIsBlur(!isBlur)}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-full shadow-md border cursor-pointer transition-all duration-150  ${
                    isBlur 
                      ? 'bg-neutral-900 text-white border-neutral-700' 
                      : 'bg-white/95 text-neutral-800 border-white/90'
                  }`}
                >
                  <span className="text-[12px] font-bold">
                    Blur {isBlur ? 'ON' : 'OFF'}
                  </span>
                  <div className={`w-8 h-4.5 rounded-full transition-colors flex items-center p-0.5 ${isBlur ? 'bg-[#FE2C55]' : 'bg-neutral-300'}`}>
                    <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-xs transition-transform transform ${isBlur ? 'translate-x-3.5' : 'translate-x-0'}`} />
                  </div>
                </button>

                {/* Sun / Brightness Button */}
                <div className="relative flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowBrightnessSlider(!showBrightnessSlider)}
                    className={`w-8.5 h-8.5 rounded-full shadow-md border flex items-center justify-center cursor-pointer transition-all  ${
                      showBrightnessSlider
                        ? 'bg-neutral-900 text-white border-neutral-700'
                        : 'bg-white/95 text-neutral-800 border-white/90'
                    }`}
                    title="Adjust brightness"
                  >
                    <Sun className="w-4.5 h-4.5" />
                  </button>

                  <AnimatePresence>
                    {showBrightnessSlider && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-11 right-0 bg-white dark:bg-neutral-900 p-3 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-700 flex flex-col items-center space-y-2 min-w-[150px] z-30"
                      >
                        <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300">Brightness: {Math.round(brightness * 100)}%</span>
                        <input
                          type="range"
                          min="0.35"
                          max="1"
                          step="0.05"
                          value={brightness}
                          onChange={(e) => setBrightness(parseFloat(e.target.value))}
                          className="w-full accent-[#FE2C55] cursor-pointer"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
            <p className="text-center text-[11px] text-neutral-500 font-medium mt-2">
              Live Preview of this chat
            </p>
          </div>

          {/* Right Pane: Tabs, Wallpapers & Pure Solid Colors */}
          <div className="flex-1 h-full flex flex-col bg-white dark:bg-neutral-900">
            {/* Desktop Dialog Header */}
            <div className="px-6 py-4.5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-[19px] font-bold text-neutral-900 dark:text-white tracking-tight">
                  Chat Theme & Wallpaper
                </h2>
                <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                  Custom appearance for this conversation
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-full text-[13.5px] font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isApplying}
                  className="px-6 py-2 rounded-full bg-[#FE2C55] hover:bg-[#E60045] text-white font-semibold text-[13.5px] shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {isApplying ? 'Saving...' : 'Save Theme'}
                </button>
              </div>
            </div>

            {/* Category Switcher Tabs */}
            <div className="px-6 pt-3 pb-2 flex items-center space-x-2 border-b border-neutral-100 dark:border-neutral-800 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('wallpapers')}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-full text-[13px] font-semibold transition-all cursor-pointer ${
                  activeTab === 'wallpapers'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span>Wallpapers</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('colors')}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-full text-[13px] font-semibold transition-all cursor-pointer ${
                  activeTab === 'colors'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300'
                }`}
              >
                <Palette className="w-4 h-4" />
                <span>Pure Colors</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-full text-[13px] font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800 ml-auto transition-all cursor-pointer"
              >
                <ImageIcon className="w-4 h-4 text-neutral-500" />
                <span>Upload Image</span>
              </button>
            </div>

            {/* Main Content Area based on Tab */}
            <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
              {activeTab === 'wallpapers' ? (
                <div className="grid grid-cols-4 gap-4">
                  {/* Default Wallpaper */}
                  <div
                    onClick={() => setSelectedThemeValue('/chat-background.png')}
                    className="flex flex-col items-center cursor-pointer group"
                  >
                    <div className={`w-full aspect-[3/4] rounded-[20px] bg-white dark:bg-neutral-800 border-2 transition-all flex items-center justify-center shadow-xs ${
                      selectedThemeValue === '/chat-background.png'
                        ? 'border-[#FE2C55] ring-2 ring-[#FE2C55]/30 scale-[1.02]'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-400'
                    }`}>
                      <span className="text-xs font-semibold text-neutral-500">Default</span>
                    </div>
                    <span className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300 mt-1.5">
                      Default
                    </span>
                  </div>

                  {/* Preset Image Cards */}
                  {CHAT_THEMES.map((theme) => {
                    const isSelected = selectedThemeValue === theme.value;
                    return (
                      <div
                        key={theme.id}
                        onClick={() => setSelectedThemeValue(theme.value)}
                        className="flex flex-col items-center cursor-pointer group"
                      >
                        <div className={`w-full aspect-[3/4] rounded-[20px] overflow-hidden transition-all shadow-xs relative ${
                          isSelected
                            ? 'ring-3 ring-[#FE2C55] ring-offset-2 scale-[1.02]'
                            : 'hover:opacity-90 '
                        }`}>
                          <img
                            src={theme.thumbnail}
                            alt={theme.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#FE2C55] text-white flex items-center justify-center shadow-xs">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <span className="text-[12px] font-medium text-neutral-700 dark:text-neutral-300 mt-1.5 truncate max-w-full px-1">
                          {theme.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Pure Colors Grid */
                <div className="grid grid-cols-4 gap-4">
                  {SOLID_COLORS.map((col) => {
                    const isSelected = selectedThemeValue === col.value;
                    return (
                      <div
                        key={col.id}
                        onClick={() => setSelectedThemeValue(col.value)}
                        className="flex flex-col items-center cursor-pointer group"
                      >
                        <div 
                          className={`w-full aspect-[3/4] rounded-[20px] border-2 transition-all shadow-xs relative flex items-center justify-center ${
                            isSelected
                              ? 'border-[#FE2C55] ring-3 ring-[#FE2C55]/30 scale-[1.02]'
                              : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 '
                          }`}
                          style={{ backgroundColor: col.colorHex }}
                        >
                          {isSelected && (
                            <div className="w-7 h-7 rounded-full bg-[#FE2C55] text-white flex items-center justify-center shadow-md">
                              <Check className="w-4 h-4 stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <span className="text-[12px] font-semibold text-neutral-800 dark:text-neutral-200 mt-1.5 text-center truncate w-full">
                          {col.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================
            MOBILE OPTIMIZED FULL-SCREEN / BOTTOM-SHEET VIEW (md:hidden)
            ======================================================== */}
        <div className="flex md:hidden flex-col h-[100dvh] w-full bg-black select-none overflow-hidden">
          {/* Top Bar */}
          <div className="pt-[calc(env(safe-area-inset-top,0px)+10px)] pb-2.5 px-4 flex items-center justify-between bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shrink-0 z-30 border-b border-black/5 dark:border-white/10">
            <button
              onClick={onClose}
              className="text-[15px] font-medium text-neutral-800 dark:text-neutral-200 hover:text-black py-1 cursor-pointer"
            >
              Cancel
            </button>

            <h2 className="text-[17px] font-bold text-neutral-900 dark:text-white tracking-tight">
              Set wallpaper
            </h2>

            <button
              onClick={handleSave}
              disabled={isApplying}
              className="px-5 py-1.5 rounded-full bg-[#FE2C55] hover:bg-[#E60045] text-white font-semibold text-[14px] shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isApplying ? 'Saving...' : 'Save'}
            </button>
          </div>

          {/* Main Preview Area */}
          <div className="relative flex-1 w-full overflow-hidden flex flex-col justify-between">
            {renderPreviewBackground()}
            {renderSampleMessages()}

            {/* Floating Controls Over Preview (Blur Toggle + Brightness Slider) */}
            <div className="relative z-10 w-full max-w-md mx-auto px-4 pb-3 flex items-center justify-between pointer-events-auto">
              <button
                type="button"
                onClick={() => setIsBlur(!isBlur)}
                className={`flex items-center space-x-2.5 px-4 py-2 rounded-full shadow-lg border backdrop-blur-xl cursor-pointer transition-all duration-200  ${
                  isBlur 
                    ? 'bg-neutral-900 text-white border-neutral-700 shadow-black/20' 
                    : 'bg-white/95 text-neutral-800 border-white/90 shadow-black/10'
                }`}
              >
                <span className="text-[13px] font-bold tracking-tight">
                  Blur {isBlur ? 'ON' : 'OFF'}
                </span>
                <div className={`w-9 h-5 rounded-full transition-colors flex items-center p-0.5 ${isBlur ? 'bg-[#FE2C55]' : 'bg-neutral-300'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform transform ${isBlur ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </button>

              <div className="relative flex items-center">
                <button
                  type="button"
                  onClick={() => setShowBrightnessSlider(!showBrightnessSlider)}
                  className={`w-10 h-10 rounded-full shadow-lg border backdrop-blur-xl flex items-center justify-center cursor-pointer transition-all  ${
                    showBrightnessSlider
                      ? 'bg-neutral-900 text-white border-neutral-700'
                      : 'bg-white/95 text-neutral-800 border-white/90'
                  }`}
                  title="Adjust brightness"
                >
                  <Sun className="w-5 h-5" />
                </button>

                <AnimatePresence>
                  {showBrightnessSlider && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-12 right-0 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl p-3.5 rounded-2xl shadow-xl border border-neutral-100 dark:border-neutral-800 flex flex-col items-center space-y-2 min-w-[160px] z-30"
                    >
                      <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300">Brightness: {Math.round(brightness * 100)}%</span>
                      <input
                        type="range"
                        min="0.35"
                        max="1"
                        step="0.05"
                        value={brightness}
                        onChange={(e) => setBrightness(parseFloat(e.target.value))}
                        className="w-full accent-[#FE2C55] cursor-pointer"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Bottom Sheet for Mobile */}
          <div 
            className={`relative z-20 w-full bg-white dark:bg-neutral-900 rounded-t-[28px] shadow-[0_-8px_30px_rgba(0,0,0,0.18)] border-t border-neutral-200/60 dark:border-neutral-800 px-4 pt-2 pb-6 flex flex-col shrink-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isSheetExpanded ? 'h-[78vh] max-h-[82vh]' : 'h-[38vh] sm:h-[40vh]'
            }`}
          >
            {/* Drag Handle with Tap & Swipe Up / Down */}
            <div 
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onClick={() => setIsSheetExpanded(!isSheetExpanded)}
              className="w-full flex flex-col items-center pt-1 pb-1.5 cursor-pointer group touch-manipulation select-none"
            >
              <div className="w-12 h-1.5 bg-neutral-300 dark:bg-neutral-700 rounded-full mb-1" />
              <button
                type="button"
                className="flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] font-bold text-neutral-700 dark:text-neutral-300 border-0"
              >
                <span>{isSheetExpanded ? 'Tap to lower preview' : 'Tap to expand choices'}</span>
                {isSheetExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Mobile Category Tabs */}
            <div className="flex items-center justify-center space-x-2 my-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('wallpapers')}
                className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all ${
                  activeTab === 'wallpapers'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                    : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                }`}
              >
                Wallpapers
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('colors')}
                className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all ${
                  activeTab === 'colors'
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                    : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                }`}
              >
                Pure Colors
              </button>
            </div>

            {/* Cards Grid */}
            <div className="flex-1 overflow-y-auto no-scrollbar grid grid-cols-3 gap-3 pb-2 pt-1">
              {activeTab === 'wallpapers' ? (
                <>
                  {/* Card 1: Album */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center cursor-pointer group"
                  >
                    <div className="w-full aspect-[3/4] rounded-[20px] bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 transition-all flex items-center justify-center shadow-2xs border border-neutral-200/60 dark:border-neutral-700">
                      <ImageIcon className="w-7 h-7 text-neutral-700 dark:text-neutral-300" strokeWidth={2} />
                    </div>
                    <span className="text-[12px] font-medium text-neutral-800 dark:text-neutral-200 mt-1">
                      Album
                    </span>
                  </div>

                  {/* Card 2: Default */}
                  <div
                    onClick={() => setSelectedThemeValue('/chat-background.png')}
                    className="flex flex-col items-center cursor-pointer group"
                  >
                    <div className={`w-full aspect-[3/4] rounded-[20px] bg-white dark:bg-neutral-800 border-2 transition-all shadow-2xs flex items-center justify-center ${
                      selectedThemeValue === '/chat-background.png'
                        ? 'border-[#FE2C55] ring-2 ring-[#FE2C55]/30 scale-[1.02]'
                        : 'border-neutral-300 dark:border-neutral-700'
                    }`}>
                      <span className="text-[11px] font-semibold text-neutral-500">Default</span>
                    </div>
                    <span className="text-[12px] font-medium text-neutral-800 dark:text-neutral-200 mt-1">
                      Default
                    </span>
                  </div>

                  {/* Photo Wallpapers */}
                  {CHAT_THEMES.map((theme) => {
                    const isSelected = selectedThemeValue === theme.value;
                    return (
                      <div
                        key={theme.id}
                        onClick={() => setSelectedThemeValue(theme.value)}
                        className="flex flex-col items-center cursor-pointer group"
                      >
                        <div
                          className={`w-full aspect-[3/4] rounded-[20px] overflow-hidden transition-all shadow-2xs ${
                            isSelected
                              ? 'ring-3 ring-[#FE2C55] ring-offset-2 scale-[1.02]'
                              : 'hover:opacity-90 '
                          }`}
                        >
                          <img
                            src={theme.thumbnail}
                            alt={theme.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <span className="text-[12px] font-medium text-neutral-800 dark:text-neutral-200 mt-1 truncate max-w-full px-1">
                          {theme.name}
                        </span>
                      </div>
                    );
                  })}
                </>
              ) : (
                /* Pure Colors for Mobile */
                SOLID_COLORS.map((col) => {
                  const isSelected = selectedThemeValue === col.value;
                  return (
                    <div
                      key={col.id}
                      onClick={() => setSelectedThemeValue(col.value)}
                      className="flex flex-col items-center cursor-pointer group"
                    >
                      <div
                        className={`w-full aspect-[3/4] rounded-[20px] border-2 transition-all shadow-2xs flex items-center justify-center ${
                          isSelected
                            ? 'border-[#FE2C55] ring-3 ring-[#FE2C55]/30 scale-[1.02]'
                            : 'border-neutral-300 dark:border-neutral-700'
                        }`}
                        style={{ backgroundColor: col.colorHex }}
                      >
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-[#FE2C55] text-white flex items-center justify-center shadow-xs">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <span className="text-[11.5px] font-semibold text-neutral-800 dark:text-neutral-200 mt-1 truncate max-w-full px-1">
                        {col.name}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
