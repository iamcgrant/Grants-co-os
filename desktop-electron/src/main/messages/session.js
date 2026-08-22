"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { validateConversationId } = require("./ops");

const SESSION_FILE = "messages-owner-session.json";

function sessionPath(userData) {
  return path.join(String(userData || ""), SESSION_FILE);
}

function emptySession() {
  return { lastDeskId: null, lastConversationId: null, updatedAt: 0 };
}

function readOwnerSession(userData, { readFileSync = fs.readFileSync, existsSync = fs.existsSync } = {}) {
  const file = sessionPath(userData);
  if (!userData || !existsSync(file)) return emptySession();
  try {
    const raw = JSON.parse(readFileSync(file, "utf8"));
    if (!raw || typeof raw !== "object") return emptySession();
    const lastDeskId = raw.lastDeskId === "messages" ? "messages" : null;
    const lastConversationId = validateConversationId(raw.lastConversationId);
    return {
      lastDeskId,
      lastConversationId,
      updatedAt: Number(raw.updatedAt) || 0,
    };
  } catch {
    return emptySession();
  }
}

function writeOwnerSession(
  userData,
  next,
  { writeFileSync = fs.writeFileSync, mkdirSync = fs.mkdirSync } = {},
) {
  if (!userData) return emptySession();
  const lastConversationId = validateConversationId(next?.lastConversationId);
  const record = {
    lastDeskId: next?.lastDeskId === "messages" ? "messages" : null,
    lastConversationId,
    updatedAt: Date.now(),
  };
  mkdirSync(userData, { recursive: true });
  writeFileSync(sessionPath(userData), `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

function clearOwnerSession(userData, { existsSync = fs.existsSync, unlinkSync = fs.unlinkSync } = {}) {
  const file = sessionPath(userData);
  if (existsSync(file)) unlinkSync(file);
}

function sessionContainsBodies(record) {
  const text = JSON.stringify(record || {});
  return /"(text|body|preview|content|attachment)"\s*:/.test(text);
}

module.exports = {
  SESSION_FILE,
  sessionPath,
  readOwnerSession,
  writeOwnerSession,
  clearOwnerSession,
  sessionContainsBodies,
};
