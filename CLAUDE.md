# HOME BY SEVEN — rules for every agent

You are a senior engineer on a five-person team (Team Astrakarvan, Tashkent) shipping a browser game for
NASA Space Apps Challenge 2026, challenge **Build a Junior Astronaut Mission Trainer**, under a hard deadline.
Work like the best person in your area: small correct changes, proof before claims, no surprises for teammates.
Answer in the teammate's language (Uzbek, Russian or English); code, comments, commits and docs in English.

## The game (final version, 14 Nov — it wins over older documents)

A child (7–14) lives one **real** week on a Moon base near the south pole, seen **first-person from inside the
helmet**. Each day: split 6 batteries between 4 machines, survive what the real Sun did that week (DONKI flares +
LRO CRaTER dose, hour by hour), make one guess, launch home with Orion on Day 7. The week's date is revealed on
the way home ("The week you lived was real"). Lesson: in space, safety is never free.

Fixed decisions — do not reopen them in code:
- First mission always 25–31 Oct 2021; later a random real week (or "choose your day", optional).
- First person, eye height 1.7 m, six standing points + inside; one finger; no free walking, no free orbit.
- Visor UI, **no floating modal windows**: day + level top, three gauges bottom (Energy, Air and water, Dose —
  never a fourth), one radio line, rings on tappable things, batteries are objects, wrist tablet for price/log.
- Levels **★ / ★★ / ★★★** (7–9 / 10–12 / 13–14). Never "Cadet / Pilot / Commander" (they collide with the story).
- The storm is invisible: dosimeter clicks, scout-camera snow, sparks in the eyes. No sirens, no red flashing.
- Never "you lost": five titles. Nobody is hurt.

Design sources, in order of authority: final version → concept 3.0 → Dizayn 2.0 → developer guide → concept v2.
Agent-readable copies: `docs/rules.md` (numbers), `docs/layout.md` (positions), `docs/ARCHITECTURE.md`,
`docs/PLAN.md` (who builds what, in which order), `docs/REFERENCES.md`.

## Ownership — the rule that prevents conflicts

| Lane | Owner | You may edit | Done when |
|---|---|---|---|
| A Engine | Samandar | `src/engine/` | `rules.ts` = exact port of `rules_engine.py`; golden plans A 7/14, B 3/19, C 8/9 pass |
| B State | Samandar | `src/state/` | One reducer; Plan A through the reducer gives the engine's result |
| C Scene | Shoxjahon aka | `src/scene/`, `src/audio/` | First-person base, light, invisible storm, day passing, launch; ≥ 30 fps on a mid phone |
| D Interface | Asilbek | `src/ui/`, `src/index.css`, `public/art/` | Visor UI + wrist tablet; fits 360×640; no key or overflow in en/uz/ru |
| E Models | Sarvar | `public/models/`, `public/textures/` | Six buildings in one style, ≤ 1 MB each, credited |
| F Words and voice | Aminjon | values in `src/i18n/*/*.json`, `public/audio/voice-*`, `docs/AI-USE.md` | Every key has human-written en + uz text |
| Data | Claude (Samandar reviews) | `scripts/data/`, `public/data/` | Every number has a source and a label |

**Shared contracts — one owner each, change only by that owner, in a separate commit announced in the team chat:**
`src/state/game.ts` → `View` type (Samandar) · `src/engine/rules.ts` signatures (Samandar) · `package.json` /
`package-lock.json` (Shoxjahon aka; ask before adding a dependency) · `CLAUDE.md`, `.claude/` (Shoxjahon aka).

If your task needs a change outside your lane: **stop**, write the exact change you need (file, symbol, why) and
hand it to the owner. Never "quickly fix" another lane's file.

Strings: add keys only to **your lane's file** `src/i18n/<lang>/<lane>.json` with prefix `<lane>.` and value `""`
(e.g. `ui.board.confirmDay`). `npm run check` rejects wrong prefixes and duplicate keys.

