"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("grantAbout", {
  onPayload: (callback) => {
    const listener = (_event, payload) => {
      callback(payload);
    };
    ipcRenderer.on("about:payload", listener);
    return () => ipcRenderer.removeListener("about:payload", listener);
  },
});
