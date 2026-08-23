"use strict";

const path = require("node:path");
const {
  app,
  BaseWindow,
  WebContentsView,
  ipcMain,
  dialog,
  shell,
  session,
} = require("electron");
const { DESKS, deskById } = require("./desks");
const { classifyNavigation, isSafeExternalHttps } = require("./allowlist");
const {
  chromeWebPreferences,
  unprivilegedWebPreferences,
  assertUnprivilegedPrefs,
  isAllowedVendorPermission,
} = require("./security");
const { chromeBounds, vendorBounds } = require("./layout");
const { attachDownloadHandler } = require("./downloads");

const SMOKE = process.argv.includes("--smoke");
const CHROME_PRELOAD = path.join(__dirname, "..", "chrome", "preload.js");
const CHROME_PAGE = path.join(__dirname, "..", "chrome", "index.html");
let smokePassed = false;

/** Linux smoke VMs often lack user-namespace sandboxing. Windows `npm start` does not set this. */
if (SMOKE && process.platform === "linux") {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-dev-shm-usage");
}

/** @type {import('electron').BaseWindow | null} */
let mainWindow = null;
/** @type {import('electron').WebContentsView | null} */
let chromeView = null;
/** @type {Map<string, import('electron').WebContentsView>} */
const deskViews = new Map();
/** @type {Set<string>} */
const preparedPartitions = new Set();

let activeDeskId = "os";
/** @type {{ kind: string, message: string } | null} */
let notice = null;

function contentSize() {
  if (!mainWindow) return [1280, 800];
  return mainWindow.getContentSize();
}

function layoutViews() {
  if (!mainWindow || !chromeView) return;
  const [width, height] = contentSize();
  chromeView.setBounds(chromeBounds(width, height));
  const bounds = vendorBounds(width, height, Boolean(notice));
  for (const [id, view] of deskViews) {
    if (id === activeDeskId) {
      view.setBounds(bounds);
    } else {
      view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
  }
}

function setNotice(next) {
  notice = next;
  layoutViews();
  pushState();
}

function snapshot() {
  const openIds = DESKS.filter((desk) => deskViews.has(desk.id)).map((desk) => desk.id);
  const active = deskById(activeDeskId);
  const view = deskViews.get(activeDeskId) ?? null;
  const contents = view?.webContents ?? null;
  let url = active?.startUrl ?? "";
  let title = active?.title ?? "";
  let loading = false;
  let canGoBack = false;
  let canGoForward = false;

  if (contents && !contents.isDestroyed()) {
    url = contents.getURL() || url;
    title = contents.getTitle() || title;
    loading = contents.isLoading();
    canGoBack = contents.navigationHistory
      ? contents.navigationHistory.canGoBack()
      : contents.canGoBack();
    canGoForward = contents.navigationHistory
      ? contents.navigationHistory.canGoForward()
      : contents.canGoForward();
  }

  return {
    spike: true,
    activeDeskId,
    desks: DESKS.map((desk) => ({
      id: desk.id,
      title: desk.title,
      startUrl: desk.startUrl,
      allowedHosts: [...desk.allowedHosts],
      open: deskViews.has(desk.id),
    })),
    openIds,
    url,
    title,
    loading,
    canGoBack,
    canGoForward,
    notice,
  };
}

function pushState() {
  if (!chromeView || chromeView.webContents.isDestroyed()) return;
  chromeView.webContents.send("chrome:state", snapshot());
}

async function openHttpsInSystemBrowser(urlString) {
  if (!isSafeExternalHttps(urlString)) return false;
  await shell.openExternal(urlString);
  return true;
}

function authReturnMessage(desk, host) {
  return (
    `${desk.title} left the exact allowlist (${host || "unknown host"}). ` +
    `The official login stays available here. If sign-in needs another host, ` +
    `use Open securely in browser, finish there, then return to this spike. ` +
    `There is no grantscoos:// return — no provider documents that redirect.`
  );
}

function handleUnknownNavigation(desk, decision, { openExternal }) {
  if (decision.action === "block") {
    setNotice({
      kind: "error",
      message: `Blocked navigation for ${desk.title} (${decision.reason}).`,
    });
    return;
  }
  if (openExternal && decision.url) {
    openHttpsInSystemBrowser(decision.url).catch(() => {});
  }
  setNotice({
    kind: "warn",
    message: authReturnMessage(desk, decision.host),
  });
}

function attachNavigationGuards(contents, desk) {
  contents.setWindowOpenHandler(({ url }) => {
    const decision = classifyNavigation(url, desk.allowedHosts);
    if (decision.action === "allow") {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 960,
          height: 720,
          autoHideMenuBar: true,
          webPreferences: unprivilegedWebPreferences(desk.partition),
        },
      };
    }
    handleUnknownNavigation(desk, decision, { openExternal: decision.action === "system-browser" });
    return { action: "deny" };
  });

  contents.on("will-navigate", (event, url) => {
    const decision = classifyNavigation(url, desk.allowedHosts);
    if (decision.action === "allow") return;
    event.preventDefault();
    handleUnknownNavigation(desk, decision, { openExternal: decision.action === "system-browser" });
  });

  contents.on("will-redirect", (event, url) => {
    const decision = classifyNavigation(url, desk.allowedHosts);
    if (decision.action === "allow") return;
    event.preventDefault();
    handleUnknownNavigation(desk, decision, { openExternal: decision.action === "system-browser" });
  });

  contents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });

  contents.on("did-start-loading", () => pushState());
  contents.on("did-stop-loading", () => pushState());
  contents.on("did-navigate", () => pushState());
  contents.on("did-navigate-in-page", () => pushState());
  contents.on("page-title-updated", () => pushState());
  contents.on("did-fail-load", (_event, code, desc, _url, isMainFrame) => {
    if (!isMainFrame) return;
    if (code === -3) return; // ABORTED (allowlist cancel)
    setNotice({
      kind: "error",
      message: `${desk.title} failed to load: ${desc || "unknown error"}`,
    });
  });
}

