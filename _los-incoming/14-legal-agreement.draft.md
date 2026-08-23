# DRAFT — Grants & Co Consultants Home Loan Readiness Service Agreement & Acknowledgement

**STATUS: DRAFT. NOT LEGAL ADVICE. NOT IN PRODUCTION.**
Charles Grant and counsel must approve before this copy is shown to a real client.
Sourced from the live Cognito intake "Grant & Co Consultants Home Buying & Credit Readiness Intake" (form 4) on 2026-08-23, plus the URLA-style credit/information-release gates. Do not replace these terms with friendlier invented language unless Charles changes them.

---

Company: Grants & Co Consultants
Product: Home Loan Readiness Service (credit readiness + file preparation + transaction coordination). Grants & Co Consultants is **not a lender**, does **not originate mortgages**, and does **not approve loans**.

## Client-facing body (draft)

**No guarantees.** No outcome, credit score increase, loan approval, interest rate, or property acquisition is guaranteed.

**Not a lender.** This service prepares your file for a lender. A lender, if any, makes every credit and underwriting decision.

**Client financial responsibilities.** You are responsible for all home buying costs including inspections, appraisals, earnest money, down payment, and closing costs.

**Payment.** This is a nonrefundable service. Payment must be made before services begin. Services will not begin until payment has cleared.

**Cancellation.** If you cancel after starting this process, you will incur an $1,800 cancellation fee payable to the realty company. This is not a process where you can start and change your mind.

**Credit conduct.** You agree not to apply for new credit during this process, not to make large purchases, and not to add or remove accounts without approval. You understand this may negatively impact approval.

**Credit authorization.** You authorize Grants & Co Consultants to obtain and review credit information for the purpose of home-loan readiness (not as a lender).

**Information release.** You authorize Grants & Co Consultants to share file information with assigned staff, the in-house real-estate agent, and a referred lender as needed to perform this service.

**Account creation.** You understand that a separate name, phone number, and email may be created on your behalf for lender and transaction purposes. Upon closing, you will receive all login credentials and account access.

**Agent assignment.** Our in-house agent, Taylor Carroll, will assist with showings, negotiations, and transaction coordination throughout the home buying process.

**Down payment assistance (optional).** If selected, Down Payment Assistance ($1,800) will be added to your package. This still keeps you at a discounted rate compared to standard closing costs. New construction (for example DR Horton) may maximize incentives.

**Credit program.** If credit repair is included with your home package, you must create a Credit Hero Score account immediately and upload confirmation. If credit repair is not included, you must provide MyFICO mortgage scores (legacy intake stated a 620 minimum as instruction, not as a Grants & Co approval).

**Electronic signature.** Checking the box, typing your name, drawing your signature, and submitting records your agreement, the date, the time, and the IP address used.

## System capture (required fields)

- agreedToTerms checkbox (required)
- typedFirst + typedLast
- signatureStorageKey (drawn)
- acknowledgementDate
- acknowledgedAt (server timestamp)
- ip
- userAgent
- documentVersion (e.g. `hlrsa-2026-08-23-draft`)
- nonrefundableAck, paymentClearedAck, cancellationFeeAck, noChangeMindAck
- creditAuthAck, infoReleaseAck, notALenderAck

Client cannot PATCH steps 1–8 until this row exists with agreedToTerms=true.
