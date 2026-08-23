# Exact hostname allowlists

Matching is **exact hostname equality** (case-insensitive). No wildcards. No `*.example.com`. No suffix / parent / sibling match.

`app.gohighlevel.com` does **not** allow `gohighlevel.com`, `www.gohighlevel.com`, or `foo.app.gohighlevel.com`.

Only **top-level** navigations, redirects, and `window.open` / popups are filtered. Subresources (XHR, scripts, websockets, images) are not rewritten and are not header-stripped.

## Official first-wave hosts

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

Messages is not a host allowlist desk. It is a trusted local workspace and is hidden unless a server-signed owner entitlement is valid.

## What happens off-allowlist

| Event | Behavior |
|-------|----------|
| `https:` host not in the desk list | Stay on the last allowed page. Open that https URL in the **system browser**. Banner tells the user to return. No `grantscoos://`. |
| `http:`, `javascript:`, `file:`, `grantscoos://`, invalid URL | Block. Do not open. |
| Allowed-host popup | Unprivileged window, same partition, no preload |
| Unknown-host popup | Denied in-shell; https may open in the system browser |
| **Open securely in browser** | Shown only after a failed load, blocked navigation, certificate error, or crashed renderer. Official **start URL** only. |

Additional exact hosts must be added **explicitly** after observation — never via suffix matching or a guessed CDN list.

## Protocols we will not add

No provider has officially documented a `grantscoos://` redirect URI for these products. Grant & Co OS does not register one.
