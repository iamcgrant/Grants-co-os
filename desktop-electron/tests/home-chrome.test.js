"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DESKS } = require("../src/main/desks");
const { OS_HOME_CHROME_CSS, shouldInjectOsHomeChrome, injectOsHomeChrome } = require("../src/main/home-chrome");

describe("OS Home inner chrome CSS", () => {
  it("hides website sidebar chrome and expands content", () => {
    assert.match(OS_HOME_CHROME_CSS, /\.gc-sidebar/);
    assert.match(OS_HOME_CHROME_CSS, /\.gc-topbar/);
    assert.match(OS_HOME_CHROME_CSS, /\.gc-nav-mobile/);
    assert.match(OS_HOME_CHROME_CSS, /\.gc-sidebar-brand/);
    assert.match(OS_HOME_CHROME_CSS, /\.gc-sidebar-foot/);
    assert.match(OS_HOME_CHROME_CSS, /\.gc-main/);
    assert.match(OS_HOME_CHROME_CSS, /\.gc-content/);
    assert.match(OS_HOME_CHROME_CSS, /display:\s*none\s*!important/);
    assert.match(OS_HOME_CHROME_CSS, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });

  it("injects only into the OS Home desk, never vendor desks", async () => {
    assert.equal(shouldInjectOsHomeChrome(DESKS.find((desk) => desk.id === "os")), true);
    assert.equal(shouldInjectOsHomeChrome(DESKS.find((desk) => desk.id === "telegram")), false);
    assert.equal(shouldInjectOsHomeChrome(DESKS.find((desk) => desk.id === "ghl")), false);
    const injected = [];
    await injectOsHomeChrome({
      isDestroyed: () => false,
      insertCSS: async (css) => {
        injected.push(css);
      },
    });
    assert.equal(injected.length, 1);
    assert.equal(injected[0], OS_HOME_CHROME_CSS);
  });

  it("keeps far-left Telegram on the official web.telegram.org desk", () => {
    const telegram = DESKS.find((desk) => desk.id === "telegram");
    assert.equal(telegram.startUrl, "https://web.telegram.org/a/");
    const main = fs.readFileSync(path.join(__dirname, "..", "src/main/index.js"), "utf8");
    assert.match(main, /shouldInjectOsHomeChrome/);
    assert.match(main, /injectOsHomeChrome/);
    assert.match(main, /restyleOsHome/);
    assert.doesNotMatch(main, /insertCSS[\s\S]*telegram/);
  });
});
