"use strict";

/**
 * Downloads require an explicit Save/Cancel prompt and a visible completion notice.
 * Never silent-save. Never inspect cookies while handling the file.
 * Do not call preventDefault() on will-download — that aborts the transfer.
 */

function attachDownloadHandler(ses, { deskTitle, getWindow, dialog, onNotice }) {
  ses.on("will-download", (_event, item) => {
    const filename = item.getFilename() || "download";
    const win = getWindow();
    const confirm = dialog.showMessageBoxSync(win ?? undefined, {
      type: "question",
      buttons: ["Save…", "Cancel"],
      defaultId: 0,
      cancelId: 1,
      title: "Download",
      message: `Allow this download from ${deskTitle}?`,
      detail: filename,
    });
    if (confirm !== 0) {
      item.cancel();
      onNotice({ kind: "info", message: `Download canceled: ${filename}` });
      return;
    }
    const savePath = dialog.showSaveDialogSync(win ?? undefined, {
      title: "Save download",
      defaultPath: filename,
    });
    if (!savePath) {
      item.cancel();
      onNotice({ kind: "info", message: `Download canceled: ${filename}` });
      return;
    }
    item.setSavePath(savePath);
    item.on("done", (_e, state) => {
      if (state === "completed") {
        onNotice({ kind: "success", message: `Download complete: ${filename}` });
        return;
      }
      if (state === "cancelled") {
        onNotice({ kind: "info", message: `Download canceled: ${filename}` });
        return;
      }
      onNotice({ kind: "error", message: `Download failed: ${filename}` });
    });
  });
}

module.exports = { attachDownloadHandler };
