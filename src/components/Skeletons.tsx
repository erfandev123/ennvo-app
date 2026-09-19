import React from 'react';

/**
 * Facebook-style Shimmer Element
 * Renders a lightweight, hardware-accelerated shimmering skeleton box
 */
export const ShimmerBox: React.FC<{
  className?: string;
  dark?: boolean;
  style?: React.CSSProperties;
}> = ({ className = '', dark = false, style }) => {
  return (
    <div
      className={`relative overflow-hidden ${
        dark ? 'bg-zinc-800/80 fb-shimmer-dark' : 'bg-gray-200/90 fb-shimmer'
      } ${className}`}
      style={style}
    />
  );
};

/**
 * Facebook Story Skeleton (horizontal scrolling row of story cards)
 */
export const FacebookStorySkeleton: React.FC<{ dark?: boolean }> = ({ dark = false }) => {
  return (
    <div className="flex items-center space-x-2.5 px-3 py-2 overflow-x-hidden select-none pointer-events-none">
      {/* Create Story card placeholder */}
      <div className={`shrink-0 w-[95px] sm:w-[110px] h-[160px] sm:h-[185px] rounded-2xl border ${
        dark ? 'border-zinc-800 bg-zinc-900' : 'border-gray-100 bg-white shadow-2xs'
      } overflow-hidden flex flex-col relative`}>
        <ShimmerBox dark={dark} className="w-full h-[115px] sm:h-[135px]" />
        <div className="flex-1 flex flex-col items-center justify-center p-1.5 relative">
          <div className={`w-7 h-7 rounded-full absolute -top-3.5 border-2 ${
            dark ? 'border-zinc-900 bg-zinc-800' : 'border-white bg-gray-200'
          } flex items-center justify-center`}>
            <ShimmerBox dark={dark} className="w-4 h-4 rounded-full" />
          </div>
          <ShimmerBox dark={dark} className="w-12 h-2.5 rounded-full mt-2" />
        </div>
      </div>

      {/* 4 story card placeholders with top avatar and bottom user name */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`shrink-0 w-[95px] sm:w-[110px] h-[160px] sm:h-[185px] rounded-2xl border ${
            dark ? 'border-zinc-800 bg-zinc-900' : 'border-gray-100 bg-white shadow-2xs'
          } overflow-hidden p-2 flex flex-col justify-between relative`}
        >
          {/* Top avatar circle with ring */}
          <div className="flex items-center space-x-1 z-10">
            <div className={`w-8 h-8 rounded-full p-0.5 border ${
              dark ? 'border-zinc-700 bg-zinc-800' : 'border-blue-400 bg-white'
            }`}>
              <ShimmerBox dark={dark} className="w-full h-full rounded-full" />
            </div>
          </div>

          {/* Full background shimmer card */}
          <ShimmerBox dark={dark} className="absolute inset-0 w-full h-full opacity-60" />

          {/* Bottom user name shimmer */}
          <div className="z-10 space-y-1">
            <ShimmerBox dark={dark} className="w-14 h-2.5 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Facebook Create Post Box Skeleton
 */
export const FacebookCreatePostSkeleton: React.FC<{ dark?: boolean }> = ({ dark = false }) => {
  return (
    <div className={`w-full p-3.5 rounded-2xl border ${
      dark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-100 shadow-2xs'
    } select-none pointer-events-none mb-3`}>
      <div className="flex items-center space-x-3 mb-3">
        <ShimmerBox dark={dark} className="w-10 h-10 rounded-full shrink-0" />
        <ShimmerBox dark={dark} className="flex-1 h-9 rounded-full" />
      </div>
      <div className={`border-t ${dark ? 'border-zinc-800' : 'border-gray-100'} pt-2.5 flex items-center justify-around`}>
        <div className="flex items-center space-x-2">
          <ShimmerBox dark={dark} className="w-5 h-5 rounded-md" />
          <ShimmerBox dark={dark} className="w-16 h-3 rounded-full hidden sm:block" />
        </div>
        <div className="flex items-center space-x-2">
          <ShimmerBox dark={dark} className="w-5 h-5 rounded-md" />
          <ShimmerBox dark={dark} className="w-16 h-3 rounded-full hidden sm:block" />
        </div>
        <div className="flex items-center space-x-2">
          <ShimmerBox dark={dark} className="w-5 h-5 rounded-md" />
          <ShimmerBox dark={dark} className="w-16 h-3 rounded-full hidden sm:block" />
        </div>
      </div>
    </div>
  );
};

/**
 * Facebook Post Card Skeleton (Granular Feed Post)
 */
export const FacebookPostSkeleton: React.FC<{ dark?: boolean; hasMedia?: boolean }> = ({
  dark = false,
  hasMedia = true,
}) => {
  return (
    <div className={`w-full rounded-2xl border ${
      dark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-100 shadow-2xs'
    } overflow-hidden select-none pointer-events-none mb-3.5`}>
      {/* Post Header: Avatar, Name, Timestamp, 3 dots */}
      <div className="p-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <ShimmerBox dark={dark} className="w-10 h-10 rounded-full shrink-0" />
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <ShimmerBox dark={dark} className="w-28 sm:w-36 h-3.5 rounded-full" />
              <ShimmerBox dark={dark} className="w-3.5 h-3.5 rounded-full" />
            </div>
            <ShimmerBox dark={dark} className="w-16 sm:w-20 h-2.5 rounded-full" />
          </div>
        </div>
        <ShimmerBox dark={dark} className="w-6 h-6 rounded-full" />
      </div>

      {/* Caption lines */}
      <div className="px-3.5 pb-3 space-y-2">
        <ShimmerBox dark={dark} className="w-11/12 h-3 rounded-full" />
        <ShimmerBox dark={dark} className="w-3/4 h-3 rounded-full" />
      </div>

      {/* Post Media Container (image/video placeholder) */}
      {hasMedia && (
        <div className="w-full relative aspect-square sm:aspect-[4/3] max-h-[440px] overflow-hidden">
          <ShimmerBox dark={dark} className="w-full h-full" />
        </div>
      )}

      {/* Social engagement counts */}
      <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-gray-100/80">
        <div className="flex items-center space-x-1.5">
          <ShimmerBox dark={dark} className="w-4 h-4 rounded-full" />
          <ShimmerBox dark={dark} className="w-12 h-2.5 rounded-full" />
        </div>
        <div className="flex items-center space-x-3">
          <ShimmerBox dark={dark} className="w-14 h-2.5 rounded-full" />
          <ShimmerBox dark={dark} className="w-12 h-2.5 rounded-full" />
        </div>
      </div>

      {/* Action buttons (Like, Comment, Share) */}
      <div className="px-2 py-1.5 flex items-center justify-around">
        <div className="flex items-center space-x-2 py-1.5 px-3">
          <ShimmerBox dark={dark} className="w-4 h-4 rounded-md" />
          <ShimmerBox dark={dark} className="w-10 h-3 rounded-full" />
        </div>
        <div className="flex items-center space-x-2 py-1.5 px-3">
          <ShimmerBox dark={dark} className="w-4 h-4 rounded-md" />
          <ShimmerBox dark={dark} className="w-12 h-3 rounded-full" />
        </div>
        <div className="flex items-center space-x-2 py-1.5 px-3">
          <ShimmerBox dark={dark} className="w-4 h-4 rounded-md" />
          <ShimmerBox dark={dark} className="w-10 h-3 rounded-full" />
        </div>
      </div>
    </div>
  );
};

/**
 * Facebook Reel Card Skeleton (Vertical Video Loader)
 */
export const FacebookReelSkeleton: React.FC = () => {
  return (
    <div className="w-full h-full bg-black relative flex flex-col justify-between p-4 overflow-hidden select-none pointer-events-none">
      {/* Background ambient shimmer */}
      <ShimmerBox dark={true} className="absolute inset-0 w-full h-full opacity-40" />

      {/* Top Header Placeholder */}
      <div className="relative z-10 flex items-center justify-between pt-safe">
        <ShimmerBox dark={true} className="w-24 h-6 rounded-full" />
        <div className="flex space-x-2">
          <ShimmerBox dark={true} className="w-8 h-8 rounded-full" />
          <ShimmerBox dark={true} className="w-8 h-8 rounded-full" />
        </div>
      </div>

      {/* Right Side Action Stack */}
      <div className="absolute right-3.5 bottom-20 z-10 flex flex-col items-center space-y-4">
        {/* Creator avatar */}
        <div className="relative mb-1">
          <ShimmerBox dark={true} className="w-11 h-11 rounded-full border-2 border-white/40" />
          <ShimmerBox dark={true} className="w-4 h-4 rounded-full absolute -bottom-1 left-1/2 -translate-x-1/2" />
        </div>
        {/* Like */}
        <div className="flex flex-col items-center space-y-1">
          <ShimmerBox dark={true} className="w-9 h-9 rounded-full" />
          <ShimmerBox dark={true} className="w-6 h-2 rounded-full" />
        </div>
        {/* Comment */}
        <div className="flex flex-col items-center space-y-1">
          <ShimmerBox dark={true} className="w-9 h-9 rounded-full" />
          <ShimmerBox dark={true} className="w-6 h-2 rounded-full" />
        </div>
        {/* Share */}
        <div className="flex flex-col items-center space-y-1">
          <ShimmerBox dark={true} className="w-9 h-9 rounded-full" />
          <ShimmerBox dark={true} className="w-6 h-2 rounded-full" />
        </div>
        {/* Music Disc */}
        <ShimmerBox dark={true} className="w-8 h-8 rounded-full border border-white/30" />
      </div>

      {/* Bottom Left Info Area */}
      <div className="relative z-10 max-w-[75%] space-y-2.5 pb-safe mb-16">
        <div className="flex items-center space-x-2.5">
          <ShimmerBox dark={true} className="w-8 h-8 rounded-full" />
          <ShimmerBox dark={true} className="w-28 h-3.5 rounded-full" />
          <ShimmerBox dark={true} className="w-16 h-6 rounded-full" />
        </div>
        <ShimmerBox dark={true} className="w-full h-3 rounded-full" />
        <ShimmerBox dark={true} className="w-4/5 h-3 rounded-full" />
        <div className="flex items-center space-x-2 pt-1">
          <ShimmerBox dark={true} className="w-4 h-4 rounded-full" />
          <ShimmerBox dark={true} className="w-36 h-2.5 rounded-full" />
        </div>
      </div>
    </div>
  );
};

/**
 * Facebook Profile Page Skeleton (Header + Tabs + Grid)
 */
export const FacebookProfileSkeleton: React.FC<{ dark?: boolean }> = ({ dark = false }) => {
  return (
    <div className={`w-full min-h-screen ${dark ? 'bg-black text-white' : 'bg-white text-gray-900'} select-none pointer-events-none`}>
      {/* Profile Header */}
      <div className="p-4 space-y-4 max-w-xl mx-auto">
        {/* Top bar: username + buttons */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center space-x-2">
            <ShimmerBox dark={dark} className="w-32 h-5 rounded-full" />
            <ShimmerBox dark={dark} className="w-4 h-4 rounded-full" />
          </div>
          <div className="flex space-x-2">
            <ShimmerBox dark={dark} className="w-8 h-8 rounded-full" />
            <ShimmerBox dark={dark} className="w-8 h-8 rounded-full" />
          </div>
        </div>

        {/* Avatar + Stats Counters */}
        <div className="flex items-center justify-between py-2">
          <div className="relative">
            <ShimmerBox dark={dark} className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-gray-100" />
          </div>
          <div className="flex items-center space-x-6 sm:space-x-8 pr-4">
            <div className="flex flex-col items-center space-y-1.5">
              <ShimmerBox dark={dark} className="w-8 h-4 rounded-full" />
              <ShimmerBox dark={dark} className="w-10 h-2.5 rounded-full" />
            </div>
            <div className="flex flex-col items-center space-y-1.5">
              <ShimmerBox dark={dark} className="w-8 h-4 rounded-full" />
              <ShimmerBox dark={dark} className="w-12 h-2.5 rounded-full" />
            </div>
            <div className="flex flex-col items-center space-y-1.5">
              <ShimmerBox dark={dark} className="w-8 h-4 rounded-full" />
              <ShimmerBox dark={dark} className="w-12 h-2.5 rounded-full" />
            </div>
          </div>
        </div>

        {/* Bio lines */}
        <div className="space-y-2">
          <ShimmerBox dark={dark} className="w-40 h-3.5 rounded-full" />
          <ShimmerBox dark={dark} className="w-64 h-3 rounded-full" />
          <ShimmerBox dark={dark} className="w-48 h-3 rounded-full" />
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center space-x-2 pt-1">
          <ShimmerBox dark={dark} className="flex-1 h-9 rounded-xl" />
          <ShimmerBox dark={dark} className="flex-1 h-9 rounded-xl" />
          <ShimmerBox dark={dark} className="w-9 h-9 rounded-xl" />
        </div>

        {/* Story Highlights row */}
        <div className="flex items-center space-x-3.5 pt-2 overflow-x-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center space-y-1.5">
              <ShimmerBox dark={dark} className="w-14 h-14 rounded-full border-2 border-gray-100" />
              <ShimmerBox dark={dark} className="w-10 h-2 rounded-full" />
            </div>
          ))}
        </div>

        {/* Tabs Row */}
        <div className={`border-t ${dark ? 'border-zinc-800' : 'border-gray-100'} pt-3 flex items-center justify-around`}>
          <ShimmerBox dark={dark} className="w-8 h-6 rounded-md" />
          <ShimmerBox dark={dark} className="w-8 h-6 rounded-md" />
          <ShimmerBox dark={dark} className="w-8 h-6 rounded-md" />
        </div>
      </div>

      {/* Grid of Post/Reel thumbnails */}
      <FacebookGridSkeleton count={9} dark={dark} />
    </div>
  );
};

