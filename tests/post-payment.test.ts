import { describe, it, expect } from "vitest";
import {
  buildPostPaymentContinuation,
  resolveDisputeFoxIntakeUrl,
} from "../src/lib/payments/post-payment";

describe("post-payment DisputeFox continuation", () => {
  it("builds an internal Grants Pay continue URL", () => {
    const cont = buildPostPaymentContinuation({
      clientId: "c1",
      grantsClientId: "GC-000001",
      invoiceId: "inv1",
      invoiceNumber: "GC-1051",
      transactionId: "txn1",
      appBaseUrl: "https://os.example",
    });
    expect(cont.nextUrl).toBe("https://os.example/pay/continue/GC-1051?txn=txn1");
    expect(cont.intakeProvider).toBe("disputefox");
  });

  it("resolves intake URL from template without leaking when missing", () => {
    delete process.env.DISPUTEFOX_INTAKE_URL_TEMPLATE;
    expect(
      resolveDisputeFoxIntakeUrl({
        externalDisputeFoxId: "df_1",
        grantsClientId: "GC-000001",
      }),
    ).toBeNull();

    process.env.DISPUTEFOX_INTAKE_URL_TEMPLATE =
      "https://intake.example/{externalId}?ref={grantsClientId}";
    expect(
      resolveDisputeFoxIntakeUrl({
        externalDisputeFoxId: "df_1",
        grantsClientId: "GC-000001",
      }),
    ).toBe("https://intake.example/df_1?ref=GC-000001");
  });
});
