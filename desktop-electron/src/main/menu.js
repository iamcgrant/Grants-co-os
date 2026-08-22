"use strict";

const { PRODUCT_NAME } = require("../product");

function buildAppMenuTemplate({ onAbout, onQuit }) {
  return [
    {
      label: PRODUCT_NAME,
      submenu: [
        { label: `About ${PRODUCT_NAME}`, click: () => onAbout() },
        { type: "separator" },
        { role: "hide", label: `Hide ${PRODUCT_NAME}` },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { label: `Quit ${PRODUCT_NAME}`, accelerator: "CmdOrCtrl+Q", click: () => onQuit() },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "close" }],
    },
  ];
}

module.exports = { buildAppMenuTemplate };
