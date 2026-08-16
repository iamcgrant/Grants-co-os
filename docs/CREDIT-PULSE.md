# Credit Pulse

Central credit-monitoring layer.

## Rules

- Every score stores CLIENT + BUREAU + SCORE + SCORING_MODEL + SOURCE + TIMESTAMP
- Snapshots are append-only (never overwrite history)
- Unlike scoring models are never presented as identical
- Credit Karma connector is read-only (no applications, offers, disputes, settings changes)
- Credential refs are never exposed to staff APIs

## Friday Credit Pulse

`runFridayCreditPulse(clientId)`:

1. Load connected providers
2. If reauth needed → notify client (not staff emergency)
3. Fetch authorized scores
4. Record snapshot + detect changes
5. Create client notification summary

## UI

Staff: `/credit-pulse`  
Client: `/portal/credit`