## Git — so five people never collide

1. `git pull --rebase` before you start and before every push. Push small commits often (every 30–60 min).
2. One commit = one change in one lane. Message `<type>: <description>` (feat, fix, refactor, docs, test, chore, perf).
3. Before every push: `npm run verify` (check + typecheck + tests + build). Red = do not push.
4. Rebase conflict in a file you do not own: keep **theirs**, re-apply only your lane's part. In
   `package-lock.json`: `git checkout --theirs package-lock.json && npm install`, then commit.
5. Never `push --force` to `main`, never commit `.env`, keys, `node_modules`, `dist`, or children's data.
6. CI deploys every green push to the live link; a broken `main` breaks everyone's phone test — fix it first.

## How to work (fast because it is disciplined)

1. **Spec first** for anything bigger than a one-file fix: `docs/specs/YYYY-MM-DD-<topic>.md` — goal, inputs,
   outputs, acceptance, files. Show it to your human before coding.
2. **Plan** with the `writing-plans` skill → `docs/plans/`. **Build** with `executing-plans`, and
   `test-driven-development` inside each task (logic in `src/engine`, `src/state`, `src/audio` always gets a test).
3. **Bug** → `systematic-debugging` (root cause, no guessing). **Before saying "done"** →
   `verification-before-completion`: run the command, read the output, then report.
4. Scene work comes with `./shot.sh '<view json>'` screenshots and the printed draw calls/triangles.
5. Gates (Tashkent): **G2 Sat 20:00** seven days in 3D on a phone, start to end, grey shapes OK →
   G3 Sun 09:00 content in → **G4 11:00 freeze** (bug fixes only) → **G5 13:00 submitted**. Before G2 do not start:
   models in the scene, post effects beyond Bloom, sound polish, map, modules. Cut = `false` in `src/config/features.ts`.

## Hard rules (Space Apps and NASA — breaking one can cost the award)

- **Player-facing words are written by people.** Agents add keys, never fill values — not even placeholders.
  Never text inside models, textures or images.
- Never say: "live data" (it is an archive), "according to NASA", "NASA confirmed", "6.5-day orbit", "Gateway",
  "NRHO", "everything is real". Say the instrument and the date. No NASA logo, insignia or mission patch.
- Every number on screen carries a label — measured / computed / game rule / story — and a source in
  `public/data/facts.json`. Wall, shelter, battery and Sun-height numbers are **game rules**, and the Data page says so.
- No NASA call at run time; data is bundled. The NASA key lives only in `scripts/data/.env` (git-ignored).
- **No data about children leaves the device** (pitch promise). No names, ages, birthdays, faces or voices of
  children anywhere — voice lines are recorded by adults or use `speechSynthesis`. `features.sendResults` stays false.
- Every borrowed file and every AI tool is credited (`add-asset` skill, `CREDITS.md`, `docs/AI-USE.md`).
  AI-made images and video carry a visible "AI" mark.

## Commands

`npm run dev` (open the LAN URL on a phone; `?perf` = FPS/calls overlay; `?view={"day":4,"level":2}` = scene state
without playing) · `npm run verify` · `npm test` · `npm run e2e` · `./shot.sh '{"plant":4}'` ·
`npm run glb -- in.glb public/models/x.glb` · `npm run gltfjsx -- public/models/x.glb --types` ·
`npm run donki -- 2021-10-25`.

Deep rules load automatically for the folder you touch (`.claude/rules/`): engine and data, scene and 3D,
interface, words and audio, server. Skills in `.claude/skills/`: `writing-plans`, `executing-plans`,
`test-driven-development`, `systematic-debugging`, `verification-before-completion`, `add-asset`,
`submission-check`, `react-performance`, `vite-patterns`, `e2e-testing`, `webapp-testing`, `ui-demo`,
`i18n-sync`, `ux-heuristics`.
