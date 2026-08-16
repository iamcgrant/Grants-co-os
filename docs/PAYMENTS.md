# Payments — Grants Pay

## Priority

Financial infrastructure is **Priority #1**. Do not connect production processors until explicitly approved.

## Provider interface

`PaymentProvider` supports:

- createCustomer, createCheckoutSession, tokenizePaymentMethod
- createPayment, chargePaymentMethod, retrievePayment
- refundPayment, retrieveRefund
- retrieveSettlementStatus, retrievePayout
- verifyWebhook, handleWebhook

Adapters:

| Adapter | Status |
|---------|--------|
| MockPaymentProvider | Active (default) |
| EcryptPaymentProvider | Stub — needs credentials |
| NmiPaymentProvider | Stub — needs credentials |

Set `PAYMENT_PROVIDER=mock|ecrypt|nmi`.

## Safety

- Idempotency keys on charges and refunds
- Unique `(provider, providerTransactionId)`, `(provider, providerEventId)`, `idempotencyKey`
- Invoice status separate from settlement status and payout status
- Never store raw PAN/CVV
- Webhook verification + duplicate event protection

## Checkout

Proprietary Grants Pay UI at `/pay/[invoiceNumber]`. Clients should feel payment occurs inside Grants & Co.

## Credentials required later

**Ecrypt**

1. Ecrypt Dashboard → Developers → API Credentials
2. Copy API Key + Secret
3. Set `ECRYPT_API_KEY`, `ECRYPT_API_SECRET`, `PAYMENT_PROVIDER=ecrypt`

**NMI**

1. NMI portal → Security keys
2. Set `NMI_SECURITY_KEY`, `PAYMENT_PROVIDER=nmi`
