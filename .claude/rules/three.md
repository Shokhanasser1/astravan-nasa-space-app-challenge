---
paths:
  - 'src/scene/**'
  - 'public/models/**'
  - 'public/textures/**'
---

# Scene: first-person 3D on a phone (three 0.187 + React Three Fiber 9 + drei 10)

Sources: final version, Dizayn 2.0 §03–04, developer guide §03–06, concept 3.0 §03 (light recipe),
ui-ux-pro-max three.js guidelines (MIT). Positions: `docs/layout.md`.

## Contract
- The scene renders a `View` and calls `onTap(machine)`. It never imports the engine, never computes a game number,
  never decides a rule. Camera point, look angles and animation timers are scene-local state (refs), not game state.
- One `<Canvas>` for the whole game (`Stage.tsx`), never remounted; swap content inside it.

## First-person rig (Dizayn 2.0)
- Eye height 1.7 m. Standing points: 1 airlock, 2 power hub (main place: batteries, sockets, confirm lever,
  all buildings visible behind), 3 garden window, 4 workshop, 5 hill (craters, Earth, Scout leaves, Ice card),
  6 ladder (Day 7 launch), plus inside the habitat (morning, night log, shelter).
- Default point by phase: morning → inside then airlock; plan → hub; card → the event's place (camera turns there
  by itself); night → inside; launch → ladder; truth → orbit pull-back.
- Look = one-finger drag (yaw free, pitch clamped ±35°); move = tap a glowing marker, camera **floats ~1 s**
  (damped, ease in/out) — never teleports; act = tap the object. One big button at the bottom.
- Motion-sickness rules: no head bob, no roll, horizon always level, yaw ≤ 60°/s, no camera shake (not even on the
  flare — use light instead), FOV 60–70°. Respect `prefers-reduced-motion` (shorter, slower moves).
- `touch-action: none` on the canvas root; pointer events via R3F; tap = pointerdown→pointerup moved < 10 px.
- Fallback (if first person is late): the same scene, camera rises to the developer-guide overview. Same View.

## Light (concept 3.0 recipe — 80 % of the look)
- One directional Sun at **1.5°** elevation, azimuth from `sky.json` (~12°/day); colour #fff1dc, intensity ~6;
  hemisphere ≤ 0.06 (earthshine); background #020308; ACES tone mapping; sRGB output.
- Shadows: only the Sun; only big bodies cast; map 1024 phone / 2048 pc; shadow camera ±150 m (shadows are
  ~38× longer than objects); **recompute once per day** (`shadowMap.autoUpdate = false`, `needsUpdate = true`).
- Greyscale test: a screenshot shows three tones only (black sky/shadows, grey ground, white Sun/edges).
- Glowing parts (windows #FFD98A 3.2, lit cables #F0B43C 2.2) are separate meshes with `toneMapped={false}`; only
  they pass Bloom (threshold 1, mipmapBlur). Effects: Bloom (+ Vignette on pc). Nothing else on phones.

## Invisible storm, Earth, dust
- Storm = sound + camera snow + eye sparks, driven by `view.ratio` (measured); densities are game rules.
  Sparks only inside, only on storm days, ≤ 3 flashes per second (seizure safety). Lighter at ★.
- Earth: sphere sized to 1.9° of view, texture `public/data/media/<week>/earth-<date>.webp`, lit by the same Sun so
  the phase is automatically right; one rotation per day pass. Below the ridge in 3 weeks: do not draw it.
- Dust arcs: `Points`, ballistic, g = 1.62 m/s², no drag, start speed 1–3 m/s, angle 30–60°.

## Performance (measure on a mid Android, an iPhone and the pitch laptop)
- Phone: < 100k triangles, **~50 draw calls**, DPR 1–1.5, models < 5 MB total. PC: < 500k, ~100, DPR ≤ 2.
  Post effects cost draw calls too (the Bloom mip chain ≈ 10+): count them. `./shot.sh` and `?perf` print the truth.
- Never allocate in `useFrame` (no `new Vector3`, arrays, closures); mutate refs. No React `setState` per frame.
- Repeats (rocks, batteries, plants, hub lights) → drei `<Instances>`; one mesh + one material per building where
  possible; share geometries/materials; textures ≤ 2048 (power of two), WebP/KTX2.
- `frameloop="demand"` when calm (Stage switches it); `invalidate()` after scene-local animations.
- Quality tiers (`quality.ts`) step down automatically: DPR → 1, Bloom off, shadow 1024, then no shadows.
- Models: GLB via `npm run glb` (meshopt + WebP 1024) or `npm run gltfjsx -- x.glb --types`; Draco decoder only from
  `/draco/`. Load in `<Suspense fallback={<GreyProxy/>}>`, scale with `fit(object, height)`, base on the ground.
  All six buildings are models, or all six are grey shapes — never mix styles (decided at G3).
- Dispose what you create by hand; R3F disposes what it created. No GSAP (licence).
