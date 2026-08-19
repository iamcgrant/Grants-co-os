/**
 * Prepare a minimal local shell page used when packaging the Tauri wrapper.
 * The web application remains the canonical backend — desktop is a secure wrapper.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "desktop/public-desktop");
fs.mkdirSync(outDir, { recursive: true });

const iconScript = path.join(root, "scripts/generate-desktop-icons.mjs");
spawnSync(process.execPath, [iconScript], { stdio: "inherit", cwd: root });

const permanentReady = process.env.GC_PERMANENT_HOST_READY === "1";
const primaryUrl =
  process.env.GC_DESKTOP_URL ||
  (permanentReady
    ? "https://os.grantandconsultants.com"
    : "https://temporary-prompt-oboe-st5fuuv.vercel.app");
const fallbackUrl =
  process.env.GC_DESKTOP_FALLBACK_URL ||
  (primaryUrl.includes("grantandconsultants.com")
    ? "https://temporary-prompt-oboe-st5fuuv.vercel.app"
    : "https://os.grantandconsultants.com");

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Grants &amp; Co OS</title>
    <style>
      :root {
        --gc-black: #040404;
        --gc-charcoal: #16161a;
        --gc-gold: #f5b82a;
        --gc-gold-soft: #d4a017;
        --gc-cream: #f8f4ec;
        --gc-muted: #929292;
      }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        height: 100%;
        background: var(--gc-black);
        color: var(--gc-cream);
        font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
        overflow: hidden;
      }
      .offline-banner {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 10;
        padding: 0.55rem 1rem;
        background: rgba(22, 22, 26, 0.96);
        border-bottom: 1px solid rgba(245, 184, 42, 0.35);
        color: var(--gc-gold);
        font-size: 0.72rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        text-align: center;
      }
      .offline-banner[hidden] { display: none; }
      .shell {
        position: relative;
        height: 100%;
        display: grid;
        place-items: center;
        text-align: center;
        padding: 2.5rem 1.5rem;
        background:
          radial-gradient(ellipse 80% 60% at 50% 0%, rgba(245, 184, 42, 0.08), transparent 55%),
          radial-gradient(circle at 50% 100%, rgba(22, 22, 26, 0.9), var(--gc-black));
      }
      .shell::before {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(180deg, rgba(245, 184, 42, 0.04) 0%, transparent 40%);
        pointer-events: none;
      }
      .panel {
        position: relative;
        z-index: 1;
        max-width: 26rem;
        animation: rise 0.9s ease-out both;
      }
      .mark {
        width: 4.5rem;
        height: 4.5rem;
        margin: 0 auto 1.5rem;
        border-radius: 1.1rem;
        border: 1px solid rgba(245, 184, 42, 0.45);
        display: grid;
        place-items: center;
        background: rgba(22, 22, 26, 0.72);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
      }
      .mark span {
        font-size: 2rem;
        color: var(--gc-gold);
        line-height: 1;
      }
      .eyebrow {
        margin: 0 0 0.75rem;
        color: var(--gc-gold);
        letter-spacing: 0.42em;
        text-transform: uppercase;
        font-size: 0.62rem;
      }
      h1 {
        margin: 0 0 0.75rem;
        font-size: clamp(1.6rem, 4vw, 2rem);
        font-weight: 500;
        letter-spacing: 0.02em;
      }
      .sub {
        margin: 0 0 1.75rem;
        color: var(--gc-muted);
        font-size: 0.95rem;
        line-height: 1.6;
      }
      .bar {
        width: min(12rem, 70vw);
        height: 2px;
        margin: 0 auto 1rem;
        background: rgba(255, 255, 255, 0.08);
        border-radius: 999px;
        overflow: hidden;
      }
      .bar i {
        display: block;
        height: 100%;
        width: 35%;
        background: linear-gradient(90deg, var(--gc-gold-soft), var(--gc-gold));
        border-radius: inherit;
        animation: sweep 1.2s ease-in-out infinite;
      }
      .status {
        margin: 0;
        font-size: 0.72rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: rgba(248, 244, 236, 0.55);
      }
      a.fallback {
        display: inline-block;
        margin-top: 1.25rem;
        color: var(--gc-gold);
        font-size: 0.82rem;
        letter-spacing: 0.08em;
        text-decoration: none;
        border-bottom: 1px solid rgba(245, 184, 42, 0.35);
      }
      a.fallback:hover { color: var(--gc-cream); }
      @keyframes rise {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes sweep {
        0% { transform: translateX(-120%); }
        100% { transform: translateX(320%); }
      }
    </style>
  </head>
  <body>
    <div class="offline-banner" id="offline-banner" hidden role="status">
      You appear to be offline — Grants &amp; Co OS will open when your connection returns
    </div>
    <div class="shell">
      <div class="panel">
        <div class="mark" aria-hidden="true"><span>G</span></div>
        <p class="eyebrow">Grants &amp; Co</p>
        <h1>Grants &amp; Co OS</h1>
        <p class="sub">Opening your operating system&hellip;</p>
        <div class="bar" aria-hidden="true"><i></i></div>
        <p class="status" id="status">Connecting</p>
        <a class="fallback" id="fallback" href="${fallbackUrl}" hidden>Continue manually</a>
      </div>
    </div>
    <script>
      (function () {
        var PRIMARY_URL = ${JSON.stringify(primaryUrl)};
        var FALLBACK_URL = ${JSON.stringify(fallbackUrl)};
        var MAX_ATTEMPTS = 4;
        var RETRY_MS = 1800;
        var navigated = false;
        var statusEl = document.getElementById("status");
        var offlineBanner = document.getElementById("offline-banner");
        var fallbackLink = document.getElementById("fallback");

        function setStatus(text) {
          if (statusEl) statusEl.textContent = text;
        }

        function updateOfflineBanner() {
          if (!offlineBanner) return;
          offlineBanner.hidden = navigator.onLine;
        }

        function showFallback() {
          if (fallbackLink) {
            fallbackLink.href = FALLBACK_URL && FALLBACK_URL !== PRIMARY_URL ? FALLBACK_URL : PRIMARY_URL;
            fallbackLink.hidden = false;
          }
          setStatus("Tap continue if loading stalls");
        }

        function navigateTo(url) {
          if (navigated) return;
          navigated = true;
          window.__gcNavigated = true;
          window.__gcNavigatedUrl = url;
          window.location.replace(url);
        }

        function probeReachable(url) {
          if (!navigator.onLine) return Promise.resolve(false);
          return fetch(url, { method: "HEAD", mode: "no-cors", cache: "no-store" })
            .then(function () { return true; })
            .catch(function () { return false; });
        }

        function attemptLaunch(attempt) {
          if (navigated) return;

          if (!navigator.onLine) {
            setStatus("Waiting for network");
            updateOfflineBanner();
            setTimeout(function () { attemptLaunch(attempt); }, RETRY_MS);
            return;
          }

          updateOfflineBanner();
          setStatus(attempt > 1 ? "Retrying connection (" + attempt + ")" : "Connecting");

          probeReachable(PRIMARY_URL).then(function (reachable) {
            if (navigated) return;
            if (reachable) {
              navigateTo(PRIMARY_URL);
              return;
            }
            if (attempt < MAX_ATTEMPTS) {
              setTimeout(function () { attemptLaunch(attempt + 1); }, RETRY_MS);
              return;
            }
            if (FALLBACK_URL && FALLBACK_URL !== PRIMARY_URL) {
              setStatus("Trying backup address");
              probeReachable(FALLBACK_URL).then(function (fallbackOk) {
                if (navigated) return;
                if (fallbackOk) {
                  navigateTo(FALLBACK_URL);
                  return;
                }
                showFallback();
                setStatus("Cannot reach OS — use continue");
              });
              return;
            }
            showFallback();
            setStatus("Cannot reach OS — use continue");
          });
        }

        window.addEventListener("online", function () {
          updateOfflineBanner();
          if (!navigated) attemptLaunch(1);
        });
        window.addEventListener("offline", updateOfflineBanner);

        window.addEventListener("load", function () {
          updateOfflineBanner();
          setTimeout(function () { attemptLaunch(1); }, 900);
          setTimeout(showFallback, 6500);
        });
      })();
    </script>
  </body>
</html>`;

fs.writeFileSync(path.join(outDir, "index.html"), html);
console.log("Prepared desktop shell →", outDir, "→", primaryUrl, "fallback", fallbackUrl);
