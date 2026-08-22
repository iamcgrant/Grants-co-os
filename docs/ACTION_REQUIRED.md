# ACTION REQUIRED — BUILDX (not Charles / not Cloud Agent)

Permanent origin: **`https://os.grantandconsultants.com`**

Vercel project is **already claimed**. Cloud Agent does not need `VERCEL_TOKEN`.

## BUILDX checklist

1. **Neon** on project `temporary-prompt-oboe-st5fuuv` → Production `DATABASE_URL`
2. **Env** from `.env.production.example` (especially `NEXT_PUBLIC_APP_URL=https://os.grantandconsultants.com`, `AUTH_SECRET`, `GC_CRON_SECRET`/`CRON_SECRET`, `GC_VERCEL_EXTERNAL=1`)
3. **Domain** `os.grantandconsultants.com` in Vercel → paste exact CNAME into Squarespace DNS for host `os`
4. **Migrate** `npm run db:migrate:production` then Owner setup link against the permanent origin
5. **Commas** — Fanbasis has no API Keys page. Do not invent `COMMAS_API_KEY`. Staff create invoices in OS and record the official checkout URL. Optional later: `GRANTS_PAY_INBOUND_WEBHOOK_SECRET` for Zapier/GHL mark-paid.

Full detail: `docs/BUILDX_HANDOFF.md`
