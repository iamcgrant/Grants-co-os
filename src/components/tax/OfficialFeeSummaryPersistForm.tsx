import { SbtpgFeeSummaryIngestForm } from "@/components/tax/SbtpgFeeSummaryIngestForm";

/** Command Center persist-after-return. Copy stays generic — no portal name, no taxpayer counts. */
export function OfficialFeeSummaryPersistForm() {
  return (
    <SbtpgFeeSummaryIngestForm
      heading="Persist official Fee Summary"
      description="After you update revenue in the official portal, persist the official PAID and UNFUNDED season-to-date totals. Today and this week stay blank unless official dated splits exist. No scrape."
      successMessage="Official Fee Summary PAID is persisted. Total Revenue reads that snapshot."
    />
  );
}
