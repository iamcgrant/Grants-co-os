# 17 — Conditions workflow

Underwriting checklist / conditions live on `LoanCondition`, typed from `ConditionCatalogItem`.  
Borrower action plan = the subset the borrower must complete (`borrowerOwned=true` and status in OPEN, REQUESTED).

---

## 1. Timing

| Code | Name | Meaning |
|---|---|---|
| `PTD` | Prior to docs | Required before UW can treat the decision package as complete (before or at conditional) |
| `PTC` | Prior to closing | Required before `CLEAR_TO_CLOSE` / close |
| `PTF` | Prior to funding | Required before `FUNDED` |

A file may have mixed timings. `CLEAR_TO_CLOSE` requires every PTD and PTC in Cleared or Waived. PTF may still be Open at CTC. `FUNDED` requires PTF Cleared or Waived.

---

## 2. Statuses (forward + limited reverse)

| Status | Meaning | Who sets |
|---|---|---|
| `OPEN` | On the file; not yet asked of the responsible party | UW, Processor, system (catalog seed on submit) |
| `REQUESTED` | Responsible party notified (event fired; GHL stub sprint 1) | Processor, LO (borrower-owned), system |
| `RECEIVED` | Artifact attached or staff marked in | Processor, Borrower (own conditions), system on upload |
| `REVIEWED` | Staff looked; not yet cleared | Processor (prep), UW (decision) |
| `CLEARED` | Satisfied | UW (PTD/PTC/PTF). Processor may clear processor-owned admin items Charles lists as processor-clearable (see catalog `processorCanClear`) |
| `WAIVED` | Not required on this file | UW; OWNER |
| `REJECTED` | Artifact insufficient; does not satisfy | UW |

Happy path: OPEN → REQUESTED → RECEIVED → REVIEWED → CLEARED.

Allowed extra:

- OPEN → WAIVED (UW/OWNER)
- REQUESTED → OPEN (recall; reason)
- RECEIVED → REJECTED → REQUESTED (re-ask)
- REVIEWED → CLEARED | REJECTED | WAIVED
- CLEARED → OPEN only by UW/OWNER with reason (re-open)
- REJECTED is not terminal; must go REQUESTED to chase again

Every change: `LosAutomationEvent` `CONDITION_*` + audit. Payload: condition id, from, to. No PII files inlined.

---

## 3. Standard catalog (seed)

`processorCanClear` is a seed column conceptually (`ConditionCatalogItem` has `borrowerOwned`, `requiresUpload`, `timingDefault`). Processor-clearable admin items: note in label; UW still owns credit-risk items.

| code | label | timingDefault | borrowerOwned | requiresUpload |
|---|---|---|---|---|
| `VOE` | Verification of employment | PTD | false | true |
| `VOD` | Verification of deposit | PTD | false | true |
| `VOI` | Verification of income | PTD | true | true |
| `TAX_TRANSCRIPTS` | Tax transcripts | PTD | false | true |
| `GOV_ID` | Government-issued photo ID | PTD | true | true |
| `INSURANCE_HOI` | Homeowners insurance (HOI) | PTC | true | true |
| `APPRAISAL` | Appraisal | PTD | false | true |
| `TITLE` | Title commitment / clearance | PTC | false | true |
| `CREDIT_REPAIR_COMPLETE` | Credit-repair track complete | PTD | false | false |
| `CREDIT_HERO_PROOF` | Credit Hero Score account confirmation | PTD | true | true |
| `MYFICO_PROOF` | MyFICO mortgage score screenshot | PTD | true | true |
| `SSN_DOC` | SSN documentation | PTD | true | true |
| `PAYSTUBS` | Paystubs | PTD | true | true |
| `W2` | W-2 | PTD | true | true |
| `BANK_STATEMENTS` | Bank / asset statements | PTD | true | true |
| `GIFT_LETTER` | Gift letter | PTD | true | true |
| `CREDIT_AUTH` | Credit authorization (if not already on legal) | PTD | true | false |

Auto-open on submit:

- Always: `GOV_ID` (Cognito required).
- If `includeCreditRepair=true`: `CREDIT_HERO_PROOF` + `CREDIT_REPAIR_COMPLETE` (latter owned by processor/DisputeFox stub).
- If `includeCreditRepair=false`: `MYFICO_PROOF`.
- If gifts not `doesNotApply`: `GIFT_LETTER`.
- Appraisal order stub does **not** auto-clear `APPRAISAL`; processor opens `APPRAISAL` when ordering.

Do not auto-open FHA-specific conditions. Do not invent investor overlays.

---

## 4. Borrower action plan

`BorrowerActionPlan` (one active per application) + `ActionPlanItem` rows pointing at `LoanCondition`.

**Definition:** items = conditions where `borrowerOwned=true` AND `status IN (OPEN, REQUESTED, REJECTED)`.

Rebuild on every condition write. `done=true` when condition is RECEIVED or later **except** REJECTED (REJECTED → done=false). CLEARED/WAIVED drop off the plan (item may remain `done=true` for history).

Events: `ACTION_PLAN_UPDATED`.

Borrower may attach documents to borrower-owned conditions only. That sets RECEIVED, never CLEARED.

---

## 5. Document link

`LoanCondition.documentId` → existing `Document`. Also create `MortgageDocumentFile` on the application (package IDENTITY/INCOME/ASSETS/CREDIT/OTHER).

| condition code | package |
|---|---|
| GOV_ID, SSN_DOC | IDENTITY |
| VOI, PAYSTUBS, W2, TAX_TRANSCRIPTS, VOE | INCOME |
| VOD, BANK_STATEMENTS, GIFT_LETTER | ASSETS |
| CREDIT_HERO_PROOF, MYFICO_PROOF, CREDIT_REPAIR_COMPLETE, CREDIT_AUTH | CREDIT |
| INSURANCE_HOI, APPRAISAL, TITLE | OTHER |

No object-store adapter exists on main (`00-os-inventory.md` §8). Milestone 1 stores keys/metadata only.

---

## 6. Clearing vs origination stage

See `15-origination-pipeline.md`. REJECTED PTD/PTC blocks CLEAR_TO_CLOSE. Waived counts as satisfied. Grants `docsReady` may use “no borrower-owned OPEN/REQUESTED/REJECTED” — overlay only.
