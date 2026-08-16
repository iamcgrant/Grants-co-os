/**
 * Probe Cursor API key visibility/validity. Never prints the key.
 */
import { config } from "dotenv";
config();
process.env.GC_ENV = process.env.GC_ENV || "development";

async function main() {
  const { probeCursorApiKey, isCursorLaunchReady, getCursorApiKeySource } =
    await import("../src/lib/agent-hub");
  const source = getCursorApiKeySource();
  const probe = await probeCursorApiKey();
  console.log(
    JSON.stringify(
      {
        process_key: source ? { name: source.name, present: source.present } : { present: false },
        launch_ready: isCursorLaunchReady(),
        probe: {
          present: probe.present,
          valid: probe.valid,
          sourceName: "sourceName" in probe ? probe.sourceName : null,
          httpStatus: "httpStatus" in probe ? probe.httpStatus : null,
          message: "message" in probe ? probe.message : null,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
