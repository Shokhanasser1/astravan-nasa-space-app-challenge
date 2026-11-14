# Performance: instant start, 60 fps on a mid phone

## Budgets

| What | Target | Check |
|---|---|---|
| First load | ≤ 4 MB transferred (three.js chunk ~310 KB gzip); interactive ≤ 3 s on 4G | DevTools Network, Fast 4G |
| Repeat load | < 1 s, offline | PWA precache: reload in airplane mode |
| Frame rate | 60 fps mid phone; never below 30 on a cheap one | `?perf` overlay (r3f-perf), Chrome 4× CPU throttle |
| Scene | ≤ 100k triangles in view, ≤ 100 draw calls, textures ≤ 2048 px | `?perf` overlay |
| Input | Tap reacts on pointerdown; drag follows the finger | Real phone |

Concept 3.0 measured Design 2.0's scene at 280k triangles, three times the phone limit: optimize models with
`npm run glb` and measure on a phone before adding more (gate G1 rule: measure first, then add).

## Already in place

- Vite splits three.js/R3F into its own chunk (`bundle/three-*.js`), cached for a year by Caddy; game code updates
  do not re-download it. Entry files are `no-cache`, so a deploy reaches players at once.
- PWA precache: everything after the first visit loads from the device.
- Quality tiers (`src/scene/quality.ts`): DPR cap 1.5/1.25/1, shadow map 2048/1024/512, bloom on/off, dust count.
  drei `PerformanceMonitor` steps down when FPS drops; `AdaptiveDpr` lowers resolution while it struggles.
- Shadows recomputed once per day; bloom at half resolution, threshold 0.9; stars static (no twinkle, no air).
- Sounds generated in code (dosimeter, Quindar): zero bytes. Data and images bundled: no network during play.
- Zustand: 3D reads per-frame values with `getState()` in `useFrame`, so React does not re-render every frame.

## Rules for the team

- Models: GLB + meshopt + WebP/KTX2 (`npm run glb`). One material per model where possible; merge static meshes.
- Repeated objects (rocks, panels): instancing. Particles: one `Points` object, in-place updates.
- Textures: power-of-two, ≤ 2048, WebP/KTX2; the GIBS Earth at 2048×1024 is the largest allowed.
- Audio: OGG + M4A, mono, 96 kbps for voice; breath loop ≤ 6 s.
- Lazy-load heavy scenes (truth sequence, moonwalk map) with `React.lazy`; preload during the previous day.
- No allocation in `useFrame`; no `setState` per frame; memoize expensive components.
- Test on the slowest phone in the team before calling anything fast.
