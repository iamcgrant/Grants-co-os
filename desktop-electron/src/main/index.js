"use strict";

const path = require("node:path");
const fs = require("node:fs");
const {
  app,
  BaseWindow,
  WebContentsView,
  ipcMain,
  dialog,
  shell,
  session,
  net,
  Menu,
} = require("electron");
const { PRODUCT_NAME, OS_ORIGIN } = require("../product");
const { VENDOR_DESKS, MESSAGES_DESK, deskById, visibleDesks } = require("./desks");
const { classifyNavigation, isSafeExternalHttps } = require("./allowlist");
const {
  chromeWebPreferences,
  unprivilegedWebPreferences,
  messagesWebPreferences,
  assertUnprivilegedPrefs,
  assertMessagesPrefs,
} = require("./security");
const { chromeBounds, vendorBounds } = require("./layout");
const { attachDownloadHandler } = require("./downloads");
const { openAboutWindow } = require("./about");
const { buildAppMenuTemplate } = require("./menu");
const { readWordmarkDataUrl } = require("./brand-paths");
const { createEntitlementStore, fetchOwnerEntitlement } = require("./messages/entitlement");
const { isMessagesDeskKilled } = require("./messages/kill-switch");
const { createHelper } = require("./messages/helper");
const { readPermissionStatus, settingsTarget } = require("./messages/permissions");
const { senderIsTrusted, validatePayload } = require("./messages/ipc");
const { safeLog } = require("./messages/log");

const SMOKE = process.argv.includes("--smoke");
const CHROME_PRELOAD = path.join(__dirname, "..", "chrome", "preload.js");
const CHROME_PAGE = path.join(__dirname, "..", "chrome", "index.html");
const MESSAGES_PRELOAD = path.join(__dirname, "..", "messages", "preload.js");
const MESSAGES_PAGE = path.join(__dirname, "..", "messages", "index.html");
let smokePassed = false;

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
/** @type {import('electron').WebContentsView | null} */
let messagesView = null;
/** @type {Map<string, import('electron').WebContentsView>} */
const deskViews = new Map();
/** @type {Set<string>} */
const preparedPartitions = new Set();
/** @type {Map<string, string>} */
const deskSurfaces = new Map();

let activeDeskId = "os";
/** @type {{ kind: string, message: string } | null} */
let notice = null;
let unsubscribeMessages = null;
const entitlementStore = createEntitlementStore();
let helper = null;

function extraResourcesPath() {
  if (app.isPackaged) return process.resourcesPath;
  return path.join(__dirname, "..", "..");
}

function messagesVisible() {
  if (isMessagesDeskKilled({ userData: app.getPath("userData") })) return false;
  return entitlementStore.isEntitled();
}

function desks() {
  return visibleDesks(messagesVisible());
}

function contentSize() {
  if (!mainWindow) return [1280, 800];
  return mainWindow.getContentSize();
}

function contentReady(id) {
  return deskSurfaces.get(id) === "ready";
}

function layoutViews() {
  if (!mainWindow || !chromeView) return;
  const [width, height] = contentSize();
  chromeView.setBounds(chromeBounds(width, height));
  const bounds = vendorBounds(width, height, Boolean(notice));
  const hidden = { x: 0, y: 0, width: 0, height: 0 };
  for (const [id, view] of deskViews) {
    const show = id === activeDeskId && (id === "messages" || contentReady(id) || deskSurfaces.get(id) === "ready");
    view.setBounds(show && id !== "messages" && contentReady(id) ? bounds : hidden);
  }
  if (messagesView) {
    const showMessages = activeDeskId === "messages" && messagesVisible();
    messagesView.setBounds(showMessages ? bounds : hidden);
  }
}

function setNotice(next) {
  notice = next;
  layoutViews();
  pushState();
}

function setSurface(id, kind) {
  deskSurfaces.set(id, kind);
  layoutViews();
  pushState();
}

