# Payments — Grants Pay

## Priority

Financial infrastructure is **Priority #1**. Do not connect production processors until explicitly approved. Live charges stay locked behind explicit env flags.

## Approved primary: Commas

**Commas (Fanbasis) is the approved payment platform for Grants & Co.**

Charles confirmed the Fanbasis dashboard has **no API Keys page**. Do **not** invent `COMMAS_API_KEY`. Do not scrape.

Grants Pay never collects or stores raw card numbers / CVV. Staff create the invoice in Grants OS. Customers complete payment on Commas’ official hosted checkout (`payment_link` or a recorded product / checkout URL). Grants & Co OS owns the branded concierge experience, invoices, master client identity, receipts, and post-payment intake.

| Adapter | Status | Role |
|---------|--------|------|
| CommasPaymentProvider | Optional keyed path | Only when a real `COMMAS_API_KEY` exists (Fanbasis does not currently expose one) |
| Manual / recorded Commas checkout | **Primary without a key** | Staff paste or pick an official Fanbasis checkout / product URL |
| MockPaymentProvider | Active local default | Safe simulation (simulated payments **never** count as collected revenue) |
| AuthorizeNetPaymentProvider | Secondary sandbox Accept.js | Optional proprietary card path; fail-closed without credentials |

Set `PAYMENT_PROVIDER=mock|commas|authorize_net`. Mock / manual-Commas is valid. Do not invent a key to force `commas`.

## Provider interface

`PaymentProvider` supports:

- createCustomer, createCheckoutSession, tokenizePaymentMethod
- createPayment, chargePaymentMethod, retrievePayment
- refundPayment, retrieveRefund
- retrieveSettlementStatus, retrievePayout
- verifyWebhook, handleWebhook

## Grants Pay workflow

```
STAFF → OS INVOICE / PAYMENT REQUEST → GRANTS PAY (branded)
  → official Commas checkout (recorded URL or keyed payment_link)
  → payment.succeeded (inbound Zapier/GHL or Commas HMAC)
  → MASTER CLIENT → CLIENT SETUP → ONBOARDING → STAFF
```

Staff APIs:

- `POST /api/pay/requests` — create invoice + payment request. Optional `commasCheckoutUrl` (official Fanbasis https URL).
- `POST /api/pay/requests/[publicId]/checkout` — attach / replace the official Commas last-step URL.
- `GET /api/pay/commas-checkouts` — recorded official URLs staff can pick.
- Client 360 → Pay — same create/send flow for the open Grants client.
- Staff invoice desk — `/pay/invoices/[invoiceNumber]`
- `GET /pay/[invoiceNumber]` — luxury client checkout (last-step official Commas).
- `POST /api/webhooks/payments` — Commas HMAC (`x-webhook-signature`) when a real Commas webhook secret exists.
- `POST /api/webhooks/grants-pay` — official Zapier / GHL inbound mark-paid (see below).
- `/setup/[token]` — native one-time client setup after payment.

Statuses tracked: Pending, Paid, Failed, Canceled, Refunded, Partially Refunded, Chargeback/Dispute.

## Inbound Zapier / GHL webhook (optional)

The Zapier Commas app is **triggers-only** (New Sale, refunds). It **cannot** create a checkout session or payment link. GHL/LeadConnector Zaps also cannot mint Commas pay links. Do not use Zapier as a pay-link fallback.

Default official last-step product (no API key): **Returning Client Restart · $550 · product id `mXrEA`**. Staff copy the product-row checkout URL in Fanbasis and attach it in OS (or set `COMMAS_RETURNING_CLIENT_RESTART_URL` / `COMMAS_CREATOR_HANDLE` for the documented `agency-checkout` URL).

Charles does **not** need to build the Zap in this change. When ready, a New Sale trigger may mark an existing OS invoice paid at:

**`POST https://os.grantandconsultants.com/api/webhooks/grants-pay`**

Headers:

- `Authorization: Bearer $GRANTS_PAY_INBOUND_WEBHOOK_SECRET`
- or `x-grants-pay-secret: $GRANTS_PAY_INBOUND_WEBHOOK_SECRET`
- `Content-Type: application/json`

JSON body:

```json
{
  "event": "payment.succeeded",
  "paymentRequestPublicId": "GP-1001",
  "invoiceNumber": "GC-1048",
  "amountCents": 75000,
  "providerTransactionId": "fanbasis_or_zap_id",
  "source": "zapier"
}
```

`source` may be `zapier` or `ghl`. Identify the OS invoice with `paymentRequestPublicId` and/or `invoiceNumber`. Without `GRANTS_PAY_INBOUND_WEBHOOK_SECRET` the route **fails closed**. GHL remains the only phone / SMS / email backend — this webhook only marks the PaymentRequest paid.

`GET /api/webhooks/grants-pay` returns the same contract (no secrets).

## Safety

- Idempotency keys on charges, refunds, and webhook event IDs
- Unique `(provider, providerTransactionId)`
- Invoice status separate from settlement / payout
- Never store raw PAN/CVV
- Never put secret keys in browser, GitHub, logs, or screenshots
- Webhook verification via HMAC-SHA256 (`COMMAS_WEBHOOK_SECRET`) when that secret exists
- Inbound Zapier/GHL uses `GRANTS_PAY_INBOUND_WEBHOOK_SECRET`
- Live charges require `COMMAS_LIVE_CHARGES=true` (or Authorize.Net equivalent)
- Mock / simulated payments are excluded from production collected-revenue semantics

## Credentials

### Commas (primary in spirit)

Fanbasis has **no API Keys page**. Do not invent `COMMAS_API_KEY`.

| Env var | Purpose |
|---------|---------|
| `GRANTS_PAY_INBOUND_WEBHOOK_SECRET` | Optional OS-owned secret for Zapier/GHL mark-paid |
| `COMMAS_API_KEY` | Only if Fanbasis later issues a real key. Key presence is never CONNECTED. |
| `COMMAS_WEBHOOK_SECRET` | `secret_key` from webhook subscription create (keyed path only) |
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

- Staff invoice desk: `/pay/invoices/[invoiceNumber]`
- Proprietary Grants Pay UI: `/pay/[invoiceNumber]`
- Post-success bridge: `/pay/continue/[invoiceNumber]`
- Native client setup: `/setup/[token]`

## Health

Key absence is never `CONNECTED`. A recorded official checkout or inbound payment webhook is stored as lastSuccessAt and shows `DEGRADED` until a real `COMMAS_API_KEY` exists. Do not invent one.
