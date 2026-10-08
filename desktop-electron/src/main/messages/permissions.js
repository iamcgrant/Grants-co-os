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
      messagesConfigured: false,
      panes: {
        "messages-data": "unavailable",
        fda: "unavailable",
        accessibility: "unknown",
        automation: "unknown",
        contacts: "unknown",
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

  return {
    platform,
    ready: messagesData === "granted",
    messagesConfigured: messagesData === "granted",
    panes: {
      "messages-data": messagesData,
      fda: messagesData,
      accessibility: "unknown",
      automation: "unknown",
      contacts: "unknown",
    },
    reason: messagesData === "granted" ? "ok" : "needs-messages-data",
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
