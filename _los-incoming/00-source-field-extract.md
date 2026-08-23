# Source field extract — Grants & Co Mortgage Readiness OS

**Extracted:** Sunday, Aug 23, 2026, 3:07 PM ET  
**Product truth:** This is a **credit-readiness + home-buying intake**, not mortgage origination. Grants & Co prepares clients, then refers to a lender. GHL = CRM. DisputeFox = credit/dispute board. No API keys invented.

Client PII from the sample loan PDF is **not** recorded here. Field names and example formats only.

---

## A) Cognito field inventory — **FOUND (live)**

**URL:** https://www.cognitoforms.com/GrantCoConsultants/GrantCoConsultantsHomeBuyingCreditReadinessIntake  

**How retrieved (not JS-rendered in a browser):**

1. `GET` public URL → HTML shell only (title + `data-form="4"` + `data-key="QZTmaMu3bEOpm_9ZKbBBPw"` + `/f/seamless.js`).
2. `seamless.js` loads form def as a script:  
   `GET https://www.cognitoforms.com/svc/load-form/form-def/QZTmaMu3bEOpm_9ZKbBBPw/4`  
   gzip JS IIFE with Vue template + `modelOptions`.
3. Session flags (no tokens stored):  
   `POST https://www.cognitoforms.com/svc/load-form/new-session/QZTmaMu3bEOpm_9ZKbBBPw/4?embedContext=public` body `{}`.

WebFetch of the public URL timed out. Curl of the HTML shell succeeded. Authenticated Cognito REST (`/api/forms/...`) returns 401 without org API key — **not used**.

**Form identity (FOUND)**

| Item | Value |
|---|---|
| Title | Grant & Co Consultants  Home Buying & Credit Readiness Intake |
| InternalName | GrantCoConsultantsHomeBuyingCreditReadinessIntake |
| Organization | Grant & Co Consultants |
| OrganizationId | `773bc7eb-f96c-43fb-ad9c-9257434e7bef` |
| Form id | `4` |
| Public data-key | `QZTmaMu3bEOpm_9ZKbBBPw` |
| Public role | Applicant |
| Entry display format | `[Section1ClientInformation.FullName]` |
| Header description | empty |
| HideHeading | true |

**Submit / workflow (FOUND)**

| Item | Value |
|---|---|
| Paging flag | true |
| Visible pages in template | **1** (`:is-submission='lastVisiblePageNumber === 1'`) |
| Primary button | **Submit Application** |
| Allowed when | Status = Incomplete AND Role = Applicant |
| New status | **Under Review** (id 1) |
| Confirmation | ConfirmationPage: “Thank you for filling out the form. Your response has been recorded.” |
| Include entry details | false |
| Redirect URL | null |
| Save & resume | **false** |
| Payment on this form | **false** (`paymentProcessor: None`, `Require_Payment_Expression` returns false) |
| Encrypt flag | **false** |
| File upload limit (session) | `250` — unit **UNKNOWN** (commonly MB) |
| Allowed upload types | jpg, jpeg, png, pdf |
| Max files per upload field | 10 |
| Cancel workflow action | exists (id 6 → Cancelled). Whether the public page shows a Cancel button: **UNKNOWN** |

**Workflow statuses (FOUND):** Incomplete, Under Review, Awaiting Documents, Payment Pending, In Process, Completed, Cancelled.

**Roles mentioned (FOUND):** Applicant, Grant & Co Admin, Loan Coordinator.

**Conditional logic (FOUND vs NOT FOUND)**

- **NOT FOUND** in the Vue template: `v-if` / `v-show` that hides Credit Hero vs MyFICO fields or the “If Yes / If No” HTML. Those blocks are always in the template.
- **FOUND** helper copy that *describes* a Yes/No split (Credit Hero vs MyFICO 620).
- **FOUND** schema: Credit Hero and MyFICO file fields have **no** `required: true` (unlike DL upload).
- **FOUND** several Yes/No checkboxes that must equal `true` (cannot submit as No).
- **FOUND** `SignatureDrawn` `v-if='flags.signatureField || !flags.conditionalVisibility'` (platform flag, not a user-answer rule).
- Session flag `ConditionalVisibility: true` is on; field-level `visible`/`showWhen` keys were **NOT FOUND** in `modelOptions`.

