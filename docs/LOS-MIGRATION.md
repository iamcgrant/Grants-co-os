# LOS migration package — grants-co-os

Target: `iamcgrant/grants-co-os` (`main` inventoried at `2183e7f`).
Source pack: `/workspace/mortgage-readiness-os` (completed backend).

**Do not redesign. Do not add features. Do not build apply pages. Do not merge to main. Do not run production migrate. Do not live-write GHL. Do not invent NMLS IDs. Do not generate a logo.**

This package copies the completed MORTGAGE_LOS module into the existing OS. Auth stays `gc_session` + `requireUser`. Prisma twins stay SQLite local / Postgres prod. `Document` stays metadata-only.

Pack `src/los/*` lands at OS `src/lib/los/*` (OS convention; `@` → `./src`).

---

## 1. Complete file manifest

### 1.1 Files to CREATE in grants-co-os

| Pack source | Destination in grants-co-os |
|---|---|
| `src/los/loan-number.ts` | `src/lib/los/loan-number.ts` |
| `src/los/ssn-vault.ts` | `src/lib/los/ssn-vault.ts` |
| `src/los/dpa.ts` | `src/lib/los/dpa.ts` |
| `src/los/compliance.ts` | `src/lib/los/compliance.ts` |
| `src/los/lifecycle.ts` | `src/lib/los/lifecycle.ts` |
| `src/los/section-store.ts` | `src/lib/los/section-store.ts` |
| `src/los/errors.ts` | `src/lib/los/errors.ts` |
| `src/los/api-contract.ts` | `src/lib/los/api-contract.ts` |
| `src/los/application-contract.ts` | `src/lib/los/application-contract.ts` |
| `src/los/qualification.ts` | `src/lib/los/qualification.ts` |
| `src/los/service.ts` | `src/lib/los/service.ts` |
| `drop-in/src/app/api/los/_handler.ts` | `src/app/api/los/_handler.ts` |
| `drop-in/src/app/api/los/applications/route.ts` | `src/app/api/los/applications/route.ts` |
| `drop-in/src/app/api/los/applications/[id]/route.ts` | `src/app/api/los/applications/[id]/route.ts` |
| `drop-in/src/app/api/los/applications/[id]/compliance/route.ts` | `src/app/api/los/applications/[id]/compliance/route.ts` |
| `drop-in/src/app/api/los/applications/[id]/sections/[section]/route.ts` | `src/app/api/los/applications/[id]/sections/[section]/route.ts` |
| `drop-in/src/app/api/los/applications/[id]/submit/route.ts` | `src/app/api/los/applications/[id]/submit/route.ts` |
| `drop-in/src/app/api/los/applications/[id]/qualification/route.ts` | `src/app/api/los/applications/[id]/qualification/route.ts` |
| `drop-in/src/components/los/LosBrandHeader.tsx` | `src/components/los/LosBrandHeader.tsx` |
| `tests/qualification.test.ts` | `tests/los-qualification.test.ts` |
| `tests/loan-file.test.ts` | `tests/los-loan-file.test.ts` |
| `tests/section-save.test.ts` | `tests/los-section-save.test.ts` |
| `tests/compliance-gate.test.ts` | `tests/los-compliance-gate.test.ts` |
| `tests/submit.test.ts` | `tests/los-submit.test.ts` |
| `tests/ssn-vault.test.ts` | `tests/los-ssn-vault.test.ts` |
| `tests/dpa.test.ts` | `tests/los-dpa.test.ts` |
| `04-prisma-schema.prisma` | APPEND into both Prisma twins (see §2). Not a standalone dest file. |
| `36-compliance-and-dpa.md` | `docs/LOS-COMPLIANCE.md` |
| `MIGRATION-PACKAGE.md` | `docs/LOS-MIGRATION.md` |
| (new, 8–15 lines) | `docs/LOS.md` |

### 1.2 Files to MODIFY in grants-co-os

