"use strict";

const { isAllowedOp, validateConversationId, validateRecipient, validateReaction, validateSearchQuery, validateSettingsPane, validateAttachmentPath, validateSendText, validateReply } = require("./ops");

function senderIsTrusted({ event, trustedWebContentsId, trustedFileUrl }) {
  const contents = event?.sender;
  if (!contents || contents.isDestroyed?.()) return false;
  if (contents.id !== trustedWebContentsId) return false;
  const url = String(contents.getURL?.() || "");
  if (!url.startsWith("file:")) return false;
  if (trustedFileUrl && url !== trustedFileUrl && !url.startsWith(trustedFileUrl)) {
    return false;
  }
  if (/os\.grantandconsultants\.com|gohighlevel|telegram\.org|experian|equifax|disputeprocess|cloudtaxoffice/i.test(url)) {
    return false;
  }
  return true;
}

function validatePayload(op, payload, fsAdapter) {
  if (!isAllowedOp(op)) return { ok: false, reason: "unknown-op" };

  switch (op) {
    case "permission-status":
    case "active-account":
    case "list-conversations":
    case "recheck-permissions":
    case "disconnect":
    case "unsubscribe":
      return { ok: true, payload: {} };
    case "load-messages":
    case "mark-read":
    case "subscribe-new":
    case "open-in-apple-messages": {
      const conversationId = validateConversationId(payload?.conversationId);
      if (!conversationId) return { ok: false, reason: "invalid-conversation-id" };
      return { ok: true, payload: { conversationId } };
    }
    case "send-text": {
      const next = validateSendText(payload);
      if (!next) return { ok: false, reason: "invalid-send" };
      return { ok: true, payload: next };
    }
    case "send-attachment": {
      const recipient = validateRecipient(payload?.recipient);
      const conversationId = payload?.conversationId
        ? validateConversationId(payload.conversationId)
        : recipient;
      const attachmentPath = validateAttachmentPath(payload?.attachmentPath, fsAdapter);
      if (!recipient || !conversationId || !attachmentPath) {
        return { ok: false, reason: "invalid-attachment" };
      }
      return { ok: true, payload: { recipient, conversationId, attachmentPath } };
    }
    case "reply": {
      const next = validateReply(payload);
      if (!next) return { ok: false, reason: "invalid-reply" };
      return { ok: true, payload: next };
    }
    case "react": {
      const conversationId = validateConversationId(payload?.conversationId);
      const messageId = validateConversationId(payload?.messageId);
      const reaction = validateReaction(payload?.reaction);
      if (!conversationId || !messageId || !reaction) {
        return { ok: false, reason: "invalid-react" };
      }
      return { ok: true, payload: { conversationId, messageId, reaction } };
    }
    case "search": {
      const query = validateSearchQuery(payload?.query);
      if (!query) return { ok: false, reason: "invalid-search" };
      return { ok: true, payload: { query } };
    }
    case "open-settings-pane": {
      const pane = validateSettingsPane(payload?.pane);
      if (!pane) return { ok: false, reason: "invalid-pane" };
      return { ok: true, payload: { pane } };
    }
    default: {
      const _exhaustive = op;
      void _exhaustive;
      return { ok: false, reason: "unknown-op" };
    }
  }
}

module.exports = {
  senderIsTrusted,
  validatePayload,
};