Brain fallback: `/workspace/grants-co-brain` was searched. **No dump of this form.** Brain only notes a different Cognito use (tax intake). `returning-client-luxury-email` is an email skill, not an intake schema.

---

### Section 1 — Client Information (`Section1ClientInformation`)

| Source | Label | Type | Required | Helper text / notes |
|---|---|---|---|---|
| FullName | Full Name | name (UI: First, Last only) | **Yes** (First+Last) | “Enter your full legal name as it appears on government ID.” Name type also has Middle/Prefix/Suffix — **not shown** (`properties='First,Last'`). |
| PhoneNumber | Phone Number | US phone | **Yes** | “Provide a number we can use to contact you about your home purchase.” Mask `(###) ###-#### x########`. |
| EmailAddress | Email Address | email | **Yes** | “We will use this email for all communications and account setups.” |
| DateOfBirth | Date of Birth | date | **Yes** | “Required for identity verification.” Format `d` (culture `M/d/yyyy`). |
| SocialSecurityNumber | Social Security Number | single-line text | **Yes** | HTML help: “Enter your full Social Security number.” **No mask FOUND. Encrypt flag false.** Vault in OS. |
| CurrentAddressFullAddressWithCityStateZip | Current Address (Full address with city, state, zip) | US address | **Yes** (Line1, City, State, PostalCode) | “Provide your current residential address including city, state, and postal code.” Country defaults United States / US. Zip validated. Line2 optional. |

### Section 2 — ID Verification (`Section2IDVerification`)

| Source | Label | Type | Required | Helper text |
|---|---|---|---|---|
| UploadDriversLicenseOrStateID | Upload Driver’s License or State ID | file[] | **Yes** | “Upload a clear, readable photo or scan of your government-issued ID (front and back if possible).” jpg/jpeg/png/pdf, max 10. |

### Section 3 — Credit & Program Selection (`Section3CreditProgramSelection`)

| Source / content | Label | Type | Required | Notes |
|---|---|---|---|---|
| AreYouIncludingCreditRepairWithYourHomePackage | Are you including Credit Repair with your Home Package? | radio | **Yes** | Choices **FOUND:** `Yes — Requires Credit Hero Score account` / `No — Requires MyFICO login upload`. Help: “Select Yes if you want credit repair included. Select No if you will provide MyFICO mortgage scores.” |
| UploadScreenshotOrConfirmationOfCreditHeroScoreAccount | Upload screenshot or confirmation of Credit Hero Score account | file[] | Schema **No**; copy says required if Yes | “Required if you selected Yes above. Upload a screenshot or confirmation showing your Credit Hero Score account creation.” Template always shown. |
| Content | Credit Repair Instruction (If Yes) | HTML | n/a | “You must create a Credit Hero Score account immediately after submitting this form. This is required to begin your credit process.” Always shown. |
| UploadMyFICOMortgageScoreScreenshot | Upload MyFICO mortgage score screenshot | file[] | Schema **No**; copy says required if No | “Required if you selected No above. Upload a screenshot of your MyFICO mortgage scores (must meet minimum qualifying score of 620).” Template always shown. |
| Content | MyFICO Instruction (If No) | HTML | n/a | “You must provide your MyFICO mortgage scores. Minimum qualifying score is 620.” Always shown. **Do not treat 620 as a Grants & Co approval gate unless Charles confirms.** |

### Section 4 — Down Payment Assistance (`Section4DownPaymentAssistance`)

| Source / content | Label | Type | Required | Notes |
|---|---|---|---|---|
| IAmInterestedInDownPaymentAssistance1800 | I am interested in Down Payment Assistance (+$1,800) | yes/no checkbox (hide-label) | **No** (default false) | “Checking this will add Down Payment Assistance to your package for an additional $1,800.” Not a payment field. |
| Content | Down Payment Assistance Note | HTML | n/a | “Down Payment Assistance will be added to your package. This still keeps you at a discounted rate compared to standard closing costs. We recommend new construction homes such as DR Horton to maximize incentives.” |

### Section 5 — Process Disclosure (`Section5ProcessDisclosure`) — content only

