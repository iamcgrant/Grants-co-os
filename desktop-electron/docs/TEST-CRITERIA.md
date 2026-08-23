# Compatibility test criteria

**The results matrix is empty.** It stays empty until a human runs this spike on **Windows** with **authorized test accounts**. Do not invent login, SSO, MFA, upload, or cookie outcomes from Linux, from this agent host, or from reading vendor HTML.

This file is the checklist. Checkboxes are criteria, not completed work.

## Environment required before any result is recorded

- [ ] Windows 10/11 machine (not this Linux compile host)
- [ ] `cd desktop-electron && npm install && npm start` launches the spike
- [ ] Tester is authorized to sign in to each vendor below
- [ ] Tester records the Electron version from `npm ls electron`

Until those are true, every cell in the matrix is **untested**.

## Per-desk criteria (repeat for each row)

For each desk, mark only after a Windows session:

1. **Official start URL loads** in its own `WebContentsView` (not chrome, not iframe).
2. **Sign-in form is usable** (type, click, next step) without UA spoof or script injection.
3. **SSO / OAuth / MFA**, if the account uses it: stays on the exact allowlist, **or** correctly leaves to the system browser with the return banner (no `grantscoos://`).
4. **Session persists** after close tab + reopen desk (same partition). Cookies were not exported.
5. **Clear site data and sign out** requires confirm and forgets that desk only.
6. **Download** (if the product offers one): confirm + Save dialog + completion notice. No silent save.
7. **Unknown host** (if observed): blocked or system-browser; hostname written down for an explicit allowlist PR — no wildcards.
8. **Open securely in browser** (user-clicked): official start URL opens; spike stays open.

## Results matrix — empty until Windows + authorized accounts

| Desk | Start URL loads | Sign-in usable | SSO/MFA path | Session persists | Clear partition | Download confirm | Off-allowlist behavior | Open in browser | Notes |
|------|-----------------|----------------|--------------|------------------|-----------------|------------------|------------------------|-----------------|-------|
| OS Home | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | |
| GHL | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | |
| Telegram | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | |
| Experian | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | |
| Equifax | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | |
| DisputeFox | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | |
| Cloud Tax | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | *untested* | |

## Shell criteria (can be exercised without vendor passwords)

These still should be confirmed on Windows. Linux smoke only proves the process starts.

- [ ] Window / HTML title is Grant & Co OS; no address bar; no disposable-spike banner
- [ ] Sidebar lists only OS Home + the six approved vendors
- [ ] Chrome HTML is local; live OS is not in the preload renderer
- [ ] Back icon (when canGoBack), refresh, tab ×, and the ••• menu update the active desk
- [ ] Loading indicator appears while a view is loading
- [ ] Failed main-frame load shows an error notice in chrome (no injected vendor script)
- [ ] Permission prompts from a vendor page are denied and noticed
- [ ] `npm test` passes (allowlist + desk lock + no iframe/webview in chrome)

## Honest non-claims

Electron’s default user agent is not spoofed. A vendor may refuse the shell. That is a result to record on Windows, not a defect to “fix” by pretending to be Chrome.