/**
 * Facebook / Instagram 3-column Grid Skeleton (Posts & Reels)
 */
export const FacebookGridSkeleton: React.FC<{ count?: number; dark?: boolean }> = ({
  count = 9,
  dark = false,
}) => {
  return (
    <div className="grid grid-cols-3 gap-1 px-1 select-none pointer-events-none">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="aspect-square relative overflow-hidden bg-gray-100">
          <ShimmerBox dark={dark} className="w-full h-full" />
        </div>
      ))}
    </div>
  );
};

/**
 * Facebook Message List Skeleton
 */
export const FacebookMessageListSkeleton: React.FC<{ dark?: boolean }> = ({ dark = false }) => {
  return (
    <div className="p-3 space-y-3 select-none pointer-events-none">
      {/* Active story notes row */}
      <div className="flex items-center space-x-3 pb-2 overflow-x-hidden">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex flex-col items-center space-y-1.5 shrink-0">
            <ShimmerBox dark={dark} className="w-14 h-14 rounded-full" />
            <ShimmerBox dark={dark} className="w-10 h-2 rounded-full" />
          </div>
        ))}
      </div>

      {/* Conversation items */}
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="flex items-center space-x-3 p-2 rounded-2xl">
          <div className="relative shrink-0">
            <ShimmerBox dark={dark} className="w-13 h-13 rounded-full" />
            <ShimmerBox dark={dark} className="w-3.5 h-3.5 rounded-full absolute bottom-0 right-0 border-2 border-white" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <ShimmerBox dark={dark} className="w-32 h-3.5 rounded-full" />
              <ShimmerBox dark={dark} className="w-10 h-2.5 rounded-full" />
            </div>
            <ShimmerBox dark={dark} className="w-48 h-2.5 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Facebook Notification List Skeleton
 */
