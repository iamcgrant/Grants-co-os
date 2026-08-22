import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { listRecordedCommasCheckoutUrls } from "@/lib/payments/payment-requests";
import { COMMAS_PRODUCTS, officialProductCheckoutUrl } from "@/lib/payments/commas-catalog";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "MANAGE_PAYMENTS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const urls = await listRecordedCommasCheckoutUrls();
  const products = COMMAS_PRODUCTS.map((product) => ({
    ...product,
    officialCheckoutUrl: officialProductCheckoutUrl(product.id, urls[0] || null),
  }));
  return NextResponse.json({ urls, products });
}
