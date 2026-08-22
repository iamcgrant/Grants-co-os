"use strict";

const api = window.spikeChrome;

const deskNav = document.getElementById("desk-nav");
const tabStrip = document.getElementById("tab-strip");
const urlBar = document.getElementById("url-bar");
const loadingDot = document.getElementById("loading-dot");
const noticeEl = document.getElementById("notice");
const noticeText = document.getElementById("notice-text");
const btnBack = document.getElementById("btn-back");
const btnForward = document.getElementById("btn-forward");
const btnReload = document.getElementById("btn-reload");
const btnOpen = document.getElementById("btn-open-browser");
const btnClear = document.getElementById("btn-clear");
const btnClose = document.getElementById("btn-close");
const noticeDismiss = document.getElementById("notice-dismiss");

/** @type {{ activeDeskId: string, desks: Array<{id:string,title:string,startUrl:string,open:boolean}>, url: string, loading: boolean, canGoBack: boolean, canGoForward: boolean, notice: {kind:string,message:string}|null } | null} */
let state = null;

function currentDeskId() {
  return state?.activeDeskId || "os";
}

function renderNav() {
  if (!state) return;
  deskNav.replaceChildren();
  for (const desk of state.desks) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.desk = desk.id;
    button.textContent = desk.title;
    button.classList.toggle("active", desk.id === state.activeDeskId && desk.open);
    button.addEventListener("click", () => {
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
    empty.className = "url-bar";
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
    label.addEventListener("click", () => api.selectDesk(desk.id));
    const close = document.createElement("button");
    close.type = "button";
    close.className = "close-x";
    close.setAttribute("aria-label", `Close ${desk.title}`);
    close.textContent = "×";
    close.addEventListener("click", (event) => {
      event.stopPropagation();
      api.closeDesk(desk.id);
    });
    tab.append(label, close);
    tabStrip.append(tab);
  }
}

function renderChrome() {
  if (!state) return;
  const hasView = state.desks.some((desk) => desk.id === state.activeDeskId && desk.open);
  urlBar.textContent = hasView ? state.url || "Loading…" : "Select a desk";
  loadingDot.hidden = !state.loading;
  btnBack.disabled = !hasView || !state.canGoBack;
  btnForward.disabled = !hasView || !state.canGoForward;
  btnReload.disabled = !hasView;
  btnClose.disabled = !hasView;
  btnOpen.disabled = !state.activeDeskId;
  btnClear.disabled = !state.activeDeskId;

  if (state.notice?.message) {
    noticeEl.hidden = false;
    noticeEl.className = `notice ${state.notice.kind || "info"}`;
    noticeText.textContent = state.notice.message;
  } else {
    noticeEl.hidden = true;
    noticeText.textContent = "";
  }
}

function render(next) {
  state = next;
  renderNav();
  renderTabs();
  renderChrome();
}

btnBack.addEventListener("click", () => api.nav("back"));
btnForward.addEventListener("click", () => api.nav("forward"));
btnReload.addEventListener("click", () => api.nav("reload"));
btnClose.addEventListener("click", () => api.closeDesk(currentDeskId()));
btnOpen.addEventListener("click", () => api.openInBrowser(currentDeskId()));
btnClear.addEventListener("click", () => api.clearSiteData(currentDeskId()));
noticeDismiss.addEventListener("click", () => api.dismissNotice());

if (!api) {
  urlBar.textContent = "Chrome preload missing — refuse to continue.";
} else {
  api.onState(render);
  api.getState().then(render);
}
