---
name: react-performance
description: Performance work in the HOME BY SEVEN React 19 + React Three Fiber client app: low FPS, too many re-renders, janky HUD, slow first load, lazy-loading heavy screens, frameloop/invalidate tuning. Use when measuring or fixing performance, not for ordinary React edits.
---

# React and R3F performance (client SPA)

Client-only SPA: React 19, Vite, one R3F `<Canvas>`. No SSR, no server components, no data-fetching library
(data is bundled JSON). Advice written for server frameworks does not apply here.

GPU budgets (triangles, draw calls, DPR, shadows, instancing, disposal) live in `.claude/rules/three.md` and
`docs/PERFORMANCE.md`. Read them; do not restate or change numbers here.

## Order of work

1. Measure first (below). Name the bottleneck: CPU in React, CPU in `useFrame`, or GPU (draw calls, fill rate).
2. Fix the biggest one only. Re-measure on the same device.
3. No `memo`, `useMemo` or `useCallback` without a measured reason (the Profiler shows a wasted render that costs time).

## Measure

- `?perf` URL param: r3f-perf overlay (FPS, calls, triangles). It is lazy-loaded, so it costs nothing otherwise.
- `./shot.sh '<view json>'`: builds, screenshots, prints draw calls and triangles for a scene state.
  Run it before and after any scene change.
- React DevTools Profiler (record one game day): look for components that render on every tick or every drag.
- Chrome DevTools Performance with 4x CPU throttle approximates a mid Android. The final check is a real phone on the
  LAN (`npm run dev` already uses `--host`).

## Rules of thumb

- Per-frame work lives in refs and `useFrame`. Never `setState` per frame, never allocate in `useFrame`.
  If a value must reach the DOM every frame (a 3D label position), write it to the element style from a ref.
- The game/scene boundary is the `View` object: the scene receives `View`, the UI reads `model`/`view`.
  Update React state only when `View` changes (a game event), not on camera or animation ticks.
  Camera point, look angles and animation timers stay scene-local refs.
- Pass primitives or stable references to children so unrelated HUD parts do not re-render. Keep visor components
  small (gauges, radio line, tablet) so one gauge change re-renders one gauge.
- Lists (batteries, log lines, machines): stable `key`; avoid fresh inline object/array props on children that are
  memoized for a measured reason.
- `frameloop`: `Stage.tsx` uses `always` while something animates and `demand` when calm. After any scene change that
  happens outside a React render (ref mutation, timer, loader callback), call `invalidate()`, otherwise the screen
  does not update in demand mode.
- Heavy or rare screens (truth sequence, moonwalk map, debug tools) load with `React.lazy` + `<Suspense>`, as
  `Stage.tsx` does for `r3f-perf`. Start the dynamic `import()` early (previous day) so the switch is instant. Do not
  lazy-load anything needed on the first frame.
- 3D assets load inside `<Suspense>` with a grey-shape fallback (see `.claude/rules/three.md`); one slow model must
  not block the app.
- Derive values in render (or `useMemo` if measured), not in `useEffect` plus `setState`.
- Effect cleanup: remove listeners, cancel timers, dispose hand-made geometries, materials and textures.
- Bundle: three.js and R3F already sit in a separate `three` chunk (see `vite-patterns`). Do not import a whole library
  for one function. A new dependency needs approval from the `package.json` owner (Shoxjahon aka).
- No GSAP or other animation library: CSS transitions for UI, refs and damping in `useFrame` for the scene.

## Before saying "faster"

- Same device, same `View`, numbers before and after (FPS or calls from `?perf` / `./shot.sh`, or Profiler time).
- `npm run verify` is green.
- Quality tiers (`src/scene/quality.ts`) still step down; never bypass them to hit a number.
