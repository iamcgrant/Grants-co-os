# Grants & Co LOS — Operating Blueprint (Milestone 1)

**Not UI.** This milestone is the domain that makes a mortgage operation runnable.
**Product:** lender-style Loan Origination System inside grants-co-os.
**Deprecated:** prep-and-refer / Cognito-replacement as the product.
**URLA/1003 PDF:** reference for *application data shape* (borrower, employment, assets, liabilities, property, declarations). It is not the workflow.
**Cognito intake:** one requirements source for acknowledgements, credit-program split, DPA, fees. Not the product.
**Status:** SPEC. No production deploy. No live GHL writes. Do not invent NMLS IDs or claim a license.

## Deliverables in this folder

| # | File | What |
|---|---|---|
| 1 | `21-los-operating-schema.prisma` | Entities to APPEND (loan file, lifecycle, conditions, docs, calcs, events) |
| 2 | `22-lifecycle-states.md` | Loan states, legal transitions, who may move |
| 3 | `23-roles-permissions.md` | Roles, assignments, permission matrix |
| 4 | `24-calc-engine.md` + `src/los/qualification.ts` | DTI, housing ratio, LTV, income, assets, loan amount |
| 5 | `25-document-model.md` | Packages, types, statuses, condition links, retention |
| 6 | `26-automation-events.md` | Domain events the OS emits (GHL stubbed) |
| — | `04-prisma-schema.prisma` | URLA application data (keep). LoanFile *wraps* it. |

Application data (1003) lives on `MortgageApplication` / borrowers / employment / assets / liabilities / declarations / property.
**The loan file** (`LoanFile`) is the operational object: stage, party assignments, qualification snapshots, conditions, documents, decisions, events.

ONE HUMAN = ONE `Client`. A loan may have two Clients (borrower + co-borrower). Never a second person row for the same human.
## Repo insertion (from OS inventory, main SHA 2183e7f)

- Staff desk: `src/app/(staff)/mortgage/` following the `/tax` module pattern; nav in `src/lib/nav/role-nav.ts`.
- Client 360 section: `src/app/(staff)/clients/[id]/page.tsx`.
- Borrower: public `/apply` plus `/portal/mortgage` for Role CLIENT.
- New `Service.code` on existing Client master. Acquisition already has `MORTGAGE_PARTNER`.
- Brand: `public/brand/logo.png` via BrandLogo. No `resources/brand/emblem.png` on main.
- Cognito in-repo today is the **tax** Forms puller. Do not reuse it as this application.
- `Document` is metadata-only until an object store ships.
## Canonical files (use these, not both schemas)

Append **only** `04-prisma-schema.prisma` (URLA payload + `LoanFile` / `LoanOriginationStage` / conditions / UW / events). Do not also append `21-los-operating-schema.prisma` (superseded draft; different enum names).

| Concern | Canonical |
|---|---|
| Schema | `04-prisma-schema.prisma` |
| Lifecycle | `15-origination-pipeline.md` (`LoanOriginationStage`) |
| Qualification | `16-qualification.md` + `src/los/qualification.ts` |
| Conditions | `17-conditions-workflow.md` |
| Roles | `18-lo-processor-uw-roles.md` |
| Documents | `25-document-model.md` |
| Events | `26-automation-events.md` + `LosAutomationEvent` in schema |
