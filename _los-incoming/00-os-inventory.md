# Grants & Co OS inventory (for Mortgage Readiness OS)

**Purpose:** Precise map so Mortgage Readiness can be built as a **module inside** Grants & Co OS (staff desk + client application portal), not a greenfield rewrite.

**Method:** No `git clone`. Public GitHub via `raw.githubusercontent.com`, `ungh.cc` recursive file list, and `git ls-remote` only. `gh` CLI was **not authenticated**. Unauthenticated `api.github.com` was **rate-limited (403)**.

**Repo:** https://github.com/iamcgrant/grants-co-os (owner `iamcgrant`)  
**Production:** https://os.grantandconsultants.com  
**Inventoried at:** 2026-08-23 3:07 PM ET  
**Default branch:** `main`  
**HEAD SHA:** `2183e7f93cdc82eba4bc069267549c52af9ce687` (ungh + `git ls-remote` agree)  
**File count:** 516 paths on `main`

---

## 0. Reachability

| Check | Result |
|---|---|
| Public repo HTML | Reachable (`200`) |
| `raw.githubusercontent.com/iamcgrant/grants-co-os/main/...` | Reachable (`200` for existing files) |
| Recursive tree (`https://ungh.cc/repos/iamcgrant/grants-co-os/files/main`) | Reachable (`200`, 516 files) |
| `git ls-remote --heads` | Reachable; many `cursor/*` branches plus `main` |
| `gh api` | **Not usable** — `gh` not logged in; no `GH_TOKEN` |
| Unauthenticated GitHub REST | **403 rate limit** at inventory time |
| Clone | **Not performed** (explicitly forbidden) |

**Verdict: repo is reachable and public.** Cloud agents can implement against `main` at SHA `2183e7f`.

Note: some env/docs spell the GitHub path `iamcgrant/Grants-co-os`. GitHub treats that as the same repo.

---

## 1. Top-level file tree

App code lives under **`src/`** (not a root `app/` directory). Next.js App Router is `src/app/`.

```
grants-co-os/                          (main @ 2183e7f)
├── .cursor/                           environment.json, install.sh, mcp.json
├── .env.example                       (3617 B)
├── .env.production.example
├── .github/workflows/desktop-release.yml
├── .gitignore
├── Dockerfile
├── README.md
├── agent-mesh/server.ts
├── desktop/                           Tauri 2 shell (location.replace live site)
├── desktop-electron/                  Electron spike (allowlisted vendor desks)
├── docs/                              22 markdown docs
├── eslint.config.mjs
├── fixtures/crc-recovery/             synthetic CRC/GHL/DF/OS catalogs
├── next.config.ts                     serverExternalPackages: pg, prisma-adapter-pg
├── package.json
├── package-lock.json
├── postcss.config.mjs
├── prisma.config.ts                   sqlite schema vs schema.postgres.prisma
├── prisma/
│   ├── schema.prisma                  SQLite canonical (48929 B) — READ THIS
│   ├── schema.postgres.prisma         Postgres twin (49057 B)
│   ├── seed.ts
│   └── migrations/                    SQLite migrations (no migrations-postgres/ on main)
├── public/
│   ├── brand/                         logo.png, logo-footer.png, icon-mark.png, hero-atmosphere.jpg
│   ├── icons/                         icon-192.png, icon-512.png
│   ├── manifest.webmanifest
│   └── sw.js
├── scripts/                           GHL/DF/CRC/pay/deploy/owner-setup
├── src/
│   ├── app/                           App Router (auth / portal / staff / api / pay / setup)
│   ├── components/
│   ├── lib/
│   ├── proxy.ts                       Next 16 request proxy (NOT middleware.ts)
│   └── instrumentation.ts
├── tests/                             50 vitest files
├── tsconfig.json
├── vercel.json                        region iad1; cron /api/automations/run 0 12 * * *
└── vitest.config.ts
```

**There is no `resources/` directory on `main`.** There is no root `app/` — routes are `src/app/`.

### `src/` layout (implementation map)

| Path | Role |
|---|---|
| `src/app/(auth)/` | Login + first-time password |
| `src/app/(portal)/portal/` | Logged-in **client** PWA |
| `src/app/(staff)/` | Staff OS desks (home, clients, credit, tax, inbox, pay, …) |
| `src/app/pay/` | Public Grants Pay checkout (no staff layout) |
| `src/app/setup/[token]/` | Public post-payment intake (no login) |
| `src/app/api/` | REST |
| `src/app/page.tsx` | `/` → login or `/home` or `/portal` |
| `src/lib/auth/` | Cookie session |
| `src/lib/rbac/permissions.ts` | Role matrix |
| `src/lib/nav/role-nav.ts` | Sidebar / mobile nav |
| `src/lib/nav/portal-desks.ts` | In-OS vendor desks |
| `src/lib/clients/` | Master identity, onboarding, dossier |
| `src/lib/integrations/` | GHL, DisputeFox, Cognito, CRC, Gmail, Telegram |
| `src/lib/acquisition/` | Partner vs consumer engines |
| `src/lib/credit/` `src/lib/disputes/` `src/lib/tax/` | Existing product desks |
| `src/lib/payments/` | Grants Pay — **do not destabilize** |
| `src/components/layout/StaffShell.tsx` | Staff chrome + `BrandLogo` |
| `src/components/brand/BrandLogo.tsx` | Wordmark |

