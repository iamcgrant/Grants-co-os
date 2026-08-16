# CRC contact recovery + missing-data backfill

Credit Repair Cloud (CRC) was Grants & Co’s primary system for about five years. Existing OS work imported the 26 verified-active DisputeFox masters and inbound GHL links. That is **not** a CRC recovery. Charles (2026-08-16) required the migration to recover **actual client contacts**, not just historical metadata.

This document is the identify + tooling + dry-run spec. It contains **no client PII**. Real CRC exports, raw credit reports, and secrets must never be committed.

**This PR does not:** log into CRC, pull a real export, create live Grants/GHL/DisputeFox records, send messages, publish workflows, or download real credit reports.

## Part A — Recover actual CRC contacts

The 26 Charles-confirmed masters plus inbound GHL / DisputeFox attach recover **verified-active processing files**. They do not recover the CRC book of contacts.

CRC recovery must:

- Attach CRC (and SmartCredit) identifiers onto **one** Grants master per human.
- Find contacts that exist in CRC but are missing from Grants OS, GHL, or DisputeFox.
- Decision a future create only when the human is truly absent from Grants OS **and** GHL: **one** Grants master + **one** GHL contact.
- Backfill blank contact fields and missing provider IDs from verified CRC values.
- Recover document/report **metadata** (not raw files) with CRC provenance.
- Classify every recovered identity so dormant former clients are not treated as active.

Existing pipelines stay in place:

- `src/lib/clients/confirmed-masters.ts` + `import-confirmed-masters` — 26 OS masters
- `src/lib/integrations/ghl/sync.ts` — inbound GHL onto existing masters
- `src/lib/integrations/disputefox/sync.ts` + roster — inbound DF attach onto existing masters

CRC recovery **extends** those identity helpers (`normalizeEmail`, `normalizePhone`, `ClientIdentifier`). It does not invent a second client table or a second inbound GHL/DF path.

## Part B — Identity hard locks

Encoded in `src/lib/crc-recovery/locks.ts` and tested.

1. **ONE HUMAN = ONE MASTER CLIENT.** Provider IDs are identifiers on that master, never separate clients.
2. **Before any future create, search Grants OS + GHL + DisputeFox.**
3. **Match order:**
   1. provider / client IDs (Grants, GHL, DisputeFox, CRC, SmartCredit)
   2. exact email (normalized)
   3. normalized phone
   4. name **plus** corroborating address (or other reliable info)
4. Name alone is never a match. Multiple hits at the current step → review queue.
5. If OS / GHL / DF matches point at different Grants Client IDs → ambiguous, no create.
6. If a legitimate CRC client truly does not exist in Grants OS/GHL: future path is **one** Grants master + **one** GHL contact. This PR implements the decision, not the live create.
7. If they exist in GHL but not OS: future path is one Grants master **linked to the existing GHL contact** (no second GHL row).
8. If they exist in OS but not GHL: future path is one GHL contact **on that master**.
9. Do **not** treat everyone imported from CRC as active.

## Part C — Identifier model

Store as `ClientIdentifier` rows on the single master (`src/lib/clients/identifiers.ts`):

| Identity | Where | Provider string |
|----------|--------|-----------------|
| Grants Client ID | `Client.grantsClientId` (`GC-000001`) | (internal) |
| GHL Contact ID | `ClientIdentifier` | `GHL` |
| DisputeFox Client ID | `ClientIdentifier` | `DISPUTEFOX` |
| Credit Repair Cloud Client ID | `ClientIdentifier` | `CREDIT_REPAIR_CLOUD` |
| SmartCredit reference/ID | `ClientIdentifier` | `SMARTCREDIT` |

Do not invent DisputeFox numeric IDs. Do not create a second master when a CRC inbox or SmartCredit id differs from the GHL identity email.

Identifier metadata source for a later apply: `crc_export` (`src/lib/integrations/env.ts`). This PR does not attach live identifiers.

## Part D — Classification after identity recovery

```
VERIFIED_ACTIVE
RECENTLY_WORKED_TRANSITION_RISK
DORMANT_REACTIVATION_ELIGIBLE
CLOSED_DO_NOT_REACTIVATE
```

Rules (`src/lib/crc-recovery/classification.ts`):

