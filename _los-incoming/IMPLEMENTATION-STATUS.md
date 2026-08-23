# Implementation status — MORTGAGE_LOS drop-in

Runnable TypeScript services + vitest live in `/workspace/mortgage-readiness-os`.
No frontend apply pages. No logo generated. No NMLS IDs invented. No deploy. No github clone.

Legal copy is **DRAFT counsel** (`2026-08-23-cognito-derived-draft-v1`).

## Files changed

- `04-prisma-schema.prisma` — LoanFile DPA/payment/agreement fields; `ComplianceDisclosureType`; `ComplianceAcknowledgment` (`borrowerId` = Client.id); `MortgageApplication.complianceAcknowledgments`; `LegalAcknowledgement.loanAuditLenderRights` (Taylor Carroll + separate-lender fields kept); `LosAutomationEventType.DPA_SELECTED`
- `src/los/application-contract.ts` — `acknowledgedAgentAssignment`, `loanAuditLenderRights`, `serviceResolutionAck`; `acknowledgedTaylorCarroll` + `interestedInDpa1800` kept
- `34-borrower-build-spec.md` — disclosures + DPA required workflow

## Files created

### Service layer (`src/los/`)

- `loan-number.ts`, `ssn-vault.ts`, `dpa.ts`, `compliance.ts`, `lifecycle.ts`, `section-store.ts`, `service.ts`, `api-contract.ts`, `errors.ts`

### Drop-in Next.js handlers (call the service; no apply pages)

- `drop-in/src/app/api/los/applications/route.ts`
- `drop-in/src/app/api/los/applications/[id]/route.ts`
- `drop-in/src/app/api/los/applications/[id]/compliance/route.ts`
- `drop-in/src/app/api/los/applications/[id]/sections/[section]/route.ts`
- `drop-in/src/app/api/los/applications/[id]/submit/route.ts`
- `drop-in/src/app/api/los/applications/[id]/qualification/route.ts`
- `drop-in/src/app/api/los/_handler.ts`
- `drop-in/src/components/los/LosBrandHeader.tsx` (spec only; uses `/brand/logo.png` / BrandLogo; 180 / 148 / 120 px, height auto, object-fit contain)

### Tests

- `tests/loan-file.test.ts`
- `tests/section-save.test.ts`
- `tests/compliance-gate.test.ts`
- `tests/submit.test.ts`
- `tests/ssn-vault.test.ts`
- `tests/dpa.test.ts`
- existing `tests/qualification.test.ts`, `tests/readiness-engine.test.ts` still pass

### Specs / tooling

- `36-compliance-and-dpa.md`
- `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`

## Endpoints completed

| Method | Path |
|---|---|
| POST | `/api/los/applications` |
| POST | `/api/los/applications/:id/compliance` |
| PATCH | `/api/los/applications/:id/sections/:section` |
| POST | `/api/los/applications/:id/submit` |
| POST | `/api/los/applications/:id/qualification` |
| GET | `/api/los/applications/:id` |

In-memory `MortgageLosService` documents the API shape. Drop-in handlers invoke it.

## Tests passing

```
Test Files  8 passed (8)
     Tests  19 passed (19)
```

vitest v3.2.7. Breakdown: qualification 2, readiness-engine 2, ssn-vault 3, compliance-gate 2, section-save 1, dpa 3, submit 3, loan-file 3.

## Submission blockers

PATCH 1003 before e-sign packet → **409** `COMPLIANCE_REQUIRED` missing `E_SIGN_CONSENT`, `CREDIT_AUTHORIZATION`, `INFORMATION_RELEASE`, `ALL_TERMS_PROCEED`.

Submit without full required set → **409** `COMPLIANCE_REQUIRED` missing any of ACCOUNT_CREATION, AGENT_ASSIGNMENT, CREDIT_NO_NEW, CREDIT_NO_LARGE_PURCHASES, CREDIT_NO_ACCOUNT_CHANGES, CREDIT_IMPACT, PAYMENT_NONREFUNDABLE, PAYMENT_CLEARED, LOAN_AUDIT_LENDER_RIGHTS, plus the e-sign packet types.

Submit when stage ≠ `APP_STARTED` → **422** `INVALID_STAGE`.

`DPA_SELECTION` is stored always (Yes adds 180000 + event + confirmation copy; No is valid) and is **not** a blocker.

## Next implementation blocker

Cloud Agents not on current plan so cannot land into iamcgrant/grants-co-os; need Pro or explicit local clone authorization.