### `docs/` on main

`docs/ACQUISITION.md`, `ACTION_REQUIRED.md`, `AGENT-HUB.md`, `ARCHITECTURE.md`, `BRAND.md`, `BUILDX_HANDOFF.md`, `CLIENT-APP.md`, `CRC-MIGRATION.md`, `CREDIT-PULSE.md`, `DATABASE.md`, `DEPLOYMENT.md`, `DESKTOP.md`, `INTEGRATIONS.md`, `LEAD-ATTRIBUTION.md`, `MARKETING.md`, `OWNER_HANDOFF.md`, `PAYMENTS.md`, `PRODUCTION_ENV.md`, `PRODUCTION_HANDOFF.md`, `ROADMAP.md`, `SECURITY.md`, `crc-contact-recovery.md`.

---

## 2. Prisma schema

**Location (canonical for local/SQLite):** `prisma/schema.prisma` (48,929 bytes — fully retrieved).  
**Production twin:** `prisma/schema.postgres.prisma`.  
**Switch:** `prisma.config.ts` uses `schema.postgres.prisma` when `DATABASE_URL` is `postgres://` or `postgresql://`.  
**Generator output:** `src/generated/prisma`.  
**Local DB:** SQLite via `@prisma/adapter-better-sqlite3`.  
**Production DB:** Neon/Postgres (docs still mention Supabase as a target; `.env.example` and production host use Vercel + Postgres/Neon).

Identity rule baked into schema comments: **ONE HUMAN = ONE MASTER `Client`**. External systems attach via `ClientIdentifier`, never a second client row.

### 2.1 All Prisma models (71)

| Model | Notes for Mortgage Readiness |
|---|---|
| `User` | Auth identity. `role Role`. Optional `client Client?`. |
| `Session` | Cookie session row (`tokenHash`, `expiresAt`, `revokedAt`) |
| `StaffProfile` | Staff-only extras |
| `Client` | **Master person.** `grantsClientId` (`GC-000001`). `stage String` default `"NEW_ENROLLMENT"`. `status` default `"ACTIVE"`. `userId?` links portal login. Acquisition: `acquisitionStage`, `acquisitionSource`, `acquisitionMarket`. |
| `ClientIdentifier` | `provider` + `externalId` unique. Code providers: GHL, DISPUTEFOX, CREDIT_REPAIR_CLOUD, SMARTCREDIT, CLOUD_TAX_OFFICE, COGNITO, SBTPG, PAYMENT, COMMAS. |
| `SbtpgPayout` | Tax desk only — do not put on Command Center |
| `SbtpgFeeSummarySnapshot` | Official Fee Summary; Command Center revenue |
| `Address` | Client addresses |
| `Service` | Product catalog. Seed has **only** `CREDIT_OPT`. Add a new code rather than overloading credit. |
| `BillingPolicy` | Per-service billing |
| `ClientService` | Enrollment of a Service on a Client |
| `Contract` | Optional `documentId` (string, not a Prisma relation) |
| `ServiceMilestone` | Milestone billing |
| `Invoice` | `invoiceNumber` `GC-####` |
| `InvoiceItem` | |
| `PaymentCustomer` | |
| `PaymentMethod` | |
| `PaymentTransaction` | |
| `PaymentAttempt` | |
| `Refund` | |
| `PaymentDispute` | Processor dispute, not credit dispute |
| `Payout` | |
| `WebhookEvent` | |
| `IntegrationConnection` | One row per provider (`ghl`, `cognito`, …) |
| `IntegrationSyncEvent` | |
| `Document` | `storageKey`, `category`, `sourceSystem?`. **Metadata only — no object-store adapter in code.** |
| `Task` | Staff work queue |
| `ClientAssignment` | Staff ↔ client |
| `ClientTimelineEvent` | Client history |
| `Notification` | |
| `AuditLog` | |
| `SystemEvent` | |
| `CreditConnection` | SMARTCREDIT / CREDIT_KARMA / EXPERIAN |
| `CreditSnapshot` | |
| `CreditScore` | `bureau CreditBureau` |
| `CreditChange` | |
| `CreditAccount` | Tradelines |
| `CreditMonitoringEvent` | |
| `MarketingSource` | |
| `MarketingCampaign` | |
| `LeadSource` | |
| `ConversionEvent` | |
| `LeadAttribution` | Fail-closed child of Client |
| `Partner` | **Business referral — never a Client.** `partnerType` includes mortgage. |
| `PartnerReferral` | Partner → Client after conversion |
| `Conversation` | CLIENT / TEAM / CLIENT_INTERNAL |
| `ConversationParticipant` | |
| `Message` | GHL imports use `provider`+`externalId` |
| `MessageMention` | |
| `OnboardingItem` | Canonical checklist keys in `src/lib/clients/onboarding.ts` |
| `DisputeRound` | Credit-repair rounds |
| `DisputeCase` | In-OS bureau/CFPB case file |
| `DisputeCaseItem` | |
| `DisputeCaseCheckItem` | |
| `FridayPulseRun` | Weekly credit pulse |
| `FridayPulseItem` | |
| `IdSequence` | `grants_client` → `GC-######` |
| `AgentDefinition` | Agent Hub |
| `AgentMemory` | |
| `BusinessFact` | |
| `AgentTask` | |
| `AgentEvent` | |
| `AgentMessage` | |
| `OwnerApproval` | |
| `PaymentRequest` | Grants Pay `GP-######` |
| `PaymentRequestNote` | |
| `PaymentLink` | Official Commas URL last step |
| `OnboardingToken` | Public `/setup/[token]` |
| `AutomationRun` | PAYMENT_COMPLETED, INTAKE_COMPLETED, … |
| `ExceptionTicket` | |
| `SystemHealthCheck` | `component` includes `ghl`, `disputefox`, … |

