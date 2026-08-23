/**
 * Down Payment Assistance add-on. $1,800 = 180000 cents.
 * Selection is always stored. Yes triggers amount + DPA_SELECTED event.
 * No is a valid choice and is not a submit blocker.
 */

export const DPA_AMOUNT_CENTS = 180_000;

export const DPA_CONFIRMATION_COPY =
  "Down Payment Assistance will be added to your package for an additional $1,800. This option may provide additional assistance during the home buying process. New construction opportunities may offer additional incentives.";

export type DpaSelectionInput = {
  selected: boolean;
  now: Date;
  currentPackageCents: number;
};

export type DpaSelectionResult = {
  dpaSelected: boolean;
  dpaAmountCents: number;
  dpaSelectedAt: Date | null;
  servicePackageAmountCents: number;
  confirmationCopy: string | null;
  event: "DPA_SELECTED" | null;
};

export function applyDpaSelection(input: DpaSelectionInput): DpaSelectionResult {
  const current = Number.isFinite(input.currentPackageCents) ? input.currentPackageCents : 0;
  if (input.selected) {
    return {
      dpaSelected: true,
      dpaAmountCents: DPA_AMOUNT_CENTS,
      dpaSelectedAt: input.now,
      servicePackageAmountCents: current + DPA_AMOUNT_CENTS,
      confirmationCopy: DPA_CONFIRMATION_COPY,
      event: "DPA_SELECTED",
    };
  }
  return {
    dpaSelected: false,
    dpaAmountCents: 0,
    dpaSelectedAt: input.now,
    servicePackageAmountCents: current,
    confirmationCopy: null,
    event: null,
  };
}