function preparePartition(desk) {
  if (preparedPartitions.has(desk.partition)) return;
  const ses = session.fromPartition(desk.partition);
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    if (isAllowedVendorPermission(permission)) {
      callback(true);
      return;
    }
    callback(false);
    setNotice({
      kind: "warn",
      message: `Denied “${permission}” on ${desk.title}. This spike allows storage-access only so official desks can keep their own login cookies.`,
    });
  });
  ses.setPermissionCheckHandler((_wc, permission) => isAllowedVendorPermission(permission));
  attachDownloadHandler(ses, {
    deskTitle: desk.title,
    getWindow: () => mainWindow,
    dialog,
    onNotice: setNotice,
  });
  preparedPartitions.add(desk.partition);
}

function createDeskView(desk) {
  preparePartition(desk);
  const prefs = unprivilegedWebPreferences(desk.partition);
  assertUnprivilegedPrefs(prefs);
  const view = new WebContentsView({ webPreferences: prefs });
  attachNavigationGuards(view.webContents, desk);
  view.webContents.loadURL(desk.startUrl);
  return view;
}

function showDesk(id) {
  const desk = deskById(id);
  if (!desk || !mainWindow) return snapshot();

  if (!deskViews.has(desk.id)) {
    const view = createDeskView(desk);
    deskViews.set(desk.id, view);
    mainWindow.contentView.addChildView(view);
  }

  activeDeskId = desk.id;
  const activeView = deskViews.get(desk.id);
  if (activeView) {
    mainWindow.contentView.addChildView(activeView);
  }
  layoutViews();
  pushState();
  return snapshot();
}

function closeDesk(id) {
  const view = deskViews.get(id);
  if (view && mainWindow) {
    mainWindow.contentView.removeChildView(view);
    if (!view.webContents.isDestroyed()) {
      view.webContents.close();
    }
    deskViews.delete(id);
  }
  if (activeDeskId === id) {
    const fallback = DESKS.find((desk) => deskViews.has(desk.id));
    activeDeskId = fallback ? fallback.id : "os";
    if (fallback) {
      showDesk(fallback.id);
    } else {
      layoutViews();
      pushState();
    }
  } else {
    pushState();
  }
  return snapshot();
}

