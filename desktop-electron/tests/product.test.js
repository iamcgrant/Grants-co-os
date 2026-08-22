"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const product = require("../src/product");

const root = path.join(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("Grant & Co OS product identity", () => {
  it("locks customer-facing names and URLs", () => {
    assert.equal(product.PRODUCT_NAME, "Grant & Co OS");
    assert.equal(product.COMPANY_NAME, "Grant & Co Consultants");
    assert.equal(product.APP_ID, "com.grantandconsultants.os");
    assert.equal(product.VERSION, "1.0.0");
    assert.equal(product.PUBLIC_APP_NAME, "Grant & Co OS.app");
    assert.equal(product.DMG_VOLUME_NAME, "Grant & Co OS");
    assert.equal(product.DMG_DOWNLOAD_FILENAME, "Grant-and-Co-OS-Mac.dmg");
    assert.equal(product.WEBSITE_URL, "https://grantandconsultants.com");
    assert.equal(product.PRIVACY_POLICY_URL, "https://grantandconsultants.com/privacy-policy");
    assert.equal(product.TERMS_URL, "https://grantandconsultants.com/terms");
    assert.equal(product.WORDMARK_RELATIVE, "resources/brand/logo.jpeg");
    assert.equal(product.DOCK_ICON_RELATIVE, "resources/icon.icns");
  });

  it("wires package.json and electron-builder to the same identity", () => {
    const pkg = JSON.parse(read("package.json"));
    assert.equal(pkg.version, "1.0.0");
    assert.equal(pkg.build.appId, "com.grantandconsultants.os");
    assert.equal(pkg.build.productName, "Grant & Co OS");
    assert.equal(pkg.build.copyright, "Grant & Co Consultants");
    assert.equal(pkg.build.mac.hardenedRuntime, true);
    assert.equal(pkg.build.mac.identity, null);
    assert.deepEqual(pkg.build.mac.target, ["dmg", "dir"]);
    assert.equal(pkg.build.mac.icon, "resources/icon.icns");
    assert.equal(pkg.build.dmg.title, "Grant & Co OS");
    assert.equal(pkg.build.dmg.artifactName, "Grant-and-Co-OS-Mac.${ext}");
    assert.equal(pkg.build.dmg.background, "resources/brand/logo.jpeg");
    assert.equal(pkg.build.mac.entitlements, "build/entitlements.mac.plist");
    assert.ok(pkg.scripts.start);
    assert.ok(pkg.scripts.test);
    assert.match(pkg.scripts["build:mac"], /CSC_IDENTITY_AUTO_DISCOVERY=false/);
    assert.match(pkg.scripts["dist:mac"], /CSC_IDENTITY_AUTO_DISCOVERY=false/);
    assert.match(pkg.scripts["build:mac"], /--arm64/);
  });

  it("keeps hardened runtime entitlements minimal", () => {
    const entitlements = read("build/entitlements.mac.plist");
    assert.match(entitlements, /com\.apple\.security\.cs\.allow-jit/);
    assert.match(entitlements, /com\.apple\.security\.network\.client/);
    assert.doesNotMatch(entitlements, /addressbook|contacts|accessibility|automation|personal-information|files\.user-selected|device\.camera|device\.audio|device\.microphone/i);
  });

  it("does not reference personal Downloads paths", () => {
    const files = [
      "package.json",
      "README.md",
      "src/main/index.js",
      "src/main/brand-paths.js",
      "src/chrome/index.html",
      "src/about/index.html",
    ];
    for (const file of files) {
      assert.doesNotMatch(read(file), /\/Users\/charlesgrant\/Downloads/);
    }
  });
});