No input fields. **No per-section checkbox FOUND** (only the final I-agree).

- **Account Creation Disclosure:** “You understand that a separate name, phone number, and email will be created on your behalf for lender and transaction purposes. Upon closing, you will receive all login credentials and account access.”
- **Agent Assignment:** “Our in-house agent, Taylor Carroll, will assist with showings, negotiations, and transaction coordination throughout the home buying process.”

### Section 6 — Credit & Purchase Rules (`Section6CreditPurchaseRules`)

All four are yes/no checkboxes, default false, **must be true** to submit, hide-label.

| Source | Label | Required |
|---|---|---|
| IAgreeNotToApplyForNewCreditDuringThisProcess | I agree not to apply for new credit during this process | **Yes (must be Yes)** |
| IAgreeNotToMakeLargePurchases | I agree not to make large purchases | **Yes (must be Yes)** |
| IAgreeNotToAddOrRemoveAccountsWithoutApproval | I agree not to add or remove accounts without approval | **Yes (must be Yes)** |
| IUnderstandThisMayNegativelyImpactMyApproval | I understand this may negatively impact my approval | **Yes (must be Yes)**; help: “Acknowledges that changes to credit or accounts may negatively impact loan approval.” |

### Section 7 — Payment & Commitment (`Section7PaymentCommitment`)

Acknowledgements only — **no card capture on this form**.

| Source | Label | Required |
|---|---|---|
| IUnderstandThisIsANonrefundableServiceAndPaymentMustBeMadeBeforeServicesBegin | I understand this is a non-refundable service and payment must be made before services begin | **Yes (must be Yes)**; help: “By checking, you acknowledge payment is non-refundable and required prior to service start.” |
| IUnderstandServicesWillNotBeginUntilPaymentHasCleared | I understand services will not begin until payment has cleared | **Yes (must be Yes)** |

### Section 8 — Cancellation & Fees (`Section8CancellationFees`)

| Source | Label | Required |
|---|---|---|
| IUnderstandThatIfICancelAfterStartingThisProcessIWillIncurA1800CancellationFeePayableToTheRealtyCompany | I understand that if I cancel after starting this process, I will incur a $1,800 cancellation fee payable to the realty company | **Yes (must be Yes)**; HTML help acknowledges the $1,800 fee |
| IUnderstandThisIsNotAProcessWhereICanStartAndChangeMyMind | I understand this is not a process where I can start and change my mind | **Yes (must be Yes)** |

### Section 9 — Legal Disclosure (`Section9LegalDisclosure`) — content only

No input fields. **No per-section checkbox FOUND.**

- **No Guarantees:** “No outcome, credit score increase, loan approval, interest rate, or property acquisition is guaranteed.”
- **Client Financial Responsibilities:** “Client is responsible for all home buying costs including inspections, appraisals, earnest money, down payment, and closing costs.”

### Section 10 — Signature (`Section10Signature`)

| Source | Label | Type | Required | Notes |
|---|---|---|---|---|
| FullNameTypedSignature | Full Name (Typed Signature) | name First+Last | **Yes** | “Type your full legal name as your electronic signature.” |
| SignatureDrawn | Signature (Drawn) | signature | **Yes** (Svg) | “Draw your signature in the signature field.” |
| DateAuto | Date (Auto) | date | **Yes** | Help says auto-populated with sign date. **No default/get FOUND in model** — auto-fill behavior beyond helptext is **UNKNOWN**. |
| IAgreeToAllTermsAndAuthorizeGrantCoConsultantsToProceed | I agree to all terms and authorize Grant & Co Consultants to proceed | yes/no checkbox | **Yes (must be Yes)** | hide-label |

**Signature (FOUND).** **File uploads (FOUND)** on DL + two score proofs. **No table fields used** despite platform flag.

---

## URLA-style PDF — **FOUND as field taxonomy** (not a client record)

Attached PDF transcribed with `pdftotext -layout`. Header format: `Loan Application for {Name}` / `Submitted on {weekday, dd Mon yyyy at h:mm AM/PM TZ}`. Values below are **field names + example formats only**.

