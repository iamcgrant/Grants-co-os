#!/usr/bin/env node
/**
 * Smoke-check Grants & Co OS desktop packaging without a full Tauri rebuild.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
let failures = 0;

function pass(message) {
  console.log("✓", message);
}

function fail(message) {
  console.error("✗", message);
  failures += 1;
}

function findPackages(dir) {
  const appImages = [];
  const debs = [];

  if (!fs.existsSync(dir)) {
    return { appImages, debs };
  }

  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (entry.name.endsWith(".AppImage")) {
        appImages.push(fullPath);
      }
      if (entry.name.endsWith(".deb")) {
        debs.push(fullPath);
      }
    }
  };

  walk(dir);
  return { appImages, debs };
}

console.log("Grants & Co OS desktop smoke check\n");

const confPath = path.join(root, "desktop/src-tauri/tauri.conf.json");
if (!fs.existsSync(confPath)) {
  fail("desktop/src-tauri/tauri.conf.json is missing");
  process.exit(1);
}

const conf = JSON.parse(fs.readFileSync(confPath, "utf8"));

if (conf.productName === "Grants & Co OS") {
  pass('productName is "Grants & Co OS"');
} else {
  fail(`productName is "${conf.productName}", expected "Grants & Co OS"`);
}

if (conf.identifier === "com.grantsandco.os") {
  pass("identifier is com.grantsandco.os");
} else {
  fail(`identifier is "${conf.identifier}", expected com.grantsandco.os`);
}

const requiredTargets = ["dmg", "app", "nsis", "msi", "appimage", "deb"];
const targets = conf.bundle?.targets ?? [];
for (const target of requiredTargets) {
  if (targets.includes(target)) {
    pass(`bundle target includes ${target}`);
  } else {
    fail(`bundle target missing ${target}`);
  }
}

const capabilitiesDir = path.join(root, "desktop/src-tauri/capabilities");
const defaultCapability = path.join(capabilitiesDir, "default.json");
if (fs.existsSync(defaultCapability)) {
  pass("capabilities/default.json exists");
} else {
  fail("capabilities/default.json is missing");
}

const prepareScript = path.join(root, "scripts/prepare-desktop-shell.mjs");
const prepare = spawnSync(process.execPath, [prepareScript], {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env, GC_DESKTOP_URL: "https://os.grantsandco.com" },
});

if (prepare.status === 0) {
  pass("prepare-desktop-shell.mjs runs successfully");
} else {
  fail(
    `prepare-desktop-shell.mjs failed (exit ${prepare.status}): ${prepare.stderr || prepare.stdout}`,
  );
}

const shellHtml = path.join(root, "desktop/public-desktop/index.html");
if (fs.existsSync(shellHtml)) {
  const html = fs.readFileSync(shellHtml, "utf8");
  if (html.includes("https://os.grantsandco.com")) {
    pass("splash shell references production GC_DESKTOP_URL");
  } else {
    fail("splash shell does not reference https://os.grantsandco.com");
  }
  if (html.includes("offline-banner")) {
    pass("splash shell includes offline banner");
  } else {
    fail("splash shell is missing offline banner");
  }
} else {
  fail("desktop/public-desktop/index.html was not generated");
}

const artifactRoots = [
  path.join(root, "desktop/src-tauri/target/release/bundle"),
  "/opt/cursor/artifacts/desktop",
];

let foundAppImage = false;
let foundDeb = false;
const located = [];

for (const artifactRoot of artifactRoots) {
  const { appImages, debs } = findPackages(artifactRoot);
  if (appImages.length > 0) {
    foundAppImage = true;
    located.push(...appImages);
  }
  if (debs.length > 0) {
    foundDeb = true;
    located.push(...debs);
  }
}

if (foundAppImage) {
  pass("Linux AppImage artifact found");
} else {
  fail("Linux AppImage artifact not found in bundle or /opt/cursor/artifacts/desktop");
}

if (foundDeb) {
  pass("Linux deb artifact found");
} else {
  fail("Linux deb artifact not found in bundle or /opt/cursor/artifacts/desktop");
}

for (const file of located) {
  console.log("  →", file);
}

console.log("");
if (failures === 0) {
  console.log("Desktop smoke check passed.");
  process.exit(0);
}

console.error(`Desktop smoke check failed with ${failures} issue(s).`);
process.exit(1);
