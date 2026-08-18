# Integrations

All integrations are adapters beneath Grants & Co OS.

| Provider | Module | Status |
|----------|--------|--------|
| GoHighLevel | `LiveGoHighLevelProvider` when `GHL_API_KEY` is set (`GHL_LOCATION_ID` defaults to `[REDACTED]`); else mock | **Live inbound onto existing master records only** |
| DisputeFox | `MockDisputeFoxProvider` + inbound attach onto existing masters | **Local roster attach** (26 Charles-confirmed clients). Live path **fails closed** without `DISPUTEFOX_API_KEY`. Zap `374413762` stays **OFF**. |
| Credit Repair Cloud | `MockCreditRepairCloudProvider` + inbound compare (`npm run crc:inbound-compare`) | **Not connected.** Local CSV dry-run + Phase 2 class-gated write **plans**. Live path **fails closed** without `CRC_API_KEY`. Five write flags default **false**. `CRC_RECOVERY_WRITES_ENABLED` is **ignored**. |
| SmartCredit | `MockSmartCreditProvider` | Mock — sponsored enrollment + scores |
| Credit Karma | `MockCreditKarmaConnector` | Mock — **read only** |
| Experian | `MockExperianConnector` | Mock — weekly score |
| Payments | `PAYMENT_PROVIDER=mock` default; Commas primary adapter when `COMMAS_API_KEY` set; Authorize.Net optional secondary | Mock until secrets · live charges locked (`COMMAS_LIVE_CHARGES`) |

## GHL → Grants Client → Client 360

1. Pull contacts via `POST /api/integrations/ghl/sync` (Owners/managers). `dryRun: true` previews matches without writes.
2. Link onto **existing** Grants master clients only, match order **GHL id → email → normalized phone**. Unmatched GHL contacts are skipped — this path never creates a Grants Client.
3. Attach `ClientIdentifier` provider `GHL` with metadata `{ source: "ghl_api", dataPlane, locationId }`.
4. Client 360 shows Grants Client ID, GHL Contact ID, DisputeFox ID, stage, staff, next action, onboarding, docs, disputes, tasks, OS comms, credit/pay/timeline — or **Awaiting Integration** when a source is not connected.
5. Inbound sync **does not** create/update/delete GHL contacts. **Does not** replace DisputeFox → GHL / post-pay intake.
6. Without `GHL_API_KEY` the live path **fails closed** (no GHL HTTP, no client writes).

## GHL outbound SMS / email (fail-closed)

1. Staff inbox client replies call `sendGhlOutboundMessage` (`src/lib/integrations/ghl/outbound.ts`) via `postMessage`.
2. Requires a linked `ClientIdentifier` provider `GHL` and PIT scope **`conversations/message.write`** (recommended: `conversations.write`).
3. Live probe with current key: `POST /conversations/messages` → **401** “token is not authorized for this scope” for SMS, Email, and MMS-shaped payloads.
4. Phone / browser dialer: `LeadConnectorTelephonyAdapter` reports `browserDialer: false`; phone-system and voice-ai GETs also **401**. Softphone remains outside OS until scopes/API exist.
5. Fail-closed: OS records `deliveryStatus=FAILED` + `ACTION_REQUIRED` metadata — never pretends SENT.

## GHL conversations → Grants OS inbox (linked masters only)

1. Pull via `POST /api/integrations/ghl/conversations/sync` (Owners/managers) or `npm run ghl:inbound-conversations`. `dryRun: true` / `--dry-run` previews without inbox writes.
2. Only already-linked GHL identifiers are eligible. Unlinked GHL contacts are ignored — this path never creates a Grants Client and never creates a GHL contact.
3. Messages are recorded on the client's OS `CLIENT` conversation with `deliveryStatus=RECORDED` and unique `(provider=GHL, externalId=GHL message id)`. Re-pulls skip duplicates.
4. Opt-out / DND flags present on the conversation or message payload are stored on the GHL identifier metadata and on the imported message metadata. They are never used to send.
5. Inbound pull **does not** publish workflows or change A2P/phone/Sendara. Outbound send is a separate adapter (see above).
6. Without `GHL_API_KEY` the path **fails closed**. If the current PIT cannot list conversations/messages, it **fails closed** and reports the extra scope name: `conversations.readonly` (message bodies also need `conversations/message.readonly`). Do not invent scopes — reissue the Private Integration with the required permissions.

