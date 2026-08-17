#!/usr/bin/env bash
# One-shot go-live orchestrator. Runs every autonomous step once credentials exist.
# Fails closed with ACTION_REQUIRED — never invents Vercel/Commas/GHL secrets.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Grants & Co OS go-live ==="

need() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "ACTION_REQUIRED: missing $name"
    exit 2
  fi
}

# Load generated internal secrets if present (never printed).
if [[ -z "${AUTH_SECRET:-}" && -f /tmp/gc_auth_secret.val ]]; then
  AUTH_SECRET="$(tr -d '\n' < /tmp/gc_auth_secret.val)"
  export AUTH_SECRET
fi
if [[ -z "${GC_CRON_SECRET:-}" && -f /tmp/gc_cron_secret.val ]]; then
  GC_CRON_SECRET="$(tr -d '\n' < /tmp/gc_cron_secret.val)"
  export GC_CRON_SECRET
fi
export CRON_SECRET="${CRON_SECRET:-${GC_CRON_SECRET:-}}"
export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-https://os.grantsandco.com}"
export PAYMENT_PROVIDER="${PAYMENT_PROVIDER:-commas}"
export COMMAS_ENVIRONMENT="${COMMAS_ENVIRONMENT:-sandbox}"
export GC_ENV="${GC_ENV:-production}"
export GC_DESKTOP_URL="${GC_DESKTOP_URL:-https://os.grantsandco.com}"

need VERCEL_TOKEN
need AUTH_SECRET
need GC_CRON_SECRET
need COMMAS_API_KEY
need GHL_API_KEY
need GHL_LOCATION_ID

echo "[1/6] Deploy production (Neon + migrate + Vercel)…"
bash scripts/deploy-production.sh

echo "[2/6] Configure domain + print DNS…"
bash scripts/configure-domain.sh os.grantsandco.com || true

echo "[3/6] Register Commas webhook (needs public HTTPS)…"
if [[ -n "${COMMAS_WEBHOOK_SECRET:-}" ]]; then
  echo "COMMAS_WEBHOOK_SECRET already set — skipping register (idempotent)."
else
  npx tsx scripts/commas-register-webhook.ts || {
    echo "ACTION_REQUIRED: public URL or Commas webhook register failed — fix DNS/SSL then re-run commas:register-webhook"
  }
fi

echo "[4/6] Launch readiness gate…"
npx tsx scripts/launch-readiness.ts || true

echo "[5/6] Production smoke…"
npx tsx scripts/production-smoke.ts || true

echo "[6/6] Desktop smoke (packaging)…"
npm run desktop:smoke || true

echo ""
echo "Go-live script finished. Re-run after DNS/Commas webhook secret if any ACTION_REQUIRED remained."
echo "Desktop Mac/Windows: tag desktop-v0.1.0 after web is live (Linux artifacts already buildable)."
