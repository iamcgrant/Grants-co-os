# 15 — Origination pipeline (lifecycle)

System of record for the loan: `LoanFile.originationStage` (`LoanOriginationStage`).  
Every transition writes `LoanStageEvent` + `MortgageAuditEvent` + `LosAutomationEvent` type `LOAN_STAGE_CHANGED`.

The Grants proprietary track is **parallel**, not a column on this enum. See § Dual track.

---

## 1. Origination stages

| Stage | Meaning | Typical owner |
|---|---|---|
| `APP_STARTED` | Application row exists; legal and/or URLA packets in progress | Borrower |
| `APP_SUBMITTED` | Borrower submitted complete-enough file | LO (inbox) |
| `INITIAL_REVIEW` | LO completeness / disclosure / assignment | LO |
| `PROCESSING` | Processor checklist, verifications, orders | Processor |
| `SUBMITTED_TO_UW` | File in underwriting | UW |
| `CONDITIONAL_APPROVAL` | UW decision kind CONDITIONAL_APPROVE recorded; conditions remain | UW + Processor |
| `CONDITIONS_OUTSTANDING` | One or more PTD/PTC/PTF not Cleared/Waived | Processor (chase); Borrower if borrowerOwned |
| `CLEAR_TO_CLOSE` | Required PTD+PTC cleared/waived; PTF may remain | Processor / UW |
| `APPROVED` | Production-released APPROVE | Owner gate then ops |
| `DENIED` | Production-released DENY | Owner gate then ops |
| `WITHDRAWN` | Borrower or ops withdrew | LO / Owner |
| `FUNDED` | Funds disbursed | Processor / Owner |
| `CLOSED` | File closed post-funding (or closed-without-fund if policy says) | Owner / Processor |

Terminal-ish: `DENIED`, `WITHDRAWN`, `CLOSED`. `FUNDED` normally goes to `CLOSED`. Do not skip `FUNDED` on a funded loan.

`MortgagePipelineStage` on `MortgageApplication` is **legacy overlay mapping**. New code must read/write `LoanFile.originationStage`. Keep the old enum so URLA rows already specified are not deleted.

---

## 2. Allowed transitions (who can move)

Actors: `BORROWER` (Role `CLIENT`), `LO` (assignment `LOAN_OFFICER`), `PROCESSOR`, `UNDERWRITER`, `OWNER` (Role `OWNER`). ADMIN may act as OWNER except **production UW release** (Charles/OWNER only until Charles says otherwise).

| From | To | Who | Guard |
|---|---|---|---|
| — | `APP_STARTED` | system | `MortgageApplication` create |
| `APP_STARTED` | `APP_SUBMITTED` | BORROWER, LO | LegalAcknowledgement exists; URLA required packets persist; LoanFile upsert |
| `APP_SUBMITTED` | `INITIAL_REVIEW` | LO, OWNER | assignment of LO (or Owner acting) |
| `INITIAL_REVIEW` | `PROCESSING` | LO, OWNER | processor assigned |
| `INITIAL_REVIEW` | `APP_STARTED` | LO | incomplete; reason required; borrower action plan opened |
| `PROCESSING` | `SUBMITTED_TO_UW` | PROCESSOR, OWNER | processing checklist required items done; QualificationSnapshot computed |
| `PROCESSING` | `CONDITIONS_OUTSTANDING` | PROCESSOR | any OPEN/REQUESTED condition |
| `SUBMITTED_TO_UW` | `CONDITIONAL_APPROVAL` | UNDERWRITER | UW decision CONDITIONAL_APPROVE recorded (gate does not block conditional) |
| `SUBMITTED_TO_UW` | `CONDITIONS_OUTSTANDING` | UNDERWRITER, PROCESSOR | PTD opened |
| `SUBMITTED_TO_UW` | `APPROVED` | UNDERWRITER + **Charles release** | decision APPROVE + `productionReleased=true` |
| `SUBMITTED_TO_UW` | `DENIED` | UNDERWRITER + **Charles release** | decision DENY + `productionReleased=true` |
| `CONDITIONAL_APPROVAL` | `CONDITIONS_OUTSTANDING` | system/PROCESSOR | outstanding conditions exist |
| `CONDITIONAL_APPROVAL` | `CLEAR_TO_CLOSE` | UNDERWRITER, PROCESSOR | no OPEN/REQUESTED/RECEIVED/REVIEWED PTD or PTC (Cleared or Waived only). REJECTED blocks. |
| `CONDITIONS_OUTSTANDING` | `PROCESSING` | PROCESSOR | still collecting before UW |
| `CONDITIONS_OUTSTANDING` | `SUBMITTED_TO_UW` | PROCESSOR | resubmit after receipts |
| `CONDITIONS_OUTSTANDING` | `CONDITIONAL_APPROVAL` | UNDERWRITER | still conditional, conditions improving |
| `CONDITIONS_OUTSTANDING` | `CLEAR_TO_CLOSE` | UNDERWRITER | PTD+PTC clear |
| `CLEAR_TO_CLOSE` | `APPROVED` | UNDERWRITER + **Charles release** | APPROVE + gate |
| `CLEAR_TO_CLOSE` | `CONDITIONS_OUTSTANDING` | UNDERWRITER | new PTC/PTF opened |
| `APPROVED` | `FUNDED` | PROCESSOR, OWNER | PTF cleared/waived or waived-in-mass per Owner |
| `FUNDED` | `CLOSED` | PROCESSOR, OWNER | |
| any non-terminal | `WITHDRAWN` | LO, OWNER, BORROWER (borrower only from APP_STARTED/APP_SUBMITTED/INITIAL_REVIEW) | reason required; $1,800 cancel-fee acknowledgement already on legal row — do not auto-invoice here |
| any non-terminal except FUNDED/CLOSED | `DENIED` | UNDERWRITER + **Charles release** | |
| `APP_STARTED`/`APP_SUBMITTED` | (no skip to UW) | — | forbidden |

