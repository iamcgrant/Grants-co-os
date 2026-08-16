# Grants & Co OS

Proprietary business operating system for **Grants & Co Consultants**.

Grants & Co OS is the source of truth. Payment processors, GoHighLevel, DisputeFox, SmartCredit, Credit Karma, Experian, and other vendors plug in as modular providers.

## Quick start

```bash
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Development staff accounts

Passwords are for local/dev only — never shown in the product UI.

| Role | Email | Password |
|------|-------|----------|
| Charles (Owner) | owner@grantsandco.com | GrantsCo2026! |
| Simon (Client Care) | simon@grantsandco.com | GrantsCo2026! |
| Jona (File Prep) | jona@grantsandco.com | GrantsCo2026! |
| Client portal | donna.james@example.com | GrantsCo2026! |

### Grants Pay demo

Invoice **GC-1051** (Donna James) is due — open `/pay/GC-1051`.

## Priority

**Payments and financial infrastructure are Priority #1.** Later modules must never compromise payment stability.

## Stack

- Next.js (App Router) + React + TypeScript
- Prisma + SQLite (local) → PostgreSQL/Supabase (production)
- Adapter-based payment providers (Mock default / Authorize.Net sandbox Accept.js / Commas stub)
- Brand system inspired by grantandconsultants.com (Fraunces + Manrope, charcoal/gold) — see `docs/BRAND.md`
- PWA (manifest + service worker)
- Vitest for critical financial/identity tests

## Scripts

- `npm run dev` — development server
- `npm run test` — critical automated tests
- `npm run db:seed` — safe dummy data
- `npm run build` — production build
- `npm run df:inbound-attach -- --local --dry-run` — DisputeFox local attach preview (existing masters only)

## Documentation

See `/docs` for architecture, payments, security, database, integrations, credit pulse, client app, marketing, lead attribution, roadmap, and deployment.
