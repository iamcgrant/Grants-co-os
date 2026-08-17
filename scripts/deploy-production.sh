#!/usr/bin/env bash
# Production deploy helper for Grants & Co OS → Vercel + Postgres.
# Does not invent credentials. Fails closed with ACTION_REQUIRED when secrets missing.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

need() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "ACTION_REQUIRED: set $name as an environment secret, then re-run."
    exit 2
  fi
}

need VERCEL_TOKEN
need DATABASE_URL

if [[ "${DATABASE_URL}" != postgres* && "${DATABASE_URL}" != postgresql* ]]; then
  echo "ACTION_REQUIRED: DATABASE_URL must be a production postgresql:// connection string (not SQLite)."
  exit 2
fi

export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-https://os.grantsandco.com}"
export PAYMENT_PROVIDER="${PAYMENT_PROVIDER:-commas}"
export COMMAS_ENVIRONMENT="${COMMAS_ENVIRONMENT:-sandbox}"

if [[ -z "${AUTH_SECRET:-}" ]]; then
  echo "ACTION_REQUIRED: set AUTH_SECRET for production sessions."
  exit 2
fi

if [[ -z "${COMMAS_API_KEY:-}" ]]; then
  echo "ACTION_REQUIRED: set COMMAS_API_KEY before production money path."
  exit 2
fi

echo "Installing Vercel CLI deps if needed…"
npx vercel --version >/dev/null

echo "Linking / pulling project (non-interactive)…"
npx vercel pull --yes --environment=production --token "$VERCEL_TOKEN"

echo "Building…"
npx vercel build --prod --token "$VERCEL_TOKEN"

echo "Deploying production…"
URL=$(npx vercel deploy --prebuilt --prod --token "$VERCEL_TOKEN")
echo "Deployed: $URL"

echo "Setting critical env on Vercel project (idempotent)…"
# Note: vercel env add is interactive; prefer dashboard or vercel env for CI.
cat <<EOF
ACTION NEXT (if not already set in Vercel project env):
  NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
  DATABASE_URL=<postgres>
  AUTH_SECRET=<long random>
  PAYMENT_PROVIDER=commas
  COMMAS_API_KEY=<sandbox/prod>
  COMMAS_WEBHOOK_SECRET=<from webhook register>
  COMMAS_ENVIRONMENT=sandbox
  COMMAS_LIVE_CHARGES=false
  GHL_API_KEY / GHL_LOCATION_ID
  GC_CRON_SECRET=<random>
  Domain: os.grantsandco.com → Vercel

Then run:
  npx tsx scripts/commas-register-webhook.ts
  # apply Prisma migrations against production DATABASE_URL
  npm run test
  npx tsx scripts/production-e2e.ts
EOF