- `CLOSED_DO_NOT_REACTIVATE` — CRC `doNotReactivate` or closed/cancelled/refunded/terminated status.
- `VERIFIED_ACTIVE` — verified-active **and** recently worked (90 days) or currently processing.
- `RECENTLY_WORKED_TRANSITION_RISK` — recently worked or currently processing, but not verified-active.
- `DORMANT_REACTIVATION_ELIGIBLE` — everyone else (former clients, inactive, old last-worked).

A CRC `status=active` with no recent work is **dormant**, not verified active.

## Part E — Backfill, documents, DisputeFox transition

### Backfill

Only when the new-system field is **blank** and CRC has a **verified** value.

- Never overwrite newer verified OS/GHL data with older CRC.
- Differing verified values → review queue (`CONFLICT_REVIEW`).
- Fields: email, phone, address.

### Documents / reports

Provenance required on every recovered document record:

- `sourceSystem=CREDIT_REPAIR_CLOUD`
- `originalDate`
- CRC client ID
- document / report type

Raw sensitive files stay in secure storage. Never GitHub, never logs, never chat. Fixture refs set `rawIncluded: false`. The dry-run report counts metadata only.

### DisputeFox

- **Do not auto-create DisputeFox records.**
- DF create/link is **flagged for later** only when classification is `VERIFIED_ACTIVE` or `RECENTLY_WORKED_TRANSITION_RISK` **and** the human is missing from DF.
- Dormant and closed former clients stay Grants OS + GHL for reactivation.
- Zap `374413762` stays **OFF**.

## Part F — GHL organization + enrollment / comms freeze

Document + schema only. **Do not live-write GHL. Do not apply tags live.**

Custom fields (`src/lib/crc-recovery/ghl-fields.ts`):

- Grants Client ID
- CRC Client ID
- DisputeFox Client ID
- Service Status
- Last Worked Date
- Last Report Date
- Last Dispute Date
- Migration Source = `CREDIT_REPAIR_CLOUD`

Suggested tags (do not apply live):

- `legacy-crc-client`
- `crc-transition-recovered`
- `credit-client-active`
- `credit-client-dormant`
- `reactivation-eligible`
- `transition-review`

Do **not** enroll migration contacts into:

- welcome / onboarding / POA
- Friday Pulse
- invoices / payment requests
- duplicate opportunities
- duplicate DisputeFox files

Comms freeze (same as inbound GHL/DF):

- Friday Update Router stays **unpublished**
- Zap `374413762` stays **OFF**
- Phone / A2P / Sendara **frozen**
- No outbound SMS / email / iMessage
- No workflow publish

## Part G — Dry-run tooling, write lock, tests, out of scope

### CLI

```bash
npm run crc:recovery-report
```

Reads `fixtures/crc-recovery/synthetic-crc-export.json` (or `--crc-export=`) and compares against synthetic OS / GHL / DF catalogs that use the same shapes as inbound GHL contacts, the 26-master roster, and DisputeFox attach.

`--include-confirmed-masters` projects the in-repo 26-master + DF roster shapes into the catalog (report still prints IDs only). `--apply` calls the write path, which **fail-closes**.

Report title: **CRC → DISPUTEFOX TRANSITION RECOVERY REPORT**

Sections:

1. CRC clients completely missing from Grants OS
2. CRC clients completely missing from GHL
3. CRC clients missing from DisputeFox
4. Recovered contacts created in GHL — **count 0 in dry-run**
5. Missing email/phone/address recovered — 0 unless a fixture shows a blank-fill
6. Missing provider IDs recovered
7. Documents/reports recovered
8. Recently worked CRC clients not properly transitioned to DF
9. Ambiguous identities requiring review

Public report rows use `crcClientId` / `grantsClientId` only.

### Write lock

`CRC_RECOVERY_WRITES_ENABLED` defaults off (unset / not `true`).

- Live GHL writes **always refused**
- Live DisputeFox writes **always refused**
- Messages / workflows / enrollment **always refused**
- OS create/update refused unless the flag is `true`, and **still not executed** in this identify + dry-run PR

### Tests

Synthetic fixtures only. Cover match order, no duplicate create, no DF auto-create for dormant, no overwrite of newer verified fields, report sections, writes flag off.

### Out of scope (this PR)

- Logging into CRC
- Pulling a real CRC export
- Creating real contacts
- Downloading real credit reports
- Any client communication

### Local real exports (later)

Place real files in `local/crc-exports/` (gitignored). Never commit them. Never paste PII into chat or GitHub.
