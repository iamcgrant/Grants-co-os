/**
 * Prepare a minimal local shell page used when packaging the Tauri wrapper.
 * The web application remains the canonical backend — desktop is a secure wrapper.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "desktop/public-desktop");
fs.mkdirSync(outDir, { recursive: true });

const appUrl = process.env.GC_DESKTOP_URL || "https://os.grantsandco.com";

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Grants &amp; Co OS</title>
    <style>
      html, body { margin: 0; height: 100%; background: #040404; color: #fff; font-family: Georgia, serif; }
      .wrap { height: 100%; display: grid; place-items: center; text-align: center; padding: 2rem; }
      .gold { color: #f5b82a; letter-spacing: 0.35em; text-transform: uppercase; font-size: 0.75rem; }
      a { color: #f5b82a; }
    </style>
    <meta http-equiv="refresh" content="0;url=${appUrl}" />
  </head>
  <body>
    <div class="wrap">
      <div>
        <p class="gold">Grants &amp; Co</p>
        <h1>Opening Grants &amp; Co OS</h1>
        <p><a href="${appUrl}">Continue</a></p>
      </div>
    </div>
  </body>
</html>`;

fs.writeFileSync(path.join(outDir, "index.html"), html);
console.log("Prepared desktop shell →", outDir);
