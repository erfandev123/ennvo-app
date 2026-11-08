import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Music, Play, Pause, Bookmark, X, Maximize2, Minimize2 } from 'lucide-react';
import { Song } from '../types';
import { useAppStore } from '../store';
import { subscribeSongs, toggleSongFavorite, subscribeFavoriteSongs, DEFAULT_SONGS } from '../services/postService';

interface MusicLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSong: (song: Song) => void;
  selectedSongId?: string;
}

export const MusicLibraryModal: React.FC<MusicLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectSong,
  selectedSongId,
}) => {
  const { currentUser } = useAppStore();
  const [songs, setSongs] = useState<Song[]>(DEFAULT_SONGS);
  const [favoriteSongIds, setFavoriteSongIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'trending' | 'favorites'>('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Audio Playback state
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingSongId(null);
      setIsFullScreen(false);
      return;
    }

    let unsubSongs = () => {};
    const timer = setTimeout(() => {
      unsubSongs = subscribeSongs((firestoreSongs) => {
        if (firestoreSongs.length > 0) {
          setSongs(firestoreSongs);
        }
      });
    }, 50);

    let unsubFavs = () => {};
    if (currentUser?.uid) {
      unsubFavs = subscribeFavoriteSongs(currentUser.uid, (favIds) => {
        setFavoriteSongIds(favIds);
      });
    }

    const handleBack = (e: Event) => {
      e.preventDefault();
      if (audioRef.current) audioRef.current.pause();
      onClose();
    };
    window.addEventListener('appBackPress', handleBack);

    return () => {
      clearTimeout(timer);
      unsubSongs();
      unsubFavs();
      window.removeEventListener('appBackPress', handleBack);
    };
  }, [isOpen, currentUser?.uid, onClose]);

  const togglePlay = (song: Song, e: React.MouseEvent) => {
    e.stopPropagation();

    if (playingSongId === song.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingSongId(null);
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    setIsLoadingAudio(true);
    audioRef.current.src = song.url;
    audioRef.current
      .play()
      .then(() => {
        setPlayingSongId(song.id);
        setIsLoadingAudio(false);
      })
      .catch((err) => {
        console.error('Audio play error:', err);
        setIsLoadingAudio(false);
      });

    audioRef.current.onended = () => {
      setPlayingSongId(null);
    };
  };

  const handleToggleFavorite = async (songId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser?.uid) return;
    try {
      await toggleSongFavorite(currentUser.uid, songId);
    } catch (err) {
      console.error('Toggle favorite song error:', err);
    }
  };

  const filteredSongs = useMemo(() => {
    let list = songs;
    if (activeTab === 'favorites') {
      list = list.filter((s) => favoriteSongIds.includes(s.id));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.artist.toLowerCase().includes(q)
      );
    }
    return list;
  }, [songs, activeTab, favoriteSongIds, searchQuery]);

  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 640;
  });

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6">
        {/* Soft frosted glass overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            if (audioRef.current) audioRef.current.pause();
            onClose();
          }}
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
                if (audioRef.current) audioRef.current.pause();
                onClose();
              }
            }
          }}
          className={`w-full max-w-[540px] bg-white/95 dark:bg-neutral-950/95 backdrop-blur-2xl flex flex-col overflow-hidden relative shadow-2xl border-0 sm:border sm:border-black/10 sm:dark:border-white/10 z-10 sm:my-auto transition-[height,border-radius] duration-300 ease-out ${
            isFullScreen
              ? 'h-[100dvh] max-h-[100dvh] rounded-none sm:rounded-[32px] sm:h-[90vh]'
              : 'h-[85vh] sm:h-[640px] max-h-[90vh] sm:max-h-[85vh] rounded-t-[34px] sm:rounded-[32px]'
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
                <Music className="w-4.5 h-4.5" />
              </div>
              <div>
                <h2 className="text-[18px] font-bold text-neutral-900 dark:text-white tracking-tight">
                  Audio Library
                </h2>
                <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
                  Select a soundtrack for your post
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
                onClick={() => {
                  if (audioRef.current) audioRef.current.pause();
                  onClose();
                }}
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
                placeholder="Search songs, artists..."
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

          {/* Filter Pills */}
          <div className="relative z-10 px-5 pt-3 pb-2 flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setActiveTab('trending')}
              className={`px-4 py-1.5 rounded-full text-[12.5px] font-bold transition-all cursor-pointer border-0 ${
                activeTab === 'trending'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-neutral-100 dark:bg-white/[0.05] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-white/10'
              }`}
            >
              Trending Tracks
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('favorites')}
              className={`px-4 py-1.5 rounded-full text-[12.5px] font-bold transition-all cursor-pointer border-0 flex items-center space-x-1.5 ${
                activeTab === 'favorites'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-neutral-100 dark:bg-white/[0.05] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-white/10'
              }`}
            >
              <Bookmark className="w-3 h-3" />
              <span>Saved ({favoriteSongIds.length})</span>
            </button>
          </div>

          {/* Song List */}
          <div className="relative z-10 flex-1 overflow-y-auto px-5 py-2 space-y-2 no-scrollbar">
            {filteredSongs.length === 0 ? (
              <div className="py-16 text-center text-neutral-400">
                <Music className="w-10 h-10 mx-auto opacity-30 mb-2" />
                <p className="text-sm font-semibold">No songs found</p>
                <p className="text-xs text-neutral-500 mt-0.5">Try searching with a different term</p>
              </div>
            ) : (
              filteredSongs.map((song) => {
                const isPlaying = playingSongId === song.id;
                const isSelected = selectedSongId === song.id;
                const isFavorite = favoriteSongIds.includes(song.id);

                return (
                  <div
                    key={song.id}
                    onClick={() => {
                      if (audioRef.current) audioRef.current.pause();
                      onSelectSong(song);
                      onClose();
                    }}
                    className={`w-full p-2.5 rounded-[22px] flex items-center justify-between transition-all cursor-pointer border-0 ${
                      isSelected
                        ? 'bg-blue-500/10 dark:bg-blue-500/15 ring-2 ring-blue-500'
                        : 'bg-neutral-100/60 dark:bg-white/[0.03] hover:bg-neutral-100 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0 pr-2">
                      {/* Album Art with Play overlay */}
                      <div className="relative w-12 h-12 rounded-[16px] overflow-hidden shrink-0 bg-neutral-200 dark:bg-white/10">
                        <img
                          src={song.cover || 'https://picsum.photos/seed/song/200'}
                          alt={song.title}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={(e) => togglePlay(song, e)}
                          className="absolute inset-0 bg-black/35 hover:bg-black/50 flex items-center justify-center text-white transition-all cursor-pointer border-0"
                        >
                          {isPlaying ? (
                            <Pause className="w-5 h-5 fill-current" />
                          ) : (
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          )}
                        </button>
                      </div>

                      {/* Song Details */}
                      <div className="flex flex-col min-w-0">
                        <span className="text-[13.5px] font-bold text-neutral-900 dark:text-white truncate">
                          {song.title}
                        </span>
                        <span className="text-[11.5px] text-neutral-500 dark:text-neutral-400 truncate">
                          {song.artist} • {song.duration ? `${song.duration}s` : 'Audio'}
                        </span>
                      </div>
                    </div>

                    {/* Actions: Bookmark & Select button */}
                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleToggleFavorite(song.id, e)}
                        className={`p-2 rounded-full transition-colors cursor-pointer border-0 ${
                          isFavorite
                            ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/30'
                            : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 bg-transparent'
                        }`}
                        title={isFavorite ? 'Remove bookmark' : 'Bookmark track'}
                      >
                        <Bookmark className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (audioRef.current) audioRef.current.pause();
                          onSelectSong(song);
                          onClose();
                        }}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border-0 ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-neutral-200 dark:bg-white/10 text-neutral-700 dark:text-neutral-200 hover:bg-blue-600 hover:text-white'
                        }`}
                      >
                        {isSelected ? 'Used' : 'Add'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note */}
          <div className="relative z-10 px-5 py-3 text-center bg-white/50 dark:bg-neutral-950/50 backdrop-blur-md">
            <span className="text-[11px] text-neutral-400">
              🎵 High fidelity audio synchronizes with your post
            </span>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
