# 11 — Sprint plan

**Definition of done (sprint 1):** domain/ops engines + Prisma + tests on a feature branch. **Not** a Cognito clone. **Not** portal UI. **Not** production. **Not** live GHL.

Gates closed unless Charles/Brain lift them: merge to `main`, deploy `os.grantandconsultants.com`, live GHL writes (`NsmlbLVNr4SBJNC8gnrn`), Mac/Safari control.

---

## Sprint 1 — LOS foundation (week 1) — THIS MILESTONE

Must:

1. **Schema.** Append `04-prisma-schema.prisma` to both Prisma files. Keep all URLA borrower models. Add `LoanFile`, origination enum, conditions, action plan, qualification snapshot, UW decision, appraisal stub, processing checklist, `GrantsReadinessTrack`, `LenderOrgSettings` (NMLS empty), `LosAutomationEvent`.
2. **Seed.** `Service.code = MORTGAGE_LOS`. Empty `LenderOrgSettings`. Condition catalog. `IdSequence` for `GC-LN-######`. Do not overload `CREDIT_OPT`. Do not invent NMLS.
3. **Pipeline engine.** Transitions + who-can-move + SLAs (`15-origination-pipeline.md`). Dual track: origination vs Grants overlay.
4. **Qualification engine.** Front/back DTI, LTV/CLTV, reserves, loan amount; cents + bps; conventional 28/36 defaults (`16-qualification.md`). Tests: never named a credit score; 28.00% maps to 2800 bps.
5. **Conditions engine.** Statuses, catalog auto-open, borrower action plan rebuild (`17-conditions-workflow.md`).
6. **RBAC.** Permission keys + assignment types LO / PROCESSOR / UNDERWRITER mapped onto existing Role. Charles production gate on APPROVE/DENY (`18-lo-processor-uw-roles.md`).
7. **Documents model.** Link `Document` + `MortgageDocumentFile` + `LoanCondition.documentId`. No requirement to ship blob adapter.
8. **Events.** `LosAutomationEvent` writer. GHL stub (`MORTGAGE_GHL_WRITES_ENABLED=false`, no fetch). DisputeFox stub for credit-repair track.
9. **Legal + SSN vault** as data (existing models). No wireframes.

Tests (vitest):

- pipeline illegal moves reject (borrower cannot APPROVE; UW cannot production-release without OWNER)
- qualification: housing 280000 cents / income 1000000 -> frontDtiBps=2800; back 360000 -> 3600; LTV 80% -> 8000; reserves floor; div-zero error; snapshot has no field named score
- conditions: submit auto-opens GOV_ID + path proof; borrower cannot CLEARED
- ghl stub does not network
- seed LenderOrgSettings nmlsId is null
- existing tax Cognito tests still pass

Done: PR with schema + `src/lib/los/**` + tests. No claim of live origination. No UI required.

---

## Sprint 2 — Application APIs + staff/borrower persistence (week 2)

HTTP routes for packets, submit, conditions, qualify. Still no luxury portal. Still no live GHL. Document metadata uploads if adapter exists; else storageKey placeholders.

---

## Sprint 3 — Queues as real pages (week 3) — UI milestone, not now

`/los/pipeline`, LO/processor/UW queues, `/apply` URLA steps, BrandLogo, cream/gold. Click-test preview. Still production-gated UW. Still no merge to main.

---

## Sprint 4 — Gated integrations (week 4)

GHL upsert behind flag (default false). DisputeFox attach when credit-repair. Charles decision: lift APPROVE/DENY self-gate? Populate NMLS only with real numbers from Charles/counsel — never invent.

---

## All sprints

- No sample-PDF client PII
- EXAMPLE fixtures labeled `exampleData=true`
- Never log full SSN
- Never present calcs as a credit score
- Never claim licensed without `LenderOrgSettings` populated by Charles
- Click-test before claiming live (when UI exists)
