# NASA-based building models (behind `features.nasaModels`)

Date: 14 Nov 2026 · Models: Samandar (team) in Blender, scripts by Claude Code · Scene wiring: Claude Code ·
Scene files touched: tell Shoxjahon aka · G3 decides: all six models or all six grey shapes.

## Goal

The six base buildings can be shown as models made from NASA 3D Resources (HDU, Apollo LM, SEV, DSN 34 m) instead of
the grey code shapes, in one style and the team palette, inside the phone budget. Nothing else in the game changes:
the models are only the static shells; everything that moves or glows by game state stays in code.

## How to try it

- `?models` in the address turns it on for one visit (any build, also the live link): `npm run dev`, then
  `http://<LAN address>:5173/?models` on a phone and on a laptop. Add `&perf` for FPS, draw calls and triangles.
- `features.nasaModels = true` (`src/config/features.ts`) turns it on for everyone.
- Draw calls and triangles: `SHOT_PARAMS=models ./shot.sh` (the same screenshots and counts as `./shot.sh`).
- Off (the default): the grey shapes, exactly as before; no model file is requested.
- Not checked in a browser yet: the sandbox that built this has no port binding and no browser, so `npm run dev`
  and `./shot.sh` could not run. The visual check below was a Blender render of the same files and positions.

## Files

| File | What |
|---|---|
| `public/models/nasa-base/{hab,garden,workshop,lander,scout,dish}.glb` + `credit.txt` | The six buildings (meshopt, no Draco, no textures) |
| `public/models/nasa-lro/lro.glb` + `credit.txt` | LRO for the truth screen (shipped, not wired yet) |
| `public/models/astronaut/astronaut.glb` + `credit.txt` | Rigged astronaut, clips Idle/Walk/Run/Jump/Carry/Pour (shipped, not wired yet) |
| `src/scene/fit.ts` | `fit(object, height)`: uniform scale to the real height, lowest point on the ground, X/Z kept |
| `src/scene/models/enabled.ts` | The switch: flag or `?models` |
| `src/scene/models/kit.ts` | Pure three.js: the six files, required and animated node names, real heights, footprints, palette → shared materials, merge per material, shadows, `lift` / `yaw` / `spin` |
| `src/scene/models/Shell.tsx` | `<Shell name grey … />`: grey shapes, or the model in `<Suspense>` with the grey shapes as fallback |
| `src/scene/parts/{Habitat,Garden,Workshop,Scout,Lander,Dish}.tsx` | The static meshes moved into `<Shell grey={…}>`; Lander, Dish and Workshop animate named nodes; the Scout mast moved out of the shell (it carries the eye in both looks) |
| `src/scene/fit.test.ts`, `src/scene/models/kit.test.ts` | Unit tests: fit, material mapping, double-sided twins, glow hidden, merge per material (faces stay outward), shadows, all-six-or-none, motion helpers |
| `scripts/shot.mjs` | `SHOT_PARAMS=models ./shot.sh` adds address parameters (one line) |
| `scripts/models.test.ts` | Loads every GLB with three's `GLTFLoader` + `MeshoptDecoder` (node): node names, pivots (empty nodes, wheel pivot at the axle, dish yaw axis), faces outward, ≤ 1 MB each, < 5 MB total, no Draco, meshopt, triangles, draw calls, height, footprint, astronaut skin and clips |

`Rig.tsx` and `Stage.tsx` are not touched.

## How it works

- **All six or none.** All parts ask for the same six files in one `useGLTF([...six])` call (one cache entry). Until it
  resolves, each part shows its grey shapes (the Suspense fallback). If any file is missing or broken, or a model
  lacks a named part it needs (`kitProblems`), every part keeps its grey shapes (an error boundary per part).
- **Meshopt, not Draco.** drei's loader decodes meshopt with the decoder bundled in the JS (works offline); Draco is
  switched off for these calls. `scripts/models.test.ts` fails on `KHR_draco_mesh_compression`.
- **One material set.** GLB material names `panel`, `gold`, `glass`, `dome`, `window_glow`, `cable_glow` (Blender
  `.001` suffixes allowed) are replaced by the shared materials in `parts/materials.ts`: no new shader programs, glow
  stays `toneMapped: false` (only glow passes Bloom). The model's own `glow_*` meshes are hidden: the code windows
  and lamps (already placed for each turn, switched by batteries) are the glow in both looks. Unknown material names
  keep their own material and are listed in a dev console warning.
- **Sidedness.** The lander, Scout and dish keep a few small inside-out fragments from the NASA meshes (leg struts,
  window recesses, back truss), so they use double-sided twins of panel/gold/glass (`TWINS` in `kit.ts`, made once
  at module level: 3 extra shader programs, compiled when the models arrive). The habitat, garden and workshop are
  clean and stay single-sided, so from inside the habitat you still see out through its shell.
- **Fewer draw calls.** At load, `prepare()` merges every mesh that does not move into one mesh per palette material
  (moving nodes, `ANIMATED` in `kit.ts`, are merged on their own); the merged geometry is disposed on unmount.
