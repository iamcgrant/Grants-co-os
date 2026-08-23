# Messages helper (owner Mac only)

Builds the pinned `imessage-cli` from [beeper/platform-imessage](https://github.com/beeper/platform-imessage) (MIT). The desktop main process talks to that binary over **stdio argv** — never a port, HTTP, WebSocket, or LAN listener.

This is **not** an Apple-supported public iMessage API. Do not publish a public DMG until this helper is signed and the app is notarized.

## Build on macOS

```bash
cd desktop-electron
npm run helper:fetch
npm run helper:build
```

`helper:fetch` clones the exact commit in `vendor/platform-imessage.pin.json`.  
`helper:build` compiles `imessage-cli` into `native/messages-helper/bin/`.

`build:mac` / `dist:mac` copy that binary into the app’s extra resources when it exists. If it is missing, Grant & Co OS still builds; the Messages desk shows branded setup and **Open Apple Messages**.
