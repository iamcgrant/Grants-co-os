# Messages helper (owner Mac only)

Builds the pinned `imessage-cli` from [beeper/platform-imessage](https://github.com/beeper/platform-imessage) (MIT). The desktop main process talks to that binary over **stdio argv** — never a port, HTTP, WebSocket, or LAN listener.

This is **not** an Apple-supported public iMessage API.

## Build on macOS

```bash
cd desktop-electron
npm run helper:fetch
npm run helper:build
```

`helper:fetch` clones the exact commit in `vendor/platform-imessage.pin.json`.  
`helper:build` compiles `imessage-cli` into `native/messages-helper/bin/`.

The main process auto-starts this helper when a signed-in owner session is present. It does not wait for the Messages tab. Compose and send stay explicit user actions only.
