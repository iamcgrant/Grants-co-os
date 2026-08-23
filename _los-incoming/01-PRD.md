# 01 — Product Requirements Document
# Grants & Co LOS (Mortgage Loan Origination System)

**Status:** SPEC. Milestone 1 = domain/ops. Not live. Do not deploy.  
**Product:** lender-style LOS module inside https://github.com/iamcgrant/grants-co-os  
**Sources:** `00-source-field-extract.md`, `00-field-catalog.json`, `00-os-inventory.md` (main SHA `2183e7f`).  
**URLA/1003 PDF:** application **data structure** reference. Not the product. The product is the **workflow around** that application.  
**Cognito form:** one requirements source (legal, credit-repair vs MyFICO, DPA $1,800, Taylor Carroll, $1,800 cancel fee). Not the product.

No portal wireframes, CSS, or page mockups in this document.

---

## 1. Vision

Grants & Co Consultants runs a **Mortgage Loan Origination System**: take a URLA-shaped application, originate a `LoanFile`, process conditions, underwrite, qualify with integer math, and move the file through a lender-style pipeline to clear-to-close / approve / deny / fund / close.

Two tracks run on every file:

| Track | System of record | Decides the loan? |
|---|---|---|
| **Origination** | `LoanFile.originationStage` | Yes (with Charles production gate on APPROVE/DENY) |
| **Grants proprietary** | `GrantsReadinessTrack` (credit / docs / prep + internal 0–100) | No. Overlay only. |

Licensing: `LenderOrgSettings` empty by default. Going live as an originator is a Charles/counsel/licensing gate. Software is LOS-shaped either way. Do not invent an NMLS number. Do not claim already licensed.

---

## 2. Product identity

| | |
|---|---|
| Company | Grants & Co Consultants |
| Product | Grants & Co LOS |
| Insertion | module in grants-co-os — `src/lib/los/`, staff `/los`, borrower `/apply` + `/portal/loan` (routes later; not milestone 1) |
| Stack | Next.js 16 App Router `src/app/`, Prisma 7, SQLite local, Neon Postgres prod |
| Auth | existing `gc_session` (jose). Not NextAuth. Not AWS Cognito. |
| Identity | ONE HUMAN = ONE `Client`. Application → Client. LoanFile → Application. |
| Service catalog | `Service.code = MORTGAGE_LOS`. Do not overload `CREDIT_OPT`. |
| Brand (later UI) | `public/brand/logo.png` via `BrandLogo.tsx` only |
| Money | integer cents |
| Ratios / note rate | integer bps (`28.00%` DTI = `2800`; `6.500%` note = `650`) |

---

## 3. Personas (ops)

| Persona | Existing `Role` | LOS assignment | Job |
|---|---|---|---|
| **Borrower** | `CLIENT` | none | Completes URLA data packets, signs legal, uploads docs, works borrower-owned conditions (action plan). |
| **Loan Officer** | typically `CUSTOMER_SERVICE` or `MANAGER` | `LOAN_OFFICER` | Owns origination relationship, initial review, submission completeness, borrower contact via GHL (stub sprint 1). |
| **Processor** | typically `FILE_PREPARER` | `PROCESSOR` | Processing checklist, third-party orders (appraisal stub), condition chase, file to UW. |
| **Underwriter** | typically `MANAGER` / `ADMIN` | `UNDERWRITER` | Conditions (PTD/PTC/PTF), qualification snapshot, UW decision record. Cannot production-commit APPROVE/DENY until Charles gate lifts. |
| **Owner** | `OWNER` (Charles) | optional overlay | Licensing settings, guideline limits, production APPROVE/DENY gate, GHL write-gate, deploy gate. |

Co-borrower is a second `Client` (second human) on the same `MortgageApplication`. MARKETING has no loan-file access.

---

## 4. Journeys (handoffs, not screens)

### 4.1 Borrower origination journey

