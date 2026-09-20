import React, { useState, useRef, useEffect } from 'react';
import { Loader2, ArrowDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  className?: string;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  className = '',
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);

  const PULL_THRESHOLD = 75;

  const handleTouchStart = (e: React.TouchEvent) => {
    const el = containerRef.current;
    if (el && el.scrollTop <= 0 && !isRefreshing) {
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPullingRef.current || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    const el = containerRef.current;
    if (diff > 0 && (!el || el.scrollTop <= 0)) {
      // Resistance factor for pull elastic feel
      const dist = Math.min(diff * 0.45, 110);
      setPullDistance(dist);
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(60);
      try {
        await onRefresh();
      } catch (e) {
        console.error('Refresh error:', e);
      } finally {
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
        }, 400);
      }
    } else {
      setPullDistance(0);
    }
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`relative overflow-y-auto overscroll-contain ${className}`}
    >
      {/* Native-style Floating Top Spinner Badge */}
      <AnimatePresence>
        {(pullDistance > 8 || isRefreshing) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6, y: -20 }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              y: isRefreshing ? 14 : Math.min(pullDistance * 0.6, 50)
            }}
            exit={{ opacity: 0, scale: 0.6, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="absolute top-1 left-0 right-0 z-[60] flex items-center justify-center pointer-events-none"
          >
            <div className="bg-white/95 backdrop-blur-xl shadow-[0_8px_24px_-4px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.06)] rounded-full p-2.5 flex items-center justify-center text-[#FE2C55]">
              {isRefreshing ? (
                <Loader2 className="w-5 h-5 animate-spin text-[#FE2C55]" />
              ) : (
                <ArrowDown
                  className="w-5 h-5 text-[#FE2C55] transition-transform duration-200"
                  style={{
                    transform: `rotate(${Math.min(180, (pullDistance / PULL_THRESHOLD) * 180)}deg)`,
                  }}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full">
        {children}
      </div>
    </div>
  );
};
