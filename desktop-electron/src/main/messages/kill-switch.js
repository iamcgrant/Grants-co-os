"use strict";

const path = require("node:path");
const fs = require("node:fs");

const FLAG_NAME = "messages-desk.off";

function envDisabled(env = process.env) {
  const raw = String(env.GC_MESSAGES_DESK || "").trim().toLowerCase();
  return raw === "0" || raw === "off" || raw === "false" || raw === "disabled";
}

function flagPath(userData) {
  return path.join(String(userData || ""), FLAG_NAME);
}

function fileDisabled(userData, { existsSync } = fs) {
  if (!userData) return false;
  return existsSync(flagPath(userData));
}

function isMessagesDeskKilled({ env = process.env, userData, existsSync } = {}) {
  return envDisabled(env) || fileDisabled(userData, { existsSync: existsSync || fs.existsSync });
}

function writeKillFlag(userData) {
  fs.writeFileSync(flagPath(userData), "1\n", "utf8");
}

function clearKillFlag(userData) {
  const file = flagPath(userData);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

module.exports = {
  FLAG_NAME,
  envDisabled,
  fileDisabled,
  isMessagesDeskKilled,
  writeKillFlag,
  clearKillFlag,
};
