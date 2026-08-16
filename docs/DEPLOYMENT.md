# Deployment

## Compatible targets

- Vercel (Next.js)
- Any Node host with PostgreSQL

## Environment

Copy `.env.example` → set secrets in the host (never commit production secrets).

Required:

- `DATABASE_URL`
- `AUTH_SECRET`
- `PAYMENT_PROVIDER`

## Database

1. Switch Prisma datasource to `postgresql` for production
2. Run migrations
3. Apply Supabase RLS policies (see Security)
4. Seed only non-production environments

## PWA

`public/manifest.webmanifest` + `public/sw.js` + icons. HTTPS required for install on phones.
