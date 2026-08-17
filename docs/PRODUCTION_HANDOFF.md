# GRANTS & CO OS — PRODUCTION HANDOFF

**Date:** 2026-08-17  
**Branch:** `cursor/grants-co-os-completion-30e7`  
**Repo:** `github.com/iamcgrant/Grants-co-os`  
**Launch gate:** `npm run launch:readiness` → currently **NOT PRODUCTION-COMPLETE** (external secrets / DNS)

## LIVE URL

**Not live.** `os.grantsandco.com` does not resolve from this agent environment.

| Surface | Status |
|---------|--------|
| Cloud Agent localhost | `http://localhost:3000` (verified build + local E2E) |
| Public health | `GET /api/health` (local only until deploy) |
| Owner system health | `/system-health` |
| Target origin | `https://os.grantsandco.com` via `NEXT_PUBLIC_APP_URL` |

Deploy tooling ready: `Dockerfile`, `vercel.json`, `npm run deploy:production`, `docs/DEPLOYMENT.md`.

## DESKTOP DOWNLOADS

| Platform | Status |
|----------|--------|
| Linux AppImage + `.deb` | **Built** in this environment — see `/opt/cursor/artifacts/desktop/` + `SHA256SUMS.txt` |
| macOS `.dmg` | Blocked on Apple Developer ID + notarization (human) |
| Windows installer | Blocked on Authenticode / Trusted Signing cert (human) |

See `docs/DESKTOP.md`. Rebuild Linux: `npm run desktop:linux`.

## OWNER / STAFF ACCESS (dev seed — rotate before prod)

| Role | Email |
|------|-------|
| OWNER | `owner@grantsandco.com` |
| CUSTOMER_SERVICE | `simon@grantsandco.com` |
| FILE_PREPARER | `jona@grantsandco.com` |

Password: README seed only — **rotate before production**.

## INTEGRATIONS

| System | Status |
|--------|--------|
| **Commas** | Adapter complete (checkout + HMAC webhooks + refunds + payment requests). **BLOCKED:** `COMMAS_API_KEY`, `COMMAS_WEBHOOK_SECRET`, `PAYMENT_PROVIDER=commas` |
| **GHL inbound** | **Live** — contacts + conversations pull with current PIT |
| **GHL outbound SMS/MMS/email** | Adapter fail-closed. Live probe: `POST /conversations/messages` → **401** missing `conversations/message.write` |
| **GHL voice / browser dialer** | Adapter honest (`browserDialer: false`). Phone-system + voice-ai endpoints → **401** |
| **DisputeFox** | Native `/setup` intake primary; optional intake URL template |
| **SmartCredit** | Sponsor URL optional |

## AUTOMATIONS

| Flow | Status |
|------|--------|
| Payment request → link → email/SMS queue | Implemented (delivery provider-dependent) |
| Payment → onboarding token → Simon/Jona assign | Implemented |
| Intake completed → file prep | Implemented |
| Friday Credit Pulse | Scheduler + `/api/automations/run` |
| Exception tickets | On exhausted retries |

## TEST RESULTS

| Suite | Result |
|-------|--------|
| Vitest | Run `npm test` on this branch |
| Local `npm run e2e:production` | Harness ready; exits **NOT PRODUCTION-COMPLETE** while `PAYMENT_PROVIDER=mock` |
| `npm run launch:readiness` | Fail-closed gate for Commas + public HTTPS + Postgres + GHL write |
| `npm run build` | Production build verified previously on branch |
| Desktop Linux | AppImage + deb artifacts produced |

## REMAINING EXTERNAL BLOCKERS (human only)

1. **Commas** — sandbox API key + webhook secret → Cursor Secrets / Vercel env as `COMMAS_API_KEY`, `COMMAS_WEBHOOK_SECRET`; set `PAYMENT_PROVIDER=commas`, `COMMAS_ENVIRONMENT=sandbox`.
2. **Vercel + Postgres + DNS** — `VERCEL_TOKEN`, production `DATABASE_URL` (`postgresql://…`), enable backups, point `os.grantsandco.com`, set `NEXT_PUBLIC_APP_URL=https://os.grantsandco.com`, `AUTH_SECRET`, `GC_CRON_SECRET`.
3. **GHL Private Integration scopes** — add `conversations/message.write` (+ phone/voice scopes for dialer); replace/reissue PIT if needed.
4. **Desktop signing** — Apple Developer ID + Windows code-signing cert.
5. **Commas live charges** — only after sandbox QA: `COMMAS_LIVE_CHARGES=true`.

Do **not** declare PRODUCTION COMPLETE while any money path, public origin, or outbound comms path is mock / localhost / degraded / unverified.
