---
paths:
  - 'src/App.tsx'
  - 'src/main.tsx'
  - 'src/lib/**'
  - 'src/config/**'
  - 'e2e/**'
  - 'scripts/*.mjs'
  - 'vite.config.ts'
  - 'playwright.config.ts'
  - 'tsconfig.json'
  - 'package.json'
  - 'src/i18n/t.ts'
  - 'shot.sh'
  - 'docs/ARCHITECTURE.md'
  - 'docs/PLAN.md'
  - 'docs/TASKS.md'
---

# Integration: app wiring, config, scripts, e2e (lane Integration — Shoxjahon aka)

These files join the lanes. Everyone needs them; one person owns them. If you are not the owner, write the exact
change (file, line, why) and hand it over — do not edit.

## Wiring (`src/App.tsx`, `src/main.tsx`)
- `App.tsx` only connects: `reducer` (lane B) → `toView` → `<Stage view onTap>` (lane C) + `<Hud model view
  dispatch>` (lane D). No game number is computed here; no rule lives here.
- First mission = the week 2021-10-25, except when a valid class code `?week=YYYY-MM-DD` names another real week
  (an unknown code is ignored → 2021-10-25). A random week only after the first mission is finished. Test all
  three cases (first mission, later mission, class code).
- One `<Canvas>` for the whole game, never remounted (see `.claude/rules/three.md`).

## Config
- `src/config/features.ts` = the cut list. Aminjon decides cuts at each gate; the owner edits the file.
  `sendResults` stays `false` (see `.claude/rules/server.md`). Every flag must have a plain fallback.
- `src/lib/storage.ts` is the only door to `localStorage` (may throw in private mode; the game continues).
- `package.json`: no new dependency without asking Shoxjahon aka; versions pinned exactly (`--save-exact`).
- `vite.config.ts`: relative `base: './'` (same build on VPS, Pages, Cloudflare); keep the PWA precache list in
  sync with the file types in `public/`; see the `vite-patterns` skill.

## Scripts (`scripts/*.mjs`)
- `check.mjs` is the cheap guard every push runs. When a rule in `CLAUDE.md` says "`npm run check` rejects X", the
  check must really do X — change both together. New checks must pass on current `main` before they become errors
  (start as a warning if a teammate's files would turn red).
- `shot.mjs` renders with SwiftShader at 390×844 and 1280×760: trust its draw-call and triangle counts, not its FPS.

## e2e (`e2e/`, Playwright, see the `e2e-testing` skill)
- Select by role or `data-testid`, never by English words or raw i18n keys: the words arrive later from people.
  Ask lane D for a `data-testid` when a control has none.
- The smoke test plays a full week to the truth screen on the phone project. At G2/G4 it must be green.
- Add a check that no raw key (`ui.…`, `story.…`) is visible once the text is in, and that 360×640 has no
  horizontal overflow in en, uz and ru.
- A second test plays the week with WebGL switched off (no canvas): the DOM layer alone must reach the truth screen.
- Docs hold rules, not status: when a plan step is done, update the table in `docs/PLAN.md` in the same commit.
