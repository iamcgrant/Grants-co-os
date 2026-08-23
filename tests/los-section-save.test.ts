import { describe, expect, it } from "vitest";
import { REQUIRED_FOR_SECTION_WRITE } from "../src/lib/los/compliance";
import { createMortgageLosService } from "../src/lib/los/service";

const WRITE_PACKET = [...REQUIRED_FOR_SECTION_WRITE];

describe("section save/resume after compliance", () => {
  it("saves and resumes BORROWER section data after the e-sign packet", () => {
    const los = createMortgageLosService();
    const { applicationId } = los.createApplication({ clientId: "client_1" });
    los.acknowledgeCompliance({
      applicationId,
      disclosures: WRITE_PACKET,
      signature: { typedFirst: "Example", typedLast: "Borrower", drawnSignatureKey: "sig-1" },
    });
    const body = {
      firstNameOnDl: "Example",
      lastNameOnDl: "Borrower",
      dateOfBirth: "1990-01-01",
      mobilePhone: "5550100000",
      email: "example@example.com",
    };
    const saved = los.patchSection({ applicationId, section: "BORROWER", body });
    expect(saved.section).toBe("BORROWER");
    expect((saved.body as { firstNameOnDl: string }).firstNameOnDl).toBe("Example");

    const resumed = los.getSection(applicationId, "BORROWER");
    expect(resumed).not.toBeNull();
    expect(resumed?.body).toMatchObject(body);

    const got = los.getApplication(applicationId);
    expect(got.sections.BORROWER).toMatchObject(body);
  });
});
