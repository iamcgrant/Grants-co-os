# Implementation tasks (ordered)

Repo: iamcgrant/grants-co-os. Branch. No merge to main. No prod deploy. No live GHL.

## A. Backend models (task 1 — NEXT BUILD)

- Append `04-prisma-schema.prisma` into `prisma/schema.prisma` AND `prisma/schema.postgres.prisma`.
- Patch Client / User / Document relations (comments at bottom of 04).
- Seed `Service.code=MORTGAGE_LOS` (not CREDIT_OPT).
- IdSequence `gc_loan` → `GC-LN-######`.
- `.env.example`: `MORTGAGE_PII_KEY=` (32-byte base64). Do not invent a live key.
- Migration local SQLite + note for Neon.
- Tests: prisma generate succeeds.

## B. API endpoints (task 2)

All under `src/app/api/los/` using `gc_session`.

| Method | Path |
|---|---|
| POST | `/api/los/applications` |
| GET | `/api/los/applications/:id` |
| POST | `/api/los/applications/:id/compliance` |
| PATCH | `/api/los/applications/:id/sections/:section` |
| POST | `/api/los/applications/:id/co-borrower` |
| POST | `/api/los/applications/:id/documents` |
| POST | `/api/los/applications/:id/submit` |
| GET | `/api/los/staff` (LO/processor queue, stage >= APP_SUBMITTED) |
| GET | `/api/los/staff/:id` |
| PATCH | `/api/los/staff/:id/stage` |
| POST | `/api/los/staff/:id/notes` |
| POST | `/api/los/staff/:id/conditions` |
| POST | `/api/los/staff/:id/ai-review` (intelligence overlay only) |

Zod: `src/lib/los/application-contract.ts` (generated in this pack as `src/los/application-contract.ts`).
Qual engine: copy `src/los/qualification.ts` → `src/lib/los/qualification.ts`.
SSN vault: `src/lib/los/ssn-vault.ts`.
Permissions: `src/lib/los/permissions.ts` from 23/18.

## C. Frontend (task 3 — after A+B tests green)

Borrower (CLIENT):
- `src/app/apply/layout.tsx` + `page.tsx` redirect
- `src/app/apply/account/page.tsx` (reuse login/register)
- `src/app/apply/[id]/compliance/page.tsx`
- `src/app/apply/[id]/[section]/page.tsx`
- `src/app/apply/[id]/documents/page.tsx`
- `src/app/apply/[id]/submit/page.tsx`
- components under `src/components/los/apply/`
- BrandLogo only (`/brand/logo.png`). Cream/gold tokens from 13-ui-tokens.md.

Staff:
- `src/app/(staff)/mortgage/page.tsx` queue
- `src/app/(staff)/mortgage/[id]/page.tsx` file
- nav item in `role-nav.ts`

Do not build these until contract tests pass.

## D. Automation (task 4)

Persist `LosAutomationEvent` on the catalog in 26. GHL/DisputeFox STUB only.

## Definition of next build (A)

Done when: preview (or local) can create a CLIENT, create LoanFile, save compliance, PATCH borrower section, GET last4-only SSN, qualification snapshot on loan PATCH. No public hostname required.
