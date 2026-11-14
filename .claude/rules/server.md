---
paths:
  - 'server/**'
  - 'src/net/**'
  - 'src/config/features.ts'
  - 'scripts/pocketbase.mjs'
  - 'scripts/db-smoke.mjs'
  - '.github/workflows/**'
  - 'docs/SERVER.md'
---

# Hosting, server and deploy (lane Integration — Shoxjahon aka)

**Status for this hackathon: the game sends nothing.** `features.sendResults` is `false` and stays false (pitch
answer: "no account, no names, no date stored, nothing goes to a server"). `src/net/api.ts` returns before any
request while the flag is false.

**Known gap (owner: Shoxjahon aka, decide before G4):** the deploy is not yet purely static. `deploy.yml` passes
`VITE_API_URL` from the repo variable `API_URL`, the VPS stack starts PocketBase, Caddy waits for it to be healthy
and routes `/api/*` and `/_/*`. Harmless while the flag is false, but the pitch says "no server": either leave
`API_URL` unset and move PocketBase behind an opt-in Compose profile, or say so on the page. Until then: do not set
`API_URL`, do not add routes or collections.

- **Do not** build, wire, "finish" or test-enable result sending, the outbox, new collections or new API calls. Do
  not set the `API_URL` variable. A task that seems to need it → stop and ask your human; it is a team decision.
- Hosting: Caddy on the VPS (when the SSH secrets exist) + GitHub Pages on every green push + a frozen Cloudflare
  Pages copy before submitting. Setup and secrets: `docs/SERVER.md`.
- Deploy is atomic (symlink `current`); keep it that way. Do not change Caddy cache headers without reading
  `docs/PERFORMANCE.md`: `/bundle/*` is immutable, entry files are `no-cache`.
- If the dormant database is ever touched: schema changes only through a new file in `server/pb_migrations/`
  (`<unix-ts>_<what>.js`); never edit an applied migration; read rules stay `null` (superuser only); records stay
  anonymous (device id, language, app version, structured answers — no names, emails, free text, photos or voices).
- Never commit `server/.env`, keys, passwords or the PocketBase superuser. Secrets live in GitHub Actions secrets
  and in `/srv/hb7/.env` on the VPS. Never run `docker compose down -v` (it deletes data volumes).
- Docker is not needed for the game. Never start Docker Desktop on a teammate's laptop without asking.
- CI (`.github/workflows/deploy.yml`) must stay: build → Pages; VPS step skipped when `SSH_HOST` is empty. A red
  `main` blocks everyone's phone test — fix it before anything else.
