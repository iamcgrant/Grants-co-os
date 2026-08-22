# GRANTS & CO OS — PRODUCTION HANDOFF

**Date:** 2026-08-18  
**Branch:** `cursor/grants-co-os-completion-30e7`  
**Repo:** `github.com/iamcgrant/Grants-co-os`  
**Permanent origin:** `https://os.grantandconsultants.com`

## LIVE URL

| Surface | Status |
|---------|--------|
| Permanent hostname | `https://os.grantandconsultants.com` (BUILDX attaches domain + Neon) |
| Claimed Vercel project | `temporary-prompt-oboe-st5fuuv` · `prj_7k6wvDk7P2NziRrcYsw2yUlSpwCx` |
| Current Vercel URL | https://temporary-prompt-oboe-st5fuuv.vercel.app |
| Public health | `GET /api/health` (needs Postgres `DATABASE_URL` on Vercel) |
| Owner system health | `/system-health` |
| Do not use | `grantsandco.com` / `os.grantsandco.com` (no public DNS) |

BUILDX owns Vercel token, Neon, env, and custom domain. See `docs/BUILDX_HANDOFF.md`.

## DESKTOP DOWNLOADS

| Platform | Status |
|----------|--------|
| Mac / Windows / Linux | Public unsigned assets on `desktop-v0.1.2` release |
| Code signing | Human Apple Developer ID + Windows Authenticode (later) |

See `docs/DESKTOP.md`. Defaults in `src/lib/desktop/downloads.ts` point at public GitHub release URLs.

## OWNER / STAFF ACCESS

| Role | Email |
|------|-------|
| OWNER | `owner@grantsandco.com` |
| CUSTOMER_SERVICE | `simon@grantsandco.com` |
| FILE_PREPARER | `jona@grantsandco.com` |

First-time Owner password: `npm run owner:setup-link` with `OWNER_SETUP_BASE_URL=https://os.grantandconsultants.com` after migrate. Never commit passwords.

## INTEGRATIONS

| System | Status |
|--------|--------|
| **Commas** | Adapter complete. BUILDX sets `COMMAS_API_KEY` + `PAYMENT_PROVIDER=commas` then `npm run commas:register-webhook` |
| **GHL inbound** | Live with current PIT |
| **GHL outbound** | Fail-closed until PIT has `conversations/message.write` |
| **DisputeFox** | Native `/setup` intake primary |
| **SmartCredit** | Native `/credit/smartcredit` workspace. Set `SMARTCREDIT_SPONSOR_URL=https://www.smartcredit.com/join/?pid=69411` in Vercel env (public join link, not hardcoded). Optional `SMARTCREDIT_API_KEY` + `SMARTCREDIT_API_PROBE_URL` if a partner API appears. CONNECTED only after a probe or recorded OS operation. |
| **Cloud Tax Office** | Native `/tax/cloud-tax-office` desk. No supported list API. Official portal last-step only. No scrape. |
| **Cognito Forms** | Native `/tax/cognito` submissions via official API. `COGNITO_API_KEY` in env, never commit. |
| **SBTPG** | Native `/tax/sbtpg` refund/payout tracker. Official portal last-step only. No scrape. |
| **Commas payment request** | Client 360 Pay tab creates/sends a payment request link. Honest health — key presence is never CONNECTED. |

## AUTOMATIONS

Payment request → pay → onboarding → Simon/Jona assignment, Friday Credit Pulse, exception tickets — implemented. Cron: `/api/automations/run` daily at `0 12 * * *` (noon UTC) via `vercel.json`.

## TEST / GATES

| Suite | Result |
|-------|--------|
| Vitest | `npm test` |
| `npm run launch:readiness` | 11 gates; `GC_VERCEL_EXTERNAL=1` satisfies Vercel gate when BUILDX owns deploy |
| `npm run smoke:production` | Against `NEXT_PUBLIC_APP_URL` after domain+DB |

## REMAINING (BUILDX / human — not Cloud Agent)

1. Neon `DATABASE_URL` on Vercel Production + backups  
2. Domain `os.grantandconsultants.com` + Squarespace CNAME from Vercel UI  
3. Env from `.env.production.example`  
4. Migrate + Owner setup link  
5. Commas key + webhook register  
6. GHL write scope (optional for first login)  
7. Desktop code-signing certs (optional)
