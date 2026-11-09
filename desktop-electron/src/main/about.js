"use strict";

const path = require("node:path");
const {
  PRODUCT_NAME,
  COMPANY_NAME,
  VERSION,
  COPYRIGHT,
  WEBSITE_URL,
  PRIVACY_POLICY_URL,
  TERMS_URL,
} = require("../product");
const { chromeWebPreferences } = require("./security");
const { isSafeExternalHttps } = require("./allowlist");

const ABOUT_PAGE = path.join(__dirname, "..", "about", "index.html");
const ABOUT_PRELOAD = path.join(__dirname, "..", "about", "preload.js");

function aboutPayload(wordmarkDataUrl) {
  return {
    productName: PRODUCT_NAME,
    companyName: COMPANY_NAME,
    version: VERSION,
    copyright: COPYRIGHT,
    websiteUrl: WEBSITE_URL,
    privacyPolicyUrl: PRIVACY_POLICY_URL,
    termsUrl: TERMS_URL,
    wordmarkDataUrl: wordmarkDataUrl || null,
  };
}

function attachAboutGuards(contents, openExternal) {
  contents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalHttps(url)) openExternal(url);
    return { action: "deny" };
  });
  contents.on("will-navigate", (event, url) => {
    if (url.startsWith("file:")) return;
    event.preventDefault();
    if (isSafeExternalHttps(url)) openExternal(url);
  });
}

function openAboutWindow({ BaseWindow, WebContentsView, parent, wordmarkDataUrl, openExternal }) {
  const win = new BaseWindow({
    width: 440,
    height: 560,
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: parent || undefined,
    title: `About ${PRODUCT_NAME}`,
    backgroundColor: "#16161a",
    show: false,
  });

  const view = new WebContentsView({
    webPreferences: chromeWebPreferences(ABOUT_PRELOAD),
  });
  attachAboutGuards(view.webContents, openExternal);
  view.webContents.loadFile(ABOUT_PAGE);
  win.contentView.addChildView(view);
  view.setBounds({ x: 0, y: 0, width: 440, height: 560 });
  view.webContents.once("did-finish-load", () => {
    view.webContents.send("about:payload", aboutPayload(wordmarkDataUrl));
    win.show();
  });
  win.on("closed", () => {
    if (!view.webContents.isDestroyed()) view.webContents.close();
  });
  return win;
}

module.exports = {
  ABOUT_PAGE,
  ABOUT_PRELOAD,
  aboutPayload,
  attachAboutGuards,
  openAboutWindow,
};
