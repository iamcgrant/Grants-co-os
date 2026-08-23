# Borrower application — build specification (data contract)

UI is not this file’s job. This is what engineering implements against.

## Host

Sprint 1 path: `https://os.grantandconsultants.com/apply` (existing OS).
`apply.grantandconsultants.com` is an example hostname. Do not create DNS until Charles asks. Deep link: `/apply?token=` optional staff-issued OnboardingToken.

## Funnel (system behavior)

1. Client opens link → `/apply` (unauthenticated).
2. Creates account: existing `POST /api/auth` email+password, `Role=CLIENT`, `Client` master (emailNormalized unique). Identity v1 = email+password + later DL upload. No third-party KYC vendor in sprint 1.
3. `POST /api/los/applications` creates `MortgageApplication` + `LoanFile` (`APP_STARTED`, `GC-LN-######`). LoanFile exists here so save/resume has a file. LO dashboard only lists `APP_SUBMITTED+`.
4. Completes URLA sections (PATCH). Autosave.
5. Signs acknowledgements (`POST .../compliance`) — **required before any 1003 PATCH**. If they somehow skip, server 409.
6. Uploads documents as REQUESTED rows appear (can overlap with sections).
7. Submit → `LoanFile.originationStage=APP_SUBMITTED` → LO/Processor queues.
8. Staff: Processing → UW → Conditions → Closing per `15-origination-pipeline.md`.

## Section order (borrower)

0 COMPLIANCE (blocked until signed)
1 BORROWER
2 CO_BORROWER (branch)
3 EMPLOYMENT (primary, then co-borrower if present)
4 ASSETS
5 LIABILITIES
6 REO
7 LOAN
8 DECLARATIONS
9 DOCUMENTS (checklist from triggers; submit allowed if required docs uploaded **or** explicitly deferred with staff chase — sprint 1: required identity + at least one income doc + at least one asset doc if accounts exist)

Field groups and required/optional: `31-urla-field-map.json`.
Schema: `04-prisma-schema.prisma` (canonical; includes patches).

## Save behavior

| Action | Writes | Event |
|---|---|---|
| Create account | User, Client | none (auth) |
| Start application | MortgageApplication, LoanFile APP_STARTED, section states BLOCKED except COMPLIANCE EMPTY | LOAN_APP_STARTED |
| Save compliance | LegalAcknowledgement; COMPLIANCE COMPLETE; unlock 1003 | ECONSENT_RECORDED |
| PATCH section | 1003 entities; ApplicationSectionState IN_PROGRESS or COMPLETE; LoanFile money fields if LOAN | APPLICATION_SAVED; SECTION_COMPLETED if complete; QUALIFICATION_RECALCULATED if income/assets/liabilities/loan |
| Add/remove co-borrower | second Client + MortgageBorrower; CO_BORROWER skip/complete | APPLICATION_SAVED |
| Upload | MortgageDocumentFile + Document metadata | DOCUMENT_UPLOADED |
| Submit | stage APP_SUBMITTED; freeze borrower 1003 writes (staff may still patch) | APPLICATION_SUBMITTED, LOAN_STAGE_CHANGED, DOCUMENT_REQUESTED remaining |

Autosave: PATCH is upsert, last-write-wins per section. Debounce is UI-only (300–800ms). Server is idempotent.

## Submit behavior

409 if COMPLIANCE not complete.
422 if any required section not COMPLETE (CO_BORROWER may be skipped).
On success: borrower cannot PATCH 1003 (403) unless staff reopens (OWNER/LO → PROCESSING? no, stay SUBMITTED until LO moves to INITIAL_REVIEW).

## Mapping confirmation

Every Charles-required section has entities:

| Section | Entity |
|---|---|
| Borrower personal/contact/address/residency/dependents/marital | MortgageBorrower, SsnVault, BorrowerAddressHistory |
| Co-borrower | same, roleKind=CO_BORROWER, second Client |
| Employment history/position/dates/income/OT/bonus/commission/self-emp/other | Employment (repeatable, endDate), IncomeSource |
| Assets checking/savings/retirement/investments/gifts/other | AssetAccount, MortgageGiftGrant, MortgageOtherAsset |
| Liabilities | Liability |
| REO + mortgage + rental | MortgageReo (disposition, mortgage*, rental*) |
| Loan purpose/amount/property/occupancy | PropertyGoal + LoanFile |
| Declarations | Declaration, MortgageCreditItem |
| Compliance / e-sign | LegalAcknowledgement |

LoanFile is updated on LOAN saves and on submit (never a second loan row).

## Disclosures and DPA (required workflow)

Legal copy is **DRAFT counsel** (`agreementVersion` default `2026-08-23-cognito-derived-draft-v1`). See `36-compliance-and-dpa.md`.

Compliance is recorded as `LegalAcknowledgement` **and** per-type `ComplianceAcknowledgment` rows (`borrowerId` = `Client.id` until a `MortgageBorrower` exists).

### Named disclosures

New `AGENT_ASSIGNMENT` copy is generic (assigned real estate professional). Do not hardcode a person. Keep `acknowledgedTaylorCarroll` on the legal row for historical Cognito mapping; `acknowledgedAgentAssignment` is the required type going forward.

`LOAN_AUDIT_LENDER_RIGHTS` (Zod: `loanAuditLenderRights` + `serviceResolutionAck`) is a **submit blocker**. Borrower acknowledges file review/audit/verification, that lenders may request more documents, that terms/approval/conditions/closing may change, that approval is not guaranteed until final lender approval, and that lender requirements control if a lender changes/modifies/delays/cancels. Service-resolution sentence is part of the same disclosure.

### Gates

| Action | Required types | Failure |
|---|---|---|
| PATCH 1003 sections | E_SIGN_CONSENT, CREDIT_AUTHORIZATION, INFORMATION_RELEASE, ALL_TERMS_PROCEED | 409 `COMPLIANCE_REQUIRED` + `missing[]` |
| Submit (`APP_STARTED` → `APP_SUBMITTED`) | Write packet + ACCOUNT_CREATION, AGENT_ASSIGNMENT, CREDIT four, PAYMENT_NONREFUNDABLE, PAYMENT_CLEARED, LOAN_AUDIT_LENDER_RIGHTS | 409 same shape; 422 if stage is not APP_STARTED |

Payment disclosures set `LoanFile.paymentAcknowledged` + `paymentAcknowledgedAt`.

### DPA ($1,800 / 180000 cents)

DPA selection is **required workflow** (the borrower must choose) but **not a submit blocker**.

| Choice | Stored | Amount | Event | Confirmation |
|---|---|---|---|---|
| Yes | `dpaSelected=true`, `dpaSelectedAt` | `dpaAmountCents=180000`; add to `servicePackageAmountCents` | `DPA_SELECTED` | exact copy in `src/los/dpa.ts` |
| No | `dpaSelected=false`, `dpaSelectedAt` | `0` | none | none |

`DPA_SELECTION` acknowledgement records the choice. `interestedInDpa1800` remains on `ComplianceBody` / `MortgageApplication` as the boolean.
