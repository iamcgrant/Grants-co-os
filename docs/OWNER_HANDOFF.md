# OWNER HANDOFF REPORT — Grants & Co OS

**For:** ChatGPT / owner continuation  
**Prepared by:** Cursor Cloud Agent  
**Date:** 2026-08-16  
**Repo:** `github.com/iamcgrant/Grants-co-os`  
**Branch:** `cursor/grants-co-os-e497`  
**PR:** https://github.com/iamcgrant/Grants-co-os/pull/1 (OPEN draft)  
**Local app:** `http://localhost:3000` (dev server was running)

---

## 1. One-sentence status

Grants & Co OS exists as a working TypeScript/Next.js PWA with a **payment-first core (mock processor live)**, full Phase 1–6 **scaffolding**, brand UI aligned to grantandconsultants.com, and **local-only credentials** for GHL/DisputeFox/SmartCredit — **no live payment charges and no live CRM/dispute API sync yet**.

---

## 2. Product intent (do not lose this)

Grants & Co OS is the **source of truth** operating system for:

- owner, managers, employees, clients

Third parties (Authorize.Net, Commas, GHL, DisputeFox, SmartCredit, Credit Karma, Experian, etc.) are **adapters under the OS**, never the master identity or master database.

**Absolute priority:** Payments / financial infrastructure first. Later modules must not destabilize money.

---

## 3. Current architecture

```
GRANTS & CO OS (Next.js App Router + TypeScript + Prisma)
│
├── Identity
│   ├── Users + sessions (httpOnly cookie JWT wrapping hashed session)
│   ├── Roles: OWNER, ADMIN, MANAGER, CUSTOMER_SERVICE, FILE_PREPARER, MARKETING, CLIENT
│   ├── RBAC permissions matrix (finance least-privilege)
│   └── Master Client ID: GC-000001 (IdSequence) + duplicate prevention
│
├── Grants Pay  ← PRIORITY #1
│   ├── PaymentProvider interface
│   ├── MockPaymentProvider          ✅ ACTIVE (default)
│   ├── AuthorizeNetPaymentProvider  🟡 SCAFFOLDED (preferred primary)
│   ├── CommasPaymentProvider        🟡 SCAFFOLDED (secondary / MoR)
│   ├── Billing policy engine + milestones → invoices
│   ├── Charge / refund / webhook idempotency
│   ├── Finance dashboard (collected vs settled vs payout)
│   ├── Checkout UI /pay/[invoice]
│   └── Post-pay bridge /pay/continue/[invoice] → DisputeFox intake
│
├── Operations
│   ├── Mock GHL + Mock DisputeFox adapters
│   ├── Staff Today / tasks / workload
│   └── Unified client timeline
│
├── Credit Pulse
│   ├── SmartCredit sponsor enrollment (pid preserved)
│   ├── Credit Karma connector (read-only mock)
│   ├── Experian connector (mock)
│   ├── Append-only score snapshots (bureau + model + source)
│   └── Friday Credit Pulse runner
│
├── Client Experience (PWA portal)
│   ├── /portal home, credit, payments, documents
│   └── Manifest + service worker + brand icons
│
├── Intelligence
│   ├── Marketing attribution dashboard
│   └── AI guardrails (documented; no autonomous money/credit mutations)
│
└── Credit Engine
    └── Stub only (strategic DisputeFox replacement later — not a clone)
```

**Data:** Prisma schema → SQLite local (`file:./dev.db`). Production target: PostgreSQL/Supabase.  
**Docs:** `docs/ARCHITECTURE.md`, `PAYMENTS.md`, `SECURITY.md`, `DATABASE.md`, `INTEGRATIONS.md`, `CREDIT-PULSE.md`, `CLIENT-APP.md`, `MARKETING.md`, `ROADMAP.md`, `DEPLOYMENT.md`, `BRAND.md`

---

## 4. X1 / X2 / X3 status

> These labels were **not formally defined inside this Cursor repo**. Below is the practical mapping to the three external-integration tracks the owner has been provisioning. Remap if ChatGPT used different names.

| Track | Meaning | Status | Notes |
|-------|---------|--------|-------|
| **X1 — Grants Pay (money)** | Authorize.Net primary + Commas secondary + mock | **X1.A Mock = DONE** · **X1.B Sandbox Accept.js = WIRED (fail-closed without creds)** · live processors still locked | Preferred primary = **Authorize.Net** (Accept.js for proprietary checkout + immediate → DisputeFox). Commas = MoR / payment_link secondary. Live charges locked behind `*_LIVE_CHARGES=true`. Ecrypt/NMI **removed** (never used). |
| **X2 — Operations connectors** | GHL + DisputeFox under OS | **X2.A Mocks + portal creds in local env = DONE** · **X2.B Live API sync = NOT STARTED** | Portal login email/password stored in **gitignored `.env` only**. Prefer API keys for production sync. Post-payment intake bridge exists; needs `DISPUTEFOX_INTAKE_URL_TEMPLATE`. |
| **X3 — Credit Pulse / attribution** | SmartCredit sponsor + bureau connectors | **X3.A Sponsor URL wired = DONE** · **X3.B Live bureau APIs = NOT STARTED** | Sponsor link configured: `https://www.smartcredit.com/join/?pid=69411` (preserves `pid`, appends `gc_ref`). Credit Karma/Experian are mocks / read-only architecture. |

