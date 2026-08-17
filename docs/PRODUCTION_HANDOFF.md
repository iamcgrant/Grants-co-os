# GRANTS & CO OS — PRODUCTION HANDOFF

**Date:** 2026-08-17  
**Branch:** `cursor/grants-co-os-completion-30e7`  
**Repo:** `github.com/iamcgrant/Grants-co-os`

## LIVE URL

Not yet published to a public production host from this agent run.

- Local / Cloud Agent: `http://localhost:3000` (production `npm run start` verified)
- Public health: `GET /api/health`
- Owner system health: `/system-health`
- Target production origin (configure DNS + host): `https://os.grantsandco.com` via `NEXT_PUBLIC_APP_URL` / `GC_DESKTOP_URL`

Deploy artifacts ready in-repo: `Dockerfile`, `vercel.json` (cron), `docs/DEPLOYMENT.md`.

## DESKTOP DOWNLOADS

Packaging scaffold: `/desktop` (Tauri 2).

| Platform | Status |
|----------|--------|
| macOS | Build on macOS with Rust + `cd desktop && npm run build` → `.dmg` |
| Windows | Build on Windows → NSIS installer |
| Linux | Build on Linux → AppImage + `.deb` |

See `docs/DESKTOP.md`. Installers are not produced inside this Linux Cloud Agent (no full Tauri cross-compile toolchain). Auto-updater endpoints are wired in `tauri.conf.json` (pubkey must be replaced before public release).

## OWNER ACCESS

| Field | Value |
|-------|-------|
| Email | `owner@grantsandco.com` |
| Password | Dev seed only: see README (rotate before production) |
| Role | OWNER — full command center |

## SIMON ACCESS

| Field | Value |
|-------|-------|
| Email | `simon@grantsandco.com` |
| Role | CUSTOMER_SERVICE — Client Care home, inbox, tasks, credit |

## JONA ACCESS

| Field | Value |
|-------|-------|
| Email | `jona@grantsandco.com` |
| Role | FILE_PREPARER — File queues / disputes view |

## INTEGRATIONS

| System | Status |
|--------|--------|
| **Commas** | Primary adapter implemented (hosted `payment_link` + HMAC webhooks + refunds). **ACTION REQUIRED:** add `COMMAS_API_KEY` (+ webhook secret) in Cursor Secrets / host. Live charges locked (`COMMAS_LIVE_CHARGES`). |
| **GHL** | Live inbound contacts + conversations when `GHL_API_KEY` present (configured in this environment). Outbound SMS/email/voice still require provider write scopes / telephony adapter. |
| **DisputeFox** | Local roster attach + native `/setup` intake primary. Live API + `DISPUTEFOX_INTAKE_URL_TEMPLATE` optional fallback. |
| **SmartCredit** | Sponsor enrollment helper; add `SMARTCREDIT_SPONSOR_URL`. Score path mock until partner API. |
| **Credit Karma** | Client-assisted secure entry architecture (no scraping / MFA bypass). |
| **Voice** | ACTION REQUIRED — LeadConnector/GHL browser voice session not exposed; adapter pending provider capability. |
| **SMS / MMS** | Inbound via GHL conversation pull; outbound delivery adapter records intent until send scopes. |
| **iMessage** | Only if provider supports — marked degraded until configured. |
| **Email** | Intent queue for payment links; provider wire-up pending. |

## AUTOMATIONS

| Flow | Status |
|------|--------|
| Payment request → link → email/SMS queue | Implemented |
| Payment completed → onboarding token → staff assign (Simon/Jona) | Implemented |
| Intake completed → file prep routing | Implemented |
| Friday Credit Pulse | Scheduler in `instrumentation.ts` (Friday 14:00 UTC) + `POST /api/automations/run` |
| Invoice reminders / missing docs | Queue kinds ready; delivery provider-dependent |
| Exception tickets | Created on exhausted automation retries |

## TEST RESULTS

| Suite | Result |
|-------|--------|
| Unit / integration (Vitest) | **143 / 143 passed** |
| Commas lifecycle + webhook idempotency | Passed |
| System health + universal search | Passed |
| Production `npm run build` | Passed |
| Smoke: login, payment request, mock charge, search, automations drain, pages | Passed |
| Security | No raw card storage; webhook HMAC; secrets not logged; RBAC on finance/health |
| Desktop | Scaffold ready; native binaries need host build |
| Mobile | Responsive staff shell + luxury pay/setup pages (PWA retained) |

## SYSTEM HEALTH

| Component | Notes |
|-----------|-------|
| Database | Connected (SQLite local; Postgres for production) |
| Backups | ACTION REQUIRED on production Postgres host |
| Queues | Automation drain every 30s |
| Scheduled jobs | Friday pulse window + Vercel cron path |
| Webhooks | `/api/webhooks/payments` money application + idempotency |

## REMAINING EXTERNAL BLOCKERS

Only provider-side / human-required:

1. **Commas dashboard** — create sandbox API key + webhook subscription → store `COMMAS_API_KEY`, `COMMAS_WEBHOOK_SECRET` (requested via environment setup actions).
2. **Production host + domain HTTPS** — DNS, secrets vault, Postgres URL (cannot be invented by the agent).
3. **Commas live charges** — requires explicit `COMMAS_LIVE_CHARGES=true` after sandbox validation.
4. **Telephony / outbound messaging scopes** — GHL/LeadConnector must expose browser voice + conversation write scopes; MFA/provider agreements if any.
5. **Desktop signing certificates** — Apple/Windows code signing for public installers.
6. **DisputeFox intake URL template** — optional fallback; native setup works without it.
7. **SmartCredit sponsor URL** — for affiliate attribution.

Do not list agent-completable work here — payment domain, intake, automations, health, search, desktop scaffold, Docker, and tests are in this branch.
