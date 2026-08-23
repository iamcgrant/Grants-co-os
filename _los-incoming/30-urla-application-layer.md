# Borrower application layer (not UI)

The form is the front door. `LoanFile` is the source of truth.
Creating an application creates `MortgageApplication` + `LoanFile` (`originationStage=APP_STARTED`, `loanNumber=GC-LN-######`).
Section saves patch 1003 entities and `ApplicationSectionState`. Submit is the only borrower transition to `APP_SUBMITTED`.

**Not in this milestone:** screens, CSS, mockups.

## Files

| File | What |
|---|---|
| `31-urla-field-map.json` | Every field: section, key, type, required, entity, column, validation |
| `32-validation-and-journey.md` | Required logic, branching, docs triggers, events |
| `33-application-schema-patches.prisma` | Address history, section state, REO mortgage/rent (missing on current Reo) |

## URLA section → entities

| Form section | Writes |
|---|---|
| 0 Compliance / eConsent | `LegalAcknowledgement` (+ IP, UA, version). Blocks 1003 PATCHes until `agreeAllTermsProceed=true`. |
| 1 Borrower | `MortgageBorrower` (PRIMARY) + `SsnVault` + `BorrowerAddressHistory` + `Client` master |
| 2 Co-borrower | Second `Client` + `MortgageBorrower` (CO_BORROWER). Skip if `present=false`. |
| 3 Employment & income | `Employment[]` + `IncomeSource[]` (per borrower) |
| 4 Assets | `AssetAccount[]` + `MortgageGiftGrant[]` + `MortgageOtherAsset[]` |
| 5 Liabilities | `Liability[]` |
| 6 Real estate owned | `MortgageReo[]` (patched with mortgage + rent + disposition) |
| 7 Loan information | `PropertyGoal` **and** `LoanFile` (purpose, prices, loanAmount, occupancy, propertyType, termMonths) |
| 8 Declarations | `Declaration` per borrower + `MortgageCreditItem[]` |
| Submit | `LoanFile.originationStage=APP_SUBMITTED`, `LosAutomationEvent`, `QualificationSnapshot`, document requests |

Co-borrower employment/assets/liabilities/declarations are the same entities keyed by `borrowerId`.

## LoanFile sync on every LOAN section save and on submit

Copy into `LoanFile`: purpose, purchasePriceCents, downPaymentCents, loanAmountCents, occupancy, propertyType, termMonths.
Then run `calculateQualification` (do not change stage).
