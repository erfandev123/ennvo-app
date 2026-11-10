import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

// Split the bundle so a returning user only downloads what actually changed.
// Everything below is cached forever by the browser / service worker.
const chunkGroups: Array<[string, RegExp]> = [
  ['react-vendor', /[\\/]node_modules[\\/](react|react-dom|scheduler|use-sync-external-store)[\\/]/],
  ['firebase-auth', /[\\/]node_modules[\\/]@firebase[\\/]auth[\\/]/],
  ['firebase-firestore', /[\\/]node_modules[\\/]@firebase[\\/](firestore|firestore-compat|webchannel)[\\/]/],
  ['firebase-database', /[\\/]node_modules[\\/]@firebase[\\/]database[\\/]/],
  ['firebase-storage', /[\\/]node_modules[\\/]@firebase[\\/]storage[\\/]/],
  ['firebase-vendor', /[\\/]node_modules[\\/](firebase|@firebase)[\\/]/],
  ['motion-vendor', /[\\/]node_modules[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/],
  ['icons-vendor', /[\\/]node_modules[\\/]lucide-react[\\/]/],
  ['capacitor-vendor', /[\\/]node_modules[\\/]@capacitor[\\/]/],
];

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const isProd = mode === 'production';

  return {
    plugins: [react(), tailwindcss()],
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
            for (const [name, test] of chunkGroups) {
              if (test.test(id)) return name;
            }
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
