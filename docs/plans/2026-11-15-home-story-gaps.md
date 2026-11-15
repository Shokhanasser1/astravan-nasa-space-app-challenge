# Home story — what the lead's document asks vs. what the code does (15 Nov, branch `claude/kid-ux`)

Source: Shoxjahon aka's document "HOME BY SEVEN — tanqid, yangi ssenariy va o'yin mantig'i" (15 Nov, 25 pp.),
compared with `test` at 6ef87da (homeStory **on**). Status: **done** · **partial** · **missing** · **other agent**
(built in parallel by another session: crash start, Day 7, parts pile, inside on storm/emergency days, sleep at the
door, night camera) · **here** (this branch builds it, see the end). Video and submission items (A1–A3) are not code.

## B. Problems the document found (pp. 3–5)

| # | Requirement | Status | Evidence |
|---|---|---|---|
| B1 | Story joins the video: crash → walk to the base | other agent (T2) | words done: `story.radio.day1.hs`, `ui.entry.tagline.hs`, `ui.start.brief.hs`; no `Wreck.tsx`, Day 1 still starts at the base |
| B2 | The goal is visible: Ship % | done | `Resources.ship` (`src/state/game.ts` `shipPct`), Ship gauge in `HomeBar.tsx` |
| B3 | "Trainer": a fact a day | done | `NightFact.tsx` + `night-facts.ts` (d1 moonGravity … d7 moonDistance) |
| B3 | "Why the astronaut does this" line on each task | missing → **here** | the document's one-line lessons (p. 14) are in no text file |
| B4 | Judge link to the strongest scene | done | `src/state/demo.ts` `?demo=storm` / `?demo=launch` |
| B5 | Today's 5 before sleeping | done | `src/state/tasks.ts`, `DayTasks.tsx` |
| B5 | "Air runs out" warning only inside the closed Plan list | missing → **here** | `Tablet.tsx` shows `board.preview.warning` only when the list is open; the Start-the-day button has none (T5 asked: on the button, second press goes on) |
| B6 | "Crew 7" → health | done | 5 hearts in `HomeBar.tsx`, `ui.truth.crew.hs`, `ui.res.crew.*.hs` |
| B7 | Six unlabelled numbers → 4 labelled gauges | done | `HomeBar.tsx` (Air & water tank, Food leaves, Power, Ship, Health) |
| B8 | Sleep / Wake up | done (words) · other agent (door) | `ui.hud.sleep`, `ui.hud.wakeUp`, `ui.board.confirmDay.hs` in `Hud.tsx` `nextLabel` |
| B9 | Night camera stuck inside a building | other agent | — |
| B10 | Suit: dark-gold visor | done | commit 9203aba (gold faceless visor) |
| B10 | Suit: grey pack, red stripe | missing (scene, not in this scope) | `src/scene/Astronaut.tsx` has no per-part colours |
| B11 | uz / ru half translated | done | 527 of 527 English keys have uz and ru values (script check, 15 Nov) |
| B12 | Phone budget | partial | perf a524661 (111 → 80 draw calls); not measured on a real phone |
| B13 | Robot-arm camera may fail in the demo | partial | lazy chunk (06a96de); still loads ~13 MB on first use |
| B14 | Every building its own verb | missing → **here** | `ui.prompt.put` "Put into {name}" for all; Plan list shows names only |

## Hard places for a 7–12-year-old (pp. 5–6)

| Place | Document's fix | Status | Evidence |
|---|---|---|---|
| Text | Day 1 in uz/ru; radio read aloud from the start | done | all keys translated; `sound` starts `true` (`App.tsx`), CapcomHolo reads lines |
| Fractions, % | pieces: tank 8, 4 leaves, 5 hearts | done | `HomeBar.tsx` |
| Fractions, % | "8 of 10 blocked" instead of "77%", no "0.00" / "+0.07" | missing → **here** | `TruthScreen.tsx` `blockedPct%`; `Decision.tsx` `blocks {pct}%`, `+{doseToday.toFixed(2)}`; night card `engine.log.blocked` {pct}% and dose chip `toFixed(2)` (`Tablet.tsx`) |
| Late result | each night: the day's star and "ship +n parts" | partial → **here** | parts: `engine.log.found.hs`; the star is computed (`dayStar`) but shown only while planning, never at night or in the finale; `markStar` (`src/state/stars.ts`) is called nowhere |
| Three messages at once | decision first, then task / radio | missing → **here** | Day 2: `Decision`, `DayTasks` and `CapcomHolo` render together (`Hud.tsx`) |
| Decision buttons | words: "1 battery goes. Food stays safe." | missing → **here** | `Decision.tsx` chips "7 left · 6→4 · 2→1" |
| Keys | walk, E, Sleep; the rest under "?" | missing → **here** | key badges for Q, Tab, H, 1–9 on the HUD (`Kbd` in `Hands.tsx`, `Hud.tsx`, `Decision.tsx`, `Tablet.tsx`) |
| Allocation puzzle | "Houston's plan" button: ready plan, child changes one thing | missing → **here** | — |
| Mistake not noticed | gauge turns red, radio says it ("Greenhouse needs light!") | partial → **here** | `HomeBar` shows "→ n" in amber; the gauge warns only for a low level; no radio line |
| Emergency day | "Houston takes over today" + one inside task | partial · other agent (inside) | `story.radio.emergency.hs`, `ui.board.forced.hs`, `ui.goal.forced` |
| Session length | a day ≤ 2 min; save after each day | partial | save per badge exists (`saveKey`, `App.tsx`); day length not measured |
| Robot arm | a bonus, never required | done | `tasks.ts` `arm` always done, `optional`; nothing else reads `armState` except the HUD corner |

