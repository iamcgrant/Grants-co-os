#!/usr/bin/env bash
# Attach os.grantandconsultants.com to the LIVE Vercel project and print
# the exact Squarespace CNAME. Does not guess the target.
# Vercel email 2026-08-18 attached this domain to empty project grants-co-os
# (DEPLOYMENT_NOT_FOUND). Everyday app is temporary-prompt-oboe-st5fuuv.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DOMAIN="${1:-os.grantandconsultants.com}"
PROJECT_NAME="${VERCEL_PROJECT_NAME:-temporary-prompt-oboe-st5fuuv}"

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "ACTION_REQUIRED: missing VERCEL_TOKEN — cannot attach ${DOMAIN} or read the exact CNAME."
  exit 2
fi

SCOPE_ARGS=()
if [[ -n "${VERCEL_ORG_ID:-}" ]]; then
  SCOPE_ARGS+=(--scope "$VERCEL_ORG_ID")
fi

echo "Linking ${PROJECT_NAME}…"
npx vercel link --yes --project "$PROJECT_NAME" --token "$VERCEL_TOKEN" "${SCOPE_ARGS[@]}" || true

echo "Adding ${DOMAIN} to ${PROJECT_NAME} (idempotent)…"
npx vercel domains add "$DOMAIN" --token "$VERCEL_TOKEN" "${SCOPE_ARGS[@]}" 2>&1 || true

echo ""
echo "=== EXACT DNS FROM VERCEL — paste into Squarespace DNS ==="
echo "Type: CNAME"
echo "Host: os"
npx vercel domains inspect "$DOMAIN" --token "$VERCEL_TOKEN" "${SCOPE_ARGS[@]}" 2>&1 || true
echo ""
echo "After Squarespace Save: dig +short ${DOMAIN} CNAME"
echo "Then: curl -fsS https://${DOMAIN}/api/health"
