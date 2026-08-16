/**
 * Fail-closed apply/create path.
 * Default: CRC_RECOVERY_WRITES_ENABLED is not true.
 * Live GHL / DisputeFox writes are refused even if the flag is on.
 * This PR does not execute OS creates either — decisioning only.
 */

import {
  CRC_DO_NOT_ENROLL,
  CRC_RECOVERY_LOCKS,
  CRC_RECOVERY_WRITES_ENV,
  isCrcRecoveryWritesEnabled,
} from "./locks";
import type { CrcClientDecision } from "./types";

export type WriteTarget =
  | "os_create"
  | "os_update"
  | "ghl_create"
  | "ghl_update"
  | "df_create"
  | "df_update"
  | "message"
  | "workflow"
  | "enrollment";

export type WriteRefusal = {
  ok: false;
  refused: true;
  target: WriteTarget;
  reason: string;
  writesEnabled: boolean;
};

export function assertCrcRecoveryWriteAllowed(target: WriteTarget): WriteRefusal {
  const writesEnabled = isCrcRecoveryWritesEnabled();

  if (target === "ghl_create" || target === "ghl_update") {
    return {
      ok: false,
      refused: true,
      target,
      writesEnabled,
      reason: "Live GHL writes are refused. Identify + dry-run only. Do not create GHL contacts.",
    };
  }
  if (target === "df_create" || target === "df_update") {
    return {
      ok: false,
      refused: true,
      target,
      writesEnabled,
      reason:
        "DisputeFox writes are refused. Do not auto-create DF records. Flagged continuity work is a later PR.",
    };
  }
  if (target === "message" || target === "workflow" || target === "enrollment") {
    return {
      ok: false,
      refused: true,
      target,
      writesEnabled,
      reason:
        "Comms/enrollment freeze: no welcome, onboarding, POA, Friday Pulse, invoices, payment requests, outbound SMS/email/iMessage, or workflow publish.",
    };
  }
  if (!writesEnabled) {
    return {
      ok: false,
      refused: true,
      target,
      writesEnabled: false,
      reason: `${CRC_RECOVERY_WRITES_ENV} is not true. Default fail-closed.`,
    };
  }
  return {
    ok: false,
    refused: true,
    target,
    writesEnabled: true,
    reason: "Identify + dry-run PR: OS create/update is decisioned only and is not executed.",
  };
}

export type ApplyCrcRecoveryResult = {
  applied: false;
  refused: true;
  writesEnabled: boolean;
  osCreates: 0;
  osUpdates: 0;
  ghlCreates: 0;
  ghlWrites: 0;
  dfCreates: 0;
  dfWrites: 0;
  messagesSent: 0;
  workflowsPublished: 0;
  enrollments: 0;
  decisions: number;
  refusals: WriteRefusal[];
  locks: typeof CRC_RECOVERY_LOCKS;
  enroll: typeof CRC_DO_NOT_ENROLL;
  message: string;
};

export function applyCrcRecoveryDecisions(decisions: CrcClientDecision[]): ApplyCrcRecoveryResult {
  const targets: WriteTarget[] = [
    "os_create",
    "os_update",
    "ghl_create",
    "df_create",
    "message",
    "workflow",
    "enrollment",
  ];
  const refusals = targets.map((target) => assertCrcRecoveryWriteAllowed(target));

  return {
    applied: false,
    refused: true,
    writesEnabled: isCrcRecoveryWritesEnabled(),
    osCreates: 0,
    osUpdates: 0,
    ghlCreates: 0,
    ghlWrites: 0,
    dfCreates: 0,
    dfWrites: 0,
    messagesSent: 0,
    workflowsPublished: 0,
    enrollments: 0,
    decisions: decisions.length,
    refusals,
    locks: CRC_RECOVERY_LOCKS,
    enroll: CRC_DO_NOT_ENROLL,
    message: isCrcRecoveryWritesEnabled()
      ? "Writes flag is on, but live GHL/DF/OS creates are still refused in this identify + dry-run PR."
      : `${CRC_RECOVERY_WRITES_ENV} is not true. No live side effects.`,
  };
}
