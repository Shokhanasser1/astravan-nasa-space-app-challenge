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

## Licence

MIT for our code (`LICENSE`); third-party components keep their own licences (`CREDITS.md`).
