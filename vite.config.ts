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
        // The page itself (index.html) is NOT precached (15 Nov: "some see junk on the link"): a precached page kept
        // returning visitors on an old build. It is fetched from the network first (runtimeCaching below), so a new
        // build shows at once; the cached copy only answers offline. Hashed files stay precached.
        globPatterns: ['**/*.{js,css,woff2,png,webp,jpg,ktx2,glb,json,ogg,m4a}'],
        navigateFallback: null,
        // Draco decoder only matters for Draco models (prefer meshopt); it loads on demand instead of on first visit.
        // Real media of the 14 weeks (~12 MB, public/data/media/) are not precached: a player sees one week, so its
        // pictures are cached the first time they are shown (runtimeCaching below) and work offline after that.
        // (Also left out: MediaPipe's JS, needed only when a child turns the camera on for the arm or ?hands, and the
        // LRO model, which no screen loads at the moment.)
        globIgnores: ['draco/**', 'mediapipe/**', 'data/media/**', 'hf/**', 'bundle/vision_bundle-*.js', 'models/nasa-lro/**'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'pages', networkTimeoutSeconds: 4, expiration: { maxEntries: 4 } },
          },
          {
            // AI graphics pack (public/hf/): a phone loads only its own sizes, so they are cached when first used
            urlPattern: ({ url }) => url.pathname.includes('/hf/'),
            handler: 'CacheFirst',
            options: { cacheName: 'hf-pack', expiration: { maxEntries: 30 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes('/data/media/'),
            handler: 'CacheFirst',
            options: { cacheName: 'week-media', expiration: { maxEntries: 60 } },
          },
          // Music and recorded voices (mp3, ~3.5 MB, not in globPatterns): cached the first time each plays, so they
          // work offline after that (venue Wi-Fi) without making the first visit heavier. fetch() + decodeAudioData,
          // no Range requests, so CacheFirst is enough (15 Nov perf).
          {
            urlPattern: ({ url }) => url.pathname.includes('/audio/') && url.pathname.endsWith('.mp3'),
            handler: 'CacheFirst',
            options: { cacheName: 'audio', expiration: { maxEntries: 200 } },
          },
        ],
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
