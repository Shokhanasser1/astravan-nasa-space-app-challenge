# Spec: expert team setup v2 (final version) — CLAUDE.md, rules, skills, role plan

## Goal

Five people and five Claude agents build HOME BY SEVEN in one repo at the highest quality without conflicting.
Every agent behaves like a senior expert in its area and follows the team's **final version** (*Yakuniy versiya*,
14 Nov: "if documents conflict, this one wins").

## Decisions taken from the final version (and Dizayn 2.0, which it cites)

- First-person view from inside the helmet, eye height 1.7 m. No free walking: six standing points
  (1 airlock, 2 power hub = main place, 3 garden window, 4 workshop, 5 hill, 6 ladder) + inside the habitat.
  Look = finger swipe; move = tap a glowing marker, camera floats ~1 s; act = tap the object; one big button at the bottom.
  No camera shake, horizon always level, slow turns. Fallback: same scene, camera rises (developer guide view).
- Interface lives on the visor and on objects: day + level top centre, three gauges along the bottom curve
  (Energy, Air and water, Dose — no fourth), one radio line (≤ 2 lines), target rings on tappable things, batteries
  are objects on the hub, the wrist tablet shows price/result and the night log, visor edge shows state
  (calm, alert, storm level colour, low air blue). **No floating modal windows.**
- Levels ★ / ★★ / ★★★ (7–9 / 10–12 / 13–14); the age is never asked. Not "Cadet / Pilot / Commander".
- Voices: adults or `speechSynthesis` only — never children's voices, names or faces.
- First mission always 25–31 Oct 2021; then random real week or "choose your day" (optional).
- Build order 0–9 (final version §09); item 0 = seven days playable on a phone with grey shapes.

## Deliverables

1. `CLAUDE.md` — project-wide expert brief: game, final decisions, collaboration protocol (ownership, contracts,
   git flow, conflict-free rules), process (spec → plan → TDD → verify), quality bar, hard rules.
2. `.claude/rules/*.md` — deep domain expertise loaded per folder: engine/data, scene (first-person, R3F
   performance), interface (visor UI for kids), text/i18n/audio, server.
3. Process skills in the project: `writing-plans`, `test-driven-development`, `executing-plans` (superpowers, MIT).
4. i18n split per lane (`src/i18n/<lang>/<namespace>.json`, merged at load) so lanes never edit the same file.
5. `docs/PLAN.md` — final version §09 build order split by the current roles, to a complete product.
6. `docs/ARCHITECTURE.md` updated: first person, visor UI, star levels.

## Acceptance

- An agent in any lane can answer from the files alone: what it owns, what it must not touch, how to change a
  shared contract, how to commit without conflicts, what "done" means, which skills to use.
- No two lanes own the same file; the only shared files have one named owner and a change procedure.
- `npm run verify` stays green.
