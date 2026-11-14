# HOME BY SEVEN — system architecture

Source of truth for the game design: concept v2 (`HOME_BY_SEVEN_game_concept_v2.pdf`) and concept 3.0
(`HOME_BY_SEVEN_konsepsiya_3.0.pdf`). This file says how the code is built. Stack and versions: `docs/STACK.md`.

## 1. The system in one picture

```
 BUILD TIME (scripts, Sarvar)                         RUN TIME (the player's phone, offline after first visit)
 ──────────────────────────────                       ─────────────────────────────────────────────────────────
 DONKI (FLR, SEP, notifications) ─┐                    ┌──────────── React app (one page, PWA) ───────────────┐
 RadLab · LRO CRaTER (hourly)  ───┼─► weeks.json ────► │ data/      load + validate weeks.json, sky.json        │
 JPL Horizons / PyEphem        ───┼─► sky.json   ────► │ engine/    L0 rules: startGame · previewDay · confirmDay│
 SDO browse (131 Å), GIBS Earth ──┼─► media/<week>/ ─► │ state/     Zustand store: engine state + UI phase      │
 Yale stars, LOLA relief, GLB  ───┘   models, audio    │   ├─► scene/  L1 3D base (R3F): Sun, shadows, Earth,   │
                                                       │   │            dust, storm (scout-cam snow, sparks)    │
                                                       │   ├─► hud/    DOM overlays: report, card, energy board,│
                                                       │   │            night log, guess, truth sequence        │
                                                       │   └─► audio/  Web Audio: breath, Quindar, dosimeter     │
                                                       │ i18n/      en · uz · ru (+ speechSynthesis / uz voice) │
                                                       │ net/       outbox ──────────────────────────────┐      │
                                                       └─────────────────────────────────────────────────┼──────┘
                                                                                                         ▼
 HOSTING: VPS (Caddy: HTTPS, HTTP/3, zstd, immutable cache) ── /api ──► PocketBase (SQLite)
          GitHub Pages = backup link · Cloudflare Pages = frozen copy for judges
```

**Golden rule: the game never calls NASA while it runs.** All data is fetched, checked and trimmed at build
time and shipped inside the build. The NASA API key never reaches the repository or the browser.

## 2. Layers (from concept v2, section 09)

| Layer | What | Must / should | Rule |
|---|---|---|---|
| **L0 engine** | Numbers only: batteries, reserve, garden, wall, dose, cards, scores, titles | MUST | Pure TypeScript, no React/three imports, tested. Nothing above may change it |
| **L1 base view** | Draws L0's numbers as a base: buildings, cables, tank, wall, Sun, shadows, Earth | MUST | Reads the store; never computes game numbers |
| **L2 modules** | Wing, Dish, Rover garage | SHOULD | Engine already supports them; view only |
| **L3 map + mission log** | Moonwalk map, seven patches | SHOULD | Engine only sees "how many Explore batteries"; if the map is missing, Explore stays a button |
| **Wow layer (3.0)** | Light, silence, real Earth, dust arcs, real flare photo, invisible storm, day passing, launch + truth | per 3.0 cut list | Each wow is a separate component that can be switched off |
| **Knowledge layer (3.0)** | Seven guesses, three levels (Cadet, Pilot, Commander) | SHOULD | A guess never changes resources; levels are settings of the same engine |
| **Data layer (3.0)** | SDO, GIBS, Horizons, SOHO, Diviner/LCROSS facts | per cut list | Files prepared at build time; four labels on screen |

## 3. Engine contract (L0, owner Samandar)

The tested engine is ported into `src/engine/` as pure functions. `src/engine/types.ts` holds the contract
the screens rely on; Samandar adjusts the field names to the real engine **once**, early, and announces it.

```ts
startGame(input: { week: Week; settings: GameSettings; seed?: number }): GameState
previewDay(state: GameState, plan: DayPlan): DayPreview      // price before choice: nothing is spent
confirmDay(state: GameState, plan: DayPlan): GameState        // the day is final, returns a new state
```

- Deterministic: same week + settings + seed + plans → same result. Random day cards use the seed.
- Immutable: `confirmDay` returns a new object; undo before "Confirm day" = keep the old state.
- Golden tests (`src/engine/engine.test.ts`): Plans A, B, C on 25–31 Oct 2021 give **7/14, 3/19, 8/9**
  (Crew/Science). The 3,000-games-per-week simulation can run as a script against the same functions.
- Settings carry the level: Cadet (7 batteries, 3 simple cards, 2 shelter buttons), Pilot (default), Commander.

## 4. State (Zustand store, `src/state/store.ts`)

One store, three slices. Components subscribe with selectors; 3D components read per-frame values with
`useGame.getState()` inside `useFrame` (no React re-render per frame).

| Slice | Contents | Who writes |
|---|---|---|
| `game` | `GameState` from the engine, the chosen `Week`, today's draft `DayPlan`, `DayPreview` | engine calls only |
| `flow` | screen (`title`, `story`, `training`, `day`, `truth`, `end`), day step 1–5, guess answer | HUD |
| `settings` | language (en/uz/ru), level, sound on/off, reduced motion, quality tier | settings screen, persisted |

