#!/usr/bin/env bash
# Vercel production build: sync Postgres schema before Next build.
# Uses existing migrate-production.sh (prisma db push). No application logic changes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

url="${DATABASE_URL:-}"
if [[ "$url" == postgres* || "$url" == postgresql* ]]; then
  echo "[vercel-build] Production Postgres detected — running schema sync…"
  bash scripts/migrate-production.sh
else
  echo "[vercel-build] Non-Postgres DATABASE_URL — skipping production schema sync."
fi

npm run build
