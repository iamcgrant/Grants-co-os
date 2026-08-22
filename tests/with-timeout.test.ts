import { describe, expect, it } from "vitest";
import { withTimeout } from "../src/lib/disputes/with-timeout";

describe("withTimeout", () => {
  it("resolves the value when the work finishes in time", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 50, () => "late")).resolves.toBe("ok");
  });

  it("uses the timeout value when the work never finishes", async () => {
    const started = Date.now();
    const value = await withTimeout(new Promise<string>(() => {}), 40, () => "empty");
    expect(value).toBe("empty");
    expect(Date.now() - started).toBeLessThan(250);
  });

  it("rejects when onTimeout throws so callers can catch", async () => {
    const started = Date.now();
    await expect(
      withTimeout(new Promise<string>(() => {}), 40, () => {
        throw new Error("budget exceeded");
      }),
    ).rejects.toThrow(/budget exceeded/);
    expect(Date.now() - started).toBeLessThan(250);
  });
});
