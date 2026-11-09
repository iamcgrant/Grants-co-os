# Messages (owner-only, local)

Grant & Co OS can show a Messages desk on the owner Mac. This is **not** an Apple-supported public iMessage API.

## Evaluation of the pinned helper

[beeper/platform-imessage](https://github.com/beeper/platform-imessage) (MIT) is a Swift library and `imessage-cli` that:

- Talks only to the local Messages app already signed in
- Reads `chat.db` and uses Accessibility / Automation / Contacts after the user grants them in System Settings
- Does not disable SIP
- Does not expose a REST/WebSocket server
- Is separate from Beeper cloud, Matrix, pypush, rustpush, BlueBubbles Private API, and AirMessage

Pin: `vendor/platform-imessage.pin.json`  
Attribution: `vendor/NOTICE.md`

We use the CLI over **stdio argv** from the desktop main process. We do not load their Node/Electron cloud bindings.

## Rules

- Vendor views and OS Home never receive the Messages preload.
- Main process validates sender, operation, conversation id, recipient, and attachment path.
- Server-signed owner entitlement unlocks the UI only. Message contents never go to Grant & Co servers, Vercel, analytics, or third parties.
- Non-owners: desk hidden, helper not started, Messages database not read, no permission prompts.
- No Apple ID form. Branded setup if Messages is not ready.
- Permission buttons open System Settings. Recheck on return.
- Disconnect stops the helper and clears Grant & Co cache only.
- Kill switch: `GC_MESSAGES_DESK=0`
- Do not publish a public DMG until the helper is signed and the app is notarized.
