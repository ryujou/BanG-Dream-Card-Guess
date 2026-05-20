# Umami Self-host Deployment

This directory contains minimal deployment assets for self-hosted Umami.

## Files

- `docker-compose.yml`: Umami + PostgreSQL stack (bound to `127.0.0.1:${UMAMI_PORT}`)
- `.env.example`: environment template
- `deploy.sh`: pull and start stack
- `backup.sh`: PostgreSQL backup to `backups/`
- `restore.sh`: restore from a backup with explicit confirmation
- `Caddyfile.example`: example reverse proxy block for Caddy
- `nginx.conf.example`: example reverse proxy block for Nginx

## Quick Start

```bash
cd infra/umami
cp .env.example .env
# edit .env with strong POSTGRES_PASSWORD and APP_SECRET
bash deploy.sh
```

## Verify

```bash
docker compose ps
docker compose logs --tail=100 umami
curl -I http://127.0.0.1:3000
```

## Backup / Restore

```bash
bash backup.sh
bash restore.sh backups/umami_umami_YYYYMMDD_HHMMSS.sql.gz
```
