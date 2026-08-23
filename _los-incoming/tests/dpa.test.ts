import { describe, expect, it } from "vitest";
import {
  DPA_AMOUNT_CENTS,
  DPA_CONFIRMATION_COPY,
  applyDpaSelection,
} from "../src/los/dpa";
import { createMortgageLosService } from "../src/los/service";

describe("DPA selection", () => {
  it("yes adds 180000 cents and the exact confirmation copy", () => {
    const now = new Date("2026-08-23T19:00:00.000Z");
    const result = applyDpaSelection({ selected: true, now, currentPackageCents: 0 });
    expect(DPA_AMOUNT_CENTS).toBe(180000);
    expect(result.dpaSelected).toBe(true);
    expect(result.dpaAmountCents).toBe(180000);
    expect(result.dpaSelectedAt).toBe(now);
    expect(result.servicePackageAmountCents).toBe(180000);
    expect(result.confirmationCopy).toBe(
      "Down Payment Assistance will be added to your package for an additional $1,800. This option may provide additional assistance during the home buying process. New construction opportunities may offer additional incentives.",
    );
    expect(result.confirmationCopy).toBe(DPA_CONFIRMATION_COPY);
    expect(result.event).toBe("DPA_SELECTED");
  });

  it("no does not add amount or event; still stores the choice", () => {
    const now = new Date("2026-08-23T19:00:00.000Z");
    const result = applyDpaSelection({ selected: false, now, currentPackageCents: 50000 });
    expect(result.dpaSelected).toBe(false);
    expect(result.dpaAmountCents).toBe(0);
    expect(result.servicePackageAmountCents).toBe(50000);
    expect(result.confirmationCopy).toBeNull();
    expect(result.event).toBeNull();
    expect(result.dpaSelectedAt).toBe(now);
  });

  it("acknowledgeCompliance stores dpaSelected / dpaAmountCents / dpaSelectedAt", () => {
    const yes = createMortgageLosService();
    const createdYes = yes.createApplication({ clientId: "client_yes" });
    const ackYes = yes.acknowledgeCompliance({
      applicationId: createdYes.applicationId,
      disclosures: ["E_SIGN_CONSENT"],
      dpaSelected: true,
    });
    expect(ackYes.loanFile.dpaSelected).toBe(true);
    expect(ackYes.loanFile.dpaAmountCents).toBe(180000);
    expect(ackYes.loanFile.dpaSelectedAt).toBeInstanceOf(Date);
    expect(ackYes.dpa.confirmationCopy).toBe(DPA_CONFIRMATION_COPY);
    expect(ackYes.dpa.event).toBe("DPA_SELECTED");
    expect(ackYes.loanFile.servicePackageAmountCents).toBe(180000);

    const no = createMortgageLosService();
    const createdNo = no.createApplication({ clientId: "client_no" });
    const ackNo = no.acknowledgeCompliance({
      applicationId: createdNo.applicationId,
      disclosures: ["E_SIGN_CONSENT"],
      dpaSelected: false,
    });
    expect(ackNo.loanFile.dpaSelected).toBe(false);
    expect(ackNo.loanFile.dpaAmountCents).toBe(0);
    expect(ackNo.loanFile.dpaSelectedAt).toBeInstanceOf(Date);
    expect(ackNo.dpa.confirmationCopy).toBeNull();
    expect(ackNo.dpa.event).toBeNull();
  });
});
