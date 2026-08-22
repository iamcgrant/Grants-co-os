"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const FORBIDDEN = /electron|spike|prototype|local chrome|disposable|feasibility|not production|not a tauri/i;

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

describe("customer-facing chrome", () => {
  it("uses Grant & Co OS wording and no development chrome language", () => {
    const html = read("src/chrome/index.html");
    assert.match(html, /Grant &amp; Co OS/);
    assert.doesNotMatch(html, FORBIDDEN);
    assert.doesNotMatch(html, /url-bar|address bar|forward/i);
    assert.doesNotMatch(html, /<iframe/i);
    assert.doesNotMatch(html, /<webview/i);
    assert.match(html, /btn-back/);
    assert.match(html, /btn-reload/);
    assert.match(html, /btn-identity/);
    assert.match(html, /•••/);
    assert.match(read("src/chrome/chrome.js"), /close\.textContent = "×"/);
    assert.match(html, /About Grant &amp; Co OS/);
    assert.match(html, /Open securely in browser/);
  });

  it("keeps About on official policy URLs that exist", () => {
    const html = read("src/about/index.html");
    assert.match(html, /Grant &amp; Co OS/);
    assert.match(html, /https:\/\/grantandconsultants\.com\/privacy-policy/);
    assert.match(html, /https:\/\/grantandconsultants\.com\/terms/);
    assert.doesNotMatch(html, FORBIDDEN);
  });

  it("keeps chrome preload on spikeChrome for tests", () => {
    assert.match(read("src/chrome/preload.js"), /spikeChrome/);
    assert.match(read("src/chrome/chrome.js"), /window\.spikeChrome/);
  });
});
