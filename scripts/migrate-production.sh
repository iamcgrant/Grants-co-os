#!/usr/bin/env bash
# Apply Grants & Co OS schema to production Postgres (Neon/Supabase via Vercel Marketplace).
# Safe for empty databases. Does not drop data (db push --accept-data-loss is NOT used).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ACTION_REQUIRED: DATABASE_URL must be set to a postgresql:// connection string."
  exit 2
fi

if [[ "${DATABASE_URL}" != postgres* && "${DATABASE_URL}" != postgresql* ]]; then
  echo "ACTION_REQUIRED: DATABASE_URL must be Postgres for production migrate."
  exit 2
fi

echo "Generating Prisma client (postgresql)…"
node scripts/prisma-generate.mjs

echo "Syncing schema to Postgres via prisma db push (no data-loss flag)…"
# Prisma 7 no longer accepts --skip-generate on db push; generate already ran above.
npx prisma db push --schema=prisma/schema.postgres.prisma

if [[ "${SEED_PRODUCTION:-}" == "true" ]]; then
  echo "SEED_PRODUCTION=true — running seed (owner/simon/jona). Rotate passwords after."
  npx tsx prisma/seed.ts
else
  echo "Skipping seed (set SEED_PRODUCTION=true to seed staff accounts on a fresh DB)."
fi

echo "Production schema sync complete."
