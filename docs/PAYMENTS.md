# Payments — Grants Pay

## Priority

Financial infrastructure is **Priority #1**. Do not connect production processors until explicitly approved. Live charges stay locked behind explicit env flags.

## Provider interface

`PaymentProvider` supports:

- createCustomer, createCheckoutSession, tokenizePaymentMethod
- createPayment, chargePaymentMethod, retrievePayment
- refundPayment, retrieveRefund
- retrieveSettlementStatus, retrievePayout
- verifyWebhook, handleWebhook

Adapters:

| Adapter | Status | Role |
|---------|--------|------|
| MockPaymentProvider | **Active (default)** | Safe simulation |
| AuthorizeNetPaymentProvider | **Sandbox Accept.js wired** (fail-closed without credentials) | **Preferred primary** for proprietary Grants Pay |
| CommasPaymentProvider | Scaffolded | Secondary / MoR / payment_link option |

Set `PAYMENT_PROVIDER=mock|authorize_net|commas`.

Ecrypt and NMI were removed — they were placeholder stubs only and are not used by Grants & Co.

## Why Authorize.Net is preferred primary

Grants Pay needs a proprietary checkout that still feels like Grants & Co, with:

- tokenized card capture (no raw PAN/CVV on our servers)
- invoice-linked charges, refunds, webhooks
- **immediate** post-success continuation into DisputeFox intake

Authorize.Net Accept.js returns a synchronous charge result → OS can redirect immediately.  
Commas is excellent as MoR/hosted `payment_link`, but that flow leaves Grants Pay UI for their hosted page and relies more on `success_url` + webhooks (Commas webhooks are at-most-once, no retry).

## Post-payment → DisputeFox intake

Flow:

1. Payment SUCCEEDED (mock default; Authorize.Net Accept.js sandbox when configured)
2. API returns `continuation.nextUrl` → `/pay/continue/[invoiceNumber]`
3. Bridge page confirms transaction, then opens DisputeFox intake when `DISPUTEFOX_INTAKE_URL_TEMPLATE` is configured

Both processors can support this:

| Processor | Immediate continue | Mechanism |
|-----------|--------------------|-----------|
| Authorize.Net | **Best fit** | Accept.js sync success → redirect; also Accept Hosted continue URL + webhooks |
| Commas | Supported | `success_url` on checkout-session + `payment.succeeded` webhook |

## Safety

- Idempotency keys on charges and refunds
- Unique `(provider, providerTransactionId)`, `(provider, providerEventId)`, `idempotencyKey`
- Invoice status separate from settlement status and payout status
- Never store raw PAN/CVV
- Never put secret keys in browser, GitHub, logs, or screenshots
- Webhook verification + duplicate event protection
- Live charges require `AUTHORIZE_NET_LIVE_CHARGES=true` or `COMMAS_LIVE_CHARGES=true`

## Credentials (sandbox first — do not activate live)

### Authorize.Net (preferred)

| Env var | Where to get it |
|---------|-----------------|
| `AUTHORIZE_NET_SANDBOX_API_LOGIN_ID` | Sandbox Merchant Interface → Account → Settings → Security Settings → **API Credentials & Keys** |
| `AUTHORIZE_NET_SANDBOX_TRANSACTION_KEY` | Same page → New Transaction Key |
| `AUTHORIZE_NET_SANDBOX_CLIENT_KEY` | Account → Settings → Security Settings → **Manage Public Client Key** (browser Accept.js only) |
| `AUTHORIZE_NET_SIGNATURE_KEY` | API Credentials & Keys → New Signature Key (webhooks) |
| `AUTHORIZE_NET_ENVIRONMENT` | `sandbox` (default) or `production` |

Legacy aliases (`AUTHORIZE_NET_API_LOGIN_ID`, `AUTHORIZE_NET_TRANSACTION_KEY`, `AUTHORIZE_NET_PUBLIC_CLIENT_KEY`) still resolve; sandbox-prefixed names win.

Missing sandbox login + transaction key **fails closed** (no processor HTTP, no invented success).  
Then set `PAYMENT_PROVIDER=authorize_net` only when ready to test sandbox.  
Live: also require `AUTHORIZE_NET_LIVE_CHARGES=true` after explicit approval. Do not set that flag until approved.

### Commas

| Env var | Where to get it |
|---------|-----------------|
| `COMMAS_API_KEY` | Commas dashboard → **API Keys** (header `x-api-key`). Scopes needed: `checkout-sessions`, `payments`, `refunds`, `webhooks`, `customers` |
| `COMMAS_WEBHOOK_SECRET` | Returned as `secret_key` when creating a webhook subscription via API |
| `COMMAS_ENVIRONMENT` | `sandbox` → `https://qa.dev-fan-basis.com` · `production` → `https://www.fanbasis.com` |

Then set `PAYMENT_PROVIDER=commas` for sandbox tests.  
Live: also require `COMMAS_LIVE_CHARGES=true` after explicit approval.

### DisputeFox intake handoff

| Env var | Purpose |
|---------|---------|
| `DISPUTEFOX_INTAKE_URL_TEMPLATE` | e.g. `https://app.example/intake/{externalId}?ref={grantsClientId}` |

## Checkout

Proprietary Grants Pay UI at `/pay/[invoiceNumber]`.  
Post-success bridge at `/pay/continue/[invoiceNumber]`.