### X-track detail

**X1 Done**
- Full payment domain model + idempotency
- Mock charge / fail / refund / webhook dedupe tested
- Finance dashboard + Grants Pay UI + receipt + continue-to-intake flow
- Authorize.Net sandbox Accept.js charge path (fail-closed without credentials; mocked success covered)
- Commas adapter scaffold (no live calls)

**X1 Not done**
- Live Authorize.Net / Commas charges (explicitly locked)
- Sandbox Commas checkout-session
- Production activation (explicitly blocked)
- Real settlement/payout reconciliation with bank

**X2 Done**
- Mock GHL / DisputeFox providers
- Credential accessors + status API (booleans only, never leak secrets)
- Timeline + staff operations UI
- DisputeFox ID attachable to Grants Client

**X2 Not done**
- Real GHL contact/message/pipeline sync
- Real DisputeFox status/document sync
- Secure storage of portal passwords in Cursor Secrets (currently local `.env`)
- Intake URL template configuration

**X3 Done**
- Score history model (never overwrite; model separation)
- Friday pulse mock runner
- SmartCredit sponsored enrollment API preserving `pid=69411`

**X3 Not done**
- Live SmartCredit API (if any beyond affiliate link)
- Live Credit Karma / Experian connectors
- Automated Friday job scheduler in production

---

## 5. What is built and working (verified)

### Phase 1 — Grants Pay / Core ✅ (mock)
- Login / sessions / RBAC
- Create client → auto `GC-######` + duplicate flagging
- Attach service → complete milestone → create invoice
- Grants Pay checkout (mock token) → success receipt
- Failed payment simulation
- Refunds
- Duplicate webhook / idempotency protection
- Owner finance dashboard metrics
- Employee finance restriction (FILE_PREPARER → 403 on finance API)
- PWA manifest / SW / installable shell

### Phase 2 — Operations ✅ (mock)
- Today dashboard, tasks, queues, workload
- GHL / DisputeFox mock adapters
- Unified client timeline

### Phase 3 — Credit Pulse ✅ (mock + sponsor URL)
- Snapshots / scores / Friday pulse
- SmartCredit enroll endpoint with attribution

### Phase 4 — Client portal ✅ (basic)
- Home, My Credit, My Payments, Documents
- Client login: `donna.james@example.com`

### Phase 5 — Intelligence ✅ (basic)
- Attribution metrics dashboard + AI guardrails text

### Phase 6 — Credit Engine 🟡
- Stub module only

### Brand ✅
- Inspired by grantandconsultants.com (Fraunces, Manrope, `#16161a`, `#f5b82a`)
- App-like luxury fintech shell — **not** a clone of the marketing site
- No website pricing/contact/workflows copied into OS

### Tests
- **17/17** Vitest critical tests passing
- Production `npm run build` succeeds

### Demo accounts (seed — not production)
| Role | Email | Password |
|------|-------|----------|
| Owner | owner@grantsandco.com | GrantsCo2026! |
| Manager | manager@grantsandco.com | same |
| File Preparer | preparer@grantsandco.com | same |
| Marketing | marketing@grantsandco.com | same |
| Client | donna.james@example.com | same |

Checkout demo invoice pattern: `/pay/GC-1051` (or reseed / create due invoice)

---

## 6. What is unfinished / blocked

| Item | Blocker type |
|------|----------------|
| Authorize.Net sandbox Accept.js charges | Adapter wired; fail-closed until `AUTHORIZE_NET_SANDBOX_API_LOGIN_ID` + `AUTHORIZE_NET_SANDBOX_TRANSACTION_KEY` (+ `AUTHORIZE_NET_SANDBOX_CLIENT_KEY` for browser Accept.js) are in host/secrets |
| Commas sandbox checkout | Need sandbox API key + webhook secret |
| Live payment activation | Explicit owner approval + `*_LIVE_CHARGES=true` |
| GHL live sync | Prefer Agency/Location API key (portal password alone is weak for automation) |
| DisputeFox live sync + intake redirect | API key (if any) + `DISPUTEFOX_INTAKE_URL_TEMPLATE` |
| Supabase/Postgres + RLS in production | Deployment decision + DATABASE_URL |
| MFA enrollment UX | Scaffolded fields only |
| Object storage for documents | Not wired |
| Native iOS/Android | Backend designed to support later; PWA only now |
| Real Credit Karma/Experian | Credentials + legal/compliance path |
| Production secret vault | Passwords currently in local gitignored `.env` — should move to Cursor Secrets / host secrets |

---

