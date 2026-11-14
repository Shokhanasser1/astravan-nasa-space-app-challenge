---
paths:
  - 'server/**'
  - 'src/net/**'
  - '.github/workflows/**'
---

# Server, API and deploy

- Setup and secrets: `docs/SERVER.md`. Stack: Caddy + PocketBase 0.40.6 in Docker Compose on the VPS; GitHub Pages as backup.
- Schema changes only through a new file in `server/pb_migrations/` (`<unix-ts>_<what>.js`); never edit an applied migration.
- Collections stay anonymous: device id, language, app version, structured answers. No names, emails, free text
  from children, photos or voices. Read rules stay `null` (superuser only); create stays open for the game.
- The game must work with the API down: everything goes through `src/net/api.js` (outbox, background send).
- Never commit `server/.env`, keys, passwords or the PocketBase superuser. Secrets live in GitHub Actions secrets
  and in `/srv/hb7/.env` on the VPS.
- Do not change Caddy cache headers without reading docs/PERFORMANCE.md: `/bundle/*` is immutable, entry files are `no-cache`.
- Deploy is atomic (symlink `current`); keep it that way. Do not run `docker compose down -v` (it deletes data volumes).
