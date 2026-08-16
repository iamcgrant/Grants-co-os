/**
 * Import Charles-confirmed active Grants master clients (recon 2026-08-15).
 *
 * Local OS writes only. Does not call GHL. Does not invent GHL ids.
 * Does not send SMS/email. Prints counts only (no contact PII, no secrets).
 *
 *   npx tsx scripts/import-confirmed-masters.ts
 */
import "dotenv/config";
import { importConfirmedMasters } from "../src/lib/clients/import-confirmed-masters";
import { CONFIRMED_MASTER_TAG } from "../src/lib/clients/confirmed-masters";

async function main() {
  const result = await importConfirmedMasters();
  console.log(
    JSON.stringify(
      {
        tag: CONFIRMED_MASTER_TAG,
        ghlWrites: false,
        messagesSent: false,
        inventedGhlIds: false,
        ...result,
      },
      null,
      2,
    ),
  );
}

main().catch(() => {
  console.log(JSON.stringify({ error: "import_failed" }));
  process.exit(1);
});
