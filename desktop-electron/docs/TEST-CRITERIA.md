# Compatibility test criteria

The vendor matrix stays empty until an authorized person records results on a real Mac with authorized accounts. Do not invent login, SSO, MFA, or cookie outcomes from Linux or from this agent host. Do not claim Windows proof.

## Environment required before any vendor result is recorded

- [ ] Mac with the local unsigned `Grant & Co OS.app` from `npm run build:mac`
- [ ] Official wordmark at `resources/brand/logo.jpeg` and Dock emblem at `resources/icon.icns`
- [ ] Tester is authorized to sign in to each vendor below
- [ ] Tester records the version from About Grant & Co OS (`1.0.0`)

Until those are true, every cell in the matrix is **untested**.

## Per-desk criteria (repeat for each vendor row)

1. **Official start URL loads** in its own isolated view (not chrome, not iframe).
2. **Sign-in form is usable** without UA spoof or script injection.
3. **SSO / OAuth / MFA**, if used: stays on the exact allowlist, **or** correctly leaves to the system browser.
4. **Session persists** after close tab + reopen desk (same partition). Cookies were not exported.
5. **Clear site data and sign out** requires confirm and forgets that desk only.
6. **Download** (if offered): confirm + Save dialog + completion notice.
7. **Unknown host**: blocked or system-browser.
8. **Open securely in browser** appears only after error / fallback.

## Results matrix — empty until a real Mac + authorized accounts

| Desk | Start URL loads | Sign-in usable | SSO/MFA path | Session persists | Clear partition | Download confirm | Off-allowlist behavior | Open in browser | Notes |
|------|-----------------|----------------|--------------|------------------|-----------------|------------------|------------------------|-----------------|-------|
| OS Home | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | |
| GHL | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | |
| Telegram | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | |
| Experian | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | |
| Equifax | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | |
| DisputeFox | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | |
| Cloud Tax | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | |

## Messages (owner Mac only)

- [ ] Desk is hidden for non-owners
- [ ] Owner entitlement comes from `/api/desktop/owner-entitlement` after OS Home sign-in
- [ ] Helper does not start until the owner opens Messages
- [ ] System Settings buttons open the listed Privacy panes
- [ ] Disconnect stops the helper and does not delete Apple Messages
- [ ] No message text in logs
- [ ] Public DMG is **not** shipped until the helper is signed and the app is notarized

## Shell criteria

- [ ] Sidebar shows Grant & Co OS, not development wording
- [ ] Slim header: Back only when usable, Refresh, vendor identity, •••
- [ ] No address bar
- [ ] Failed load / blocked nav / cert error / crashed renderer show a branded state
- [ ] `npm test` passes
