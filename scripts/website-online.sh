#!/usr/bin/env bash
# Website-first production path. Does not require Commas or GHL.
# Deploys to the live Vercel project, migrates Neon, bootstraps Owner password.
# Never prints secret values.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

need() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "ACTION_REQUIRED: missing $name"
    exit 2
  fi
}

LIVE_ORIGIN="https://temporary-prompt-oboe-st5fuuv.vercel.app"
PROJECT_NAME="${VERCEL_PROJECT_NAME:-temporary-prompt-oboe-st5fuuv}"

need VERCEL_TOKEN

if [[ -z "${AUTH_SECRET:-}" ]]; then
  AUTH_SECRET="$(openssl rand -base64 48)"
  export AUTH_SECRET
  printf '%s' "$AUTH_SECRET" > /tmp/gc_auth_secret.val
  echo "Generated AUTH_SECRET (value not printed)."
fi
if [[ -z "${GC_CRON_SECRET:-}" ]]; then
  GC_CRON_SECRET="$(openssl rand -base64 48)"
  export GC_CRON_SECRET
  printf '%s' "$GC_CRON_SECRET" > /tmp/gc_cron_secret.val
  echo "Generated GC_CRON_SECRET (value not printed)."
fi
export CRON_SECRET="${CRON_SECRET:-$GC_CRON_SECRET}"

if [[ -z "${OWNER_BOOTSTRAP_PASSWORD:-}" ]]; then
  OWNER_BOOTSTRAP_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=' | head -c 14)"
  OWNER_BOOTSTRAP_PASSWORD="GcOs!${OWNER_BOOTSTRAP_PASSWORD}9a"
  export OWNER_BOOTSTRAP_PASSWORD
  printf '%s' "$OWNER_BOOTSTRAP_PASSWORD" > /tmp/gc_owner_bootstrap.val
  echo "Generated OWNER_BOOTSTRAP_PASSWORD → /tmp/gc_owner_bootstrap.val (not printed)."
fi

if [[ "${GC_PERMANENT_HOST_READY:-}" == "1" ]]; then
  export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-https://os.grantandconsultants.com}"
else
  export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-$LIVE_ORIGIN}"
fi
export GC_DESKTOP_URL="${GC_DESKTOP_URL:-$NEXT_PUBLIC_APP_URL}"
export GC_DESKTOP_FALLBACK_URL="${GC_DESKTOP_FALLBACK_URL:-$LIVE_ORIGIN}"
export GC_ENV="${GC_ENV:-production}"
export E2E_OWNER_EMAIL="${E2E_OWNER_EMAIL:-owner@grantsandco.com}"
export E2E_OWNER_PASSWORD="${E2E_OWNER_PASSWORD:-$OWNER_BOOTSTRAP_PASSWORD}"

SCOPE_ARGS=()
if [[ -n "${VERCEL_ORG_ID:-}" ]]; then
  SCOPE_ARGS+=(--scope "$VERCEL_ORG_ID")
fi

echo "[1/7] Link Vercel project ${PROJECT_NAME}…"
npx vercel link --yes --project "$PROJECT_NAME" --token "$VERCEL_TOKEN" "${SCOPE_ARGS[@]}" || \
  npx vercel project add "$PROJECT_NAME" --token "$VERCEL_TOKEN" "${SCOPE_ARGS[@]}" || true

echo "[2/7] Pull production env…"
npx vercel env pull .env.vercel.production --environment=production --yes --token "$VERCEL_TOKEN" "${SCOPE_ARGS[@]}" || true
if [[ -z "${DATABASE_URL:-}" && -f .env.vercel.production ]]; then
  DATABASE_URL="$(rg -N '^DATABASE_URL=' .env.vercel.production | head -1 | cut -d= -f2- | sed 's/^"//;s/"$//')"
  export DATABASE_URL
fi

if [[ -z "${DATABASE_URL:-}" || ( "${DATABASE_URL}" != postgres* && "${DATABASE_URL}" != postgresql* ) ]]; then
  echo "ACTION_REQUIRED: Production DATABASE_URL must be Neon postgresql:// on project ${PROJECT_NAME}."
  exit 2
fi

upsert_env() {
  local key="$1"
  local val="$2"
  printf '%s' "$val" | npx vercel env add "$key" production --token "$VERCEL_TOKEN" "${SCOPE_ARGS[@]}" --force >/dev/null 2>&1 \
    || printf '%s' "$val" | npx vercel env add "$key" production --token "$VERCEL_TOKEN" "${SCOPE_ARGS[@]}" >/dev/null 2>&1 \
    || echo "WARN: could not upsert $key"
}

echo "[3/7] Upsert website env (values not echoed)…"
upsert_env NEXT_PUBLIC_APP_URL "$NEXT_PUBLIC_APP_URL"
upsert_env AUTH_SECRET "$AUTH_SECRET"
upsert_env GC_CRON_SECRET "$GC_CRON_SECRET"
upsert_env CRON_SECRET "$CRON_SECRET"
upsert_env GC_ENV production
upsert_env GC_DESKTOP_URL "$GC_DESKTOP_URL"
upsert_env GC_DESKTOP_FALLBACK_URL "$GC_DESKTOP_FALLBACK_URL"
upsert_env OWNER_BOOTSTRAP_PASSWORD "$OWNER_BOOTSTRAP_PASSWORD"
upsert_env OWNER_EMAIL "${OWNER_EMAIL:-owner@grantsandco.com}"
if [[ -n "${GC_PERMANENT_HOST_READY:-}" ]]; then
  upsert_env GC_PERMANENT_HOST_READY "$GC_PERMANENT_HOST_READY"
fi

echo "[4/7] Migrate production schema…"
bash scripts/migrate-production.sh

echo "[5/7] Deploy production…"
npx vercel pull --yes --environment=production --token "$VERCEL_TOKEN" "${SCOPE_ARGS[@]}"
npx vercel build --prod --token "$VERCEL_TOKEN"
DEPLOY_URL=$(npx vercel deploy --prebuilt --prod --token "$VERCEL_TOKEN" "${SCOPE_ARGS[@]}")
echo "Deployed: $DEPLOY_URL"

echo "[6/7] Bootstrap owner password on Neon…"
npx tsx scripts/owner-bootstrap.ts

echo "[7/7] Smoke ${NEXT_PUBLIC_APP_URL}…"
npx tsx scripts/production-smoke.ts

echo ""
echo "Website-online finished."
echo "LOGIN_URL: ${NEXT_PUBLIC_APP_URL}/login"
echo "Owner email: ${E2E_OWNER_EMAIL}"
echo "Owner password file: /tmp/gc_owner_bootstrap.val"
echo "Permanent host stays unused until GC_PERMANENT_HOST_READY=1 after Squarespace CNAME."