### 2.2 Prisma enums (20)

```
Role: OWNER | ADMIN | MANAGER | CUSTOMER_SERVICE | FILE_PREPARER | MARKETING | CLIENT

BillingPolicyType: MANUAL_INVOICE | AFTER_SERVICE_MILESTONE | RECURRING_AFTER_MILESTONE
                 | PAY_PER_COMPLETED_SERVICE | CUSTOM_CONFIGURABLE_POLICY

InvoiceStatus: DRAFT | NOT_YET_BILLABLE | DUE | PROCESSING | SUCCEEDED | FAILED
             | CANCELED | PARTIALLY_REFUNDED | REFUNDED | DISPUTED

TransactionStatus: PENDING | PROCESSING | SUCCEEDED | FAILED | CANCELED
SettlementStatus: UNSETTLED | PENDING | SETTLED | FAILED
PayoutStatus: NONE | PENDING | IN_TRANSIT | PAID | FAILED | CANCELED
CreditBureau: EQUIFAX | EXPERIAN | TRANSUNION
TaskStatus: OPEN | IN_PROGRESS | BLOCKED | DONE | CANCELED
TaskPriority: LOW | MEDIUM | HIGH | URGENT

AttributionSource: facebook | instagram | youtube | email | referral | direct | unknown
AttributionShowStatus: showed | no_show | unknown

GhlServiceStatus: ACTIVE_CREDIT_CLIENT | RECENTLY_WORKED_REVIEW | DORMANT_REACTIVATION
                | CLOSED_DO_NOT_REACTIVATE | AMBIGUOUS_IDENTITY | TEST_JUNK
                (CRC recovery scaffolding — do not live-write GHL)

PartnerPipelineStage:
  NEW_PROSPECT | QUALIFIED_PARTNER_PROSPECT | OUTREACH_READY | CONTACTED | REPLIED
  | INTRO_CALL | PARTNER_INTERESTED | ACTIVE_REFERRAL_PARTNER | REFERRED_FIRST_CLIENT
  | ACTIVE_PRODUCING_PARTNER | NURTURE | NOT_INTERESTED | DND

ConsumerLeadStage:
  NEW_LEAD | ATTEMPTING_CONTACT | ENGAGED | CONSULTATION_BOOKED | CONSULTATION_COMPLETED
  | QUALIFIED | PAYMENT_PENDING | PAID_ONBOARDING | CONVERTED_CLIENT | NURTURE | LOST | DND

AcquisitionSource:
  GHL_PROSPECTING | PROSPECT_AI | REALTOR_PARTNER | MORTGAGE_PARTNER | BUILDER_PARTNER
  | FORMER_CLIENT_REFERRAL | FACEBOOK | INSTAGRAM | GOOGLE | WEBSITE | ORGANIC
  | EMAIL_CAMPAIGN | REACTIVATION_CAMPAIGN | OTHER

AcquisitionMarket:
  HILTON_HEAD_ISLAND_SC | BLUFFTON_SC | SAVANNAH_GA | ATLANTA_GA | WASHINGTON_DC
  | ARLINGTON_VA | CHARLOTTE_NC | COLUMBIA_SC | CHARLESTON_SC | AUGUSTA_GA
  | ALEXANDRIA_VA | FAIRFAX_VA | RICHMOND_VA | UNKNOWN | OTHER
  (Estill SC is explicitly not a member)

ConversationKind: CLIENT | TEAM | CLIENT_INTERNAL
MessageChannel: INTERNAL | SMS | EMAIL | CALL | VOICEMAIL | NOTE | SYSTEM
PaymentRequestStatus: DRAFT | PENDING | SENT | VIEWED | PAID | PARTIALLY_PAID
                    | FAILED | CANCELED | EXPIRED | REFUNDED | PARTIALLY_REFUNDED | DISPUTED
PaymentLinkKind: ONE_TIME | RECURRING | PARTIAL
```

**`Client.stage` is a String, not a Prisma enum.** Default in schema: `"NEW_ENROLLMENT"`.

---

## 3. App Router pages

Route groups: `(auth)` unauthenticated login, `(staff)` staff OS, `(portal)` client PWA. Public checkout/intake sit **outside** those groups.

### 3.1 Root / public

