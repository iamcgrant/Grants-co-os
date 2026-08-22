# Messages (owner-only, local, autonomous)

Grant & Co OS can show a Messages desk on the owner Mac. This is **not** an Apple-supported public iMessage API.

## Helper

[beeper/platform-imessage](https://github.com/beeper/platform-imessage) (MIT) at pin `cda1545b87db4aeb2ec266bd8f9f335eec67c323`.

```bash
cd desktop-electron
npm run helper:fetch
npm run helper:build
```

`helper:fetch` clones that commit into `vendor/platform-imessage/` (gitignored).  
`helper:build` compiles `imessage-cli` into `native/messages-helper/bin/` on macOS only.

The main process talks to the helper over **stdio argv** only. `IMESSAGE_CLI_HISTORY_FILE` is unset so plaintext history is not persisted.

## Autonomy

After one-time macOS permissions (Messages Data / Full Disk Access, Accessibility, Automation for Messages, Contacts):

- Auto-start when a signed-in owner entitlement is present (app launch or Home login), not only when the Messages tab is clicked
- Sync conversations on start and subscribe to incoming messages
- Reconnect after sleep, wake, unlock, and network changes
- Restart the helper with backoff if it crashes
- Restore the last-open Messages tab (and conversation id only) for the owner after relaunch
- Detect permission revocation and show onboarding only when macOS needs action

Autonomy is sync, connection, and recovery only. Compose, send, reply, and react happen only from an explicit action in the Messages desk.

## Rules

- Vendor views and OS Home never receive the Messages preload or IPC
- Non-owners never see the item, never start the helper, never read `chat.db`
- No Apple ID form, BlueBubbles, pypush, cloud, REST/WebSocket/LAN listener
- SIP stays on
- Kill switch: `GC_MESSAGES_DESK=0`
- Message contents never go to Vercel
