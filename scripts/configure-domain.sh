#!/usr/bin/env bash
# Add / inspect os.grantandconsultants.com on the linked Vercel project.
# Prints EXACT DNS records from Vercel — never guesses CNAME targets.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DOMAIN="${1:-os.grantandconsultants.com}"

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "ACTION_REQUIRED: set VERCEL_TOKEN, then re-run: npm run domain:configure"
  exit 2
fi

SCOPE_ARGS=()
if [[ -n "${VERCEL_ORG_ID:-}" ]]; then
  SCOPE_ARGS+=(--scope "$VERCEL_ORG_ID")
fi

if [[ ! -f .vercel/project.json ]]; then
  echo "Linking project first…"
  npx vercel link --yes --project "${VERCEL_PROJECT_NAME:-temporary-prompt-oboe-st5fuuv}" --token "$VERCEL_TOKEN" "${SCOPE_ARGS[@]}"
fi

echo "Adding domain ${DOMAIN} (idempotent)…"
npx vercel domains add "$DOMAIN" --token "$VERCEL_TOKEN" "${SCOPE_ARGS[@]}" 2>&1 || true

echo ""
echo "=== EXACT DNS RECORDS FROM VERCEL (apply at your registrar) ==="
npx vercel domains inspect "$DOMAIN" --token "$VERCEL_TOKEN" "${SCOPE_ARGS[@]}" 2>&1 || \
  npx vercel project inspect --token "$VERCEL_TOKEN" "${SCOPE_ARGS[@]}" 2>&1 || true

echo ""
echo "After DNS propagates: curl -fsS https://${DOMAIN}/api/health"