| Route | File | Who |
|---|---|---|
| `/` | `src/app/page.tsx` | Redirect: no user → `/login`; `CLIENT` → `/portal`; else `/home` |
| `/login` | `src/app/(auth)/login/page.tsx` | Email/password (`LoginForm`) |
| `/set-password` | `src/app/(auth)/set-password/page.tsx` | First-time owner/staff password |
| `/pay/[invoiceNumber]` | `src/app/pay/[invoiceNumber]/page.tsx` | Public Grants Pay |
| `/pay/continue/[invoiceNumber]` | `src/app/pay/continue/[invoiceNumber]/page.tsx` | Return from Commas |
| `/setup/[token]` | `src/app/setup/[token]/page.tsx` | **Public post-payment intake** (no session) |

### 3.2 Staff OS (`src/app/(staff)/layout.tsx`)

Unauthenticated → `/login?returnTo=…`. `CLIENT` role → `/portal`. Shell: `StaffShellClient`.

| Route | File |
|---|---|
| `/home` | `src/app/(staff)/home/page.tsx` — Command Center (18 KB) |
| `/dashboard` | `src/app/(staff)/dashboard/page.tsx` — exists; primary nav uses `/home` |
| `/clients` | `src/app/(staff)/clients/page.tsx` |
| `/clients/[id]` | `src/app/(staff)/clients/[id]/page.tsx` — **Client 360** (31 KB); links use `grantsClientId` |
| `/inbox` | `src/app/(staff)/inbox/page.tsx` — tabs OS / GHL / Gmail (`?tab=ghl`, `?tab=gmail`) |
| `/dialer` | `src/app/(staff)/dialer/page.tsx` — GHL voice |
| `/work` | `src/app/(staff)/work/page.tsx` |
| `/search` | `src/app/(staff)/search/page.tsx` |
| `/more` | `src/app/(staff)/more/page.tsx` |
| `/credit` | `src/app/(staff)/credit/page.tsx` — Credit & Disputes hub |
| `/credit/disputefox` | `src/app/(staff)/credit/disputefox/page.tsx` |
| `/credit/disputefox/[clientId]` | `src/app/(staff)/credit/disputefox/[clientId]/page.tsx` |
| `/credit/disputefox/case/[caseId]` | `src/app/(staff)/credit/disputefox/case/[caseId]/page.tsx` |
| `/credit/experian` + `/[caseId]` | under `credit/experian/` |
| `/credit/equifax` + `/[caseId]` | under `credit/equifax/` |
| `/credit/transunion` + `/[caseId]` | under `credit/transunion/` |
| `/credit/innovis` + `/[caseId]` | under `credit/innovis/` |
| `/credit/smartcredit` + `/[clientId]` + `/case/[caseId]` | under `credit/smartcredit/` |
| `/credit/credit-karma` | `src/app/(staff)/credit/credit-karma/page.tsx` — client-assisted, no scrape |
| `/credit-pulse` | `src/app/(staff)/credit-pulse/page.tsx` |
| `/escalations/cfpb` + `/[caseId]` | CFPB desk |
| `/tax` | `src/app/(staff)/tax/page.tsx` |
| `/tax/cognito` | `src/app/(staff)/tax/cognito/page.tsx` — **Cognito Forms desk** |
| `/tax/cloud-tax-office` + `/[clientId]` | Cloud Tax Office |
| `/tax/sbtpg` + `/[clientId]` | SBTPG; pinned in desktop nav |
| `/pay` | `src/app/(staff)/pay/page.tsx` |
| `/pay/invoices/[invoiceNumber]` | staff invoice view |
| `/acquisition` | `src/app/(staff)/acquisition/page.tsx` — partners vs consumers |
| `/intelligence` | `src/app/(staff)/intelligence/page.tsx` |
| `/automations` | `src/app/(staff)/automations/page.tsx` |
| `/system-health` | `src/app/(staff)/system-health/page.tsx` |
| `/agents` | `src/app/(staff)/agents/page.tsx` |
| `/team-chat` | `src/app/(staff)/team-chat/page.tsx` — Telegram, not iMessage |
| `/downloads` | `src/app/(staff)/downloads/page.tsx` |
| `/operations` | `src/app/(staff)/operations/page.tsx` |

**No staff routes named apply / intake / mortgage.** Dispute work is `/credit/disputefox`, not `/dispute`.

### 3.3 Client-facing routes (existing)

| Route | File | Auth |
|---|---|---|
| `/portal` | `src/app/(portal)/portal/page.tsx` | `role === CLIENT` else `/home` |
| `/portal/credit` | `src/app/(portal)/portal/credit/page.tsx` | same |
| `/portal/pulse` | `src/app/(portal)/portal/pulse/page.tsx` | same |
| `/portal/payments` | `src/app/(portal)/portal/payments/page.tsx` | same |
| `/portal/documents` | `src/app/(portal)/portal/documents/page.tsx` | list only; upload **not wired** |
| `/pay/[invoiceNumber]` | public checkout | no login |
| `/setup/[token]` | public intake after pay | token, not session |

Portal chrome: `src/app/(portal)/portal/layout.tsx`. Bottom nav: Home / Credit / Pulse / Pay / Docs.

**There is no `/apply`, `/intake`, or `/portal/mortgage` on `main`.**

### 3.4 Selected APIs

