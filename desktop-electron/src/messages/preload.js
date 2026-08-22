"use strict";

const { contextBridge, ipcRenderer } = require("electron");

const OPS = [
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
];

contextBridge.exposeInMainWorld("grantMessages", {
  invoke: (op, payload) => {
    if (!OPS.includes(String(op))) return Promise.reject(new Error("unknown-op"));
    return ipcRenderer.invoke("messages:op", { op, payload: payload || {} });
  },
  pickAttachment: () => ipcRenderer.invoke("messages:pick-attachment"),
  onEvent: (callback) => {
    const listener = (_event, data) => {
      callback(data);
    };
    ipcRenderer.on("messages:event", listener);
    return () => ipcRenderer.removeListener("messages:event", listener);
  },
});
