import { describe, expect, it } from "vitest";
import { decryptSsn, encryptSsn, last4, toPublic } from "../src/los/ssn-vault";
import { REQUIRED_FOR_SECTION_WRITE } from "../src/los/compliance";
import { createMortgageLosService } from "../src/los/service";

const KEY = Buffer.alloc(32, 9);
const KEY_B64 = KEY.toString("base64");
const SSN = "123456789";

describe("ssn vault", () => {
  it("encrypts and decrypts with AES-256-GCM; ciphertext !== plaintext", () => {
    const cipher = encryptSsn(SSN, KEY);
    expect(cipher).not.toBe(SSN);
    expect(cipher.includes(SSN)).toBe(false);
    expect(cipher.split(".")).toHaveLength(3);
    expect(decryptSsn(cipher, KEY)).toBe(SSN);
    expect(decryptSsn(encryptSsn(SSN, KEY_B64), KEY_B64)).toBe(SSN);
  });

  it("last4 only on public view — never full SSN", () => {
    expect(last4(SSN)).toBe("6789");
    expect(last4("123-45-6789")).toBe("6789");
    const publicView = toPublic({
      firstNameOnDl: "Example",
      ssn: SSN,
      ssnCiphertext: encryptSsn(SSN, KEY),
    });
    expect(publicView.ssnLast4).toBe("6789");
    expect(publicView).not.toHaveProperty("ssn");
    expect(publicView).not.toHaveProperty("ssnCiphertext");
    expect(JSON.stringify(publicView)).not.toContain(SSN);
  });

  it("GET application exposes ssnLast4 only after BORROWER PATCH", () => {
    const los = createMortgageLosService({ piiKey: KEY });
    const { applicationId } = los.createApplication({ clientId: "client_1" });
    los.acknowledgeCompliance({ applicationId, disclosures: [...REQUIRED_FOR_SECTION_WRITE] });
    los.patchSection({
      applicationId,
      section: "BORROWER",
      body: { firstNameOnDl: "Example", lastNameOnDl: "Borrower", ssn: SSN },
    });
    const borrower = los.publicBorrower(applicationId);
    expect(borrower.ssnLast4).toBe("6789");
    expect(borrower).not.toHaveProperty("ssn");
    expect(borrower).not.toHaveProperty("ssnCiphertext");
    const got = los.getApplication(applicationId);
    expect(JSON.stringify(got)).not.toContain(SSN);
    expect((got.sections.BORROWER as { ssnLast4: string }).ssnLast4).toBe("6789");
  });
});