| Destination | Change |
|---|---|
| `prisma/schema.prisma` | Append all enums/models from `04-prisma-schema.prisma`. Patch existing `Client`, `User`, `Document` relation lists. Do not recreate those three models. |
| `prisma/schema.postgres.prisma` | Identical append + identical relation patches. |
| `prisma/seed.ts` | Add `Service.code = "MORTGAGE_LOS"` (do not overload `CREDIT_OPT`). Add `IdSequence` `{ name: "gc_loan", value: 0 }`. Add `LenderOrgSettings` with `nmlsId: null`, `companyNmls: null`, `licensedStates: []`. |
| `.env.example` | Add `MORTGAGE_PII_KEY=` and `MORTGAGE_GHL_WRITES_ENABLED=false`. Do not invent a live key. |
| `.env.production.example` | Same two keys, still empty. Do not put a real key in git. |

### 1.3 Import rewrite (required, mechanical)

| Pack | Repo |
|---|---|
| `from "../src/los/..."` (tests) | `from "../src/lib/los/..."` |
| `from "@los/service"` / `"@los/errors"` (`_handler.ts`) | `from "@/lib/los/service"` / `"@/lib/los/errors"` |
| relative `../_handler` in drop-in routes | keep relative under `src/app/api/los/` |

OS already has vitest alias `"@"` → `./src`. Do not copy pack `package.json`, `tsconfig.json`, or `vitest.config.ts`.

### 1.4 Do NOT copy

| Pack path | Reason |
|---|---|
| `src/readiness-engine.ts`, `tests/readiness-engine.test.ts` | Intelligence overlay. Not this land. |
| `21-los-operating-schema.prisma` | Superseded. Canonical is `04`. |
| `33-application-schema-patches.prisma` | Already merged into `04`. |
| Pack `package.json` / `tsconfig.json` / `vitest.config.ts` / `package-lock.json` | OS already has Prisma 7, Next 16, vitest, zod. |
| Cognito HTML/JS extracts, screenshots, generated logo binaries | Reference only. Logo in OS is `public/brand/logo.png`. |
| Apply/portal/staff page files | Frontend waits until these tests pass in the OS repo. `LosBrandHeader` only. |
| New `Role` enum values | LO / Processor / UW are `LoanStaffAssignmentType`, not `Role`. |

### 1.5 Existing OS files to USE, not replace

| OS file | Use |
|---|---|
| `src/lib/auth/session.ts` (`requireUser`, cookie `gc_session`) | Gate every `/api/los/*` route. |
| `src/lib/db/prisma.ts` | Persistence. |
| `src/lib/rbac/permissions.ts` | `CLIENT` may hit borrower routes for their `Client`. Do not add LOAN_OFFICER to `Role`. |
| `src/components/brand/BrandLogo.tsx` | Official wordmark. `LosBrandHeader` points at `/brand/logo.png`. Do not edit BrandLogo sizes. |
| `public/brand/logo.png` | Only logo. Never generate/trace/SVG. |
| `prisma/seed.ts` IdSequence `grants_client` | Pattern to copy for `gc_loan`. |
| `IdSequence` model | Already exists. Add a row, not a new model. |


---

## 2. Database migration steps

### 2.1 Prisma schema changes

1. Open `prisma/schema.prisma` and `prisma/schema.postgres.prisma`.
2. Append the full contents of pack `04-prisma-schema.prisma` after the existing 71 models. Keep the pack file header comments.
3. Patch (do not duplicate) existing models:

Client: add mortgageApplications MortgageApplication[] and ssnVaults SsnVault[].
User: add mortgageAssignments, mortgageNotes, mortgageAuditEvents (MortgageAuditActor), underwritingDecisions (UwDecisionActor), charlesUwGates (CharlesUwGate).
Document: add mortgageFiles MortgageDocumentFile[] and loanConditionDocs LoanCondition[].

4. Confirm `prisma.config.ts` still switches schema by DATABASE_URL (sqlite vs postgres). Do not change it.
5. Generator output stays `src/generated/prisma`.

### 2.2 New enums (append)

