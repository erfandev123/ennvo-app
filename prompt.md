# Ennvo - Ultra-Fast Android & Web Performance & Architecture Specification

## Overview
**Ennvo** is a high-performance, lightweight social media platform built for Android (via Capacitor / Native) and Web.
The primary engineering objective is **Ultra-Fast Performance**, **Zero Lag**, and **Instant Responsiveness**, especially on low-end Android devices with limited CPU/RAM resources.

---

## Core Performance Principles for Low-End Android Devices

### 1. Code Splitting & Lazy Loading
- All heavy pages (`Home`, `Reels`, `Messages`, `Profile`, `Notifications`, `Search`) MUST be loaded lazily using `React.lazy()` and `Suspense`.
- Keeps initial bundle size micro-small (<100KB initial chunk), allowing instant app startup on 1GB/2GB RAM Android devices.

### 2. Rendering & Memory Optimization
- **React.memo & UseCallback**: Wrap list items (`PostItem`, `ReelItem`, `LikesList`, `MiniChat`) in `React.memo` to prevent re-renders when navigating or interacting.
- **Virtualization & Windowing**: Render only visible posts/reels in viewport. Unmount offscreen heavy video/image nodes.
- **Image Optimization**: Always set `loading="lazy"`, `decoding="async"`, and use optimized image sizes/thumbnails.

### 3. Hardware Acceleration & Touch Handling
- Enable CSS GPU Acceleration: `transform: translateZ(0)` & `will-change: transform`.
- Disable 300ms tap delay with `touch-action: manipulation` and `-webkit-tap-highlight-color: transparent`.
- Active memory cleanup on unmount for audio/video media resources.

### 4. Firestore & State Caching
- Cache feed, user profiles, and chat messages using local Zustand store or Firestore offline persistence.
- Minimize active real-time listeners (`onSnapshot`) to only active active view screens; detach listeners immediately on component unmount to prevent memory leaks.

---

## Native Android Integration Guidelines (Capacitor)
- Target: Android API 24+ (Android 7.0+) up to Android 15.
- Hardware-accelerated WebView settings enabled.
- Smooth native touch feel without web bounce delays.
