# ACTION REQUIRED — BUILDX (not Charles / not Cloud Agent)

Permanent origin: **`https://os.grantandconsultants.com`**

Vercel project is **already claimed**. Cloud Agent does not need `VERCEL_TOKEN`.

## Why login fails right now

1. **`os.grantandconsultants.com` has no public DNS** (NXDOMAIN). Code now treats `https://temporary-prompt-oboe-st5fuuv.vercel.app` as the everyday origin until `GC_PERMANENT_HOST_READY=1`.
2. **The live app still has no Neon `DATABASE_URL`.** Sign-in cannot succeed until Production `DATABASE_URL` on project `temporary-prompt-oboe-st5fuuv` is `postgresql://…?sslmode=require` and this branch is deployed.
3. After Neon is set: `npm run website:online` (needs `VERCEL_TOKEN` + `DATABASE_URL` + `OWNER_BOOTSTRAP_PASSWORD`) or `npm run db:migrate:production` then `npm run owner:bootstrap`. Owner email: `owner@grantsandco.com`.

## BUILDX checklist

1. **Neon** on project `temporary-prompt-oboe-st5fuuv` → Production `DATABASE_URL`
2. **Env** from `.env.production.example` (especially `NEXT_PUBLIC_APP_URL=https://os.grantandconsultants.com`, `AUTH_SECRET`, `GC_CRON_SECRET`/`CRON_SECRET`, `GC_VERCEL_EXTERNAL=1`)
3. **Domain** Vercel already attached `os.grantandconsultants.com` to empty project `grants-co-os` (no deployment). Attach it to live project `temporary-prompt-oboe-st5fuuv`, then Squarespace CNAME host `os` → the exact target Vercel shows (`cname.vercel-dns.com` if Vercel does not print another).
4. **Migrate** `npm run db:migrate:production` then Owner setup link against the permanent origin
5. **Commas** when ready: `PAYMENT_PROVIDER=commas` + `COMMAS_API_KEY` + `npm run commas:register-webhook`

Full detail: `docs/BUILDX_HANDOFF.md`
