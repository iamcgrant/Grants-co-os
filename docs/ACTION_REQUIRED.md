# ACTION REQUIRED — BUILDX (not Charles / not Cloud Agent)

Permanent origin: **`https://os.grantandconsultants.com`**

Vercel project is **already claimed**. Cloud Agent does not need `VERCEL_TOKEN`.

## Why login fails right now

1. **`os.grantandconsultants.com` has no public DNS** (NXDOMAIN). Website and the published desktop build both try that host.
2. **The live app is** `https://temporary-prompt-oboe-st5fuuv.vercel.app` — the login page renders, but sign-in cannot work until Production `DATABASE_URL` on **that** project is Neon `postgresql://…?sslmode=require` and the app is redeployed.
3. After Neon is set: `npm run db:migrate:production`, then `OWNER_SETUP_BASE_URL=https://temporary-prompt-oboe-st5fuuv.vercel.app npm run owner:setup-link` (use the permanent origin only after the CNAME exists). Owner email: `owner@grantsandco.com`.

## BUILDX checklist

1. **Neon** on project `temporary-prompt-oboe-st5fuuv` → Production `DATABASE_URL`
2. **Env** from `.env.production.example` (especially `NEXT_PUBLIC_APP_URL=https://os.grantandconsultants.com`, `AUTH_SECRET`, `GC_CRON_SECRET`/`CRON_SECRET`, `GC_VERCEL_EXTERNAL=1`)
3. **Domain** `os.grantandconsultants.com` in Vercel → paste exact CNAME into Squarespace DNS for host `os`
4. **Migrate** `npm run db:migrate:production` then Owner setup link against the permanent origin
5. **Commas** when ready: `PAYMENT_PROVIDER=commas` + `COMMAS_API_KEY` + `npm run commas:register-webhook`

Full detail: `docs/BUILDX_HANDOFF.md`
