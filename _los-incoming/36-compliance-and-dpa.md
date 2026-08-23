# 36 — Compliance acknowledgements and DPA

**STATUS: DRAFT COUNSEL.** Disclosure copy in `src/los/compliance.ts` is derived from the 2026-08-23 Cognito intake and is **not legal advice**. Charles Grant and counsel must approve before this copy is shown to a real client. Agreement version default: `2026-08-23-cognito-derived-draft-v1`.

DPA selection and named disclosures are first-class workflow, not optional UI chrome.

## Entities

| Entity | Role |
|---|---|
| `LegalAcknowledgement` | Signed packet (typed name, drawn signature, IP, UA, version). Historical Cognito flags including `acknowledgedTaylorCarroll` remain. New: `loanAuditLenderRights`. `acknowledgedSeparateLenderIdentity` already exists. |
| `ComplianceAcknowledgment` | One row per named `ComplianceDisclosureType` per application. Unique `(applicationId, disclosureType)`. `borrowerId` stores `Client.id` (borrower_id) until `MortgageBorrower` exists. |
| `LoanFile` | Operational file. New money/ack fields below. |
| `LosAutomationEvent` | `DPA_SELECTED` when the borrower chooses Yes. |

`AGENT_ASSIGNMENT` disclosure copy is **generic** (assigned real estate professional). Do not hardcode a person in new disclosure text. Keep the Taylor Carroll field on `LegalAcknowledgement` for historical Cognito mapping only.

## LoanFile fields

| Field | Default | Notes |
|---|---|---|
| `dpaSelected` | `false` | Always stored. |
| `dpaAmountCents` | `0` | `180000` when selected. |
| `dpaSelectedAt` | `null` | Set when the choice is recorded (Yes or No). |
| `paymentAcknowledged` | `false` | Set when payment disclosure types are present. |
| `paymentAcknowledgedAt` | `null` | Timestamp of payment acks. |
| `agreementVersion` | `2026-08-23-cognito-derived-draft-v1` | |
| `servicePackageAmountCents` | `0` | Increased by `180000` when DPA Yes. |

## ComplianceDisclosureType

ACCOUNT_CREATION, AGENT_ASSIGNMENT, CREDIT_NO_NEW, CREDIT_NO_LARGE_PURCHASES, CREDIT_NO_ACCOUNT_CHANGES, CREDIT_IMPACT, PAYMENT_NONREFUNDABLE, PAYMENT_CLEARED, LOAN_AUDIT_LENDER_RIGHTS, E_SIGN_CONSENT, CREDIT_AUTHORIZATION, INFORMATION_RELEASE, CANCEL_FEE, NO_CHANGE_MIND, NO_GUARANTEES, ALL_TERMS_PROCEED, DPA_SELECTION.

`DPA_SELECTION` records the choice. It is **not** a write or submit blocker.

`LOAN_AUDIT_LENDER_RIGHTS` includes lender-rights body **and** service-resolution copy (`serviceResolutionAck` on the Zod body aliases the same disclosure).

## Validation gates

**REQUIRED_FOR_SECTION_WRITE** (1003 PATCH / save section) — existing e-sign packet:

- E_SIGN_CONSENT
- CREDIT_AUTHORIZATION
- INFORMATION_RELEASE
- ALL_TERMS_PROCEED

Missing → HTTP **409** `{ code: "COMPLIANCE_REQUIRED", missing: string[] }`.

**REQUIRED_FOR_SUBMIT** — write packet plus:

- ACCOUNT_CREATION
- AGENT_ASSIGNMENT
- CREDIT_NO_NEW
- CREDIT_NO_LARGE_PURCHASES
- CREDIT_NO_ACCOUNT_CHANGES
- CREDIT_IMPACT
- PAYMENT_NONREFUNDABLE
- PAYMENT_CLEARED
- LOAN_AUDIT_LENDER_RIGHTS

Missing → HTTP **409** same shape.

Submit also requires `LoanFile.originationStage === APP_STARTED`. Other stages → **422** `INVALID_STAGE`.

## DPA workflow

1. Borrower is asked Yes/No for Down Payment Assistance ($1,800).
2. The choice is **always stored** (`dpaSelected`, `dpaAmountCents`, `dpaSelectedAt`, `DPA_SELECTION` ack).
3. **Yes** → amount `180000`, `servicePackageAmountCents` increased, confirmation copy, event `DPA_SELECTED`.
4. **No** → amount `0`, no event, valid path, not a blocker.
5. Confirmation copy (exact):

> Down Payment Assistance will be added to your package for an additional $1,800. This option may provide additional assistance during the home buying process. New construction opportunities may offer additional incentives.

## Submission blockers (server)

A borrower cannot `POST /api/los/applications/:id/submit` until every `REQUIRED_FOR_SUBMIT` type is acknowledged `true`. DPA Yes/No does not block. `CANCEL_FEE`, `NO_CHANGE_MIND`, and `NO_GUARANTEES` remain on `LegalAcknowledgement` / `ComplianceBody` for the signed packet; they are modeled as disclosure types but are not in the submit-missing list beyond the named required set above.

Money is integer cents. Ratios are bps. SSN is AES-256-GCM (`MORTGAGE_PII_KEY`); GET returns last-4 only.
