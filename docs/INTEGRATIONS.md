# Integrations

All integrations are adapters beneath Grants & Co OS.

| Provider | Module | Status |
|----------|--------|--------|
| GoHighLevel | `LiveGoHighLevelProvider` when `GHL_API_KEY` is set (`GHL_LOCATION_ID` defaults to `NsmlbLVNr4SBJNC8gnrn`); else mock | **Live inbound onto existing master records only** |
| DisputeFox | `MockDisputeFoxProvider` | Mock — dispute processing (intake path preserved) |
| SmartCredit | `MockSmartCreditProvider` | Mock — sponsored enrollment + scores |
| Credit Karma | `MockCreditKarmaConnector` | Mock — **read only** |
| Experian | `MockExperianConnector` | Mock — weekly score |
| Payments | Mock / Authorize.Net stub / Commas stub | Mock active |

## GHL → Grants Client → Client 360

1. Pull contacts via `POST /api/integrations/ghl/sync` (Owners/managers). `dryRun: true` previews matches without writes.
2. Link onto **existing** Grants master clients only, match order **GHL id → email → normalized phone**. Unmatched GHL contacts are skipped — this path never creates a Grants Client.
3. Attach `ClientIdentifier` provider `GHL` with metadata `{ source: "ghl_api", dataPlane, locationId }`.
4. Client 360 shows Grants Client ID, GHL Contact ID, DisputeFox ID, stage, staff, next action, onboarding, docs, disputes, tasks, OS comms, credit/pay/timeline — or **Awaiting Integration** when a source is not connected.
5. **Does not** send live messages. **Does not** create/update/delete GHL contacts. **Does not** replace DisputeFox → GHL / post-pay intake.
6. Without `GHL_API_KEY` the live path **fails closed** (no GHL HTTP, no client writes).

Known location: `NsmlbLVNr4SBJNC8gnrn`  
URL: https://app.gohighlevel.com/v2/location/NsmlbLVNr4SBJNC8gnrn/

Development seed identifiers are tagged `{ source: "seed", dataPlane: "development" }` and labeled as dev samples — never presented as live CRM data.

## Credentials needed later

Do **not** paste passwords into chat, GitHub, or source files. Store them in Cursor Secrets / host environment variables.

### GoHighLevel
- Login email / password (staff portal) → `GHL_LOGIN_EMAIL`, `GHL_LOGIN_PASSWORD` (local/secrets only)
- **Required for live inbound sync:** `GHL_API_KEY` (Cursor Secrets / host env — never commit)
- **Optional:** `GHL_LOCATION_ID` — defaults to `NsmlbLVNr4SBJNC8gnrn` when omitted
- Source: Settings → Integrations → API Keys / Private Integration

Portal passwords enable staff-browser / connector scaffolding. Production sync prefers API keys. This inbound path never writes GHL contacts.

### DisputeFox
- Login email / password → `DISPUTEFOX_LOGIN_EMAIL`, `DISPUTEFOX_LOGIN_PASSWORD` (local/secrets only)
- Preferred for automation: API key from DisputeFox admin when available → `DISPUTEFOX_API_KEY`
- Intake URL template → `DISPUTEFOX_INTAKE_URL_TEMPLATE`

### SmartCredit (affiliate payouts)
**Yes — your personal sponsor/partner signup link is required** so Grants & Co is credited every time a client enrolls.

Provide either:
1. Full sponsor URL → `SMARTCREDIT_SPONSOR_URL` (best)  
   Example shape: `https://www.smartcredit.com/join/?pid=YOUR_PID`
2. And/or sponsor code → `SMARTCREDIT_SPONSOR_CODE`

Where: SmartCredit partner/affiliate dashboard → copy your sponsored enrollment link.

The OS keeps your `pid` (or other affiliate params) intact and appends `gc_ref=<GrantsClientId>` for internal tracking.
