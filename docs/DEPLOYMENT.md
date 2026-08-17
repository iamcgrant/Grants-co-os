# Deployment

## Compatible targets

- **Docker** (`Dockerfile` in repo root) — preferred for full control of workers + cron
- **Vercel** (`vercel.json` cron hits `/api/automations/run`)
- Any Node 22 host with PostgreSQL

## Environment

Copy `.env.example` → set secrets in the host (never commit production secrets).

Required:

- `DATABASE_URL` (Postgres in production)
- `AUTH_SECRET`
- `PAYMENT_PROVIDER` (`commas` for production money path after sandbox validation)
- `NEXT_PUBLIC_APP_URL` (public HTTPS origin)

Commas (primary):

- `COMMAS_API_KEY`
- `COMMAS_WEBHOOK_SECRET`
- `COMMAS_ENVIRONMENT=sandbox` until live activation
- `COMMAS_LIVE_CHARGES=false` until explicit live approval

Optional: `GC_CRON_SECRET` for authenticated cron calls to `/api/automations/run`.

## Database

1. Switch Prisma datasource / `DATABASE_URL` to `postgresql` for production
2. Run migrations / schema sync
3. Apply Supabase RLS policies (see Security)
4. Seed only non-production environments
5. Enable automated backups on the host

Local Cloud Agent / SQLite rebuild (dev only):

```bash
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script -o /tmp/gc-schema.sql
# apply with better-sqlite3, then npm run db:seed
```

## Background jobs

- `instrumentation.ts` drains the automation queue every 30s and schedules Friday Credit Pulse (Friday 14:00 UTC window)
- `POST /api/automations/run` for external cron / Vercel cron
- Webhooks: `POST /api/webhooks/payments` (Commas HMAC)

## Health

- Public liveness: `GET /api/health`
- Owner system health: `/system-health` + `GET /api/system/health`

## Desktop

See `docs/DESKTOP.md`. Tauri wrapper under `/desktop` packages macOS / Windows / Linux installers that load the production web OS.

## PWA

`public/manifest.webmanifest` + `public/sw.js` + icons. HTTPS required for install on phones.
