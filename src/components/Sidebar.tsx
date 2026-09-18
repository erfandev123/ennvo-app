import React, { memo, useRef, useState, useCallback, useEffect } from 'react';
import { Home, Search, Inbox, PlusSquare, User, Bell, LayoutList, Settings, Film, Image as ImageIcon, Sparkles } from 'lucide-react';
import { useAppStore } from '../store';

const Sidebar = memo(({ currentPage }: { currentPage: string }) => {
  const currentUser = useAppStore(state => state.currentUser);
  const pushPage = useAppStore(state => state.pushPage);
  const notificationCount = useAppStore(state => state.notificationCount);
  const messageCount = useAppStore(state => state.messageCount);
  const setViewingUser = useAppStore(state => state.setViewingUser);
  const setShowCreatePost = useAppStore(state => state.setShowCreatePost);
  const setSelectedCreateMode = useAppStore(state => state.setSelectedCreateMode);

  const dockRef = useRef<HTMLDivElement>(null);
  const lastClickRef = useRef<{ [key: string]: number }>({});
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);

  // Responsive desktop detection - strictly never render on mobile viewports
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 768 : true);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close create menu when clicking outside
  useEffect(() => {
    if (!showCreateMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setShowCreateMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCreateMenu]);
  
  // Drag-to-navigate state & refs (smooth vertical drag pointer tracking)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isPointerDownRef = useRef(false);
  const startYRef = useRef(0);
  const hasDraggedRef = useRef(false);

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'reels', label: 'Feed', icon: LayoutList },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'messages', label: 'Inbox', icon: Inbox, badge: messageCount },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: notificationCount },
    { id: 'create', label: 'Create', icon: PlusSquare },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const handleNavigate = useCallback((pageId: string) => {
    if (pageId === 'create') {
      setShowCreateMenu(prev => !prev);
      return;
    }

    setShowCreateMenu(false);
    const now = Date.now();
    const lastClick = lastClickRef.current[pageId] || 0;
    const isDoubleClick = now - lastClick < 320;
    lastClickRef.current[pageId] = now;

    if (pageId === 'profile') {
      setViewingUser(null);
    }

    if (isDoubleClick) {
      if (pageId === 'home' && currentPage === 'home') {
        document.getElementById('global-reels-container')?.scrollTo({ top: 0, behavior: 'smooth' });
        window.dispatchEvent(new Event('refreshReels'));
      } else if (pageId === 'reels' && currentPage === 'reels') {
        const homeTarget = document.getElementById('home-scroll-container');
        if (homeTarget) {
          homeTarget.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    }

    pushPage(pageId as any);
  }, [currentPage, pushPage, setViewingUser]);

  // Pointer drag gestures
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    isPointerDownRef.current = true;
    startYRef.current = e.clientY;
    hasDraggedRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current || !dockRef.current) return;
    const dy = e.clientY - startYRef.current;

    if (!hasDraggedRef.current && Math.abs(dy) > 7) {
      hasDraggedRef.current = true;
      setIsDragging(true);
      if (dockRef.current.setPointerCapture) {
        try {
          dockRef.current.setPointerCapture(e.pointerId);
        } catch (err) {}
      }
    }

    if (hasDraggedRef.current) {
      const itemsContainer = dockRef.current.querySelector('.ultra-glass-pc-items');
      if (itemsContainer) {
        const rect = itemsContainer.getBoundingClientRect();
        const totalItems = navItems.length;
        const itemHeight = rect.height / totalItems;
        const relativeY = Math.max(0, Math.min(rect.height - 1, e.clientY - rect.top));
        const currentSlot = Math.min(totalItems - 1, Math.max(0, Math.floor(relativeY / itemHeight)));

        if (currentSlot !== hoverIndex) {
          setHoverIndex(currentSlot);
          if (typeof window !== 'undefined' && window.navigator?.vibrate) {
            try { window.navigator.vibrate(6); } catch (err) {}
          }
        }
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;

    if (dockRef.current && dockRef.current.hasPointerCapture && dockRef.current.hasPointerCapture(e.pointerId)) {
      try {
        dockRef.current.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }

    if (hasDraggedRef.current && hoverIndex !== null) {
      const targetItem = navItems[hoverIndex];
      if (targetItem) {
        handleNavigate(targetItem.id);
      }
    }

    setIsDragging(false);
    setHoverIndex(null);
    hasDraggedRef.current = false;
  };

  const handlePointerCancel = () => {
    isPointerDownRef.current = false;
    setIsDragging(false);
    setHoverIndex(null);
    hasDraggedRef.current = false;
  };

  if (!isDesktop) return null;

  return (
    <aside
      ref={dockRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className="ultra-glass-pc-dock hidden md:flex flex-col items-center justify-between"
      style={{
        cursor: isDragging ? 'grabbing' : 'default',
      }}
      aria-label="Desktop Navigation"
    >
      {/* Top Ennvo Brand Logo */}
      <div 
        onClick={() => handleNavigate('home')}
        className="w-10 h-10 rounded-2xl flex items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95 mb-1 group relative"
        title="Ennvo Home"
      >
        <div className="w-8 h-8 rounded-xl overflow-hidden shadow-xs border border-white/80 flex items-center justify-center bg-white/40 backdrop-blur-xs">
          <img 
            src="/Ennvo.png" 
            alt="Ennvo" 
            loading="lazy" 
            decoding="async" 
            className="w-full h-full object-cover" 
          />
        </div>
        <span className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900/90 text-white text-[11px] font-medium rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200 shadow-md backdrop-blur-md whitespace-nowrap z-50">
          Ennvo
        </span>
      </div>

      {/* Navigation Items (Vertical Stack) */}
      <div className="ultra-glass-pc-items flex flex-col items-center w-full py-1">
        {navItems.map((item, index) => {
          const isActive = currentPage === item.id;
          const isHoveredInDrag = isDragging && hoverIndex === index;
          const Icon = item.icon;

          return (
            <div key={item.id} className="relative flex items-center justify-center">
              <button
                type="button"
                onClick={() => {
                  if (!hasDraggedRef.current) {
                    handleNavigate(item.id);
                  }
                }}
                className={`ultra-glass-pc-item group ${isActive || (item.id === 'create' && showCreateMenu) ? 'active' : ''} ${isHoveredInDrag ? 'is-drag-hovered' : ''}`}
                aria-label={item.label}
                style={{
                  // Explicitly no background behind active icon
                  backgroundColor: 'transparent',
                  border: 'none',
                }}
              >
                {/* Profile Avatar or Vector Icon */}
                {item.id === 'profile' && currentUser?.avatar ? (
                  <div className="relative">
                    <img
                      src={currentUser.avatar}
                      alt="Profile"
                      loading="lazy"
                      decoding="async"
                      className={`w-[25px] h-[25px] rounded-full object-cover border-2 transition-all duration-200 ${
                        isActive ? 'border-slate-900 scale-110 shadow-xs ring-2 ring-slate-900/10' : 'border-transparent group-hover:scale-110'
                      }`}
                    />
                  </div>
                ) : (
                  <Icon
                    className={`ultra-glass-pc-icon ${
                      isActive || (item.id === 'create' && showCreateMenu)
                        ? 'stroke-slate-950 stroke-[2.4] scale-110'
                        : 'stroke-slate-500 group-hover:stroke-slate-900 group-hover:scale-105'
                    }`}
                  />
                )}

                {/* Notification / Message Badge */}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[10px] font-bold min-w-[17px] h-[17px] rounded-full flex items-center justify-center border-2 border-white shadow-xs px-0.5 pointer-events-none">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}

                {/* Liquid Glass Floating Tooltip */}
                {!showCreateMenu && (
                  <span className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900/90 text-white text-[12px] font-medium rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200 shadow-md backdrop-blur-md whitespace-nowrap z-50">
                    {item.label}
                  </span>
                )}
              </button>

              {/* PC Create Options Flyout (Reels, Post, Story) */}
              {item.id === 'create' && showCreateMenu && (
                <div
                  ref={createMenuRef}
                  className="absolute left-full ml-4 top-1/2 -translate-y-1/2 z-[100] w-48 rounded-[24px] p-2 bg-white/80 backdrop-blur-2xl border border-white/90 shadow-[0_16px_40px_rgba(0,0,0,0.12)] flex flex-col space-y-1 animate-in fade-in zoom-in-95 duration-150"
                  style={{
                    boxShadow: '0 20px 45px -10px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.7) inset',
                  }}
                >
                  <div className="px-3 py-1.5 border-b border-gray-100/80 mb-0.5">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Create New</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateMenu(false);
                      setSelectedCreateMode('reel');
                      pushPage('create');
                    }}
                    className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-purple-50 text-gray-700 hover:text-purple-600 transition-all text-xs font-semibold group/item cursor-pointer text-left"
                  >
                    <div className="w-7 h-7 rounded-lg bg-purple-100/70 text-purple-600 flex items-center justify-center group-hover/item:scale-110 transition-transform">
                      <Film className="w-3.5 h-3.5" />
                    </div>
                    <span>Reel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateMenu(false);
                      setSelectedCreateMode('post');
                      pushPage('create');
                    }}
                    className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-blue-50 text-gray-700 hover:text-blue-600 transition-all text-xs font-semibold group/item cursor-pointer text-left"
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-100/70 text-blue-600 flex items-center justify-center group-hover/item:scale-110 transition-transform">
                      <ImageIcon className="w-3.5 h-3.5" />
                    </div>
                    <span>Post</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateMenu(false);
                      setSelectedCreateMode('story');
                      pushPage('create');
                    }}
                    className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-amber-50 text-gray-700 hover:text-amber-600 transition-all text-xs font-semibold group/item cursor-pointer text-left"
                  >
                    <div className="w-7 h-7 rounded-lg bg-amber-100/70 text-amber-600 flex items-center justify-center group-hover/item:scale-110 transition-transform">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <span>Story</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Settings Button */}
      <div className="pt-1 mt-1 border-t border-white/60 w-full flex justify-center">
        <button
          type="button"
          onClick={() => handleNavigate('settings')}
          className={`ultra-glass-pc-item group ${currentPage === 'settings' ? 'active' : ''}`}
          aria-label="Settings"
          style={{ backgroundColor: 'transparent', border: 'none' }}
        >
          <Settings 
            className={`ultra-glass-pc-icon ${
              currentPage === 'settings'
                ? 'stroke-slate-950 stroke-[2.4] scale-110'
                : 'stroke-slate-500 group-hover:stroke-slate-900 group-hover:scale-105'
            }`} 
          />
          <span className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900/90 text-white text-[12px] font-medium rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all duration-200 shadow-md backdrop-blur-md whitespace-nowrap z-50">
            Settings
          </span>
        </button>
      </div>
    </aside>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;