| Section | Fields FOUND |
|---|---|
| Address Confidentiality Program | Address confidentiality program (yes/no) |
| Credit authorization | `{First}'s Credit authorization` → “i agree” |
| Confirmation & information release authorization | same, “i agree” |
| Tell us a little about yourself | First/Middle/Last name on driver’s license; Mobile phone `(###) ###-####`; Email; DOB `MM-DD-YYYY`; “What best describes your situation?” observed **U.S. Citizen** (other options **UNKNOWN**); military service self/deceased spouse (yes/no); preferred language (observed English; other options **UNKNOWN**); Work E-mail |
| Family | Marital status (observed Unmarried; other options **UNKNOWN**); non-spouse real-property rights (yes/no); dependents count |
| Current living situation | Street, City, State, Zip; mailing = current? (yes/no); Years; Months at address. Mailing-address extra fields **UNKNOWN** (not shown when mailing=current) |
| Employment history | Current situation (observed “I'm currently employed”); employment type (observed “Employed by a business”; self/other **not listed on this PDF**); employer name; street; city; state; zip; phone; start date `MM-DD-YYYY`; years/months in line of work; related-party employment (family/seller/agent/other party); job title; current employment flag; monthly income before taxes; overtime/commission/bonus flag |
| Other income | “Borrower other income does not apply” |
| Demographics (optional) | Ethnicity, Race, Gender — observed “I do not wish to provide this information” (JSON-array style on PDF) |
| Additional applicants | Add an additional applicant? (yes/no). Co-borrower field set **UNKNOWN** (not shown when no) |
| Real estate owned | Own/rent at current address (observed “Do not currently pay rent”; own/rent options **UNKNOWN**); own any other real estate? (yes/no). REO details **UNKNOWN** (not shown when no) |
| Assets | “Verification of assets” displayed as `0` (meaning **UNKNOWN**); Financial institution name; Account type (observed Checking Account); Last 4 of account; Estimated balance |
| Gifts/grants | “Gifts grants does not apply” |
| Other assets | “Other assets does not apply” |
| Liabilities | “Other liabilities does not apply” |
| Loan needs | Purpose (observed Purchase; refi **not listed on this PDF**); Estimated purchase price; Down Payment; primary down-payment source (observed Checking/Savings); Loan amount needed |
| Property | Property type (observed Single Family); occupancy (observed Primary Residence); D.R. Horton family-of-brands Subdivision/Community name; buyer-broker agreement (yes/no); specific home already selected (yes/no); property address / city / state / zip (**address block duplicated on the transcript**) |
| Declarations | Occupy as primary; ownership interest last 3 years; seller family/business affiliation; undisclosed borrowed funds; other mortgage application before close; new credit before close; PACE / priority lien; co-signor/guarantor; outstanding judgments; federal debt default; lawsuit with personal financial liability; DIL last 7 years; pre-foreclosure/short sale last 7 years; foreclosure last 7 years; bankruptcy last 7 years |

**SSN:** **NOT FOUND** as a labeled field on this PDF. **Document upload widgets:** **NOT FOUND** on this PDF (it is a filled application printout).

---

## B) Gap analysis

### On URLA PDF, not on Cognito

1. Employment + income (employer, tenure, gross monthly, OT/bonus, other income)  
2. Assets / gifts / other assets / liabilities  
3. Loan needs (purpose, price, down payment, source, loan amount)  
4. Subject property (type, occupancy, address, specific home selected)  
5. D.R. Horton subdivision as a **field** (Cognito only mentions DR Horton in DPA helper text)  
6. Buyer-broker agreement as a **field** (Cognito names Taylor Carroll in disclosure copy only)  
7. Full URLA declarations / 7-year lookbacks  
8. Co-borrower / additional applicant  
9. Citizenship, military, language, work email, middle name  
10. Family (marital, non-spouse rights, dependents)  
11. Housing tenure (years/months) + own/rent/no-rent  
12. Address Confidentiality Program  
13. Standalone credit authorization + information-release authorization  
14. Optional HMDA demographics  
15. Other REO  

### On Cognito, not on URLA PDF

1. Full SSN (plaintext)  
2. Government ID file upload  
3. Credit-repair vs MyFICO path + Credit Hero / MyFICO uploads + stated 620 floor  
4. DPA +$1,800 opt-in  
5. Synthetic lender identity (separate name/phone/email created for the file)  
6. Assigned in-house agent (Taylor Carroll)  
7. Credit-behavior lock (no new credit / large purchases / account changes)  
8. Non-refundable service + payment-must-clear  
9. $1,800 cancellation fee payable to the realty company + no change-of-mind  
10. No-guarantees + client pays inspections/appraisals/EMD/down/closing  
11. Typed + drawn e-signature + Date (Auto) + final I-agree  

Cognito is the **legal + credit-program gate**. The PDF is the **file a lender will expect**. The OS replaces Cognito and should collect a **readiness packet**, not originate.

---

## C) Recommended unified data model (readiness, not origination)

Do not invent API keys. Wire later to **GHL** (CRM) and **DisputeFox** (credit/dispute board).

| Section | Purpose | Sources |
|---|---|---|
| **0. Consents & agreement** | Block work until signed. Credit auth, info release, synthetic-identity disclosure, no-guarantees, nonrefundable, $1800 cancel fee, behavior lock, typed+drawn signature, timestamp. | Cognito S5–S10, URLA auths |
| **1. Party identity** | Legal name (incl. middle), mobile, emails, DOB, **vaulted SSN**, citizenship, military, language, gov ID files. | Cognito S1–S2, URLA identity |
| **2. Household** | Marital status, non-spouse property rights, dependents. | URLA family |
| **3. Housing now** | Current/mailing address, years/months, own/rent/no-rent, ACP. | Cognito address, URLA living |
| **4. Credit program** | Repair vs MyFICO, Credit Hero proof, MyFICO proof. Confirm with Charles before hard-gating 620. | Cognito S3 |
| **5. Income snapshot** | Employment type/status, employer, start, line-of-work tenure, related-party, title, gross monthly, OT flag, other-income flag. Counseling/referral completeness — not underwriting. | URLA employment |
| **6. Money snapshot** | Asset accounts (institution, type, last4, est. balance), gifts, other assets, liabilities. | URLA finances |
| **7. Home intent** | Purchase vs other, price, down payment + source, loan amount, property type/occupancy/address, D.R. Horton community, DPA $1800 opt-in, buyer-broker / Taylor Carroll assignment. | Cognito DPA, URLA loan/property |
| **8. Declarations / red flags** | URLA Section 5 questions, 3y ownership, 7y FC/SS/BK/DIL, PACE, judgments, federal default. | URLA declarations |
| **9. Document vault** | ID, score proofs, plus implied income/asset docs collected later — not on either source as upload widgets except ID/score. | both |
| **10. Ops routing** | `ghl_contact_id`, `disputefox_client_id`, readiness status (map Cognito workflow: Incomplete → Under Review → Awaiting Documents → Payment Pending → In Process → Completed / Cancelled), referred-lender flag. | session + brain |

Copy must never claim origination, approval, a guaranteed score, rate, or home.

---

## D) Document upload requirements

| Document | Source | Status | Required |
|---|---|---|---|
| Driver’s license or state ID (front and back if possible) | Cognito | **FOUND** | Yes |
| Credit Hero Score account screenshot/confirmation | Cognito | **FOUND** | Copy: if Yes. Schema: not required. No hide rule FOUND. |
| MyFICO mortgage score screenshot (copy states min 620) | Cognito | **FOUND** | Copy: if No. Schema: not required. No hide rule FOUND. |
| Drawn signature + typed legal name | Cognito | **FOUND** | Yes |
| Paystubs / W-2 / tax returns | URLA | **IMPLIED, not FOUND** (income fields exist; no upload control on this PDF) | UNKNOWN |
| Bank / asset statements | URLA | **IMPLIED, not FOUND** | UNKNOWN |
| Gift letter | URLA | **IMPLIED, not FOUND** (gifts section exists; sample = does not apply) | UNKNOWN |
| Credit authorization / info-release | URLA | **FOUND** as agree controls, not files | Yes on that PDF |

---

## Provenance files (this folder)

- Live form-def JS: `cognito-form-def.raw.js` (public schema; no session tokens)
- Vue template: `cognito-form-template.html` / `cognito-template.html`
- Machine catalog: `00-field-catalog.json`

Do not treat Cognito CDN logo URLs as the OS brand source of truth.
