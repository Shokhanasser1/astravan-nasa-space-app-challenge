# HOME BY SEVEN — system architecture

> **14 Nov, evening:** the team extends the game into a full 3D game (character, movement, physics). The
> sections below describe the current playable build; the newest design notes win (`docs/STATUS.md`).

Base: the team's **final version** (*Yakuniy versiya*, 14 Nov — wins on conflicts), Dizayn 2.0 (first person,
visor UI), the developer guide and the work plan, and concept 3.0 (light, invisible storm, guesses, real Earth and Sun). This file adds the infrastructure
around it: tests and CI, offline play, quality tiers, checks, hosting. Stack and versions: `docs/STACK.md`.

## 1. The system in one picture

```
 BUILD TIME (lane Data, scripts)                  RUN TIME (phone or laptop browser; offline after the first visit)
 ─────────────────────────────                    ──────────────────────────────────────────────────────────────────
 DONKI + RadLab (LRO CRaTER) ─► weeks.json ─┐      ┌───────────────────────────── React page ─────────────────────────────┐
 PyEphem / JPL Horizons      ─► sky.json   ─┼────► │ engine/  rules.ts · weeks.json · sky.json   pure functions (lane A)   │
 SDO 131 Å, GIBS Earth       ─► public/data/media │ state/   game.ts: one reducer → View          (lane B)                 │
 AI models (Higgsfield), Kenney, NASA 3D ─► public/models │        │ dispatch                     │ view                         │
                                                   │        ▼                              ▼                              │
                                                   │ ui/  Hud, Labels, modals, Truth   scene/  one Canvas: base, light,     │
                                                   │      (DOM, lane D)                        storm, camera (lane C)       │
                                                   │      └── they never talk to each other; both read the same view ──┘   │
                                                   │ i18n/ en · uz · ru (lane F)   audio/ dosimeter, Quindar, voices         │
                                                   └──────────────────────────────────────────────────────────────────────┘
 HOSTING: static files. Main link = our VPS (Caddy: HTTPS, HTTP/3, compression, cache). Backup = GitHub Pages.
 Frozen copy for judges = Cloudflare Pages. No internet in the hall = `npm run build && npx vite preview` on a laptop.
```

**No server for the game.** Everything is static; `weeks.json` is imported directly. No NASA call at run time,
no account, nothing about children leaves the device (pitch answer 5). PocketBase stays in `server/` switched
off (`features.sendResults = false`) in case the team ever changes that answer.

## 2. Folders (developer guide §02)

```
src/
  engine/  rules.ts  weeks.json  sky.json  week.ts  plans.test.ts      lane A — engine session
  state/   game.ts (View, Model, Action, reducer, toView)              lane B — engine session
  scene/   Stage.tsx  BaseScene.tsx  Light.tsx  quality.ts             lane C — Shoxjahon aka
           Terrain + ground.ts (real LOLA ground)  Earth (Earth of the day)  Rig (6 points; third person outside)
           Astronaut  parts/{Habitat Garden Workshop Lander Scout SolarWing Hub Dish}  models/ (NASA-based GLBs)
  look/    terrain.js rocks.js textures.js fx.js noise.js — real ground, skyline, rocks, boot prints, dust (shared)
  character/ physics.js (Moon physics, sources inside)  anim.js (clips)  body.ts (walk, lope, jump)  telemetry.ts
  walk/    collide.ts world.ts (hitboxes)  input.ts (keys, stick, jump)  move.ts walker.ts
  hand/    gestures.ts tracker.ts — hand control experiment (?hands), MediaPipe on the device
  ui/      Hud.tsx; play/{Visor Tablet Holo TruthScreen Controls WalkStick HandControl}  lane D — Asilbek
  i18n/    <lang>/{ui,scene,story,engine,data}.json  t.ts   keys per lane; words by Aminjon
  audio/   audio.ts  dosimeter.ts      config/ features.ts   lib/ storage.ts labels.ts   net/ api.ts (off)
public/models/<pack>/  nasa-base/*.glb astronaut/astronaut.glb …   public/data/media/<week>/  manifest.json sdo-*.webp earth-*.webp
public/data/terrain/site.json (LOLA)   public/data/facts.json
docs/    rules.md  layout.md  DATA.md  (plain text from the PDFs, for agents)
CLAUDE.md  shot.sh
```

