#!/usr/bin/env bash
# Production deploy for Grants & Co OS → Vercel + Neon (Marketplace) Postgres.
# Intended for BUILDX (owns VERCEL_TOKEN). Cloud Agent sets GC_VERCEL_EXTERNAL=1 instead.
# Does not invent credentials. Fails closed with ACTION_REQUIRED when secrets missing.
# Never prints secret values.
# Permanent hostname: os.grantandconsultants.com
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

export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-https://os.grantandconsultants.com}"
export PAYMENT_PROVIDER="${PAYMENT_PROVIDER:-commas}"
export COMMAS_ENVIRONMENT="${COMMAS_ENVIRONMENT:-sandbox}"
export COMMAS_LIVE_CHARGES="${COMMAS_LIVE_CHARGES:-false}"
export GC_ENV="${GC_ENV:-production}"

# Internal secrets: prefer env, else load from agent-generated files (never commit).
if [[ -z "${AUTH_SECRET:-}" && -f /tmp/gc_auth_secret.val ]]; then
  AUTH_SECRET="$(tr -d '\n' < /tmp/gc_auth_secret.val)"
  export AUTH_SECRET
fi
if [[ -z "${GC_CRON_SECRET:-}" && -f /tmp/gc_cron_secret.val ]]; then
  GC_CRON_SECRET="$(tr -d '\n' < /tmp/gc_cron_secret.val)"
  export GC_CRON_SECRET
fi

need AUTH_SECRET
need GC_CRON_SECRET
need COMMAS_API_KEY
need GHL_API_KEY
need GHL_LOCATION_ID

PROJECT_NAME="${VERCEL_PROJECT_NAME:-grants-co-os}"
SCOPE_ARGS=()
if [[ -n "${VERCEL_ORG_ID:-}" ]]; then
  SCOPE_ARGS+=(--scope "$VERCEL_ORG_ID")
fi

echo "Linking Vercel project ${PROJECT_NAME} to iamcgrant/Grants-co-os…"
npx vercel link --yes --project "$PROJECT_NAME" --token "$VERCEL_TOKEN" "${SCOPE_ARGS[@]}" || \
  npx vercel project add "$PROJECT_NAME" --token "$VERCEL_TOKEN" "${SCOPE_ARGS[@]}"

# Persist org/project ids if present after link
if [[ -f .vercel/project.json ]]; then
  echo "Linked project metadata written to .vercel/project.json (gitignored)."
fi

echo "Provisioning Neon Postgres via Vercel Marketplace (not discontinued Vercel Postgres)…"
if ! npx vercel integration list --token "$VERCEL_TOKEN" "${SCOPE_ARGS[@]}" 2>/dev/null | rg -qi 'neon|postgres'; then
  npx vercel install neon \
    --name grants-co-os-db \
    --plan free \
    -e production \
    -e preview \
    --token "$VERCEL_TOKEN" \
    "${SCOPE_ARGS[@]}" \
    --yes || {
      echo "ACTION_REQUIRED: Neon Marketplace install needs Vercel account terms acceptance or plan selection in the dashboard."
      echo "Open: https://vercel.com/marketplace/neon — Install → connect to project ${PROJECT_NAME} → enable backups."
      exit 2
    }
fi

echo "Pulling production env (includes DATABASE_URL from Neon when connected)…"
npx vercel env pull .env.vercel.production --environment=production --yes --token "$VERCEL_TOKEN" "${SCOPE_ARGS[@]}" || true

if [[ -f .env.vercel.production ]]; then
  # shellcheck disable=SC1091
  set -a
  # Only import DATABASE_URL from pulled file if not already set
  if [[ -z "${DATABASE_URL:-}" ]]; then
    DATABASE_URL="$(rg -N '^DATABASE_URL=' .env.vercel.production | head -1 | cut -d= -f2- | sed 's/^"//;s/"$//')"
    export DATABASE_URL
  fi
  set +a
fi

if [[ -z "${DATABASE_URL:-}" || ( "${DATABASE_URL}" != postgres* && "${DATABASE_URL}" != postgresql* ) ]]; then
  echo "ACTION_REQUIRED: DATABASE_URL missing after Neon install. Connect Neon to the project in Vercel Storage, enable automated backups, then re-run."
  exit 2
fi

upsert_env() {
  local key="$1"
  local val="$2"
  local env_target="${3:-production}"
  # vercel env add is interactive; use API-style stdin trick
  printf '%s' "$val" | npx vercel env add "$key" "$env_target" --token "$VERCEL_TOKEN" "${SCOPE_ARGS[@]}" --force 2>/dev/null \
    || printf '%s' "$val" | npx vercel env add "$key" "$env_target" --token "$VERCEL_TOKEN" "${SCOPE_ARGS[@]}" 2>/dev/null \
    || echo "WARN: could not upsert $key via CLI — set it in Vercel Project → Settings → Environment Variables"
}

echo "Upserting required production env vars (values not echoed)…"
upsert_env NEXT_PUBLIC_APP_URL "$NEXT_PUBLIC_APP_URL"
upsert_env PAYMENT_PROVIDER "$PAYMENT_PROVIDER"
upsert_env COMMAS_ENVIRONMENT "$COMMAS_ENVIRONMENT"
upsert_env COMMAS_LIVE_CHARGES "$COMMAS_LIVE_CHARGES"
upsert_env AUTH_SECRET "$AUTH_SECRET"
upsert_env GC_CRON_SECRET "$GC_CRON_SECRET"
upsert_env CRON_SECRET "${CRON_SECRET:-$GC_CRON_SECRET}"
upsert_env GC_ENV production
upsert_env GC_DESKTOP_URL "${GC_DESKTOP_URL:-$NEXT_PUBLIC_APP_URL}"
upsert_env COMMAS_API_KEY "$COMMAS_API_KEY"
upsert_env GHL_API_KEY "$GHL_API_KEY"
upsert_env GHL_LOCATION_ID "$GHL_LOCATION_ID"
if [[ -n "${COMMAS_WEBHOOK_SECRET:-}" ]]; then
  upsert_env COMMAS_WEBHOOK_SECRET "$COMMAS_WEBHOOK_SECRET"
fi
if [[ -n "${COMMAS_CREATOR_HANDLE:-}" ]]; then
  upsert_env COMMAS_CREATOR_HANDLE "$COMMAS_CREATOR_HANDLE"
fi

echo "Running production schema migrate…"
bash scripts/migrate-production.sh

echo "Building & deploying production…"
npx vercel pull --yes --environment=production --token "$VERCEL_TOKEN" "${SCOPE_ARGS[@]}"
npx vercel build --prod --token "$VERCEL_TOKEN"
URL=$(npx vercel deploy --prebuilt --prod --token "$VERCEL_TOKEN" "${SCOPE_ARGS[@]}")
echo "Deployed: $URL"

echo "Adding domain os.grantandconsultants.com…"
DOMAIN_OUT=$(npx vercel domains add os.grantandconsultants.com --token "$VERCEL_TOKEN" "${SCOPE_ARGS[@]}" 2>&1 || true)
echo "$DOMAIN_OUT"
INSPECT=$(npx vercel domains inspect os.grantandconsultants.com --token "$VERCEL_TOKEN" "${SCOPE_ARGS[@]}" 2>&1 || true)
echo "$INSPECT"
echo "ACTION_REQUIRED (DNS): apply the EXACT records printed above from Vercel (do not guess CNAME targets)."

echo "Done. Next: npm run commas:register-webhook with NEXT_PUBLIC_APP_URL=https://os.grantandconsultants.com"
echo "Then smoke-test https://os.grantandconsultants.com/api/health"
