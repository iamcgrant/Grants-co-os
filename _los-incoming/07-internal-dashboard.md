# 07 — Internal origination operations (LO / processor / UW)

**Not a “readiness desk.” Not page mockups.**  
Staff operations are **queues over `LoanFile`**. Insertion later: `/los`, `/los/pipeline`, `/los/loans/[id]`, processing, conditions, underwriting. Milestone 1 specifies filters, fields, and actions only.

Do not replace Command Center revenue at `/home`. Do not nest under `/credit` or `/tax/cognito`.

---

## 1. Shared file projection

Every queue row:

- `loanNumber`, `originationStage`, stage enteredAt (latest `LoanStageEvent`)
- primary borrower `Client` display name + `grantsClientId`
- `purpose`, `occupancy`, `loanAmountCents`, `guidelineSet`
- latest snapshot: `frontDtiBps`, `backDtiBps`, `ltvBps` — labeled **DTI / LTV**, never “score”
- Grants overlay flags `creditReady`, `docsReady`, `prepReady` (separate column group)
- open condition counts by timing (PTD/PTC/PTF)
- assignments: LO, processor, UW user ids
- SLA state (ok / breach) per `15-origination-pipeline.md`
- `ghlSyncStatus` (STUB sprint 1)

EXAMPLE fixtures only (`exampleData=true`). No sample-PDF PII.

---

## 2. Loan Officer queue

**Filter:** `originationStage IN (APP_SUBMITTED, INITIAL_REVIEW)` OR assigned `LOAN_OFFICER` and not terminal.

**Actions:** take INITIAL_REVIEW; assign processor; open borrower-owned conditions; return to APP_STARTED with reason; withdraw (allowed stages); add note. Contact via GHL stub (no live write).

**Must not:** production APPROVE/DENY; edit `LenderOrgSettings`; clear UW-owned PTD.

---

## 3. Processor queue

**Filter:** `PROCESSING`, `CONDITIONS_OUTSTANDING`, `CLEAR_TO_CLOSE`, `APPROVED` (pre-fund), assigned `PROCESSOR`.

**Checklist entity:** `ProcessingChecklistItem` codes (seed): `FILE_COMPLETE`, `VOE_ORDERED`, `VOD_ORDERED`, `APPRAISAL_ORDERED`, `TITLE_ORDERED`, `HOI_RECEIVED`, `QUAL_COMPUTED`, `SUBMITTED_UW_PACKAGE`.

**Actions:** tick checklist; compute qualification; set appraisal stub; attach documents; condition RECEIVED/REVIEWED; submit to UW; chase borrower-owned via action plan rebuild.

**Must not:** production UW release.

---

## 4. Underwriter queue

**Filter:** `SUBMITTED_TO_UW`, `CONDITIONAL_APPROVAL`, `CONDITIONS_OUTSTANDING` with UW-owned OPEN PTD, `CLEAR_TO_CLOSE`.

**Actions:** condition OPEN/REQUESTED/REVIEWED/CLEARED/WAIVED/REJECTED; record `UnderwritingDecision`; freeze snapshot. APPROVE/DENY **record** vs **release** are two steps (Charles gate).

**Charles queue (Owner):** `productionGateRequired && !productionReleased && kind IN (APPROVE, DENY)`.

---

## 5. Pipeline board (all staff with VIEW_LOS)

Columns = `LoanOriginationStage` (not Grants overlay). Overlay flags may appear on cards as secondary. Drag-equivalent = only allowed transitions in `15-origination-pipeline.md`; illegal moves reject with reason.

---

## 6. File record (`/los/loans/[id]` conceptually)

Sections (data groups): identity, legal evidence, URLA packets, `LoanFile` terms, qualification snapshots (history), conditions, action plan, processing checklist, appraisal stub, UW decisions + gate, Grants track, GHL/DF stubs, audit. SSN last-4 only.