MortgagePipelineStage, MortgageQualitativeStatus, MortgageApplicationStep, BorrowerRoleKind, CitizenshipResidency, MaritalStatusKind, HousingTenureKind, EmploymentSituation, EmploymentTypeKind, AssetAccountType, LiabilityTypeKind, LoanPurposeKind, DownPaymentSourceKind, PropertyTypeKind, OccupancyKind, CreditProgramPath, MortgageCreditItemKind, MortgageDocumentPackage, YesNoUnknown, ComplianceDisclosureType, ReoDisposition, LoanOriginationStage, LoanStaffAssignmentType, ConditionTiming, ConditionStatus, UnderwritingDecisionKind, AppraisalOrderStatus, GuidelineSetKind, LosAutomationEventType, ApplicationSectionCode, ApplicationSectionStatus.

### 2.3 New entities / tables (append)

URLA / application: MortgageApplication, SsnVault, MortgageBorrower, LegalAcknowledgement, ComplianceAcknowledgment, Employment, IncomeSource, AssetAccount, Liability, MortgageGiftGrant, MortgageOtherAsset, MortgageReo, MortgageCreditItem, Declaration, PropertyGoal, MortgageDocumentFile, AiReview, ReadinessScore, PipelineEvent, MortgageAuditEvent, MortgageStaffAssignment, MortgageApplicationNote, BorrowerAddressHistory, ApplicationSectionState.

LOS operating: LenderOrgSettings, LoanFile, LoanStageEvent, ConditionCatalogItem, LoanCondition, BorrowerActionPlan, ActionPlanItem, QualificationSnapshot, UnderwritingDecision, AppraisalOrder, ProcessingChecklistItem, GrantsReadinessTrack, LosAutomationEvent.

LoanFile columns already in 04: dpaSelected, dpaAmountCents, dpaSelectedAt, paymentAcknowledged, paymentAcknowledgedAt, agreementVersion, servicePackageAmountCents.

LegalAcknowledgement includes loanAuditLenderRights. ComplianceAcknowledgment.borrowerId stores Client.id. Unique (applicationId, disclosureType).

LosAutomationEventType includes DPA_SELECTED.

SsnVault.ssnCiphertext is Bytes. Persist the AES payload string (iv.tag.ciphertext hex) as UTF-8 bytes. ssnLast4 is the only SSN field that may appear in GET JSON.

### 2.4 Local database commands

Use the existing OS scripts from repo root with sqlite DATABASE_URL:

1. db:generate (scripts/prisma-generate.mjs)
2. db:migrate named los_mortgage against prisma/schema.prisma

Skip db:migrate:production and scripts/migrate-production.sh. Neon sync is gated. If generate fails, stop.

### 2.5 Seed (local)

In prisma/seed.ts, next to existing idSequence.createMany and service.create:

- IdSequence row name gc_loan value 0 (alongside grants_client and invoice)
- Service code MORTGAGE_LOS, name Mortgage Loan Origination, basePriceCents 0. Do not overload CREDIT_OPT.
- LenderOrgSettings with licensedStates empty array; nmlsId and companyNmls null.

Then local db:seed only (SEED_PASSWORD already required).

### 2.6 Required environment variables

- MORTGAGE_PII_KEY: required for any SSN write/read in the app. 32 raw bytes, or base64 of 32 bytes. Generate locally. Never paste the live key in chat, git, or this package.
- MORTGAGE_GHL_WRITES_ENABLED=false
- DATABASE_URL already exists (local file:./dev.db)
- AUTH_SECRET already exists

Tests may pass a Buffer into createMortgageLosService({ piiKey }) and do not need a committed key.


---

## 3. Service integration steps

### 3.1 How to add the LOS service layer

