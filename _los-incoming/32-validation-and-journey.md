# Validation, journey, documents, events

## Borrower journey (save/resume)

1. `POST /api/los/applications` → Client (or attach existing by email) + MortgageApplication + LoanFile APP_STARTED + section states EMPTY. Event `LOAN_APP_STARTED`.
2. **Compliance first.** No 1003 PATCH until LegalAcknowledgement exists. Event `ECONSENT_RECORDED`. Section COMPLIANCE → COMPLETE. Stage stays APP_STARTED.
3. Section 1 Borrower. Autosave PATCH. Status IN_PROGRESS until validation passes → COMPLETE. Event `APPLICATION_SAVED` per save; `SECTION_COMPLETED` when COMPLETE.
4. Branch: add co-borrower? No → CO_BORROWER COMPLETE (skipped). Yes → same field set as borrower; both must COMPLETE.
5. Sections 3–8 in order, but borrower may open any non-blocked section after compliance. Recommended order: Employment → Assets → Liabilities → REO → Loan → Declarations.
6. Submit: all required sections COMPLETE (CO_BORROWER skipped counts). Server re-validates. Stage APP_SUBMITTED. Events `APPLICATION_SUBMITTED`, `QUALIFICATION_COMPUTED`, `DOCUMENT_REQUESTED` (batch).

Resume: GET application returns section states + 1003 payloads (SSN last4 only). Current section = first not COMPLETE.

## Required vs optional (submit-time)

**Always required (primary borrower):** legal ack, first/last, DOB 18+, SSN vault, phone, email, citizenship, military Y/N, marital status, dependents count, current address + tenure + start date, 24-month housing history, employment situation, loan purpose, occupancy, property type, loan amount or (purchase+down), all declaration Y/N (not UNKNOWN).

**Required when:**
- dependentsCount > 0 → ages
- maritalStatus != MARRIED → nonSpousePropertyRights
- housing RENT → monthly rent
- months at current < 24 → prior address rows totaling 24 months
- current job < 24 months → additional Employment rows or written explanation in notes (staff)
- hasOtCommissionBonus → at least one of OT/bonus/commission > 0
- self-employed / business type → employerName as business; later tax docs
- ownOtherRealEstate → at least one REO row with address + value
- gift down payment source → MortgageGiftGrant row
- declaration = YES → explanationsJson for that key
- co-borrower present → full borrower-required set on co-borrower (SSN included)

**Optional:** middle name, work email, preferred language, HMDA, employer address/phone, realtor, builder community, termMonths (default 360), other income doesNotApply, gifts doesNotApply, DPA checkbox.

## Cross-field rules

- Exactly one `Employment.isCurrent=true` if situation is currently employed.
- `endDate` required when not current; forbidden when current.
- Loan amount default = purchase − down; if user supplies both, they must match within $1.
- Down payment < purchase price.
- Liability `toBePaidOff=true` excluded from back-end DTI.
- REO mortgage monthly included in DTI unless disposition SELL/PENDING_SALE (flag `REO_MORTGAGE_EXCLUDED` on snapshot).
- SSN never in events, logs, or GET bodies except last4.

## Section completion tracking

`ApplicationSectionState.status`:
- EMPTY: no PATCH
- IN_PROGRESS: saved, validation errors in errorsJson
- COMPLETE: all required-when rules pass
- BLOCKED: compliance not signed (all 1003 sections start BLOCKED)

## Document upload triggers (create LosDocument / MortgageDocumentFile REQUESTED)

| Trigger | typeCode |
|---|---|
| BORROWER COMPLETE | DL_FRONT, SSN_EVIDENCE |
| CO_BORROWER COMPLETE | same for co-borrower |
| current W2 employment COMPLETE | PAYSTUB, W2 |
| self-employed COMPLETE | TAX_RETURN, PL_STATEMENT |
| AssetAccount CHECKING/SAVINGS | BANK_STMT |
| AssetAccount RETIREMENT | RETIREMENT_STMT |
| Gift funds row | GIFT_LETTER |
| includeCreditRepair true | CREDIT_HERO_PROOF |
| includeCreditRepair false | MYFICO_SCORE |
| Submit | CREDIT_AUTH already captured in LegalAcknowledgement; still request CREDIT_REPORT as staff-side later |

Borrower may upload as soon as the row is REQUESTED (not only at a documents page).

## Application status events

| Event | When |
|---|---|
| LOAN_APP_STARTED | create |
| ECONSENT_RECORDED | compliance signed |
| APPLICATION_SAVED | any section PATCH |
| SECTION_COMPLETED | section → COMPLETE |
| DOCUMENT_REQUESTED | trigger table |
| DOCUMENT_UPLOADED | borrower upload |
| QUALIFICATION_RECALCULATED | loan/income/asset/liability save |
| APPLICATION_SUBMITTED | submit success |
| LOAN_STAGE_CHANGED | APP_STARTED → APP_SUBMITTED |

GHL remains STUB.

## API (handlers only; no UI)

- POST `/api/los/applications`
- POST `/api/los/applications/:id/compliance`
- PATCH `/api/los/applications/:id/sections/:section`  body = field map for that section; `borrowerRole=PRIMARY|CO_BORROWER`
- POST `/api/los/applications/:id/co-borrower`  { present: boolean }
- POST `/api/los/applications/:id/documents`
- POST `/api/los/applications/:id/submit`
- GET `/api/los/applications/:id`  section states + entities, ssnLast4 only
