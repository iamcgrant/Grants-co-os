# Production environment variables (exact names from repository code)

Do **not** invent alternate names. Values go in Cursor Secrets / Vercel Project env — never git.

## Required for production deploy + money path

| Name | Required by | Notes |
|------|-------------|-------|
| `VERCEL_TOKEN` | `scripts/deploy-production.sh` (BUILDX) | Optional in Cloud Agent when `GC_VERCEL_EXTERNAL=1` |
| `GC_VERCEL_EXTERNAL` | `scripts/launch-readiness.ts` | Set `1` when BUILDX owns Vercel/Neon/domain |
| `VERCEL_ORG_ID` | Vercel link (optional if default team) | From `.vercel/project.json` after first link, or team settings |
| `VERCEL_PROJECT_ID` | Vercel link (optional if linked) | `prj_7k6wvDk7P2NziRrcYsw2yUlSpwCx` (claimed project) |
| `DATABASE_URL` | Prisma (`prisma.config.ts`, `src/lib/db/prisma.ts`) | Neon/Supabase Postgres via Vercel Marketplace — `postgresql://…` |
| `NEXT_PUBLIC_APP_URL` | Payment links, webhooks, E2E | `https://os.grantandconsultants.com` |
| `PAYMENT_PROVIDER` | `src/lib/payments/provider.ts` | `mock` (manual Commas) is valid. Do not invent a key to force `commas`. |
| `GRANTS_PAY_INBOUND_WEBHOOK_SECRET` | `src/lib/payments/inbound-webhook.ts` | Optional Zapier/GHL mark-paid. Fail-closed when unset. |
| `COMMAS_API_KEY` | `src/lib/payments/commas-config.ts` | **Do not invent.** Fanbasis has no API Keys page. |
| `COMMAS_WEBHOOK_SECRET` | `src/lib/payments/commas-provider.ts` | Only if a real Commas webhook subscription exists |
| `AUTH_SECRET` | `src/lib/auth/session.ts` | Strong random; do not invent weak values |
| `GC_CRON_SECRET` | `src/app/api/automations/run/route.ts` | Vercel cron header |
| `GHL_API_KEY` | `src/lib/integrations/ghl/*` | Copy into Vercel Production |
| `GHL_LOCATION_ID` | `src/lib/integrations/ghl/location.ts` | Copy into Vercel Production |

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
| `TELEGRAM_BOT_TOKEN` | Yes for Team green | Bot token for in-OS Telegram team inbox |
| `TELEGRAM_TEAM_CHAT_IDS` | Optional | Comma-separated Simon / CS / disputes chat ids |

Outbound SMS/email also needs PIT **scopes** `conversations/message.write` (required) and `conversations.write` (recommended) on the existing key — not a new env var. Voice needs `phone-system.readonly` + `phone-system.voice`. Do not add Twilio/Telnyx.

## Desktop (public URLs only — never server secrets)

| Name | Purpose |
|------|---------|
| `GC_DESKTOP_URL` | Desktop webview origin (default `https://os.grantandconsultants.com`) |
| `GC_DESKTOP_MAC_URL` | Publish Mac installer link on `/downloads` |
| `GC_DESKTOP_WIN_URL` | Publish Windows installer link |
| `GC_DESKTOP_LINUX_URL` | Publish Linux installer link |
| `GC_DESKTOP_RELEASES_URL` | Optional releases index |

## SmartCredit (public join link — env, not hardcoded)

| Name | Required? | Production value |
|------|-----------|------------------|
| `SMARTCREDIT_SPONSOR_URL` | Yes for enroll attribution | `https://www.smartcredit.com/join/?pid=69411` |
| `SMARTCREDIT_SPONSOR_CODE` | Optional | Only if separate from the URL |
| `SMARTCREDIT_API_KEY` | Optional / unused today | No public score API. Key presence is never CONNECTED. |
| `SMARTCREDIT_API_PROBE_URL` | Optional / unused today | https GET only if a partner API appears |

Set `SMARTCREDIT_SPONSOR_URL` in Vercel Production (and preview if enroll is tested there). Runtime reads env only.

## Tax desks (optional until staff use them)

| Name | Required? | Notes |
|------|-----------|-------|
| `COGNITO_API_KEY` | Yes for Cognito submissions | Official Cognito Forms API. Never commit. Key presence is never CONNECTED. |
| Cloud Tax Office | No API key | Native `/tax/cloud-tax-office` desk. Official portal last-step only. No scrape. |
| SBTPG | No API key | Native `/tax/sbtpg` desk. Official portal last-step only. No scrape. |

## Not required to start production web (optional adapters)

`DISPUTEFOX_*`, `CRC_*`, `AUTHORIZE_NET_*`, `AGENT_HUB_*`, `CURSOR_API_KEY` (already present for Agent Hub / Cursor — not a Vercel runtime requirement for core OS). `SMARTCREDIT_SPONSOR_URL` is documented above.
