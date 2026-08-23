/**
 * Shared Next.js App Router helpers. No next/server types required.
 */
import { getLosService, toHttpResponse } from "@/lib/los/service";
import { LosHttpError } from "@/lib/los/errors";
import type { PrismaMortgageLosService } from "@/lib/los/prisma-service";
import type { MortgageLosService } from "@/lib/los/service";

export { getLosService, toHttpResponse, LosHttpError };

export type LosServiceInstance = MortgageLosService | PrismaMortgageLosService;

export async function callLos<T>(
  fn: (los: LosServiceInstance) => T | Promise<T>,
): Promise<T> {
  return await fn(getLosService());
}

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