System may move `CONDITIONAL_APPROVAL` ↔ `CONDITIONS_OUTSTANDING` when condition statuses change (derived). Prefer explicit actor when a human clicks; system jobs must still audit as `actorUserId=null` + reason `SYSTEM`.

**Forbidden:** borrower cannot set APPROVED/DENIED/FUNDED/CLOSED. Processor cannot production-release UW. Underwriter cannot mutate `LenderOrgSettings`. No stage move invents NMLS.

---

## 3. SLAs (defaults Charles can change)

Stored as constants in `src/lib/los/pipeline.ts` (not buried in UI). Not agency rules.

| Stage / event | SLA | Clock start | Breach |
|---|---|---|---|
| `APP_STARTED` idle | 14 days | createdAt | LO task; do not auto-withdraw |
| `APP_SUBMITTED` → `INITIAL_REVIEW` | 1 business day | submittedAt | LO queue breach |
| `INITIAL_REVIEW` | 2 business days | entered | LO breach |
| `PROCESSING` | 5 business days | entered | Processor breach |
| `SUBMITTED_TO_UW` first look | 2 business days | entered | UW breach |
| Condition OPEN/REQUESTED (PTD) | 3 business days | requestedAt or createdAt | owner = borrower if `borrowerOwned` else processor |
| Condition RECEIVED → REVIEWED | 1 business day | receivedAt | UW/processor per timing |
| `CONDITIONS_OUTSTANDING` | 7 calendar days | entered | Processor |
| `CLEAR_TO_CLOSE` → `APPROVED` (gate) | 1 business day sitting on Charles queue | CTC entered | Owner queue |
| `APPROVED` → `FUNDED` | 3 business days | approved | Processor |

Business day = America/New_York, skip Sat/Sun. Holidays: unspecified — do not invent a calendar; weekday-only until Charles supplies one.

---

## 4. Dual track

### Origination track
`LoanFile.originationStage` as above. This is the loan.

### Grants proprietary track (`GrantsReadinessTrack`)

| Flag | Meaning | Typical evidence |
|---|---|---|
| `creditReady` | Credit-repair path complete **or** MyFICO packet received | DisputeFox stub linked / Credit Hero or MyFICO condition Cleared |
| `docsReady` | Identity + income + asset packages present per checklist | MortgageDocumentFile counts + VOE/VOD/VOI not OPEN |
| `prepReady` | Legal signed, behavior lock ack, DPA flag stored, borrower action plan empty of OPEN borrower-owned items | LegalAcknowledgement + action plan |
| `score` 0–100 | Internal overlay only | Same heuristic family as `ReadinessScore`; **not** origination; **not** a credit score; **not** shown as DTI |

Rules:

- Setting all three flags true does **not** move origination to APPROVED.
- Origination APPROVED does **not** require `score == 100`.
- Credit-repair files may sit in PROCESSING while Grants track `creditReady=false`.
- Write `READINESS_TRACK_UPDATED` on change.

Borrower action plans are the Grants-facing worklist **and** the origination condition subset where `borrowerOwned=true`. One condition row; two views.

---

## 5. Loan number

`LoanFile.loanNumber` from existing `IdSequence` pattern (e.g. `GC-LN-000001`). Internal. **Not** NMLS. **Not** a credit score. Create on first persist of `LoanFile` (no later than `APP_SUBMITTED`).

---

## 6. Derived stage helper

When PTD/PTC outstanding and current stage is `CONDITIONAL_APPROVAL` or `SUBMITTED_TO_UW`, engine **may** set `CONDITIONS_OUTSTANDING`. When those clear, engine **may** set `CLEAR_TO_CLOSE` only if an UW decision other than DENY exists. Never auto-APPROVE. Never auto-DENY. Never auto-release Charles gate.
