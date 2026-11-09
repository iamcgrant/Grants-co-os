"use strict";

/**
 * Customer-facing Grant & Co OS identity.
 * Internal packaging may mention Electron; chrome / About / DMG must not.
 */

const PRODUCT_NAME = "Grant & Co OS";
const COMPANY_NAME = "Grant & Co Consultants";
const APP_ID = "com.grantandconsultants.os";
const VERSION = "1.0.0";
const COPYRIGHT = "© Grant & Co Consultants";
const WEBSITE_URL = "https://grantandconsultants.com";
const OS_ORIGIN = "https://os.grantandconsultants.com";

/** Official policy pages that exist on grantandconsultants.com. */
const PRIVACY_POLICY_URL = "https://grantandconsultants.com/privacy-policy";
const TERMS_URL = "https://grantandconsultants.com/terms";

const PUBLIC_APP_NAME = "Grant & Co OS.app";
const DMG_VOLUME_NAME = "Grant & Co OS";
const DMG_DOWNLOAD_FILENAME = "Grant-and-Co-OS-Mac.dmg";

const WORDMARK_RELATIVE = "resources/brand/logo.jpeg";
const DOCK_ICON_RELATIVE = "resources/icon.icns";

module.exports = {
  PRODUCT_NAME,
  COMPANY_NAME,
  APP_ID,
  VERSION,
  COPYRIGHT,
  WEBSITE_URL,
  OS_ORIGIN,
  PRIVACY_POLICY_URL,
  TERMS_URL,
  PUBLIC_APP_NAME,
  DMG_VOLUME_NAME,
  DMG_DOWNLOAD_FILENAME,
  WORDMARK_RELATIVE,
  DOCK_ICON_RELATIVE,
};
