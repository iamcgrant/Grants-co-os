/**
 * Shared Next.js App Router helpers. No next/server types required.
 * Handlers call the in-memory MORTGAGE_LOS service (swap for Prisma in grants-co-os).
 */
import { getLosService, toHttpResponse } from "@/lib/los/service";
import { LosHttpError } from "@/lib/los/errors";

export { getLosService, toHttpResponse, LosHttpError };

export async function readJson(request: Request): Promise<any> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function readParams<T>(
  ctx: { params: T | Promise<T> },
): Promise<T> {
  return await ctx.params;
}
