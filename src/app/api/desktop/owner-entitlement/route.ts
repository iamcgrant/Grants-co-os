import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { issueOwnerEntitlement } from "@/lib/desktop/owner-entitlement";

export async function GET() {
  const user = await getCurrentUser();
  const body = await issueOwnerEntitlement(user);
  const status = body.entitled ? 200 : user ? 403 : 401;
  return NextResponse.json(body, { status });
}
