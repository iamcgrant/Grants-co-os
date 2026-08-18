# Desktop applications

Grants & Co OS desktop shells wrap the **canonical web application**. Do not fork business logic into native code.

## Stack

- **Tauri 2** under `/desktop`
- Loads `GC_DESKTOP_URL` (default `https://os.grantandconsultants.com`) via the local splash shell
- If that host is unreachable, probes `GC_DESKTOP_FALLBACK_URL` (default `https://temporary-prompt-oboe-st5fuuv.vercel.app`) instead of navigating to a dead address
- Plugins: notifications, opener (external links), dialog (file pickers), deep-link (`grantscoos://`), updater scaffolding, system tray
- No server secrets are baked into the desktop build — only the public production URL

## Local / Linux builds

Linux artifacts build today without code signing:

| Package | Output (after `npm run build` in `/desktop`) |
|---------|-----------------------------------------------|
| AppImage | `desktop/src-tauri/target/release/bundle/appimage/` |
| Debian | `desktop/src-tauri/target/release/bundle/deb/` |

```bash
node scripts/prepare-desktop-shell.mjs   # splash + icons
cd desktop && npm install && npm run build
```

Requires Rust ≥ 1.88 and `libwebkit2gtk-4.1-dev` on Linux.

`prepare-desktop-shell.mjs` generates a luxury black/champagne splash page that probes the production URL with retries, shows an offline banner when the network is down, and navigates with `window.location.replace()` (no meta-refresh). Icons are regenerated via `scripts/generate-desktop-icons.mjs`.

### Smoke check

```bash
npm run desktop:smoke
# or: node scripts/desktop-smoke-check.mjs
```

Verifies `tauri.conf.json` branding/identifier/bundle targets, capabilities, shell preparation, and that Linux AppImage/deb artifacts exist (in `desktop/src-tauri/target/release/bundle` or `/opt/cursor/artifacts/desktop`).

## CI release workflow

`.github/workflows/desktop-release.yml` builds macOS (Apple Silicon + Intel), Windows, and Linux when:

- a tag matching `desktop-v*` is pushed, or
- the workflow is run manually (`workflow_dispatch`)

Uses [`tauri-apps/tauri-action`](https://github.com/tauri-apps/tauri-action) with `projectPath: desktop`.

Bundle targets in `tauri.conf.json`: `appimage`, `deb`, `dmg`, `app`, `nsis`, `msi`.

### Signing (optional)

Builds succeed without signing secrets and upload **unsigned** artifacts as draft GitHub Releases.

| Platform | GitHub secrets (optional) | Blocker without them |
|----------|---------------------------|----------------------|
| macOS | `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` | Gatekeeper will warn; notarization blocked |
| Windows | `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD` | SmartScreen warnings for unsigned installers |

Linux AppImage/deb do not require signing for internal distribution.

### Updater

`tauri.conf.json` includes updater scaffolding with a placeholder pubkey (`REPLACE_WITH_TAURI_UPDATER_PUBKEY_WHEN_SIGNING_IS_READY`). Replace with a real Tauri updater keypair before enabling auto-update in production.

## Go-live checklist

Ship desktop downloads **only after** the web app is live at `https://os.grantandconsultants.com`.

1. **Confirm production web** — staff can sign in and use core flows on `https://os.grantandconsultants.com`.
2. **Tag a desktop release** — from `main` (or your release branch), push a tag such as `desktop-v0.1.0`. This triggers `.github/workflows/desktop-release.yml` for macOS, Windows, and Linux.
3. **Review the draft GitHub Release** — download and smoke-test each platform artifact. Publish the release when ready.
4. **Set download env vars** — in Vercel/Cursor production secrets, point each `GC_DESKTOP_*_URL` at the **direct asset URLs** from the published release (not the releases index page):
   - `GC_DESKTOP_MAC_URL` — macOS `.dmg` or `.app` zip
   - `GC_DESKTOP_WIN_URL` — Windows `.msi` or `.exe` installer
   - `GC_DESKTOP_LINUX_URL` — Linux `.AppImage` or `.deb`
   - `GC_DESKTOP_RELEASES_URL` — optional link to the GitHub Releases index
5. **Redeploy the web app** — env changes require a production deploy before `/downloads` picks them up.
6. **Verify `/downloads`** — buttons appear only when the URLs above are set; until then the page shows **Coming soon** / **Release pending**.

Do **not** expose unfinished or unsigned builds on `/downloads` before step 4.

## Web app download page

Staff page: `/downloads` (`src/app/(staff)/downloads/page.tsx`)

Shows live download buttons only when these env vars are set (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `GC_DESKTOP_RELEASES_URL` | Optional link to GitHub Releases index |
| `GC_DESKTOP_MAC_URL` | Direct macOS asset URL |
| `GC_DESKTOP_WIN_URL` | Direct Windows asset URL |
| `GC_DESKTOP_LINUX_URL` | Direct Linux asset URL |

When URLs are unset, the page shows **Coming soon** / **Release pending** — do not publish unfinished builds.

## Features

- Login (web session against production)
- Dashboard, clients, inbox, tasks, Grants Pay, credit intelligence
- Native notifications, external link handling, file dialogs
- Deep links: `grantscoos://path` → navigates to `https://os.grantandconsultants.com/path`
- System tray: show/focus window, quit
