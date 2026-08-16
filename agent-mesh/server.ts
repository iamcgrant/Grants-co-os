/**
 * grants-agent-mesh — MCP server for Cursor ⇄ Grants Agent Hub.
 *
 * Configure in .cursor/mcp.json. Tools never return raw secrets.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from "node:path";
import { config } from "dotenv";

// Load repo .env when launched via stdio from Cursor
config({ path: path.resolve(process.cwd(), ".env") });
config({ path: path.resolve(process.cwd(), ".env.local") });

process.env.AGENT_HUB_ALLOW_UNAUTH = process.env.AGENT_HUB_ALLOW_UNAUTH || "true";
process.env.GC_ENV = process.env.GC_ENV || "development";

async function hub() {
  // Dynamic import after env load so prisma picks up DATABASE_URL
  return import("../src/lib/agent-hub/index.js").catch(() =>
    import("../src/lib/agent-hub"),
  );
}

function text(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

const server = new McpServer({
  name: "grants-agent-mesh",
  version: "0.1.0",
});

server.tool(
  "ask_x1",
  "Ask X1 Operations agent (GHL, DisputeFox, workflows, field mappings). Prefer this over interrupting Charles.",
  { question: z.string().describe("Operations / GHL / DisputeFox question") },
  async ({ question }) => {
    const api = await hub();
    const result = await api.routeAndAsk({
      question,
      preferredAgentId: "x1-operations",
      fromRole: "CURSOR",
    });
    return text(result);
  },
);

server.tool(
  "ask_payment_processing",
  "Ask Payment Processing agent about settlement, payouts, invoices, Grants Pay architecture.",
  { question: z.string() },
  async ({ question }) => {
    const api = await hub();
    const result = await api.routeAndAsk({
      question,
      preferredAgentId: "payment-processing",
      fromRole: "CURSOR",
    });
    return text(result);
  },
);

server.tool(
  "route_agent_task",
  "Route a question/task to the best Grants agent automatically.",
  {
    question: z.string(),
    actionCode: z.string().optional().describe("Optional Level-3 action code if applicable"),
  },
  async ({ question, actionCode }) => {
    const api = await hub();
    return text(await api.routeAndAsk({ question, actionCode, fromRole: "CURSOR" }));
  },
);

server.tool(
  "get_agent_capabilities",
  "List Grants agents and their scopes/tools/modes (EXTERNAL vs NATIVE).",
  { agentId: z.string().optional() },
  async ({ agentId }) => {
    const api = await hub();
    return text(await api.getAgentCapabilities(agentId));
  },
);

server.tool(
  "get_agent_task_status",
  "Get Agent Hub task status, transcript, and Cursor launch info.",
  { taskId: z.string() },
  async ({ taskId }) => {
    const api = await hub();
    const task = await api.getTask(taskId);
    return text(task || { error: "Not found" });
  },
);

server.tool(
  "get_business_configuration",
  "Read durable shared business facts (mappings, rules, architecture). Never returns secrets.",
  {
    category: z.string().optional(),
    query: z.string().optional(),
  },
  async ({ category, query }) => {
    const api = await hub();
    return text(await api.getBusinessConfiguration({ category, query }));
  },
);

server.tool(
  "get_system_health",
  "Integration and system health flags (Awaiting Integration when not connected).",
  {},
  async () => {
    const api = await hub();
    return text(await api.getSystemHealth());
  },
);

server.tool(
  "get_client_mapping",
  "Lookup Grants Client master record and external IDs by Grants Client ID.",
  { grantsClientId: z.string() },
  async ({ grantsClientId }) => {
    const api = await hub();
    return text(await api.getClientMapping(grantsClientId));
  },
);

server.tool(
  "get_ghl_schema",
  "GHL field mapping catalog from Agent Hub (read-only).",
  { query: z.string().optional() },
  async ({ query }) => {
    const api = await hub();
    return text(await api.getGhlSchema(query));
  },
);

server.tool(
  "get_disputefox_mapping",
  "DisputeFox mapping and intake configuration status (no secrets).",
  { query: z.string().optional() },
  async ({ query }) => {
    const api = await hub();
    return text(await api.getDisputeFoxMapping(query));
  },
);

server.tool(
  "get_payment_state",
  "Payment/settlement/payout state for a client or invoice.",
  {
    grantsClientId: z.string().optional(),
    invoiceNumber: z.string().optional(),
  },
  async ({ grantsClientId, invoiceNumber }) => {
    const api = await hub();
    return text(await api.getPaymentState({ grantsClientId, invoiceNumber }));
  },
);

server.tool(
  "create_code_change_task",
  "Create CODE_CHANGE_REQUIRED and launch/route Cursor engineering (bots → Cursor).",
  {
    title: z.string(),
    prompt: z.string(),
    ownerAgentId: z.string().optional(),
    idempotencyKey: z.string().optional(),
  },
  async (args) => {
    const api = await hub();
    return text(await api.createCodeChangeAndLaunch(args));
  },
);

server.tool(
  "report_cursor_result",
  "Cursor reports completed/failed engineering work back to Agent Hub.",
  {
    taskId: z.string(),
    status: z.enum(["COMPLETED", "FAILED"]),
    summary: z.string(),
    prUrl: z.string().optional(),
    branch: z.string().optional(),
  },
  async (args) => {
    const api = await hub();
    return text(await api.reportCursorResult(args));
  },
);

server.tool(
  "drain_cursor_launch_queue",
  "Launch all Agent Hub tasks waiting for CURSOR_API_KEY once the key is present.",
  { limit: z.number().int().min(1).max(50).optional() },
  async ({ limit }) => {
    const api = await hub();
    return text(await api.drainAwaitingCursorLaunches(limit));
  },
);

server.tool(
  "probe_cursor_api_key",
  "Check whether CURSOR_API_KEY is present and accepted by api.cursor.com (never returns the key).",
  {},
  async () => {
    const api = await hub();
    return text(await api.probeCursorApiKey());
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Do not write to stdout — MCP uses it. Log to stderr only.
  process.stderr.write("grants-agent-mesh MCP server ready\n");
}

main().catch((err) => {
  process.stderr.write(`grants-agent-mesh failed: ${err}\n`);
  process.exit(1);
});
