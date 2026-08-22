import { handleTaxSession } from "@/lib/tax/desk-api";

export async function POST(req: Request) {
  return handleTaxSession("SBTPG", req);
}
