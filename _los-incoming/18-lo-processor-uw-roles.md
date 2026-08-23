# 18 — Roles, assignments, permissions

Do **not** add `LOAN_OFFICER`, `PROCESSOR`, or `UNDERWRITER` to Prisma `enum Role` (role-nav tests + existing OS). LOS function is `LoanStaffAssignmentType` on `MortgageStaffAssignment`.

Existing `Role`: `OWNER | ADMIN | MANAGER | CUSTOMER_SERVICE | FILE_PREPARER | MARKETING | CLIENT`.

---

## 1. Mapping

| LOS function | Assignment type | Typical `User.role` | Notes |
|---|---|---|---|
| Borrower | (none) | `CLIENT` | Own `MortgageApplication` only |
| Loan Officer | `LOAN_OFFICER` | `CUSTOMER_SERVICE` or `MANAGER` | One primary LO per file (`isPrimary`) |
| Processor | `PROCESSOR` | `FILE_PREPARER` | One primary processor |
| Underwriter | `UNDERWRITER` | `MANAGER` or `ADMIN` | One primary UW |
| Owner / production gate | (implicit) | `OWNER` | Charles. May also assign himself any type |

Same human may hold multiple assignment types on one file (`@@unique([applicationId, staffId, assignmentType])`).

Seed staff (from OS inventory): Charles OWNER, Simon CUSTOMER_SERVICE, Jona FILE_PREPARER. Do not invent new people.

---

## 2. Permission keys (add to `src/lib/rbac/permissions.ts`)

| key | OWNER | ADMIN | MANAGER | CUSTOMER_SERVICE | FILE_PREPARER | MARKETING | CLIENT |
|---|---|---|---|---|---|---|---|
| `VIEW_LOS` | Y | Y | Y | Y | Y | n | own only via `VIEW_OWN_LOAN` |
| `VIEW_OWN_LOAN` | n | n | n | n | n | n | Y |
| `MANAGE_LOS_ASSIGNMENTS` | Y | Y | Y | n | n | n | n |
| `LOS_ORIGINATE` | Y | Y | Y | Y | n | n | n |
| `LOS_PROCESS` | Y | Y | Y | n | Y | n | n |
| `LOS_UNDERWRITE` | Y | Y | Y | n | n | n | n |
| `LOS_RECORD_UW_DECISION` | Y | Y | Y | n | n | n | n |
| `LOS_PRODUCTION_RELEASE_UW` | **Y** | n | n | n | n | n | n |
| `LOS_MOVE_STAGE` | Y | Y | limited | limited | limited | n | limited |
| `LOS_EDIT_GUIDELINES` | Y | n | n | n | n | n | n |
| `LOS_EDIT_NMLS_SETTINGS` | Y | n | n | n | n | n | n |
| `LOS_VIEW_SSN_LAST4` | Y | Y | Y | Y | Y | n | last4 of self after vault |
| `LOS_DECRYPT_SSN` | Y | n | n | n | n | n | n (never in sprint 1 UI) |

Stage move limits = transition table in `15-origination-pipeline.md` (assignment type AND Role). ADMIN cannot `LOS_PRODUCTION_RELEASE_UW` until Charles says otherwise.

---

## 3. What each function sees (data, not screens)

Milestone 1 has no page mockups. Queues are filters over these fields.

### 3.1 Loan Officer

Sees files where they are assigned `LOAN_OFFICER` or (OWNER/ADMIN) all files.

Fields: loanNumber, originationStage, borrower names (Client), occupancy, loanAmountCents, purpose, submittedAt, SLA clock, Grants flags (`creditReady/docsReady/prepReady`) as overlay **not** as credit scores, open borrower-owned condition count, GHL stub status.

May: create/resume application on behalf of borrower, run INITIAL_REVIEW, assign processor (if permitted), open borrower-owned conditions, withdraw in allowed stages, notes. May not: production APPROVE/DENY, edit NMLS, clear PTD credit-risk conditions.

### 3.2 Processor

Files in `PROCESSING`, `CONDITIONS_OUTSTANDING`, `CLEAR_TO_CLOSE`, `APPROVED` (pre-fund), assigned `PROCESSOR`.

Fields: checklist (`ProcessingChecklistItem`), conditions all timings, appraisal stub, document packages, latest `QualificationSnapshot` (bps/cents labeled as DTI/LTV — never “score”).

May: compute qualification, move PROCESSING → SUBMITTED_TO_UW, mark RECEIVED/REVIEWED, processor-clearable catalog items, order appraisal stub. May not: production UW release; WAIVE PTD unless catalog says processor-clearable.

### 3.3 Underwriter

Files in `SUBMITTED_TO_UW`, `CONDITIONAL_APPROVAL`, `CONDITIONS_OUTSTANDING` (UW-owned), `CLEAR_TO_CLOSE`.

Fields: full URLA entities, snapshots, condition board PTD/PTC/PTF, declarations, credit program path, DisputeFox id stub, Grants overlay **separate** from snapshot.

May: open/waive/clear/reject conditions, record `UnderwritingDecision` (`CONDITIONAL_APPROVE` | `APPROVE` | `DENY` | `SUSPEND`). **Recording APPROVE/DENY does not change originationStage to APPROVED/DENIED until `productionReleased=true`.** Software **has** the buttons; production gate remains Charles (`LOS_PRODUCTION_RELEASE_UW`).

### 3.4 Owner

Everything above + `LenderOrgSettings` (empty NMLS), guideline limit edits, Charles queue of `UnderwritingDecision` where `productionGateRequired && !productionReleased`, deploy/GHL gates (out of band).

### 3.5 Borrower

Own application packets, own action plan, own document uploads, origination stage labels Charles approves for consumers. Never `GrantsReadinessTrack.score`. Never SSN full. Never other files.

---

## 4. Production APPROVE / DENY gate

```
UnderwritingDecision.productionGateRequired default true
productionReleased default false
charlesApprovedAt / charlesApprovedById null until Role=OWNER releases
```

Event `UW_DECISION_RECORDED` on insert. Event `UW_PRODUCTION_GATE_PENDING` if kind in APPROVE|DENY and not released. Event `UW_PRODUCTION_GATE_RELEASED` on Charles action, then stage move to `APPROVED` or `DENIED`.

Until Charles lifts the product rule, even OWNER-acting-as-UW still sets `productionGateRequired=true` (self-release allowed because OWNER has `LOS_PRODUCTION_RELEASE_UW` — two clicks, two events). If Charles later allows ADMIN release, change the permission matrix only.

---

## 5. Route insertion (do not build UI this milestone)

| Route | Function |
|---|---|
| `/los` | staff home / my queues |
| `/los/pipeline` | all files by `originationStage` |
| `/los/loans/[id]` | file |
| `/los/loans/[id]/processing` | processor |
| `/los/loans/[id]/conditions` | condition board |
| `/los/loans/[id]/underwriting` | UW |
| `/apply` | borrower application data collection |
| `/portal/loan` | logged-in borrower file + action plan |

Staff: `src/app/(staff)/los/**`. Do not nest under `/credit` or `/tax/cognito`.
