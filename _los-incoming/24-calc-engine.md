# Calculations engine requirements

Pure functions. Integer cents in, integer cents and basis points out.
Never call outputs a credit score or an approval.
Guideline limits live on `LenderOrgSettings` (placeholders). Charles can change them. Do not hardcode agency as "we are approved."

Implementation: `src/los/qualification.ts`.

## Income

`grossMonthlyIncomeCents` =
- Sum of current employment `monthlyIncomeCents`
- Plus countable OT / bonus / commission using the **stated monthly** on the 1003 in sprint 1
- Plus `MortgageIncomeSource.monthlyCents`

Sprint 2 requirement (do not fake it now): W2 OT/bonus/commission averaging (2-year) when documents exist; until then mark `ruleHits` with `INCOME_STATED_NOT_AVERAGED`.

Self-employment: include `businessIncomeCents` and add ruleHit `SELF_EMPLOYED_NEEDS_RETURNS`.

`totalMonthlyIncomeCents` = gross + other.

## Housing expense (front-end)

`housingExpenseCents` (PITI) sprint 1:
- If `monthlyPitiCents` provided on LoanFile, use it
- Else estimate: `estimatedPrincipalInterest` from loanAmount, noteRateBps, termMonths (standard amortization) + 0 tax/insurance until those fields exist (`ruleHits: PITI_PI_ONLY`)

Front-end DTI bps = round(housingExpenseCents * 10000 / totalMonthlyIncomeCents)
If income is 0: do not divide; snapshot with `ruleHits: NO_INCOME`, dti = 99999, withinFront = false.

## Back-end DTI

`otherDebtCents` = sum of liabilities `monthlyCents` where `toBePaidOff` is false.
`totalDebtCents` = housingExpenseCents + otherDebtCents
Back-end DTI bps = round(totalDebtCents * 10000 / totalMonthlyIncomeCents)

## Loan amount

If purpose PURCHASE:
`loanAmountCents` = purchasePriceCents - downPaymentCents (if both present)
Else use stated loanAmountCents from 1003.

## LTV / CLTV

`valueBasisCents` = min(purchasePriceCents, appraisedValueCents) if both; else whichever exists; else 0 (`ruleHits: NO_VALUE_BASIS`).
`ltvBps` = round(loanAmountCents * 10000 / valueBasisCents)
`cltvBps` = round((loanAmountCents + subordinateCents) * 10000 / valueBasisCents)

## Assets / reserves

`assetVerifiedCents` sprint 1 = sum of stated asset balances (ruleHit `ASSETS_STATED_NOT_VERIFIED`).
Sprint 2: only ACCEPTED bank/retirement docs count as verified.
`reservesMonthsBps` = round(assetVerifiedCents * 10000 / housingExpenseCents) if housing > 0
  else 0 with `ruleHits: NO_HOUSING_EXPENSE`.

## Within-guideline flags

Compare to LenderOrgSettings limits (defaults 28/36/97 — PLACEHOLDERS).
`withinFront`, `withinBack`, `withinLtv` are flags for staff. They are not an approval.

## When to run

On: 1003 submit, income/asset/liability patch, loan amount/price change, enter PROCESSING, enter SUBMITTED_TO_UW, staff "Recalculate".
Persist `QualificationSnapshot`. Never overwrite history; insert a new row.

## Forbidden

- Using Credit Hero / MyFICO screenshot numbers as `grossMonthlyIncome`
- Inventing an appraisal
- Showing DTI to the borrower as "you are approved"
- Mixing Grants intelligence score into LTV/DTI
