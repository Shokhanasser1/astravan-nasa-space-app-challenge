#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu/Debian VPS for the game. Run as root:
#   sudo bash setup.sh "ssh-ed25519 AAAA... github-actions-deploy"
# Installs Docker, rsync and a firewall, creates the `deploy` user that CI logs in as,
# and prepares /srv/hb7. Safe to run twice.
set -euo pipefail

DEPLOY_KEY="${1:-}"
APP_DIR=/srv/hb7

if [[ $EUID -ne 0 ]]; then echo "Run as root (sudo)." >&2; exit 1; fi

apt-get update -y
apt-get install -y ca-certificates curl rsync ufw

if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

id deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash deploy
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
if [[ -n "$DEPLOY_KEY" ]]; then
  touch /home/deploy/.ssh/authorized_keys
  grep -qxF "$DEPLOY_KEY" /home/deploy/.ssh/authorized_keys || echo "$DEPLOY_KEY" >> /home/deploy/.ssh/authorized_keys
  chown deploy:deploy /home/deploy/.ssh/authorized_keys
  chmod 600 /home/deploy/.ssh/authorized_keys
fi

install -d -o deploy -g deploy "$APP_DIR" "$APP_DIR/site/releases" "$APP_DIR/pb_data" "$APP_DIR/pb_migrations"

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

echo
echo "Done. Next:"
echo "  1. Create $APP_DIR/.env from server/.env.example (DOMAIN, ACME_EMAIL, PB_ORIGINS), owner deploy."
echo "  2. Point the domain's A record to this server (or use <ip-with-dashes>.sslip.io)."
echo "  3. Add the GitHub secrets from docs/SERVER.md and push to main."
