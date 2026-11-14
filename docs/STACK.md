# Stack

Chosen for: fast first load on school Wi-Fi, 60 fps on a cheap phone, five people working in parallel with AI tools,
and nothing exotic to debug at 3 a.m. Versions are pinned exactly in `package.json` (checked 2026-11-14).

## Client

| Layer | Choice | Version | Why |
|---|---|---|---|
| Language | TypeScript | 7.0.2 | Shared engine/screen contract checked at build; `tsc` is the native compiler (fast). Vite strips types, so a type error never blocks `npm run dev` |
| Build | Vite | 8.3.8 | Instant dev server, LAN preview on phones (`--host`), Rolldown builds |
| UI | React + React DOM | 19.3.1 | Screens, cards, boards, three languages. Every AI tool writes it fluently |
| 3D | three | 0.187.0 | The concept's light recipe is written for three.js |
| 3D in React | @react-three/fiber | 9.8.2 | three.js scene as components that read the same store as the HUD; same renderer, no wrapper cost per frame |
| 3D helpers | @react-three/drei | 10.7.9 | `useGLTF`, `Stars`, `PerformanceMonitor`, `AdaptiveDpr`, `Preload`, `Html` |
| Post effects | @react-three/postprocessing + postprocessing | 3.2.2 / 6.39.6 | Bloom on Sun, lamps and visor edge only, half resolution, threshold 0.9 |
| State | Zustand | 5.1.0 | One store for engine state, flow and settings; 3D reads it per frame without re-rendering React |
| Styling | Tailwind CSS (+ @tailwindcss/vite) | 4.3.5 | Fast layout for overlays; design tokens from Asilbek's kit go into `src/index.css` `@theme` |
| Audio | Web Audio API (no library) | browser | Dosimeter, Quindar tones, fan noise generated in code: zero bytes to download |
| Speech | `speechSynthesis` (en, ru) + recorded Uzbek lines | browser | Uzbek voices are missing on most devices; the team records ~40 lines |
| Offline | vite-plugin-pwa (Workbox) | 2.0.0 | Precache everything: second start is instant and works without network |
| Fonts | Asilbek's choice, self-hosted (`@fontsource/*`) | — | Must contain ʻ (U+02BB) and Cyrillic; check `Oʻzbekiston` before choosing |

## Tools

| Tool | Version | Use |
|---|---|---|
| Vitest | 5.1.0 | Engine golden tests (Plans A/B/C), data validation, audio/label helpers |
| Playwright Test | 1.65.1 | `npm run e2e`: phone-viewport smoke (start → finish a week); also records the demo video (ECC `ui-demo` skill) |
| r3f-perf | 7.2.3 | FPS, draw calls, triangles overlay in dev (`?perf`) |
| leva | 0.10.1 | Live sliders for light/shadow/bloom values in dev (`?tune`) — copy final values into code |
| gltf-transform CLI | 4.5.1 | `npm run glb -- in.glb out.glb --texture-compress webp`: meshopt geometry + compressed textures |
| PocketBase | 0.40.6 | `npm run db`: local copy of the server database |

## Server

| What | Version | Role |
|---|---|---|
| Caddy | 2 (alpine image) | HTTPS (Let's Encrypt), HTTP/2 + HTTP/3, zstd/gzip, cache headers, proxy to PocketBase |
| PocketBase | 0.40.6 | API + SQLite for anonymous playtests and run summaries; admin UI for the team |
| Docker Compose | — | One `docker compose up -d` on the VPS |
| GitHub Actions | — | `npm run verify` on every push; deploy to VPS (atomic symlink) and GitHub Pages |

## Data pipeline (build time only)

Python 3 (or Node) scripts in `scripts/data/`: DONKI + RadLab → `weeks.json` (key from a local `.env`, never committed);
PyEphem → `sky.json` (checked against JPL Horizons); SDO browse + GIBS WMS → `public/data/media/<week>/`.

## Deliberately not used

| Not | Why |
|---|---|
| Phaser, PixiJS | The game is 3D + DOM UI now |
| Next.js / SSR | A static game; SSR adds nothing and slows builds |
| Redux, MobX | Zustand covers one store with less code |
| GSAP | Own licence, not OSI; tweens via R3F `useFrame`, drei, CSS transitions |
| Howler | Web Audio covers the needs; one less dependency |
| Firebase, Supabase | Own VPS + PocketBase: no account limits, data stays with the team |
| Runtime NASA API calls | Key would leak, rate limits (429), CORS; all data is bundled |
| AI-generated images without a visible mark | Space Apps rule; NASA logos never |
| Typescript `strict` blocking dev | Type errors fail CI (`npm run verify`), not the dev server |
