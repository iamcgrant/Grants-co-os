export const PRODUCTION_SQLITE_REFUSAL =
  "DATABASE_URL is not postgresql:// on Vercel — SQLite cannot run here";

export const LOGIN_DATABASE_UNAVAILABLE_MESSAGE =
  "Sign-in is unavailable: this Vercel deployment is not connected to Postgres. Set Production DATABASE_URL to the Neon postgresql:// URL on the live project, then redeploy.";

export const PRODUCTION_DATABASE_ERROR_CODE = "PRODUCTION_DATABASE_NOT_CONFIGURED" as const;

export function isProductionPostgresUrl(url = process.env.DATABASE_URL || ""): boolean {
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}

export function isVercelServerlessRuntime(): boolean {
  return process.env.VERCEL === "1";
}

export class ProductionDatabaseNotConfigured extends Error {
  readonly code = PRODUCTION_DATABASE_ERROR_CODE;

  constructor(message = PRODUCTION_SQLITE_REFUSAL) {
    super(message);
    this.name = "ProductionDatabaseNotConfigured";
  }
}

export function isProductionDatabaseNotConfigured(
  error: unknown,
): error is ProductionDatabaseNotConfigured {
  return error instanceof ProductionDatabaseNotConfigured;
}

/**
 * Vercel serverless cannot load better-sqlite3 (`/var/task` native addon).
 * Returns a non-secret reason when this process must not construct Prisma/SQLite.
 */
export function getProductionDatabaseRefusal(): string | null {
  if (!isVercelServerlessRuntime()) return null;
  if (isProductionPostgresUrl()) return null;
  return PRODUCTION_SQLITE_REFUSAL;
}

export function productionDatabaseErrorBody(): {
  error: string;
  code: typeof PRODUCTION_DATABASE_ERROR_CODE;
  databaseReason: string | null;
} {
  return {
    error: LOGIN_DATABASE_UNAVAILABLE_MESSAGE,
    code: PRODUCTION_DATABASE_ERROR_CODE,
    databaseReason: getProductionDatabaseRefusal(),
  };
}
