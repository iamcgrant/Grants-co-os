"use strict";

const api = window.spikeChrome;

const DESK_ICONS = Object.freeze({
  os: "./icons/os.svg",
  ghl: "./icons/ghl.svg",
  telegram: "./icons/telegram.svg",
  experian: "./icons/experian.svg",
  equifax: "./icons/equifax.svg",
  disputefox: "./icons/disputefox.svg",
  "cloud-tax": "./icons/cloud-tax.svg",
});

const deskNav = document.getElementById("desk-nav");
const tabStrip = document.getElementById("tab-strip");
const noticeEl = document.getElementById("notice");
const noticeText = document.getElementById("notice-text");
const noticeOpen = document.getElementById("notice-open-browser");
const noticeDismiss = document.getElementById("notice-dismiss");
const btnBack = document.getElementById("btn-back");
const btnReload = document.getElementById("btn-reload");
const btnMore = document.getElementById("btn-more");
const vendorChip = document.getElementById("vendor-chip");
const vendorIcon = document.getElementById("vendor-icon");
const vendorName = document.getElementById("vendor-name");
const vendorPopover = document.getElementById("vendor-popover");
const popoverLock = document.getElementById("popover-lock");
const popoverHost = document.getElementById("popover-host");
const popoverOfficial = document.getElementById("popover-official");
const overflowMenu = document.getElementById("overflow-menu");
const menuOpen = document.getElementById("menu-open-browser");
const menuClear = document.getElementById("menu-clear");
const menuForward = document.getElementById("menu-forward");

/** @type {{ activeDeskId: string, desks: Array<{id:string,title:string,startUrl:string,open:boolean}>, url: string, loading: boolean, canGoBack: boolean, canGoForward: boolean, notice: {kind:string,message:string}|null } | null} */
let state = null;

function currentDeskId() {
  return state?.activeDeskId || "os";
}

function activeDesk() {
  if (!state) return null;
  return state.desks.find((desk) => desk.id === state.activeDeskId) ?? null;
}

function deskIcon(id) {
  return DESK_ICONS[id] || DESK_ICONS.os;
}

function hostnameOf(urlString) {
  try {
    return new URL(urlString).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isHttps(urlString) {
  try {
    return new URL(urlString).protocol === "https:";
  } catch {
    return false;
  }
}

function closeFlyouts() {
  vendorPopover.hidden = true;
  overflowMenu.hidden = true;
  vendorChip.setAttribute("aria-expanded", "false");
  btnMore.setAttribute("aria-expanded", "false");
}

function renderNav() {
  if (!state) return;
  deskNav.replaceChildren();
  for (const desk of state.desks) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.desk = desk.id;
    button.classList.toggle("active", desk.id === state.activeDeskId && desk.open);
    const icon = document.createElement("img");
    icon.src = deskIcon(desk.id);
    icon.alt = "";
    const label = document.createElement("span");
    label.textContent = desk.title;
    button.append(icon, label);
    button.addEventListener("click", () => {
      closeFlyouts();
      api.selectDesk(desk.id);
    });
    deskNav.append(button);
  }
}

function renderTabs() {
  if (!state) return;
  tabStrip.replaceChildren();
  const open = state.desks.filter((desk) => desk.open);
  if (open.length === 0) {
    const empty = document.createElement("span");
    empty.className = "tabs-empty";
    empty.textContent = "No open desk";
    tabStrip.append(empty);
    return;
  }
  for (const desk of open) {
    const tab = document.createElement("div");
    tab.className = "tab";
    tab.classList.toggle("active", desk.id === state.activeDeskId);
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", desk.id === state.activeDeskId ? "true" : "false");
    const label = document.createElement("button");
    label.type = "button";
    label.textContent = desk.title;
    label.addEventListener("click", () => {
      closeFlyouts();
      api.selectDesk(desk.id);
    });
    const close = document.createElement("button");
    close.type = "button";
    close.className = "close-x";
    close.setAttribute("aria-label", `Close ${desk.title}`);
    close.textContent = "×";
    close.addEventListener("click", (event) => {
      event.stopPropagation();
      closeFlyouts();
      api.closeDesk(desk.id);
    });
    tab.append(label, close);
    tabStrip.append(tab);
  }
}

function renderChrome() {
  if (!state) return;
  const desk = activeDesk();
  const hasView = Boolean(desk?.open);

  btnBack.hidden = !hasView || !state.canGoBack;
  btnReload.hidden = !hasView;
  btnReload.classList.toggle("is-loading", Boolean(hasView && state.loading));
  btnMore.hidden = !hasView;
  vendorChip.hidden = !hasView;
  menuForward.hidden = !hasView || !state.canGoForward;

  if (hasView && desk) {
    vendorIcon.src = deskIcon(desk.id);
    vendorName.textContent = desk.title;
    const currentHost = hostnameOf(state.url) || hostnameOf(desk.startUrl);
    const officialHost = hostnameOf(desk.startUrl);
    const secure = isHttps(state.url || desk.startUrl);
    popoverLock.textContent = secure ? "HTTPS" : "Not secure";
    popoverHost.textContent = currentHost || "Unknown host";
    popoverOfficial.textContent = officialHost || "Unknown host";
  } else {
    vendorPopover.hidden = true;
    overflowMenu.hidden = true;
    vendorChip.setAttribute("aria-expanded", "false");
    btnMore.setAttribute("aria-expanded", "false");
  }

  if (state.notice?.message) {
    const kind = state.notice.kind || "info";
    noticeEl.hidden = false;
    noticeEl.className = `notice ${kind}`;
    noticeText.textContent = state.notice.message;
    const showOpen = kind === "error" || kind === "system-browser";
    noticeOpen.hidden = !showOpen;
  } else {
    noticeEl.hidden = true;
    noticeEl.className = "notice";
    noticeText.textContent = "";
    noticeOpen.hidden = true;
  }
}

function render(next) {
  state = next;
  renderNav();
  renderTabs();
  renderChrome();
}

btnBack.addEventListener("click", () => api.nav("back"));
btnReload.addEventListener("click", () => api.nav("reload"));
menuForward.addEventListener("click", () => {
  closeFlyouts();
  api.nav("forward");
});
menuOpen.addEventListener("click", () => {
  closeFlyouts();
  api.openInBrowser(currentDeskId());
});
menuClear.addEventListener("click", () => {
  closeFlyouts();
  api.clearSiteData(currentDeskId());
});
noticeOpen.addEventListener("click", () => api.openInBrowser(currentDeskId()));
noticeDismiss.addEventListener("click", () => api.dismissNotice());

vendorChip.addEventListener("click", (event) => {
  event.stopPropagation();
  if (vendorChip.hidden) return;
  const open = vendorPopover.hidden;
  overflowMenu.hidden = true;
  btnMore.setAttribute("aria-expanded", "false");
  vendorPopover.hidden = !open;
  vendorChip.setAttribute("aria-expanded", open ? "true" : "false");
});

btnMore.addEventListener("click", (event) => {
  event.stopPropagation();
  if (btnMore.hidden) return;
  const open = overflowMenu.hidden;
  vendorPopover.hidden = true;
  vendorChip.setAttribute("aria-expanded", "false");
  overflowMenu.hidden = !open;
  btnMore.setAttribute("aria-expanded", open ? "true" : "false");
});

document.addEventListener("click", () => closeFlyouts());
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeFlyouts();
});

if (!api) {
  noticeEl.hidden = false;
  noticeEl.className = "notice error";
  noticeText.textContent = "Chrome preload missing — refuse to continue.";
} else {
  api.onState(render);
  api.getState().then(render);
}
