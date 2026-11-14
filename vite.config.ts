/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative base: the same build works on the VPS (/), GitHub Pages (/<repo>/) and Cloudflare Pages.
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'HOME BY SEVEN',
        short_name: 'Home by Seven',
        display: 'fullscreen',
        orientation: 'any',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,webp,jpg,ktx2,glb,json,ogg,m4a}'],
        // Draco decoder only matters for Draco models (prefer meshopt); it loads on demand instead of on first visit.
        globIgnores: ['draco/**'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api\//, /^\/_\//],
      },
    }),
  ],
  server: {
    // `npm run db` runs PocketBase locally. The dev server is open to the LAN (--host), so only the two
    // create routes the game needs are proxied; the admin UI stays on http://127.0.0.1:8090/_/.
    proxy: {
      '/api/collections/playtests/records': 'http://127.0.0.1:8090',
      '/api/collections/runs/records': 'http://127.0.0.1:8090',
    },
  },
  build: {
    target: 'es2022',
    assetsDir: 'bundle', // hashed files → cached forever by Caddy
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        // three.js + R3F in their own long-cached chunk; game code changes do not invalidate it.
        advancedChunks: {
          groups: [{ name: 'three', test: /node_modules[\\/](three|@react-three|postprocessing)/ }],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
