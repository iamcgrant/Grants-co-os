/**
 * Phase 2 batch sequencer.
 *
 * Order: backup → write → verify → reconcile → continue
 *
 * Implementation is dry-run only. The write step plans class-gated writes
 * and never executes live Grants / GHL / DisputeFox / CRC side effects.
 */

import type { CrcExportClient } from "@/lib/crc-recovery/types";
import type { CrcPhase2Classification } from "./phase2-classification";
import {
  planPhase2Write,
  phase2SideEffects,
  type Phase2WriteContext,
  type Phase2WriteDecision,
  type Phase2WriteKind,
} from "./writes";

export const CRC_BATCH_STEPS = ["backup", "write", "verify", "reconcile", "continue"] as const;

export type CrcBatchStep = (typeof CRC_BATCH_STEPS)[number];

export type CrcBatchItem = {
  crcClientId: string;
  classification: CrcPhase2Classification;
  writeKind?: Phase2WriteKind;
  context: Phase2WriteContext;
};

export type CrcBatchStepResult = {
  step: CrcBatchStep;
  dryRun: true;
  ok: boolean;
  refused: boolean;
  reason: string;
  write?: Phase2WriteDecision;
};

export type CrcBatchItemPlan = {
  crcClientId: string;
  classification: CrcPhase2Classification;
  steps: CrcBatchStepResult[];
  continued: false;
  applied: false;
};

export type CrcBatchPlan = {
  dryRun: true;
  applied: false;
  sequence: typeof CRC_BATCH_STEPS;
  items: CrcBatchItemPlan[];
  liveSideEffects: ReturnType<typeof phase2SideEffects>;
  message: string;
};

function stepResult(
  step: CrcBatchStep,
  reason: string,
  write?: Phase2WriteDecision,
): CrcBatchStepResult {
  return {
    step,
    dryRun: true,
    ok: write ? write.ok : true,
    refused: write ? write.refused : false,
    reason,
    write,
  };
}

export function planCrcBatchSequence(items: CrcBatchItem[]): CrcBatchPlan {
  const planned: CrcBatchItemPlan[] = items.map((item) => {
    const writeKind = item.writeKind ?? "active_continuity_link";
    const write = planPhase2Write(writeKind, item.context);
    return {
      crcClientId: item.crcClientId,
      classification: item.classification,
      applied: false,
      continued: false,
      steps: [
        stepResult("backup", "Dry-run backup checkpoint — no snapshot written."),
        stepResult("write", write.reason, write),
        stepResult("verify", "Dry-run verify — no live Grants/GHL/DF/CRC read-after-write."),
        stepResult("reconcile", "Dry-run reconcile — identity stays on the existing compare pipeline."),
        stepResult("continue", "Dry-run stop. Continue is not executed; next batch is not applied."),
      ],
    };
  });

  return {
    dryRun: true,
    applied: false,
    sequence: CRC_BATCH_STEPS,
    items: planned,
    liveSideEffects: phase2SideEffects(),
    message:
      "Batch sequencer (backup → write → verify → reconcile → continue) is dry-run only. No live side effects.",
  };
}

export function planCrcBatchFromClients(
  clients: Array<{ client: CrcExportClient; classification: CrcPhase2Classification; context: Phase2WriteContext }>,
): CrcBatchPlan {
  return planCrcBatchSequence(
    clients.map((row) => ({
      crcClientId: row.client.crcClientId,
      classification: row.classification,
      context: row.context,
    })),
  );
}