1. Legal acknowledgements recorded (`LegalAcknowledgement`; Cognito-derived terms including $1,800 realty cancel fee, nonrefundable, no-guarantees, Taylor Carroll, separate lender identity, credit-conduct lock, DPA $1,800 opt-in, typed+drawn e-sign, IP/UA). Blocks application data until stored.
2. URLA data packets persist (profile, employment/income, assets, liabilities, credit program, property/loan needs, declarations, documents). Autosave is a data requirement (Cognito SaveAndResume was false).
3. Credit program: repair → Credit Hero proof + DisputeFox stub; else MyFICO proof. Copy may mention 620 as **instruction**; Charles confirms before it is a hard gate. 620 is not a qualification snapshot.
4. Submit → `LoanFile` created if missing, `originationStage = APP_SUBMITTED`, event `LOAN_APP_SUBMITTED`.
5. Borrower action plan = borrower-owned conditions in OPEN/REQUESTED. Completing uploads moves RECEIVED (processor/UW review).

### 4.2 Internal origination journey

1. **LO — INITIAL_REVIEW:** completeness vs URLA required set + legal. Assign processor. May return to borrower (conditions) or advance PROCESSING.
2. **Processor — PROCESSING:** checklist, VOE/VOD/VOI/docs, appraisal stub, title/HOI placeholders, qualification recompute. Submit to UW.
3. **UW — SUBMITTED_TO_UW:** run/freeze `QualificationSnapshot`. Open PTD conditions. `CONDITIONAL_APPROVAL` or `CONDITIONS_OUTSTANDING`.
4. Conditions clear → `CLEAR_TO_CLOSE`. UW records `APPROVE` / `DENY` / `SUSPEND` / `CONDITIONAL_APPROVE`. If `productionGateRequired` (default true), stage does not become `APPROVED`/`DENIED` until Charles releases.
5. After release: `APPROVED` → `FUNDED` → `CLOSED`, or `DENIED` / `WITHDRAWN`.
6. Parallel: Grants track `creditReady` / `docsReady` / `prepReady` + internal score. Never writes origination stage by itself.

SLAs and who may move stages: `15-origination-pipeline.md`.

---

## 5. Feature requirements (MoSCoW) — domain

### Must (milestone 1 / sprint 1)

- Prisma: keep URLA models; append `LoanFile` + lifecycle + conditions + qualification + UW + readiness overlay + `LenderOrgSettings` (empty NMLS).
- Dual-track state machine with actor rules and audit (`LoanStageEvent`, `MortgageAuditEvent`).
- Qualification engine: front DTI, back DTI, LTV/CLTV, reserves months, loan amount; cents integers; conventional 28/36 **defaults** Charles can change; never labeled a credit score.
- Condition catalog + statuses Open → … → Cleared/Waived/Rejected; PTD/PTC/PTF; borrower action plan.
- Document model wrapping existing `Document` + `MortgageDocumentFile`, linkable to `LoanCondition`.
- RBAC mapping + assignment types LO / Processor / UW. Charles production gate on APPROVE/DENY.
- Automation event log (`LosAutomationEvent`). GHL/DisputeFox stubs. No live GHL.
- Legal acknowledgements from Cognito-derived draft (`14-legal-agreement.draft.md`) as **data** required before submit.
- Vaulted SSN (`SsnVault`). Last-4 only in any later UI. Never log full SSN.

### Should (later sprints)

- Live GHL contact overlay after write-gate.
- DisputeFox file open when `includeCreditRepair=true`.
- Appraisal/title vendor adapters (replace stubs).
- LLM narrative on missing-file rules (forbidden language tests). Charles still gates production UW.

### Will not (ever in this blueprint’s gates)

- Production deploy / merge to main without Charles.
- Invent NMLS, agency approval, or sample-PDF PII.
- Present calcs as a credit score or Grants overlay score as the loan decision.
- NextAuth, AWS Cognito, second SMS provider, Credit Karma scrape.
- Fake logo. Fake law firm.

---