export const FacebookNotificationSkeleton: React.FC<{ dark?: boolean }> = ({ dark = false }) => {
  return (
    <div className="p-3 space-y-3.5 select-none pointer-events-none">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex items-center justify-between space-x-3 p-2 rounded-2xl">
          <div className="flex items-center space-x-3 flex-1">
            <ShimmerBox dark={dark} className="w-12 h-12 rounded-full shrink-0" />
            <div className="space-y-1.5 flex-1">
              <ShimmerBox dark={dark} className="w-4/5 h-3.5 rounded-full" />
              <ShimmerBox dark={dark} className="w-20 h-2.5 rounded-full" />
            </div>
          </div>
          <ShimmerBox dark={dark} className="w-11 h-11 rounded-lg shrink-0" />
        </div>
      ))}
    </div>
  );
};

/**
 * Facebook Search Page Skeleton
 */
export const FacebookSearchSkeleton: React.FC<{ dark?: boolean }> = ({ dark = false }) => {
  return (
    <div className="p-3 space-y-3.5 select-none pointer-events-none">
      {/* Search Bar Skeleton */}
      <div className="flex items-center space-x-2">
        <ShimmerBox dark={dark} className="flex-1 h-10 rounded-2xl" />
        <ShimmerBox dark={dark} className="w-10 h-10 rounded-2xl shrink-0" />
      </div>

      {/* Trending Tags Row */}
      <div className="flex items-center space-x-2 overflow-x-hidden py-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <ShimmerBox key={i} dark={dark} className="w-20 h-8 rounded-xl shrink-0" />
        ))}
      </div>

      {/* Explore Grid */}
      <FacebookGridSkeleton count={12} dark={dark} />
    </div>
  );
};
