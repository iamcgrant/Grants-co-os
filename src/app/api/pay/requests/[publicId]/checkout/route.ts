import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { recordCommasCheckoutUrl } from "@/lib/payments/payment-requests";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ publicId: string }> },
) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, "MANAGE_PAYMENTS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { publicId } = await ctx.params;
  try {
    const body = (await req.json()) as { url?: string };
    if (!body.url) {
      return NextResponse.json({ error: "Official Commas checkout URL required" }, { status: 400 });
    }
    const result = await recordCommasCheckoutUrl({
      paymentRequestPublicId: publicId,
      url: body.url,
      actorId: user.id,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not record checkout" },
      { status: 400 },
    );
  }
}