| Path | File |
|---|---|
| `POST /api/auth/login` | `src/app/api/auth/login/route.ts` |
| `POST /api/auth/logout` | `src/app/api/auth/logout/route.ts` |
| `GET /api/auth/me` | `src/app/api/auth/me/route.ts` |
| `POST /api/auth/set-password` | `src/app/api/auth/set-password/route.ts` |
| `GET/POST /api/setup/[token]` | `src/app/api/setup/[token]/route.ts` |
| `GET/POST /api/clients` | `src/app/api/clients/route.ts` |
| `GET /api/clients/[id]` | `src/app/api/clients/[id]/route.ts` |
| `POST /api/tax/cognito/pull` | `src/app/api/tax/cognito/pull/route.ts` |
| `POST /api/integrations/ghl/sync` | `src/app/api/integrations/ghl/sync/route.ts` |
| `POST /api/integrations/disputefox/sync` | `src/app/api/integrations/disputefox/sync/route.ts` |
| `POST /api/webhooks/grants-pay` | `src/app/api/webhooks/grants-pay/route.ts` (Zapier/GHL mark-paid) |

63 route files live under `src/app/api/` (full list in the ungh tree: auth, clients, credit, integrations/ghl+disputefox+gmail+telegram, pay, tax, webhooks, agent-hub, automations, search, setup, system).

---

## 4. Cognito integration (Cognito **Forms**, not AWS Cognito)

Cognito in this repo is **Cognito Forms** (tax/client form submissions). Official API, fail-closed, no scrape.

| Path | What |
|---|---|
| `src/lib/integrations/cognito/config.ts` | `COGNITO_API_KEY`; `COGNITO_API_BASE = https://www.cognitoforms.com/api` |
| `src/lib/integrations/cognito/client.ts` | Bearer GET `/forms` and `/forms/{id}/entries` |
| `src/lib/integrations/cognito/workspace.ts` | Pull → match existing `Client` by email → `ClientIdentifier` provider `COGNITO` |
| `src/lib/integrations/cognito/health.ts` | Health probe |
| `src/app/(staff)/tax/cognito/page.tsx` | Staff desk = `GuardedPortalDesk({ deskId: "cognito", gate: "tax" })` |
| `src/app/api/tax/cognito/pull/route.ts` | `POST`; requires `MANAGE_OPERATIONS` |
| `src/components/tax/CognitoPullForm.tsx` | Staff pull UI |
| `tests/cognito-workspace.test.ts` | Tests |
| `src/lib/nav/official-login-urls.ts` | `COGNITO_OFFICIAL_LOGIN_URL = https://www.cognitoforms.com/grantcoconsultants/home` |
| `src/lib/nav/portal-desks.ts` | Desk id `"cognito"`, embed `"try"` |
| `.env.example` | `# COGNITO_API_KEY=` |

Identifier constant: `CLIENT_IDENTIFIER_PROVIDER.COGNITO = "COGNITO"` in `src/lib/clients/identifiers.ts`. External id format: `{formId}:{entryId}`. Timeline event: `COGNITO_SUBMISSION`. Integration provider string: `"cognito"`.

**Do not confuse with AWS Cognito.** Auth is local email+password + JWT cookie (`jose` + `gc_session`), not AWS.

Tax-related form heuristic in workspace: name matches `/tax|return|1040|w-?2|intake|client|organizer|sbtpg|refund/i`. Mortgage forms would match `intake|client` today if pulled through this desk — do **not** silently reuse this puller as the mortgage application without a dedicated filter/provider.

---

## 5. Brand assets (paths only — never invent a logo)

**`resources/brand/emblem.png` does not exist on `main` (HTTP 404).** No `resources/` tree at all. No file whose name contains `emblem` or `wordmark`.

Assets that **do** exist:

| Path | Role in repo |
|---|---|
| `public/brand/logo.png` | Official site wordmark. Used by BrandLogo as `/brand/logo.png`. Documented in `docs/BRAND.md`. |
| `public/brand/logo-footer.png` | Footer wordmark variant (not referenced in BrandLogo.tsx) |
| `public/brand/icon-mark.png` | Small mark |
| `public/brand/hero-atmosphere.jpg` | Login atmosphere (LoginForm src `/brand/hero-atmosphere.jpg`) |
| `public/icons/icon-192.png` | PWA |
| `public/icons/icon-512.png` | PWA |
| `src/components/brand/BrandLogo.tsx` | Image src `/brand/logo.png` alt Grants and Co Consultants |
| `docs/BRAND.md` | Tokens: charcoal #16161a, ice #b2d4ff, gold #f5b82a, Fraunces + Manrope |
| `src/app/globals.css` | Token implementation |
| `src/app/favicon.ico` | Favicon |
| `desktop/src-tauri/icons/*` | Tauri packager icons (not the marketing wordmark) |

Sidebar uses BrandLogo in `src/components/layout/StaffShell.tsx`.
If a cloud agent needs a mark, use `public/brand/logo.png` / `icon-mark.png` as they exist. Do not invent `resources/brand/emblem.png`.


---

## 6. Auth model (owner / staff / client)

### Mechanism

