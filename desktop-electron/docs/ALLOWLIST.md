# Exact hostname allowlists

Matching is **exact hostname equality** (case-insensitive). No wildcards. No `*.example.com`. No suffix / parent / sibling match.

`app.gohighlevel.com` does **not** allow `gohighlevel.com`, `www.gohighlevel.com`, or `foo.app.gohighlevel.com`.

Only **top-level** navigations, redirects, and `window.open` / popups are filtered. Subresources (XHR, scripts, websockets, images) are not rewritten and are not header-stripped. That is intentional: this spike does not intercept provider traffic.

## Locked first-wave hosts

| Desk | Official start URL | Allowed hosts (exact) |
|------|--------------------|------------------------|
| OS Home | `https://os.grantandconsultants.com/` | `os.grantandconsultants.com` |
| GHL | `https://app.gohighlevel.com/` | `app.gohighlevel.com` |
| Telegram | `https://web.telegram.org/a/` | `web.telegram.org` |
| Experian | `https://www.experian.com/consumer/upload/` | `www.experian.com` |
| Equifax | `https://www.equifax.com/personal/credit-report-services/credit-dispute` | `www.equifax.com` |
| DisputeFox | `https://pulse.disputeprocess.com/jsp/client/login.jsp` | `pulse.disputeprocess.com` |
| Cloud Tax | `https://grantandco.cloudtaxoffice.com/proavalon/` | `grantandco.cloudtaxoffice.com` |

Source of truth: `src/main/desks.js`.

## What happens off-allowlist

| Event | Behavior |
|-------|----------|
| `https:` host not in the desk list | Stay on the last allowed page. Open that https URL in the **system browser**. Banner tells the user to return. No `grantscoos://`. |
| `http:`, `javascript:`, `file:`, `grantscoos://`, invalid URL | Block. Do not open. |
| Allowed-host popup | Unprivileged window, same partition, no preload |
| Unknown-host popup | Denied in-shell; https may open in the system browser |
| User clicks **Open securely in browser** | Official **start URL** only, https, system browser, spike stays open |

Additional exact hosts must be added **explicitly** after a Windows observation — never via suffix matching or a guessed CDN list.

## Protocols we will not add

No provider has officially documented a `grantscoos://` (or other Grants-controlled) redirect URI for these six products. This spike does not register one.
