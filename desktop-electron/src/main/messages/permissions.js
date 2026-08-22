"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { settingsUrl } = require("./ops");

function messagesDbPath(home = os.homedir()) {
  return path.join(home, "Library", "Messages", "chat.db");
}

function readPermissionStatus({
  platform = process.platform,
  home = os.homedir(),
  accessSync = fs.accessSync,
  constants = fs.constants,
} = {}) {
  if (platform !== "darwin") {
    return {
      platform,
      ready: false,
      needsUserAction: false,
      messagesConfigured: false,
      panes: {
        "messages-data": "unavailable",
        fda: "unavailable",
        accessibility: "unavailable",
        automation: "unavailable",
        contacts: "unavailable",
      },
      reason: "macos-only",
    };
  }

  let messagesData = "denied";
  try {
    accessSync(messagesDbPath(home), constants.R_OK);
    messagesData = "granted";
  } catch {
    messagesData = "denied";
  }

  const ready = messagesData === "granted";
  return {
    platform,
    ready,
    needsUserAction: !ready,
    messagesConfigured: ready,
    panes: {
      "messages-data": messagesData,
      fda: messagesData,
      accessibility: ready ? "unknown" : "unknown",
      automation: ready ? "unknown" : "unknown",
      contacts: ready ? "unknown" : "unknown",
    },
    reason: ready ? "ok" : "needs-messages-data",
  };
}

function settingsTarget(pane) {
  return settingsUrl(pane);
}

module.exports = {
  messagesDbPath,
  readPermissionStatus,
  settingsTarget,
};
