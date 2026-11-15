# Home story — how the new scenario goes into our code (15 Nov ~10:45)

Source: Shoxjahon aka's document "HOME BY SEVEN — tanqid, yangi ssenariy va o'yin mantig'i" (15 Nov, 25 pages; the
repo-root PDF, git-ignored). It says T1–T6 were already built on `aminjon/home-story` behind `features.homeStory`,
delivered as `home-story.bundle` — **not on this machine yet**. Path A below uses that branch; path B builds the same
thing here, step by step. Deadline 23:59; gate for this work: 18:00 (docs/STATUS.md).

## Rules for every step
- `src/engine/rules.ts`, `weeks.json`, the golden plans and their tests stay as they are: the story gives existing
  numbers new names and reasons; it never changes a rule.
- Behind `features.homeStory` (off → today's game). Each step is one commit after `npm run verify` and the e2e week;
  the game stays playable after any step. The flag goes on only when all of 1–5 are green.
- Add fields to the View / Resources, never rename or remove (the scene and UI contract).

## Path A — the bundle arrives (preferred, already built)
`git fetch home-story.bundle aminjon/home-story:aminjon/home-story` → merge into a temp worktree from today's `main`
→ resolve conflicts (expected: `Hud.tsx`, `ResourceBar.tsx`, `TruthScreen.tsx`, `Task.tsx`, `Rig.tsx`,
`Astronaut.tsx`, the three `ui.json`; main gained since 09:10: Asilbek's quiz, the Flight Deck skin, the hour-by-hour
day and sounds, Samandar's ladder and interiors) → apply the "Start the day" fix below → verify, e2e, screenshots.
~45–60 min.

## Path B — build it here (if no bundle by ~11:30)

| # | Step (doc) | Where in our code | Done when | ~min |
|---|---|---|---|---|
| 1 | **Words** (T1) + day-order fix | `src/i18n/{en,uz,ru}/*.json`: story values behind the flag (`<key>.hs` overrides read first by `src/i18n/t.ts` when `homeStory`) | Day 1 never says "Welcome to the Moon"; buttons read "Start the day" / "Sleep" | 30 |
| 2 | **4 gauges + hearts** (T3) | `Resources.ship` (0–100 = min(100, sci ÷ the week's high-science threshold, `result()` in `rules.ts`)) added in `src/state/game.ts`; new `src/ui/play/HomeBar.tsx` (Air & water tank 8 cells · Food 4 leaves · Power = batteries today · Ship %) + 5 hearts = crew ÷ 2; `ResourceBar` stays for flag off | top bar has 4 labelled gauges + hearts; dose, wall, science move to the night card and the day chart | 40 |
| 3 | **Today's 5 + day stars** (T4) | pure `src/state/tasks.ts` `dayTasks(model)` → 5 `{key, done, target}` from the doc's day table (+ tests); `src/ui/play/DayTasks.tsx` replaces `TaskLine` when the flag is on; the beacon follows the first open task; stars kept on the cadet badge (`src/profile/`) | list ticks itself from the plan; 5/5 → the day's star | 45 |
| 4 | **Night: sleep, warnings, one fact** (T5) | `Hud.tsx`: the warnings `engine.warn.reserveEmpty` / `noLaunch` on the Start-the-day button (second press goes on); night card shows one fact per night from `public/data/facts.json` (d1 moonGravity, d2 coldCrater, d3 iceCrater, d4 donkiFlare, d5 stormPeak, d6 noAir, d7 moonDistance); **Asilbek's radio-check quiz asks about that same fact** (one mechanism, not two) | warning visible before the night it matters; a fact a night, quiz on it | 40 |
| 5 | **Finale** (T6) | `TruthScreen.tsx`: Health (hearts) · Ship % · ending text by the engine's title (5 texts in the doc) · the week's stars; keeps the measured bars and sources | ending matches the title; numbers from the engine only | 30 |
| 6 | **Judge links** | `src/state/demo.ts`: `?demo=storm` plays `PLAN_A` days 1–3 through the reducer and opens Day 4 morning; `?demo=launch` opens Day 7 | the page links open the strongest scenes in seconds | 20 |
| 7 | **Ship and parts in 3D** | `src/scene/Wreck.tsx`: a pile of cargo bags by the lander grows with Ship % (one bag per 1/6), instanced | the goal is visible in the world | 30 |
| 8 | **Start at the crash** (T2, riskiest, own flag `homeStoryCrash`) | `CRASH` in `src/scene/layout.ts` (dark-crater side, inside the 120 m edge); tilted copy of the lander + red light (`Wreck.tsx`); Day 1 morning starts there (`Rig.tsx`); tutorial step `reach` before `next` (`src/ui/tutorial.ts`), Next still skips (e2e) | Day 1 opens at the wreck, the base light ahead; e2e green | 60 |
| 9 | **Suit** | `src/scene/Astronaut.tsx`: dark-gold visor (no face visible), grey pack, red stripe — per material name | visor dark gold in a screenshot | 20 |
| 10 | **Voices** | Gemini TTS (`gemini-3.8-flash-tts`, works on the team key) for the final story lines, en/ru (uz tested by transcribing back) → `public/audio/voice-*` | CAPCOM speaks the new lines | 40 |

Path B total ≈ 6 h with checks → steps 1–6 by ~15:00, 7–10 by ~18:00.

## The day order (fixes a hole in the doc)
The doc renames "Confirm day" to "Go to sleep", but the day (and the real storm, e.g. particles at 16:16 UTC) plays
**after** that button (`DayRun`, src/scene/runClock.ts) — the child would sleep through the storm. So:
**Wake up (morning) → decide (card / shelter) → carry batteries → "Start the day" → the day runs hour by hour on the
measured record → "Sleep" → "While you slept" (night card).**

## Decisions (Shoxjahon aka)
1. Adopt the story (flag on at the end of step 5)? 2. Path A (bundle) or B? 3. Ship % = science points, renamed
"parts and samples" so the science stays in the words. 4. The ship still flies below 100 % (engine rule) with a
warning — keep for the hackathon. 5. The measured dose stays visible (night card + day chart) — it is our Relevance
score.

## Owners
Claude builds. Aminjon: words (step 1 review, the voices' lines). Asilbek: HomeBar / DayTasks in the Flight Deck
look, quiz ↔ fact. Sarvar: design review of 2–5. Samandar: wreck look, parts pile, suit colours.
