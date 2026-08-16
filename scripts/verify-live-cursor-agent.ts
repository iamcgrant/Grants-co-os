/**
 * Confirm a launched Cursor agent via GET /v1/agents/:id. Never prints secrets.
 */
import { config } from "dotenv";
config();
process.env.GC_ENV = process.env.GC_ENV || "development";

async function main() {
  const agentId = process.argv[2];
  if (!agentId) {
    console.error("usage: tsx scripts/verify-live-cursor-agent.ts <cursorAgentId>");
    process.exit(2);
  }
  const { getCursorAgentStatus, prisma } = await import("../src/lib/agent-hub").then(async (hub) => {
    const { prisma } = await import("../src/lib/db/prisma");
    return { ...hub, prisma };
  });

  const status = await getCursorAgentStatus(agentId);
  const awaiting = await prisma.agentTask.count({ where: { status: "AWAITING_CURSOR_API_KEY" } });
  const waiting = await prisma.agentTask.findMany({
    where: { status: "WAITING_CURSOR" },
    select: { id: true, title: true, cursorAgentId: true, cursorUrl: true, cursorRunId: true },
  });
  console.log(
    JSON.stringify(
      {
        leftover_awaiting: awaiting,
        waiting_cursor: waiting,
        api_lookup: {
          ready: status.ready,
          ok: "ok" in status ? status.ok : null,
          httpStatus: "status" in status ? status.status : null,
          agentId:
            status && typeof status === "object" && "agent" in status
              ? (status.agent as { id?: string; url?: string; status?: string; name?: string })?.id
              : null,
          agentUrl:
            status && typeof status === "object" && "agent" in status
              ? (status.agent as { url?: string })?.url
              : null,
          agentStatus:
            status && typeof status === "object" && "agent" in status
              ? (status.agent as { status?: string; name?: string })?.status
              : null,
          agentName:
            status && typeof status === "object" && "agent" in status
              ? (status.agent as { name?: string })?.name
              : null,
        },
      },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
