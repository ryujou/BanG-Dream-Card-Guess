#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -f .env ]]; then
  echo ".env not found in $SCRIPT_DIR"
  exit 1
fi

mkdir -p backups

# shellcheck disable=SC1091
source .env

BACKUP_FILE="backups/umami_${POSTGRES_DB}_$(date +%Y%m%d_%H%M%S).sql.gz"

echo "Creating backup: $BACKUP_FILE"
docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip -c > "$BACKUP_FILE"
echo "Backup completed: $BACKUP_FILE"
