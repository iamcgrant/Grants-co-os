# 08 — Integrations and automation events

Sprint 1: **stubs + event log only**. No live GHL writes. No DisputeFox writes. No Zap 374413762. No production deploy.

GHL is the **CRM overlay** (comms). DisputeFox is the **credit-repair track**. Neither is the LOS system of record. `LoanFile` is.

---

## 1. Event catalog (`LosAutomationEventType`)

Persist `LosAutomationEvent` (`status=RECORDED`, `payloadJson` without SSN/signature/keys).

| type | When | Payload (allowlist) |
|---|---|---|
| `LOAN_APP_STARTED` | application + LoanFile created | applicationId, loanNumber |
| `LOAN_APP_SUBMITTED` | borrower/LO submit | applicationId, loanNumber |
| `LOAN_STAGE_CHANGED` | originationStage transition | from, to, actorUserId |
| `LOAN_ASSIGNED` | MortgageStaffAssignment write | assignmentType, staffId |
| `CONDITION_OPENED` | condition created OPEN | conditionId, code, timing |
| `CONDITION_REQUESTED` | → REQUESTED | conditionId |
| `CONDITION_RECEIVED` | → RECEIVED | conditionId, documentId |
| `CONDITION_CLEARED` | → CLEARED | conditionId |
| `CONDITION_WAIVED` | → WAIVED | conditionId |
| `CONDITION_REJECTED` | → REJECTED | conditionId |
| `ACTION_PLAN_UPDATED` | plan rebuild | itemCount, openCount |
| `QUALIFICATION_COMPUTED` | snapshot insert | snapshotId, frontDtiBps, backDtiBps, ltvBps, cltvBps, reservesMonths, guidelineSet |
| `UW_DECISION_RECORDED` | decision insert | kind, productionGateRequired |
| `UW_PRODUCTION_GATE_PENDING` | APPROVE/DENY not released | decisionId |
| `UW_PRODUCTION_GATE_RELEASED` | Charles release | decisionId, toStage |
| `DOCUMENT_ATTACHED` | MortgageDocumentFile | package, kind |
| `APPRAISAL_STUB_UPDATED` | AppraisalOrder | status |
| `READINESS_TRACK_UPDATED` | Grants overlay | creditReady, docsReady, prepReady (not the 0–100 as a credit score) |
| `GHL_STUB` | would-be CRM upsert | reason, ghlContactId if already known |
| `DISPUTEFOX_STUB` | would-be DF attach | reason, disputeFoxClientId if known |

Also write existing `AuditLog` with `entityType` `LOAN_FILE` / `MORTGAGE_APPLICATION`.

---

## 2. GHL (CRM overlay)

- Location when live: `NsmlbLVNr4SBJNC8gnrn` (existing OS). Only phone/SMS/email backend.
- Sprint 1: `src/lib/los/ghl-stub.ts` — `MORTGAGE_GHL_WRITES_ENABLED=false`. Assert no `fetch` to gohighlevel. Log `GHL_STUB`.
- Store `MortgageApplication.ghlContactId` + `ghlSyncStatus=STUB`.
- Inbound attach uses existing ClientIdentifier provider `GHL` — never a second Client.
- Custom fields paper-only until x1 Audit creates them. Do not invent GHL custom field IDs here.
- Do not enable Zap 374413762 as a mortgage bus.

When gate lifts (not sprint 1): upsert contact on `LOAN_APP_SUBMITTED`, `LOAN_STAGE_CHANGED` (subset), `CONDITION_REQUESTED` (borrower-owned). Still no second SMS provider.

---

## 3. DisputeFox (credit-repair track)

- Only when `includeCreditRepair=true` / `CreditProgramPath=CREDIT_REPAIR_CREDIT_HERO`.
- Sprint 1: `src/lib/los/disputefox-stub.ts` — store `disputeFoxClientId` if staff pastes an existing id; write `ClientIdentifier` provider `DISPUTEFOX` onto the master Client; log `DISPUTEFOX_STUB`. No DF HTTP.
- Staff later deep-link existing `/credit/disputefox/[clientId]`. Do not scrape. Do not open DF on MyFICO path.
- `CREDIT_REPAIR_COMPLETE` condition clears when overlay `creditReady=true` (staff/system), not because origination APPROVED.

---

## 4. Cognito Forms

Tax puller `src/lib/integrations/cognito/` stays tax. Do **not** reuse it as this LOS. Legacy public form is a requirements source only; OS replaces it as the application+workflow.

---

## 5. Appraisal / title / HOI

`AppraisalOrder` is a **stub** (status enum only). No AMC. Title and HOI are conditions + documents. No vendor APIs in sprint 1.

---

## 6. Grants Pay / Service

`Service.code = MORTGAGE_LOS`. Fees (DPA $1,800, cancel $1,800) are **acknowledgements** on legal in sprint 1, not a new processor. If invoiced later, existing Grants Pay only.

---

## 7. Outbound later (preview only)

Named events for a future webhook: `los.application.submitted`, `los.stage.changed`, `los.condition.requested`, `los.uw.gate.pending`. Preview URL only until gate lifts. Payload = event allowlist above.
