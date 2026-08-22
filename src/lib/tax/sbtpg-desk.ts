/**
 * Native SBTPG desk read path. Official Fee Summary snapshot wins. No scrape.
 */

import { listTaxDeskBoard } from "@/lib/tax/desk";
import { getLatestOfficialFeeSummary } from "@/lib/tax/official-fee-summary";
import { listSbtpgPayouts } from "@/lib/tax/payouts";
import { sbtpgDeskTotals } from "@/lib/tax/fee-summary-mapping";

export async function loadSbtpgDesk() {
  const [official, payouts, board] = await Promise.all([
    getLatestOfficialFeeSummary(),
    listSbtpgPayouts(),
    listTaxDeskBoard("SBTPG"),
  ]);
  return {
    official,
    payouts,
    board,
    totals: sbtpgDeskTotals(official, payouts, board),
  };
}