## 6. Technical requirements

- Domain lives in `src/lib/los/**` (pipeline, qualification, conditions, permissions, documents, events).
- APIs later: `src/app/api/los/**` and existing `src/app/api/mortgage/**` as aliases if a branch already started.
- Dual Prisma schemas. Money `Int` cents. Ratios `Int` bps.
- Files: `Document.storageKey`; no object-store adapter exists today (`00-os-inventory.md` §8). Milestone 1 specifies the model; upload adapter is later.
- Auth: `gc_session`. Do not add Role values `LOAN_OFFICER` etc.; use `LoanStaffAssignmentType`.
- Logging: never SSN, never full signature bytes, never GHL/DF keys, never NMLS invented.

---

## 7. Security requirements

- SSN: AES-256-GCM; `ssnCiphertext` + `ssnLast4` + `ssnKeyVersion`; no plaintext column; no query-string SSN.
- Legal row immutable after insert (IP, UA, signedAt, documentVersion).
- EXAMPLE fixtures `exampleData=true` only. No sample-PDF person.
- Uploads when adapter exists: jpg/jpeg/png/pdf, max 10 per field (Cognito flags). Block executables.
- Staff APIs require non-CLIENT. Borrower sees own application + own action-plan conditions only.
- `LenderOrgSettings` writes: OWNER only.

---

## 8. Document model (ops)

Layers:

1. **OS `Document`** — metadata (`storageKey`, `category`, `sourceSystem`). No blob adapter yet.
2. **`MortgageDocumentFile`** — application-scoped package: IDENTITY / INCOME / ASSETS / CREDIT / OTHER (`MortgageDocumentPackage`).
3. **`LoanCondition.documentId`** — a condition is satisfied by a Document when status ≥ RECEIVED.

Required at submit (from Cognito FOUND): government ID; Credit Hero proof if repair=Yes; MyFICO proof if repair=No (schema was not required; **OS treats path-appropriate proof as required**). Implied later via conditions: paystubs/W-2/returns (VOI/tax transcripts), bank statements (VOD), gift letter, HOI, appraisal, title.

Catalog codes (seed): see `17-conditions-workflow.md`.

---

## 9. Automation requirements

Sprint 1: **record** `LosAutomationEvent` only. No outbound HTTP to GHL. DisputeFox stub stores id only.

Event types: `LosAutomationEventType` in Prisma. Payload JSON must not include SSN or signature bytes.

GHL = CRM overlay (location `NsmlbLVNr4SBJNC8gnrn` when gate lifts). DisputeFox = credit-repair track. Zap 374413762 stays OFF. Client messages only via GHL when live.

---

## 10. Calculations engine requirements (summary)

Full spec: `16-qualification.md`.

Must compute and persist `QualificationSnapshot`: front-end housing DTI, back-end total DTI, LTV, CLTV, reserves months, loan amount. Occupancy is an **input** selecting guideline row, not a formula. Conventional front/back limits default **2800 / 3600 bps**. Placeholders for FHA/VA/USDA/PORTFOLIO exist as empty-or-default rows Charles edits. Selecting a `guidelineSet` is **not** agency approval.

Never name outputs “score.” Never copy `GrantsReadinessTrack.score` into the snapshot.

---

## 11. Success metrics (do not invent current numbers)

- % submitted applications with `LoanFile` + legal row
- Median time APP_SUBMITTED → SUBMITTED_TO_UW
- PTD conditions aged past SLA
- Qualification snapshots computed on every UW submit
- Production-gated UW decisions pending Charles
- Grants track vs origination stage divergence (overlay lag)

## 12. Open Charles/counsel decisions

- Populate `LenderOrgSettings` (NMLS, licensed states) — empty until then
- Lift production APPROVE/DENY gate
- MyFICO 620 hard gate vs instruction
- DPA $1,800 and cancel fee still current?
- Taylor Carroll named in production legal?
- Guideline limits beyond conventional 28/36 defaults