Day step machine (concept v2, section 05):

```
morning report ─► guess card (3.0) ─► day card / shelter choice ─► energy board ─► day runs (≤6 s, skippable) ─► night log
      ▲                                                                                                              │
      └──────────────────────────────────── next day (Day 7: launch) ◄───────────────────────────────────────────────┘
```

## 5. Scene (L1 + wow layer, `src/scene/`)

- One `<Canvas>` for the whole game, never remounted; scenes swap content (three.js rule: one renderer per page).
- `SunLight`: one directional Sun at 1.5° elevation, azimuth from `sky.json` per day; near-zero hemisphere light
  (0.06); ACES tone mapping; shadow map 2048, **recomputed once per day** (`autoUpdate = false`).
- `Earth`: sphere sized to look 1.9° wide, day texture from GIBS for that date, lit by the same Sun so the phase
  is automatically right. Fallback texture if the week has no GIBS image.
- `Dust`: Points with ballistic arcs (g = 1.62 m/s², no drag). `StormFx`: scout-camera snow density and
  shelter sparks driven by the hour's dose ratio.
- Quality tiers (`src/scene/quality.ts`): DPR cap, shadow size, bloom on/off, particle count. drei
  `PerformanceMonitor` drops a tier when FPS falls; the player can force "low" in settings.
- Models: glTF/GLB optimized with `npm run glb` (meshopt + WebP/KTX2). Phone budget: ≤ 100k triangles in view.

## 6. HUD (`src/hud/`)

React DOM above the canvas: crisp text in three languages, accessible buttons, big tap targets (≥ 48 px),
drag with tap alternative on the energy board. Tailwind for layout. Letterbox bars for story moments (CSS).
One line of text on screen at a time during scenes (3.0, "kadrda bitta gap").

## 7. Audio (`src/audio/`)

Web Audio graph created on the first tap (browsers block audio before it). Code-generated sounds weigh nothing:
dosimeter clicks (Poisson process, rate from the hour's dose ratio), Quindar tones before Houston, fan noise
inside. Recorded files (OGG + M4A): breath loop, ~40 Uzbek voice lines. English and Russian lines use
`speechSynthesis`. Every sound has a visual twin: the game is playable with sound off. No sirens, no red flashing.

## 8. Data files (`public/data/`, owner Sarvar)

| File | Contents | Built by |
|---|---|---|
| `weeks.json` | 14 real weeks; each day: date, mean/max µGy/h, hours measured, ratio, level 0–4, alert, flares, particles, label | rebuild script from DONKI + RadLab (key stays local) |
| `sky.json` | per week, per day: Sun azimuth, Earth elevation, Earth phase (computed, checked against JPL Horizons) | PyEphem script |
| `media/<week>/` | `sdo-<hhmm>.jpg` (before flare, at peak), `earth-<date>.jpg` (GIBS 2048×1024) | fetch script |
| `facts.json` | every number shown in the game with its source link (Sarvar's fact sheet) | by hand |

Schemas live in `src/data/types.ts`; `npm run check` validates the files. A day with < 18 hours measured is
labelled "partly measured". Four labels on screen (3.0): measured, computed, game rule, story.

## 9. Server (`server/`, `docs/SERVER.md`)

PocketBase behind Caddy on the team VPS. Anonymous, write-only for the game:
- `playtests`: the three before/after questions (gravity, air, radiation), on-device session id, language, level.
- `runs`: one summary per finished game: week id, level, crew, science, title, which cards/shelter choices.
The game works without the server (outbox in localStorage, sent in the background). Class code = URL
`?week=2021-10-25` (no backend needed). Local database for development: `npm run db`.

## 10. Who owns what (concept v2, section 15)

| Person | Owns in code |
|---|---|
| Samandar | `src/engine/`, `src/data/` loader and week picking, scores/titles, deploy |
| Shoxjahon aka | `src/hud/`, `src/state/` day flow, `src/scene/` light and storm, `src/audio/` |
| Asilbek | `public/models/`, textures, interface kit (colours, type, icons) → `src/hud/kit`, credits |
| Sarvar | `public/data/`, data scripts in `scripts/data/`, `facts.json`, text in uz/ru, player test |
| Aminjon | story/start/ending text (en), project page, video, pitch, `docs/AI-USE.md` |

Shared files (`src/engine/types.ts`, `src/state/store.ts`, `src/i18n/*.json`) change in small, announced commits.

## 11. Gates (Tashkent time)

G1 skeleton online (engine reproduces Plans A/B/C) → **G2 Sat 20:00 seven days playable on a phone with grey
boxes** → G3 Sun 09:00 content in → G4 Sun 11:00 freeze → G5 Sun 13:00 submitted. Nothing from the wow/should
lists starts before G2, except the 3.0 items marked "now" (outdated lines, light recipe, data files, voice recording).
Cut order (3.0, section 08) is implemented as feature flags in `src/config/features.ts`, so cutting = one `false`.
