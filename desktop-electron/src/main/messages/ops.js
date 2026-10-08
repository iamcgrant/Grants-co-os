"use strict";

/**
 * Allowed Messages IPC operations. Main process validates every field
 * before the helper is started. Vendor / OS Home views never reach this.
 */

const OPS = Object.freeze([
  "permission-status",
  "active-account",
  "list-conversations",
  "load-messages",
  "subscribe-new",
  "unsubscribe",
  "send-text",
  "send-attachment",
  "reply",
  "react",
  "mark-read",
  "search",
  "open-in-apple-messages",
  "open-settings-pane",
  "recheck-permissions",
  "disconnect",
]);

const SETTINGS_PANES = Object.freeze({
  "messages-data": "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles",
  fda: "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles",
  accessibility: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
  automation: "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation",
  contacts: "x-apple.systempreferences:com.apple.preference.security?Privacy_Contacts",
});

const CONVERSATION_ID = /^[A-Za-z0-9:_+\-.@;]{1,128}$/;
const RECIPIENT = /^(?:\+[0-9]{8,16}|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|[A-Za-z0-9:_+\-.@;]{1,128})$/;
const REACTION = /^(?:love|like|dislike|laugh|emphasize|question|heart|thumbs-up|thumbs-down|haha|exclamation|\u{2764}|\u{1F44D}|\u{1F44E}|\u{1F606}|\u{203C}|\u{2753})$/u;
const SEARCH = /^[\p{L}\p{N} .,@+\-_'!?#]{1,120}$/u;

function isAllowedOp(op) {
  return OPS.includes(String(op || ""));
}

function validateConversationId(value) {
  const id = String(value || "").trim();
  if (!CONVERSATION_ID.test(id)) return null;
  return id;
}

function validateRecipient(value) {
  const recipient = String(value || "").trim();
  if (!RECIPIENT.test(recipient)) return null;
  if (recipient.includes("..") || recipient.includes("/") || recipient.includes("\\")) return null;
  return recipient;
}

function validateReaction(value) {
  const reaction = String(value || "").trim().toLowerCase();
  if (!REACTION.test(reaction)) return null;
  return reaction;
}

function validateSearchQuery(value) {
  const query = String(value || "").trim();
  if (!SEARCH.test(query)) return null;
  return query;
}

function validateSettingsPane(value) {
  const pane = String(value || "").trim();
  return Object.prototype.hasOwnProperty.call(SETTINGS_PANES, pane) ? pane : null;
}

function settingsUrl(pane) {
  const key = validateSettingsPane(pane);
  return key ? SETTINGS_PANES[key] : null;
}

/**
 * Attachment paths must be absolute, existing files, with no traversal.
 * Main should prefer a Save/Open dialog path it already chose.
 */
function validateAttachmentPath(value, { existsSync, isAbsolute }) {
  const raw = String(value || "").trim();
  if (!raw || raw.includes("\0")) return null;
  if (!isAbsolute(raw)) return null;
  if (raw.split(/[/\\]/).includes("..")) return null;
  if (!existsSync(raw)) return null;
  return raw;
}

function validateSendText(payload) {
  const recipient = validateRecipient(payload?.recipient);
  const conversationId = payload?.conversationId
    ? validateConversationId(payload.conversationId)
    : recipient;
  const text = typeof payload?.text === "string" ? payload.text : "";
  if (!conversationId || !recipient) return null;
  if (text.length === 0 || text.length > 8000) return null;
  return { conversationId, recipient, text };
}

function validateReply(payload) {
  const conversationId = validateConversationId(payload?.conversationId);
  const text = typeof payload?.text === "string" ? payload.text : "";
  const messageId = payload?.messageId ? validateConversationId(payload.messageId) : "latest";
  if (!conversationId || text.length === 0 || text.length > 8000) return null;
  return { conversationId, messageId, text };
}

module.exports = {
  OPS,
  SETTINGS_PANES,
  isAllowedOp,
  validateConversationId,
  validateRecipient,
  validateReaction,
  validateSearchQuery,
  validateSettingsPane,
  settingsUrl,
  validateAttachmentPath,
  validateSendText,
  validateReply,
};