## 3. Engine (lane A) — the five functions of rules_engine.py

```ts
newGame(week, { modules: ['wall'] })              -> State
dayInfo(state, week)                              -> { level, alert, choice, known, card }
preview(state, week, alloc, cardChoice)           -> { left, reserveAfter, gardenAfter, blockedToday, warning }
confirm(state, week, alloc, cardChoice)           -> State (+ log)
result(state, week)                               -> { crew, science, title, blockedPct }
alloc = { ls, gh, build, sc, launch, shelter }
```

`src/engine/rules.ts` started as a stub (`ENGINE_IS_STUB`) so lanes C and D could work; on 14 Nov it became the port
written from `docs/rules.md` (`ENGINE_IS_STUB = false`, open choices in `docs/specs/2026-11-14-engine.md`). When
`rules_engine.py` arrives, lane A ports it over this file, names and numbers identical to Python. `plans.test.ts`
(week 2021-10-25, cards Shadow day 2 and Ice day 3): A → 7/14, 77 % blocked, "Balance Master"; B → 3/19; C → 8/9.
Pure: no React, three, `Date.now`, unseeded random.

## 4. State (lane B) — one reducer, one View

Actions: `START · SET · CHOOSE · CONFIRM · NEXT`. Phases: `morning → plan → run → night → … → launch → truth`.
The scene gets only `View` and calls `onTap(k)` → `dispatch({ type: 'SET', k })`.

```ts
type View = {
  day: 1..7; level: 0..4; alert: boolean
  alloc: { ls; gh; ws; sc; launch }; wall: 0..3; plant: 0..4; shelter: 'none' | 'half' | 'full'
  phase: 'morning' | 'plan' | 'run' | 'night' | 'launch' | 'truth'; focus?: 'garden' | 'crater' | 'sun' | 'wing'
  // concept 3.0 proposal: sunAzDeg, earthElDeg, earthPhase (sky.json), ratio (measured dose / normal)
}
```

