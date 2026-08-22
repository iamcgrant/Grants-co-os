"use strict";

/**
 * Renderer privileges. Vendor + OS views never get a preload.
 * Chrome may use a preload that only exposes spike IPC — never Electron internals.
 */

function unprivilegedWebPreferences(partition) {
  return {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    partition,
    webSecurity: true,
    allowRunningInsecureContent: false,
    navigateOnDragDrop: false,
    // Intentionally no preload. Do not add one.
  };
}

function chromeWebPreferences(preloadPath) {
  return {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    partition: "gc-chrome-local",
    preload: preloadPath,
    webSecurity: true,
    allowRunningInsecureContent: false,
    navigateOnDragDrop: false,
  };
}

function assertUnprivilegedPrefs(prefs) {
  if (prefs.nodeIntegration !== false) {
    throw new Error("nodeIntegration must be false");
  }
  if (prefs.contextIsolation !== true) {
    throw new Error("contextIsolation must be true");
  }
  if (prefs.sandbox !== true) {
    throw new Error("sandbox must be true");
  }
  if (Object.prototype.hasOwnProperty.call(prefs, "preload") && prefs.preload) {
    throw new Error("unprivileged views must not have a preload");
  }
}

/**
 * Isolated partitions may request Storage Access so a vendor page can keep
 * its own first-party login cookies. Camera, mic, geo, notifications, MIDI,
 * media, clipboard, and every other permission stay denied.
 */
const ALLOWED_VENDOR_PERMISSIONS = new Set([
  "storage-access",
  "top-level-storage-access",
]);

function isAllowedVendorPermission(permission) {
  return ALLOWED_VENDOR_PERMISSIONS.has(permission);
}

module.exports = {
  unprivilegedWebPreferences,
  chromeWebPreferences,
  assertUnprivilegedPrefs,
  isAllowedVendorPermission,
};
