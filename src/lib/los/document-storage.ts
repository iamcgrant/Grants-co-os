import path from "node:path";
import { prisma } from "@/lib/db/prisma";

const MAX_BYTES = 15 * 1024 * 1024;

function isPostgresUrl(url: string): boolean {
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}

/** Base mortgage service package from catalog or env (cents). */
export async function getMortgageServiceBaseCents(): Promise<number> {
  const fromEnv = Number(process.env.MORTGAGE_SERVICE_BASE_CENTS ?? "");
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;

  const service = await prisma.service.findUnique({
    where: { code: "MORTGAGE_LOS" },
    select: { basePriceCents: true },
  });
  if (service && service.basePriceCents > 0) return service.basePriceCents;

  return 75_000;
}

export type StoreDocumentInput = {
  documentId: string;
  bytes: Buffer;
  storageKey: string;
};

/**
 * Persist uploaded document bytes. Postgres/SQLite use DocumentBlob; local dev may use filesystem fallback.
 */
export async function storeDocumentBytes(input: StoreDocumentInput): Promise<void> {
  if (input.bytes.length > MAX_BYTES) {
    throw new Error(`File exceeds ${MAX_BYTES} byte limit`);
  }

  const url = process.env.DATABASE_URL || "";
  const useFs =
    process.env.LOS_DOCUMENT_STORAGE === "local" ||
    (!isPostgresUrl(url) && process.env.LOS_DOCUMENT_STORAGE !== "database");

  if (useFs) {
    const fs = await import("node:fs/promises");
    const root =
      process.env.LOS_DOCUMENT_ROOT ||
      path.join(/* turbopackIgnore: true */ process.cwd(), "data", "los-documents");
    const rel = input.storageKey.replace(/^los\//, "");
    const filePath = path.join(/* turbopackIgnore: true */ root, rel);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, input.bytes);
    return;
  }

  const payload = new Uint8Array(input.bytes);

  await prisma.documentBlob.upsert({
    where: { documentId: input.documentId },
    create: {
      documentId: input.documentId,
      bytes: payload,
    },
    update: {
      bytes: payload,
    },
  });
}

export async function readDocumentBytes(documentId: string, storageKey: string): Promise<Buffer | null> {
  const blob = await prisma.documentBlob.findUnique({ where: { documentId } });
  if (blob) return Buffer.from(blob.bytes);

  const url = process.env.DATABASE_URL || "";
  const useFs =
    process.env.LOS_DOCUMENT_STORAGE === "local" ||
    (!isPostgresUrl(url) && process.env.LOS_DOCUMENT_STORAGE !== "database");

  if (useFs) {
    try {
      const fs = await import("node:fs/promises");
      const root =
        process.env.LOS_DOCUMENT_ROOT ||
        path.join(/* turbopackIgnore: true */ process.cwd(), "data", "los-documents");
      const rel = storageKey.replace(/^los\//, "");
      return await fs.readFile(
        path.join(/* turbopackIgnore: true */ root, rel),
      );
    } catch {
      return null;
    }
  }

  return null;
}
