# 16 — Qualification engine

Computes **ratios and amounts** for a `LoanFile`. Persists `QualificationSnapshot`.

**This is not a credit score.** Do not name fields `score`. Do not mix `GrantsReadinessTrack.score` (0–100 internal overlay) into this engine. Do not present DTI, LTV, CLTV, or reserves as a FICO/Vantage/MyFICO result.

Guideline numbers are **placeholders**. Conventional **28 / 36** (front / back) are **DEFAULTS Charles can change**. Selecting `guidelineSet = CONVENTIONAL` (or FHA/VA/USDA) is **not** agency approval and **not** investor sign-off. Do not invent agency limits beyond these defaults.

---

## 1. Units

| Quantity | Storage | Scale |
|---|---|---|
| Money | `Int` cents | $1.00 = `100` |
| Note rate | `Int` bps | 6.500% = `650` (1 bp = 0.01%) |
| DTI, LTV, CLTV | `Int` bps | 28.00% = `2800`; 80.00% = `8000` |
| Term | `Int` months | 360 |
| Reserves | `Int` months | trunc toward 0 |
| Occupancy | `OccupancyKind` enum | input, not a formula |

All integer arithmetic: **multiply first, then divide**. Default rounding: **half-up** to nearest integer bps (remainder ≥ divisor/2 rounds up). Document the rounding in the snapshot via `inputsHash` including `rounding=HALF_UP`.

Division by zero: do not compute; persist snapshot with ratio fields null only if a required denominator is 0; otherwise reject compute with error code `QUAL_DIV_ZERO`. Do not coerce to 0 bps (that would look like 0.00% DTI).

---

## 2. Inputs (cents / enums)

Pulled from URLA models + `LoanFile` overrides (LoanFile wins when non-null).

| Input | Source | Notes |
|---|---|---|
| `monthlyQualifyingIncomeCents` | sum `Employment.monthlyIncomeBeforeTaxesCents` (current) + OT/commission/bonus if flagged + `IncomeSource.monthlyAmountCents` where not `doesNotApply` | Borrower + co-borrower |
| `firstMortgagePiCents` | derived from `loanAmountCents`, `noteRateBps`, `termMonths` **or** staff-entered PITI component | If note/term missing, staff must supply `monthlyHousingExpenseCents` override |
| `propertyTaxMonthlyCents` | staff/condition; 0 if unknown | Do not invent tax |
| `hoiMonthlyCents` | staff/condition; 0 if unknown | HOI |
| `miMonthlyCents` | staff; 0 if unknown | |
| `hoaMonthlyCents` | staff; 0 if unknown | |
| `otherHousingCents` | staff | ground rent, etc. |
| `liabilityMonthlyCents` | sum `Liability.monthlyPaymentCents` where not `doesNotApply` and not `toBePaidOff` | |
| `loanAmountCents` | `LoanFile` or `PropertyGoal.loanAmountNeededCents` | |
| `purchasePriceCents` | `LoanFile` or `PropertyGoal.estimatedPurchasePriceCents` | |
| `downPaymentAmountCents` | `PropertyGoal.downPaymentAmountCents` | |
| `appraisedValueCents` | `LoanFile` or `AppraisalOrder.valueCents` | stub may be null |
| `subordinateLienCents` | staff; default 0 | |
| `liquidAssetCents` | sum `AssetAccount.estimatedBalanceCents` + other assets not `doesNotApply` | Client-entered estimates; label unverified in payload |
| `occupancy` | `LoanFile.occupancy` or `PropertyGoal.occupancy` | |
| `guidelineSet` | `LoanFile.guidelineSet` default `CONVENTIONAL` | |

Do not invent missing money. Null vs 0: 0 means “known zero”; null means “not supplied.” Housing components that are null are treated as 0 **only if** a staff override `monthlyHousingExpenseCents` is provided; else compute fails `QUAL_MISSING_HOUSING` when PI cannot be derived.

---

## 3. Formulas

### 3.1 Loan amount (purchase)

```
computedLoanAmountCents = purchasePriceCents - downPaymentAmountCents
```

If `LoanFile.loanAmountCents` is set and differs from computed, snapshot stores the **file** amount and flags `loanAmountMismatch=true` inside `inputsHash` payload (boolean on snapshot via notes/hash, not a third ratio). Do not silently overwrite. Refinance: no purchase subtraction; use `loanAmountCents` as given (required).

Never treat loan amount as a score.

### 3.2 Monthly PI (standard amortization, integer cents)

When `noteRateBps`, `termMonths`, and `loanAmountCents` are present:

```
monthlyRate = noteRateBps / 120000
  # 6.50% APR -> noteRateBps=650 -> monthlyRate = 650/120000

PI = L * r / (1 - (1+r)^(-n))
firstMortgagePiCents = halfUp( loanAmountCents * r * (1+r)^n / ((1+r)^n - 1) )
```

Implement with BigInt rationals (`rNum = noteRateBps`, `rDen = 120000`). No IEEE float as the source of truth.