function snapshot() {
  const catalog = desks();
  const active = deskById(activeDeskId, catalog);
  const view = deskViews.get(activeDeskId) ?? null;
  const contents = view?.webContents ?? null;
  let title = active?.title ?? "";
  let loading = false;
  let canGoBack = false;

  if (contents && !contents.isDestroyed() && active?.kind === "vendor") {
    title = contents.getTitle() || title;
    loading = contents.isLoading();
    canGoBack = contents.navigationHistory
      ? contents.navigationHistory.canGoBack()
      : contents.canGoBack();
  }

  const surface = deskSurfaces.get(activeDeskId) || (loading ? "loading" : "welcome");
  const fallbackKinds = new Set(["error", "blocked", "cert", "crashed"]);
  return {
    productName: PRODUCT_NAME,
    activeDeskId,
    desks: catalog.map((desk) => ({
      id: desk.id,
      title: desk.title,
      kind: desk.kind,
      startUrl: desk.startUrl || "",
      allowedHosts: desk.allowedHosts ? [...desk.allowedHosts] : [],
      open: desk.id === "messages" ? Boolean(messagesView) : deskViews.has(desk.id),
    })),
    title,
    loading,
    canGoBack,
    canGoForward: false,
    notice,
    surface,
    openInBrowserAvailable: Boolean(active?.kind === "vendor" && fallbackKinds.has(surface)),
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
    `use Open securely in browser, finish there, then return. ` +
    `There is no grantscoos:// return — no provider documents that redirect.`
  );
}

function handleUnknownNavigation(desk, decision, { openExternal }) {
  setSurface(desk.id, "blocked");
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

  contents.on("did-start-loading", () => {
    if (deskSurfaces.get(desk.id) !== "ready") setSurface(desk.id, "loading");
    pushState();
  });
  contents.on("did-stop-loading", () => {
    if (deskSurfaces.get(desk.id) === "loading") setSurface(desk.id, "ready");
    pushState();
  });
  contents.on("did-navigate", () => {
    setSurface(desk.id, "ready");
  });
  contents.on("did-navigate-in-page", () => pushState());
  contents.on("page-title-updated", () => pushState());
  contents.on("did-fail-load", (_event, code, desc, _url, isMainFrame) => {
    if (!isMainFrame) return;
    if (code === -3) return;
    setSurface(desk.id, "error");
    setNotice({
      kind: "error",
      message: `${desk.title} failed to load: ${desc || "unknown error"} (${code})`,
    });
  });
  contents.on("certificate-error", (_event, _url, error) => {
    setSurface(desk.id, "cert");
    setNotice({
      kind: "cert",
      message: `${desk.title} certificate error (${error}). The certificate was not accepted.`,
    });
  });
  contents.on("render-process-gone", (_event, details) => {
    setSurface(desk.id, "crashed");
    setNotice({
      kind: "crashed",
      message: `${desk.title} stopped (${details?.reason || "renderer closed"}).`,
    });
  });
}

function preparePartition(desk) {
  if (preparedPartitions.has(desk.partition)) return;
  const ses = session.fromPartition(desk.partition);
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(false);
    setNotice({
      kind: "warn",
      message: `Denied “${permission}” on ${desk.title}. Vendor pages do not receive extra permissions.`,
    });
  });
  ses.setPermissionCheckHandler(() => false);
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
  setSurface(desk.id, "loading");
  view.webContents.loadURL(desk.startUrl);
  return view;
}

function ensureMessagesView() {
  if (messagesView || !mainWindow || !messagesVisible()) return;
  const prefs = messagesWebPreferences(MESSAGES_PRELOAD);
  assertMessagesPrefs(prefs);
  messagesView = new WebContentsView({ webPreferences: prefs });
  messagesView.webContents.loadFile(MESSAGES_PAGE);
  mainWindow.contentView.addChildView(messagesView);
  deskViews.set("messages", messagesView);
  setSurface("messages", "ready");
}

function destroyMessagesView() {
  if (unsubscribeMessages) {
    unsubscribeMessages();
    unsubscribeMessages = null;
  }
  if (helper) helper.stop();
  if (messagesView && mainWindow) {
    mainWindow.contentView.removeChildView(messagesView);
    if (!messagesView.webContents.isDestroyed()) messagesView.webContents.close();
  }
  messagesView = null;
  deskViews.delete("messages");
}

async function refreshEntitlement() {
  if (isMessagesDeskKilled({ userData: app.getPath("userData") })) {
    entitlementStore.set({ entitled: false, reason: "killed" });
    destroyMessagesView();
    pushState();
    return entitlementStore.peek();
  }
  try {
    const ses = session.fromPartition("persist:gc-os");
    const result = await fetchOwnerEntitlement({
      netFetch: net.fetch.bind(net),
      session: ses,
      origin: OS_ORIGIN,
    });
    entitlementStore.set(result);
  } catch {
    entitlementStore.set({ entitled: false, reason: "entitlement-unreachable" });
  }
  if (!entitlementStore.isEntitled()) destroyMessagesView();
  pushState();
  return entitlementStore.peek();
}

