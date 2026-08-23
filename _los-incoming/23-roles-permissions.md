# Roles and permissions

Two layers. Do not collapse them.

## A. OS login role (`User.role` — existing enum)

| Role | LOS default function |
|---|---|
| CLIENT | Borrower (own loan only) |
| CUSTOMER_SERVICE | May be assigned LOAN_OFFICER |
| FILE_PREPARER | May be assigned PROCESSOR |
| MANAGER | LO + processor visibility |
| ADMIN / OWNER | All staff permissions; owner confirm on UW decisions |

Do not add a new `Role` value for UNDERWRITER until seed/nav tests are updated. Represent UW as `LoanStaffAssignment.function = UNDERWRITER` on an ADMIN/MANAGER/OWNER user for sprint 1.

Co-borrower is a second `User` with Role CLIENT linked via `LoanFile.coBorrowerClientId`.

## B. File assignment (`LoanStaffAssignment.function`)

Exactly one *active* LOAN_OFFICER per file.
Zero or one active PROCESSOR, UNDERWRITER, CLOSER.

## Permission matrix

Resources: `LoanFile`, `Application1003`, `LosDocument`, `LoanCondition`, `QualificationSnapshot`, `UnderwritingDecision`, `LoanFileNote`, `BorrowerActionPlan`, `GrantsIntelligence`.

Actions: `read`, `write`, `transition`, `decide`, `export`.

| Resource / action | Borrower (own) | LO assigned | Processor assigned | UW assigned | OWNER |
|---|---|---|---|---|---|
| 1003 read | yes | yes | yes | yes | yes |
| 1003 write | only DRAFT / IN_PROGRESS | yes until SUBMITTED_TO_UW | income/asset/credit fields in PROCESSING | no (read) | yes |
| eConsent / disclosures | yes (self) | read | read | read | yes |
| Document upload | own requested docs | yes | yes | no | yes |
| Document accept/reject | no | no | yes | yes | yes |
| Condition issue | no | no | yes (from catalog) | yes | yes |
| Condition clear/waive | no | no | receive/review | clear/waive | yes |
| Qualification run | no | yes | yes | yes | yes |
| Qualification numbers shown to borrower | no (qualitative only unless Charles says otherwise) | yes | yes | yes | yes |
| Stage → INITIAL_REVIEW / PROCESSING | no | yes | no | no | yes |
| Stage → SUBMITTED_TO_UW | no | no | yes | no | yes |
| UW decide | no | no | no | yes | yes |
| Owner confirm decide | no | no | no | no | yes |
| GHL message send | no | draft only | no | no | after gate |
| Intelligence overlay | qualitative status | yes | yes | yes | yes |

Hard rules:
- CLIENT cannot read another Client's loan.
- SSN last-4 only after write; ciphertext never in API responses.
- APPROVE / DENY in production requires `UnderwritingDecision.requiresOwnerConfirm` until Charles lifts it.
- No live GHL writes in sprint 1 (`ghlDispatch=STUB`).