Known location: `[REDACTED]`  
URL: https://app.gohighlevel.com/v2/location/[REDACTED]/

Development seed identifiers are tagged `{ source: "seed", dataPlane: "development" }` and labeled as dev samples — never presented as live CRM data.

## Credentials needed later

Do **not** paste passwords into chat, GitHub, or source files. Store them in Cursor Secrets / host environment variables.

### GoHighLevel
- Login email / password (staff portal) → `GHL_LOGIN_EMAIL`, `GHL_LOGIN_PASSWORD` (local/secrets only)
- **Required for live inbound sync:** `GHL_API_KEY` (Cursor Secrets / host env — never commit)
- **Also a secret:** `GHL_LOCATION_ID` (Cursor Secrets / host env — never commit or print)
- Conversation pull needs PIT scopes `conversations.readonly` and `conversations/message.readonly` (X1 later). Do not widen scopes from app code.
- Source: Settings → Integrations → API Keys / Private Integration

Portal passwords enable staff-browser / connector scaffolding. Production sync prefers API keys. This inbound path never writes GHL contacts and never sends messages.

### DisputeFox
- Login email / password → `DISPUTEFOX_LOGIN_EMAIL`, `DISPUTEFOX_LOGIN_PASSWORD` (local/secrets only)
- **Required for live inbound attach:** `DISPUTEFOX_API_KEY` (Cursor Secrets / host env — never commit). Do **not** regenerate the Fox API key.
- Without `DISPUTEFOX_API_KEY` the live path **fails closed** (no DisputeFox HTTP, no client writes on that path).
- Intake URL template → `DISPUTEFOX_INTAKE_URL_TEMPLATE`

## DisputeFox → Grants Client (existing master records only)

1. **Local attach** (no API key): `POST /api/integrations/disputefox/sync` mode `local`, or `npm run df:inbound-attach -- --local --apply`. Uses the checked-in 26-row roster (identity email + DF stage/started). Idempotent. Does **not** invent DisputeFox numeric IDs.
2. Match order: **email** (GHL identity, plus known alts such as Kimberly’s DF inbox) → **normalized phone**. Unmatched rows are skipped — this path never creates a Grants Client.
3. Writes only existing Client fields (`stage`, `nextAction`, `nextActionOwner`) and `DisputeRound`. Does **not** create a second client table.
4. **Does not** create/update/delete DisputeFox records. **Does not** send messages. **Does not** write GHL. **Does not** enable Zap `374413762` (stays OFF).
5. Live pull (`mode: pull`) without `DISPUTEFOX_API_KEY` fails closed. Live list/get stays disabled so the Zap is never used as a sync bus.

## Credit Repair Cloud → Grants Client (not connected · inbound compare)

CRC was the primary system for ~5 years. The 26-master inbound GHL/DF path is **not** a CRC contact recovery. See `docs/CRC-MIGRATION.md`.

1. **Local compare** (no API key): `npm run crc:inbound-compare -- --local --dry-run`. Reads the checked-in synthetic CSV roster. Existing-only. Does **not** create contacts.
2. Match order: **CRC id → exact email → normalized phone → name + corroborating address**. Unmatched rows are skipped — this path never creates a Grants Client.
3. ONE HUMAN = ONE MASTER. Future create (not executed) is one Grants master + one GHL contact when truly missing from both. Do **not** auto-create DisputeFox.
4. Backfill only when the new-system field is blank and CRC has a verified value. Conflicts go to the review queue.
5. Live pull (`--live`) without `CRC_API_KEY` **fails closed**. Phase 2 class-gated flags (`CRC_WRITE_*_ENABLED`) default **false**. `CRC_RECOVERY_WRITES_ENABLED` is **ignored** (never a write-everything switch). No messages. Zap `374413762` stays OFF. Friday Update Router stays unpublished. No live GHL/DF/OS clients.

### SmartCredit (affiliate payouts)
**Yes — your personal sponsor/partner signup link is required** so Grants & Co is credited every time a client enrolls.

Provide either:
1. Full sponsor URL → `SMARTCREDIT_SPONSOR_URL` (best)  
   Example shape: `https://www.smartcredit.com/join/?pid=YOUR_PID`
2. And/or sponsor code → `SMARTCREDIT_SPONSOR_CODE`

Where: SmartCredit partner/affiliate dashboard → copy your sponsored enrollment link.

The OS keeps your `pid` (or other affiliate params) intact and appends `gc_ref=<GrantsClientId>` for internal tracking.
