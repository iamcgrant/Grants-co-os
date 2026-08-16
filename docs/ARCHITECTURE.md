# Architecture

Grants & Co OS is a modular operating layer. Third-party systems never own master identity.

```
GRANTS & CO OS (source of truth)
 ├── Grants Pay          → PaymentProvider adapters
 ├── Grants Operations   → GHL + DisputeFox adapters + staff workflow
 ├── Grants Credit Pulse → SmartCredit / Credit Karma / Experian connectors
 ├── Client Experience   → Client PWA portal
 ├── Grants Intelligence → Attribution + analytics + AI assist (guarded)
 └── Grants Credit Engine → Strategic proprietary dispute modules
```

## Identity

Every person receives one permanent **Grants Client ID** (`GC-000001`). External IDs attach via `client_identifiers`.

## Auth & RBAC

Cookie session (JWT wrapping hashed session token) + role permissions + financial field restrictions. MFA-capable fields exist on `User` (`mfaEnabled`, `mfaSecret`).

## Data

Prisma schema is the canonical model. Local development uses SQLite via `@prisma/adapter-better-sqlite3`. Production target is PostgreSQL/Supabase with the same schema (provider switch + RLS policies).

## Isolation rule

Payment modules live under `src/lib/payments` with strict idempotency. Other phases must not mutate payment ledgers except through payment services.
