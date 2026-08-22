"use strict";

/**
 * Exact-hostname allowlist. No wildcards. No suffix / parent / sibling matching.
 * Subresource loads (scripts, XHR, websockets) are not filtered here — only
 * top-level navigations, redirects, and window.open / popups.
 */

function parseHttpsUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return null;
  }
  return parsed;
}

function hostnameOf(urlString) {
  const parsed = parseHttpsUrl(urlString);
  return parsed ? parsed.hostname.toLowerCase() : null;
}

function isExactAllowedHost(hostname, allowedHosts) {
  if (!hostname || !Array.isArray(allowedHosts)) return false;
  const host = String(hostname).toLowerCase();
  return allowedHosts.some((allowed) => String(allowed).toLowerCase() === host);
}

/**
 * @returns {{ action: 'allow' | 'system-browser' | 'block', reason: string, host?: string, url?: string }}
 */
function classifyNavigation(urlString, allowedHosts) {
  const parsed = parseHttpsUrl(urlString);
  if (!parsed) {
    return { action: "block", reason: "invalid-url", url: String(urlString || "") };
  }
  if (parsed.protocol !== "https:") {
    return {
      action: "block",
      reason: "non-https",
      host: parsed.hostname.toLowerCase(),
      url: parsed.toString(),
    };
  }
  const host = parsed.hostname.toLowerCase();
  if (!isExactAllowedHost(host, allowedHosts)) {
    return {
      action: "system-browser",
      reason: "host-not-allowlisted",
      host,
      url: parsed.toString(),
    };
  }
  return { action: "allow", reason: "exact-allowlist", host, url: parsed.toString() };
}

function isSafeExternalHttps(urlString) {
  const parsed = parseHttpsUrl(urlString);
  return Boolean(parsed && parsed.protocol === "https:");
}

module.exports = {
  parseHttpsUrl,
  hostnameOf,
  isExactAllowedHost,
  classifyNavigation,
  isSafeExternalHttps,
};
