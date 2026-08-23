"use strict";

const api = window.grantAbout;

function apply(payload) {
  if (!payload) return;
  document.getElementById("product").textContent = payload.productName;
  document.getElementById("version").textContent = `Version ${payload.version}`;
  document.getElementById("copyright").textContent = payload.copyright;
  document.getElementById("website").href = payload.websiteUrl;
  document.getElementById("privacy").href = payload.privacyPolicyUrl;
  document.getElementById("terms").href = payload.termsUrl;
  const img = document.getElementById("wordmark");
  if (payload.wordmarkDataUrl) {
    img.src = payload.wordmarkDataUrl;
    img.hidden = false;
  } else {
    img.removeAttribute("src");
    img.hidden = true;
  }
}

if (api) {
  api.onPayload(apply);
}
