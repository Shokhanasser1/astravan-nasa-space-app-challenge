# HOME BY SEVEN — Claude Code guide for Team Astrakarvan

A browser game for ages 7–14 for NASA Space Apps Challenge 2026, challenge **Build a Junior Astronaut Mission
Trainer**. A child lives one real week on a Moon base near the south pole; the Sun, the radiation storm and the
Earth in the sky are that week's real records, revealed at the end. Target award: Best Use of Data.

- Design: concept v2 (`HOME_BY_SEVEN_game_concept_v2.pdf`) and concept 3.0 (`HOME_BY_SEVEN_konsepsiya_3.0.pdf`).
  When code and concept disagree, ask the teammate; do not invent game rules.
- Code architecture, layers, owners: `docs/ARCHITECTURE.md`. Stack and why: `docs/STACK.md`.
  Data: `docs/DATA.md`. Speed: `docs/PERFORMANCE.md`. Server: `docs/SERVER.md`.

Answer in the language the teammate writes in (Uzbek, Russian or English). Code, comments, commits and docs in English.

## Deadlines (Tashkent time)

G2 Sat 20:00 seven days playable on a phone with grey boxes → G3 Sun 09:00 content in → **G4 Sun 11:00 freeze** →
**G5 Sun 13:00 submitted**. Before G2 nothing from the "should"/wow lists, except the 3.0 items marked "now".
Prefer the smallest change that works; say when a request will not fit. Cut = a `false` in `src/config/features.ts`.

## Commands

- `npm run dev` (LAN: open the printed Network URL on a phone), `npm run dev` + `?perf` (FPS overlay), `?tune` (light sliders)
- `npm test` (Vitest), `npm run typecheck`, `npm run check` (strings, forbidden phrases, data shape, assets)
- `npm run verify` = check + typecheck + test + build. Run before every push; CI runs the same and deploys.
- `npm run e2e` (Playwright, phone + laptop; first `npx playwright install chromium`)
- `npm run db` local PocketBase (admin http://127.0.0.1:8090/_/), `npm run db:smoke`
- `npm run glb -- in.glb public/models/x/out.glb --texture-compress webp` before adding any 3D model

## Hard rules

1. **Engine is sacred.** `src/engine/` is the tested L0 rules engine (owner Samandar): pure TypeScript, no React,
   three or DOM. Screens and scene never compute game numbers; they call `startGame / previewDay / confirmDay`
   through the store. Golden test: Plans A/B/C on 2021-10-25 → 7/14, 3/19, 8/9. Never change engine numbers
   to make a screen easier.
2. **Do not write player-facing text.** Every string a child sees or hears is written by the team (Aminjon: story,
   Sarvar: facts and uz/ru). Use `t('key')`, add the key to `src/i18n/en.json` with `""`, and list the keys for the
   teammate. Space Apps requires disclosing AI use; the team keeps game text human-written.
3. **Never say:** "according to NASA", "NASA says/confirmed", "live data" (it is an archive), "6.5-day orbit",
   "Gateway", "NRHO", "everything is real" (wall/shelter numbers are game rules). Say the instrument and date.
   No NASA logo. AI-made images carry a visible mark. `npm run check` catches the common forms.
4. **No NASA calls at run time.** Data is prepared by scripts and shipped in `public/data/`. The NASA API key lives
   only in a local `.env` (git-ignored) on the machine that rebuilds `weeks.json`.
5. **Every number on screen has a label** (`src/lib/labels.ts`): measured, computed, rule, story — and a source in
   `public/data/facts.json`.
6. **Every borrowed file is credited** in `CREDITS.md` with its licence (`add-asset` skill). NASA images keep their
   NASA ID and credit. SDO: "Courtesy of NASA/SDO and the AIA, EVE, and HMI science teams."
7. **No children's names, photos or voices** in code, data, commits, screenshots or video. Before/after answers are
   counted on the device and sent anonymously.
8. **Log AI use**: one line in `docs/AI-USE.md` per AI-generated module or substantial change.
9. **A 7-year-old must not be scared**: no sirens, no red flashing; the sound button is always visible; nobody dies.

## Phone first

Tap targets ≥ 48 px; every drag has a tap alternative; ≤ 8 words per instruction; playable with sound off;
landscape and portrait both usable; 60 fps target on a mid phone (see PERFORMANCE.md). Measure on a real phone
before saying something is fast.

## Working together

Pull before you start; small commits; push often; `<type>: <description>` (feat, fix, refactor, docs, test, chore,
perf). No force-push to `main`. Stay inside the files you own (ARCHITECTURE.md §10); shared files
(`src/engine/types.ts`, `src/state/store.ts`, `src/i18n/*.json`) change in small, announced commits.

## Project skills (`.claude/skills/`)

| Skill | When |
|---|---|
| `add-asset` | Adding a model, texture, sound, font, icon, NASA image or npm package |
| `submission-check` | Before 11:00 freeze and before submitting |
| `react-performance`, `vite-patterns` | Slow screen, re-render storms, build/bundle questions |
| `e2e-testing`, `webapp-testing` | Playwright tests; drive the game in a real browser |
| `ui-demo` | Record the 30-second demo video with Playwright |
| `i18n-sync` | Adding keys or syncing uz/ru with en (text itself stays human-written) |
| `ux-heuristics` | Usability audit of a screen before freeze |
| `systematic-debugging`, `verification-before-completion` | Find root causes; prove it works before saying so |
