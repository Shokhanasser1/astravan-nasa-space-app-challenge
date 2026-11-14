# Moving work made for the removed Moon demo into the game

Since 15 Nov 01:10 there is one game (`CLAUDE.md`, "One repo, one game"). The separate third-person demo "Oy
karvonsaroyi" (`public/oy/demo/`, for one hour `src/oy/` + `oy/demo/index.html`) is gone, but its parts live on in the
game. Work done for the demo is not lost: port it to the place below on a branch made from the current `main`.
Do not bring the demo files back as a second page.

## Where each demo part lives now

| In the demo | In the game now |
|---|---|
| `physics.js`: gravity, `MOVE` (walk 1.0, run 2.0 m/s, jump), `BODY`, formulas (`jumpHeight`, `carryFactor`, `weightN`) | `src/character/physics.js` — the same file, same API; tests `src/character/physics.test.ts` |
| `world.js` → `AnimController`, `CLIP_SPEED` | `src/character/anim.js` |
| `world.js` → level parsing, OBB colliders (`COL_*`), `GroundIndex` | hitboxes as discs and bars: `src/walk/collide.ts`, `src/walk/world.ts` (from `src/scene/layout.ts`); ground: `src/scene/ground.ts` |
| `game.js` → `PlayerBody` step, the follow camera | `src/character/body.ts` (`stepBody`), `src/scene/Rig.tsx` (`followAstronaut`) |
| `input.js`: keys, touch stick, jump and run buttons | `src/walk/input.ts` (W A S D, arrows, Shift, Space), `src/ui/play/WalkStick.tsx` (stick, `JumpButton`) |
| `demo.js`: renderer, sky, Sun, Earth | `src/scene/Stage.tsx`, `Light.tsx`, `Earth.tsx`, `Terrain.tsx` |
| `demo.js` → the HUD with formulas (jump height, F = m·g, mass) | `src/ui/play/Holo.tsx` (`PhysicsHolo`), words as keys in `src/i18n/<lang>/ui.json` |
| `look/`: LOLA ground, rocks, boot prints, dust | `src/look/` (`fx.js` is driven by `src/scene/Astronaut.tsx`) |
| carrying and dropping bags, pouring water, the G gravity switch | not in the game yet — ask Shoxjahon aka first |
| `public/oy/characters/astronaut.glb` | `public/models/astronaut/astronaut.glb` (team format, meshopt). New clips: re-export, then `npm run glb` |
| `public/oy/assets/*.glb` (HDU, SEV, RASSOR, bags, Earth globe) | sources in `blender/game3d/assets/`; web copies through `npm run glb` into `public/models/<pack>/` with `credit.txt` and a `CREDITS.md` row (as `public/models/nasa-decor/`) |
| `public/oy/sky/*` | `blender/game3d/sky/` (the game draws its own sky) |

## How to port

1. Find what you changed. The last demo versions are in git:
   - `git show 1035265:public/oy/demo/<file>` — Samandar's last demo (Moon clips, Apollo speeds);
   - `git show 718d615^:src/oy/<file>` — the same code just before it was removed.
   Compare them with your copy (`git diff --no-index <old> <yours>`).
2. `git fetch` and `git switch -c <name>/port origin/main`.
3. Move each change to its place in the table. Keep it behind a flag in `src/config/features.ts` if unfinished.
4. New words → keys in `src/i18n/en/ui.json` (uz/ru: Aminjon). New models → `npm run glb` + credit.
5. `npm run verify` and `npm run e2e`; push the branch; tell Shoxjahon aka.

A Claude session can do steps 2–5: give it your files or your diff and this page.

## Known branch: `shoxjahon/wrist-tablet` (pushed 15 Nov 01:13, not merged)

- **Fits the game as it is:** `src/ui/wrist/*`, `src/scene/suit/*`, the hooks in `src/App.tsx` and
  `src/scene/Stage.tsx`, styles in `src/index.css`, keys in `src/i18n/*/ui.json`, `features.suitPanel` — it was made
  for the classic game, which is now the game. Merging means resolving conflicts: those files changed since.
- **Needs porting:** `public/oy/demo/suit/*` and its hooks in `demo.js` (the camera eases into the astronaut's eyes,
  the left forearm and tablet rise). The game's astronaut is now third person in `src/scene/Rig.tsx` +
  `src/scene/Astronaut.tsx`: hook the panel there.
