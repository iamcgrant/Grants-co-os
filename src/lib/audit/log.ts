import { prisma } from "@/lib/db/prisma";

export async function writeAuditLog(input: {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}) {
  // Never log secrets — strip sensitive keys
  const safeMeta = input.metadata
    ? sanitizeMetadata(input.metadata)
    : undefined;

  return prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadataJson: safeMeta ? JSON.stringify(safeMeta) : null,
      ipAddress: input.ipAddress,
    },
  });
}

const SENSITIVE_KEYS = [
  "password",
  "passwordHash",
  "cvv",
  "pan",
  "cardNumber",
  "secret",
  "apiKey",
  "token",
  "mfaSecret",
  "credentialRef",
];

function sanitizeMetadata(
  meta: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s.toLowerCase()))) {
      out[k] = "[REDACTED]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = sanitizeMetadata(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}
