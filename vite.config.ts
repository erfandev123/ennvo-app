import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const isProd = mode === 'production';

  return {
    plugins: [react(), tailwindcss()],
    // NOTE: never force process.env.NODE_ENV here. React and the JSX runtime must
    // agree; a mismatch throws "n.jsxDEV is not a function" and blanks the page.
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    esbuild: {
      legalComments: 'none',
      drop: isProd ? ['debugger'] : [],
    },
    build: {
      target: 'es2020',
      minify: 'esbuild',
      sourcemap: false,
      reportCompressedSize: false,
      cssCodeSplit: true,
      assetsInlineLimit: 2048,
      chunkSizeWarningLimit: 1400,
      // Saves a request: the preload polyfill is not needed on modern WebViews.
      modulePreload: {polyfill: false},
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;

            // Normalise Windows separators so the rules behave the same on every OS.
            const normId = id.split(String.fromCharCode(92)).join('/');

            // Every Firebase package MUST stay in one chunk. Splitting firebase/app
            // away from firebase/firestore creates a circular import between the
            // chunks and the app dies at boot with
            //   "ReferenceError: Cannot access 'X' before initialization"
            // which shows up as a completely white screen.
            if (normId.includes('/node_modules/firebase/') || normId.includes('/node_modules/@firebase/')) {
              // Realtime Database and Storage are imported lazily (presence/typing and
              // media uploads), so they keep their own on-demand chunk and stay out
              // of the eager vendor bundle.
              if (normId.includes('/firebase/database/') || normId.includes('/@firebase/database/')) return 'firebase-rtdb';
              if (normId.includes('/firebase/storage/') || normId.includes('/@firebase/storage/')) return 'firebase-storage';
              return 'firebase-vendor';
            }

            if (normId.includes('/node_modules/react-dom/') || normId.includes('/node_modules/react/') || normId.includes('/node_modules/scheduler/') || normId.includes('/node_modules/use-sync-external-store/')) return 'react-vendor';
            if (normId.includes('/node_modules/motion/') || normId.includes('/node_modules/framer-motion/') || normId.includes('/node_modules/motion-dom/') || normId.includes('/node_modules/motion-utils/')) return 'motion-vendor';
            if (normId.includes('/node_modules/lucide-react/')) return 'icons-vendor';
            if (normId.includes('/node_modules/@capacitor/')) return 'capacitor-vendor';

            return undefined;
          },
          // Stable, readable names keep the long-term cache warm across builds.
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
