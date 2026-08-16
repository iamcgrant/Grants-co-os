/**
 * Grants Agent Hub — shared types & autonomy policy.
 * Charles is the OWNER APPROVAL LAYER, not the messenger.
 */

export type AgentMode = "EXTERNAL_AGENT" | "GRANTS_NATIVE_AGENT";

export type AutonomyLevel = 0 | 1 | 2 | 3;

export const AUTONOMY = {
  0: "AUTONOMOUS_READ",
  1: "AUTONOMOUS_SAFE_WORK",
  2: "CONTROLLED_PRODUCTION",
  3: "CHARLES_APPROVAL",
} as const;

export type AgentEventKind =
  | "CLIENT_SYNC_REQUIRED"
  | "PAYMENT_EXCEPTION"
  | "FIELD_MAPPING_NEEDED"
  | "CODE_CHANGE_REQUIRED"
  | "WORKFLOW_FAILURE"
  | "OWNER_APPROVAL_REQUIRED"
  | "QA_REQUIRED"
  | "AGENT_HANDOFF"
  | "TASK_COMPLETED"
  | "TASK_FAILED"
  | "CURSOR_LAUNCHED"
  | "CURSOR_RESULT"
  | "SYSTEM";

export type TaskStatus =
  | "QUEUED"
  | "ROUTING"
  | "IN_PROGRESS"
  | "WAITING_AGENT"
  | "WAITING_CURSOR"
  | "AWAITING_CURSOR_API_KEY"
  | "AWAITING_APPROVAL"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "DENIED";

/** Actions that always require Charles (Level 3). */
export const LEVEL3_ACTIONS = [
  "CHARGE_MONEY",
  "REFUND_OUTSIDE_RULES",
  "BANK_PAYOUT_CHANGE",
  "CREDENTIAL_ROTATION",
  "API_KEY_REGENERATION",
  "DESTRUCTIVE_DELETE",
  "CONTACT_MERGE",
  "BULK_LIVE_COMMUNICATION",
  "A2P_OWNERSHIP_CHANGE",
  "PERMISSION_SECURITY_CHANGE",
  "SUBSTANTIAL_PRODUCTION_INTEGRATION",
] as const;

export type Level3Action = (typeof LEVEL3_ACTIONS)[number];

export function requiresOwnerApproval(action: string, requestedLevel: AutonomyLevel): boolean {
  if (requestedLevel >= 3) return true;
  return (LEVEL3_ACTIONS as readonly string[]).includes(action);
}

/** RESOLVE BEFORE ESCALATE — policy checklist for agents. */
export const RESOLVE_BEFORE_ESCALATE = [
  "Can the current agent determine the answer?",
  "Can another Grants agent answer it?",
  "Can an approved system/API answer it?",
  "Can Cursor solve/test it safely?",
] as const;

export function scrubSecrets<T>(value: T): T {
  if (value == null) return value;
  if (typeof value === "string") {
    // Redact only credential-like literals, not sentences that mention env var names.
    if (
      /^(Bearer\s+)?[A-Za-z0-9_\-+/=]{32,}$/.test(value.trim()) ||
      /^sk_live_[A-Za-z0-9]+$/.test(value.trim()) ||
      /^crsr_[A-Za-z0-9]+$/.test(value.trim())
    ) {
      return "[REDACTED]" as T;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => scrubSecrets(v)) as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/password|api[_-]?key|token|secret|cookie|authorization|credential/i.test(k)) {
        // Keep boolean readiness flags; redact string secret values only.
        if (typeof v === "string" && v.length > 0) out[k] = "[REDACTED]";
        else out[k] = scrubSecrets(v);
      } else {
        out[k] = scrubSecrets(v);
      }
    }
    return out as T;
  }
  return value;
}
