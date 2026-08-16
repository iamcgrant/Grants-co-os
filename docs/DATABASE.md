# Database

Canonical schema: `prisma/schema.prisma`.

## Core entities

users, staff_profiles, clients, client_identifiers, addresses, services, client_services, contracts, service_milestones, billing_policies, invoices, invoice_items, payment_customers, payment_methods, payment_transactions, payment_attempts, refunds, payment_disputes, payouts, webhook_events, integration_connections, integration_sync_events, documents, tasks, client_assignments, client_timeline_events, notifications, audit_logs, system_events, credit_connections, credit_snapshots, credit_scores, credit_changes, credit_accounts, credit_monitoring_events, marketing_sources, marketing_campaigns, lead_sources, conversion_events, id_sequences

## Master Client ID

`IdSequence` name `grants_client` produces `GC-000001` format IDs.

## Duplicate prevention

Unique `emailNormalized`. Phone normalized for matching. Create API returns `POSSIBLE_DUPLICATE` before insert unless `forceCreate`.

`ClientIdentifier.provider` values used on the same master: `GHL`, `DISPUTEFOX`, `CREDIT_REPAIR_CLOUD`, `SMARTCREDIT`, `PAYMENT`. Provider IDs are never separate clients.

`Document.sourceSystem` is optional provenance (`CREDIT_REPAIR_CLOUD` for CRC recoveries) with `originalDate`, `sourceClientId`, and `documentType`. Raw files stay in secure storage.

## Local vs production

- Local: SQLite `file:./dev.db`
- Production: set `DATABASE_URL` to Supabase Postgres and update Prisma `provider` to `postgresql`
