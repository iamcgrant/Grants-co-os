"use strict";

const api = window.grantMessages;

const setup = document.getElementById("setup");
const inbox = document.getElementById("inbox");
const setupStatus = document.getElementById("setup-status");
const conversationsEl = document.getElementById("conversations");
const threadTitle = document.getElementById("thread-title");
const threadBody = document.getElementById("thread-body");
const composer = document.getElementById("composer");
const composeText = document.getElementById("compose-text");
const search = document.getElementById("search");

let activeConversationId = "";
/** @type {Array<{ id: string, title: string }>} */
let conversations = [];

function showSetup(message) {
  setup.hidden = false;
  inbox.hidden = true;
  setupStatus.textContent = message;
}

function showInbox() {
  setup.hidden = true;
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
    button.textContent = item.title || item.id;
    button.addEventListener("click", () => openConversation(item.id, item.title));
    conversationsEl.append(button);
  }
}

function renderMessages(items) {
  threadBody.replaceChildren();
  for (const item of Array.isArray(items) ? items : []) {
    const bubble = document.createElement("div");
    bubble.className = item.outgoing ? "bubble me" : "bubble";
    bubble.textContent = item.text || "";
    threadBody.append(bubble);
  }
}

async function openConversation(id, title) {
  activeConversationId = id;
  threadTitle.textContent = title || id;
  const result = await api.invoke("load-messages", { conversationId: id });
  if (result?.ok) renderMessages(normalizeMessages(result.data));
  await api.invoke("subscribe-new", { conversationId: id });
}

function normalizeConversations(data) {
  if (Array.isArray(data)) {
    return data
      .map((row) => ({
        id: String(row.id || row.chatGuid || row.identifier || ""),
        title: String(row.title || row.name || row.displayName || row.id || ""),
      }))
      .filter((row) => row.id);
  }
  if (Array.isArray(data?.chats)) return normalizeConversations(data.chats);
  return [];
}

function normalizeMessages(data) {
  const rows = Array.isArray(data) ? data : data?.messages || [];
  return rows.map((row) => ({
    outgoing: Boolean(row.isFromMe || row.outgoing),
    text: typeof row.text === "string" ? row.text : "",
  }));
}

async function refreshPermissions() {
  const status = await api.invoke("permission-status");
  const panes = status?.panes || {};
  if (status?.ready) {
    showInbox();
    const chats = await api.invoke("list-conversations");
    if (chats?.ok) renderConversations(normalizeConversations(chats.data));
    return;
  }
  const missing = Object.entries(panes)
    .filter(([, value]) => value === "denied")
    .map(([key]) => key)
    .join(", ");
  showSetup(
    missing
      ? `Finish System Settings for ${missing}, then return here.`
      : "Sign in to the Messages app on this Mac, then grant the listed permissions in System Settings.",
  );
}

document.querySelectorAll("[data-pane]").forEach((button) => {
  button.addEventListener("click", () => {
    api.invoke("open-settings-pane", { pane: button.getAttribute("data-pane") });
  });
});

document.getElementById("btn-recheck").addEventListener("click", () => refreshPermissions());
document.getElementById("btn-open-messages").addEventListener("click", () => {
  api.invoke("open-in-apple-messages", { conversationId: activeConversationId || "sms" });
});
document.getElementById("btn-open-thread").addEventListener("click", () => {
  if (activeConversationId) {
    api.invoke("open-in-apple-messages", { conversationId: activeConversationId });
  }
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
});

composer.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!activeConversationId) return;
  const text = composeText.value;
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
  if (!query) return;
  const result = await api.invoke("search", { query });
  if (result?.ok) renderConversations(normalizeConversations(result.data));
});

window.addEventListener("focus", () => {
  refreshPermissions();
});

if (!api) {
  showSetup("Messages is unavailable in this window.");
} else {
  api.onEvent((data) => {
    if (data?.kind === "conversations") renderConversations(normalizeConversations(data.payload));
    if (data?.kind === "permissions") refreshPermissions();
  });
  refreshPermissions();
}
