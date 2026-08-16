# Integrations

All integrations are adapters beneath Grants & Co OS.

| Provider | Module | Status |
|----------|--------|--------|
| GoHighLevel | `MockGoHighLevelProvider` | Mock — CRM/comms only |
| DisputeFox | `MockDisputeFoxProvider` | Mock — dispute processing |
| SmartCredit | `MockSmartCreditProvider` | Mock — sponsored enrollment + scores |
| Credit Karma | `MockCreditKarmaConnector` | Mock — **read only** |
| Experian | `MockExperianConnector` | Mock — weekly score |
| Payments | Mock / Authorize.Net stub / Commas stub | Mock active |

## Credentials needed later

Do **not** paste passwords into chat, GitHub, or source files. Store them in Cursor Secrets / host environment variables.

### GoHighLevel
- Login email / password (staff portal) → `GHL_LOGIN_EMAIL`, `GHL_LOGIN_PASSWORD`
- Preferred for automation: **API Key** + **Location ID** → Settings → Integrations → API Keys

### DisputeFox
- Login email / password → `DISPUTEFOX_LOGIN_EMAIL`, `DISPUTEFOX_LOGIN_PASSWORD`
- Preferred for automation: API key from DisputeFox admin when available
- Intake URL template → `DISPUTEFOX_INTAKE_URL_TEMPLATE`

### SmartCredit (affiliate payouts)
**Yes — your personal sponsor/partner signup link is required** so Grants & Co is credited every time a client enrolls.

Provide either:
1. Full sponsor URL → `SMARTCREDIT_SPONSOR_URL` (best)
2. And/or sponsor code → `SMARTCREDIT_SPONSOR_CODE`

Where: SmartCredit partner/affiliate dashboard → copy your sponsored enrollment link.

The OS appends `gc_ref=<GrantsClientId>` for internal tracking while preserving your affiliate attribution.
