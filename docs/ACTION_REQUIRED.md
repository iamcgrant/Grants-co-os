# ACTION REQUIRED — human credentials only

## You can sign in NOW (temporary public tunnel)

While production deploy is blocked on `VERCEL_TOKEN`, the OS is reachable on a Cloudflare quick tunnel from this Cloud Agent:

1. Open the **SET_PASSWORD_URL** from the latest agent message (or regenerate with `OWNER_SETUP_BASE_URL=<tunnel> npm run owner:setup-link`).
2. Choose your Owner password (12+ chars, upper/lower/number/symbol).
3. You land in `/home` as `owner@grantsandco.com` with role `OWNER`.
4. Later visits: `<tunnel>/login` with that email + password.

This tunnel dies when the agent VM stops. It is **not** `os.grantsandco.com` production.

---

## Must add (blocks live production on os.grantsandco.com)

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

Start a **new** Cloud Agent follow-up so secrets inject, then:

```bash
npm run go:live
```

→ Neon Postgres → migrate → Vercel deploy → exact DNS for `os.grantsandco.com` → Commas webhook → gate → smoke.

## Desktop downloads (verified public)

Repo is public. Release: https://github.com/iamcgrant/Grants-co-os/releases/tag/desktop-v0.1.2  
Asset filenames still use package version `0.1.1` (e.g. `Grants.Co.OS_0.1.1_aarch64.dmg`).
