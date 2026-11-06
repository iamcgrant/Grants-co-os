/**
 * Rebuild desktop PNG icons from the official Grant & Co emblem.
 * Never draws a placeholder lettermark.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "desktop/src-tauri/icons");
const source = path.join(root, "public/brand/app-icon.png");
fs.mkdirSync(outDir, { recursive: true });

if (!fs.existsSync(source)) {
  console.error("Missing public/brand/app-icon.png");
  process.exit(1);
}

fs.copyFileSync(source, path.join(outDir, "icon.png"));

const py = `
from PIL import Image
from pathlib import Path
src = Image.open(${JSON.stringify(source)}).convert("RGBA")
out = Path(${JSON.stringify(outDir)})
for size, name in [(32, "32x32.png"), (128, "128x128.png"), (256, "128x128@2x.png"), (512, "icon.png")]:
    src.resize((size, size), Image.Resampling.LANCZOS).save(out / name)
    print(f"Wrote {name}")
`;

const result = spawnSync("python3", ["-c", py], { stdio: "inherit" });
if (result.status !== 0) {
  console.warn("Pillow resize failed — icon.png was copied from the brand emblem.");
}
