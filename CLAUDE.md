# HOME BY SEVEN: rules for every agent

Game: a browser game for ages 7–14. Seven days on a Moon base near the south pole, driven by real NASA radiation
data (DONKI + LRO CRaTER); the real week is revealed on the way home. NASA Space Apps Challenge 2026, challenge
**Build a Junior Astronaut Mission Trainer**, Team Astrakarvan (Tashkent). Target award: Best Use of Data.
Read `docs/ARCHITECTURE.md` first; design lives in the team's concept documents (v2, 3.0, scenario, developer guide).
Stack: Vite + React + TypeScript, three + @react-three/fiber + drei + postprocessing. No physics engine. No server
for the game.

Answer in the language the teammate writes in (Uzbek, Russian or English). Code, comments, commits in English.

## The team's rules (developer guide §08)

1. `src/engine` is pure TypeScript: no React, no three, no `Date.now`, no unseeded `Math.random`.
2. The scene never computes game rules. It renders a `View` and calls `onTap`. Every number comes from the engine.
3. All visible text comes from `src/i18n/en.json` and `uz.json` (and `ru.json`). No text inside models, textures, images.
4. One `<Canvas>`. HUD, labels and modals are DOM elements above it. Tap targets are at least 48 px.
5. Phone budget: under 100k triangles, about 50 draw calls, models under 5 MB in total.
   After any scene change, report renderer.info (calls, triangles): `./shot.sh` prints them.
6. Never call the embedded data "live". Say "real", "measured" or "recorded".
7. Stay inside your lane's folder. If another folder must change, stop and say so.

Done means: `npm run verify` passes (check + typecheck + tests + build), and scene work comes with `./shot.sh` screenshots.

## Lanes (developer guide §07) — one owner, one folder, no two agents on one file

| Lane | Owner | Folder | Done when |
|---|---|---|---|
| A Engine | Samandar | `src/engine` | `rules.ts` = port of rules_engine.py; `plans.test.ts`: A 7/14, B 3/19, C 8/9; 14 weeks load |
| B State and flow | Samandar | `src/state` | Reducer, phases, cards, alert, emergency day, express mission; Plan A through the reducer gives the same result |
| C Scene | Shoxjahon aka | `src/scene` | Base, states, storm, camera, day change, launch; five state screenshots; 30 fps on a phone |
| D Page layer | Shoxjahon aka | `src/ui` | Gauges, labels, four modals, truth screen, language; fits 360×640; Uzbek never overflows |
| E Models and video | Aminjon, Asilbek | `public/models` | Six models ≤ 1 MB each; `CREDITS.md` complete |
| F Text and data | Sarvar | `src/i18n`, `docs` | en/uz texts, Data page, facts; no key visible on screen; every number has a source |

The only shared contract is the `View` type in `src/state/game.ts`; only Samandar changes it.
`src/engine/rules.ts` is a STUB with the right signatures until lane A replaces it.

## More rules (from the concepts and Space Apps)

- **Do not write player-facing text.** Add the key to `en.json` with `""` and list keys for lane F.
- **Never say** "according to NASA", "NASA confirmed", "live", "6.5-day orbit", "Gateway", "NRHO", "everything is real".
  No NASA logo. AI-made images and video carry a visible mark. `npm run check` catches the common forms.
- **No NASA calls at run time**; data is bundled. The NASA key never enters git or the bundle.
- **No data about children leaves the device** (pitch answer: nothing goes to a server). `features.sendResults` stays false.
- **Every borrowed file is credited** in `CREDITS.md` (`add-asset` skill); NASA images keep their NASA ID.
- **A 7-year-old must not be scared**: no sirens, no red flashing; the sound button is always visible; nobody is hurt.
- **Gates** (Tashkent): G2 Sat 20:00 seven days in 3D on a phone → G3 Sun 09:00 content → G4 11:00 freeze → G5 13:00
  submitted. Before G2 forbidden: L2 effects, models instead of grey shapes, sound, map, modules, free camera.
  Cutting a feature = `false` in `src/config/features.ts`.
- **Log AI use** in `docs/AI-USE.md`.

## Commands

`npm run dev` (LAN URL for phones; `?perf` overlay, `?view={"plant":4}` scene override) · `npm run verify` ·
`npm test` · `npm run e2e` · `./shot.sh '{"plant":0}' '{"plant":4}'` · `npm run glb -- in.glb out.glb` (meshopt, no
decoder needed) · `npm run gltfjsx -- public/models/hab.glb --types` · `npm run db` (optional local PocketBase).
Models: Draco decoder loads from `/draco/` (copied at dev/build), never from a CDN.

## Skills (`.claude/skills/`)

`add-asset`, `submission-check`, `react-performance`, `vite-patterns`, `e2e-testing`, `webapp-testing`, `ui-demo`
(30-second video), `i18n-sync`, `ux-heuristics`, `systematic-debugging`, `verification-before-completion`.
Path rules in `.claude/rules/` load automatically for scene, engine/data, UI/text and server files.
