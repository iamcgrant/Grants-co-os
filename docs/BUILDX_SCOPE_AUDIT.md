# BUILDX scope audit — `main` @ `417c788`

**Mode:** inventory only. No features implemented in this file’s PR.  
**Commit:** `417c788` — *Grants & Co OS — production core + launch tooling (not live yet) (#17)*  
**Do not treat a health card `CONNECTED` as working.**

Status key:

| Status | Meaning |
|--------|---------|
| **EXISTS-WORKING** | Code path is real and used for its stated scope (may still need secrets) |
| **EXISTS-SCAFFOLD** | Types/UI/adapter exist; live capability is incomplete or mocked |
| **MISSING** | No implementation |
| **OWNER-PERMISSION** | Blocked on Charles / credential / PIT scope / dashboard click — not an app-code gap |

`AGENTS.md` is **MISSING** in this repo. Sources used: `docs/INTEGRATIONS.md`, `docs/PAYMENTS.md`, `docs/BUILDX_HANDOFF.md`, `docs/PRODUCTION_ENV.md`, `docs/ACTION_REQUIRED.md`, `docs/PRODUCTION_HANDOFF.md`, plus adapters, health, Prisma, nav, webhooks, env examples.

`docs/OWNER_HANDOFF.md` is **stale** (still says Authorize.Net preferred primary, GHL live sync not started). Prefer `INTEGRATIONS.md` / `PAYMENTS.md` / `BUILDX_HANDOFF.md`.

---

## Outside the repo (BUILDX-reported; not re-verified here)

These are **not** in git. In-repo handoff still names Vercel project `temporary-prompt-oboe-st5fuuv` / `prj_7k6wvDk7P2NziRrcYsw2yUlSpwCx`.

| Item | Reported state |
|------|----------------|
| Vercel project | `grants-co-os` |
| Neon | `neon-green-battery` |
| `DATABASE_URL` | set on Vercel Production |
| `NEXT_PUBLIC_APP_URL` | `https://os.grantandconsultants.com` |
| `GC_VERCEL_EXTERNAL` | `1` |
| Custom domain | pending Squarespace CNAME for host `os` |

Charles / BUILDX still owns: Squarespace CNAME, Neon backups, Commas key + webhook register, GHL PIT write/voice scopes, Owner setup password.

---

## Scope score

### 1. GHL / LeadConnector

| Capability | Status | Files | Real limitation |
|------------|--------|-------|-----------------|
| Client comms timeline | **EXISTS-WORKING** | `src/lib/communications/service.ts`, `src/lib/integrations/ghl/conversations.ts`, `src/app/(staff)/inbox/page.tsx`, `src/app/(staff)/clients/[id]/page.tsx` | Pull → OS `CLIENT` conversation, `deliveryStatus=RECORDED`. Client 360 **Comms** shows last 12 messages. **Timeline** tab is events, not a per-message log. Dossier copy is stale: “GHL message pull not enabled in this slice”. No realtime — pull only. |
| Inbound SMS | **EXISTS-WORKING** | `conversations.ts`, `src/lib/integrations/ghl/http.ts`, `src/app/api/integrations/ghl/conversations/sync/route.ts` | Linked masters only. Needs PIT `conversations.readonly` + `conversations/message.readonly`. Fail-closed without `GHL_API_KEY`. Inbound HTTP client hard-locks writes (`GHL_MESSAGE_WRITES_ENABLED = false`). |
| Outbound SMS | **EXISTS-SCAFFOLD** + **OWNER-PERMISSION** | `src/lib/integrations/ghl/outbound.ts`, `src/lib/communications/service.ts`, `src/app/api/inbox/messages/route.ts` | Live probe: `POST /conversations/messages` → **401** “token is not authorized for this scope.” Required PIT: `conversations/message.write` (recommended `conversations.write`). Fail-closed: `FAILED` + `ACTION_REQUIRED`, never pretends `SENT`. Inbox compose hardcodes `channel: "SMS"`. |
| Outbound MMS | **MISSING** | — | `OutboundChannel = "SMS" \| "Email"` only. Docs mention MMS-shaped probe 401; no send implementation. |
| Email inbound | **EXISTS-WORKING** | `conversations.ts` | Same pull; `EMAIL` mapped. |
| Email outbound | **EXISTS-SCAFFOLD** + **OWNER-PERMISSION** | `outbound.ts`, `src/lib/automations/engine.ts` | Same 401 / write scope. No SendGrid or other ESP. |
| Voice / dialer | **EXISTS-SCAFFOLD** | `src/lib/communications/telephony.ts` | `browserDialer: false`. `startOutboundSession` always `{ ok: false }`. Docs: phone-system / voice-ai GETs **401**. Softphone stays outside OS. `inboundScreenPop: true` is aspirational — **no GHL voice webhook**. |
| Call recordings / voicemail | **EXISTS-SCAFFOLD** (text) / **MISSING** (media) | `telephony.ts`, `conversations.ts` | Caps: `recordings: false`, `voicemail: false`. `VOICEMAIL` / `CALL` import as text only. `attachments` typed, never fetched. |
| Second phone provider | **MISSING** (by design) | — | Zero Twilio / Telnyx / Plivo. Sole adapter: `LeadConnectorTelephonyAdapter`. |

---

### 2. DisputeFox client credit/dispute workspace

**EXISTS-SCAFFOLD** (partial OS tracking) — **not** an in-OS DisputeFox workspace.

| Piece | Status | Files | Limitation |
|-------|--------|-------|------------|
| Client 360 Disputes tab | **EXISTS-SCAFFOLD** | `src/app/(staff)/clients/[id]/page.tsx` | Renders `DisputeRound` rows + **new-tab** `https://app.disputefox.com/`. Empty → “Awaiting Integration”. |
| `DisputeRound` schema | **EXISTS-WORKING** | `prisma/schema.prisma` | Round status, counts, dates. |
| Local 26-master attach | **EXISTS-WORKING** | `src/lib/integrations/disputefox/roster.ts`, `sync.ts` | No invented DF IDs. Existing masters only. |
| Live list/get | **EXISTS-SCAFFOLD** | `http.ts`, `sync.ts` | `DISPUTEFOX_LIVE_LIST_ENABLED = false`. Without `DISPUTEFOX_API_KEY`: fail-closed. Zap `374413762` stays **OFF**. |
| Embedded workspace / iframe | **MISSING** | — | Link + local rounds only. |
| Intake URL | **EXISTS-SCAFFOLD** | `src/lib/payments/post-payment.ts` | Fallback when `DISPUTEFOX_INTAKE_URL_TEMPLATE` set. Native `/setup` is primary. |

---

### 3. SmartCredit scaffold + sponsor URL

| Piece | Status | Files | Limitation |
|-------|--------|-------|------------|
| Sponsor URL builder | **EXISTS-WORKING** (config) | `src/lib/credit/smartcredit-sponsor.ts` | Preserves `pid`; appends `gc_ref`. Env: `SMARTCREDIT_SPONSOR_URL`, `SMARTCREDIT_SPONSOR_CODE`. |
| `MockSmartCreditProvider` | **EXISTS-SCAFFOLD** | `src/lib/credit/pulse.ts` | Deterministic mock scores / fake `externalId`. |
| Enroll API | **EXISTS-SCAFFOLD** | `src/app/api/credit/smartcredit/enroll/route.ts` | Returns sponsor URL; no live SmartCredit HTTP. |
| Staff/client enroll UI | **MISSING** | setup dropdown only | `/setup/[token]` preference; no button wired to enroll API. |
| Health “CONNECTED” | **Misleading** | `src/lib/system/health.ts` | Means sponsor URL/code **present**, not live score sync. |

---

### 4. Credit Karma — client-assisted only

**Must stay that way. Architecture is correct; UI is not built.**

| Piece | Status | Files | Limitation |
|-------|--------|-------|------------|
| Read-only connector | **EXISTS-WORKING** (contract) | `src/lib/credit/pulse.ts`, `docs/CREDIT-PULSE.md` | `readOnly: true`. “Never apply for credit, click offers, file disputes, or alter settings.” |
| Scrape / portal automation | **MISSING** (correct) | `health.ts` | “Client-assisted secure score entry — no unsupported scraping.” |
| Client-assisted score entry UI/API | **MISSING** | — | Health claims it; `docs/ROADMAP.md` “client-assisted CK fallback”; no form. Setup option label only. |
| Mock scores | **EXISTS-SCAFFOLD** | `MockCreditKarmaConnector` | Friday Pulse mock only. |

---

### 5. Commas / Grants Pay

| Piece | Status | Files | Limitation |
|-------|--------|-------|------------|
| Sandbox default | **EXISTS-WORKING** | `src/lib/payments/commas-config.ts` | `COMMAS_ENVIRONMENT` defaults `sandbox`. |
| Adapter | **EXISTS-SCAFFOLD** | `commas-provider.ts` | Real Fanbasis shape; needs `COMMAS_API_KEY`. Default `PAYMENT_PROVIDER=mock`. |
| Live charges lock | **EXISTS-WORKING** | `commas-config.ts` | Throws if production without `COMMAS_LIVE_CHARGES=true`. |
| Webhooks | **EXISTS-SCAFFOLD** | `src/app/api/webhooks/payments/route.ts`, `service.ts` | HMAC `x-webhook-signature` + `COMMAS_WEBHOOK_SECRET`. Idempotent on `WebhookEvent (provider, providerEventId)`. |
| Payment history | **EXISTS-WORKING** | `src/app/(staff)/pay/page.tsx`, Client 360 Pay tab | Invoices + transactions when finance role. |
| Onboarding trigger | **EXISTS-WORKING** | `automations/engine.ts`, `payment-requests.ts` | `PAYMENT_COMPLETED` → setup token + staff assign + notify chain. |
| Webhook register | **OWNER-PERMISSION** | `scripts/commas-register-webhook.ts` | Needs key + public HTTPS. |
| Authorize.Net secondary | **EXISTS-SCAFFOLD** | `authorize-net-*.ts` | Optional; `verifyWebhook` returns `false`. Not a second phone provider. |

---

### 6. Webhooks (GHL, Commas, DisputeFox)

| Provider | Status | Signatures | Idempotency | Health `lastSuccessAt` |
|----------|--------|------------|-------------|------------------------|
| Commas | **EXISTS-SCAFFOLD** `/api/webhooks/payments` | HMAC-SHA256 | Unique `(provider, providerEventId)` | Yes — last **processed payment** webhook only |
| GHL | **MISSING** | — | Pull uses `(provider=GHL, externalId)` on messages | Always `null` on `ghl` card |
| DisputeFox | **MISSING** | — | Sync uses timeline keys | Always `null` on `disputefox` card |

Webhook health card is payment-only. `CONNECTED` there means a Commas/mock payment event processed — not GHL/DF inbound.

---

### 7. Client 360 profile

File: `src/app/(staff)/clients/[id]/page.tsx` · dossier: `src/lib/clients/dossier.ts`

| Tab | Status | Notes |
|-----|--------|-------|
| Overview | **EXISTS-WORKING** | Identity, stage, staff, onboarding, next action. Integration fields often “Awaiting Integration”. |
| Credit | **EXISTS-SCAFFOLD** | Real when `creditScores` exist; else stub. Dev plane = sample scores. |
| Disputes | **EXISTS-SCAFFOLD** | Rounds + DF new-tab. Not a workspace. |
| Documents | **EXISTS-SCAFFOLD** | Metadata table. `storageKey` exists; no object-storage backend. |
| Tasks | **EXISTS-WORKING** | Open tasks from DB. |
| Comms | **EXISTS-WORKING** | OS inbox last 12 + internal thread. |
| Pay | **EXISTS-WORKING** | Finance roles; invoices + txns. |
| Timeline | **EXISTS-WORKING** | Events. **Actor not shown** even though `actorId` is loaded. |
| Audit | **MISSING** | `AuditLog` write-only (`src/lib/audit/log.ts`). No staff browser. |

---

### 8. Automations already present — do not duplicate

Engine: `src/lib/automations/engine.ts` · cron: `vercel.json` → `POST /api/automations/run` every 5m · also `src/instrumentation.ts` 30s drain + Fri 14:00 UTC pulse.

| Kind | Status | Do not rebuild |
|------|--------|----------------|
| `PAYMENT_COMPLETED` | Working | Onboarding token + assign + chains notify |
| `PAYMENT_LINK_EMAIL` / `_SMS` | Scaffold (GHL 401) | Fail-closed outbound |
| `INTAKE_COMPLETED` | Working | `assignDefaultStaff` |
| `FRIDAY_CREDIT_PULSE` | Working (mocks) | Already triple-scheduled (cron + instrumentation + manual) |
| `STAFF_PAYMENT_NOTIFY` / `CLIENT_PAYMENT_CONFIRM` | Working | Timeline only |
| `INVOICE_REMINDER` / `MISSING_DOCUMENTS_REMINDER` | Scaffold | `default: { skipped: true }` |

Also locked: Zap `374413762` OFF. Friday Update Router unpublished. CRC writes dry-run. Acquisition outreach locked.

---

### 9. Employee RBAC / own logins / attribution

| Piece | Status | Files | Limitation |
|-------|--------|-------|------------|
| Roles + matrix | **EXISTS-WORKING** | `prisma/schema.prisma`, `src/lib/rbac/permissions.ts` | OWNER, ADMIN, MANAGER, CUSTOMER_SERVICE, FILE_PREPARER, MARKETING, CLIENT |
| Own logins | **EXISTS-WORKING** (model) | `session.ts`, `login/route.ts`, seed | Seed: Charles / Simon / Jona. Owner `/set-password`. |
| Staff invite / create UI | **MISSING** | `MANAGE_STAFF` unused for provisioning | New employees need DB/script. |
| MFA | **EXISTS-SCAFFOLD** | `User.mfaEnabled` | No enrollment UX. |
| Action attribution | **EXISTS-SCAFFOLD** | `AuditLog.actorId`, `Message.senderId`, timeline `actorId` | Writes are real; **no Audit UI**; timeline hides actor. |

---

### 10. Production Postgres / Neon vs local SQLite

| Piece | Status | Files | Limitation |
|-------|--------|-------|------------|
| Dual adapter | **EXISTS-WORKING** | `prisma.config.ts`, `src/lib/db/prisma.ts`, `schema.postgres.prisma` | `postgresql://` → Postgres schema + `migrations-postgres`; else SQLite. |
| Public `/api/health` | **Misleading** | `src/app/api/health/route.ts` | `{ ok: true, database: "ok" }` if `SELECT 1` works — **no engine**. SQLite looks production-ready. |
| System Health DB card | **Misleading** | `health.ts` | Detail always `"SQLite/Prisma responding"` even on Postgres. |

---

### 11. Real backups

**MISSING** in repo (docs/dashboard only).

- Health: Postgres → `DEGRADED` “Configure host-managed Postgres backups”; SQLite → `ACTION_REQUIRED`.
- Docs: `docs/DEPLOYMENT.md` “Enable automated backups in the Neon/Supabase dashboard.”
- CRC sequencer “backup” = dry-run string, no snapshot.
- No backup script, no PITR probe, no confirmation that `neon-green-battery` backups are on. **OWNER-PERMISSION** for BUILDX to enable/confirm in Neon.

---

### 12. iMessage

**EXISTS-SCAFFOLD** / modular / **not a launch blocker**.

- Inbound GHL `IMESSAGE` mapped to SMS channel (`conversations.ts`).
- No send path. Locks: `outboundIMessageEnabled: false`.
- Health: `DEGRADED` — “not available by default.”
- Inbound HTTP refuses send: “will not send SMS, email, or iMessage.”

---

### 13. System Health meaning

**EXISTS-SCAFFOLD** — 14 cards, but several are env-presence, not probes.

File: `src/lib/system/health.ts` · UI: `src/app/(staff)/system-health/page.tsx`

| Card | What `CONNECTED` actually means |
|------|--------------------------------|
| `ghl` | `GHL_API_KEY` + location id present. **Not** a scope/API probe. `lastSuccessAt: null`. |
| `email` / `sms` | Always `ACTION_REQUIRED` with documented 401 / `conversations/message.write`. SMS card claims “Inbound conversations OK” from key presence, not a last successful pull. |
| `voice` | Always `ACTION_REQUIRED`. Not a live 401 probe. |
| `disputefox` | `DISPUTEFOX_API_KEY` present. Live list is disabled. |
| `smartcredit` | Sponsor URL/code present. |
| `credit_karma` | Always `DEGRADED` (honest anti-scrape). |
| `commas` | Key + provider/env/lock. More honest. |
| `webhooks` | Last **payment** webhook only. |
| `database` | `SELECT 1`; mislabeled SQLite. |
| `backups` | Advisory only. |

**Not implemented:** granular GHL **auth / inbound / outbound / email / voice / webhook** last-success checks.

---

### 14. Secrets stay server-side

**EXISTS-WORKING.**

- Only public env: `NEXT_PUBLIC_APP_URL`.
- `integrationCredentialStatus()` / `tests/credentials-status.test.ts`: booleans only.
- Commas: “Never expose `COMMAS_API_KEY` or `COMMAS_WEBHOOK_SECRET` to the browser.”
- Authorize.Net Accept.js **public** `clientKey` on pay page is intentional.

---

### 15. Experian portal workspace

**MISSING** as a portal workspace. **EXISTS-SCAFFOLD** as mock weekly score.

- `MockExperianConnector` in `src/lib/credit/pulse.ts`.
- Bureau rows on `/credit-pulse` and `/portal/pulse`.
- Zero `iframe` in `src/`. No new-tab Experian shell. No filing/result tracking model.

Rule for a future PR: **no Experian API**, iframe only if allowed, else new tab + OS result tracking.

---

### 16. CFPB portal workspace (Escalations)

**MISSING.** No CFPB routes, schema, nav, or complaint tracking. “Escalate” in repo is Agent Hub policy only.

---

### 17. Credit & Disputes nav

**MISSING** as specified. Current nav (`src/lib/nav/role-nav.ts`):

| Wanted | Actual |
|--------|--------|
| DisputeFox | Desktop “Disputes” → `/work?view=jona` (Jona queue), plus Client 360 tab |
| Experian | No nav |
| SmartCredit | Buried under `/credit-pulse` |
| Credit Karma | No nav |
| Escalations → CFPB | No nav |

---

## Env var names (values never)

### `.env.production.example`

`DATABASE_URL`, `AUTH_SECRET`, `GC_CRON_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, `GC_ENV`, `GC_DESKTOP_URL`, `GC_VERCEL_EXTERNAL`, `PAYMENT_PROVIDER`, `COMMAS_API_KEY`, `COMMAS_WEBHOOK_SECRET`, `COMMAS_ENVIRONMENT`, `COMMAS_LIVE_CHARGES`, `COMMAS_CREATOR_HANDLE`, `GHL_API_KEY`, `GHL_LOCATION_ID`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `GC_DESKTOP_RELEASES_URL`, `GC_DESKTOP_MAC_URL`, `GC_DESKTOP_WIN_URL`, `GC_DESKTOP_LINUX_URL`

### `.env.example` extras

`AUTHORIZE_NET_SANDBOX_API_LOGIN_ID`, `AUTHORIZE_NET_SANDBOX_TRANSACTION_KEY`, `AUTHORIZE_NET_SANDBOX_CLIENT_KEY`, `AUTHORIZE_NET_SIGNATURE_KEY`, `AUTHORIZE_NET_ENVIRONMENT`, `AUTHORIZE_NET_LIVE_CHARGES`, `DISPUTEFOX_INTAKE_URL_TEMPLATE`, `GHL_LOGIN_EMAIL`, `GHL_LOGIN_PASSWORD`, `DISPUTEFOX_LOGIN_EMAIL`, `DISPUTEFOX_LOGIN_PASSWORD`, `DISPUTEFOX_API_KEY`, `AGENT_HUB_CURSOR_API_KEY`, `AGENT_HUB_CURSOR_STARTING_REF`, `AGENT_HUB_CURSOR_REPO_URL`, `SMARTCREDIT_SPONSOR_URL`, `SMARTCREDIT_SPONSOR_CODE`, `CRC_API_KEY`, `CRC_RECOVERY_WRITES_ENABLED`, `GC_CRON_SECRET`

### In code, not always in examples

`AUTHORIZE_NET_API_LOGIN_ID`, `AUTHORIZE_NET_TRANSACTION_KEY`, `AUTHORIZE_NET_PUBLIC_CLIENT_KEY`, `CRC_WRITE_ENRICHMENT_ENABLED`, `CRC_WRITE_ACTIVE_CONTINUITY_ENABLED`, `CRC_WRITE_DORMANT_GHL_ORG_ENABLED`, `CRC_WRITE_DOCUMENTS_ENABLED`, `CRC_WRITE_DF_CREATE_ENABLED`, `CURSOR_API_KEY`, `CURSOR_REPO_URL`, `GITHUB_REPO_URL`, `CURSOR_STARTING_REF`, `AGENT_HUB_SIMULATE_CURSOR`, `AGENT_HUB_DISABLE_CURSOR_POLLER`, `AGENT_HUB_CURSOR_POLL_MS`, `AGENT_HUB_TOKEN`, `AGENT_HUB_ALLOW_UNAUTH`, `GC_FORCE_SECURE_COOKIES`, `GC_DEPLOY_OWNER`, `GHL_EXPECTED_LOCATION_ID`, `SEED_PASSWORD`, `SEED_PRODUCTION`, `E2E_OWNER_PASSWORD`, `E2E_OWNER_EMAIL`, `OWNER_SETUP_BASE_URL`, `OWNER_EMAIL`, `OWNER_FIRST_NAME`, `OWNER_LAST_NAME`

**Not env vars — PIT scopes on the existing GHL key:** `contacts.readonly`, `conversations.readonly`, `conversations/message.readonly`, **`conversations/message.write` (missing → 401)**, `conversations.write` (recommended). Voice scope names are **not** codified.

---

## Next 5 implementation PRs (do not start here)

Small, non-overlapping, **no Charles/credential required**. Skip GHL write-scope work and Commas key until owner.

1. **Honest System Health split** — Split GHL into auth / inbound-pull / outbound / email / voice / webhook. Record `lastSuccessAt` from real pull/send/webhook rows. Label DB engine (Postgres vs SQLite). Stop marking DF/SmartCredit/GHL `CONNECTED` on key presence alone. Files: `src/lib/system/health.ts`, `tests/system-health-search.test.ts`.
2. **Credit & Disputes nav** — Desktop/mobile: DisputeFox, Experian, SmartCredit, Credit Karma, Escalations → CFPB. Wire DisputeFox to existing Client/Jona surfaces; others to new route shells. File: `src/lib/nav/role-nav.ts` + staff pages. No vendor APIs.
3. **Experian portal workspace** — Staff page: allowlisted iframe **or** new tab to Experian portal + OS result-tracking (opened / filed / outcome / actor). **No Experian API.**
4. **CFPB Escalations workspace** — Same portal pattern under Escalations. Complaint id, opened-at, outcome. **No CFPB scrape/API.**
5. **Client 360 Audit tab + timeline actors** — Browse `AuditLog` for the master client; show timeline `actor`. Completes the 360 spec without vendor keys.

**Still Charles / BUILDX (not those PRs):** GHL `conversations/message.write` (+ voice scopes), Commas sandbox key + `commas:register-webhook`, confirm Neon backups, Squarespace `os` CNAME, Owner setup link/password, optional `DISPUTEFOX_API_KEY` / `SMARTCREDIT_SPONSOR_URL`.