- Cookie name: `gc_session` (`src/lib/auth/session.ts`)
- JWT (`jose` HS256) wrapping sid = sha256(session token) + uid
- Session row in `Session`; revoke on logout
- Passwords: bcryptjs cost 12
- Secret: AUTH_SECRET (dev fallback exists — rotate in production)
- Stay signed in: 90 days; brief: 14 days
- User.mustChangePassword blocks login until `/set-password`
- MFA fields exist (mfaEnabled, mfaSecret)
- Next 16 proxy `src/proxy.ts` only stamps x-gc-pathname for return-to (not an auth gate)
- Real gates: `(staff)/layout.tsx`, `(portal)/portal/layout.tsx`, `src/app/page.tsx`

### Roles (enum Role)

| Role | Seed / intent | After login |
|---|---|---|
| OWNER | owner@grantsandco.com (Charles) | /home Command Center |
| ADMIN | (not in seed) | same nav as OWNER |
| MANAGER | (not in seed) | thinner nav |
| CUSTOMER_SERVICE | simon@grantsandco.com | Client Care |
| FILE_PREPARER | jona@grantsandco.com | File Processing |
| MARKETING | (not in seed) | thin nav |
| CLIENT | donna.james@example.com | always /portal — cannot enter staff layout |

pathAfterLogin (`src/lib/auth/return-to.ts`): CLIENT to /portal; staff to safe returnTo or /home. Blocked return prefixes: /login, /portal, /api, /setup, /pay/.

Permissions (`src/lib/rbac/permissions.ts`): VIEW_CLIENT for OWNER, ADMIN, MANAGER, CUSTOMER_SERVICE, FILE_PREPARER. VIEW_OWN_CLIENT_PORTAL = [CLIENT] only. VIEW_CREDIT_DOCS / MANAGE_CREDIT include FILE_PREPARER + CS. Finance hidden from FILE_PREPARER / MARKETING.

Owner setup: `scripts/owner-setup-link.ts`. Desktop nav (OWNER/ADMIN) in `src/lib/nav/role-nav.ts`: /home, /clients, /inbox, /inbox?tab=ghl, /inbox?tab=gmail, /dialer, /team-chat, pinned SBTPG, /work, credit stack, CFPB, tax desks, /pay, /intelligence, /acquisition, /automations, /system-health, /agents, /more.

---

## 7. Existing pipeline / stage vocabularies

Three different stage systems. Do not collapse them.

### A. Operational Client.stage (String)

Schema default: NEW_ENROLLMENT.

Values observed in code (not a Prisma enum):

| Value | Where |
|---|---|
| NEW_ENROLLMENT | schema default; dossier fallback |
| ONBOARDING | src/lib/ops/command-center.ts |
| WAITING_ON_CLIENT | seed (Antionette); command-center queues |
| READY_FOR_PROCESSING | seed (Donna); DF Round 1 Ready; Jona queue |
| WAITING_FOR_RESULTS | seed (Marcus) |
| RESULTS_RECEIVED | command-center resultsToDeliver |
| CLIENT_ACTION_REQUIRED | command-center attention |
| ROUND_SUBMITTED | DF parse: Round N Sent (src/lib/integrations/disputefox/roster.ts) |
| NEXT_ROUND | DF parse: Round N Ready for N>1 |
| INTAKE_COMPLETE | written by POST /api/setup/[token] |

nextActionOwner strings in schema comment: CHARLES | SIMON | JONA | CLIENT | SYSTEM.

### B. Engine B consumer lead — Prisma ConsumerLeadStage on Client.acquisitionStage

Mirrored in src/lib/acquisition/types.ts CONSUMER_LEAD_STAGES. Null when the master is not an acquisition lead.

### C. Engine A partner — Prisma PartnerPipelineStage on Partner.pipelineStage

Mirrored as PARTNER_PIPELINE_STAGES. Partners are not Clients. PARTNER_TYPES includes MORTGAGE. AcquisitionSource includes MORTGAGE_PARTNER.

### D. Other status enums (do not reuse blindly)

| Domain | Values | File |
|---|---|---|
| Dispute case | INTAKE PACKET READY SUBMITTED RESULTS CLOSED | src/lib/disputes/channels.ts |
| Cloud Tax | INTAKE IN_PREP REVIEW FILED ACCEPTED REJECTED CLOSED | src/lib/tax/catalog.ts |
| SBTPG | PENDING APPROVED FUNDED PAID UNFUNDED HOLD REJECTED CLOSED | same |
| Onboarding item | COMPLETE MISSING WAIVED | OnboardingItem.status |
| GHL CRC service (scaffold) | GhlServiceStatus | schema |

Master onboarding keys (`src/lib/clients/onboarding.ts`): intake, identification, proof_of_address, ssn_card, monitoring, smartcredit, updated_report, poa, agreements, portal_access.


---

## 8. File upload / document storage

Scaffolded metadata. No upload API. No object-store adapter.

