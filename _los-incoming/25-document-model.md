# Document model

Documents run the file. The 1003 is data. Conditions point at documents.

## Storage

Reuse existing `Document` (`storageKey`, `category`, `sourceSystem`). `LosDocument` is the **loan-file overlay** (package, typeCode, status, conditionId, expiry, review). Sprint 1 may store bytes on local/preview disk behind `storageKey`. Sprint 2: object store. Never store files in Postgres.

PII: ID, SSN card, bank statements are `restricted`. Access via same permission matrix as `LosDocument`. AuditLog on download.

## Packages (`LosDocumentPackage`)

INITIAL_DISCLOSURES, IDENTITY, INCOME, ASSETS, CREDIT, PROPERTY_COLLATERAL, INSURANCE, TITLE, UNDERWRITING, CLOSING, POST_CLOSING.

## Type catalog (minimum)

| typeCode | package | source |
|---|---|---|
| ECONSENT | INITIAL_DISCLOSURES | borrower ack |
| URLA_ACK | INITIAL_DISCLOSURES | borrower |
| CREDIT_AUTH | INITIAL_DISCLOSURES | borrower (from 1003 + Cognito) |
| DL_FRONT / DL_BACK | IDENTITY | Cognito ID + 1003 |
| SSN_EVIDENCE | IDENTITY | vaulted; file is image/pdf not the number |
| PAYSTUB | INCOME | 1003 implied |
| W2 | INCOME | |
| TAX_RETURN | INCOME | self-employed required |
| PL_STATEMENT | INCOME | self-employed |
| BANK_STMT | ASSETS | |
| RETIREMENT_STMT | ASSETS | |
| GIFT_LETTER | ASSETS | if gift down payment |
| CREDIT_REPORT | CREDIT | staff pull later; borrower upload allowed |
| CREDIT_HERO_PROOF | CREDIT | Cognito path if credit repair = yes |
| MYFICO_SCORE | CREDIT | Cognito path if credit repair = no |
| APPRAISAL | PROPERTY_COLLATERAL | third party |
| HOI_BINDER | INSURANCE | |
| TITLE_COMMITMENT | TITLE | |
| UW_APPROVAL_MEMO | UNDERWRITING | internal |

## Status machine

REQUESTED → UPLOADED → IN_REVIEW → ACCEPTED | REJECTED
REJECTED → REQUESTED (new upload)
ACCEPTED → EXPIRED (if expiresAt passed; bank stmts typically 60 days — configurable, default 60)
Any → WAIVED (UW or OWNER)

Processor moves to IN_REVIEW/ACCEPTED/REJECTED.
UW may ACCEPT/REJECT/WAIVE.
Borrower may UPLOAD only on REQUESTED or REJECTED for their action items.

## Checklist generation

On APPLICATION_SUBMITTED, create `LosDocument` REQUESTED rows from:
1. Always: DL, SSN_EVIDENCE, PAYSTUB, BANK_STMT, CREDIT_AUTH
2. If self-employed: TAX_RETURN, PL_STATEMENT
3. If includeCreditRepair: CREDIT_HERO_PROOF else MYFICO_SCORE
4. If gift down payment: GIFT_LETTER
5. If specific property selected: HOI later in PROCESSING, APPRAISAL order stub

Processing module is this checklist + income/asset/credit review flags on `ProcessingChecklistItem`.

## Conditions ↔ documents

Issuing a condition from catalog clones expected typeCodes as REQUESTED docs linked to `conditionId`.
Clearing a condition requires all linked docs ACCEPTED or WAIVED, or UW explicit waive.

## Retention

Do not delete accepted docs when a condition clears. Soft-expire only. Hard delete is OWNER + legal hold check (not in sprint 1).
