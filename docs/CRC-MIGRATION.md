# CRC migration — contact recovery + missing-data backfill

Credit Repair Cloud (CRC) was Grants & Co’s primary system for about five years. Existing OS work imported the 26 verified-active DisputeFox masters and inbound GHL links. That is **not** a CRC recovery. Charles (2026-08-16) required the migration to recover **actual client contacts**, not just historical metadata.

This document is the identify + tooling + dry-run spec. **No client PII.** Real CRC exports, raw credit reports, and secrets must never be committed.

Adapter shape copies DisputeFox inbound-attach (PR #8): `src/lib/integrations/crc/` + `npm run crc:inbound-compare -- --local --dry-run`. It is **not** a second client pipeline.

**This PR does not:** log into CRC, pull a real export, create live Grants/GHL/DisputeFox records, send messages, publish workflows, or download real credit reports.

## Part A — Recover actual CRC contacts

The 26 Charles-confirmed masters plus inbound GHL / DisputeFox attach recover **verified-active processing files**. They do not recover the CRC book of contacts.

CRC inbound compare must:

- Attach CRC (and SmartCredit) identifiers onto **one** Grants master per human.
- Find contacts that exist in CRC but are missing from Grants OS, GHL, or DisputeFox.
- Decision a future create only when the human is truly absent from Grants OS **and** GHL: **one** Grants master + **one** GHL contact.
- Backfill blank contact fields and missing provider IDs from verified CRC values.
- Recover document/report **metadata** (not raw files) with `sourceSystem=CREDIT_REPAIR_CLOUD`.
- Classify every recovered identity so dormant former clients are not treated as active.

Existing pipelines stay in place (`confirmed-masters.ts` is not edited):

- 26 OS masters + inbound GHL sync + DisputeFox local attach
- CRC compare **extends** those identity helpers. It does not invent a second client table.

## Part B — Identity hard locks

1. **ONE HUMAN = ONE MASTER CLIENT.** Provider IDs are identifiers on that master, never separate clients.
2. **Before any future create, search Grants OS + GHL + DisputeFox.**
3. **Match order (existing-only):** CRC id → exact email → normalized phone → name + corroborating address.
4. Name alone is never a match. Multiple hits → review queue. No create.
5. If a legitimate CRC client truly does not exist in Grants OS/GHL: future path is **one** Grants master + **one** GHL contact. This PR implements the decision, not the live create.
6. Do **not** treat everyone imported from CRC as active.

## Part C — Identifier model

Store as `ClientIdentifier` rows on the single master:

| Identity | Where | Provider string |
|----------|--------|-----------------|
| Grants Client ID | `Client.grantsClientId` | (internal) |
| GHL Contact ID | `ClientIdentifier` | `GHL` |
| DisputeFox Client ID | `ClientIdentifier` | `DISPUTEFOX` |
| Credit Repair Cloud Client ID | `ClientIdentifier` | `CREDIT_REPAIR_CLOUD` |
| SmartCredit reference/ID | `ClientIdentifier` | `SMARTCREDIT` |

GHL field `crc_client_id` maps to `ClientIdentifier.provider=CREDIT_REPAIR_CLOUD` (Agent Hub fact `ghl.field.crc_client_id`). Do not invent IDs. Do not live-write GHL.

## Part D — Classification after identity recovery

```
VERIFIED_ACTIVE
RECENTLY_WORKED_TRANSITION_RISK
DORMANT_REACTIVATION_ELIGIBLE
CLOSED_DO_NOT_REACTIVATE
```

A CRC `status=active` with no recent work is **dormant**, not verified active.

## Part E — Backfill, documents, DisputeFox transition

- Backfill only when the new-system field is **blank** and CRC has a **verified** value.
- Never overwrite newer verified OS/GHL data with older CRC. Conflicts → review queue.
- Documents: `sourceSystem=CREDIT_REPAIR_CLOUD`, `originalDate`, CRC client ID, document/report type. Raw files stay in secure storage — never GitHub, never logs, never chat.
- **Do not auto-create DisputeFox records.** Flag later DF create/link only for `VERIFIED_ACTIVE` or `RECENTLY_WORKED_TRANSITION_RISK` when missing from DF. Dormant/closed stay Grants OS + GHL.

## Part F — GHL organization + fail-closed / no-enroll

Document + schema only. **Do not live-write GHL. Do not apply tags live.**

Fields: Grants Client ID, CRC Client ID, DisputeFox Client ID, Service Status, Last Worked Date, Last Report Date, Last Dispute Date, Migration Source=`CREDIT_REPAIR_CLOUD`.

Suggested tags (do not apply): `legacy-crc-client`, `crc-transition-recovered`, `credit-client-active`, `credit-client-dormant`, `reactivation-eligible`, `transition-review`.

**Do not enroll** migration contacts into welcome / onboarding / POA / Friday Pulse / invoices / payment requests / duplicate opportunities / duplicate DisputeFox files.

Comms freeze:

- Friday Update Router stays **unpublished**
- Zap `374413762` stays **OFF**
- Phone / A2P / Sendara **frozen**
- No outbound SMS / email / iMessage

## Part G — Dry-run tooling, write lock, tests, out of scope

### Report name

**CRC → DISPUTEFOX TRANSITION RECOVERY REPORT**

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

Public rows use `crcClientId` / `grantsClientId` only.

### CLI (DisputeFox inbound-attach shape)

```bash
npm run crc:inbound-compare -- --local --dry-run
```

Reads `fixtures/crc-recovery/synthetic-crc-roster.csv`. Live CRC HTTP **fails closed** without `CRC_API_KEY`.

`CRC_RECOVERY_WRITES_ENABLED` stays **false**. No contact creates. Live GHL/DF writes refused.

### Out of scope

- Logging into CRC
- Pulling a real CRC export
- Creating real contacts
- Downloading real credit reports
- Any client communication

## Phase 2 — Controlled-write scaffolding (Charles 2026-08-16)

Identify + compare from Part A–G stay the pipeline. Phase 2 adds **class-gated write plans** on that same adapter (`src/lib/integrations/crc/`). It does **not** invent a second client table, live GHL/DF/OS clients, messages, or workflow publish.

### Work order

1. Work `RECENTLY_WORKED_TRANSITION_RISK` first (live book ~72).
2. Especially the **14 CRC Client\*** missing from DisputeFox — a **recovery queue**, not auto-DF-create.
3. Especially the **03/10/2026 CMI cluster**.
4. Do **not** bulk-create the **8 unmatched CRC Client\*** in GHL.
5. Do **not** create `charlesjgrant@aol.com`.
6. Do **not** auto-merge: Kimberly Britt, Dyquann McBride, Antionette Greene, Taylor Carroll, Charles Grant collision, Kendra Thomas, Antanaisa Robinson.

### Activity classifier (not start date)

```
CONFIRMED_CONTINUITY_ACTIVE
RECENTLY_WORKED_NEEDS_REVIEW
DORMANT_REACTIVATION
CLOSED
```

Classify from actual CRC activity: last worked / dispute / report / note / document / comms / payment. **Do not mark Active solely because they started recently.**

Confirmed active: **one** master; link Grants↔GHL↔DF↔CRC; enrich blanks only; never overwrite newer verified data. Create DF only when continuity is confidently established **and** `CRC_WRITE_DF_CREATE_ENABLED` is true — exactly one if created. This PR plans that write; it does not execute it.

### Class-gated write flags (all default false)

Never a single global “write everything” flag. `CRC_RECOVERY_WRITES_ENABLED` stays **false / ignored** if present.

| Flag | Class |
|------|--------|
| `CRC_WRITE_ENRICHMENT_ENABLED` | Blank-fill only |
| `CRC_WRITE_ACTIVE_CONTINUITY_ENABLED` | `CONFIRMED_CONTINUITY_ACTIVE` links |
| `CRC_WRITE_DORMANT_GHL_ORG_ENABLED` | Dormant GHL org schema |
| `CRC_WRITE_DOCUMENTS_ENABLED` | Document **metadata** only |
| `CRC_WRITE_DF_CREATE_ENABLED` | Strictest — `CONFIRMED_CONTINUITY_ACTIVE` only |

### GHL Service Status (document + schema, no live GHL writes)

`ACTIVE_CREDIT_CLIENT` · `RECENTLY_WORKED_REVIEW` · `DORMANT_REACTIVATION` · `CLOSED_DO_NOT_REACTIVATE` · `AMBIGUOUS_IDENTITY` · `TEST_JUNK`

Prisma enum `GhlServiceStatus`. Field `service_status` on the existing GHL org schema.

### Batch sequencer

`backup → write → verify → reconcile → continue`. Dry-run only. Write step plans class-gated actions and does not apply them.

### Documents

`sourceSystem=CREDIT_REPAIR_CLOUD`. Raw files never GitHub, never logs, never chat.

### Still frozen

Zero welcome / onboarding / Friday Pulse / POA / invoice / duplicate opps / duplicate tasks. Zap `374413762` **OFF**.

### Out of scope (Phase 2)

Live CRC login, real exports, applying writes, snapshot/email/subaccount GHL agency setup.
