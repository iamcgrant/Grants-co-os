# Payments — Grants Pay

## Priority

Financial infrastructure is **Priority #1**. Do not connect production processors until explicitly approved. Live charges stay locked behind explicit env flags.

## Approved primary: Commas

**Commas (Fanbasis) is the approved payment platform for Grants & Co.**

Grants Pay never collects or stores raw card numbers / CVV. Customers complete payment on Commas’ secure hosted checkout (`payment_link`). Grants & Co OS owns the branded concierge experience, invoices, master client identity, receipts, and post-payment intake.

| Adapter | Status | Role |
|---------|--------|------|
| CommasPaymentProvider | **Primary** — hosted checkout + webhooks | Production path when `PAYMENT_PROVIDER=commas` + sandbox/live keys |
| MockPaymentProvider | Active local default | Safe simulation (simulated payments **never** count as collected revenue) |
| AuthorizeNetPaymentProvider | Secondary sandbox Accept.js | Optional proprietary card path; fail-closed without credentials |

Set `PAYMENT_PROVIDER=mock|commas|authorize_net`.

## Provider interface

`PaymentProvider` supports:

- createCustomer, createCheckoutSession, tokenizePaymentMethod
- createPayment, chargePaymentMethod, retrievePayment
- refundPayment, retrieveRefund
- retrieveSettlementStatus, retrievePayout
- verifyWebhook, handleWebhook

## Grants Pay workflow

```
CLIENT → PAYMENT REQUEST → GRANTS PAY (branded) → COMMAS SECURE CHECKOUT
  → payment.succeeded webhook → MASTER CLIENT → CLIENT SETUP → ONBOARDING → STAFF
```

Staff APIs:

- `POST /api/pay/requests` — create payment request + invoice + secure link
- Client 360 → Pay — same create/send flow for the open Grants client (`COMMAS_API_KEY` from env)
- `GET /pay/[invoiceNumber]` — luxury client checkout
- `POST /api/webhooks/payments` — Commas HMAC (`x-webhook-signature`)
- `/setup/[token]` — native one-time client setup after payment

Statuses tracked: Pending, Paid, Failed, Canceled, Refunded, Partially Refunded, Chargeback/Dispute.

## Safety

- Idempotency keys on charges, refunds, and webhook event IDs
- Unique `(provider, providerTransactionId)`
- Invoice status separate from settlement / payout
- Never store raw PAN/CVV
- Never put secret keys in browser, GitHub, logs, or screenshots
- Webhook verification via HMAC-SHA256 (`COMMAS_WEBHOOK_SECRET`)
- Live charges require `COMMAS_LIVE_CHARGES=true` (or Authorize.Net equivalent)
- Mock / simulated payments are excluded from production collected-revenue semantics

## Credentials (sandbox first — do not activate live)

### Commas (primary)

| Env var | Purpose |
|---------|---------|
| `COMMAS_API_KEY` | Dashboard → API Keys (`x-api-key`). Scopes: `checkout-sessions`, `payments`, `refunds`, `webhooks`, `customers` |
| `COMMAS_WEBHOOK_SECRET` | `secret_key` from webhook subscription create |
| `COMMAS_ENVIRONMENT` | `sandbox` → `https://qa.dev-fan-basis.com` · `production` → `https://www.fanbasis.com` |
| `COMMAS_CREATOR_HANDLE` | Optional — embedded checkout |
| `COMMAS_LIVE_CHARGES` | Must be `true` for production charges |

### Authorize.Net (optional secondary)

| Env var | Purpose |
|---------|---------|
| `AUTHORIZE_NET_SANDBOX_API_LOGIN_ID` | Sandbox API login |
| `AUTHORIZE_NET_SANDBOX_TRANSACTION_KEY` | Sandbox transaction key |
| `AUTHORIZE_NET_SANDBOX_CLIENT_KEY` | Public Accept.js client key |
| `AUTHORIZE_NET_LIVE_CHARGES` | Production lock |

### DisputeFox intake handoff

| Env var | Purpose |
|---------|---------|
| `DISPUTEFOX_INTAKE_URL_TEMPLATE` | Fallback hosted form: `{externalId}` + `{grantsClientId}` |

Native `/setup/[token]` is the primary post-payment experience. Existing DisputeProcess intake remains as branded fallback when the template is set.

## Checkout surfaces

- Proprietary Grants Pay UI: `/pay/[invoiceNumber]`
- Post-success bridge: `/pay/continue/[invoiceNumber]`
- Native client setup: `/setup/[token]`
