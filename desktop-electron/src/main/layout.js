"use strict";

/** Local chrome metrics. Content WebContentsViews sit in the remaining rect. */
const CHROME = Object.freeze({
  sidebarWidth: 236,
  headerHeight: 44,
  toolbarHeight: 0,
  noticeHeight: 56,
});

function chromeBounds(contentWidth, contentHeight) {
  return {
    x: 0,
    y: 0,
    width: Math.max(0, contentWidth),
    height: Math.max(0, contentHeight),
  };
}

function vendorBounds(contentWidth, contentHeight, noticeVisible) {
  const x = CHROME.sidebarWidth;
  const notice = noticeVisible ? CHROME.noticeHeight : 0;
  const y = CHROME.headerHeight + CHROME.toolbarHeight + notice;
  return {
    x,
    y,
    width: Math.max(0, contentWidth - x),
    height: Math.max(0, contentHeight - y),
  };
}

module.exports = { CHROME, chromeBounds, vendorBounds };
