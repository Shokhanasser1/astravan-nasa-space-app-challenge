---
paths:
  - 'src/engine/**'
  - 'src/state/**'
  - 'public/data/**'
  - 'scripts/data/**'
---

# Engine, state and data

## Engine (lane A) — a faithful port, not a redesign
- `src/engine/rules.ts` = exact TypeScript port of `rules_engine.py`: same names (P table, step, score, title,
  blocked, day_info), same numbers, same order of operations. Five exports: `newGame`, `dayInfo`, `preview`
  (runs `step` on a copy, saves nothing), `confirm`, `result`. Numbers in `docs/rules.md`.
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
- Phases: morning → (guess) → card → plan → run → night → … → launch → truth. Express mission starts at day 4.
- Save to localStorage only through `src/lib/storage.ts` (may fail; the game continues). Test the reducer with
  Vitest: "Plan A through the reducer = engine result".

## Data (Claude; Samandar reviews)
- `weeks.json` and `sky.json` live in `src/engine/` and are imported (bundled). Media in `public/data/media/<week>/`.
- Levels: day mean ÷ calm value of the 27 days before; 0 <2, 1 2–10, 2 10–100, 3 100–1000, 4 >1000.
  < 18 hours measured → "partly measured". CRaTER ends June 2024.
- DONKI via CCMC (`npm run donki`); the api.nasa.gov proxy returns 404. Key only in `scripts/data/.env`.
- Every file records its exact request URL and download date; labels measured / computed / rule / story.
- Run Python scripts with `-I`; raw downloads stay in `scripts/data/raw/` (git-ignored).
