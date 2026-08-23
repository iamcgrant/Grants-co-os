/**
 * Internal file numbers via IdSequence. Format GC-LN-######.
 * NOT an NMLS id. Do not invent NMLS numbers.
 */

const PREFIX = "GC-LN-";
const WIDTH = 6;

export function formatLoanNumber(seq: number): string {
  if (!Number.isInteger(seq) || seq < 0) {
    throw new Error("loan sequence must be a non-negative integer");
  }
  return `${PREFIX}${String(seq).padStart(WIDTH, "0")}`;
}

/** Parse `GC-LN-000001` (or a bare integer string) to the sequence integer. */
export function parseLoanNumber(value: string | number): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : null;
  }
  const trimmed = value.trim();
  const prefixed = new RegExp(`^${PREFIX}(\\d{${WIDTH}})$`).exec(trimmed);
  if (prefixed) return Number.parseInt(prefixed[1], 10);
  if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  return null;
}

/** Next sequence after the last integer (or last formatted loan number). */
export function nextSequence(last: number | string | null | undefined): number {
  if (last == null || last === "") return 1;
  const n = typeof last === "number" ? last : parseLoanNumber(last);
  if (n == null || !Number.isFinite(n)) return 1;
  return n + 1;
}
