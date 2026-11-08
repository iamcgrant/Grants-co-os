/**
 * Rebuild the Mac app icon as a white rounded tile with the blue Grant & Co mark.
 */
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const script = path.join(root, "scripts/build-mac-icon.py");
const result = spawnSync("python3", [script], { stdio: "inherit" });
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
