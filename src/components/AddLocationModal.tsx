import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, MapPin, Navigation, Check, X, Loader2, Maximize2, Minimize2 } from 'lucide-react';

interface AddLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLocation: string | null;
  onSelectLocation: (location: string | null) => void;
}

const POPULAR_LOCATIONS = [
  'Dhaka, Bangladesh',
  'Sylhet, Bangladesh',
  'Chittagong, Bangladesh',
  'Cox\'s Bazar, Bangladesh',
  'Rajshahi, Bangladesh',
  'Khulna, Bangladesh',
  'Barisal, Bangladesh',
  'Gulshan 2, Dhaka',
  'Dhanmondi Lake, Dhaka',
  'New York, NY, USA',
  'London, United Kingdom',
  'Tokyo, Japan',
  'Paris, France',
  'Dubai, United Arab Emirates',
  'Singapore',
];

export const AddLocationModal: React.FC<AddLocationModalProps> = ({
  isOpen,
  onClose,
  selectedLocation,
  onSelectLocation,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 640;
  });

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleBack = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    window.addEventListener('appBackPress', handleBack);
    return () => window.removeEventListener('appBackPress', handleBack);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredLocations = POPULAR_LOCATIONS.filter((loc) =>
    loc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      onSelectLocation('Dhaka, Bangladesh');
      onClose();
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const locStr = `${pos.coords.latitude.toFixed(2)}° N, ${pos.coords.longitude.toFixed(2)}° E`;
        onSelectLocation(locStr);
        onClose();
      },
      () => {
        setIsLocating(false);
        onSelectLocation('Dhaka, Bangladesh');
        onClose();
      },
      { timeout: 6000 }
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6">
        {/* Soft frosted backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-md"
        />

        {/* Modal Sheet - Perfectly Centered on PC, Smooth Slide Up on Mobile */}
        <motion.div
          initial={isDesktop ? { opacity: 0, scale: 0.95, y: 15 } : { y: '100%' }}
          animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
          exit={isDesktop ? { opacity: 0, scale: 0.95, y: 15 } : { y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 350, mass: 0.7 }}
          drag={isDesktop ? false : "y"}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.15, bottom: 0.4 }}
          onDragEnd={(_, info) => {
            if (isDesktop) return;
            if (info.offset.y < -50 || info.velocity.y < -300) {
              setIsFullScreen(true);
            } else if (info.offset.y > 90 || info.velocity.y > 350) {
              if (isFullScreen) {
                setIsFullScreen(false);
              } else {
                onClose();
              }
            }
          }}
          className={`w-full max-w-[540px] bg-white/95 dark:bg-neutral-950/95 backdrop-blur-2xl flex flex-col overflow-hidden relative shadow-2xl border-0 sm:border sm:border-black/10 sm:dark:border-white/10 z-10 sm:my-auto transition-[height,border-radius] duration-300 ease-out ${
            isFullScreen
              ? 'h-[100dvh] max-h-[100dvh] rounded-none sm:rounded-[32px] sm:h-[90vh]'
              : 'h-[80vh] sm:h-[600px] max-h-[90vh] sm:max-h-[85vh] rounded-t-[34px] sm:rounded-[32px]'
          }`}
        >
          {/* Top Ambient Blue Glow */}
          <div 
            className="pointer-events-none absolute top-0 left-0 right-0 h-44 bg-gradient-to-b from-sky-400/[0.16] via-blue-500/[0.06] to-transparent dark:from-blue-600/[0.22] dark:via-blue-800/[0.06] dark:to-transparent z-0" 
            aria-hidden="true" 
          />

          {/* Top Drag Handle Bar (Mobile Only) */}
          <div 
            onClick={() => setIsFullScreen(prev => !prev)}
            className="w-full pt-3 pb-1 flex sm:hidden items-center justify-center cursor-pointer select-none group"
            title={isFullScreen ? "Tap or drag down to shrink" : "Tap or drag up for full screen"}
          >
            <div className="w-12 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-700 group-hover:bg-neutral-400 dark:group-hover:bg-neutral-600 transition-colors" />
          </div>

          {/* Header */}
          <div className="relative z-10 px-5 pt-2 pb-3 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <MapPin className="w-4.5 h-4.5" />
              </div>
              <div>
                <h2 className="text-[18px] font-bold text-neutral-900 dark:text-white tracking-tight">
                  Add Location
                </h2>
                <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                  Tag where this moment took place
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1.5">
              {/* Fullscreen Expand/Collapse Button */}
              <button
                type="button"
                onClick={() => setIsFullScreen(prev => !prev)}
                className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-white/10 hover:bg-neutral-200 dark:hover:bg-white/15 flex items-center justify-center text-neutral-700 dark:text-neutral-200 cursor-pointer transition-all border-0 shadow-none"
                title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
              >
                {isFullScreen ? (
                  <Minimize2 className="w-4 h-4 stroke-[2.2]" />
                ) : (
                  <Maximize2 className="w-4 h-4 stroke-[2.2]" />
                )}
              </button>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-white/10 hover:bg-neutral-200 dark:hover:bg-white/15 flex items-center justify-center text-neutral-700 dark:text-neutral-200 cursor-pointer transition-all border-0 shadow-none"
                aria-label="Close"
              >
                <X className="w-4 h-4 stroke-[2.2]" />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative z-10 px-5 py-1">
            <div className="w-full bg-neutral-100/80 dark:bg-white/[0.06] rounded-full px-4 py-2.5 flex items-center space-x-2.5">
              <Search className="w-4 h-4 text-neutral-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search city, neighborhood, venue..."
                className="w-full bg-transparent border-0 text-[13.5px] text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-white p-0.5 cursor-pointer border-0 bg-transparent"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* GPS Quick Action */}
          <div className="relative z-10 px-5 pt-3 pb-1">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isLocating}
              className="w-full p-3.5 rounded-[22px] bg-blue-500/10 dark:bg-blue-500/15 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-between transition-all cursor-pointer border-0"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                  {isLocating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Navigation className="w-4 h-4" />
                  )}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[13px] font-bold">Use Current Location</span>
                  <span className="text-[11px] text-blue-500/80 dark:text-blue-400/80">
                    Find nearest spot using GPS
                  </span>
                </div>
              </div>
            </button>
          </div>

          {/* Location List */}
          <div className="relative z-10 flex-1 overflow-y-auto px-5 py-2 space-y-1.5 no-scrollbar">
            <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider px-1">
              Popular Spots
            </span>

            {/* Custom Location write-in option if search query doesn't match exactly */}
            {searchQuery.trim() && !filteredLocations.includes(searchQuery.trim()) && (
              <button
                type="button"
                onClick={() => {
                  onSelectLocation(searchQuery.trim());
                  onClose();
                }}
                className="w-full p-3 rounded-[20px] bg-neutral-100/70 dark:bg-white/[0.04] hover:bg-neutral-100 dark:hover:bg-white/[0.07] flex items-center justify-between text-left transition-all cursor-pointer border-0"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-white/10 text-neutral-600 dark:text-neutral-300 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[13px] font-bold text-neutral-900 dark:text-white">
                      "{searchQuery.trim()}"
                    </span>
                    <span className="text-[11px] text-neutral-500">Attach custom place</span>
                  </div>
                </div>
              </button>
            )}

            {filteredLocations.map((loc) => {
              const isSelected = selectedLocation === loc;
              return (
                <button
                  key={loc}
                  type="button"
                  onClick={() => {
                    onSelectLocation(isSelected ? null : loc);
                    onClose();
                  }}
                  className={`w-full p-3 rounded-[20px] flex items-center justify-between text-left transition-all cursor-pointer border-0 ${
                    isSelected
                      ? 'bg-blue-500/10 dark:bg-blue-500/15 ring-2 ring-blue-500 text-neutral-900 dark:text-white'
                      : 'bg-neutral-100/60 dark:bg-white/[0.03] hover:bg-neutral-100 dark:hover:bg-white/[0.06] text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-blue-600 text-white' : 'bg-neutral-200 dark:bg-white/10 text-neutral-500'
                    }`}>
                      <MapPin className="w-4 h-4" />
                    </div>
                    <span className="text-[13px] font-bold truncate">{loc}</span>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Remove location option if one is selected */}
          {selectedLocation && (
            <div className="relative z-10 px-5 pt-1 pb-4 bg-white/50 dark:bg-neutral-950/50 backdrop-blur-md">
              <button
                type="button"
                onClick={() => {
                  onSelectLocation(null);
                  onClose();
                }}
                className="w-full py-2.5 rounded-full font-bold text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 cursor-pointer border-0 text-center"
              >
                Remove Current Location ({selectedLocation})
              </button>
            </div>
          )}

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
