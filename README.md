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

### Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Owner | owner@grantsandco.com | GrantsCo2026! |
| Manager | manager@grantsandco.com | GrantsCo2026! |
| File Preparer | preparer@grantsandco.com | GrantsCo2026! |
| Marketing | marketing@grantsandco.com | GrantsCo2026! |
| Client | donna.james@example.com | GrantsCo2026! |

### Grants Pay demo

Invoice **GC-1048** (Donna James) is due — open `/pay/GC-1048`.

## Priority

**Payments and financial infrastructure are Priority #1.** Later modules must never compromise payment stability.

## Stack

- Next.js (App Router) + React + TypeScript
- Prisma + SQLite (local) → PostgreSQL/Supabase (production)
- Adapter-based payment providers (Mock / Ecrypt / NMI stubs)
- PWA (manifest + service worker)
- Vitest for critical financial/identity tests

## Scripts

- `npm run dev` — development server
- `npm run test` — critical automated tests
- `npm run db:seed` — safe dummy data
- `npm run build` — production build

## Documentation

See `/docs` for architecture, payments, security, database, integrations, credit pulse, client app, marketing, roadmap, and deployment.
