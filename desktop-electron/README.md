# Grant & Co OS (macOS)

Official public macOS product for **Grant & Co Consultants**.

- Product: Grant & Co OS
- App: `Grant & Co OS.app`
- Download filename (when notarized later): `Grant-and-Co-OS-Mac.dmg`
- Version: 1.0.0
- Website: https://grantandconsultants.com
- Bundle ID: `com.grantandconsultants.os`

The live web OS remains at https://os.grantandconsultants.com. This folder does not replace `/desktop` (Tauri) or the Next.js site.

Do **not** publish a public DMG until the Messages helper is signed and this app is notarized. Do not put secrets in this repo.

## Brand files (add on the owner Mac)

Place official bytes only — do not generate substitutes:

- `resources/icon.icns` — circular Dock / Finder emblem
- `resources/brand/logo.jpeg` — full wordmark for sidebar, welcome, About, and the DMG window

See `resources/README.md`.

## Unsigned local build (Charles’s Mac)

Requires macOS, Node.js 20+, and the brand files above.

```bash
cd desktop-electron
npm install
npm test
CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac
```

That produces an unsigned arm64 `Grant & Co OS.app` under `dist/mac-arm64/` (or `dist/mac/`). Gatekeeper will warn until the app is signed later. `CSC_IDENTITY_AUTO_DISCOVERY=false` keeps local verification from searching for a signing identity.

Also supported on a Mac with the same unsigned flag:

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac dir --x64
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac dir --universal
CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist:mac
```

`dist:mac` writes `Grant-and-Co-OS-Mac.dmg`. Keep that private until notarization.

## Messages (owner only)

Optional. Hidden unless the signed-in OS user is an Owner.

```bash
npm run helper:fetch
npm run helper:build
```

Uses the pinned MIT `imessage-cli` from https://github.com/beeper/platform-imessage through the Messages app already signed in. This is not an Apple-supported public iMessage API. See `docs/IMESSAGE.md` and `vendor/NOTICE.md`.

Turn the desk off: `GC_MESSAGES_DESK=0`.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm start` | Run from this folder |
| `npm test` | Allowlist, identity, security, Messages IPC |
| `npm run build:mac` | Unsigned arm64 `.app` |
| `npm run dist:mac` | Unsigned arm64 `.app` + DMG |

## Security (internal)

Vendor and OS Home views:

- `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`
- No preload, no internal APIs, exact hostname allowlist, persist partitions
- No cookie intercept/export, no UA spoof, no header strip, no iframe, webSecurity stays on

Messages uses a separate trusted local renderer and a validated main-process bridge. Vendor views cannot call it.
