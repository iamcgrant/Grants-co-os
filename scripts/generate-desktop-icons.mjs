/**
 * Generate minimal black/champagne-gold PNG icons when missing.
 * Prefer existing committed icons; never fail the build if Pillow is absent.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "desktop/src-tauri/icons");
fs.mkdirSync(outDir, { recursive: true });

const required = ["32x32.png", "128x128.png", "icon.png"];
const hasAll = required.every((name) => fs.existsSync(path.join(outDir, name)));
if (hasAll) {
  console.log("Desktop PNG icons already present — skipping Pillow generation.");
  process.exit(0);
}

const py = `
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

out = Path(${JSON.stringify(outDir)})
BLACK = (4, 4, 4, 255)
GOLD = (245, 184, 42, 255)
CREAM = (248, 244, 236, 255)

def draw_icon(size, path):
    img = Image.new("RGBA", (size, size), BLACK)
    draw = ImageDraw.Draw(img)
    pad = max(4, round(size * 0.14))
    draw.rounded_rectangle((pad, pad, size - pad, size - pad), radius=max(6, round(size * 0.18)), outline=GOLD, width=max(2, round(size * 0.04)))
    cx = size // 2
    cy = size // 2
    r = (size - pad * 2) // 2
    tri = [
        (cx - round(r * 0.35), cy - round(r * 0.05)),
        (cx + round(r * 0.42), cy - round(r * 0.05)),
        (cx + round(r * 0.05), cy + round(r * 0.55)),
    ]
    draw.polygon(tri, fill=GOLD)
    font_size = max(10, round(size * 0.34))
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", font_size)
    except Exception:
        font = ImageFont.load_default()
    text = "G"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((cx - tw // 2, cy - th // 2 + round(size * 0.02)), text, fill=CREAM, font=font)
    img.save(path, optimize=True)

for size, name in [(32, "32x32.png"), (128, "128x128.png"), (512, "icon.png")]:
    target = out / name
    draw_icon(size, target)
    print(f"Wrote {name} ({target.stat().st_size} bytes)")
`;

const result = spawnSync("python3", ["-c", py], { stdio: "inherit" });
if (result.status !== 0) {
  if (hasAll) process.exit(0);
  console.warn("Pillow icon generation failed — relying on committed icons if present.");
  const stillOk = required.every((name) => fs.existsSync(path.join(outDir, name)));
  process.exit(stillOk ? 0 : result.status ?? 1);
}