## New scenario, logic chain, day cards, radio (pp. 6–11)

| Requirement | Status | Evidence |
|---|---|---|
| Scenes 1–3: crash, walk to the light, door "Press E" | other agent | — |
| Scene 4: the plan by radio | done | `story.radio.day1.hs` |
| Scenes 5–6: daily routine; storm days | done (routine) · other agent (Day 7) | `tutorial.ts` `radioLine`, `dayGoal` |
| Scene 7: truth screen with Ship % and ending | done | `TruthScreen.tsx` `truth-ending`, `truth-ship`, `truth-health` |
| Logic chain words (alone, 7 days, air from water, batteries, rover, food, ship %, wall, health 7) | done (words) | `*.hs` lines in `ui.json`, `story.json`, `engine.json` |
| Day cards in the story's meaning | done | `story.card.*.text.hs` |
| Radio script day by day; Buvi instead of Zuhra | done except Day 1 morning "Suit: Impact…" (other agent) and the night lines | `story.json` `.hs` |
| Mistake table: "Air will run out tonight" before sleeping | missing → **here** | see B5 |
| Mistake table: food leaf turns red on a day without Greenhouse | partial → **here** | see "Mistake not noticed" |
| Mistake table: storm outside shows "X % blocked today" | done (as %) → **here** (as pieces) | `engine.log.blocked` |

## Game logic (pp. 13–17)

| Requirement | Status | Evidence |
|---|---|---|
| 4 resources + health on screen; dose and wall leave the top bar | done | `HomeBar.tsx` |
| Building names: Air Maker, Greenhouse, Workshop, Rover, Ship | done | `ui.machine.*.hs` |
| Rover icon: cargo truck instead of the flask | missing → **here** | `Tablet.tsx` `ROWS` uses `FlaskConical` |
| Astronaut lesson per building (one line) | missing → **here** | see B3 |
| Day order: wake → decide → work → sleep → while you slept | done | `Hud.tsx` labels, `NightTablet` |
| While you slept: ≤ 3 lines, the day's star, one fact | partial → **here** (star) | log ≤ 3 (engine), fact done, star missing |
| 7 stars = the entry screen's seven stars | missing (entry screen not wired) | `stars()` read nowhere; `src/ui/entry/art.tsx` draws fixed stars |
| Ship % = min(100, sci ÷ target) | done | `shipPct`, `sciTarget` |
| Endings by the engine's title (5 texts) | done | `ui.ending.*` |
| 7 days × 5 tasks, done-conditions | done (days 1–6) · other agent (days 1, 5, 7 changes) | `tasks.ts` `TABLE`, `tasks.test.ts` |
| Task text "Start the Air Maker" | partial → **here** | en says "Power the Air Maker" (uz/ru already say "start") |
| A fact per day (ids d1–d7) | done | `night-facts.ts` |
| Next queue: facts, ?demo=storm, suit colours, sleep at the door, uz/ru, video | done · done · missing (scene) · other agent · done · not code | — |

## Built here (behind `features.homeStory`; flag off = the old screens)

Houston's plan button · a drop is noticed (gauge warning + radio line once, on the first Start-the-day press) ·
one message at a time (decision first, then Today's 5 and the radio) · decision buttons in words · pieces instead of
fractions (decision, night card, finale) · kid keys (E and Enter badges only, the rest under "?") · rover truck icon ·
building verbs (Plan list, prompt, touch button) · lesson line under the current task · the day's star at night and
the week's stars in the finale. Details and results: the commit messages on `claude/kid-ux`.