function navigate(action) {
  const view = deskViews.get(activeDeskId);
  if (!view || view.webContents.isDestroyed()) return snapshot();
  const contents = view.webContents;
  switch (action) {
    case "back":
      if (contents.navigationHistory?.canGoBack()) contents.navigationHistory.goBack();
      else if (contents.canGoBack()) contents.goBack();
      break;
    case "forward":
      if (contents.navigationHistory?.canGoForward()) contents.navigationHistory.goForward();
      else if (contents.canGoForward()) contents.goForward();
      break;
    case "reload":
      contents.reload();
      break;
    default: {
      const _exhaustive = action;
      void _exhaustive;
      break;
    }
  }
  pushState();
  return snapshot();
}

async function clearSiteData(id) {
  const desk = deskById(id);
  if (!desk) return snapshot();
  const { response } = await dialog.showMessageBox(mainWindow ?? undefined, {
    type: "warning",
    buttons: ["Clear site data and sign out", "Cancel"],
    defaultId: 1,
    cancelId: 1,
    title: "Clear site data",
    message: `Clear site data and sign out of ${desk.title}?`,
    detail:
      "This clears stored site data for this desk’s partition only. Cookies are not copied, inspected, exported, or modified individually. You will need to sign in again.",
  });
  if (response !== 0) return snapshot();
  const ses = session.fromPartition(desk.partition);
  await ses.clearStorageData();
  await ses.clearCache();
  const view = deskViews.get(desk.id);
  if (view && !view.webContents.isDestroyed()) {
    view.webContents.loadURL(desk.startUrl);
  }
  setNotice({
    kind: "success",
    message: `Cleared site data for ${desk.title}. Sign in again if you need that desk.`,
  });
  return snapshot();
}

async function openOfficialInBrowser(id) {
  const desk = deskById(id);
  if (!desk) return snapshot();
  const opened = await openHttpsInSystemBrowser(desk.startUrl);
  setNotice({
    kind: opened ? "info" : "error",
    message: opened
      ? `Opened the official ${desk.title} login in your system browser. This spike stays open. Return here after sign-in. No grantscoos:// return exists.`
      : `Could not open the official ${desk.title} URL.`,
  });
  return snapshot();
}

function registerIpc() {
  ipcMain.handle("chrome:get-state", () => snapshot());
  ipcMain.handle("chrome:select-desk", (_event, id) => showDesk(String(id)));
  ipcMain.handle("chrome:nav", (_event, action) => navigate(String(action)));
  ipcMain.handle("chrome:close", (_event, id) => closeDesk(String(id)));
  ipcMain.handle("chrome:clear", (_event, id) => clearSiteData(String(id)));
  ipcMain.handle("chrome:open-browser", (_event, id) => openOfficialInBrowser(String(id)));
  ipcMain.handle("chrome:dismiss-notice", () => {
    notice = null;
    layoutViews();
    pushState();
    return snapshot();
  });
}

function createWindow() {
  mainWindow = new BaseWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    title: "Grants & Co OS — Electron spike",
    backgroundColor: "#16161a",
    show: false,
  });

  chromeView = new WebContentsView({
    webPreferences: chromeWebPreferences(CHROME_PRELOAD),
  });
  chromeView.webContents.loadFile(CHROME_PAGE);
  mainWindow.contentView.addChildView(chromeView);

  mainWindow.on("resize", () => layoutViews());
  mainWindow.on("closed", () => {
    for (const view of deskViews.values()) {
      if (!view.webContents.isDestroyed()) view.webContents.close();
    }
    deskViews.clear();
    if (chromeView && !chromeView.webContents.isDestroyed()) {
      chromeView.webContents.close();
    }
    chromeView = null;
    mainWindow = null;
  });

  chromeView.webContents.once("did-finish-load", () => {
    if (SMOKE) {
      smokePassed = true;
      if (mainWindow) mainWindow.show();
      const [width, height] = contentSize();
      console.log(`SMOKE_OK chrome=${width}x${height} desks=${DESKS.length}`);
      setTimeout(() => app.quit(), 800);
      return;
    }
    showDesk("os");
    if (mainWindow) mainWindow.show();
    pushState();
  });

  chromeView.webContents.on("render-process-gone", (_event, details) => {
    console.error("chrome renderer gone", details);
  });

  layoutViews();
}

app.on("web-contents-created", (_event, contents) => {
  contents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
});

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  if (SMOKE) {
    setTimeout(() => {
      if (!smokePassed) {
        console.error("SMOKE_FAIL chrome did not finish load");
        app.exit(1);
      }
    }, 10000);
  }
});

app.on("window-all-closed", () => {
  app.quit();
});
