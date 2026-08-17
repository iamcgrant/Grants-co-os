import { prisma } from "@/lib/db/prisma";
import { MASTER_ONBOARDING_ITEMS } from "./onboarding";

/** Ensure the canonical master onboarding checklist exists (idempotent). */
export async function ensureMasterOnboarding(clientId: string) {
  const existing = await prisma.onboardingItem.findMany({
    where: { clientId },
    select: { key: true },
  });
  const have = new Set(existing.map((e) => e.key));
  const missing = MASTER_ONBOARDING_ITEMS.filter((i) => !have.has(i.key));
  if (!missing.length) return { created: 0 };

  await prisma.onboardingItem.createMany({
    data: missing.map((item) => ({
      clientId,
      key: item.key,
      label: item.label,
      status: "MISSING",
    })),
  });

  return { created: missing.length };
}