1. Copy every src/los/*.ts file listed in section 1.1 into src/lib/los/ unchanged except import paths.
2. Keep MortgageLosService method names and HTTP error codes (COMPLIANCE_REQUIRED 409, INVALID_STAGE 422, CLIENT_REQUIRED 422). Tests depend on them.
3. service.ts is an in-memory store used by unit tests. That is the contract.
4. For live routes, persist with Prisma using those same methods and domain functions. Do not invent a second lifecycle.

Minimum Prisma writes:

- createApplication: MortgageApplication, LoanFile (APP_STARTED, GC-LN via IdSequence gc_loan), ApplicationSectionState (COMPLIANCE EMPTY; others BLOCKED), LosAutomationEvent LOAN_APP_STARTED
- acknowledgeCompliance: ComplianceAcknowledgment rows; LegalAcknowledgement packet; LoanFile DPA plus payment fields; DPA_SELECTED event if Yes
- patchSection: assertCanPatch then URLA entities plus ApplicationSectionState. BORROWER SSN goes to SsnVault only
- submitApplication: assertCanSubmit; LoanFile.originationStage APP_STARTED to APP_SUBMITTED; LoanStageEvent; LOAN_APP_SUBMITTED
- createQualificationSnapshot: calculateQualification then QualificationSnapshot (cents/bps)
- getApplication: last-4 only; never ciphertext or full SSN

GC-LN: read IdSequence gc_loan, nextSequence / formatLoanNumber, write incremented value. Same pattern as grants_client. Not an NMLS id.

GHL: LosAutomationEvent GHL_STUB only. If MORTGAGE_GHL_WRITES_ENABLED is not exactly true, no network.

### 3.2 API routes to register

App Router files equal routes. No extra router config.

- POST /api/los/applications -> src/app/api/los/applications/route.ts
- GET /api/los/applications/:id -> src/app/api/los/applications/[id]/route.ts
- POST /api/los/applications/:id/compliance -> applications/[id]/compliance/route.ts
- PATCH /api/los/applications/:id/sections/:section -> applications/[id]/sections/[section]/route.ts
- POST /api/los/applications/:id/submit -> applications/[id]/submit/route.ts
- POST /api/los/applications/:id/qualification -> applications/[id]/qualification/route.ts

After copy, wrap with requireUser from src/lib/auth/session.ts (same as src/app/api/clients/route.ts).

- Role.CLIENT: only their Client / application.
- Do not add NextAuth or AWS Cognito.

Rewrite _handler.ts imports to @/lib/los/service and @/lib/los/errors. Keep toHttpResponse.

### 3.3 Existing app dependencies required

Already in OS package.json (do not add packages unless generate/test proves a hole):

- next 16.3.1, zod, jose (session), bcryptjs
- Prisma 7 client plus sqlite and pg adapters
- vitest, tsx

Node crypto is used by ssn-vault.ts (no extra lib).


---

## 4. Test migration

### 4.1 Tests created (copy and rename)

| Pack | Destination | What it proves | Count |
|---|---|---|---|
| tests/qualification.test.ts | tests/los-qualification.test.ts | cents/bps DTI/LTV; no divide-by-zero | 2 |
| tests/loan-file.test.ts | tests/los-loan-file.test.ts | create LoanFile APP_STARTED plus GC-LN-000001 | 3 |
| tests/section-save.test.ts | tests/los-section-save.test.ts | save/resume after compliance | 1 |
| tests/compliance-gate.test.ts | tests/los-compliance-gate.test.ts | PATCH before ack returns 409 COMPLIANCE_REQUIRED | 2 |
| tests/submit.test.ts | tests/los-submit.test.ts | APP_STARTED to APP_SUBMITTED; 409 missing LOAN_AUDIT_LENDER_RIGHTS; 422 if not APP_STARTED | 3 |
| tests/ssn-vault.test.ts | tests/los-ssn-vault.test.ts | AES-256-GCM; GET last-4 only | 3 |
| tests/dpa.test.ts | tests/los-dpa.test.ts | Yes = 180000 plus copy plus event; No stored, not a blocker | 3 |

Rewrite test imports from ../src/los/ to ../src/lib/los/.

### 4.2 How to run in the main repo

npx vitest run tests/los-*.test.ts

OS package.json test script is vitest run and already includes tests/**/*.test.ts. fileParallelism is false.

### 4.3 Expected passing results