- Model: Document (storageKey, mimeType, category, uploadedById, sourceSystem, originalDate, sourceClientId, documentType)
- Seed keys are fake paths: dev/donna/dl.pdf, dev/donna/poa.pdf, dev/antionette/address.pdf (prisma/seed.ts)
- Portal copy says upload will connect to secure object storage when configured. File: src/app/(portal)/portal/documents/page.tsx (read-only list)
- docs/SECURITY.md production checklist includes encrypted object storage for documents (not implemented)
- CRC: src/lib/crc-recovery/documents.ts is provenance only; rawIncluded must stay false
- No filenames matching upload, storage, s3, blob in the 516-file tree (except Experian official URL consumer/upload/)
- Contract.documentId is a string, not a Prisma relation

Mortgage Readiness will need a new storage adapter; do not assume one exists.

---

## 9. GHL, DisputeFox, Zapier (in code)

### GoHighLevel

See INTEGRATIONS.md in the repo for GHL adapter paths.

GHL code: src/lib/integrations/ghl/http.ts, sync.ts, conversations.ts, outbound.ts, voice.ts, workspace.ts, location.ts, probes.ts.
GHL API routes: src/app/api/integrations/ghl/status, sync, conversations, conversations/sync, voice, workspace, workspace/send.
GHL scripts: scripts/ghl-inbound-sync.ts, scripts/ghl-inbound-conversations.ts.
GHL UI: src/components/inbox/GhlClientDesk.tsx, GhlLocationInbox.tsx, src/components/integrations/GhlSyncPanel.tsx.


GHL is the only client comms backend. Inbound sync attaches onto existing masters only and never creates a Grants Client.
Official GHL login constant: OFFICIAL_GHL_LOGIN_URL in src/lib/nav/official-login-urls.ts. Embed refused in src/lib/nav/portal-desks.ts.

### DisputeFox

DF lib: src/lib/integrations/disputefox/http.ts, probe.ts, roster.ts, sync.ts.
DF API: src/app/api/integrations/disputefox/status/route.ts, sync/route.ts.
DF script: scripts/disputefox-inbound-attach.ts.
DF staff desk: src/app/(staff)/credit/disputefox/.
DF official login constant: OFFICIAL_DISPUTEFOX_LOGIN_URL.

Local attach uses CONFIRMED_DF_ROSTER (26 confirmed rows). Live pull fails closed without env. Does not write DF or GHL. Live list/get stays off.
Native /setup/[token] is primary post-pay intake.


### Zapier

Zero files named zapier. Zapier is policy + Grants Pay inbound webhook only:

- docs/INTEGRATIONS.md: Zap 374413762 stays OFF. Zap 376135109 is one-contact-write (GHL ops, not OS code).
- docs/PAYMENTS.md: Zapier Commas app is triggers-only; cannot mint pay links. Optional mark-paid webhook.
- src/app/api/webhooks/grants-pay/route.ts: source may be zapier or ghl; secret env GRANTS_PAY_INBOUND_WEBHOOK_SECRET.
- src/lib/payments/inbound-webhook.ts: implementation.
- src/lib/disputes/channels.ts: DF supported API described as Zapier inbound/write only; Zap 374413762 stays OFF.

Do not turn Zap 374413762 on as a mortgage bus.

---

## 10. package.json key deps

name: grants-co-os 0.1.0. Next 16.3.1, React 19.2.8, Prisma 7.9.1.

dependencies: @modelcontextprotocol/sdk, @prisma/adapter-better-sqlite3, @prisma/adapter-pg, @prisma/client, bcryptjs, better-sqlite3, clsx, date-fns, dotenv, jose, lucide-react, nanoid, next@16.3.1, pg, react, react-dom, uuid, zod

devDependencies: @tailwindcss/postcss, type packages, @vitejs/plugin-react, eslint, eslint-config-next@16.3.1, prisma, tailwindcss@4, tsx, typescript, vitest

Scripts that matter: dev, build (runs scripts/prisma-generate.mjs), db:*, ghl:inbound-*, df:inbound-attach, deploy:production, owner:setup-link.

No AWS SDK, no Cognito Identity SDK, no S3 client, no Zapier SDK.


---

## 11. Identity + service constants a cloud agent must reuse

src/lib/clients/identifiers.ts CLIENT_IDENTIFIER_PROVIDER:
GHL, DISPUTEFOX, CREDIT_REPAIR_CLOUD, SMARTCREDIT, CLOUD_TAX_OFFICE, COGNITO, SBTPG, PAYMENT, COMMAS.

src/lib/clients/service.ts:
createClient() — duplicate check; default stage from schema (NEW_ENROLLMENT)
attachServiceToClient()
attachExternalIdentifier()

src/lib/clients/onboarding.ts + onboarding-runtime.ts:
MASTER_ONBOARDING_ITEMS — do not invent a second checklist path.

prisma/seed.ts Service:
code CREDIT_OPT, name Credit Optimization Service, basePriceCents 75000.

Seed staff: Charles OWNER, Simon CUSTOMER_SERVICE, Jona FILE_PREPARER, Donna CLIENT.

---

## 12. Cleanest insertion point (do this, not a rewrite)

OS architecture (docs/ARCHITECTURE.md): modular layer; third parties never own master identity. Roadmap phase 4 already has Client Experience (portal PWA). Payments are priority 1 — do not mutate ledgers except through src/lib/payments.

### Staff desk — Mortgage Readiness module

Insert a first-class staff desk parallel to Tax and Credit, not nested inside DisputeFox.