Unit test: `loanAmountCents=40000000` ($400,000), `noteRateBps=650` (6.50%), `termMonths=360` → PI within **1 cent** of standard amortization (~`252827` cents). This PI is a housing-expense input, **not** a credit score.

If note/term missing: PI must be staff-supplied; do not guess a rate.

### 3.3 Front-end DTI (housing)

```
monthlyHousingExpenseCents =
    firstMortgagePiCents
  + propertyTaxMonthlyCents
  + hoiMonthlyCents
  + miMonthlyCents
  + hoaMonthlyCents
  + otherHousingCents

frontDtiBps = halfUp(monthlyHousingExpenseCents * 10000 / monthlyQualifyingIncomeCents)
```

Example: housing $2,800.00 = `280000` cents; income $10,000.00 = `1000000` cents → `2800` bps = **28.00% front-end DTI**. Not a credit score.

### 3.4 Back-end DTI (total)

```
monthlyTotalDebtCents = monthlyHousingExpenseCents + liabilityMonthlyCents

backDtiBps = halfUp(monthlyTotalDebtCents * 10000 / monthlyQualifyingIncomeCents)
```

Example: total debt $3,600.00, income $10,000.00 → `3600` bps = **36.00% back-end DTI**.

Liabilities marked `toBePaidOff` are excluded. `doesNotApply` excluded.

### 3.5 LTV

```
valueCents = if appraisedValueCents and purchasePriceCents:
               min(appraisedValueCents, purchasePriceCents)
             else coalesce(appraisedValueCents, purchasePriceCents)

ltvBps = halfUp(loanAmountCents * 10000 / valueCents)   # require valueCents > 0
```

Example: loan $320,000, value $400,000 → `8000` bps = **80.00% LTV**.

Refinance: value = appraised (required); do not min() against purchase if purchase is null.

### 3.6 CLTV

```
cltvBps = halfUp((loanAmountCents + subordinateLienCents) * 10000 / valueCents)
```

If `subordinateLienCents = 0`, CLTV = LTV.

### 3.7 Reserves (months)

```
if monthlyHousingExpenseCents <= 0: reservesMonths = null (QUAL_MISSING_HOUSING)
else:
  reservesMonths = floor(liquidAssetCents / monthlyHousingExpenseCents)
```

Trunc toward 0. Example: liquid $16,800.00 / housing $2,800.00 → `6` months. Not a credit score.

### 3.8 Occupancy

No formula. Persist `LoanFile.occupancy`. Guideline row **may** key on occupancy later; until Charles supplies occupancy-specific limits, conventional 28/36 apply to all occupancies. Do not invent second-home/investment DTI caps.

---

## 4. Guideline placeholders

Table in code (`src/lib/los/guidelines.ts`), editable conceptually by Charles (OWNER writes). Seed:

| guidelineSet | occupancy | frontLimitBps | backLimitBps | notes |
|---|---|---|---|---|
| `CONVENTIONAL` | any | **2800** | **3600** | DEFAULT. Charles can change. Not GSEs’ blessing. |
| `FHA` | any | 2800 | 3600 | **placeholder copy of conventional until Charles sets FHA** |
| `VA` | any | 2800 | 3600 | placeholder |
| `USDA` | any | 2800 | 3600 | placeholder |
| `PORTFOLIO` | any | 2800 | 3600 | placeholder |
| `OTHER` | any | 2800 | 3600 | placeholder |

`withinFront = frontDtiBps <= frontLimitBps`  
`withinBack = backDtiBps <= backLimitBps`

These booleans are **limit checks against placeholders**, not credit decisions, not UW approval, not agency AUS findings. UW decision is a separate entity.

Do not auto-DENY when outside limits. Surface `withinFront`/`withinBack` on the snapshot only.

LTV/CLTV limit rows: **not seeded** (UNKNOWN). Do not invent 80% max. Snapshot still stores computed LTV/CLTV.

---

## 5. Snapshot persistence

Every successful compute inserts `QualificationSnapshot` (immutable row). `LoanFile` denormalizes the latest: `frontDtiBps`, `backDtiBps`, `ltvBps`, `cltvBps`, `reservesMonths`, `loanAmountCents`.

`inputsHash`: canonical JSON of inputs + guideline limits + rounding mode + engine version string `qual-v1`. SHA-256 hex.

Emit `LosAutomationEvent` `QUALIFICATION_COMPUTED`. Payload: snapshot id, bps, cents, guidelineSet. **No SSN. No bureau score. No Grants overlay score.**

Required before stage `SUBMITTED_TO_UW` (processor may compute earlier).

---

## 6. Forbidden presentations

- “Qualification score: 72”
- “Credit score equivalent”
- Using 620 (MyFICO instruction) as DTI/LTV
- Copying `ReadinessScore.score` or `GrantsReadinessTrack.score` into DTI fields
- Claiming FHA/VA/USDA approval because `guidelineSet` was selected
