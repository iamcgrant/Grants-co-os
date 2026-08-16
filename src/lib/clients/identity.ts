import { prisma } from "@/lib/db/prisma";

/**
 * Grants Master Client ID — permanent internal identity.
 * Format: GC-000001
 */
export async function nextGrantsClientId(): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const seq = await tx.idSequence.upsert({
      where: { name: "grants_client" },
      create: { name: "grants_client", value: 1 },
      update: { value: { increment: 1 } },
    });
    return `GC-${String(seq.value).padStart(6, "0")}`;
  });
}

export async function nextInvoiceNumber(): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const seq = await tx.idSequence.upsert({
      where: { name: "invoice" },
      create: { name: "invoice", value: 1000 },
      update: { value: { increment: 1 } },
    });
    return `GC-${seq.value}`;
  });
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}