function showDesk(id) {
  const catalog = desks();
  const desk = deskById(id, catalog);
  if (!desk || !mainWindow) return snapshot();

  if (desk.kind === "local-trusted") {
    if (!messagesVisible()) return snapshot();
    ensureMessagesView();
    helper = helper || createHelper({
      userData: app.getPath("userData"),
      extraResourcesPath: extraResourcesPath(),
    });
    activeDeskId = desk.id;
    layoutViews();
    pushState();
    return snapshot();
  }

  if (!deskViews.has(desk.id)) {
    const view = createDeskView(desk);
    deskViews.set(desk.id, view);
    mainWindow.contentView.addChildView(view);
  }

  activeDeskId = desk.id;
  const activeView = deskViews.get(desk.id);
  if (activeView) mainWindow.contentView.addChildView(activeView);
  layoutViews();
  pushState();
  return snapshot();
}

function closeDesk(id) {
  if (id === "messages") {
    destroyMessagesView();
    activeDeskId = "os";
    showDesk("os");
    return snapshot();
  }
  const view = deskViews.get(id);
  if (view && mainWindow) {
    mainWindow.contentView.removeChildView(view);
    if (!view.webContents.isDestroyed()) view.webContents.close();
    deskViews.delete(id);
    deskSurfaces.delete(id);
  }
  if (activeDeskId === id) {
    const fallback = VENDOR_DESKS.find((desk) => deskViews.has(desk.id));
    activeDeskId = fallback ? fallback.id : "os";
    if (fallback) showDesk(fallback.id);
    else {
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
  if (activeDeskId === "messages") return snapshot();
  const contents = view.webContents;
  switch (action) {
    case "back":
      if (contents.navigationHistory?.canGoBack()) contents.navigationHistory.goBack();
      else if (contents.canGoBack()) contents.goBack();
      break;
    case "reload":
      setSurface(activeDeskId, "loading");
      contents.reload();
      break;
    case "forward":
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
  const desk = deskById(id, VENDOR_DESKS);
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
    setSurface(desk.id, "loading");
    view.webContents.loadURL(desk.startUrl);
  }
  setNotice({
    kind: "success",
    message: `Cleared site data for ${desk.title}. Sign in again if you need that desk.`,
  });
  return snapshot();
}

async function openOfficialInBrowser(id) {
  const desk = deskById(id, VENDOR_DESKS);
  if (!desk) return snapshot();
  const opened = await openHttpsInSystemBrowser(desk.startUrl);
  setNotice({
    kind: opened ? "info" : "error",
    message: opened
      ? `Opened the official ${desk.title} login in your system browser. Grant & Co OS stays open. Return here after sign-in. No grantscoos:// return exists.`
      : `Could not open the official ${desk.title} URL.`,
  });
  return snapshot();
}

function openAbout() {
  openAboutWindow({
    BaseWindow,
    WebContentsView,
    parent: mainWindow,
    wordmarkDataUrl: readWordmarkDataUrl(),
    openExternal: (url) => {
      openHttpsInSystemBrowser(url).catch(() => {});
    },
  });
}

function messagesTrusted(event) {
  if (!messagesView || messagesView.webContents.isDestroyed()) return false;
  return senderIsTrusted({
    event,
    trustedWebContentsId: messagesView.webContents.id,
    trustedFileUrl: messagesView.webContents.getURL(),
  });
}

async function handleMessagesOp(event, request) {
  if (!messagesVisible()) return { ok: false, reason: "not-entitled" };
  if (!messagesTrusted(event)) return { ok: false, reason: "untrusted-sender" };
  const op = String(request?.op || "");
  const checked = validatePayload(op, request?.payload || {}, {
    existsSync: fs.existsSync,
    isAbsolute: path.isAbsolute,
  });
  if (!checked.ok) return checked;

  helper = helper || createHelper({
    userData: app.getPath("userData"),
    extraResourcesPath: extraResourcesPath(),
  });

  switch (op) {
    case "permission-status":
    case "recheck-permissions":
      return readPermissionStatus();
    case "open-settings-pane": {
      const url = settingsTarget(checked.payload.pane);
      if (url) await shell.openExternal(url);
      return { ok: Boolean(url) };
    }
    case "disconnect":
      helper.disconnect();
      destroyMessagesView();
      safeLog("info", "messages-disconnected", { appleMessagesPreserved: true });
      return { ok: true };
    case "unsubscribe":
      if (unsubscribeMessages) unsubscribeMessages();
      unsubscribeMessages = null;
      return { ok: true };
    case "subscribe-new":
      if (unsubscribeMessages) unsubscribeMessages();
      unsubscribeMessages = helper.subscribe((data) => {
        if (messagesView && !messagesView.webContents.isDestroyed()) {
          messagesView.webContents.send("messages:event", { kind: "conversations", payload: data });
        }
      });
      return { ok: true };
    case "open-in-apple-messages":
      if (helper.available()) {
        const result = await helper.run(op, checked.payload);
        if (result.ok) return result;
      }
      return { ok: helper.openAppleMessages() };
    default:
      return helper.run(op, checked.payload);
  }
}

function registerIpc() {
  ipcMain.handle("chrome:get-state", () => snapshot());
  ipcMain.handle("chrome:get-brand", () => ({ wordmarkDataUrl: readWordmarkDataUrl() }));
  ipcMain.handle("chrome:select-desk", (_event, id) => showDesk(String(id)));
  ipcMain.handle("chrome:nav", (_event, action) => navigate(String(action)));
  ipcMain.handle("chrome:close", (_event, id) => closeDesk(String(id)));
  ipcMain.handle("chrome:clear", (_event, id) => clearSiteData(String(id)));
  ipcMain.handle("chrome:open-browser", (_event, id) => openOfficialInBrowser(String(id)));
  ipcMain.handle("chrome:open-about", () => {
    openAbout();
    return snapshot();
  });
  ipcMain.handle("chrome:dismiss-notice", () => {
    notice = null;
    layoutViews();
    pushState();
    return snapshot();
  });
  ipcMain.handle("messages:op", (event, request) => handleMessagesOp(event, request));
  ipcMain.handle("messages:pick-attachment", async (event) => {
    if (!messagesTrusted(event)) return { path: null };
    const picked = await dialog.showOpenDialog(mainWindow ?? undefined, {
      title: "Send attachment",
      properties: ["openFile"],
    });
    if (picked.canceled || !picked.filePaths[0]) return { path: null };
    return { path: picked.filePaths[0] };
  });
}

function createWindow() {
  mainWindow = new BaseWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    title: PRODUCT_NAME,
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
    destroyMessagesView();
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
      console.log(`SMOKE_OK chrome=${width}x${height} desks=${VENDOR_DESKS.length}`);
      setTimeout(() => app.quit(), 800);
      return;
    }
    showDesk("os");
    refreshEntitlement().catch(() => {});
    if (mainWindow) mainWindow.show();
    pushState();
  });

  chromeView.webContents.on("render-process-gone", (_event, details) => {
    setNotice({
      kind: "crashed",
      message: `Grant & Co OS chrome stopped (${details?.reason || "renderer closed"}).`,
    });
  });

  layoutViews();
}

app.on("web-contents-created", (_event, contents) => {
  contents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
});

app.on("certificate-error", (event, _webContents, url, error, _cert, callback) => {
  event.preventDefault();
  callback(false);
  setNotice({
    kind: "cert",
    message: `Certificate error (${error}) for a secure page. The certificate was not accepted.`,
  });
  const active = deskById(activeDeskId, desks());
  if (active) setSurface(active.id, "cert");
  void url;
});

app.whenReady().then(() => {
  app.setName(PRODUCT_NAME);
  app.setAboutPanelOptions({
    applicationName: PRODUCT_NAME,
    applicationVersion: "1.0.0",
    copyright: "© Grant & Co Consultants",
    website: "https://grantandconsultants.com",
  });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      buildAppMenuTemplate({
        onAbout: openAbout,
        onQuit: () => app.quit(),
      }),
    ),
  );
  registerIpc();
  createWindow();
  setInterval(() => {
    if (!SMOKE) refreshEntitlement().catch(() => {});
  }, 10 * 60 * 1000);
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
