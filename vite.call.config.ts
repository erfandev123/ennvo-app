import path from 'path';
import { defineConfig } from 'vite';

/**
 * Builds only the ultra-light call screen into dist/call.
 *
 * `base: './'` is required: CallActivity serves this bundle from
 * assets/public/call through a ServerPath, and Capacitor's WebViewLocalServer
 * prefixes every local request with that base path. Relative asset URLs keep
 * working while the document origin stays https://localhost, which shares the
 * Firebase Auth session with the main app.
 */
export default defineConfig({
  root: path.resolve(__dirname, 'call'),
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  esbuild: {
    legalComments: 'none',
    drop: ['debugger'],
  },
  build: {
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: false,
    reportCompressedSize: false,
    cssCodeSplit: false,
    assetsInlineLimit: 4096,
    modulePreload: { polyfill: false },
    outDir: path.resolve(__dirname, 'dist/call'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'call/index.html'),
    },
  },
});
