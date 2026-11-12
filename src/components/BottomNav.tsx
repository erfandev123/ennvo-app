import React, { memo, useRef, useCallback, useState } from 'react';
import { motion } from 'motion/react';
import { useAppStore, PageType } from '../store';
import { 
  NavHomeIcon, 
  NavFeedIcon, 
  NavMessageIcon, 
  NavCreateIcon, 
  NavProfileIcon 
} from './NavIcons';

const BottomNav = memo(() => {
  const currentPage = useAppStore(state => state.currentPage);
  const pushPage = useAppStore(state => state.pushPage);
  const currentUser = useAppStore(state => state.currentUser);
  const notificationCount = useAppStore(state => state.notificationCount);
  const messageCount = useAppStore(state => state.messageCount);
  const setViewingUser = useAppStore(state => state.setViewingUser);
  const viewingUser = useAppStore(state => state.viewingUser);
  const navStyle = useAppStore(state => state.navStyle);
  const appTheme = useAppStore(state => state.appTheme);
  const setShowAccountSwitcherModal = useAppStore(state => state.setShowAccountSwitcherModal);
  const setShowReelCamera = useAppStore(state => state.setShowReelCamera);

  const navItems = [
    { id: 'home', icon: NavHomeIcon, label: 'Home' },
    { id: 'reels', icon: NavFeedIcon, label: 'Feed' },
    { id: 'create', icon: NavCreateIcon, label: 'New' },
    { id: 'messages', icon: NavMessageIcon, label: 'Inbox', badge: messageCount + notificationCount },
    { id: 'profile', icon: NavProfileIcon, label: 'Profile' },
  ];

  // Download the chunk the moment a finger touches the tab, so the page is
  // already parsed by the time the tap completes. On a slow phone this is the
  // difference between an instant tab switch and a skeleton flash.
  const prefetchPage = useCallback((id: string) => {
    switch (id) {
      case 'home': import('../pages/Reels').catch(() => {}); break;
      case 'reels': import('../pages/Home').catch(() => {}); break;
      case 'messages': import('../pages/Messages').catch(() => {}); break;
      case 'profile': import('../pages/Profile').catch(() => {}); break;
      default: break;
    }
  }, []);

  const lastClickRef = useRef<{ [key: string]: number }>({});
  const navRef = useRef<HTMLElement>(null);
  const [dragHoveredId, setDragHoveredId] = useState<string | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  const handleItemClick = useCallback((id: string) => {
    const now = Date.now();
    const lastClick = lastClickRef.current[id] || 0;
    const isDoubleClick = now - lastClick < 300;
    lastClickRef.current[id] = now;

    if (id === 'create') {
      const { setSelectedCreateMode } = useAppStore.getState();
      setSelectedCreateMode('reel');
      setShowReelCamera(true);
      return;
    }

    if (id === 'profile') {
      // Tapping Profile always opens the profile page. The account switcher used
      // to hijack this tap (including double taps), which felt like a broken menu.
      // Switch account now lives in Settings -> Switch account.
      setViewingUser(null);
    }

    if (id === 'home' && currentPage === 'home') {
      document.getElementById('global-reels-container')?.scrollTo({ top: 0, behavior: 'smooth' });
      window.dispatchEvent(new Event('refreshReels'));
    } else if (id === 'reels' && currentPage === 'reels') {
      const homeTarget = document.getElementById('home-scroll-container');
      if (homeTarget) {
        homeTarget.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }

    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
      try { window.navigator.vibrate(6); } catch (e) {}
    }

    pushPage(id as any);
  }, [currentPage, pushPage, setViewingUser, setShowReelCamera, setShowAccountSwitcherModal]);

  // Touch gesture slider / drag between navigation items (iPhone-style fluid sliding)
  const getIndexFromTouchX = useCallback((clientX: number) => {
    if (!navRef.current) return -1;
    const rect = navRef.current.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right) return -1;
    const relativeX = clientX - rect.left;
    const itemWidth = rect.width / navItems.length;
    const index = Math.floor(relativeX / itemWidth);
    return Math.max(0, Math.min(navItems.length - 1, index));
  }, [navItems.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    isDraggingRef.current = true;
    const idx = getIndexFromTouchX(e.touches[0].clientX);
    if (idx >= 0) {
      setDragHoveredId(navItems[idx].id);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const idx = getIndexFromTouchX(e.touches[0].clientX);
    if (idx >= 0) {
      const nextId = navItems[idx].id;
      setDragHoveredId((prev) => {
        if (prev !== nextId) {
          if (typeof window !== 'undefined' && window.navigator?.vibrate) {
            try { window.navigator.vibrate(4); } catch (err) {}
          }
          return nextId;
        }
        return prev;
      });
    }
  };

  const handleTouchEnd = () => {
    if (isDraggingRef.current && dragHoveredId) {
      handleItemClick(dragHoveredId);
    }
    isDraggingRef.current = false;
    setDragHoveredId(null);
  };

  const isReels = currentPage === 'home';
  const isDarkNav = appTheme === 'dark' || isReels;
  const effectiveActiveId = dragHoveredId || currentPage;

  // Ultra-Lightweight iPhone Instagram-Style Floating Glass Navigation Bar
  if (navStyle === 'glass') {
    const totalBadge = messageCount + notificationCount;

    return (
      <div className="md:hidden fixed bottom-5 sm:bottom-6 left-0 right-0 z-[60] flex justify-center pointer-events-none pb-[var(--app-safe-bottom)]">
        <nav 
          ref={navRef}
          aria-label="Bottom Navigation"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`pointer-events-auto select-none flex items-center justify-between h-[56px] w-auto min-w-[292px] max-w-[340px] px-2 py-1 rounded-full backdrop-blur-2xl transition-colors duration-200 touch-none ${
            isDarkNav
              ? 'bg-black/82 border border-white/15 shadow-[0_10px_38px_rgba(0,0,0,0.55),inset_0_1px_1px_rgba(255,255,255,0.18)] text-white'
              : 'bg-white/92 border border-sky-100 shadow-[0_10px_34px_rgba(14,165,233,0.14),0_2px_8px_rgba(0,0,0,0.05),inset_0_1px_1.5px_rgba(255,255,255,0.95)] text-slate-800'
          }`}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = effectiveActiveId === item.id && (item.id !== 'profile' || viewingUser === null);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item.id)}
                className="relative flex-1 h-full flex items-center justify-center px-1 rounded-full cursor-pointer transition-transform active:scale-95"
                title={item.label}
              >
                {/* iPhone Smooth Fluid Pill with Haptic Spring */}
                {isActive && (
                  <motion.div
                    layoutId="iphoneGlassActivePill"
                    transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                    className={`absolute inset-1 rounded-full ${
                      isDarkNav 
                        ? 'bg-white/18 border border-white/25 shadow-xs' 
                        : 'bg-sky-500/12 border border-sky-300/50 shadow-xs'
                    }`}
                  />
                )}

                <div className="relative z-10 flex items-center justify-center">
                  {item.id === 'create' ? (
                    <div className="w-[32px] h-[32px] rounded-full bg-gradient-to-tr from-sky-400 via-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-sky-500/35 transition-transform">
                      <NavCreateIcon size={17} className="text-white" />
                    </div>
                  ) : item.id === 'profile' ? (
                    currentUser?.avatar ? (
                      <img 
                        src={currentUser.avatar} 
                        className={`w-[24px] h-[24px] rounded-full object-cover transition-all ${
                          isActive 
                            ? 'ring-2 ring-sky-500 ring-offset-1 ring-offset-transparent scale-105' 
                            : 'opacity-85 hover:opacity-100'
                        }`} 
                        alt="Profile" 
                      />
                    ) : (
                      <NavProfileIcon 
                        size={21} 
                        filled={isActive} 
                        className={isActive ? (isDarkNav ? 'text-white' : 'text-sky-600') : (isDarkNav ? 'text-white/60' : 'text-slate-500')} 
                      />
                    )
                  ) : (
                    <div className="relative flex items-center justify-center">
                      <Icon 
                        size={21} 
                        filled={isActive} 
                        className={`transition-colors duration-150 ${
                          isActive 
                            ? (isDarkNav ? 'text-white scale-105' : 'text-sky-600 scale-105') 
                            : (isDarkNav ? 'text-white/60 hover:text-white' : 'text-slate-500 hover:text-slate-900')
                        }`} 
                      />
                      {item.id === 'messages' && totalBadge > 0 && (
                        <div className="absolute -top-1.5 -right-2 bg-[#FE2C55] text-white text-[9px] font-bold min-w-[15px] h-[15px] rounded-full flex items-center justify-center px-1 border border-white shadow-xs">
                          {totalBadge > 99 ? '99+' : totalBadge}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </nav>
      </div>
    );
  }

  // Classic Standard Navigation Bar (Uniform styling across all pages, zero purple)
  const classicNavBgClass = isDarkNav ? 'bg-black/92 border-white/10 text-white' : 'bg-white/92 border-gray-100/90 shadow-[0_-2px_18px_rgba(0,0,0,0.06)] text-gray-900';

  return (
    <div className={`md:hidden fixed bottom-0 left-0 right-0 bottom-nav-classic ${classicNavBgClass} backdrop-blur-2xl border-t flex items-center justify-around h-[calc(58px+var(--app-safe-bottom))] pb-[var(--app-safe-bottom)] z-[60] px-3 select-none gpu-accelerated`}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentPage === item.id && (item.id !== 'profile' || viewingUser === null);
        
        const getIconColor = () => {
          if (isDarkNav) {
            return isActive ? 'text-white' : 'text-gray-400 hover:text-gray-200';
          }
          return isActive ? 'text-sky-600' : 'text-gray-400 hover:text-gray-600';
        };

        return (
          <button
            key={item.id}
            onClick={() => handleItemClick(item.id)}
            onPointerDown={() => prefetchPage(item.id)}
            onTouchStart={() => prefetchPage(item.id)}
            className="flex items-center justify-center flex-1 h-full relative transform-gpu transition-transform duration-75 ease-out select-none touch-manipulation cursor-pointer active:scale-95"
          >
            {/* The little dot under the active tab, like the phone apps. */}
            <span
              className={`absolute bottom-1.5 w-1 h-1 rounded-full transition-all duration-200 ${
                isActive
                  ? isDarkNav ? 'bg-white scale-100 opacity-100' : 'bg-sky-500 scale-100 opacity-100'
                  : 'scale-0 opacity-0'
              }`}
            />
            <div className="relative flex flex-col items-center justify-center pointer-events-none">
              {item.id === 'profile' ? (
                <div className={`rounded-full transition-all duration-150 ${isActive ? (isDarkNav ? 'ring-2 ring-sky-400 p-[1px]' : 'ring-2 ring-sky-500 p-[1px]') : ''}`}>
                  <img 
                    src={currentUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || '')}&background=random`} 
                    className="w-[23px] h-[23px] rounded-full object-cover shadow-2xs" 
                    alt="Profile" 
                    loading="lazy" 
                    decoding="async" 
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : item.id === 'create' ? (
                <div className="w-[38px] h-[30px] rounded-xl bg-gradient-to-tr from-sky-400 via-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/25">
                  <NavCreateIcon 
                    size={18}
                    className="text-white" 
                  />
                </div>
              ) : (
                <Icon 
                  size={23} 
                  filled={isActive}
                  className={`transition-all duration-150 ${getIconColor()} ${isActive ? 'scale-105' : ''}`} 
                />
              )}
              
              {item.id === 'messages' && (messageCount + notificationCount) > 0 && (
                <div className="absolute -top-1 -right-2 bg-[#FE2C55] text-white text-[10px] font-bold min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-1 shadow-xs border border-white">
                  {messageCount + notificationCount > 99 ? '99+' : messageCount + notificationCount}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
});

export default BottomNav;
