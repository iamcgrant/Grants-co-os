# Desktop applications

Grants & Co OS desktop shells wrap the **canonical web application**. Do not fork business logic into native code.

## Stack

- **Tauri 2** under `/desktop`
- Loads `GC_DESKTOP_URL` (default production HTTPS origin)
- Native notifications via `tauri-plugin-notification`

## Linux builds (produced in Cloud Agent)

Artifacts (not committed — too large; checksums in `/opt/cursor/artifacts/desktop/`):

| Package | Path |
|---------|------|
| AppImage | `desktop/src-tauri/target/release/bundle/appimage/Grants & Co OS_0.1.0_amd64.AppImage` |
| Debian | `desktop/src-tauri/target/release/bundle/deb/Grants & Co OS_0.1.0_amd64.deb` |

```bash
node scripts/prepare-desktop-shell.mjs
cd desktop && npm install && npx tauri build
```

Requires Rust ≥ 1.88 and `libwebkit2gtk-4.1-dev`.

## macOS / Windows

Cross-compile + notarization / Authenticode **require platform secrets Charles must supply**:

| Need | Where |
|------|-------|
| Apple Developer ID Application cert + App Store Connect API key / notarization | Apple Developer account |
| Windows code signing cert (EV preferred) | DigiCert / SSL.com / Azure Trusted Signing |

Until those exist, ship unsigned Linux packages and/or use the PWA install path on Mac/Windows.

## Features

- Login (web session)
- Dashboard, clients, inbox, tasks, Grants Pay, credit intelligence
- Auto-update channel (configure pubkey + release endpoints when signing is live)
