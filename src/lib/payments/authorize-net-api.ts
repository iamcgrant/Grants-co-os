/**
 * Authorize.Net Accept.js + createTransactionRequest helpers.
 * Financial success is recorded only after a confirmed processor response.
 */

import type { CreatePaymentInput, CreatePaymentResult } from "./types";
import {
  AUTHORIZE_NET_PRODUCTION_ENDPOINT,
  AUTHORIZE_NET_SANDBOX_ENDPOINT,
  type AuthorizeNetSandboxConfig,
} from "./authorize-net-config";

export const ACCEPT_JS_CARD_DESCRIPTOR = "COMMON.ACCEPT.INAPP.PAYMENT";

export type AcceptJsOpaqueData = {
  dataDescriptor: string;
  dataValue: string;
};

export type AuthorizeNetHttp = (
  url: string,
  init: RequestInit,
) => Promise<Response>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.map((item) => asRecord(item));
  }
  return [asRecord(value)];
}

export function stripAuthorizeNetBom(raw: string): string {
  if (!raw) return raw;
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
}

export function parseAcceptJsOpaqueData(paymentToken: string): AcceptJsOpaqueData {
  const trimmed = paymentToken.trim();
  if (!trimmed) {
    throw new Error("Accept.js opaqueData is required. Never send raw PAN/CVV.");
  }

  if (trimmed.startsWith("{")) {
    const parsed = asRecord(JSON.parse(trimmed) as unknown);
    const nested = asRecord(parsed.opaqueData);
    const dataDescriptor = String(
      parsed.dataDescriptor ||
        parsed.descriptor ||
        nested.dataDescriptor ||
        nested.descriptor ||
        "",
    ).trim();
    const dataValue = String(
      parsed.dataValue || parsed.value || nested.dataValue || nested.value || "",
    ).trim();
    if (!dataDescriptor || !dataValue) {
      throw new Error("Accept.js opaqueData is incomplete.");
    }
    return { dataDescriptor, dataValue };
  }

  const pipe = trimmed.indexOf("|");
  if (pipe > 0) {
    const dataDescriptor = trimmed.slice(0, pipe).trim();
    const dataValue = trimmed.slice(pipe + 1).trim();
    if (!dataDescriptor || !dataValue) {
      throw new Error("Accept.js opaqueData is incomplete.");
    }
    return { dataDescriptor, dataValue };
  }

  return {
    dataDescriptor: ACCEPT_JS_CARD_DESCRIPTOR,
    dataValue: trimmed,
  };
}

export function centsToAuthorizeNetAmount(amountCents: number): string {
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error("Charge amount must be a positive integer in cents.");
  }
  return (amountCents / 100).toFixed(2);
}

export function buildCreateTransactionRequest(
  config: AuthorizeNetSandboxConfig,
  input: CreatePaymentInput,
  opaque: AcceptJsOpaqueData,
) {
  const refId = input.idempotencyKey.replace(/[^A-Za-z0-9]/g, "").slice(0, 20);
  return {
    createTransactionRequest: {
      merchantAuthentication: {
        name: config.apiLoginId,
        transactionKey: config.transactionKey,
      },
      ...(refId ? { refId } : {}),
      transactionRequest: {
        transactionType: "authCaptureTransaction",
        amount: centsToAuthorizeNetAmount(input.amountCents),
        payment: {
          opaqueData: {
            dataDescriptor: opaque.dataDescriptor,
            dataValue: opaque.dataValue,
          },
        },
        order: {
          invoiceNumber: input.metadata?.invoiceNumber?.slice(0, 20),
          description: input.metadata?.grantsClientId
            ? `Grants Client ${input.metadata.grantsClientId}`
            : undefined,
        },
      },
    },
  };
}

function firstMessageText(container: Record<string, unknown>): string | undefined {
  const messages = asRecord(container.messages);
  const list = asRecordArray(messages.message);
  const text = list
    .map((m) => String(m.text || m.description || "").trim())
    .filter(Boolean)
    .join(" ");
  if (text) return text;
  const errorText = asRecordArray(container.errors)
    .map((e) => String(e.errorText || e.text || "").trim())
    .filter(Boolean)
    .join(" ");
  return errorText || undefined;
}

function firstMessageCode(container: Record<string, unknown>): string | undefined {
  const messages = asRecord(container.messages);
  const code = asRecordArray(messages.message)
    .map((m) => String(m.code || "").trim())
    .find(Boolean);
  if (code) return code;
  return asRecordArray(container.errors)
    .map((e) => String(e.errorCode || e.code || "").trim())
    .find(Boolean);
}

/**
 * Map a createTransactionRequest body to Grants Pay status.
 * SUCCEEDED requires result confirmation + responseCode 1 + transId.
 * Does not invent settlement, payout, or refund state.
 */
export function parseCreateTransactionResponse(raw: string): CreatePaymentResult {
  let payload: Record<string, unknown>;
  try {
    payload = asRecord(JSON.parse(stripAuthorizeNetBom(raw)) as unknown);
  } catch {
    return {
      providerTransactionId: "",
      status: "FAILED",
      failureCode: "invalid_processor_response",
      failureMessage: "Authorize.Net returned a non-JSON response.",
    };
  }

  const topMessages = asRecord(payload.messages);
  const resultCode = String(topMessages.resultCode || "").trim();
  const txn = asRecord(payload.transactionResponse);
  const responseCode = String(txn.responseCode ?? "").trim();
  const transId = String(txn.transId ?? "").trim();
  const failureMessage =
    firstMessageText(txn) || firstMessageText(payload) || "Authorize.Net did not approve the charge.";
  const failureCode =
    firstMessageCode(txn) || firstMessageCode(payload) || "processor_error";

  if (resultCode === "Ok" && responseCode === "1") {
    if (!transId) {
      return {
        providerTransactionId: "",
        status: "FAILED",
        failureCode: "missing_processor_transaction_id",
        failureMessage: "Processor did not confirm a transaction id.",
      };
    }
    return {
      providerTransactionId: transId,
      status: "SUCCEEDED",
    };
  }

  if (resultCode === "Ok" && responseCode === "4" && transId) {
    return {
      providerTransactionId: transId,
      status: "PENDING",
      failureCode: failureCode,
      failureMessage: failureMessage,
    };
  }

  return {
    providerTransactionId: transId || `anet_unconfirmed_${Date.now()}`,
    status: "FAILED",
    failureCode,
    failureMessage,
  };
}

export function assertSandboxEndpoint(url: string): void {
  if (url === AUTHORIZE_NET_PRODUCTION_ENDPOINT || url !== AUTHORIZE_NET_SANDBOX_ENDPOINT) {
    throw new Error(
      "Authorize.Net sandbox charges may only use the sandbox endpoint. Production is locked.",
    );
  }
}

export async function postAuthorizeNetSandbox(
  http: AuthorizeNetHttp,
  config: AuthorizeNetSandboxConfig,
  body: unknown,
): Promise<string> {
  assertSandboxEndpoint(config.endpoint);
  const response = await http(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Authorize.Net sandbox request failed with HTTP ${response.status}.`,
    );
  }
  return text;
}
