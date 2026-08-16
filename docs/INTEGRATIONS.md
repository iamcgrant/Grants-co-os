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

- **GHL**: Agency API key + Location ID — Settings → Integrations → API Keys
- **DisputeFox**: API credentials from DisputeFox admin
- **SmartCredit**: Sponsor/partner code + enrollment attribution details
- **Credit Karma / Experian**: Approved connector credentials (temporary; replaceable by bureau APIs)

Missing credentials must not freeze development — mocks remain active.
