"use strict";

const api = window.spikeChrome;

const deskNav = document.getElementById("desk-nav");
const tabStrip = document.getElementById("tab-strip");
const noticeEl = document.getElementById("notice");
const noticeText = document.getElementById("notice-text");
const btnBack = document.getElementById("btn-back");
const btnReload = document.getElementById("btn-reload");
const btnIdentity = document.getElementById("btn-identity");
const identityLabel = document.getElementById("identity-label");
const identityPop = document.getElementById("identity-pop");
const identityTitle = document.getElementById("identity-title");
const identityHost = document.getElementById("identity-host");
const overflowMenu = document.getElementById("overflow-menu");
const btnMenu = document.getElementById("btn-menu");
const btnOpen = document.getElementById("btn-open-browser");
const menuClear = document.getElementById("menu-clear");
const menuAbout = document.getElementById("menu-about");
const noticeDismiss = document.getElementById("notice-dismiss");
const surface = document.getElementById("surface");
const surfaceTitle = document.getElementById("surface-title");
const surfaceCopy = document.getElementById("surface-copy");
const wordmark = document.getElementById("wordmark");
const surfaceWordmark = document.getElementById("surface-wordmark");

/** @type {object | null} */
let state = null;

function currentDeskId() {
  return state?.activeDeskId || "os";
}

function currentDesk() {
  return state?.desks?.find((desk) => desk.id === currentDeskId()) || null;
}

function applyWordmark(dataUrl) {
  for (const img of [wordmark, surfaceWordmark]) {
    if (dataUrl) {
      img.src = dataUrl;
      img.hidden = false;
    } else {
      img.removeAttribute("src");
      img.hidden = true;
    }
  }
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

function surfaceCopyFor(kind) {
  switch (kind) {
    case "loading":
      return { title: "Grant & Co OS", copy: "Opening this workspace." };
    case "welcome":
      return { title: "Grant & Co OS", copy: "Choose a desk from the sidebar." };
    case "error":
      return { title: "This workspace could not load", copy: state?.notice?.message || "The official site did not finish loading." };
    case "blocked":
      return { title: "Navigation stayed here", copy: state?.notice?.message || "That destination is outside the approved host list." };
    case "cert":
      return { title: "Secure connection failed", copy: state?.notice?.message || "The certificate for this site was not accepted." };
    case "crashed":
      return { title: "This workspace stopped", copy: state?.notice?.message || "The page renderer closed unexpectedly." };
    case "ready":
      return { title: "", copy: "" };
    default: {
      const _exhaustive = kind;
      void _exhaustive;
      return { title: "Grant & Co OS", copy: "Opening your workspace." };
    }
  }
}

function renderChrome() {
  if (!state) return;
  const desk = currentDesk();
  const hasView = Boolean(desk?.open);
  const canGoBack = Boolean(hasView && state.canGoBack);
  btnBack.hidden = !canGoBack;
  btnBack.disabled = !canGoBack;
  btnReload.disabled = !hasView || desk?.kind === "local-trusted";
  identityLabel.textContent = desk?.title || "Grant & Co OS";
  btnIdentity.disabled = !desk;
  identityTitle.textContent = desk?.title || "";
  identityHost.textContent = desk?.kind === "local-trusted"
    ? "Trusted local workspace"
    : (desk?.allowedHosts?.[0] || desk?.startUrl || "");

  const fallback = Boolean(state.openInBrowserAvailable);
  btnOpen.hidden = !fallback;
  menuClear.hidden = desk?.kind === "local-trusted";

  if (state.notice?.message) {
    noticeEl.hidden = false;
    noticeEl.className = `notice ${state.notice.kind || "info"}`;
    noticeText.textContent = state.notice.message;
  } else {
    noticeEl.hidden = true;
    noticeText.textContent = "";
  }

  const kind = state.surface || (hasView && !state.loading ? "ready" : "loading");
  const copy = surfaceCopyFor(kind);
  surface.className = `viewport-well ${kind}`;
  surface.hidden = kind === "ready";
  surfaceTitle.textContent = copy.title;
  surfaceCopy.textContent = copy.copy;
}

function hideMenus() {
  identityPop.hidden = true;
  overflowMenu.hidden = true;
}

function render(next) {
  state = next;
  renderNav();
  renderTabs();
  renderChrome();
}

btnBack.addEventListener("click", () => api.nav("back"));
btnReload.addEventListener("click", () => api.nav("reload"));
btnIdentity.addEventListener("click", () => {
  overflowMenu.hidden = true;
  identityPop.hidden = !identityPop.hidden;
});
btnMenu.addEventListener("click", () => {
  identityPop.hidden = true;
  overflowMenu.hidden = !overflowMenu.hidden;
});
menuClear.addEventListener("click", () => {
  hideMenus();
  api.clearSiteData(currentDeskId());
});
menuAbout.addEventListener("click", () => {
  hideMenus();
  api.openAbout();
});
btnOpen.addEventListener("click", () => api.openInBrowser(currentDeskId()));
noticeDismiss.addEventListener("click", () => api.dismissNotice());

if (!api) {
  surfaceTitle.textContent = "Grant & Co OS";
  surfaceCopy.textContent = "This workspace could not start.";
} else {
  api.onState(render);
  api.getState().then(render);
  if (api.getBrand) {
    api.getBrand().then((brand) => applyWordmark(brand?.wordmarkDataUrl || null));
  }
}
