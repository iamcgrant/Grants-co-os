# 02 — Borrower application (URLA/1003 data collection)

**Not a short intake. Not a Cognito clone. Not UI mockups.**  
This file specifies the **application data packets** the borrower (and LO on their behalf) must persist. URLA/1003 PDF is the structure reference. Cognito supplies legal + credit-program + fee acknowledgements. Product is the **workflow around** this application (`LoanFile`, conditions, UW).

Routes later: `/apply` (public/session), `/portal/loan` (Role `CLIENT`). Milestone 1 does not ship pages.

Forbidden in any later copy: presenting DTI/LTV as a credit score; showing `GrantsReadinessTrack.score` to the borrower; claiming already licensed / invented NMLS.

---

## Gate 0 — Legal (blocks packets)

Entity: `LegalAcknowledgement`. Required before URLA packets count toward `APP_SUBMITTED`.

Must persist (Cognito FOUND, must-be-true unless noted):

- Credit authorization; information release
- Not apply for new credit; no large purchases; no add/remove accounts without approval; impact acknowledgement
- Nonrefundable service; payment must clear before services
- $1,800 cancellation fee payable to the realty company; not a change-of-mind process
- Address confidentiality Y/N (URLA)
- Optional DPA +$1,800 interest
- Taylor Carroll in-house agent acknowledgement
- Separate lender/transaction identity acknowledgement
- No-guarantees; client pays inspections/appraisals/EMD/down/closing
- Typed first+last; drawn signature storage key; date; IP; userAgent; `documentVersion`

Draft copy: `14-legal-agreement.draft.md`. Charles/counsel before production. Do not invent a law firm.

---

## Packet 1 — Borrower profile

`MortgageBorrower` + `SsnVault`. URLA identity + Cognito client information.

Required: first/last as on DL, middle optional, mobile, email, DOB age >= 18, vaulted SSN (9 digits in, last-4 out), citizenship/residency, military Y/N, preferred language, marital status, non-spouse property rights, dependents count, current address (line1/city/state/zip), mailing same + mailing block if not, years/months at address, own/rent/no-rent. Optional HMDA. Co-borrower = second `Client` if second human.

SSN: never plaintext column; never log; never sample-PDF SSN.

---

## Packet 2 — Employment and income

Repeatable `Employment` + `IncomeSource`. Monthly amounts in cents. Current employment income feeds qualification (not a score).

---

## Packet 3 — Assets / gifts / REO

Repeatable `AssetAccount` (institution, type, last4, estimatedBalanceCents — estimated, unverified). Gifts/other assets/REO per URLA. Last4 only, not full account numbers.

---

## Packet 4 — Liabilities

`Liability` repeatable or doesNotApply. `toBePaidOff` excluded from back-end DTI.

---

## Packet 5 — Credit program (Cognito)

`includeCreditRepair` / `CreditProgramPath`:

- Yes: Credit Hero proof required; instruction to create Credit Hero account; DisputeFox stub later; condition `CREDIT_HERO_PROOF` + `CREDIT_REPAIR_COMPLETE`.
- No: MyFICO screenshot required. Copy may state minimum 620 as instruction. Confirm with Charles before hard-gating. 620 is not a QualificationSnapshot and not a credit-score write into DTI.

Optional `creditConcernsText`, `MortgageCreditItem` list.

---

## Packet 6 — Loan needs and property

`PropertyGoal` + copied onto `LoanFile` at submit: purpose, purchase price cents, down payment cents + source, loan amount cents, property type, occupancy, D.R. Horton community name if any, buyer-broker Y/N, specific home + address, realtor. DPA flag already on legal; persist `interestedInDpa1800`.

---

## Packet 7 — Declarations

All URLA Section 5 Y/N on `Declaration`. If Y, explanation required. Lookbacks as in catalog (3y ownership, 7y DIL/short sale/FC/BK).

---

## Packet 8 — Documents

Packages on `MortgageDocumentFile`: IDENTITY (DL FOUND required), INCOME (implied), ASSETS (implied), CREDIT (path proof), OTHER. Types jpg/jpeg/png/pdf. Max 10 per field. No adapter on main — metadata + storageKey in milestone 1.

---

## Submit

Creates/updates `LoanFile` (`originationStage=APP_SUBMITTED`, `loanNumber` via IdSequence `GC-LN-######`). Auto-opens catalog conditions (`17-conditions-workflow.md`). Emits `LOAN_APP_SUBMITTED`. Rebuilds borrower action plan.

Autosave of packets is a data requirement (Cognito SaveAndResume was false). Resume token must not overload `/setup/[token]` tax intake.

Co-borrower must have legal row before submit if they are an applicant.