7 files, 17 tests, all pass. Existing OS tests must still pass. Do not copy readiness-engine tests this land.


---

## 5. Environment / setup requirements

### 5.1 MORTGAGE_PII_KEY

- AES-256-GCM. Key is 32 bytes (raw or base64/base64url).
- Ciphertext encoding: iv.tag.ciphertext (hex). IV 12 bytes, tag 16 bytes.
- GET / public borrower: ssnLast4 only. Never log plaintext SSN.
- Local: generate 32 random bytes as base64 into .env only.
- Preview/prod: host secret store. Do not invent a key in code.
- service.ts test fallback Buffer.alloc(32, 7) is test-only. App boot for real SSN writes must fail closed if the env key is missing.

### 5.2 Encryption requirements

- Algorithm: AES-256-GCM via node:crypto.
- SSN digits-only 9 before encrypt.
- SsnVault fields: ssnCiphertext, ssnLast4, ssnKeyVersion. No plaintext ssn column.

### 5.3 Object storage requirements

None this land. OS Document is metadata (storageKey, category). No object-store adapter exists. Do not add one. MortgageDocumentFile points at Document. Uploads stay out of this land.

### 5.4 Other secrets / config

- MORTGAGE_GHL_WRITES_ENABLED=false. No live GHL.
- NMLS: LenderOrgSettings empty. Do not invent IDs.
- Agreement version: 2026-08-23-cognito-derived-draft-v1 (DRAFT counsel).
- Logo: public/brand/logo.png via LosBrandHeader (desktop 180px / tablet 148px / mobile 120px, height auto, object-fit contain). No apply pages.
- apply.grantandconsultants.com is example only. Sprint 1 path is /apply on existing OS later.


---

## 6. Implementation order (Cursor)

Apply in this order. Do not skip ahead to routes before generate and unit tests.

1. Branch from current main. Name feat/mortgage-los-backend. No merge. No production deploy.
2. Env placeholders: append to .env.example and .env.production.example only: MORTGAGE_PII_KEY= and MORTGAGE_GHL_WRITES_ENABLED=false. Put a real key in local .env only. Never commit it.
3. Schema: append 04-prisma-schema.prisma to both Prisma twins. Patch Client / User / Document relations. Do not touch Role. Do not append 21-los-operating-schema.prisma.
4. Generate the Prisma client using the existing db:generate script. Stop if this fails.
5. Local sqlite migrate named los_mortgage. Do not run production Neon sync.
6. Seed rows: MORTGAGE_LOS service, gc_loan sequence, empty LenderOrgSettings. Local seed if you use seed.
7. Domain files: copy src/los/*.ts to src/lib/los/ (manifest section 1.1). Import paths only.
8. Unit tests: copy seven test files, rewrite ../src/los/ to ../src/lib/los/. Run section 4.2. Expect 17 passed. Do not continue if red.
9. API routes: copy drop-in handlers to src/app/api/los/. Rewrite @los/ to @/lib/los/. Wrap with requireUser(). Point persistence at Prisma using the same service methods (in-memory remains for unit tests).
10. Brand header only: copy LosBrandHeader.tsx to src/components/los/LosBrandHeader.tsx. Use /brand/logo.png. Do not add /apply pages.
11. Docs: docs/LOS.md (pointer), docs/LOS-COMPLIANCE.md, docs/LOS-MIGRATION.md.
12. Full test run: LOS 17 green and existing OS tests still green.
13. Open a PR. Do not merge. Production Neon / Vercel stay gated.

If anything in steps 4 through 8 fails, fix that step. Do not start frontend.

---

## Cursor copy checklist (no behavior change)

- Both Prisma files appended from 04 only
- Client / User / Document relations patched
- Service MORTGAGE_LOS plus IdSequence gc_loan
- MORTGAGE_PII_KEY in example env files, empty
- src/lib/los/ copied
- src/app/api/los/ copied and authed
- tests/los-*.test.ts 17 passing
- LosBrandHeader copied, no pages
- No GHL writes, no NMLS IDs, no logo generation, no production migrate