## 7. What you need from the owner (precise)

### Already received (local env only — NOT in git)
- SmartCredit sponsor URL (`pid=69411`)
- GHL portal email/password
- DisputeFox portal email/password  

⚠️ Those passwords were pasted in chat — **rotate when practical** and store only in secrets.

### Still needed to advance X1 (payments)
1. **Authorize.Net sandbox** — adapter is wired and fail-closed. When ready, put these names in host/Cursor Secrets (never chat, never git): `AUTHORIZE_NET_SANDBOX_API_LOGIN_ID`, `AUTHORIZE_NET_SANDBOX_TRANSACTION_KEY`, `AUTHORIZE_NET_SANDBOX_CLIENT_KEY`. Keep `AUTHORIZE_NET_ENVIRONMENT=sandbox`. **Do not enable live charges.**
2. Optional secondary: **Commas sandbox** `COMMAS_API_KEY`, `COMMAS_WEBHOOK_SECRET`

### Still needed to advance X2 (ops)
1. GHL **API Key + Location ID** (Settings → Integrations → API Keys) — better than password login  
2. DisputeFox intake URL template, e.g.  
   `DISPUTEFOX_INTAKE_URL_TEMPLATE=https://…/{externalId}?ref={grantsClientId}`  
3. DisputeFox API key if available

### Still needed later (not freezing build)
- Production deployment approval (Vercel/host + Postgres/Supabase)
- Decision: Authorize.Net only vs Authorize.Net + Commas dual-rail

### Do NOT ask agent to
- Run real charges
- Commit secrets
- Accept third-party contracts
- Scrape/copy website pricing or policies into the OS

---

## 8. Security posture (current)

- Secrets intended via env; `.env` gitignored  
- No processor secrets in frontend (except future public Accept.js client key)  
- Audit log sanitization for sensitive keys  
- RBAC + financial field restrictions  
- Webhook/payment idempotency uniqueness constraints  
- Passwords were exposed in chat history — treat as compromised for production use until rotated  

---

## 9. What should happen next (dependency order)

1. **Keep mock Grants Pay as the default money path.** Authorize.Net sandbox Accept.js is wired and fail-closed without credentials; do not enable live charges.  
2. Connect post-payment continue → real DisputeFox intake URL template.  
3. Replace GHL password-login assumption with API key sync (contacts, messages, pipeline) attaching external IDs to Grants Clients (no duplicate masters).  
4. DisputeFox status sync under `DisputeProcessingProvider`.  
5. Promote SmartCredit enrollment CTA in client portal using configured sponsor URL.  
6. Only after sandbox payment green: ask owner for **production payment approval**.  
7. Migrate DB to Supabase Postgres + RLS; deploy.  
8. Phase 6 Credit Engine only after operational data exists — do not clone DisputeFox.

---

## 10. Key file map (for the next agent/ChatGPT)

| Area | Path |
|------|------|
| Payment interface | `src/lib/payments/types.ts` |
| Provider switch | `src/lib/payments/provider.ts` |
| Mock / AuthNet / Commas | `src/lib/payments/*-provider.ts` |
| Charge/refund/webhooks | `src/lib/payments/service.ts` |
| Post-pay → DisputeFox | `src/lib/payments/post-payment.ts`, `src/app/pay/continue/[invoiceNumber]/page.tsx` |
| Billing milestones | `src/lib/billing/engine.ts` |
| Clients / GC IDs | `src/lib/clients/*` |
| RBAC | `src/lib/rbac/permissions.ts` |
| Integrations | `src/lib/integrations/*` |
| SmartCredit sponsor | `src/lib/credit/smartcredit-sponsor.ts` |
| Schema | `prisma/schema.prisma` |
| Seed | `prisma/seed.ts` |
| Brand tokens | `src/app/globals.css`, `docs/BRAND.md` |
| Tests | `tests/*.test.ts` |

---

## 11. Commands

```bash
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev          # http://localhost:3000
npm run test
npm run build
```

---

## 12. Handoff checklist for ChatGPT

- [x] OS repo bootstrapped with payment-first architecture  
- [x] Mock money path proven (charge/fail/refund/idempotency/RBAC)  
- [x] Brand direction applied from website (visual only)  
- [x] SmartCredit `pid` attribution configured locally  
- [x] GHL/DisputeFox portal creds in local `.env` (not git)  
- [x] Authorize.Net sandbox wired (fail-closed without creds; live charges locked)  
- [ ] Commas sandbox optional  
- [ ] Live GHL API sync  
- [ ] Live DisputeFox sync + intake URL  
- [ ] Production secrets vault + deploy  
- [ ] Owner approval before any live charge  

**Bottom line for ChatGPT:** Continue from **X1 sandbox Authorize.Net** without rewriting the payment architecture; keep Mock as fallback; treat GHL/DisputeFox/SmartCredit as adapters under Grants Client master identity; never reintroduce Ecrypt/NMI; never commit secrets; never copy marketing-site business content into the OS.