Credit (/credit/*) is bureau/dispute workspaces. Tax (/tax/*) is Cloud Tax / Cognito / SBTPG. Mortgage readiness is a product line that already has acquisition vocabulary (MORTGAGE_PARTNER, PARTNER_TYPES.MORTGAGE) but no desk.

Copy the Tax module shape:

| Layer | Existing analog | Add |
|---|---|---|
| App routes | src/app/(staff)/tax/** | src/app/(staff)/mortgage/page.tsx (plus [clientId] if needed) |
| Domain lib | src/lib/tax/ | src/lib/mortgage/ (catalog, statuses, access) |
| Nav | TAX_NAV / CREDIT_DISPUTES_NAV in src/lib/nav/role-nav.ts | MORTGAGE_NAV + hasMortgageNav(role) (same roles as credit/tax: OWNER, ADMIN, CS, FILE_PREPARER) |
| Desktop sidebar | getDesktopNav | New group or under ops/finance — do not hide it only in More |
| Client 360 | src/app/(staff)/clients/[id]/page.tsx | A Mortgage Readiness section on the existing 360 |
| Permissions | src/lib/rbac/permissions.ts | Reuse VIEW_CLIENT / MANAGE_OPERATIONS; add VIEW_MORTGAGE / MANAGE_MORTGAGE if a tighter gate is needed |
| Prisma | Service + ClientService + optional new models FK clientId | New Service.code (e.g. MORTGAGE_READY) — never a second Client table |
| Identifiers | src/lib/clients/identifiers.ts | Add provider only if an external LOS/CRM id exists |
| Tests | tests/tax-workspaces.test.ts, tests/role-nav.test.ts | Mirror those, plus permissions |

Do not put the staff module under /credit/ (wrong product) or /tax/cognito (Cognito Forms is tax intake).
Do not iframe a new vendor as the primary UX unless following portal-desks.ts (official URL last step, no scrape, no cookie proxy).


### Client application portal

Two existing patterns — use both, do not invent a third auth system:

1. Logged-in client PWA — extend src/app/(portal)/portal/
   Add src/app/(portal)/portal/mortgage/page.tsx (or /portal/apply) and a nav item in portal/layout.tsx. Layout already forces role === CLIENT.

2. Unauthenticated application / intake — clone /setup/[token]
   Files: src/app/setup/[token]/page.tsx + src/app/api/setup/[token]/route.ts + model OnboardingToken.
   Public, token-gated, updates the existing master only (stage INTAKE_COMPLETE).
   For applications before a Client exists, still go through createClient() in src/lib/clients/service.ts (duplicate email/phone guard) — same one-human-one-master rule.

Public pay already lives at /pay/[invoiceNumber]. If mortgage has a fee, create a Service + invoice via Grants Pay (src/lib/payments/), not a new processor.

There is no existing /apply route. Adding /apply next to /setup and /pay (outside (staff)) is the clean public URL. Do not put apply under (staff).

### What not to do

- Do not greenfield a new Next app.
- Do not create a second person table.
- Do not invent resources/brand/emblem.png.
- Do not route mortgage comms through a second SMS provider — GHL remains the only phone/SMS/email backend.
- Do not enable Zap 374413762.
- Do not scrape Cognito/GHL/DisputeFox.
- Do not put SBTPG/taxpayer copy on /home.
- Do not assume document upload works.

### Suggested first PR file set (for a cloud agent)

```
prisma/schema.prisma                         (+ postgres twin)  new models + Service seed code
src/lib/mortgage/**                          domain
src/lib/nav/role-nav.ts                      MORTGAGE_NAV
src/lib/rbac/permissions.ts                  if new perms
src/app/(staff)/mortgage/page.tsx            staff desk
src/app/(staff)/clients/[id]/page.tsx        360 section
src/app/(portal)/portal/mortgage/page.tsx    logged-in client
src/app/(portal)/portal/layout.tsx           nav
src/app/apply/page.tsx                       public apply (or /apply/[token] like setup)
src/app/api/mortgage/**                      APIs
tests/role-nav.test.ts + new mortgage tests
docs/                                        short module doc
```

Use /brand/logo.png via BrandLogo on every new screen.

---

## 13. Quick answers for the parent agent

| Question | Answer |
|---|---|
| Repo reachable? | Yes (public main @ 2183e7f). gh not authed; used raw + ungh. |
| Prisma models | 71 models listed in section 2.1. Key: User, Client, ClientIdentifier, Service, ClientService, Document, OnboardingItem, OnboardingToken, Partner, DisputeCase, PaymentRequest. |
| Client-facing routes | /portal, /portal/credit, /portal/pulse, /portal/payments, /portal/documents, /pay/[invoiceNumber], /setup/[token]. No /apply. |
| Brand asset paths | public/brand/logo.png (wordmark), public/brand/logo-footer.png, public/brand/icon-mark.png, public/brand/hero-atmosphere.jpg. resources/brand/emblem.png NOT FOUND. |
| Insertion point | Staff: new /mortgage desk cloned from /tax + Client 360 section. Client: /portal/mortgage + public /apply or /setup-style token. Identity via existing Client + new Service.code. |
