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

Local seed creates these emails. Set a password with `SEED_PASSWORD` before `npm run db:seed` (never commit real passwords). Rotate before any shared or production use.

| Role | Email |
|------|-------|
| Charles (Owner) | owner@grantsandco.com |
| Simon (Client Care) | simon@grantsandco.com |
| Jona (File Prep) | jona@grantsandco.com |
| Client portal | donna.james@example.com |

### Grants Pay demo

Invoice **GC-1051** (Donna James) is due — open `/pay/GC-1051`.

## Priority

**Payments and financial infrastructure are Priority #1.** Commas is the approved primary payment platform. Later modules must never compromise payment stability.

## Stack

- Next.js (App Router) + React + TypeScript
- Prisma + SQLite (local) → PostgreSQL/Supabase (production)
- Adapter-based payment providers (**Commas primary** / Mock default / Authorize.Net sandbox optional)
- Brand system inspired by grantandconsultants.com (Fraunces + Manrope, charcoal/gold) — see `docs/BRAND.md`
- PWA (manifest + service worker) + Tauri desktop scaffold (`/desktop`)
- Vitest for critical financial/identity tests

## Scripts

- `npm run dev` — development server
- `npm run test` — critical automated tests
- `npm run db:seed` — safe dummy data
- `npm run build` — production build
- `npm run df:inbound-attach -- --local --dry-run` — DisputeFox local attach preview (existing masters only)
- `npm run crc:recovery-report` — CRC contact recovery dry-run (synthetic fixture, no live writes)
- `npm run crc:inbound-compare -- --local --dry-run` — CRC inbound compare (existing-only, synthetic CSV)

## Documentation

See `/docs` for architecture, payments, security, database, integrations, credit pulse, client app, marketing, lead attribution, acquisition, roadmap, and deployment.
