"use strict";

/**
 * Hide the live OS website chrome inside the Home WebContentsView only.
 * Production still paints StaffShell because the gc_shell cookie is not live.
 * Far-left Electron desks (Telegram, GHL, …) never receive this CSS.
 */
const OS_HOME_CHROME_CSS = `
.gc-sidebar,
.gc-sidebar-brand,
.gc-sidebar-nav,
.gc-sidebar-foot,
.gc-topbar,
.gc-nav-mobile,
.gc-dev-banner {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
  overflow: hidden !important;
  pointer-events: none !important;
}
.gc-app-shell,
.gc-app-shell.is-portal-desk {
  display: block !important;
  grid-template-columns: minmax(0, 1fr) !important;
  min-height: 100dvh !important;
}
.gc-main,
.gc-content,
.gc-desktop-shell {
  width: 100% !important;
  max-width: none !important;
  margin: 0 !important;
}
.gc-content {
  padding-bottom: 1.25rem !important;
}
`.trim();

function shouldInjectOsHomeChrome(desk) {
  return Boolean(desk && desk.id === "os" && desk.kind === "os");
}

async function injectOsHomeChrome(contents) {
  if (!contents || contents.isDestroyed?.()) return false;
  if (typeof contents.insertCSS !== "function") return false;
  try {
    await contents.insertCSS(OS_HOME_CHROME_CSS);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  OS_HOME_CHROME_CSS,
  shouldInjectOsHomeChrome,
  injectOsHomeChrome,
};
