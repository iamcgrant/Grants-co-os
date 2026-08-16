import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const dbPath = (process.env.DATABASE_URL || "file:./prisma/dev.db").replace(/^file:/, "");
  const abs = path.isAbsolute(dbPath)
    ? dbPath
    : path.join(process.cwd(), dbPath.replace(/^\.\//, ""));
  const prisma = new PrismaClient({
    adapter: new PrismaBetterSqlite3({ url: `file:${abs}` }),
  });

  const ids = await prisma.clientIdentifier.findMany({
    where: { provider: { in: ["GHL", "DISPUTEFOX", "PAYMENT"] } },
  });
  for (const id of ids) {
    if (id.metadataJson && id.metadataJson.includes("ghl_api")) continue;
    await prisma.clientIdentifier.update({
      where: { id: id.id },
      data: {
        metadataJson: JSON.stringify({ source: "seed", dataPlane: "development" }),
      },
    });
  }
  await prisma.integrationConnection.updateMany({
    where: { provider: "gohighlevel", status: "MOCK" },
    data: { status: "AWAITING_CREDENTIALS", lastSyncAt: null },
  });
  await prisma.integrationConnection.updateMany({
    where: { provider: "disputefox", status: "MOCK" },
    data: { status: "AWAITING_CREDENTIALS", lastSyncAt: null },
  });
  console.log("updated identifiers", ids.length);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
