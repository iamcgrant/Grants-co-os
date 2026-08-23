/** HTTP-shaped errors thrown by LOS domain services (no Prisma). */

export class LosHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly missing?: string[];

  constructor(status: number, code: string, missing?: string[], message?: string) {
    super(message ?? code);
    this.name = "LosHttpError";
    this.status = status;
    this.code = code;
    if (missing) this.missing = missing;
  }

  toJSON() {
    return {
      status: this.status,
      code: this.code,
      missing: this.missing,
      message: this.message,
    };
  }
}

export function toHttpResponse(err: unknown): Response {
  if (err instanceof LosHttpError) {
    return Response.json(
      { code: err.code, missing: err.missing, message: err.message },
      { status: err.status },
    );
  }
  if (err && typeof err === "object" && "status" in err) {
    const e = err as { status: number; code?: string; missing?: string[]; message?: string };
    return Response.json(
      { code: e.code ?? "ERROR", missing: e.missing, message: e.message },
      { status: e.status },
    );
  }
  const message = err instanceof Error ? err.message : "INTERNAL";
  return Response.json({ code: "INTERNAL", message }, { status: 500 });
}
