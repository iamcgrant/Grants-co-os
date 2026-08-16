# Acquisition command center (scaffolding)

Two engines. They do not share a person record, a pipeline, or an onboarding path.

| Engine | Who | Master record |
| --- | --- | --- |
| **A — Referral partners** | Realtor / mortgage / builder / other **businesses** that send clients | `Partner` (never a `Client`) |
| **B — Direct consumers** | People who may buy credit repair | Existing `Client` master (`acquisitionStage` + `LeadAttribution`) |

**ONE HUMAN = ONE MASTER.** A consumer lead is the same Grants `Client` that later pays and enters intake. Conversion does not create a second person. A partner is a business row and is never mixed into the credit-repair client table.

Paid consumers connect to the **existing** master intake (`OnboardingItem` keys in `src/lib/clients/onboarding.ts` → DisputeFox post-pay continuation). This module does **not** invent a second onboarding path.

`LeadAttribution` (PR #12) remains the fail-closed campaign / content / ad / CTA stamp. Acquisition reuses it. It does not replace it.

This PR is **scaffolding only**. No live GHL contacts, no messages, no workflow publish, no Friday Pulse, no welcome enrollment, no Premium Prospecting purchase, no outreach UI.

## Engine A — Referral partners

Partners are businesses, not credit-repair clients. Do not create a `Client` for a partner. Do not attach partner rows to `OnboardingItem`, Friday Pulse, welcome, POA, or invoices.

`PartnerReferral` links `Partner` → `Client` **only after** the referred person is a converted consumer on an existing master.

### Partner pipeline (`PartnerPipelineStage`)

Enum only — not live GHL pipeline writes.

1. `NEW_PROSPECT`
2. `QUALIFIED_PARTNER_PROSPECT`
3. `OUTREACH_READY`
4. `CONTACTED`
5. `REPLIED`
6. `INTRO_CALL`
7. `PARTNER_INTERESTED`
8. `ACTIVE_REFERRAL_PARTNER`
9. `REFERRED_FIRST_CLIENT`
10. `ACTIVE_PRODUCING_PARTNER`
11. `NURTURE`
12. `NOT_INTERESTED`
13. `DND`

`DND` / unsubscribe on a partner is preserved. Outreach is not implemented and must not run.

## Engine B — Direct consumers

A consumer lead is a `Client` with `acquisitionStage` set. Prefer that over a second lead table. If email/phone matches an existing master, attach to that master. Never open a second Grants Client ID for the same human.

Paid / converted consumers stay on that master and receive the **existing** onboarding checklist (missing items only; completed items are not overwritten).

### Consumer lead pipeline (`ConsumerLeadStage`)

1. `NEW_LEAD`
2. `ATTEMPTING_CONTACT`
3. `ENGAGED`
4. `CONSULTATION_BOOKED`
5. `CONSULTATION_COMPLETED`
6. `QUALIFIED`
7. `PAYMENT_PENDING`
8. `PAID_ONBOARDING`
9. `CONVERTED_CLIENT`
10. `NURTURE`
11. `LOST`
12. `DND`

`Client.stage` remains the operations/intake stage (`ONBOARDING`, `WAITING_ON_CLIENT`, …). Do not reuse it as the acquisition pipeline.

## City / market (`AcquisitionMarket`)

Charles-locked vocabulary. Estill, SC is **not** a member and is **never** a default.

**PRIMARY** (default prospecting start set): Hilton Head Island, SC · Bluffton, SC · Savannah, GA · Atlanta, GA · Washington, DC · Arlington, VA

**SECONDARY** (supported, not in the default start set): Charlotte, NC · Columbia, SC · Charleston, SC · Augusta, GA · Alexandria, VA · Fairfax, VA · Richmond, VA

`UNKNOWN` and `OTHER` are allowed explicit stamps only. Missing market is not coerced to a primary city or to Estill.

Every `Partner` and every `PartnerReferral` must carry `market`. A consumer lead attributed to a partner inherits that market onto `Client.acquisitionMarket` and, when a `LeadAttribution` child is written, onto `LeadAttribution.market`.

Dashboard `byMarket` groups prospects found, replies, meetings, referrals, clients converted, and revenue. A market row appears only from a real stamped Partner / PartnerReferral / LeadAttribution. Unstamped metrics stay **DATA UNAVAILABLE**. Revenue-by-market additionally requires the existing intake stamp + verified payment fact. Do not pre-fill primary cities with invented zeros.

## Source attribution (`AcquisitionSource`)

Command-center source taxonomy (explicit stamp only):

`GHL_PROSPECTING` | `PROSPECT_AI` | `REALTOR_PARTNER` | `MORTGAGE_PARTNER` | `BUILDER_PARTNER` | `FORMER_CLIENT_REFERRAL` | `FACEBOOK` | `INSTAGRAM` | `GOOGLE` | `WEBSITE` | `ORGANIC` | `EMAIL_CAMPAIGN` | `REACTIVATION_CAMPAIGN` | `OTHER`

Rules:

- Source is **required** when recording, **or** stored as unknown.
- Missing / blank source → **unknown** (LeadAttribution `unknown`, `Client.acquisitionSource` null).
- Missing source is **never** coerced to `ORGANIC`.
- `ORGANIC` is valid only when explicitly stamped.
- Campaign / content / ad / CTA stay on `LeadAttribution`. Missing stamp = **DATA UNAVAILABLE**, not organic. See `docs/LEAD-ATTRIBUTION.md`.

Mapped into existing `AttributionSource` when a child row is written (`facebook`, `instagram`, `email`, `referral`, else `unknown`). `organic` is still rejected on `LeadAttribution`.

## GrantsLeadScore

Integer 0–100 plus `grantsLeadScoreReasonsJson`.

**Allowed signals only:** engagement, consult booked/completed/show, payment pending/paid, explicit partner-referral or former-client-referral source, recency, existing intake completeness, DND freeze.

**Ignored (never scored):** race, color, ethnicity, national origin, religion, sex, gender, gender identity, sexual orientation, age, date of birth, disability, familial status, marital status, veteran status, genetic information, zip / census tract (proxy).

Passing a protected attribute does not change the score. Reasons may list ignored keys at 0 points.

## Dashboard stubs

`src/lib/acquisition/dashboard.ts` → `GET /api/acquisition/dashboard`

| Metric | Meaning |
| --- | --- |
| New Leads Today / Week | `Client.acquisitionStage` set, created in window |
| Consultations | Consult booked or completed stages, or stamped `consultBookedAt` |
| Pending Payments | `PAYMENT_PENDING` |
| New Clients | `PAID_ONBOARDING` or `CONVERTED_CLIENT` in window |
| Partner Prospects | Partner not yet `ACTIVE_REFERRAL_PARTNER` / producing / DND / not interested |
| Active Referral Partners | `ACTIVE_REFERRAL_PARTNER` or `ACTIVE_PRODUCING_PARTNER` or `REFERRED_FIRST_CLIENT` |
| Partner Referrals | `PartnerReferral` rows (post-conversion only) |
| Reactivation Leads | `acquisitionSource = REACTIVATION_CAMPAIGN` |
| Conversion Rate | Converted ÷ leads in window — not invented when leads = 0 |
| Revenue by Source | Reuses fail-closed `LeadAttribution` / `getRevenueByContent` |
| Leads Needing Follow-Up | Open consumer stages, excluding `DND` / `LOST` / converted |
| By market | Per-city rows from stamped Partner / PartnerReferral / LeadAttribution only |

No acquisition-stamped rows → **DATA UNAVAILABLE**, not a made-up zero funnel. Revenue-by-source and revenue-by-market stay DATA UNAVAILABLE until intake stamp + verified payment fact. Empty primary cities are not invented as zero rows.

## QA locks

Encoded in `src/lib/acquisition/locks.ts` and asserted by tests:

- No Friday Pulse trigger / enrollment
- No welcome / onboarding-workflow enrollment (existing checklist attach only)
- No cold SMS, email, or iMessage
- No live GHL contact create/update/delete
- No workflow publish
- No client contamination (Partner ≠ Client; engines do not mix)
- No second human / second onboarding path
- DND and unsubscribe are preserved (never cleared by convert or stage moves)
- Out of scope: live GHL prospecting UI, buying Premium Prospecting, sending outreach

## Service

`src/lib/acquisition/`

- `createPartner` / `updatePartnerStage` — business row only; `market` required
- `openConsumerLead` — existing master or first master; never a second Client; partner-attributed leads inherit market
- `convertConsumerLead` — same `clientId`; PartnerReferral only after conversion (with market); existing onboarding keys
- `parseAcquisitionMarket` / `DEFAULT_PROSPECTING_MARKETS` — locked vocabulary; Estill refused
- `scoreGrantsLead` — protected attributes ignored
- `getAcquisitionDashboard` — fail-closed stubs, including `byMarket`
