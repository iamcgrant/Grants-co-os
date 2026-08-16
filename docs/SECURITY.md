# Security

Designed for consumer, financial, credit, and identity data from day one.

## Requirements implemented / scaffolded

- Least privilege RBAC (`src/lib/rbac/permissions.ts`)
- Server-side authorization on APIs
- Secure httpOnly session cookies
- Password hashing (bcrypt)
- Session revocation
- Webhook verification hooks
- Webhook + payment idempotency
- Database uniqueness constraints
- Sanitized audit logs (secrets redacted)
- MFA-capable user fields
- Financial data hidden from FILE_PREPARER / MARKETING as appropriate
- Credit connector credentials never returned to staff UI

## Never store

- Raw card numbers / CVV
- Processor secrets in browser code
- Plaintext passwords
- Sensitive credentials in logs

## Production hardening checklist

- Rotate `AUTH_SECRET`
- Enable MFA enrollment flows
- PostgreSQL Row Level Security policies in Supabase
- Rate limiting at edge/API gateway
- Encrypted object storage for documents
- Processor-hosted payment fields only
