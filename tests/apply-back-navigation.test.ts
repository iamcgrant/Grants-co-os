import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GRANT_CO_HOME_URL, applyBackAction } from "@/components/apply/apply-navigation";

describe("apply back navigation", () => {
  it("sends the first step to the Grant & Co homepage", () => {
    expect(applyBackAction(0)).toEqual({
      type: "home",
      href: GRANT_CO_HOME_URL,
      label: "Back to Grant & Co",
    });
    expect(applyBackAction(-1).type).toBe("home");
    expect(GRANT_CO_HOME_URL).toBe("https://grantandconsultants.com/");
  });

  it("keeps later steps on the previous form step", () => {
    expect(applyBackAction(1)).toEqual({ type: "previous", label: "Back" });
    expect(applyBackAction(4)).toEqual({ type: "previous", label: "Back" });
  });

  it("wires the apply portal and header logo to that behavior", () => {
    const portal = fs.readFileSync(path.join(process.cwd(), "src/components/apply/ApplyPortal.tsx"), "utf8");
    const header = fs.readFileSync(path.join(process.cwd(), "src/components/los/LosBrandHeader.tsx"), "utf8");
    expect(portal).toContain("applyBackAction");
    expect(portal).not.toContain("disabled={stepIndex <= 0}");
    expect(header).toContain("GRANT_CO_HOME_URL");
    expect(header).toContain("<a ");
    expect(header).toContain("/brand/logo.png");
  });
});
