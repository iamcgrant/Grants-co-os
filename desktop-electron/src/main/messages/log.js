"use strict";

const SENSITIVE = /text|body|message|preview|attachment|contact|handle|address|email|phone|content|query|recipient/i;

function redact(value, key) {
  if (value == null) return value;
  if (typeof value === "string") {
    if (key && SENSITIVE.test(String(key))) return "[redacted]";
    return value.length > 80 ? "[redacted]" : value;
  }
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = redact(v, k);
    }
    return out;
  }
  return value;
}

function safeLog(level, event, detail) {
  const line = {
    scope: "messages-helper",
    event: String(event || "event"),
    detail: redact(detail || {}),
  };
  const text = JSON.stringify(line);
  if (/"(text|body|preview|content)"\s*:/.test(text) && !text.includes("[redacted]")) {
    return;
  }
  if (level === "error") console.error(text);
  else console.log(text);
}

module.exports = { redact, safeLog };
