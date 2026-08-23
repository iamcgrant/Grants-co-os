# 10 — Module file structure (domain first)

Milestone 1 implements **lib + schema + tests**. App routes are insertion points for a later UI sprint — do not build portal chrome now.

Append Prisma to **both** `prisma/schema.prisma` and `prisma/schema.postgres.prisma`.

```
prisma/schema.prisma                         # append 04-prisma-schema.prisma (keep URLA models)
prisma/schema.postgres.prisma                # same
prisma/seed.ts                               # Service MORTGAGE_LOS; LenderOrgSettings empty;
                                             # ConditionCatalogItem seed; IdSequence grants_loan

src/lib/los/pipeline.ts                      # stages, transitions, SLAs
src/lib/los/qualification.ts                 # DTI/LTV/CLTV/reserves/loan amount (cents, bps)
src/lib/los/guidelines.ts                    # conventional 28/36 defaults; Charles-editable
src/lib/los/conditions.ts                    # catalog, status machine, action plan rebuild
src/lib/los/permissions.ts                   # maps Role + LoanStaffAssignmentType
src/lib/los/documents.ts                     # Document + MortgageDocumentFile + condition link
src/lib/los/events.ts                        # LosAutomationEvent writer (no PII)
src/lib/los/ssn-vault.ts                     # existing vault helper
src/lib/los/ghl-stub.ts                      # no live writes
src/lib/los/disputefox-stub.ts               # credit-repair track stub
src/lib/los/loan-number.ts                   # GC-LN-###### via IdSequence

src/lib/rbac/permissions.ts                  # add VIEW_LOS, LOS_* keys
src/lib/nav/role-nav.ts                      # later: LOS nav; not milestone 1 chrome

src/app/api/los/loans/route.ts               # later
src/app/api/los/loans/[id]/route.ts
src/app/api/los/loans/[id]/stage/route.ts
src/app/api/los/loans/[id]/qualify/route.ts
src/app/api/los/loans/[id]/conditions/route.ts
src/app/api/los/loans/[id]/decisions/route.ts

# Route insertion (do not implement UI this milestone)
src/app/apply/**                             # borrower application
src/app/(portal)/portal/loan/**              # logged-in borrower
src/app/(staff)/los/page.tsx                 # /los
src/app/(staff)/los/pipeline/page.tsx        # /los/pipeline
src/app/(staff)/los/loans/[id]/page.tsx
src/app/(staff)/los/loans/[id]/processing/page.tsx
src/app/(staff)/los/loans/[id]/conditions/page.tsx
src/app/(staff)/los/loans/[id]/underwriting/page.tsx

tests/los-pipeline.test.ts
tests/los-qualification.test.ts
tests/los-conditions.test.ts
tests/los-permissions.test.ts
tests/los-ghl-stub.test.ts                   # assert no network

.env.example                                 # + MORTGAGE_PII_KEY= + MORTGAGE_GHL_WRITES_ENABLED=false
docs/LOS.md                                  # short module doc in the OS repo
```

Wire existing models when merging:

```
model Client { mortgageApplications MortgageApplication[]; ssnVaults SsnVault[] }
model User {
  mortgageAssignments MortgageStaffAssignment[]
  mortgageNotes MortgageApplicationNote[]
  mortgageAuditEvents MortgageAuditEvent[] @relation("MortgageAuditActor")
  underwritingDecisions UnderwritingDecision[] @relation("UwDecisionActor")
  charlesUwGates UnderwritingDecision[] @relation("CharlesUwGate")
}
model Document { mortgageFiles MortgageDocumentFile[]; loanConditionDocs LoanCondition[] }
```

Brand when UI exists: `public/brand/logo.png` via `BrandLogo.tsx` only. Never generate a logo.
