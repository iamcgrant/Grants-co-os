"use strict";

/**
 * Renderer privileges. Vendor + OS views never get a preload.
 * Local chrome / About / Messages may use a narrow preload — never Electron internals.
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
  const prefs = {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    partition: "gc-chrome-local",
    webSecurity: true,
    allowRunningInsecureContent: false,
    navigateOnDragDrop: false,
  };
  if (preloadPath) prefs.preload = preloadPath;
  return prefs;
}

function messagesWebPreferences(preloadPath) {
  return {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    partition: "gc-messages-local",
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

function assertMessagesPrefs(prefs) {
  assertUnprivilegedPrefs({ ...prefs, preload: undefined });
  if (!prefs.preload) {
    throw new Error("messages view requires its own preload");
  }
}

module.exports = {
  unprivilegedWebPreferences,
  chromeWebPreferences,
  messagesWebPreferences,
  assertUnprivilegedPrefs,
  assertMessagesPrefs,
};
