# Desktop applications

Grants & Co OS desktop shells wrap the **canonical web application**. Do not fork business logic into native code.

## Stack

- **Tauri 2** under `/desktop`
- Loads `GC_DESKTOP_URL` (default production HTTPS origin)
- Native notifications via `tauri-plugin-notification`
- Updater endpoints configured in `desktop/src-tauri/tauri.conf.json`

## Build (on a machine with Rust + platform toolchains)

```bash
node scripts/prepare-desktop-shell.mjs
cd desktop
npm install
npm run build
```

Artifacts:

| Platform | Target |
|----------|--------|
| macOS | `.dmg` / `.app` |
| Windows | NSIS installer |
| Linux | AppImage + `.deb` |

## Features expected in the shell

- Login (web session)
- Dashboard, clients, inbox, tasks, Grants Pay, credit intelligence
- System notifications for inbound messages / missed follow-ups when the web app posts notification events
- Auto-update channel (configure pubkey + `releases.grantsandco.com`)

## Notes

- Staff should not manually reinstall every release once updater pubkey/endpoints are live
- Local development: set `GC_DESKTOP_URL=http://localhost:3000` and run `npm run dev` in repo root + `npm run dev` in `/desktop`
