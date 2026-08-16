# Lead Attribution (fail-closed)

Marketing later answers “what content/channel collected money” from a **child row on the master Client**, not from a second person record.

Existing `MarketingSource` / `MarketingCampaign` / `LeadSource` / `ConversionEvent` stay the campaign catalog and seed funnel. They do **not** invent revenue-by-content. `LeadAttribution` is the fail-closed fact table.

## DATA UNAVAILABLE until intake stamp

Revenue-by-content stays **DATA UNAVAILABLE** until **all** of the following are true:

1. Intake stamps **campaign**, **content**, **ad**, and **CTA** (no invented values).
2. A `LeadAttribution` row exists on the **existing** Grants master (`Client`).
3. `amount_collected` is filled from a verified **X5 / Jobber / Authorize.Net** payment fact.

Missing stamp ≠ organic. Missing stamp ≠ direct. Missing stamp = **DATA UNAVAILABLE**.

`source=unknown` is stored as `unknown`. It is never coerced to organic.

`amount_collected` stays **null** without a payment fact. Guessed ad revenue is ignored. Newer verified payment data is never overwritten by a guess.

## X2 ping rule

X2 is locked: **they will not send leads to create.**

- Marketing / X4 / campaigns must not ping X2 to create a Grants client, GHL contact, or `LeadSource` from an ad click.
- X2 may later attach a `LeadAttribution` child onto an **existing** master when intake provides campaign / content / ad / CTA.
- Until that stamp exists, do not ask X2 for revenue-by-content. The answer is DATA UNAVAILABLE.

Charles’s loop (MARKET → X2 → X4 → X3 → campaign → GHL → leads → sales → X5 revenue → back to X2/X4) stays blocked on this stamp. This PR does not unlock it.

## No lead creates from marketing

- ONE HUMAN = ONE MASTER. Attribution is never a second client.
- Do not create leads, contacts, or clients from this module.
- Do not write GHL. Do not send messages. Do not publish workflows.
- Do not enroll welcome / onboarding / Friday / POA / invoices.
- Live GHL inbound and DisputeFox attach are unchanged. Production intake remains DisputeFox.
- Stamp landing is **not wired** this PR. Comments mark where it will land later.

## Allowed `source` values

`facebook` | `instagram` | `youtube` | `email` | `referral` | `direct` | `unknown`

`organic` is not a source. Passing it is an error.

## Service

`src/lib/marketing/lead-attribution.ts`

- `recordLeadAttribution` — child row on an existing `clientId` only; optional `market` (AcquisitionMarket)
- `applyVerifiedCollectedAmount` — payment fact only
- `getRevenueByContent` — DATA UNAVAILABLE until stamp + verified amount

Acquisition revenue-by-market reuses this table. Missing `LeadAttribution.market` or missing verified `amount_collected` stays **DATA UNAVAILABLE**. See `docs/ACQUISITION.md`.
