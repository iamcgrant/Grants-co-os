import { handleTaxAttach } from "@/lib/tax/desk-api";

export async function POST(req: Request) {
  return handleTaxAttach("SBTPG", req);
}
