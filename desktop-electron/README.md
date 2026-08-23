# Grants & Co OS — disposable Electron spike

**This is a gated feasibility spike. It is not a Tauri replacement. It is not a production desktop app.**

Do not rewrite Next.js / Vercel OS. Do not delete or convert `/desktop` (Tauri). The live product remains the web OS at `https://os.grantandconsultants.com` and the existing Tauri shell.

Charles approved this spike so we can learn whether official vendor sites can run as **isolated, unprivileged `WebContentsView`s** next to local trusted chrome. **No provider is claimed to work inside this shell until someone runs it on Windows with authorized test accounts.**

## What this app is

Local chrome only (sidebar, tabs, back / forward / reload / close, loading, error, notices). That chrome is **local files**. It does **not** load the live OS in a renderer that has a preload bridge.

Each of the following loads in its **own** unprivileged `WebContentsView` (not an iframe, not `<webview>`):

| Desk | Official start URL | Exact allowlisted host | Partition |
|------|--------------------|------------------------|-----------|
| OS Home | `https://os.grantandconsultants.com/login` | `os.grantandconsultants.com` | `persist:gc-os` |
| GHL | `https://app.gohighlevel.com/` | `app.gohighlevel.com` | `persist:gc-ghl` |
| Telegram | `https://web.telegram.org/a/` | `web.telegram.org` | `persist:gc-telegram` |
| Experian | `https://www.experian.com/consumer/upload/` | `www.experian.com` | `persist:gc-experian` |
| Equifax | `https://www.equifax.com/personal/credit-report-services/credit-dispute` | `www.equifax.com` | `persist:gc-equifax` |
| DisputeFox | `https://pulse.disputeprocess.com/jsp/client/login.jsp` | `pulse.disputeprocess.com` | `persist:gc-disputefox` |
| Cloud Tax | `https://grantandco.cloudtaxoffice.com/proavalon/` | `grantandco.cloudtaxoffice.com` | `persist:gc-cloud-tax` |

See `docs/ALLOWLIST.md` for the matching rules. See `docs/TEST-CRITERIA.md` for the empty compatibility matrix.

## Windows (primary)

Requires [Node.js 20+](https://nodejs.org/) and npm.

```bat
cd desktop-electron
npm install
npm start
```

Windows installer (unsigned; expect SmartScreen on a spike):

```bat
cd desktop-electron
npm install
npm run build
```

Output: `desktop-electron/dist/`.

### Windows notes

- Run `npm start` from this folder. Do not point the chrome renderer at the live OS URL.
- Sign-in, SSO, MFA, and file-upload behavior are **unknown** until an authorized Windows tester fills `docs/TEST-CRITERIA.md`.
- If a vendor leaves the exact allowlist (common for SSO), this spike **does not** invent `grantscoos://`. Use **Open securely in browser**, finish auth there, return here. The desktop window stays open.
- **Clear site data and sign out** wipes that desk’s partition only. Cookies are never copied, inspected, exported, or edited one-by-one.

## Linux (compile / smoke only)

Linux can install and launch the same project when you need to compile or smoke the shell. Vendor compatibility is still a Windows + authorized-account job.

```bash
cd desktop-electron
npm install
npm test
npm start
```

Optional unpackaged Linux output:

```bash
npm run build:linux
```

Headless smoke (this repo’s CI-style check):

```bash
npm test
npx electron . --smoke
```

On some Linux VMs Electron needs `xvfb-run` and the smoke flag adds `--no-sandbox` **only** for `--smoke` on Linux. Windows `npm start` does not disable the Chromium sandbox.

## macOS (observed load, not a Windows proof)

OS Home starts at `/login` so the first `WebContentsView` load skips the `/` → `/login` 307. On `darwin` only, Chromium `disable-quic` is appended **before** `app` ready. Sandbox stays on. User-Agent is not spoofed. Headers are not stripped. Certificate errors are not ignored. This is not evidence that Windows is fixed.

## Security rules this spike follows

Every OS and vendor `WebContentsView`:

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- **No preload**
- Persistent `partition` per desk
- Exact hostname allowlist (no wildcards, no suffix match)
- Unknown top-level redirects / popups: block in the view, or open https in the system browser and tell the user to return
- Permission requests denied
- Downloads: confirm, choose a path, show completion / failure
- `<webview>` attach is rejected

Chrome window / chrome view may use a preload that exposes only `window.spikeChrome` IPC. It never exposes Electron, cookies, or a live-OS bridge.

This spike does **not**:

- Reverse-proxy vendor sites
- Strip or rewrite headers
- Spoof User-Agent
- Inject scripts into provider pages
- Implement `grantscoos://` return
- Copy, inspect, export, or modify auth cookies

## Architecture

```
BaseWindow
 ├── WebContentsView  local chrome  (optional preload → spikeChrome IPC only)
 └── WebContentsView  one per open desk (no preload, persist partition)
```

The chrome view paints the sidebar and toolbar. Each desk view is positioned in the remaining rectangle. Closing a tab destroys that view; the partition remains until **Clear site data and sign out**.

## Tests that exist here

`npm test` checks allowlist exact-match rules, the locked official URLs, sandbox prefs, and that chrome HTML does not iframe the live OS or vendors.

Those tests do **not** prove any provider login works.

## Compatibility

The matrix in `docs/TEST-CRITERIA.md` is **empty on purpose**. Do not fill it from Linux, from this agent environment, or from guesses.
