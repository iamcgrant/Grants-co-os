# Deployment

## Compatible targets

- **Vercel** (`vercel.json` — cron every 5m → `/api/automations/run`, region `iad1`)
- **Docker** (`Dockerfile`) — full control of workers
- Any Node 22 host with PostgreSQL (Neon or Supabase via Vercel Marketplace — **not** discontinued Vercel Postgres)

## One-shot go-live (BUILDX)

BUILDX owns Vercel CLI/token, Neon, and domain attach. Cloud Agent does not need `VERCEL_TOKEN`.

```bash
# Required on the machine running go-live (BUILDX):
# VERCEL_TOKEN, COMMAS_API_KEY, GHL_API_KEY, GHL_LOCATION_ID
# AUTH_SECRET + GC_CRON_SECRET
# PAYMENT_PROVIDER=commas  NEXT_PUBLIC_APP_URL=https://os.grantandconsultants.com
# GC_VERCEL_EXTERNAL=1

npm run go:live
```

Or configure Neon + domain + env in the Vercel dashboard, then:

```bash
DATABASE_URL='postgresql://…' npm run db:migrate:production
OWNER_SETUP_BASE_URL=https://os.grantandconsultants.com npm run owner:setup-link
```

This runs: Neon install → migrate → Vercel deploy → domain inspect (exact DNS) → Commas webhook register → readiness 11/11 → smoke → desktop smoke.

Individual steps:

| Script | Purpose |
|--------|---------|
| `npm run deploy:production` | Link project, Neon, env upsert, migrate, deploy |
| `npm run db:migrate:production` | `prisma db push` against Postgres schema |
| `npm run domain:configure` | Add `os.grantandconsultants.com` + print **exact** Vercel DNS |
| `npm run commas:register-webhook` | Create webhook; store `COMMAS_WEBHOOK_SECRET` once |
| `npm run launch:readiness` | Fixed **11/11** gate |
| `npm run smoke:production` | Public SSL/health/login/webhook/cron smoke |
| `npm run e2e:production` | Broader authenticated E2E |
| `npm run desktop:smoke` | Packaging integrity |

## Environment templates

- `.env.example` — local / Cloud Agent
- `.env.production.example` — Vercel production checklist
- `docs/PRODUCTION_ENV.md` — exact names from source

## Database

1. Provision **Neon** (or Supabase) via Vercel Marketplace
2. Enable automated backups in the Neon/Supabase dashboard
3. `DATABASE_URL=postgresql://…`
4. `npm run db:migrate:production` (uses `prisma/schema.postgres.prisma`; local sqlite untouched)

## Webhooks & cron

- Payments: `POST /api/webhooks/payments` (HMAC via `COMMAS_WEBHOOK_SECRET`); `GET` returns non-secret status
- Automations: `POST /api/automations/run` — staff session **or** `x-gc-cron-secret` / Vercel `Authorization: Bearer $CRON_SECRET`

## Domain

Permanent hostname: **`os.grantandconsultants.com`** (Squarespace DNS on `grantandconsultants.com`).

```bash
npm run domain:configure
# Apply the printed records at Squarespace DNS — do not guess CNAME targets
```

See `docs/BUILDX_HANDOFF.md`.

## Desktop

See `docs/DESKTOP.md`. After web is live and 11/11 passes, tag `desktop-v0.1.0` for Mac/Windows/Linux CI artifacts; set `GC_DESKTOP_*_URL` before exposing `/downloads`.

## Health

- `GET /api/health`
- `/system-health` + `GET /api/system/health`
