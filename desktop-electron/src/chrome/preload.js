"use strict";

const { contextBridge, ipcRenderer } = require("electron");

/**
 * Chrome-only bridge. This preload is never attached to OS or vendor views.
 * Do not expose Electron, session, cookies, or file-system APIs.
 */
contextBridge.exposeInMainWorld("spikeChrome", {
  getState: () => ipcRenderer.invoke("chrome:get-state"),
  selectDesk: (id) => ipcRenderer.invoke("chrome:select-desk", id),
  nav: (action) => ipcRenderer.invoke("chrome:nav", action),
  closeDesk: (id) => ipcRenderer.invoke("chrome:close", id),
  clearSiteData: (id) => ipcRenderer.invoke("chrome:clear", id),
  openInBrowser: (id) => ipcRenderer.invoke("chrome:open-browser", id),
  dismissNotice: () => ipcRenderer.invoke("chrome:dismiss-notice"),
  onState: (callback) => {
    const listener = (_event, state) => {
      callback(state);
    };
    ipcRenderer.on("chrome:state", listener);
    return () => ipcRenderer.removeListener("chrome:state", listener);
  },
});
