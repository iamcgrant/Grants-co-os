"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { CHROME, chromeBounds, vendorBounds } = require("../src/main/layout");

describe("chrome layout", () => {
  it("folds the tab strip and toolbar into one slim header", () => {
    assert.equal(CHROME.headerHeight, 44);
    assert.equal(CHROME.toolbarHeight, 0);
    assert.equal(CHROME.sidebarWidth, 236);
  });

  it("keeps chrome full-window and vendors in the remaining rect", () => {
    assert.deepEqual(chromeBounds(1440, 900), { x: 0, y: 0, width: 1440, height: 900 });
    const idle = vendorBounds(1440, 900, false);
    assert.equal(idle.x, CHROME.sidebarWidth);
    assert.equal(idle.y, CHROME.headerHeight + CHROME.toolbarHeight);
    assert.equal(idle.width, 1440 - CHROME.sidebarWidth);
    assert.equal(idle.height, 900 - idle.y);
  });

  it("shrinks the vendor view when a chrome notice is visible", () => {
    const hidden = vendorBounds(1440, 900, false);
    const shown = vendorBounds(1440, 900, true);
    assert.equal(shown.y, hidden.y + CHROME.noticeHeight);
    assert.equal(shown.height, hidden.height - CHROME.noticeHeight);
  });
});
