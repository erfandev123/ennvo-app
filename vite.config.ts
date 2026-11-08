import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      target: 'es2020',
      rollupOptions: {
        output: {
          // Keep rarely-changing vendors in separate, long-cached chunks so
          // repeat visits on slow networks only download what changed.
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-dom/client', 'scheduler'],
            'firebase-vendor': [
              'firebase/app',
              'firebase/auth',
              'firebase/firestore',
              'firebase/database',
              'firebase/storage',
              'firebase/messaging',
            ],
            'motion-vendor': ['motion/react'],
            'icons-vendor': ['lucide-react'],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
