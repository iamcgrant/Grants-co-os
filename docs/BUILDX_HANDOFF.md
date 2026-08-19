# BUILDX / production handoff — os.grantandconsultants.com

**Permanent hostname:** `https://os.grantandconsultants.com`  
**Do not use:** `grantsandco.com` / `os.grantsandco.com` (no public DNS).

## Vercel project (claimed)

| Field | Value |
|-------|--------|
| Team | iamcgrant's projects (Hobby) |
| Project | `temporary-prompt-oboe-st5fuuv` |
| Project ID | `prj_7k6wvDk7P2NziRrcYsw2yUlSpwCx` |
| Dashboard | https://vercel.com/iamcgrants-projects/temporary-prompt-oboe-st5fuuv |
| Current URL | https://temporary-prompt-oboe-st5fuuv.vercel.app |

BUILDX owns: Vercel CLI/token, Neon/Postgres, env upsert, custom domain attach.  
Cursor Cloud Agent does **not** need `VERCEL_TOKEN` in session.

## Env vars to set on Vercel (Production)

Copy from `.env.production.example`. Minimum for first Owner login:

| Name | Value |
|------|--------|
| `DATABASE_URL` | Neon `postgresql://…?sslmode=require` |
| `AUTH_SECRET` | strong random (`openssl rand -base64 48`) |
| `GC_CRON_SECRET` | strong random |
| `CRON_SECRET` | same as `GC_CRON_SECRET` |
| `NEXT_PUBLIC_APP_URL` | `https://os.grantandconsultants.com` |
| `GC_DESKTOP_URL` | `https://os.grantandconsultants.com` |
| `GC_ENV` | `production` |
| `GC_VERCEL_EXTERNAL` | `1` |
| `GHL_API_KEY` | existing |
| `GHL_LOCATION_ID` | existing |
| `PAYMENT_PROVIDER` | `commas` when Commas key ready; else leave unset/`mock` for UI-only |
| `COMMAS_API_KEY` | when ready |
| `COMMAS_ENVIRONMENT` | `sandbox` until live charges approved |
| `COMMAS_LIVE_CHARGES` | `false` until approved |

After Neon is connected, run migrate (BUILDX or CI):

```bash
DATABASE_URL='postgresql://…' npm run db:migrate:production
# Optional first staff seed (requires SEED_PASSWORD):
SEED_PRODUCTION=true SEED_PASSWORD='…' DATABASE_URL='postgresql://…' npm run db:migrate:production
# Prefer Owner first-time setup after migrate:
OWNER_SETUP_BASE_URL=https://os.grantandconsultants.com npm run owner:setup-link
```

## Custom domain + Squarespace DNS

1. Vercel → Project → **Settings → Domains** → Add **`os.grantandconsultants.com`**
2. Copy the **exact** record Vercel shows
3. Squarespace → Domains → `grantandconsultants.com` → DNS → Add:

| Type | Host | Data | TTL |
|------|------|------|-----|
| `CNAME` | `os` | *(paste from Vercel — often `cname.vercel-dns.com`)* | default |

4. Wait for Vercel domain status = **Valid** (SSL automatic)
5. Verify: `curl -fsS https://os.grantandconsultants.com/api/health`

## Commas (after public HTTPS)

```bash
COMMAS_API_KEY=… NEXT_PUBLIC_APP_URL=https://os.grantandconsultants.com npm run commas:register-webhook
# Store returned COMMAS_WEBHOOK_SECRET on Vercel Production env
```

## Desktop

Unsigned `desktop-v0.1.2` assets are public on GitHub Releases.  
`/downloads` defaults already point at those URLs. After `os.grantandconsultants.com` is live, optional: set `GC_DESKTOP_*_URL` env overrides. Code-signing remains a human Apple/Windows cert step.

## Owner access after DB + domain

Until Squarespace CNAME `os` exists, open **`https://temporary-prompt-oboe-st5fuuv.vercel.app/login`** — not the permanent hostname.

1. Production `DATABASE_URL` must be Neon `postgresql://…?sslmode=require` on project `temporary-prompt-oboe-st5fuuv`
2. Redeploy after the env change (and after this access-fix lands so Vercel never loads SQLite)
3. `npm run db:migrate:production`
4. `OWNER_SETUP_BASE_URL=https://temporary-prompt-oboe-st5fuuv.vercel.app npm run owner:setup-link` (switch the base URL to `https://os.grantandconsultants.com` after DNS)
5. Open SET_PASSWORD_URL → choose password
6. Login: live Vercel `/login` or `https://os.grantandconsultants.com/login` · `owner@grantsandco.com`
