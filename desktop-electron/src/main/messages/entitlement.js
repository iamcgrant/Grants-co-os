"use strict";

const { OS_ORIGIN, APP_ID } = require("../../product");

const ENTITLEMENT_PATH = "/api/desktop/owner-entitlement";
const PURPOSE = "desktop-messages-owner";

function entitlementUrl(origin = OS_ORIGIN) {
  return `${origin}${ENTITLEMENT_PATH}`;
}

function parseEntitlementResponse(body, now = Date.now()) {
  if (!body || typeof body !== "object") {
    return { entitled: false, reason: "invalid-response" };
  }
  if (body.entitled !== true) {
    return { entitled: false, reason: String(body.reason || "not-owner") };
  }
  if (body.role && body.role !== "OWNER") {
    return { entitled: false, reason: "role-mismatch" };
  }
  if (body.purpose && body.purpose !== PURPOSE) {
    return { entitled: false, reason: "purpose-mismatch" };
  }
  if (body.aud && body.aud !== APP_ID) {
    return { entitled: false, reason: "audience-mismatch" };
  }
  const expMs = body.exp ? Date.parse(String(body.exp)) : NaN;
  if (!Number.isFinite(expMs) || expMs <= now) {
    return { entitled: false, reason: "expired" };
  }
  return {
    entitled: true,
    role: "OWNER",
    exp: new Date(expMs).toISOString(),
    entitlement: typeof body.entitlement === "string" ? body.entitlement : "",
  };
}

function createEntitlementStore() {
  /** @type {{ entitled: boolean, exp?: string, reason?: string, checkedAt: number } | null} */
  let cache = null;

  return {
    peek() {
      return cache;
    },
    isEntitled(now = Date.now()) {
      if (!cache || !cache.entitled) return false;
      if (cache.exp && Date.parse(cache.exp) <= now) return false;
      return true;
    },
    set(next) {
      cache = { ...next, checkedAt: Date.now() };
      return cache;
    },
    clear() {
      cache = null;
    },
  };
}

/**
 * Fetch a server-signed owner entitlement using the OS Home partition session.
 * Cookies stay inside Chromium — this never calls cookies.get / export.
 */
async function fetchOwnerEntitlement({ netFetch, session, origin = OS_ORIGIN }) {
  const url = entitlementUrl(origin);
  const response = await netFetch(url, {
    method: "GET",
    session,
    bypassCustomProtocolHandlers: true,
  });
  const status = response.status;
  if (status === 401 || status === 403) {
    return { entitled: false, reason: status === 401 ? "unauthenticated" : "forbidden" };
  }
  if (!response.ok) {
    return { entitled: false, reason: `http-${status}` };
  }
  const body = await response.json();
  return parseEntitlementResponse(body);
}

module.exports = {
  ENTITLEMENT_PATH,
  PURPOSE,
  entitlementUrl,
  parseEntitlementResponse,
  createEntitlementStore,
  fetchOwnerEntitlement,
};
