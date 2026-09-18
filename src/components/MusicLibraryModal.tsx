import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Music, Play, Pause, Bookmark, Check, ArrowLeft, Volume2, Sparkles, Loader2, X } from 'lucide-react';
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
      return;
    }

    // Subscribe to Firestore songs asynchronously
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

    return () => {
      clearTimeout(timer);
      unsubSongs();
      unsubFavs();
    };
  }, [isOpen, currentUser?.uid]);

  const handlePlayPause = (song: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingSongId === song.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingSongId(null);
    } else {
      setIsLoadingAudio(true);
      setPlayingSongId(song.id);
      if (audioRef.current) {
        audioRef.current.src = song.url;
        audioRef.current.play().then(() => {
          setIsLoadingAudio(false);
        }).catch((err) => {
          console.error("Audio playback error:", err);
          setIsLoadingAudio(false);
        });
      }
    }
  };

  const handleToggleFavorite = async (songId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser?.uid) return;
    try {
      await toggleSongFavorite(songId, currentUser.uid);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredSongs = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return songs.filter((song) => {
      const matchesQuery =
        !query ||
        song.title.toLowerCase().includes(query) ||
        song.artist.toLowerCase().includes(query);

      if (activeTab === 'favorites') {
        return favoriteSongIds.includes(song.id) && matchesQuery;
      }
      return matchesQuery;
    });
  }, [songs, searchQuery, activeTab, favoriteSongIds]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 15 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="fixed inset-0 z-[200] bg-black md:bg-black/40 md:backdrop-blur-xl text-white flex flex-col items-center justify-center font-sans overflow-hidden md:p-6 md:pl-28"
      >
        {/* Full Screen Android on mobile, Soft Liquid Water Glass Container on PC */}
        <div 
          className="w-full h-full md:max-w-[760px] md:h-[680px] bg-black md:bg-zinc-950/85 md:backdrop-blur-2xl md:rounded-[32px] md:border md:border-white/15 flex flex-col overflow-hidden relative shadow-2xl"
          style={{
            boxShadow: '0 25px 60px -15px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.12) inset',
          }}
        >
          {/* Top Header */}
          <div className="pt-10 sm:pt-4 px-4 md:px-6 pb-3 bg-black/90 md:bg-zinc-900/40 border-b border-white/10 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-all active:scale-90"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">Audio Library</h2>
                <p className="text-xs text-gray-400 font-normal hidden md:block">Select background track for your creation</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {selectedSongId && (
                <button
                  onClick={() => {
                    onSelectSong(null as any);
                    onClose();
                  }}
                  className="text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 px-3.5 py-1.5 rounded-full border border-rose-500/20"
                >
                  Remove sound
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

          {/* Search Bar & Tabs */}
          <div className="p-4 md:px-6 pb-2 bg-black md:bg-transparent space-y-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search music, artists, genres..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-10 py-3 bg-gray-900 md:bg-white/10 hover:bg-gray-850 md:hover:bg-white/15 focus:bg-gray-850 md:focus:bg-white/15 rounded-2xl outline-none focus:ring-1 focus:ring-purple-500 transition-all text-sm text-white placeholder-gray-400 border border-white/10"
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

            {/* Pill Tabs */}
            <div className="flex space-x-2 pt-1 border-b border-white/10 pb-3">
              <button
                onClick={() => setActiveTab('trending')}
                className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${
                  activeTab === 'trending'
                    ? 'bg-white text-black shadow-md'
                    : 'bg-gray-900 md:bg-white/10 text-gray-400 hover:text-white border border-white/10'
                }`}
              >
                For You
              </button>
              <button
                onClick={() => setActiveTab('favorites')}
                className={`px-5 py-2 rounded-full text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  activeTab === 'favorites'
                    ? 'bg-white text-black shadow-md'
                    : 'bg-gray-900 md:bg-white/10 text-gray-400 hover:text-white border border-white/10'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>Saved ({favoriteSongIds.length})</span>
              </button>
            </div>
          </div>

          {/* Track List */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-2 space-y-2 no-scrollbar">
            {filteredSongs.length === 0 ? (
              <div className="py-24 text-center space-y-3">
                <Music className="w-12 h-12 text-gray-600 mx-auto opacity-50" />
                <p className="text-gray-400 text-sm font-medium">No music found</p>
              </div>
            ) : (
              filteredSongs.map((song) => {
                const isSelected = selectedSongId === song.id;
                const isPlaying = playingSongId === song.id;
                const isFav = favoriteSongIds.includes(song.id);

                return (
                  <div
                    key={song.id}
                    onClick={() => {
                      onSelectSong(song);
                      onClose();
                    }}
                    className={`flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer border active:scale-[0.99] ${
                      isSelected
                        ? 'bg-purple-900/40 border-purple-500/50 shadow-md'
                        : 'bg-gray-900/60 md:bg-white/5 hover:bg-gray-850 md:hover:bg-white/10 border-white/5 md:border-white/10'
                    }`}
                  >
                    <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                      {/* Cover Art */}
                      <div
                        onClick={(e) => handlePlayPause(song, e)}
                        className="relative w-14 h-14 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 shrink-0 overflow-hidden shadow-md flex items-center justify-center group cursor-pointer"
                      >
                        {song.thumbnail ? (
                          <img
                            src={song.thumbnail}
                            alt={song.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Music className="w-6 h-6 text-white/80" />
                        )}

                        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          {isPlaying && isLoadingAudio ? (
                            <Loader2 className="w-6 h-6 text-white animate-spin" />
                          ) : isPlaying ? (
                            <Pause className="w-6 h-6 text-white fill-white" />
                          ) : (
                            <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                          )}
                        </div>
                      </div>

                      {/* Metadata */}
                      <div className="min-w-0 text-left flex-1">
                        <h4 className="font-semibold text-sm text-white truncate leading-tight">
                          {song.title}
                        </h4>
                        <p className="text-gray-400 text-xs truncate mt-1">
                          {song.artist}
                        </p>
                      </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center space-x-2 shrink-0 ml-3">
                      <button
                        onClick={(e) => handleToggleFavorite(song.id, e)}
                        className={`p-2.5 rounded-full transition-all ${
                          isFav
                            ? 'text-rose-400 bg-rose-500/10'
                            : 'text-gray-400 hover:text-white bg-white/5'
                        }`}
                      >
                        <Bookmark className={`w-4 h-4 ${isFav ? 'fill-rose-400' : ''}`} />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSong(song);
                          onClose();
                        }}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-purple-600 text-white'
                            : 'bg-white text-black hover:bg-gray-200'
                        }`}
                      >
                        {isSelected ? 'Selected' : 'Use'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <audio
          ref={audioRef}
          onEnded={() => setPlayingSongId(null)}
          className="hidden"
        />
      </motion.div>
    </AnimatePresence>
  );
};
