/**
 * Capability layer — agents call abilities, never share credentials.
 */

import { prisma } from "@/lib/db/prisma";
import { integrationCredentialStatus, isGhlLiveConfigured } from "@/lib/integrations/credentials";
import { isGhlApiReady } from "@/lib/integrations/ghl/http";
import { getGcEnvironment } from "@/lib/integrations/env";
import { authorizeNetCredentialStatus } from "@/lib/payments/authorize-net-config";
import { getBusinessConfiguration } from "./context";
import { scrubSecrets } from "./types";

export async function getSystemHealth() {
  const integrations = await prisma.integrationConnection.findMany({ orderBy: { provider: "asc" } });
  const creds = integrationCredentialStatus();
  return scrubSecrets({
    dataPlane: getGcEnvironment(),
    ghl: {
      liveConfigured: isGhlLiveConfigured(),
      apiReady: isGhlApiReady(),
      portalReady: creds.ghlPortal,
      status: isGhlApiReady() ? "READY" : "AWAITING_INTEGRATION",
    },
    disputeFox: {
      apiReady: creds.disputeFoxApi,
      portalReady: creds.disputeFoxPortal,
      status: creds.disputeFoxApi ? "READY" : "AWAITING_INTEGRATION",
    },
    payments: {
      provider: process.env.PAYMENT_PROVIDER || "mock",
      status: (process.env.PAYMENT_PROVIDER || "mock") === "mock" ? "DEV_MOCK" : "CONFIGURED",
      authorizeNet: authorizeNetCredentialStatus(),
    },
    integrations: integrations.map((i) => ({
      provider: i.provider,
      status: i.status,
      lastSyncAt: i.lastSyncAt,
    })),
  });
}

export async function getClientMapping(grantsClientId: string) {
  const client = await prisma.client.findFirst({
    where: { OR: [{ grantsClientId }, { id: grantsClientId }] },
    include: {
      identifiers: true,
      assignments: {
        include: { staff: { select: { firstName: true, lastName: true, role: true } } },
      },
    },
  });
  if (!client) {
    return { found: false, grantsClientId, message: "Client not found" };
  }
  return scrubSecrets({
    found: true,
    grantsClientId: client.grantsClientId,
    name: `${client.firstName} ${client.lastName}`,
    email: client.email,
    phone: client.phone,
    status: client.status,
    stage: client.stage,
    nextAction: client.nextAction,
    nextActionOwner: client.nextActionOwner,
    identifiers: client.identifiers.map((i) => ({
      provider: i.provider,
      externalId: i.externalId,
      metadata: i.metadataJson ? JSON.parse(i.metadataJson) : null,
    })),
    assignedStaff: client.assignments.map((a) => ({
      name: `${a.staff.firstName} ${a.staff.lastName}`,
      role: a.staff.role,
      roleLabel: a.roleLabel,
    })),
  });
}

export async function getGhlSchema(query?: string) {
  const facts = await getBusinessConfiguration({ category: "MAPPING", query: query || "ghl" });
  const ghlFacts = facts.filter((f) => String(f.key).startsWith("ghl."));
  return scrubSecrets({
    source: "business_facts",
    liveApi: isGhlApiReady() ? "READY" : "AWAITING_INTEGRATION",
    fields: ghlFacts.map((f) => f.value),
    note: "Field catalog from Hub durable mappings. Live inbound contact sync requires GHL_API_KEY (GHL_LOCATION_ID defaults to NsmlbLVNr4SBJNC8gnrn).",
  });
}

export async function getDisputeFoxMapping(query?: string) {
  const facts = await getBusinessConfiguration({
    category: "MAPPING",
    query: query || "disputefox",
  });
  const creds = integrationCredentialStatus();
  return scrubSecrets({
    source: "business_facts",
    mappings: facts,
    inbound: {
      existingMasterRecordsOnly: true,
      requiredEnvName: "DISPUTEFOX_API_KEY",
      failClosedWithoutKey: !creds.disputeFoxApi,
      zapId: "374413762",
      zapEnabled: false,
      inventDfIds: false,
    },
    intake: {
      templateEnv: "DISPUTEFOX_INTAKE_URL_TEMPLATE",
      configured: Boolean(process.env.DISPUTEFOX_INTAKE_URL_TEMPLATE?.trim()),
      status: process.env.DISPUTEFOX_INTAKE_URL_TEMPLATE?.trim()
        ? "CONFIGURED"
        : "AWAITING_INTEGRATION",
    },
  });
}

export async function getPaymentState(input?: { grantsClientId?: string; invoiceNumber?: string }) {
  if (input?.invoiceNumber) {
    const invoice = await prisma.invoice.findUnique({
      where: { invoiceNumber: input.invoiceNumber },
      include: {
        client: { select: { grantsClientId: true, firstName: true, lastName: true } },
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            status: true,
            settlementStatus: true,
            payoutStatus: true,
            amountCents: true,
            provider: true,
            createdAt: true,
          },
        },
      },
    });
    if (!invoice) return { found: false, message: "Invoice not found" };
    return scrubSecrets({
      found: true,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      amountCents: invoice.amountCents,
      client: invoice.client,
      transactions: invoice.transactions,
      provider: process.env.PAYMENT_PROVIDER || "mock",
    });
  }

  if (input?.grantsClientId) {
    const client = await prisma.client.findFirst({
      where: { grantsClientId: input.grantsClientId },
      include: {
        invoices: { orderBy: { createdAt: "desc" }, take: 5 },
        paymentTransactions: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            status: true,
            settlementStatus: true,
            payoutStatus: true,
            amountCents: true,
            createdAt: true,
          },
        },
      },
    });
    if (!client) return { found: false, message: "Client not found" };
    return scrubSecrets({
      found: true,
      grantsClientId: client.grantsClientId,
      invoices: client.invoices.map((i) => ({
        invoiceNumber: i.invoiceNumber,
        status: i.status,
        amountCents: i.amountCents,
      })),
      transactions: client.paymentTransactions,
      provider: process.env.PAYMENT_PROVIDER || "mock",
    });
  }

  return scrubSecrets({
    provider: process.env.PAYMENT_PROVIDER || "mock",
    liveChargesEnabled: process.env.AUTHORIZE_NET_LIVE_CHARGES === "true",
    authorizeNet: authorizeNetCredentialStatus(),
    note: "Provide grantsClientId or invoiceNumber for client-specific payment state.",
  });
}

export async function lookupGhlContactCapability(externalId: string) {
  if (!isGhlApiReady()) {
    return {
      status: "AWAITING_INTEGRATION",
      message: "GHL API not configured (need GHL_API_KEY; GHL_LOCATION_ID defaults to NsmlbLVNr4SBJNC8gnrn)",
      externalId,
    };
  }
  const { getGhlContact } = await import("@/lib/integrations/ghl/http");
  try {
    const contact = await getGhlContact(externalId);
    return scrubSecrets({
      status: "OK",
      contact: {
        id: contact.id,
        email: contact.email,
        phone: contact.phone,
        firstName: contact.firstName,
        lastName: contact.lastName,
        tags: contact.tags,
      },
    });
  } catch (e) {
    return {
      status: "ERROR",
      message: e instanceof Error ? e.message : "GHL lookup failed",
      externalId,
    };
  }
}
