import { latestTaxDeskRecordedAt } from "@/lib/tax/desk";
import { taxDeskCatalog, type TaxDesk } from "@/lib/tax/catalog";

export type TaxDeskHealthStatus = "CONNECTED" | "DEGRADED" | "ACTION_REQUIRED" | "OFFLINE";

export type TaxDeskHealthResult = {
  status: TaxDeskHealthStatus;
  detail: string;
  lastSuccessAt: string | null;
  probed: boolean;
};

function isoOrNull(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

/**
 * Honest no-API tax desk health.
 * CONNECTED only after a recorded OS operation. Portal / key presence is never CONNECTED.
 */
export async function probeTaxDeskHealth(desk: TaxDesk): Promise<TaxDeskHealthResult> {
  const catalog = taxDeskCatalog(desk);
  const lastRecorded = await latestTaxDeskRecordedAt(desk);
  const lastSuccessAt = isoOrNull(lastRecorded);

  if (lastRecorded) {
    return {
      status: "CONNECTED",
      detail: `Recorded ${catalog.label} workspace operation · no supported list API`,
      lastSuccessAt,
      probed: false,
    };
  }

  return {
    status: "ACTION_REQUIRED",
    detail: `ACTION_REQUIRED: ${catalog.label} has no recorded OS operation yet. Attach a client or record an official payout/session. Official portal is last-step only · no scrape.`,
    lastSuccessAt: null,
    probed: false,
  };
}

export function probeCloudTaxOfficeHealth() {
  return probeTaxDeskHealth("CLOUD_TAX_OFFICE");
}

export function probeSbtpgHealth() {
  return probeTaxDeskHealth("SBTPG");
}
