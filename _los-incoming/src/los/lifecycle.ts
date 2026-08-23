/** LoanFile lifecycle: APP_STARTED → APP_SUBMITTED. */

import { assertCanSubmit, type AcknowledgmentRow } from "./compliance";
import { LosHttpError } from "./errors";
import { formatLoanNumber } from "./loan-number";

export type OriginationStage = "APP_STARTED" | "APP_SUBMITTED";

export type LoanFileRecord = {
  loanNumber: string;
  originationStage: OriginationStage;
  dpaSelected: boolean;
  dpaAmountCents: number;
  dpaSelectedAt: Date | null;
  paymentAcknowledged: boolean;
  paymentAcknowledgedAt: Date | null;
  agreementVersion: string;
  servicePackageAmountCents: number;
};

export function createLoanFile(input: { seq: number; agreementVersion?: string }): LoanFileRecord {
  return {
    loanNumber: formatLoanNumber(input.seq),
    originationStage: "APP_STARTED",
    dpaSelected: false,
    dpaAmountCents: 0,
    dpaSelectedAt: null,
    paymentAcknowledged: false,
    paymentAcknowledgedAt: null,
    agreementVersion: input.agreementVersion ?? "2026-08-23-cognito-derived-draft-v1",
    servicePackageAmountCents: 0,
  };
}

export function submitApplication(input: {
  stage: string;
  acks: AcknowledgmentRow[];
}): { originationStage: "APP_SUBMITTED" } {
  if (input.stage !== "APP_STARTED") {
    throw new LosHttpError(
      422,
      "INVALID_STAGE",
      undefined,
      `Submit requires APP_STARTED, found ${input.stage}`,
    );
  }
  assertCanSubmit(input.acks);
  return { originationStage: "APP_SUBMITTED" };
}
