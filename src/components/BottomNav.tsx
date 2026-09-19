import React, { memo, useRef, useState, useCallback } from 'react';
import { Home, Inbox, User, PlusSquare, LayoutList } from 'lucide-react';
import { useAppStore } from '../store';

const BottomNav = memo(() => {
  const currentPage = useAppStore(state => state.currentPage);
  const pushPage = useAppStore(state => state.pushPage);
  const currentUser = useAppStore(state => state.currentUser);
  const notificationCount = useAppStore(state => state.notificationCount);
  const messageCount = useAppStore(state => state.messageCount);
  const setViewingUser = useAppStore(state => state.setViewingUser);
  const viewingUser = useAppStore(state => state.viewingUser);
  const navStyle = useAppStore(state => state.navStyle);
  const setShowAccountSwitcherModal = useAppStore(state => state.setShowAccountSwitcherModal);

  const navItems = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'reels', icon: LayoutList, label: 'Feed' },
    { id: 'create', icon: PlusSquare, label: 'New' },
    { id: 'messages', icon: Inbox, label: 'Inbox', badge: messageCount + notificationCount },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  const lastClickRef = useRef<{ [key: string]: number }>({});

  // Gesture Drag-To-Navigate State for Glass Nav
  const navRef = useRef<HTMLElement>(null);
  const isPointerDownRef = useRef(false);
  const startXRef = useRef(0);
  const hasDraggedRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [dragTranslateX, setDragTranslateX] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const handleItemClick = useCallback((id: string) => {
    const now = Date.now();
    const lastClick = lastClickRef.current[id] || 0;
    const isDoubleClick = now - lastClick < 300;
    lastClickRef.current[id] = now;

    if (id === 'profile') {
      setViewingUser(null);
      if (currentPage === 'profile' || isDoubleClick) {
        setShowAccountSwitcherModal(true);
      }
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
      try { window.navigator.vibrate(8); } catch (e) {}
    }

    pushPage(id as any);
  }, [currentPage, pushPage, setViewingUser]);

  const isReels = currentPage === 'home';

  // Render New Ultra Liquid Glass Navigation Bar
  if (navStyle === 'glass') {
    const getGlassActiveIndex = () => {
      if (currentPage === 'home') return 0;
      if (currentPage === 'reels') return 1;
      if (currentPage === 'create') return 2;
      if (currentPage === 'messages') return 3;
      if (currentPage === 'profile' && viewingUser === null) return 4;
      return 0;
    };

    const activeGlassIndex = getGlassActiveIndex();
    const totalBadge = messageCount + notificationCount;

    // Pointer events for drag-to-navigate
    const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
      // Only primary button / touch
      if (e.button !== 0) return;
      isPointerDownRef.current = true;
      startXRef.current = e.clientX;
      hasDraggedRef.current = false;
      setIsHolding(true);
      setHoverIndex(activeGlassIndex);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
      if (!isPointerDownRef.current || !navRef.current) return;
      const dx = e.clientX - startXRef.current;

      if (!hasDraggedRef.current && Math.abs(dx) > 7) {
        hasDraggedRef.current = true;
        setIsDragging(true);

        if (e.currentTarget.setPointerCapture) {
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch (err) {}
        }
      }

      if (hasDraggedRef.current) {
        const rect = navRef.current.getBoundingClientRect();
        const navWidth = rect.width;
        const itemWidth = navWidth / 5;

        // Position the center of the slot under the finger
        const targetSlotLeft = e.clientX - rect.left - (itemWidth / 2);
        const clampedSlotLeft = Math.max(0, Math.min(navWidth - itemWidth, targetSlotLeft));
        setDragTranslateX(clampedSlotLeft);

        // Determine current hovered slot 0..4
        const relativeX = Math.max(0, Math.min(navWidth - 1, e.clientX - rect.left));
        const currentSlot = Math.min(4, Math.floor(relativeX / itemWidth));

        if (currentSlot !== hoverIndex) {
          setHoverIndex(currentSlot);
          if (typeof window !== 'undefined' && window.navigator?.vibrate) {
            try { window.navigator.vibrate(6); } catch (err) {}
          }
        }
      }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
      if (!isPointerDownRef.current) return;
      isPointerDownRef.current = false;

      if (e.currentTarget.hasPointerCapture && e.currentTarget.hasPointerCapture(e.pointerId)) {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }

      if (hasDraggedRef.current && hoverIndex !== null) {
        const targetItem = navItems[hoverIndex];
        if (targetItem) {
          handleItemClick(targetItem.id);
        }
      }

      // Smooth release
      setIsDragging(false);
      setIsHolding(false);
      setDragTranslateX(null);
      setHoverIndex(null);
      hasDraggedRef.current = false;
    };

    const displayIndex = isDragging && hoverIndex !== null ? hoverIndex : activeGlassIndex;

    return (
      <div className="md:hidden fixed bottom-8 left-0 right-0 z-[60] flex justify-center pointer-events-none pb-[env(safe-area-inset-bottom)] gpu-accelerated">
        <nav 
          ref={navRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`ultra-glass-nav pointer-events-auto select-none ${currentPage === 'home' ? 'dark-mode' : 'light-mode'}`}
        >
          {/* Dynamic Percentage / Continuous Draggable Indicator Slot */}
          <div 
            className={`circle-slot ${isDragging ? 'is-dragging' : ''}`} 
            style={{ 
              transform: isDragging && dragTranslateX !== null 
                ? `translateX(${dragTranslateX}px)` 
                : `translateX(${activeGlassIndex * 100}%)` 
            }}
          >
            <div className={`active-glass-circle ${isHolding || isDragging ? 'is-holding' : ''}`}></div>
          </div>

          {/* 1. Cute Perfect Home Icon */}
          <button 
            className={`glass-nav-item ${displayIndex === 0 ? 'active' : ''}`}
            onClick={(e) => {
              if (hasDraggedRef.current) return;
              handleItemClick('home');
            }}
          >
            <svg className="glass-nav-icon" viewBox="0 0 24 24">
              <path d="M3.75 10.5L11.1 4.35a1.5 1.5 0 0 1 1.8 0l7.35 6.15M5.5 9.5V19.25a1.75 1.75 0 0 0 1.75 1.75h9.5a1.75 1.75 0 0 0 1.75-1.75V9.5"></path>
            </svg>
          </button>

          {/* 2. Cute Perfect Feed Icon */}
          <button 
            className={`glass-nav-item ${displayIndex === 1 ? 'active' : ''}`}
            onClick={(e) => {
              if (hasDraggedRef.current) return;
              handleItemClick('reels');
            }}
          >
            <svg className="glass-nav-icon" viewBox="0 0 24 24">
              <rect x="3.75" y="3.75" width="6.5" height="6.5" rx="2.25"></rect>
              <rect x="13.75" y="3.75" width="6.5" height="6.5" rx="2.25"></rect>
              <rect x="13.75" y="13.75" width="6.5" height="6.5" rx="2.25"></rect>
              <rect x="3.75" y="13.75" width="6.5" height="6.5" rx="2.25"></rect>
            </svg>
          </button>

          {/* 3. Special Cute Post Icon (+) */}
          <button 
            className={`glass-nav-item ${displayIndex === 2 ? 'active' : ''}`}
            onClick={(e) => {
              if (hasDraggedRef.current) return;
              handleItemClick('create');
            }}
          >
            <div className="post-btn-glow">
              <svg className="glass-nav-icon" viewBox="0 0 24 24" style={{ width: '18px', height: '18px', strokeWidth: 2.8 }}>
                <path d="M12 5.5v13M5.5 12h13"></path>
              </svg>
            </div>
          </button>

          {/* 4. Cute Perfect Message Icon */}
          <button 
            className={`glass-nav-item ${displayIndex === 3 ? 'active' : ''}`}
            onClick={(e) => {
              if (hasDraggedRef.current) return;
              handleItemClick('messages');
            }}
          >
            <div className="relative flex items-center justify-center">
              <svg className="glass-nav-icon" viewBox="0 0 24 24">
                <path d="M12 3.75c-4.56 0-8.25 3.47-8.25 7.75 0 1.63.53 3.14 1.45 4.38L4 19.75l4.13-1.1c1.2.45 2.52.7 3.87.7 4.56 0 8.25-3.47 8.25-7.75S16.56 3.75 12 3.75z"></path>
              </svg>
              {totalBadge > 0 && (
                <div className="absolute -top-1.5 -right-2 bg-[#FE2C55] text-white text-[9px] font-semibold min-w-[15px] h-[15px] rounded-full flex items-center justify-center px-1 shadow-xs border border-white/40">
                  {totalBadge > 99 ? '99+' : totalBadge}
                </div>
              )}
            </div>
          </button>

          {/* 5. Cute Perfect Profile Icon */}
          <button 
            className={`glass-nav-item ${displayIndex === 4 ? 'active' : ''}`}
            onClick={(e) => {
              if (hasDraggedRef.current) return;
              handleItemClick('profile');
            }}
          >
            {currentUser?.avatar ? (
              <img 
                src={currentUser.avatar} 
                className={`w-[22px] h-[22px] rounded-full object-cover transition-transform ${displayIndex === 4 ? 'ring-1.5 ring-white' : 'opacity-80'}`} 
                alt="Profile" 
              />
            ) : (
              <svg className="glass-nav-icon" viewBox="0 0 24 24">
                <circle cx="12" cy="7.75" r="3.75"></circle>
                <path d="M4.75 19.25a7.25 7.25 0 0 1 14.5 0"></path>
              </svg>
            )}
          </button>
        </nav>
      </div>
    );
  }

  // Render Classic Standard Android Navigation Bar
  return (
    <div className={`md:hidden fixed bottom-0 left-0 right-0 ${isReels ? 'bg-black/90 border-white/10' : 'bg-white/95 border-gray-100 shadow-xs'} backdrop-blur-lg border-t flex items-center justify-around h-[calc(54px+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] z-[60] px-3 select-none gpu-accelerated`}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentPage === item.id && (item.id !== 'profile' || viewingUser === null);
        
        return (
          <button
            key={item.id}
            onClick={() => handleItemClick(item.id)}
            className="flex items-center justify-center flex-1 h-full relative active:scale-95 transform-gpu transition-transform duration-100 ease-out select-none touch-manipulation cursor-pointer"
          >
            <div className="relative flex flex-col items-center justify-center pointer-events-none">
              {item.id === 'profile' ? (
                <div className={`rounded-full transition-all duration-150 ${isActive ? (isReels ? 'ring-2 ring-white p-[1px]' : 'ring-2 ring-purple-600 p-[1px]') : ''}`}>
                  <img 
                    src={currentUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || '')}&background=random`} 
                    className={`w-[22px] h-[22px] rounded-full object-cover shadow-2xs`} 
                    alt="Profile" 
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : item.id === 'create' ? (
                <div className="w-[38px] h-[28px] rounded-lg bg-gradient-to-tr from-purple-600 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-md shadow-purple-500/25">
                  <PlusSquare 
                    className="w-[18px] h-[18px] text-white" 
                    strokeWidth={2.2}
                  />
                </div>
              ) : (
                <Icon 
                  className={`w-[22px] h-[22px] transition-all duration-150 ${isActive ? (isReels ? 'text-white' : 'text-purple-600') : (isReels ? 'text-gray-400' : 'text-gray-400 hover:text-gray-600')}`} 
                  strokeWidth={isActive ? 2.3 : 1.7}
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
