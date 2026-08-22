import { afterEach, describe, expect, it } from "vitest";
import { probeDisputeFoxApi } from "@/lib/integrations/disputefox/probe";

describe("DisputeFox health probe", () => {
  const prevKey = process.env.DISPUTEFOX_API_KEY;
  const prevProbe = process.env.DISPUTEFOX_API_PROBE_URL;

  afterEach(() => {
    if (prevKey === undefined) delete process.env.DISPUTEFOX_API_KEY;
    else process.env.DISPUTEFOX_API_KEY = prevKey;
    if (prevProbe === undefined) delete process.env.DISPUTEFOX_API_PROBE_URL;
    else process.env.DISPUTEFOX_API_PROBE_URL = prevProbe;
  });

  it("is never CONNECTED when only a key is present", async () => {
    process.env.DISPUTEFOX_API_KEY = "df_test_value_do_not_log";
    delete process.env.DISPUTEFOX_API_PROBE_URL;
    const result = await probeDisputeFoxApi(async () => {
      throw new Error("must not fetch without probe URL");
    });
    expect(result.status).not.toBe("CONNECTED");
    expect(result.status).toBe("DEGRADED");
    expect(result.probed).toBe(false);
    expect(result.detail).not.toMatch(/df_test_value/);
  });

  it("is ACTION_REQUIRED without a key", async () => {
    delete process.env.DISPUTEFOX_API_KEY;
    const result = await probeDisputeFoxApi();
    expect(result.status).toBe("ACTION_REQUIRED");
    expect(result.lastSuccessAt).toBeNull();
  });

  it("marks CONNECTED only after a successful live GET", async () => {
    process.env.DISPUTEFOX_API_KEY = "df_test_value_do_not_log";
    process.env.DISPUTEFOX_API_PROBE_URL = "https://example.test/df-probe";
    const result = await probeDisputeFoxApi(async () => new Response("{}", { status: 200 }));
    expect(result.status).toBe("CONNECTED");
    expect(result.probed).toBe(true);
    expect(result.lastSuccessAt).toBeTruthy();
  });
});
