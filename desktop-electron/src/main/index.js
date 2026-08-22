"use strict";

const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const {
  app,
  BaseWindow,
  WebContentsView,
  ipcMain,
  dialog,
  shell,
  session,
  net,
  powerMonitor,
} = require("electron");
const { OS_ORIGIN } = require("../product");
const { DESKS, deskById, visibleDesks } = require("./desks");
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
const { createEntitlementStore, fetchOwnerEntitlement, isOsHomeLoginUrl } = require("./messages/entitlement");
const { shouldInjectOsHomeChrome, injectOsHomeChrome } = require("./home-chrome");
const { isMessagesDeskKilled } = require("./messages/kill-switch");
const { createHelper } = require("./messages/helper");
const { readPermissionStatus, settingsTarget } = require("./messages/permissions");
const { senderIsTrusted, validatePayload } = require("./messages/ipc");
const { isUserSendOp } = require("./messages/ops");
const { createSupervisor } = require("./messages/supervisor");
const { readOwnerSession, writeOwnerSession } = require("./messages/session");
const { safeLog } = require("./messages/log");

const SMOKE = process.argv.includes("--smoke");
const CHROME_PRELOAD = path.join(__dirname, "..", "chrome", "preload.js");
const CHROME_PAGE = path.join(__dirname, "..", "chrome", "index.html");
const MESSAGES_PRELOAD = path.join(__dirname, "..", "messages", "preload.js");
const MESSAGES_PAGE = path.join(__dirname, "..", "messages", "index.html");
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
/** @type {import('electron').WebContentsView | null} */
let messagesView = null;
/** @type {Map<string, import('electron').WebContentsView>} */
const deskViews = new Map();
/** @type {Set<string>} */
const preparedPartitions = new Set();

let activeDeskId = "os";
/** @type {{ kind: string, message: string, allowBrowser?: boolean } | null} */
let notice = null;
/** Official start URL was actually requested for this desk. */
const officialAttempted = new Set();

const entitlementStore = createEntitlementStore();
let helper = null;
let supervisor = null;
let lastNetworkSignature = "";

function extraResourcesPath() {
  if (app.isPackaged) return process.resourcesPath;
  return path.join(__dirname, "..", "..");
}

function messagesVisible() {
  if (isMessagesDeskKilled({ userData: app.getPath("userData") })) return false;
  return entitlementStore.isEntitled();
}

function catalog() {
  return visibleDesks(messagesVisible());
}

function userDataPath() {
  return app.getPath("userData");
}

function contentSize() {
  if (!mainWindow) return [1280, 800];
  return mainWindow.getContentSize();
}

function layoutViews() {
  if (!mainWindow || !chromeView) return;
  const [width, height] = contentSize();
  chromeView.setBounds(chromeBounds(width, height));
  const bounds = vendorBounds(width, height, Boolean(notice));
  const hidden = { x: 0, y: 0, width: 0, height: 0 };
  for (const [id, view] of deskViews) {
    view.setBounds(id === activeDeskId ? bounds : hidden);
  }
  if (messagesView) {
    const show = activeDeskId === "messages" && messagesVisible();
    messagesView.setBounds(show ? bounds : hidden);
  }
}

function setNotice(next) {
  notice = next;
  layoutViews();
  pushState();
}

