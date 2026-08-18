# ACTION REQUIRED — human credentials only

Checked Cursor env, GitHub, and local secrets stores. These are **not** present and cannot be invented by the agent.

## 1. Vercel deploy (blocks live web)

| Secret | Where to get it | Where to enter |
|--------|-----------------|----------------|
| `VERCEL_TOKEN` | https://vercel.com/account/tokens | Cursor Cloud Agent environment secrets |

After that, say **continue** — agent runs `npm run go:live` (Neon Postgres, migrate, deploy, prints exact DNS for `os.grantsandco.com`).

Also set (or agent will set after token):
- `NEXT_PUBLIC_APP_URL=https://os.grantsandco.com`
- `PAYMENT_PROVIDER=commas`
- `AUTH_SECRET` / `GC_CRON_SECRET` (agent can generate)

## 2. Commas payments (blocks real money path)

| Secret | Where to get it | Where to enter |
|--------|-----------------|----------------|
| `COMMAS_API_KEY` | Commas / Fanbasis sandbox dashboard | Cursor secrets + Vercel project env |
| `COMMAS_WEBHOOK_SECRET` | Issued once by `npm run commas:register-webhook` after public URL exists | Cursor + Vercel |

## 3. GHL outbound SMS/email (blocks autonomous outbound)

Not a new env var — **reissue Private Integration** with scope `conversations/message.write`, replace existing `GHL_API_KEY` value in Cursor secrets.

Already present (do not re-add): `GHL_API_KEY`, `GHL_LOCATION_ID`, `CURSOR_API_KEY`.

## 4. Optional later (not required for first downloadable builds)

- Apple Developer signing / notarization
- Windows Authenticode certificate

Unsigned Mac/Windows installers are intentional for v0.1.x.
