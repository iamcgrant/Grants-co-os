# Grants & Co LOS — Milestone 1 is OPERATING MODEL, not UI

**Deprecated:** prep-and-refer / Cognito-replacement as the product.
**Current product:** lender-style mortgage loan origination system.
**Start here:** [LOS-OPERATING-BLUEPRINT.md](./LOS-OPERATING-BLUEPRINT.md)

The 1003/URLA PDF is the *application data* reference. Cognito is one acknowledgements source. The product is the workflow around the file: lifecycle, roles, calcs, documents, conditions, events.

---

# Grants & Co LOS — Operating Blueprint

**Product title:** Grants & Co LOS (Mortgage Loan Origination System)  
**Company:** Grants & Co Consultants  
**Home repo:** https://github.com/iamcgrant/grants-co-os (Next.js 16, Prisma, `src/app/`, Client master, `gc_session` auth)  
**Folder name (keep):** `/workspace/mortgage-readiness-os/`  
**Status:** SPECIFICATION ONLY. Not live. Not merged. Not deployed.  
**Milestone 1:** **domain / ops** — entities, loan lifecycle, roles, permissions, calculation engine, document model, automation events.  
**Not this milestone:** portal wireframes, CSS, page mockups, production deploy, live GHL writes.

---

## What this product is

Grants & Co LOS is a **lender-style Mortgage Loan Origination System** implemented as a **module inside** Grants & Co OS. It originates and processes a mortgage file: URLA/1003 application data, origination pipeline, processing, conditions, underwriting, qualification math, and dual-track Grants overlays.

It is **not** a Cognito clone. It is **not** a short intake. It is **not** “mortgage-readiness-only.” The Cognito form is **one source of requirements** (legal acknowledgements, credit-repair vs MyFICO, DPA $1,800, Taylor Carroll, $1,800 cancel fee). The URLA/1003 PDF is the **borrower application data structure** to reverse-engineer. **The product is the workflow around that application.**

Do not put sample-PDF client PII in files.

---

## Milestone 1 (domain / ops) — this folder

| # | Domain | File |
|---|---|---|
| 1 | Entities / database schema | `04-prisma-schema.prisma` |
| 2 | Loan lifecycle states | `15-origination-pipeline.md` |
| 3 | User roles | `18-lo-processor-uw-roles.md` |
| 4 | Permissions | `18-lo-processor-uw-roles.md` + `01-PRD.md` § RBAC |
| 5 | Calculations engine | `16-qualification.md` |
| 6 | Document model | `01-PRD.md` § documents + `17-conditions-workflow.md` |
| 7 | Automation events | `08-integrations.md` + event catalog in `01-PRD.md` |

Supporting: `01-PRD.md` (vision, personas, journeys as **ops handoffs**, features, tech, security, automation), `02-client-portal.md` (borrower **application data packets**, not UI), `07-internal-dashboard.md` (LO / processor / UW **work queues as domain**, not mockups), `10-file-structure.md` (module insertion), `11-sprint-plan.md` (sprint 1 = LOS foundation).

Sources already incorporated: `00-source-field-extract.md`, `00-field-catalog.json`, `00-os-inventory.md`. Do not guess Cognito. Do not treat Cognito as the product.

---

## Licensing gate (read this)

Software is **LOS-shaped regardless** of current license status.

- `LenderOrgSettings.nmlsId`, `companyNmls` are **optional strings, EMPTY by default**.
- `licensedStates` JSON defaults to `[]`.
- **Do NOT invent an NMLS number.**
- **Going live as an originator is a Charles / counsel / licensing gate.** Schema, stages, UW buttons, and calcs exist in software either way.
- Production **APPROVE / DENY** commits require Charles until he says otherwise (buttons exist; production gate remains).

Do not claim Grants & Co is already licensed. Do not describe the product as “not a lender origination platform.”

---

## Hard constraints

| Action | Allowed? |
|---|---|
| Spec + implement domain/ops on a feature branch | YES |
| Preview URL for later UI sprints | later — not milestone 1 |
| Merge to `main` / deploy `os.grantandconsultants.com` | NO |
| Live GHL / LeadConnector writes | NO in sprint 1; stub only |
| Generate a logo | NEVER — `public/brand/logo.png` via `BrandLogo.tsx` only |
| Sample-PDF client PII in files | NEVER |
| Invent NMLS / agency approval | NEVER |
| Present DTI/LTV/reserves as a credit score | NEVER |
| Second SMS/email provider | NEVER — GHL is CRM overlay |
| Scrape Credit Karma / bureaus | NEVER — DisputeFox is credit-repair track |

---

## Dual track (always)

1. **Origination track** — `LoanOriginationStage` on `LoanFile` (APP_STARTED → … → FUNDED / CLOSED / DENIED / WITHDRAWN). This is the loan decision path.
2. **Grants proprietary track** — `GrantsReadinessTrack` (credit ready, docs ready, prep ready, internal 0–100 overlay). Overlay only. **Not** the origination decision. **Not** a credit score.

Credit-repair path (Cognito Yes → Credit Hero) attaches DisputeFox. MyFICO path is a condition/document, not a bureau scrape.

---

## Brand (when UI exists later)

- Mark: `public/brand/logo.png` + `src/components/brand/BrandLogo.tsx`. Never generate, trace, or SVG-redraw.
- Borrower surface later: black / champagne gold / cream / white.
- Existing OS: gold `#f5b82a`, charcoal `#16161a`, cream `#f6f1e7`.
- Milestone 1 does not ship chrome.

---

## Auth / identity

Reuse `gc_session` (jose + bcryptjs). Role enum unchanged. LOS functions are `LoanStaffAssignmentType`: `LOAN_OFFICER`, `PROCESSOR`, `UNDERWRITER`. ONE HUMAN = ONE `Client`. `MortgageApplication` belongs to `Client`. `LoanFile` belongs to `MortgageApplication`.

## How to implement (engineers)

1. Read this README, then `01-PRD.md`.
2. Append `04-prisma-schema.prisma` into both Prisma schema files. Do not drop URLA borrower models.
3. Seed `Service.code = MORTGAGE_LOS`. Seed `LenderOrgSettings` empty. Seed condition catalog.
4. Implement engines in `src/lib/los/` per `10-file-structure.md`: pipeline, qualification, conditions, permissions, documents, events.
5. GHL / DisputeFox remain stubs (`08-integrations.md`).
6. Sprint 1 done = schema + engines + tests, not a portal.
