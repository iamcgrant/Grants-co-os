/**
 * Payment Processing Agent — GRANTS_NATIVE_AGENT.
 */

import { getPaymentState, getSystemHealth } from "../capabilities";
import { getBusinessConfiguration } from "../context";
import { appendTranscript, updateTaskStatus } from "../bus";
import { setAgentStatus } from "../registry";
import { scrubSecrets } from "../types";

export async function askPaymentProcessing(input: {
  question: string;
  taskId?: string;
  grantsClientId?: string;
  invoiceNumber?: string;
}) {
  await setAgentStatus("payment-processing", "WORKING", input.taskId || null);
  if (input.taskId) {
    await updateTaskStatus(input.taskId, "IN_PROGRESS", { assigneeAgentId: "payment-processing" });
    await appendTranscript({
      taskId: input.taskId,
      agentId: "payment-processing",
      role: "CURSOR",
      body: input.question,
    });
  }

  const q = input.question.toLowerCase();
  const invoiceMatch = input.invoiceNumber || input.question.match(/GC-\d{4,}/)?.[0];
  const clientMatch = input.grantsClientId || input.question.match(/GC-\d{6}/)?.[0];

  let answer: Record<string, unknown>;
  if (/settled|settlement|payout|payment state|has this payment/i.test(q) || invoiceMatch || clientMatch) {
    const state = await getPaymentState({
      invoiceNumber: invoiceMatch && invoiceMatch.length < 12 ? invoiceMatch : undefined,
      grantsClientId: clientMatch && clientMatch.length >= 9 ? clientMatch : undefined,
    });
    answer = {
      question: input.question,
      answer:
        "Payment state retrieved. Remember: authorization success ≠ settlement ≠ payout deposited.",
      state,
      architecture: {
        preferredPrimary: "Authorize.Net",
        secondary: "Commas",
        mockActiveInDev: (process.env.PAYMENT_PROVIDER || "mock") === "mock",
      },
    };
  } else {
    answer = {
      question: input.question,
      health: await getSystemHealth(),
      rules: await getBusinessConfiguration({ category: "RULE" }),
      note: "Ask about a specific invoice (e.g. GC-1051) or Grants Client ID for ledger state.",
    };
  }

  const body = typeof answer.answer === "string" ? answer.answer : JSON.stringify(scrubSecrets(answer));
  if (input.taskId) {
    await appendTranscript({
      taskId: input.taskId,
      agentId: "payment-processing",
      role: "AGENT",
      body,
    });
    await updateTaskStatus(input.taskId, "COMPLETED", { result: scrubSecrets(answer) });
  }
  await setAgentStatus("payment-processing", "IDLE", null);
  return scrubSecrets({ agentId: "payment-processing", ...answer });
}
