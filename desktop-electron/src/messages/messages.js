"use strict";

const api = window.grantMessages;

const setup = document.getElementById("setup");
const inbox = document.getElementById("inbox");
const unavailable = document.getElementById("unavailable");
const setupStatus = document.getElementById("setup-status");
const unavailableStatus = document.getElementById("unavailable-status");
const conversationsEl = document.getElementById("conversations");
const threadTitle = document.getElementById("thread-title");
const threadBody = document.getElementById("thread-body");
const composer = document.getElementById("composer");
const composeText = document.getElementById("compose-text");
const search = document.getElementById("search");

let activeConversationId = "";
/** @type {Array<{ id: string, title: string, unread?: number }>} */
let conversations = [];

function hideAll() {
  setup.hidden = true;
  inbox.hidden = true;
  unavailable.hidden = true;
}

function showUnavailable(message) {
  hideAll();
  unavailable.hidden = false;
  unavailableStatus.textContent = message;
}

function showSetup(message) {
  hideAll();
  setup.hidden = false;
  setupStatus.textContent = message;
}

function showInbox() {
  hideAll();
  inbox.hidden = false;
}

function renderConversations(items) {
  conversations = Array.isArray(items) ? items : [];
  conversationsEl.replaceChildren();
  for (const item of conversations) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "conversation";
    button.classList.toggle("active", item.id === activeConversationId);
    const title = document.createElement("span");
    title.textContent = item.title || item.id;
    button.append(title);
    if (item.unread) {
      const badge = document.createElement("em");
      badge.className = "unread";
      badge.textContent = String(item.unread);
      button.append(badge);
    }
    button.addEventListener("click", () => openConversation(item.id, item.title));
    conversationsEl.append(button);
  }
}

function renderMessages(items) {
  threadBody.replaceChildren();
  for (const item of Array.isArray(items) ? items : []) {
    const bubble = document.createElement("div");
    bubble.className = item.outgoing ? "bubble me" : "bubble";
    if (item.text) bubble.textContent = item.text;
    if (item.attachment) {
      const attach = document.createElement("span");
      attach.className = "attach";
      attach.textContent = item.attachment;
      bubble.append(attach);
    }
    if (!item.text && !item.attachment) {
      bubble.textContent = item.outgoing ? "Sent" : "Received";
    }
    threadBody.append(bubble);
  }
  threadBody.scrollTop = threadBody.scrollHeight;
}

async function openConversation(id, title) {
  activeConversationId = id;
  threadTitle.textContent = title || id;
  renderConversations(conversations);
  const result = await api.invoke("load-messages", { conversationId: id });
  if (result?.ok) renderMessages(normalizeMessages(result.data));
  await api.invoke("subscribe-new", { conversationId: id });
  await api.invoke("mark-read", { conversationId: id });
}

function normalizeConversations(data) {
  const rows = Array.isArray(data) ? data : data?.chats || data?.conversations || [];
  return rows
    .map((row) => ({
      id: String(row.id || row.chatGuid || row.identifier || row.guid || ""),
      title: String(row.title || row.name || row.displayName || row.id || ""),
      unread: Number(row.unread || row.unreadCount || row.unread_count || 0) || 0,
    }))
    .filter((row) => row.id);
}

function normalizeMessages(data) {
  const rows = Array.isArray(data) ? data : data?.messages || [];
  return rows.map((row) => ({
    outgoing: Boolean(row.isFromMe || row.outgoing),
    text: typeof row.text === "string" ? row.text : "",
    attachment: row.attachments?.[0]?.name || row.fileName || (row.hasAttachments ? "Attachment" : ""),
  }));
}

function applyStatus(status) {
  if (status?.reason === "macos-only") {
    showUnavailable("Messages is available on the owner Mac after one-time System Settings grants.");
    return false;
  }
  if (status?.ready) {
    showInbox();
    return true;
  }
  if (status?.needsUserAction) {
    const missing = Object.entries(status.panes || {})
      .filter(([, value]) => value === "denied")
      .map(([key]) => key)
      .join(", ");
    showSetup(
      missing
        ? `macOS still needs ${missing}. Open System Settings, grant access, then return here.`
        : "Sign in to Messages on this Mac, then grant the listed permissions in System Settings.",
    );
    return false;
  }
  showUnavailable(status?.reason || "Messages is not ready.");
  return false;
}

async function hydrate() {
  const result = await api.invoke("hydrate");
  const status = result?.permissions || (await api.invoke("permission-status"));
  if (!applyStatus(status)) return;
  if (result?.conversations) renderConversations(normalizeConversations(result.conversations));
  else {
    const chats = await api.invoke("list-conversations");
    if (chats?.ok) renderConversations(normalizeConversations(chats.data));
  }
  const restoreId = result?.lastConversationId;
  if (restoreId) {
    const found = conversations.find((row) => row.id === restoreId);
    await openConversation(restoreId, found?.title || restoreId);
  }
}

document.querySelectorAll("[data-pane]").forEach((button) => {
  button.addEventListener("click", () => {
    api.invoke("open-settings-pane", { pane: button.getAttribute("data-pane") });
  });
});

document.getElementById("btn-recheck").addEventListener("click", () => hydrate());
document.getElementById("btn-open-messages").addEventListener("click", () => {
  api.invoke("open-in-apple-messages", {});
});
document.getElementById("btn-open-thread").addEventListener("click", () => {
  api.invoke("open-in-apple-messages", activeConversationId ? { conversationId: activeConversationId } : {});
});
document.getElementById("btn-disconnect").addEventListener("click", async () => {
  await api.invoke("disconnect");
  showSetup("Messages is disconnected. Apple Messages on this Mac was not deleted.");
});
document.getElementById("btn-attach").addEventListener("click", async () => {
  if (!activeConversationId) return;
  const picked = await api.pickAttachment();
  if (!picked?.path) return;
  await api.invoke("send-attachment", {
    conversationId: activeConversationId,
    recipient: activeConversationId,
    attachmentPath: picked.path,
  });
  await openConversation(activeConversationId, threadTitle.textContent);
});

composer.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!activeConversationId) return;
  const text = composeText.value;
  if (!text.trim()) return;
  composeText.value = "";
  await api.invoke("send-text", {
    conversationId: activeConversationId,
    recipient: activeConversationId,
    text,
  });
  await openConversation(activeConversationId, threadTitle.textContent);
});

search.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") return;
  const query = search.value.trim();
  if (!query) {
    hydrate();
    return;
  }
  const result = await api.invoke("search", { query });
  if (result?.ok) renderConversations(normalizeConversations(result.data));
});

if (!api) {
  showUnavailable("Messages is unavailable in this window.");
} else {
  api.onEvent((data) => {
    if (data?.kind === "conversations" || data?.kind === "realtime") {
      const next = normalizeConversations(data.payload);
      if (next.length) renderConversations(next);
    }
    if (data?.kind === "messages" && activeConversationId) {
      renderMessages(normalizeMessages(data.payload));
    }
    if (data?.kind === "permissions" || data?.kind === "permissions-revoked") {
      applyStatus(data.payload);
    }
    if (data?.kind === "hydrate") {
      applyStatus(data.payload?.permissions);
      if (data.payload?.conversations) {
        renderConversations(normalizeConversations(data.payload.conversations));
      }
    }
  });
  hydrate();
}
