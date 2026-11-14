---
paths:
  - 'src/scene/**'
  - 'public/models/**'
  - 'public/textures/**'
  - 'docs/layout.md'
  - 'docs/PERFORMANCE.md'
---

# Scene: first-person 3D on a phone (three 0.187 + React Three Fiber 9 + drei 10)

Sources: final version, Dizayn 2.0 §03–04, developer guide §03–06, concept 3.0 §03 (light recipe),
ui-ux-pro-max three.js guidelines (MIT). Positions: `docs/layout.md`.

## Contract
- The scene renders a `View` and calls `onTap(machine)`. It never imports the engine, never computes a game number,
  never decides a rule. Camera point, look angles and animation timers are scene-local state (refs), not game state.
- One `<Canvas>` for the whole game (`Stage.tsx`), never remounted; swap content inside it.

## Character and physics (team extension, 14 Nov evening)
- New work, allowed: a playable astronaut, walking, collisions, physics. It goes behind `features.character`; the
  first-person rig below stays the playable fallback until the character build plays a whole week on a phone.
- Physics: Rapier through `@react-three/rapier` is the R3F standard (new dependency → ask Shoxjahon aka). It ships
  WebAssembly: load it lazily so the first frame never waits for it.
- Colliders are primitives (capsule for the astronaut, boxes and cylinders for buildings, a plane or heightfield for
  the ground), never the render mesh. Static base, fixed time step, let bodies sleep.
- Moon gravity 1.62 m/s² is one constant in one place. Gauges (air, dose) never change in physics code: the engine
  owns them; the scene reports what happened (walked outside, jumped) through an action.
- Astronaut: one skinned GLB with its clips (idle, walk, run, jump) via drei `useAnimations`, inside `<Suspense>`
  with a grey capsule fallback. Controls: touch joystick on phones, WASD/arrows on laptops; the camera follows with
  damping. The motion-sickness rules below still apply (no shake, no roll, level horizon).
- Same phone budget: < 100k triangles, ~50 draw calls. Measure with `?perf` on a real phone after each step.

## First-person rig (Dizayn 2.0) — current G2 build
- Eye height 1.7 m. Standing points: 1 airlock, 2 power hub (main place: batteries, sockets, confirm lever,
  all buildings visible behind), 3 garden window, 4 workshop, 5 hill (craters, Earth, Scout leaves, Ice card),
  6 ladder (Day 7 launch), plus inside the habitat (morning, night log, shelter).
- Default point by phase: morning → inside then airlock; plan → hub; card → the event's place (camera turns there
  by itself); night → inside; launch → ladder; truth → orbit pull-back.
- Look = one-finger drag (yaw free, pitch clamped ±35°); move = tap a glowing marker, camera **floats ~1 s**
  (damped, ease in/out) — never teleports; act = tap the object. One big button at the bottom.
- Motion-sickness rules: no head bob, no roll, horizon always level, yaw ≤ 60°/s, no camera shake (not even on the
  flare — use light instead), FOV 60–70°. `prefers-reduced-motion`: moves float 1.4 s instead of 1 s, turn speed ≤ 40°/s, no vertical
  ride, sparks replaced by a soft glow.
- `touch-action: none` on the canvas root; pointer events via R3F. Tap = press feedback (ring brightens) on
  pointerdown, the action on pointerup if the finger moved < 10 px; a longer move is a look-drag, not a tap.
- Fallback (if first person is late): the same scene, camera rises to the developer-guide overview. Same View.

## Light (concept 3.0 recipe — 80 % of the look)
- **Superseded 15 Nov ~04:00 (Shoxjahon aka: the whole game in ASTRA's look, the best of ASTRA + ours):** the light
  is ASTRA's Moon recipe in `src/scene/Light.tsx` — Sun 12° (a game rule; `?sunel=1.5` shows the real pole),
  #fff4e2 × 3, sky hemisphere #b9c6ff/#2a2a30 × 0.4, cool fill × 0.25, a code-made environment × 0.42, ACES exposure
  1.32 — and the base models are ASTRA's (`src/scene/AstraBase.tsx`, baked by `src/scene/astra/bake.ts`; `?lite` =
  the old shapes). The concept recipe below is kept for `?sunel=1.5` and the record.
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
- Phone: < 100k triangles, **~50 draw calls**, DPR 1–1.5, every model ≤ 1 MB and all models together < 5 MB.
  PC: < 500k, ~100, DPR ≤ 2. Post effects cost draw calls too (the Bloom mip chain ≈ 10+): count them.
- Evidence: `./shot.sh` gives triangles and draw calls (SwiftShader, 390×844 and 1280×760 — trust the counts,
  not its FPS). FPS only from `?perf` on a real mid Android, an iPhone and the pitch laptop, 30 s of a storm day.
- Never allocate in `useFrame` (no `new Vector3`, arrays, closures); mutate refs. No React `setState` per frame.
- Repeats (rocks, batteries, plants, hub lights) → drei `<Instances>`; one mesh + one material per building where
  possible; share geometries/materials; textures ≤ 2048 (power of two), WebP/KTX2.
- `frameloop="demand"` when calm (Stage switches it). In demand mode nothing moves unless asked: a scene-local
  animation (camera float, look-drag damping, wall rising) calls `invalidate()` **every frame while it runs**, from
  its `useFrame`, until it settles (see `Rig.tsx`).
- Quality tiers (`quality.ts`) step down automatically: DPR → 1, Bloom off, shadow 1024, then no shadows.
- Models: GLB via `npm run glb` (meshopt + WebP 1024; the meshopt decoder is bundled, so it works offline), then
  `npm run gltfjsx -- x.glb --types`. Avoid Draco (`gltfjsx --transform`): its decoder is served from `/draco/` but
  not precached, so it fails offline. Load in `<Suspense>` with a grey-shape fallback and scale the model to its
  real height, base on the ground — the fallback component and a `fit(object, height)` helper do not exist yet;
  create them in `src/scene/` with the first model.
  All six buildings are models, or all six are grey shapes — never mix styles (decided at G3).
- Dispose what you create by hand; R3F disposes what it created. No GSAP (licence).
