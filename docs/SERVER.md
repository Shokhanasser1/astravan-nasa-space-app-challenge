# Server (VPS) and deployment

> **The game itself needs no server.** The VPS only serves the static build (Caddy). PocketBase is optional and
> switched off (`features.sendResults = false`): the pitch promises that nothing about children leaves the device.
> Turn it on only if the whole team changes that answer.

```
players ──HTTPS──► Caddy (VPS, :443, HTTP/2 + HTTP/3, zstd/gzip)
                     ├── /            static game from /srv/hb7/site/current  (atomic symlink switch)
                     ├── /api/*  ──►  PocketBase :8090 (SQLite in /srv/hb7/pb_data)
                     └── /_/*    ──►  PocketBase admin UI
backup links:  GitHub Pages (every push)  ·  Cloudflare Pages (frozen copy before submitting)
```

Everything runs in Docker Compose (`server/docker-compose.yml`): `caddy:2-alpine` and PocketBase 0.40.6 built
from the official release binary. The game itself needs no server: if the VPS is down, the Pages link works.
(The device outbox exists only if `sendResults` is ever turned on; for the hackathon it is off.)

## Database on your laptop (start here)

```bash
npm run db          # terminal 1: downloads PocketBase 0.40.6 once (SHA-256 checked), applies server/pb_migrations
npm run db -- superuser upsert you@example.org <password>   # once: admin login for http://127.0.0.1:8090/_/
npm run db:smoke    # terminal 2: health, create works, reading is forbidden, bad records rejected
npm run dev         # the game; /api is proxied to the local database
```

Data lives in `.pocketbase/data` (git-ignored). To change the schema, edit collections in the local admin UI:
PocketBase writes a new migration file into `server/pb_migrations/` (automigrate). Review and commit it; the VPS
applies it on the next deploy (automigrate is off there, so the server schema comes only from git).

## One-time setup (≈10 minutes)

1. **Deploy key** (on your computer): `ssh-keygen -t ed25519 -f hb7_deploy -N ""` → `hb7_deploy` (private)
   and `hb7_deploy.pub` (public).
2. **VPS** (Ubuntu/Debian, as root): copy `server/setup.sh` there and run
   `sudo bash setup.sh "$(cat hb7_deploy.pub)"`. It installs Docker, rsync, ufw (22, 80, 443), creates user
   `deploy` and `/srv/hb7`.
3. **Domain**: an A record to the VPS IP. No domain: use `<ip-with-dashes>.sslip.io` (e.g. `203-0-113-7.sslip.io`);
   Caddy still gets a real HTTPS certificate.
4. **`/srv/hb7/.env`** (owner `deploy`) from `server/.env.example`: `DOMAIN`, `ACME_EMAIL`, `PB_ORIGINS`.
5. **GitHub** (repo Settings → Secrets and variables → Actions):
   - secrets: `SSH_HOST` (IP or domain), `SSH_KEY` (contents of `hb7_deploy`), optional `SSH_USER` (default
     `deploy`), `SSH_PORT` (default 22), `SSH_KNOWN_HOSTS` (output of `ssh-keyscan <host>`; without it CI trusts
     the key on first connect)
   - variable: `API_URL` = `https://<DOMAIN>` (the game sends results there; also used for the CI health check)
   With `gh`: `gh secret set SSH_HOST -b <ip>`, `gh secret set SSH_KEY < hb7_deploy`, `gh variable set API_URL -b https://<domain>`.
6. Push to `main` (or run the workflow by hand). CI builds, uploads the release, switches `current`, starts
   the containers and waits for `/api/health`.
7. **PocketBase superuser** (once, on the VPS):
   `cd /srv/hb7 && docker compose exec pocketbase /pb/pocketbase superuser upsert <email> <password>`,
   then open `https://<DOMAIN>/_/`.

## Daily use

- Every push to `main` deploys to both the VPS and Pages. Releases are kept in `/srv/hb7/site/releases/` (last 10).
- **Rollback**: `cd /srv/hb7/site && ln -sfn releases/<older-sha> current.new && mv -Tf current.new current`
  (no restart needed).
- **Logs**: `docker compose logs -f caddy` / `pocketbase`. Health: `https://<DOMAIN>/api/health`.
- **Backups**: PocketBase admin → Settings → Backups (create one before judging), or copy `/srv/hb7/pb_data`.
- **Results**: none for the hackathon (`sendResults = false`). The "before → after" number from the kids' trial is
  counted on the device and written down by hand (`submission-check`). The collections below are dormant.

## Data rules (dormant — apply only if the team turns `sendResults` on)

- Collections are created by migrations in `server/pb_migrations/` only (admin schema controls are hidden).
- Anyone may create records (the game posts without login); nobody but the superuser can read them.
- Records are anonymous: random device id, language, app version, structured answers. No names, no free text
  typed by children, no photos or voices.
- Rate limit is generous (600 creates/min per IP): a whole class may play behind one school IP.

## What is verified

- 2026-11-14: migrations applied on PocketBase 0.40.6 (Windows, `npm run db`); `npm run db:smoke` passed 7/7
  (health, create playtest and run, guests get 403 on list, invalid records get 400).
- Not run yet: the Docker Compose stack and Caddy on the VPS. After the first deploy run
  `npm run db:smoke -- https://<DOMAIN>` and check `docker compose logs pocketbase`.
