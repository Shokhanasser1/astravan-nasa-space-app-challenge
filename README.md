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

Pick a real week for a whole class: `/?week=2021-10-25`.

## Docs

- `docs/ARCHITECTURE.md` — layers, data flow, engine contract, owners, gates
- `docs/STACK.md` — the stack and why
- `docs/DATA.md` — NASA sources and data files
- `docs/PERFORMANCE.md` — budgets and rules for 60 fps on phones
- `docs/SERVER.md` — VPS (Caddy + PocketBase) and deploy
- `docs/AI-USE.md` — how AI tools were used
- `CREDITS.md` — every third-party file and its licence
- `CLAUDE.md`, `.claude/` — rules and skills for Claude Code

## Use of Super Intelligence (SI)

Following the Space Apps 2026 Project Submission Guide, SI use is acknowledged in text and metadata:
- **Code:** parts of the code, tests and build scripts were written with Claude Code (Anthropic) and reviewed by the team.
  Log: `docs/AI-USE.md`.
- **Data:** NASA data files are downloaded and converted by scripts (some SI-assisted); the measurements themselves are
  unchanged NASA records (LRO CRaTER via RadLab and iSWA, DONKI, SDO, GIBS).
- **Audio:** English and Russian narration uses the device's text-to-speech (`speechSynthesis`); Uzbek lines are
  recorded by adult team members.
- **Images and video:** any SI-generated image or video carries a visible "AI" mark and contains no NASA logos,
  flags or mission identifiers, and no likeness of anyone under 18.

## Licence

MIT for our code (`LICENSE`); third-party components keep their own licences (`CREDITS.md`).
