"use strict";

const { OS_ORIGIN, APP_ID } = require("../../product");

const ENTITLEMENT_PATH = "/api/desktop/owner-entitlement";
const SESSION_PATH = "/api/auth/me";
const PURPOSE = "desktop-messages-owner";
const FALLBACK_MINUTES = 15;

function entitlementUrl(origin = OS_ORIGIN) {
  return `${origin}${ENTITLEMENT_PATH}`;
}

function sessionUrl(origin = OS_ORIGIN) {
  return `${origin}${SESSION_PATH}`;
}

function isOsHomeLoginUrl(urlString) {
  try {
    const parsed = new URL(String(urlString || ""));
    return parsed.pathname === "/login" || parsed.pathname.startsWith("/login/");
  } catch {
    return false;
  }
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
    source: "signed-route",
  };
}

function sessionUser(body) {
  if (!body || typeof body !== "object") return null;
  if (body.user && typeof body.user === "object") return body.user;
  if (body.role) return body;
  return null;
}

function parseSessionEntitlement(body, now = Date.now()) {
  const user = sessionUser(body);
  if (!user) {
    return { entitled: false, reason: "unauthenticated" };
  }
  if (user.isActive === false) {
    return { entitled: false, reason: "inactive" };
  }
  if (String(user.role || "").toUpperCase() !== "OWNER") {
    return { entitled: false, reason: "not-owner" };
  }
  return {
    entitled: true,
    role: "OWNER",
    exp: new Date(now + FALLBACK_MINUTES * 60 * 1000).toISOString(),
    source: "session-fallback",
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

async function readJson(response) {
  if (typeof response.json !== "function") return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function sessionRequest({ netFetch, session, origin }) {
  return netFetch(sessionUrl(origin), {
    method: "GET",
    session,
    bypassCustomProtocolHandlers: true,
  });
}

async function fetchSessionFallback({ netFetch, session, origin = OS_ORIGIN }) {
  const response = await sessionRequest({ netFetch, session, origin });
  const status = response.status;
  if (status === 401 || status === 403) {
    return { entitled: false, reason: status === 401 ? "unauthenticated" : "forbidden" };
  }
  if (!response.ok) {
    return { entitled: false, reason: `session-http-${status}` };
  }
  return parseSessionEntitlement(await readJson(response));
}

/**
 * Fetch owner entitlement using the OS Home partition session.
 * The Chromium session is passed to net.fetch only. Cookie values are
 * never read, listed, or exported. Dedicated signed route is primary.
 * /api/auth/me is only used when that route is missing (404/501).
 */
async function fetchOwnerEntitlement({ netFetch, session, origin = OS_ORIGIN }) {
  const response = await netFetch(entitlementUrl(origin), {
    method: "GET",
    session,
    bypassCustomProtocolHandlers: true,
  });
  const status = response.status;
  if (status === 404 || status === 501) {
    return fetchSessionFallback({ netFetch, session, origin });
  }
  if (status === 401 || status === 403) {
    return { entitled: false, reason: status === 401 ? "unauthenticated" : "forbidden" };
  }
  if (!response.ok) {
    return { entitled: false, reason: `http-${status}` };
  }
  return parseEntitlementResponse(await readJson(response));
}

module.exports = {
  ENTITLEMENT_PATH,
  SESSION_PATH,
  PURPOSE,
  FALLBACK_MINUTES,
  entitlementUrl,
  sessionUrl,
  isOsHomeLoginUrl,
  parseEntitlementResponse,
  parseSessionEntitlement,
  sessionUser,
  createEntitlementStore,
  fetchOwnerEntitlement,
};
