# HOME BY SEVEN

A browser game for ages 7–14, made by Team Astrakarvan (Tashkent) for NASA Space Apps Challenge 2026,
challenge **Build a Junior Astronaut Mission Trainer**. A child lives one week on a Moon base near the south pole.
The Sun, the radiation storm and the Earth in the sky are one real week from NASA's records; the date is revealed
on the way home.

This project is not an official NASA product and is not endorsed by NASA.

## Run

Node.js 22.12+.

```bash
npm install
npm run dev        # http://localhost:5173 and a LAN address for phones
npm run verify     # strings/data check + typecheck + tests + build (CI runs this)
npm run e2e        # Playwright, phone and laptop (first: npx playwright install chromium)
npm run db         # local PocketBase for playtest results (optional)
```

Pick a real week for a whole class: `/?week=2021-10-25`. Try hand control (experiment, laptop camera): `/?hands`.

## What you play

- A suited astronaut on the real ground of the Shackleton–de Gerlache ridge (NASA LRO LOLA): walk (W A S D or the
  stick), lope (Shift), jump 0.44 m at Moon gravity (Space or ⤒); after a jump a hologram shows h = v²/2g and the
  Earth jump. Six base buildings (NASA-based models), each a machine of the week.
- Each day: radiation from the real week (LRO CRaTER, hourly; flares and particles from DONKI), mission control
  (CAPCOM) as a hologram that reads its line aloud, a plan with prices shown before you press, the night log.
- The sky of that week: the Sun's direction (computed, checked against JPL Horizons), Earth of the day at its real
  height with the NASA GIBS picture of that day, and on the flare's day the SDO photo of the Sun.
- On the way home the truth: the real dates, the measured curve, the SDO flare before and at its peak.
- Every number carries a mark: measured, computed or game rule. Nothing about the player leaves the device; progress
  is saved in the browser.
- Controls: `?` in the game, or `docs/specs/2026-11-14-controls-guide.html`.

## Docs

- `docs/ARCHITECTURE.md` — layers, data flow, engine contract, owners, gates
- `docs/STACK.md` — the stack and why
- `docs/DATA.md` — NASA sources and data files
- `docs/PERFORMANCE.md` — budgets and rules for 60 fps on phones
- `docs/SERVER.md` — VPS (Caddy + PocketBase) and deploy
- `docs/AI-USE.md` — how AI tools were used
- `CREDITS.md` — every third-party file and its licence
- `CLAUDE.md`, `.claude/` — rules and skills for Claude Code
- `blender/README.md` — Samandar's NASA 3D work (outside the game build); heavy sources are in a Release, see below

## Blender sources: in Releases, not in git

The heavy 3D files are kept out of git so that every `git pull` and CI run stays small. Download them from the
GitHub Release [`blender-sources-2026-11-14`](https://github.com/Shokhanasser1/astravan-nasa-space-app-challenge/releases/tag/blender-sources-2026-11-14) (pre-release):
one zip, `oy-karvonsaroyi-3d-blender-sources.zip`, ~400 MB (479 files).

- 7 Blender files: `scenes/{yer,xks,oy,mars,koinot}/*.blend`, `review/BARCHA_RENDERLAR.blend` (all renders in one file),
  `game3d/characters/_work/astronaut_rig.blend` (skeleton and animations).
- The 35 original NASA GLBs (`source/models/`), 97 full-size PNG renders and 64 PNG sprite sheets.
- Unzip it outside the repo (for example `~/dev/oy-karvonsaroyi-3d`) and open the `.blend` files in Blender 5.3+.
  How to use them: `blender/README.md`.
- **Do not commit these files to the repo.** If you change them, publish a new Release or tell Samandar.

## Use of Super Intelligence (SI)

Following the Space Apps 2026 Project Submission Guide, SI use is acknowledged in text and metadata:
- **Code:** parts of the code, tests and build scripts were written with Claude Code (Anthropic) and reviewed by the team.
  Log: `docs/AI-USE.md`.
- **Data:** NASA data files are downloaded and converted by scripts (some SI-assisted); the measurements themselves are
  unchanged NASA records (LRO CRaTER via RadLab, DONKI, SDO, GIBS, EPIC, SVS, JPL Horizons, LOLA).
- **Text:** English game text and the Uzbek and Russian lines were first drafted with Claude Code and are edited by
  the team (Aminjon). The idea and the game design are the team's.
- **3D models:** the furnished building interiors (`public/models/interiors`) and the astronaut's compact backpack
  were built in Blender by SI-written scripts (AI-made models, marked in `CREDITS.md`); so was the lunar lander v2 in
  `blender/lander_v2/` (not in the game). The NASA models themselves are NASA's.
- **Audio:** English and Russian narration uses the device's text-to-speech (`speechSynthesis`); Uzbek lines are
  shown as text (no recorded voice yet). Sounds (dosimeter, Quindar tones) are generated in code.
- **Images and video:** any SI-generated image or video carries a visible "AI" mark and contains no NASA logos,
  flags or mission identifiers, and no likeness of anyone under 18.

## Languages

The game, this README, `CREDITS.md`, `docs/AI-USE.md` and the project page are in English. Team working notes in
`docs/` and `blender/` are partly in Uzbek and Russian.

## Licence

MIT for our code (`LICENSE`); third-party components keep their own licences (`CREDITS.md`).
