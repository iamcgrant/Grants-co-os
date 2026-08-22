# Brand assets (add locally)

Charles adds the official bytes on the Mac that builds **Grant & Co OS.app**. This folder is wired in packaging, sidebar, welcome, About, and the DMG volume window. Do not generate a substitute logo.

| File | Use |
|------|-----|
| `icon.icns` | Dock / Finder circular emblem only. Never squeeze the full wordmark into this icon. |
| `brand/logo.jpeg` | Full wordmark for sidebar, welcome, About, and DMG. |

Do not reference personal Downloads paths. After the files are in place:

```bash
cd desktop-electron
CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac
```
