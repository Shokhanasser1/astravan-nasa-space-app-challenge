---
paths:
  - 'src/engine/**'
  - 'src/state/**'
  - 'public/data/**'
  - 'scripts/data/**'
  - 'docs/rules.md'
  - 'docs/DATA.md'
---

# Engine, state and data

## Engine (lane A, Shoxjahon aka's engine Claude session since 14 Nov) — a faithful port, not a redesign
- `src/engine/rules.ts` = exact TypeScript port of `rules_engine.py`: same names (P table, step, score, title,
  blocked, day_info), same numbers, same order of operations. Five exports: `newGame`, `dayInfo`, `preview`
  (runs `step` on a copy, saves nothing), `confirm`, `result`, plus helpers the state uses (`limits`, `playable`);
  open choices are recorded in `docs/specs/2026-11-14-engine.md`.
- **Authority, in this order:** `rules_engine.py` once it is in the repo (Samandar's Python reference) → until then `docs/rules.md` and the
  golden numbers in `plans.test.ts` → `rules.ts`. The TypeScript follows the reference, never the other way: do
  not edit `docs/rules.md` or a golden number to match the code. A mismatch is reported to Shoxjahon aka (engine owner); changing a
  rule or a golden number needs the whole team. Nobody claims "exact port" without the Python file side by side.
- Pure and deterministic: no React, three, DOM, `Date.now`, unseeded `Math.random`. Random card order uses a seeded
  PRNG (e.g. mulberry32) whose seed is in the state. Same week + level + seed + plans → identical result.
- Floating point: keep Python's operation order; compare with `toBeCloseTo(x, 2)`; round only for display.
- **Golden tests first** (`plans.test.ts`, week 2021-10-25, Shadow day 2, Ice day 3): Plan A day by day
  (reserve, wall, extra dose, science) and finals A 7/14 77 % "Balance Master", B 3/19, C 8/9. Never change a rule
  to make a test pass — report the mismatch. A rule change needs the whole team.
- Levels ★/★★/★★★ are settings of the same engine (★: 7 batteries, 3 simple cards, two shelter buttons).

## State (lane B) — one reducer
- `src/state/game.ts`: `Model`, `Action` (START · SET · CHOOSE · CONFIRM · NEXT …), `reducer`, `toView`.
  Reducer is pure; every number comes from engine calls; `toView` maps model → `View` for the scene.
- `View` is the scene contract; add fields, do not rename or remove them without telling lanes C and D.
- Phases (design): morning → (guess) → card → plan → run → night → … → launch → truth. `Phase` in `game.ts` grows to
  this list additively. Express mission starts at day 4.
- `View` carries what the scene and the visor need and nothing they must compute. **Now:** radiation `level` 0–4,
  `ratio`, the phase, the focus point (read `game.ts` for the current list). **Planned (ask the engine owner first):** the
  ★ difficulty and the week id for media paths. The confirm lever in the
  scene must end in the same CONFIRM action as the visor button. Missing field → lane C/D ask the engine owner for an
  additive change; they never derive it themselves.
- Save to localStorage only through `src/lib/storage.ts` (may fail; the game continues). Test the reducer with
  Vitest: "Plan A through the reducer = engine result".

## Data (lane Data — Shoxjahon aka's Claude sessions; he reviews the numbers)
- `src/engine/weeks.json` and `src/engine/sky.json` belong to the Data lane although they sit in `src/engine/`
  (imported, bundled); lane A never hand-edits them, Data never edits other files in `src/engine/`.
  Generators: `scripts/data/`. Media in `public/data/media/<week>/` with a `manifest.json`.
- Ratio = day mean ÷ calm value of the 27 days before (**measured**). Level = a **game rule** applied to the ratio,
  half-open: 0 `< 2`, 1 `[2, 10)`, 2 `[10, 100)`, 3 `[100, 1000)`, 4 `≥ 1000`. The Data page shows both labels.
  < 18 hours measured → "partly measured". CRaTER ends June 2024.
- DONKI via CCMC (`npm run donki`); the api.nasa.gov proxy returns 404. Key only in `scripts/data/.env`.
- Every file records its exact request URL and download date; labels measured / computed / rule / story.
- Run Python scripts with `-I`; raw downloads stay in `scripts/data/raw/` (git-ignored).
- Two test runners: `npm test` (Vitest, `*.test.ts`) and, for the Python helpers,
  `python -I -m unittest scripts/data/test_fetch_media.py -v` (needs Pillow). `npm run verify` and CI run only
  Vitest, so run the Python tests yourself whenever a `.py` file in `scripts/data/` changes.
