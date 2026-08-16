# Grants Agent Hub

Intelligence / coordination layer under Grants & Co OS.

**Policy:** Charles is the **OWNER APPROVAL LAYER**, not the messenger.  
**Resolve before escalate** — ask another agent, system capability, or Cursor before interrupting the owner.

## First working bridge

1. **Cursor → MCP (`grants-agent-mesh`) → X1 → GHL read-only fact → answer**
2. **X1 → `CODE_CHANGE_REQUIRED` → Cursor Cloud Agents API (or queue for `CURSOR_API_KEY`) → result callback**

## Live bridge verified

2026-08-16 — An X1 `CODE_CHANGE_REQUIRED` task launched this Cursor Cloud Agent as the live bots→Cursor proof.

## Bot connection modes

| Agent | Mode | Why |
|-------|------|-----|
| X1 — Operations | `GRANTS_NATIVE_AGENT` | Legacy specialist chat has no supported public API/webhook/SDK/MCP |
| Payment Processing | `GRANTS_NATIVE_AGENT` | Same — role implemented inside Hub with tools + memory |
| Workflow QA | `GRANTS_NATIVE_AGENT` | Hub-native QA |
| Cursor Engineering | `EXTERNAL_AGENT` | Cursor Cloud Agents API `POST https://api.cursor.com/v1/agents` |

When a future external bot exposes a real API/MCP, add an adapter and flip `mode` to `EXTERNAL_AGENT` without redesigning the Hub.

## MCP setup

`.cursor/mcp.json` registers `grants-agent-mesh`:

```bash
npx tsx agent-mesh/server.ts
```

Tools: `ask_x1`, `ask_payment_processing`, `route_agent_task`, `get_agent_capabilities`, `get_agent_task_status`, `get_business_configuration`, `get_system_health`, `get_client_mapping`, `get_ghl_schema`, `get_disputefox_mapping`, `get_payment_state`, `create_code_change_task`, `report_cursor_result`.

**Never returns** passwords, API keys, tokens, cookies.

## Secrets (server-side only)

| Env | Purpose |
|-----|---------|
| `AGENT_HUB_CURSOR_API_KEY` | Preferred on Cloud Agent VMs. Cursor rejects session env names that start with `CURSOR_`, so a dashboard secret named `CURSOR_API_KEY` often never reaches `process.env`. |
| `CURSOR_API_KEY` | Local/dev alias. Same value. Must be visible to the **running** process. |
| `AGENT_HUB_TOKEN` | Optional bearer for Hub HTTP API |
| `AGENT_HUB_ALLOW_UNAUTH` | Dev-only for local MCP (never production) |
| `AGENT_HUB_SIMULATE_CURSOR` | Dev simulate launch without API key |
| Existing `GHL_*` / payment secrets | Used only inside capabilities |

### Drain after key arrives

```bash
# Probe (never prints the key)
curl -s localhost:3000/api/agent-hub/cursor

# Launch queued CODE_CHANGE_REQUIRED tasks
curl -s -X POST localhost:3000/api/agent-hub/cursor \
  -H 'content-type: application/json' \
  -d '{"action":"drain"}'
```

Or from Agent Control Center (`/agents`): **Probe Cursor key** → **Drain launch queue**.

MCP tools: `probe_cursor_api_key`, `drain_cursor_launch_queue`.

## OS surfaces

- `/agents` — Agent Control Center (active agents, tasks, events, approval cards)
- `/api/agent-hub/*` — ask, tasks, approvals, control-center, health

## Autonomy

| Level | Meaning |
|-------|---------|
| 0 | Autonomous read |
| 1 | Safe work (dev code, QA, metadata prep) |
| 2 | Controlled production (explicit rules) |
| 3 | Charles approval card (money, credentials, destructive, bulk live comms, …) |
