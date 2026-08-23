# Automation events

Every event inserts `LoanDomainEvent`. Payload is JSON, no SSN, no full account numbers.
`ghlDispatch` stays `STUB` until Brain lifts the GHL write gate. Do not add a second inbox watch.

## Event catalog

| type | When | Payload (keys) | Listeners (sprint 1 / later) |
|---|---|---|---|
| LOAN_FILE_CREATED | LoanFile insert | loanNumber, clientId | none |
| APPLICATION_STARTED | 1003 first patch | applicationId | none |
| APPLICATION_SAVED | step autosave | step | none |
| ECONSENT_RECORDED | agreement + IP + UA | documentVersion, ip | STAGE if still DRAFT |
| DISCLOSURE_ACKNOWLEDGED | named disclosure | disclosureCode | none |
| APPLICATION_SUBMITTED | borrower submit | | generate doc checklist; qual snapshot; state→APPLICATION_SUBMITTED |
| STAGE_CHANGED | legal transition | from, to, reason | refresh action plan; qual on PROCESSING and SUBMITTED_TO_UW |
| ASSIGNMENT_CHANGED | staff function | function, userId, active | none |
| DOCUMENT_REQUESTED | checklist or condition | typeCode, conditionId? | borrower action item |
| DOCUMENT_UPLOADED | borrower/staff | losDocumentId, typeCode | notify assigned processor (in-OS Notification, not GHL yet) |
| DOCUMENT_REJECTED | processor/UW | reason | borrower action item reopen |
| DOCUMENT_ACCEPTED | processor/UW | | maybe clear condition if all linked accepted |
| CONDITION_ISSUED | processor/UW | conditionId, timing | action plan item |
| CONDITION_SUBMITTED | borrower uploaded all linked | conditionId | status RECEIVED |
| CONDITION_CLEARED | UW/processor per matrix | | if no PTC open → eligible CLEAR_TO_CLOSE |
| CONDITION_WAIVED | UW/OWNER | | same as cleared |
| QUALIFICATION_RECALCULATED | engine run | snapshotId, frontDtiBps, backDtiBps, ltvBps | staff widget |
| UW_DECISION_RECORDED | decide() | kind | state change per 22-lifecycle |
| OWNER_CONFIRMED_DECISION | OWNER | decisionId | allow APPROVED/DENIED to stand |
| ACTION_PLAN_UPDATED | derived | openCount | portal badge |
| INTELLIGENCE_REFRESHED | overlay | score | staff only |
| GHL_CONTACT_UPSERT_REQUESTED | after submit | clientId | STUB |
| DISPUTEFOX_LINK_REQUESTED | if credit repair | clientId | STUB |

## Derived borrower action plan

Rebuild on: CONDITION_ISSUED, DOCUMENT_REJECTED, DOCUMENT_REQUESTED, STAGE_CHANGED.
Items = open conditions with `borrowerAction=true` plus rejected/requested docs requestedFrom=BORROWER.
This is the intelligence layer's "what to do next" for the borrower. It is not a new source of truth.

## What does not get a bot email/SMS in sprint 1

Anything outbound to the borrower except in-OS portal state. GHL remains the only phone/SMS/email backend when the gate lifts.
