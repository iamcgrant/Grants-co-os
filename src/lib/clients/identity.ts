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

/** Lowercased first+last. Name alone is never a match key. */
export function normalizePersonName(
  firstName?: string | null,
  lastName?: string | null,
): string | null {
  const first = (firstName || "").trim().toLowerCase().replace(/\s+/g, " ");
  const last = (lastName || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!first && !last) return null;
  return `${first} ${last}`.trim();
}

export function normalizePostalCode(postalCode?: string | null): string | null {
  if (!postalCode) return null;
  const compact = postalCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return compact || null;
}

export type AddressParts = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
};

/**
 * Corroborating address key. Requires line1 + postal code.
 * Used only with a matching person name — never as a standalone identity.
 */
export function normalizeAddressKey(address?: AddressParts | null): string | null {
  if (!address) return null;
  const line1 = (address.line1 || "").trim().toLowerCase().replace(/\s+/g, " ");
  const city = (address.city || "").trim().toLowerCase().replace(/\s+/g, " ");
  const state = (address.state || "").trim().toLowerCase().replace(/\s+/g, " ");
  const postal = normalizePostalCode(address.postalCode);
  if (!line1 || !postal) return null;
  return `${line1}|${city}|${state}|${postal}`;
}
