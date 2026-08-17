# Production environment variables (exact names from repository code)

Do **not** invent alternate names. Values go in Cursor Secrets / Vercel Project env — never git.

## Required for production deploy + money path

| Name | Required by | Notes |
|------|-------------|-------|
| `VERCEL_TOKEN` | `scripts/deploy-production.sh` | Create at https://vercel.com/account/tokens |
| `VERCEL_ORG_ID` | Vercel link (optional if default team) | From `.vercel/project.json` after first link, or team settings |
| `VERCEL_PROJECT_ID` | Vercel link (optional if linked) | Written by `vercel link` |
| `DATABASE_URL` | Prisma (`prisma.config.ts`, `src/lib/db/prisma.ts`) | Neon/Supabase Postgres via Vercel Marketplace — `postgresql://…` |
| `NEXT_PUBLIC_APP_URL` | Payment links, webhooks, E2E | `https://os.grantsandco.com` |
| `PAYMENT_PROVIDER` | `src/lib/payments/provider.ts` | `commas` |
| `COMMAS_API_KEY` | `src/lib/payments/commas-config.ts` | Commas / Fanbasis dashboard (sandbox first) |
| `COMMAS_WEBHOOK_SECRET` | `src/lib/payments/commas-provider.ts` | Issued once by `npm run commas:register-webhook` |
| `AUTH_SECRET` | `src/lib/auth/session.ts` | Agent can generate; do not invent weak values |
| `GC_CRON_SECRET` | `src/app/api/automations/run/route.ts` | Agent can generate; Vercel cron header |
| `GHL_API_KEY` | `src/lib/integrations/ghl/*` | **Already in Cursor env** — do not re-request unless invalid |
| `GHL_LOCATION_ID` | `src/lib/integrations/ghl/location.ts` | **Already in Cursor env** |

## Commas (exact optional names in code)

| Name | Required? | Default / behavior |
|------|-----------|-------------------|
| `COMMAS_ENVIRONMENT` | Optional | `sandbox` unless set to `production` |
| `COMMAS_LIVE_CHARGES` | Optional | Must be `true` to charge live; keep `false` until approved |
| `COMMAS_CREATOR_HANDLE` | Optional | Creator handle when API requires it |

## GHL (exact names in code — beyond the two already present)

| Name | Required for production OS? | Notes |
|------|----------------------------|-------|
| `GHL_API_KEY` | Yes (present) | |
| `GHL_LOCATION_ID` | Yes (present) | |
| `GHL_LOGIN_EMAIL` | No | Staff-portal scaffolding only |
| `GHL_LOGIN_PASSWORD` | No | Staff-portal scaffolding only |

Outbound SMS/email also needs PIT **scope** `conversations/message.write` on the existing key (not a new env var name).

## Desktop (public URLs only — never server secrets)

| Name | Purpose |
|------|---------|
| `GC_DESKTOP_URL` | Desktop webview origin (default `https://os.grantsandco.com`) |
| `GC_DESKTOP_MAC_URL` | Publish Mac installer link on `/downloads` |
| `GC_DESKTOP_WIN_URL` | Publish Windows installer link |
| `GC_DESKTOP_LINUX_URL` | Publish Linux installer link |
| `GC_DESKTOP_RELEASES_URL` | Optional releases index |

## Not required to start production web (optional adapters)

`DISPUTEFOX_*`, `SMARTCREDIT_*`, `CRC_*`, `AUTHORIZE_NET_*`, `AGENT_HUB_*`, `CURSOR_API_KEY` (already present for Agent Hub / Cursor — not a Vercel runtime requirement for core OS).
