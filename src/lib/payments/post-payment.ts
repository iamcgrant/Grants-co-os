/**
 * Post-payment continuation — PAYMENT SUCCESS → DisputeFox intake.
 *
 * Processor-agnostic: triggered after Grants Pay records a SUCCEEDED transaction.
 * Does NOT depend on Ecrypt/NMI. Works with mock now; Authorize.Net / Commas later.
 */

export type PostPaymentContinuation = {
  clientId: string;
  grantsClientId: string;
  invoiceId: string;
  invoiceNumber: string;
  transactionId: string;
  nextUrl: string;
  intakeProvider: "disputefox";
};

/**
 * Build the next-step URL after successful payment.
 * Prefer an internal Grants & Co bridge page that then hands off to DisputeFox,
 * so the OS remains the source of truth and external URLs stay configurable.
 */
export function buildPostPaymentContinuation(input: {
  clientId: string;
  grantsClientId: string;
  invoiceId: string;
  invoiceNumber: string;
  transactionId: string;
  appBaseUrl?: string;
}): PostPaymentContinuation {
  const base = (input.appBaseUrl || process.env.NEXT_PUBLIC_APP_URL || "").replace(
    /\/$/,
    "",
  );
  const path = `/pay/continue/${input.invoiceNumber}?txn=${encodeURIComponent(input.transactionId)}`;

  return {
    clientId: input.clientId,
    grantsClientId: input.grantsClientId,
    invoiceId: input.invoiceId,
    invoiceNumber: input.invoiceNumber,
    transactionId: input.transactionId,
    nextUrl: base ? `${base}${path}` : path,
    intakeProvider: "disputefox",
  };
}

/**
 * Resolve DisputeFox intake URL for a Grants client.
 * External ID must already be attached to the master client — never invent one.
 */
export function resolveDisputeFoxIntakeUrl(input: {
  externalDisputeFoxId?: string | null;
  grantsClientId: string;
}): string | null {
  const template = process.env.DISPUTEFOX_INTAKE_URL_TEMPLATE;
  // Example template: https://app.disputefox.example/intake/{externalId}?ref={grantsClientId}
  if (!template) {
    return null;
  }
  if (!input.externalDisputeFoxId) {
    return null;
  }
  return template
    .replaceAll("{externalId}", encodeURIComponent(input.externalDisputeFoxId))
    .replaceAll("{grantsClientId}", encodeURIComponent(input.grantsClientId));
}
