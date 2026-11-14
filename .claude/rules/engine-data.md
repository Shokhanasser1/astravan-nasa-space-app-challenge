---
paths:
  - 'src/engine/**'
  - 'src/data/**'
  - 'public/data/**'
  - 'scripts/data/**'
---

# Engine and data

- `src/engine/` is pure TypeScript: no imports from React, three, the DOM, the store or i18n. Deterministic with a seed.
  `confirmDay` returns a new state; `previewDay` never changes anything.
- Golden tests first: Plans A, B, C on week 2021-10-25 must give Crew/Science 7/14, 3/19, 8/9 (concept v2 §10).
  A rule change that breaks them needs the whole team's agreement.
- Levels (Cadet/Pilot/Commander) are settings of the same engine, not separate code paths.
- `weeks.json`: 14 real weeks from DONKI + RadLab (LRO CRaTER). Level = tens of the ratio to the calm value of the
  27 days before the week: 0 <2, 1 2–10, 2 10–100, 3 100–1000, 4 >1000. A day with < 18 hours measured is
  "partly measured". CRaTER data ends June 2024: later storms cannot be played.
- `sky.json`: Sun azimuth, Earth elevation and phase per day, computed (PyEphem), checked against JPL Horizons.
  Label "computed". Sun elevation 1.5° is a game rule.
- Data scripts live in `scripts/data/`; they read the NASA key from a local `.env` and write trimmed files to
  `public/data/`. The key never goes into git or the browser bundle (no `VITE_` prefix for it).
- Do not use the Mars Rover Photos API (archived). Do not call any NASA endpoint from `src/`.
- Run `npm run check` after changing data: it validates shape, levels and labels.
