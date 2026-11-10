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

            // Every Firebase package MUST stay in one chunk. Splitting firebase/app
            // away from firebase/firestore creates a circular import between the
            // chunks and the app dies at boot with
            //   "ReferenceError: Cannot access 'X' before initialization"
            // which shows up as a completely white screen.
            if (/[\\/]node_modules[\\/](firebase|@firebase)[\\/]/.test(id)) return 'firebase-vendor';

            if (/[\\/]node_modules[\\/](react|react-dom|scheduler|use-sync-external-store)[\\/]/.test(id)) return 'react-vendor';
            if (/[\\/]node_modules[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'motion-vendor';
            if (/[\\/]node_modules[\\/]lucide-react[\\/]/.test(id)) return 'icons-vendor';
            if (/[\\/]node_modules[\\/]@capacitor[\\/]/.test(id)) return 'capacitor-vendor';

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
