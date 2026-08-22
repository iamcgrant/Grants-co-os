"use strict";

const api = window.gcChrome;

const deskNav = document.getElementById("desk-nav");
const tabStrip = document.getElementById("tab-strip");
const noticeEl = document.getElementById("notice");
const noticeText = document.getElementById("notice-text");
const noticeDismiss = document.getElementById("notice-dismiss");
const noticeOpenBrowser = document.getElementById("notice-open-browser");

/** @type {{ activeDeskId: string, desks: Array<{id:string,title:string,startUrl:string,open:boolean,group?:string}>, notice: {kind:string,message:string,allowBrowser?:boolean}|null } | null} */
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
    button.classList.toggle("active", desk.id === state.activeDeskId);
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
    empty.className = "tab-empty";
    empty.textContent = "No open tabs";
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
  if (state.notice?.message) {
    noticeEl.hidden = false;
    noticeEl.className = `notice ${state.notice.kind || "info"}`;
    noticeText.textContent = state.notice.message;
    noticeOpenBrowser.hidden = !state.notice.allowBrowser;
  } else {
    noticeEl.hidden = true;
    noticeText.textContent = "";
    noticeOpenBrowser.hidden = true;
  }
}

function render(next) {
  state = next;
  renderNav();
  renderTabs();
  renderChrome();
}

noticeDismiss.addEventListener("click", () => api.dismissNotice());
noticeOpenBrowser.addEventListener("click", () => api.openInBrowser(currentDeskId()));

if (!api) {
  noticeEl.hidden = false;
  noticeText.textContent = "Desktop chrome is unavailable.";
} else {
  api.onState(render);
  api.getState().then(render);
}
