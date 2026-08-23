# Loan lifecycle states

`LoanFile.state` is the operational truth. `MortgageApplication.pipelineStage` (legacy readiness enum) is deprecated for new work; keep the 1003 payload, drive operations from `LoanFile`.

## States

| State | Meaning | Typical owner |
|---|---|---|
| DRAFT | File created, 1003 not started | Borrower |
| APPLICATION_IN_PROGRESS | 1003 in progress, save/resume | Borrower |
| APPLICATION_SUBMITTED | Borrower submitted 1003 + eConsent | LO |
| INITIAL_REVIEW | LO reviews completeness, loan summary, notes | LO |
| PROCESSING | Processor: docs, VOE/VOD/VOI, credit, assets | Processor |
| SUBMITTED_TO_UW | File stacked, submitted to underwriting | UW |
| CONDITIONAL_APPROVAL | UW decision APPROVE_WITH_CONDITIONS | Processor + Borrower |
| CONDITIONS_OUTSTANDING | Open PTD/PTC/PTF conditions | Processor |
| CLEAR_TO_CLOSE | All prior-to-close conditions cleared | Closer / LO |
| APPROVED | Final approve (owner confirm required in prod) | UW / Owner |
| DENIED | Adverse action path | UW / Owner |
| SUSPENDED | Cannot proceed until a blocker is resolved | Processor |
| WITHDRAWN | Borrower or LO withdrew | LO |
| FUNDED | Funds disbursed | Closer |
| CLOSED_LOAN | Closed + post-close package | Closer |

Terminal: DENIED, WITHDRAWN, CLOSED_LOAN.
FUNDED may still take POST_CLOSING documents.

## Legal transitions (only these)

```
DRAFT → APPLICATION_IN_PROGRESS → APPLICATION_SUBMITTED → INITIAL_REVIEW
INITIAL_REVIEW → PROCESSING | SUSPENDED | WITHDRAWN | DENIED
PROCESSING → SUBMITTED_TO_UW | SUSPENDED | WITHDRAWN
SUBMITTED_TO_UW → CONDITIONAL_APPROVAL | APPROVED | DENIED | SUSPENDED | PROCESSING
CONDITIONAL_APPROVAL → CONDITIONS_OUTSTANDING
CONDITIONS_OUTSTANDING → CLEAR_TO_CLOSE | SUBMITTED_TO_UW | SUSPENDED
CLEAR_TO_CLOSE → APPROVED | CONDITIONS_OUTSTANDING
APPROVED → FUNDED | WITHDRAWN
FUNDED → CLOSED_LOAN
Any non-terminal → WITHDRAWN (LO or OWNER)
DENIED is terminal except OWNER reopen → PROCESSING (audit required)
```

A transition MUST write `LoanDomainEvent` type `STAGE_CHANGED` with `{from,to}` and a `LoanFileNote` if reason is required (DENIED, SUSPENDED, WITHDRAWN).

Recalculate `QualificationSnapshot` on enter PROCESSING, SUBMITTED_TO_UW, and whenever income/assets/liabilities/loan amount change.

Grants intelligence snapshot is optional on those same events. It never moves `LoanFile.state`.