function snapshot() {
  const desks = catalog();
  const active = deskById(activeDeskId, desks);
  const view = deskViews.get(activeDeskId) ?? (activeDeskId === "messages" ? messagesView : null);
  const contents = view?.webContents ?? null;
  let url = active?.startUrl ?? "";
  let title = active?.title ?? "";
  let loading = false;
  let canGoBack = false;
  let canGoForward = false;

  if (contents && !contents.isDestroyed() && active?.kind !== "local-trusted") {
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

  const openIds = desks.filter((desk) => {
    return desk.id === "messages" ? Boolean(messagesView) : deskViews.has(desk.id);
  }).map((desk) => desk.id);

  return {
    activeDeskId,
    desks: desks.map((desk) => ({
      id: desk.id,
      title: desk.title,
      startUrl: desk.startUrl || "",
      allowedHosts: desk.allowedHosts ? [...desk.allowedHosts] : [],
      kind: desk.kind,
      open: desk.id === "messages" ? Boolean(messagesView) : deskViews.has(desk.id),
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

function pushMessagesEvent(data) {
  if (!messagesView || messagesView.webContents.isDestroyed()) return;
  messagesView.webContents.send("messages:event", data);
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

function handleUnknownNavigation(desk, decision) {
  if (decision.action === "block") {
    setNotice({
      kind: "error",
      message: `Blocked navigation for ${desk.title} (${decision.reason}).`,
      allowBrowser: false,
    });
    return;
  }
  // Hostname changed off the exact provider/IdP list. Stay on the official
  // page. Do not open the system browser — that is only after a real load failure.
  void desk;
  void authReturnMessage;
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
    handleUnknownNavigation(desk, decision);
    return { action: "deny" };
  });

  contents.on("will-navigate", (event, url) => {
    const decision = classifyNavigation(url, desk.allowedHosts);
    if (decision.action === "allow") return;
    event.preventDefault();
    handleUnknownNavigation(desk, decision);
  });

  contents.on("will-redirect", (event, url) => {
    const decision = classifyNavigation(url, desk.allowedHosts);
    if (decision.action === "allow") return;
    event.preventDefault();
    handleUnknownNavigation(desk, decision);
  });

  contents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });

  contents.on("did-start-loading", () => {
    officialAttempted.add(desk.id);
    pushState();
  });
  const restyleOsHome = () => {
    if (!shouldInjectOsHomeChrome(desk)) return;
    injectOsHomeChrome(contents).catch(() => {});
  };
  const checkOwnerSession = (url) => {
    if (desk.id !== "os" || SMOKE) return;
    refreshEntitlement().catch(() => {});
    if (!isOsHomeLoginUrl(url || contents.getURL())) {
      setTimeout(() => {
        refreshEntitlement().catch(() => {});
      }, 750);
    }
  };
  contents.on("dom-ready", () => restyleOsHome());
  contents.on("did-finish-load", () => {
    restyleOsHome();
    checkOwnerSession(contents.getURL());
  });
  contents.on("did-stop-loading", () => {
    pushState();
    restyleOsHome();
    checkOwnerSession(contents.getURL());
  });
  contents.on("did-navigate", (_event, url) => {
    pushState();
    restyleOsHome();
    checkOwnerSession(url || contents.getURL());
  });
  contents.on("did-navigate-in-page", (_event, url) => {
    pushState();
    restyleOsHome();
    checkOwnerSession(url || contents.getURL());
  });
  contents.on("page-title-updated", () => pushState());
  contents.on("did-fail-load", (_event, code, desc, _url, isMainFrame) => {
    if (!isMainFrame) return;
    if (code === -3) return; // ABORTED (allowlist cancel)
    setNotice({
      kind: "error",
      message: `${desk.title} failed to load: ${desc || "unknown error"}`,
      allowBrowser: desk.kind === "vendor" && officialAttempted.has(desk.id),
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
      message: `Denied “${permission}” on ${desk.title}.`,
      allowBrowser: false,
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
  view.webContents.loadURL(desk.startUrl);
  return view;
}

function rememberOwnerDesk(lastDeskId, lastConversationId) {
  if (!messagesVisible()) return;
  const current = readOwnerSession(userDataPath());
  writeOwnerSession(userDataPath(), {
    lastDeskId,
    lastConversationId: lastConversationId ?? current.lastConversationId,
  });
}

function emitToMessages(event) {
  pushMessagesEvent(event);
}

function ensureSupervisor() {
  if (helper && supervisor) return;
  helper = createHelper({
    userData: userDataPath(),
    extraResourcesPath: extraResourcesPath(),
  });
  supervisor = createSupervisor({
    helper,
    readPermissionStatus,
    isEntitled: () => messagesVisible(),
    isKilled: () => isMessagesDeskKilled({ userData: userDataPath() }),
    onEvent: emitToMessages,
  });
}

function destroyMessagesView() {
  if (messagesView && mainWindow) {
    mainWindow.contentView.removeChildView(messagesView);
    if (!messagesView.webContents.isDestroyed()) messagesView.webContents.close();
  }
  messagesView = null;
  deskViews.delete("messages");
}

function ensureMessagesView() {
  if (messagesView || !mainWindow || !messagesVisible()) return;
  const prefs = messagesWebPreferences(MESSAGES_PRELOAD);
  assertMessagesPrefs(prefs);
  messagesView = new WebContentsView({ webPreferences: prefs });
  messagesView.webContents.loadFile(MESSAGES_PAGE);
  mainWindow.contentView.addChildView(messagesView);
  deskViews.set("messages", messagesView);
}

async function startOwnerAutonomy() {
  if (SMOKE || !messagesVisible()) {
    if (supervisor) supervisor.stop();
    return;
  }
  ensureSupervisor();
  await supervisor.start();
}

async function refreshEntitlement() {
  if (SMOKE) return entitlementStore.peek();
  if (isMessagesDeskKilled({ userData: userDataPath() })) {
    entitlementStore.set({ entitled: false, reason: "killed" });
    if (supervisor) supervisor.stop();
    destroyMessagesView();
    if (activeDeskId === "messages") showDesk("os");
    else pushState();
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

  if (!entitlementStore.isEntitled()) {
    if (supervisor) supervisor.stop();
    destroyMessagesView();
    if (activeDeskId === "messages") showDesk("os");
    else pushState();
    return entitlementStore.peek();
  }

  await startOwnerAutonomy();
  const saved = readOwnerSession(userDataPath());
  if (saved.lastDeskId === "messages" && !messagesView && mainWindow) {
    showDesk("messages");
  } else {
    pushState();
  }
  return entitlementStore.peek();
}

function showDesk(id) {
  if (id === "messages") {
    if (!messagesVisible() || !mainWindow) return snapshot();
    ensureMessagesView();
    ensureSupervisor();
    supervisor?.start()?.catch(() => {});
    activeDeskId = "messages";
    if (messagesView) mainWindow.contentView.addChildView(messagesView);
    rememberOwnerDesk("messages");
    layoutViews();
    pushState();
    return snapshot();
  }

  const desk = deskById(id, DESKS);
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
  if (messagesVisible()) rememberOwnerDesk(null);
  layoutViews();
  pushState();
  return snapshot();
}

function closeDesk(id) {
  if (id === "messages") {
    destroyMessagesView();
    if (messagesVisible()) rememberOwnerDesk(null);
    if (activeDeskId === "messages") {
      activeDeskId = "os";
      showDesk("os");
      return snapshot();
    }
    pushState();
    return snapshot();
  }
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
  if (activeDeskId === "messages") return snapshot();
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
  const desk = deskById(id, DESKS);
  if (!desk || !desk.partition) return snapshot();
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
  const desk = deskById(id, DESKS);
  if (!desk || !desk.startUrl) return snapshot();
  const opened = await openHttpsInSystemBrowser(desk.startUrl);
  setNotice({
    kind: opened ? "info" : "error",
    message: opened
      ? `Opened the official ${desk.title} login in your browser. Return here after sign-in.`
      : `Could not open the official ${desk.title} URL.`,
    allowBrowser: false,
  });
  return snapshot();
}

function messagesTrusted(event) {
  if (!messagesView || messagesView.webContents.isDestroyed()) return false;
  return senderIsTrusted({
    event,
    trustedWebContentsId: messagesView.webContents.id,
    trustedFileUrl: messagesView.webContents.getURL(),
  });
}

function hydratePayload() {
  const saved = messagesVisible() ? readOwnerSession(userDataPath()) : { lastConversationId: null };
  return {
    ok: true,
    permissions: readPermissionStatus(),
    conversations: supervisor?.snapshot().conversations ?? null,
    lastConversationId: saved.lastConversationId,
    connection: supervisor?.snapshot() || { running: false },
  };
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

  ensureSupervisor();

  switch (op) {
    case "permission-status":
    case "recheck-permissions":
      supervisor.start().catch(() => {});
      return readPermissionStatus();
    case "hydrate":
    case "connection-status":
      return hydratePayload();
    case "open-settings-pane": {
      const url = settingsTarget(checked.payload.pane);
      if (url) await shell.openExternal(url);
      return { ok: Boolean(url) };
    }
    case "disconnect":
      supervisor.stop();
      helper.disconnect();
      destroyMessagesView();
      rememberOwnerDesk(null);
      safeLog("info", "messages-disconnected", { appleMessagesPreserved: true });
      return { ok: true };
    case "unsubscribe":
      supervisor.focusConversation(null);
      return { ok: true };
    case "subscribe-new":
      supervisor.focusConversation(checked.payload.conversationId || null);
      return { ok: true };
    case "load-messages":
      supervisor.focusConversation(checked.payload.conversationId);
      rememberOwnerDesk("messages", checked.payload.conversationId);
      return helper.run(op, checked.payload);
    case "open-in-apple-messages":
      if (checked.payload.conversationId && helper.available()) {
        const result = await helper.run(op, checked.payload);
        if (result.ok) return result;
      }
      return { ok: helper.openAppleMessages() };
    default:
      if (isUserSendOp(op)) {
        return helper.run(op, checked.payload);
      }
      return helper.run(op, checked.payload);
  }
}

function networkSignature() {
  return Object.entries(os.networkInterfaces())
    .map(([name, addrs]) => `${name}:${(addrs || []).map((row) => row.address).join(",")}`)
    .sort()
    .join("|");
}

function watchResumeAndNetwork() {
  const reconnect = (reason) => {
    if (!messagesVisible() || !supervisor) return;
    supervisor.reconnect(reason).catch(() => {});
  };
  powerMonitor.on("resume", () => reconnect("wake"));
  powerMonitor.on("unlock-screen", () => reconnect("unlock"));
  powerMonitor.on("suspend", () => {
    helper?.stop?.();
  });
  lastNetworkSignature = networkSignature();
  setInterval(() => {
    if (!messagesVisible() || !supervisor) return;
    const next = networkSignature();
    if (next !== lastNetworkSignature) {
      lastNetworkSignature = next;
      reconnect("network-change");
    }
  }, 8000);
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
    title: "Grant & Co OS",
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
    if (supervisor) supervisor.stop();
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
      console.log(`SMOKE_OK chrome=${width}x${height} desks=${DESKS.length}`);
      setTimeout(() => app.quit(), 800);
      return;
    }
    showDesk("os");
    refreshEntitlement().catch(() => {});
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
  if (!SMOKE) {
    watchResumeAndNetwork();
    setInterval(() => {
      refreshEntitlement().catch(() => {});
    }, 10 * 60 * 1000);
  }
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
