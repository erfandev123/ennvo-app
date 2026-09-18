import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, MapPin, Navigation, Check, X, ArrowLeft } from 'lucide-react';

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
  'New York, NY, USA',
  'London, United Kingdom',
  'Tokyo, Japan',
  'Paris, France',
  'Dubai, United Arab Emirates',
  'Kuala Lumpur, Malaysia',
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

  if (!isOpen) return null;

  const filteredLocations = POPULAR_LOCATIONS.filter((loc) =>
    loc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const locStr = `Lat: ${pos.coords.latitude.toFixed(2)}, Lon: ${pos.coords.longitude.toFixed(2)}`;
        onSelectLocation(locStr);
        onClose();
      },
      (err) => {
        setIsLocating(false);
        onSelectLocation('Dhaka, Bangladesh');
        onClose();
      }
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="fixed inset-0 z-[200] bg-gray-950 md:bg-black/40 md:backdrop-blur-xl text-white flex flex-col items-center justify-center font-sans overflow-hidden md:p-6 md:pl-28"
      >
        {/* Full Screen Android on mobile, Soft Liquid Water Glass Container on PC */}
        <div 
          className="w-full h-full md:max-w-[720px] md:h-[660px] bg-gray-950 md:bg-zinc-950/85 md:backdrop-blur-2xl md:rounded-[32px] md:border md:border-white/15 flex flex-col overflow-hidden relative shadow-2xl"
          style={{
            boxShadow: '0 25px 60px -15px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.12) inset',
          }}
        >
          {/* Top Header */}
          <div className="pt-10 sm:pt-4 px-4 md:px-6 pb-3 bg-gray-950 md:bg-zinc-900/40 border-b border-gray-800 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-all active:scale-90"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">Add Location</h2>
                <p className="text-xs text-gray-400 font-normal hidden md:block">Tag a city, place, or landmark to your post</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {selectedLocation ? (
                <button
                  onClick={() => {
                    onSelectLocation(null);
                    onClose();
                  }}
                  className="text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 px-4 py-2 rounded-full border border-rose-500/20"
                >
                  Clear location
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="text-xs font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-4 py-2 rounded-full border border-emerald-500/20"
                >
                  Done
                </button>
              )}
              <button
                onClick={onClose}
                className="hidden md:flex p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search & GPS Location button */}
          <div className="p-4 md:px-6 bg-gray-950 md:bg-transparent border-b border-gray-800/80 space-y-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
              <input
                type="text"
                placeholder="Search city, venue or place..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    onSelectLocation(searchQuery.trim());
                    onClose();
                  }
                }}
                className="w-full pl-11 pr-10 py-3 bg-gray-900 md:bg-white/10 focus:bg-gray-850 md:focus:bg-white/15 rounded-2xl outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-normal text-sm text-white placeholder-gray-400 border border-gray-800 md:border-white/10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              onClick={handleUseCurrentLocation}
              disabled={isLocating}
              className="w-full py-3 px-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/20 transition-all flex items-center justify-center space-x-2 text-xs font-bold active:scale-95"
            >
              <Navigation className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
              <span>{isLocating ? 'Locating device...' : 'Use current device location'}</span>
            </button>
          </div>

          {/* Locations List */}
          <div className="flex-1 overflow-y-auto p-4 md:px-6 space-y-2.5 no-scrollbar">
            {searchQuery.trim() && !filteredLocations.includes(searchQuery.trim()) && (
              <div
                onClick={() => {
                  onSelectLocation(searchQuery.trim());
                  onClose();
                }}
                className="flex items-center space-x-3 p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 cursor-pointer hover:bg-emerald-900/40 transition-all"
              >
                <MapPin className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-sm font-semibold">Select "{searchQuery.trim()}"</span>
              </div>
            )}

            {filteredLocations.map((loc) => {
              const isSelected = selectedLocation === loc;
              return (
                <div
                  key={loc}
                  onClick={() => {
                    onSelectLocation(loc);
                    onClose();
                  }}
                  className={`flex items-center justify-between p-3.5 rounded-2xl transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-white shadow-md'
                      : 'bg-gray-900/60 md:bg-white/5 hover:bg-gray-850 md:hover:bg-white/10 border-gray-800 md:border-white/10 text-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium">{loc}</span>
                  </div>

                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-md">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
