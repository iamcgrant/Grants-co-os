# ACTION REQUIRED — human credentials only

Re-checked this agent environment: **`VERCEL_TOKEN` and `COMMAS_API_KEY` are still not available here.**

If you already added them in the Cursor dashboard, start a **new** Cloud Agent follow-up so secrets inject into a fresh session, then say **continue**.

## Must add (blocks live production)

| Secret | Get from | Enter in |
|--------|----------|----------|
| `VERCEL_TOKEN` | https://vercel.com/account/tokens | [Cursor environment secrets](https://cursor.com/dashboard/cloud-agents/environments/e/0b257c05-9983-11f1-ba66-0e7d0216e441) |
| `COMMAS_API_KEY` | Commas / Fanbasis sandbox dashboard | Same Cursor secrets |
| `PAYMENT_PROVIDER` | value: `commas` | Same |
| `NEXT_PUBLIC_APP_URL` | value: `https://os.grantsandco.com` | Same |

Optional until after first public deploy: `COMMAS_WEBHOOK_SECRET` (agent registers webhook once HTTPS is live).

## GHL outbound (scope, not a new env name)

Reissue Private Integration with `conversations/message.write` and replace the existing `GHL_API_KEY` value.

Already present — do not re-add: `GHL_API_KEY`, `GHL_LOCATION_ID`, `CURSOR_API_KEY`.

## After secrets are visible to the agent

```bash
npm run go:live
```

→ Neon Postgres → migrate → Vercel deploy → exact DNS for `os.grantsandco.com` → Commas webhook → 11/11 gate → smoke.

## Desktop (already done)

https://github.com/iamcgrant/Grants-co-os/releases/tag/desktop-v0.1.2 — Mac `.dmg`, Windows `.exe`, Linux AppImage/`.deb` (unsigned).