- **Shadows.** Only meshes with a bounding sphere ≥ 0.5 m cast and receive (not glow, not the garden dome). When the
  models arrive, the shadow map is recomputed once (it is otherwise recomputed once per day).
- **Size and place.** Every model is built in metres to the grey shape: base on the ground, front +Z, footprint within
  the layout radius + 0.1 m. `fit()` scales to `HEIGHT` (the measured model heights), so a re-export in other units
  still lands right. The part turns the model's front to where the grey front was (habitat: the door to the hub,
  `DOOR_AZ`; workshop −90°; Scout 180°, facing the base).
- **Motion, allocation-free, respecting `frameloop="demand"`.**
  - Lander (Day 7): with the model, only `lander_body` (ascent stage) lifts off by the existing launch curve;
    `lander_base` and the engine lamp stay; the existing code asks for frames while it is low.
  - Dish: `dish_head` sweeps ±29° slowly, only while the scene clock runs (day, storm, launch); it never asks for
    frames, so a calm scene stays still.
  - Workshop: the robot `arm` yaws ±26° about its shoulder while the workshop has batteries and the scene clock
    runs (the modeller's limit: within ±30°, or it cuts through the bench); never asks for frames.
  - Scout wheels are named and pivoted at the axle centres, but nothing in the game drives the Scout yet (no
    drive animation exists); `spin()` is ready, add the wheels to `ANIMATED` in `kit.ts` when one does.

## What stays in code (both looks)

Habitat windows, interior, door marker and wall rings · garden plants, fruit and grow ring · workshop roof lamp ·
Scout mast and eye (the model has no mast) · lander engine lamp and dust ring · hub, batteries, cables, solar wing,
target rings, terrain · every tap handler (taps on the model hit the same group).

## Budget (measured)

| Building | Triangles, grey → model | Draw calls in the game, grey → model | GLB |
|---|---|---|---|
| hab | 802 → 2,266 | 4 → 3 | 22 KB |
| garden | 680 → 4,154 | 2 → 4 | 28 KB |
| workshop | 26 → 2,402 | 3 → 5 | 25 KB |
| lander | 310 → 12,946 | 6 → 6 | 128 KB |
| scout | 236 → 9,159 | 2 → 3 | 103 KB |
| dish | 40 → 14,282 | 2 → 4 | 196 KB |
| **six buildings** | **2,094 → 45,209** | **19 → 25** | **502 KB** |
| lro (not in the scene yet) | 7,711 | 6 | 238 KB |
| astronaut (not in the scene yet) | 6,277 | 2 | 184 KB |

All model files together: 0.90 MB (924 KB). Counted by `scripts/models.test.ts` (it prints them) and a three.js count of the
grey shapes. Draw calls "in the game" = after `prepare()` merges the meshes that do not move, per material, and
hides the model glow meshes. Estimated whole scene on a phone with `?models`: ~80k triangles and ~53 draw calls
(grey: 37k and 47, measured 14 Nov) — an estimate from these counts, not a browser measurement.

Phone budget: < 100k triangles and ~50 draw calls for the whole scene (37k triangles and 47 calls with the grey
shapes on 14 Nov). Each GLB ≤ 1 MB, all models < 5 MB (`npm run check`, `scripts/models.test.ts`).
The PWA precache downloads `public/models/**` after the first visit even with the flag off (background, once);
add `models/**` to `globIgnores` in `vite.config.ts` if G3 keeps the grey shapes. Code cost: +8 KB JS (+2.9 KB gzip)
in the game chunk; the meshopt decoder was already in the bundle (drei).

## Visual check done

A Blender script (kept with the Blender sources, outside this repo) renders the six GLBs at their layout positions and turns,
with the code-side lamps, plants, rings, mast and eye as simple shapes, palette materials with back faces hidden
(like three.js `FrontSide`), Sun 15° (the game's 1.5° is too dark for a preview). Seen: the habitat door faces the
hub, the code windows sit in the model's window frames, the garden bed is at the plants' base (0.25 m), the lander
engine lamp shows under the descent stage, the Scout eye sits on its mast. Faces point outwards: rays from 8 sides
hit a back face (a hole when drawn single-sided) at most 3 % of the time (Scout window recesses), 0 % for the
habitat, garden and workshop; `scripts/models.test.ts` fails above 5 %.

## Not done

- Not seen in a browser or on a phone (see "How to try it"); draw calls and FPS with `?perf` are still to measure;
  `npm run e2e` was not run here (it needs a browser; with the flag off nothing it covers changed).
- LRO and astronaut GLBs are shipped and checked, not wired (truth screen and `features.character` are other tasks).
- No Scout drive (no such animation exists in the game yet); the wheels are ready for one.
- From inside the habitat, the model's door frame shows in the window gap (the grey shell had none).
- The grey dish was a wire outline ("module not built"); the model shows a built antenna — the team decides.
- For free walk (`asilbek/work`): the dish reflector reaches 1.17 m from its mast, past the 1.0 m walk hitbox there;
  the other five stay inside their layout radius + 0.1 m (checked by `scripts/models.test.ts`).
