/**
 * X1 Operations Agent — GRANTS_NATIVE_AGENT.
 * Answers GHL / DisputeFox / workflow questions. Emits CODE_CHANGE_REQUIRED when OS gaps appear.
 */

import { getBusinessConfiguration, rememberAgentFact } from "../context";
import {
  getClientMapping,
  getDisputeFoxMapping,
  getGhlSchema,
  getSystemHealth,
  lookupGhlContactCapability,
} from "../capabilities";
import { appendTranscript, createTask, emitEvent, updateTaskStatus } from "../bus";
import { setAgentStatus } from "../registry";
import { scrubSecrets } from "../types";

export async function askX1(input: {
  question: string;
  taskId?: string;
  fromRole?: "CURSOR" | "AGENT" | "SYSTEM" | "OWNER";
}) {
  await setAgentStatus("x1-operations", "WORKING", input.taskId || null);
  if (input.taskId) {
    await updateTaskStatus(input.taskId, "IN_PROGRESS", { assigneeAgentId: "x1-operations" });
    await appendTranscript({
      taskId: input.taskId,
      agentId: "x1-operations",
      role: input.fromRole || "CURSOR",
      body: input.question,
    });
  }

  const q = input.question.toLowerCase();
  let answer: Record<string, unknown> = {};
  let confidence = "high";

  try {
    if (/dispute\s*fox.*id|field.*dispute|which ghl field.*dispute/i.test(input.question)) {
      const facts = await getBusinessConfiguration({
        query: "disputefox_client_id",
      });
      const mapping =
        facts[0]?.value ||
        ((await getGhlSchema("disputefox")).fields[0] as Record<string, unknown> | undefined);
      answer = {
        question: input.question,
        answer: "The GHL custom field for DisputeFox Client ID is `disputefox_client_id` (label: DisputeFox Client ID). It maps to ClientIdentifier provider DISPUTEFOX.",
        mapping,
        source: "business_facts",
      };
    } else if (/weekly score week|week id/i.test(input.question)) {
      const facts = await getBusinessConfiguration({ query: "weekly_score_week_id" });
      answer = {
        question: input.question,
        answer:
          "GHL custom field key `weekly_score_week_id`. Overwrite each Friday only after previous/current score preservation completes.",
        mapping: facts[0]?.value,
        source: "business_facts",
      };
    } else if (/intake status/i.test(input.question)) {
      const facts = await getBusinessConfiguration({ query: "intake_status" });
      const mapping = facts[0]?.value as Record<string, unknown> | undefined;
      const osComplete = mapping?.osStatus === "COMPLETE";
      answer = {
        question: input.question,
        answer: osComplete
          ? "GHL field key `intake_status` maps to Client.stage. Client 360 Identity panel surfaces Intake Status (Awaiting Integration for live GHL field sync when API not connected)."
          : "GHL field key `intake_status` maps toward Client.stage / onboarding. OS coverage is PARTIAL.",
        mapping,
        gap: mapping?.gap ?? null,
        source: "business_facts",
      };

      if (!osComplete) {
        answer.recommendation =
          "Emit CODE_CHANGE_REQUIRED if Cursor should add Intake Status to Client 360.";
        const codeTask = await createTask({
          type: "CODE_CHANGE_REQUIRED",
          eventKind: "CODE_CHANGE_REQUIRED",
          title: "Add Intake Status mapping to Client 360",
          prompt: [
            "Add Intake Status mapping to Client 360.",
            "Use GHL field key `intake_status` from Agent Hub business fact `ghl.field.intake_status`.",
            "Surface on Client 360 identity/integrations panel.",
            "Show Awaiting Integration when GHL not connected.",
            "Development/test scope. No live client communication. No destructive production actions.",
          ].join("\n"),
          ownerAgentId: "x1-operations",
          assigneeAgentId: "cursor-engineering",
          parentTaskId: input.taskId,
          autonomyLevel: 1,
          idempotencyKey: `code:intake-status-client-360`,
          metadata: { fieldKey: "intake_status", requestedBy: "x1-operations" },
        });
        answer.codeChangeTaskId = codeTask.id;
        await emitEvent({
          kind: "CODE_CHANGE_REQUIRED",
          taskId: codeTask.id,
          agentId: "x1-operations",
          payload: { title: codeTask.title },
        });
      }
    } else if (/grants client id|gc-\d+/i.test(input.question) && /map|ghl|field/i.test(q)) {
      const facts = await getBusinessConfiguration({ query: "grants_client_id" });
      answer = {
        question: input.question,
        answer: "GHL field `grants_client_id` maps to Client.grantsClientId. OS is source of truth.",
        mapping: facts[0]?.value,
      };
    } else if (/system health|integration/i.test(q)) {
      answer = { question: input.question, health: await getSystemHealth() };
    } else if (/client mapping|lookup client|gc-/i.test(q)) {
      const match = input.question.match(/GC-\d{6}/i);
      if (match) {
        answer = {
          question: input.question,
          mapping: await getClientMapping(match[0].toUpperCase()),
        };
      } else {
        answer = {
          question: input.question,
          message: "Provide a Grants Client ID (GC-######) for client mapping lookup.",
          schema: await getGhlSchema(),
        };
        confidence = "medium";
      }
    } else if (/ghl contact|lookup contact/i.test(q)) {
      const idMatch = input.question.match(/[a-zA-Z0-9]{10,}/);
      if (idMatch) {
        answer = {
          question: input.question,
          contact: await lookupGhlContactCapability(idMatch[0]),
        };
      } else {
        answer = {
          question: input.question,
          ghlSchema: await getGhlSchema(),
          disputeFox: await getDisputeFoxMapping(),
        };
      }
    } else {
      // General ops lookup across facts + schema
      const facts = await getBusinessConfiguration({ query: input.question.slice(0, 80) });
      answer = {
        question: input.question,
        answer:
          facts.length > 0
            ? "Matched durable business context."
            : "No exact fact match. Returning related configuration for Cursor to continue without owner relay.",
        facts: facts.slice(0, 8),
        ghlSchema: await getGhlSchema(input.question),
        disputeFox: await getDisputeFoxMapping(),
        health: await getSystemHealth(),
      };
      confidence = facts.length ? "high" : "medium";
    }

    await rememberAgentFact({
      agentId: "x1-operations",
      key: `last_answer:${Date.now()}`,
      value: { question: input.question, confidence },
      kind: "EPISODE",
      durable: false,
    });

    const body = typeof answer.answer === "string" ? answer.answer : JSON.stringify(scrubSecrets(answer));
    if (input.taskId) {
      await appendTranscript({
        taskId: input.taskId,
        agentId: "x1-operations",
        role: "AGENT",
        body,
        metadata: { confidence },
      });
      await updateTaskStatus(input.taskId, "COMPLETED", {
        result: scrubSecrets({ ...answer, confidence }),
      });
    }

    await setAgentStatus("x1-operations", "IDLE", null);
    return scrubSecrets({ agentId: "x1-operations", confidence, ...answer });
  } catch (e) {
    await setAgentStatus("x1-operations", "ERROR", input.taskId || null);
    if (input.taskId) {
      await updateTaskStatus(input.taskId, "FAILED", {
        errorMessage: e instanceof Error ? e.message : "X1 failed",
      });
    }
    throw e;
  }
}