Only the engine owner (Shoxjahon aka's engine session) changes `View`. Note: the work plan names the workshop `build` in `alloc`, the developer guide `ws`
in `View`; `toView` maps one to the other. Lane B adds: cards, alert, emergency day, express mission (starts at
day 4, ends in 90 s), before/after questions (counted on the device), saving to localStorage.

## 5. Scene (lane C)

- **The astronaut** (`features.character`, 15 Nov): outside, the camera follows Samandar's rigged astronaut from
  behind; it walks at 1.0 m/s, lopes at 2.0 m/s (Shift) and jumps 0.44 m (Space, ⤒) at Moon gravity
  (`src/character/`), on the free walk's hitboxes; boot prints and ballistic dust (`src/look/fx.js`). A float to a
  standing point is one long lunar hop. Inside the habitat and in the truth pull-back the camera is first person.
- **First person** (final version, Dizayn 2.0): eye height 1.7 m, six standing points (airlock, power hub = main,
  garden window, workshop, hill, ladder) + inside; swipe to look, tap a marker to float there (~1 s), tap objects to act;
  no shake, level horizon. Fallback: same scene, overview camera. Camera point is scene-local state.
- **Real ground and sky**: the LOLA heights of the Shackleton–de Gerlache ridge with the team's hill and Ice crater on
  top (`ground.ts`), rocks, the real 60 km skyline pulled in to 1.5–1.95 km along the line of sight, mountain shadows
  re-baked each day (`Terrain.tsx`); Earth of the day at its Horizons elevation with its GIBS picture (`Earth.tsx`).
- One `<Canvas>` (`Stage.tsx`), never remounted. `frameloop="demand"` while calm; `always` during run, launch, storms.
- Quality tiers (`quality.ts`, developer guide §05): pc → phone → phoneLow → min. `PerformanceMonitor` steps down:
  DPR 1 → Bloom off → shadow 1024 → no shadows, half storm. The child never sets anything.
- Light (`Light.tsx`, 15 Nov "cold Moon, warm home"): one hard Sun at 12° (game rule; `?sunel=1.5` = the real
  pole), azimuth from `sky.json`, faint ground bounce and earthshine, Neutral tone mapping (exposure 3.3, applied
  by the composer's `<ToneMapping>` effect), shadow recomputed once per day. Materials and colours: developer guide §10 table.
- Storm: concept 3.0 — not drawn. Dosimeter clicks, scout-camera snow, sparks in the shelter, driven by `view.ratio`.
- Models: grey code shapes first; GLB in `<Suspense fallback={<Proxy/>}>` later (after G2). Draco decoder from
  `/draco/`. All six models or none.
- No WebGL or a crash → a still picture of the base; the game stays fully playable in the DOM layer.
- `./shot.sh '{"plant":0}' '{"plant":4}'` → screenshots at 390×844 and 1280×760 + draw calls and triangles.

## 6. UI (lane D, Asilbek)

Visor UI, no floating modal windows (Dizayn 2.0 §04): day + radiation level top centre, three gauges bottom, one radio line,
target rings, visor edge state; price/result and night log on the wrist tablet; batteries are scene objects.
Difficulty ★/★★/★★★ changes text length and data depth, and the engine settings in `docs/rules.md` (★: 7 batteries,
3 simple cards, two shelter buttons). DOM above the Canvas. Every button shows its price before it is pressed (`model.preview`). Undo until
"Confirm day". ≤ 8 words per instruction (★ ≤ 5, read aloud). Tap targets ≥ 48 px. Fits 360×640.
Labels in 3D: DOM elements placed by camera projection (a small projector component in `src/scene/` writes their
position from a ref each frame — to be created; not drei `<Html>`).
Truth curve: one SVG path, log axis, no chart library.
Holograms (`play/Holo.tsx`, 15 Nov): mission control (CAPCOM) as a visor hologram that reads its line aloud between
Quindar tones, the start-screen briefing, the jump physics card (h = v²/2g, F = m·g), the SDO photo on the flare day,
and the measured / computed / game rule marks on numbers. Hand control experiment: `?hands` (`play/HandControl.tsx`).

## 7. Data (lane Data — Shoxjahon aka's Claude sessions) — `docs/DATA.md`

`weeks.json` (14 weeks), `sky.json`, SDO and GIBS images per week, `facts.json`. Four labels on screen:
measured, computed, game rule, story.

## 8. Infrastructure (added around the team's plan)

| Piece | What it gives |
|---|---|
| `npm run verify` + GitHub Actions | check + typecheck + tests + build on every push; deploy only if green |
| PWA (vite-plugin-pwa) | Second start instant; plays offline on phones, not only from a laptop |
| `npm run check` | Uzbek ʻ/ʼ letters, forbidden words (live, Gateway, NRHO, "according to NASA"), data shape, asset names, credits |
| `features.ts` | The cut list as switches |
| Playwright e2e | A whole week on a phone viewport, no console errors |
| VPS deploy + Pages backup | One link that never asks judges to log in |

## 9. Gates (Tashkent)

G1 12:00 link live, tests pass, grey base at 30 fps on a phone → **G2 Sat 20:00 seven days in 3D on a phone,
end to end** → G3 Sun 09:00 models decided, English complete, truth screen with the real curve → G4 11:00 freeze →
G5 13:00 submitted. Before G2 forbidden: L2 effects, models, sound, map, modules, free camera.
