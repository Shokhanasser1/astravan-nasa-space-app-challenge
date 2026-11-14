---
name: vite-patterns
description: Editing vite.config.ts or fixing build, bundle size, chunking, PWA precache/service worker, asset caching, relative base, env var or dev/preview server problems in HOME BY SEVEN. Not for general React or scene code.
---

# Vite in this repo (Vite 8, @vitejs/plugin-react 6)

Config: `vite.config.ts`. Versions are pinned in `package.json`; a dependency change needs its owner (Shoxjahon aka).
Client-only SPA: no SSR, no library mode.

## Plugins

- `@vitejs/plugin-react` (v6) is the React plugin. Keep it; do not switch to an SWC plugin.
- `@tailwindcss/vite` (Tailwind 4): tokens live in `src/index.css` `@theme`; there is no `tailwind.config.js`.
- `vite-plugin-pwa`, `registerType: 'autoUpdate'`. Workbox settings in the config:
  - `globPatterns` precache js, css, html, woff2, png, webp, jpg, ktx2, glb, json, ogg, m4a. An asset type the game
    needs offline must be in this glob.
  - `globIgnores: ['draco/**']`: the Draco decoder loads on demand (prefer meshopt models).
  - `maximumFileSizeToCacheInBytes: 8 * 1024 * 1024`: a bigger file is not precached. Shrink the asset
    (`npm run glb`) instead of raising the limit.
  - After a PWA change, check offline: build, preview, load once, go offline, reload.

## Base and output

- `base: './'` (relative): one build works at `/` (VPS), `/<repo>/` (GitHub Pages) and Cloudflare Pages.
  Do not hard-code absolute `/foo` URLs in code; they break under a sub-path.
- `build.assetsDir: 'bundle'`: hashed files are served from `bundle/`, which Caddy caches as immutable for a year;
  entry HTML is `no-cache`, so a deploy reaches players at once (`docs/PERFORMANCE.md`). Do not rename `assetsDir`
  without changing the Caddy rule.
- `build.target: 'es2022'`; `chunkSizeWarningLimit: 1500` (the `three` chunk is large by nature).

## Chunks (Rolldown)

The config uses `build.rolldownOptions` (not `rollupOptions`) with `output.advancedChunks.groups` to put `three`,
`@react-three/*` and `postprocessing` in one `three` chunk, so game-code changes do not invalidate it. When adding a
heavy library, read the build output sizes, then extend that group or load it with `React.lazy` / dynamic `import()`.

## Dev and preview

- `npm run dev` = `vite --host` (default port 5173): open the LAN URL on a phone. `predev` copies the decoders.
- Dev proxy forwards only two PocketBase create routes to `127.0.0.1:8090`. Do not widen it: the dev server is open
  to the LAN.
- `npm run preview` = `vite preview --host`. E2E runs `vite preview --port 4173 --strictPort` after `npm run build`
  (started by `playwright.config.ts`), so e2e tests the production build, not the dev server.
- `import.meta.glob` is used in `src/i18n/t.ts` (`./*/*.json`, eager). A new i18n file must match that pattern.

## Env vars

- Only `VITE_`-prefixed variables reach client code (`import.meta.env.VITE_*`), e.g. `VITE_API_URL` in `src/net/api.ts`.
- Everything in the client bundle is public. Never put a key or token in a `VITE_` variable. The NASA key lives only
  in `scripts/data/.env` (git-ignored) and is read by Node scripts, never by the browser build.
- Data is bundled; no NASA call at run time.

## When the build breaks

1. `npm run build`, read the first error. Type errors come from `npm run typecheck`, not Vite.
2. Stale service worker or cache in the browser: hard reload or clear site data before blaming the build.
3. `npm run verify` before every push; CI deploys each green push.
