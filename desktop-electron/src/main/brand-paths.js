"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { WORDMARK_RELATIVE, DOCK_ICON_RELATIVE } = require("../product");

function packageRoot() {
  return path.join(__dirname, "..", "..");
}

function wordmarkPath(root = packageRoot()) {
  return path.join(root, WORDMARK_RELATIVE);
}

function dockIconPath(root = packageRoot()) {
  return path.join(root, DOCK_ICON_RELATIVE);
}

function readWordmarkDataUrl(root = packageRoot()) {
  const file = wordmarkPath(root);
  if (!fs.existsSync(file)) return null;
  const bytes = fs.readFileSync(file);
  if (bytes.length === 0) return null;
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}

function brandAssetsExist(root = packageRoot()) {
  return {
    wordmark: fs.existsSync(wordmarkPath(root)),
    dockIcon: fs.existsSync(dockIconPath(root)),
    wordmarkPath: wordmarkPath(root),
    dockIconPath: dockIconPath(root),
  };
}

module.exports = {
  packageRoot,
  wordmarkPath,
  dockIconPath,
  readWordmarkDataUrl,
  brandAssetsExist,
};
