# ACTION REQUIRED — get https://os.grantsandco.com online

## Diagnosis (verified 2026-08-18)

| Check | Result |
|-------|--------|
| `os.grantsandco.com` DNS | **NXDOMAIN** — Safari “Can’t Find the Server” is correct |
| `grantsandco.com` apex DNS | **NXDOMAIN** — parent domain is not in public DNS (RDAP 404 / not registered or not delegated) |
| Live brand domain | **`grantandconsultants.com`** (Squarespace DNS, A `35.208.169.184`) |
| `VERCEL_TOKEN` in this agent | **Missing** — cannot attach custom domain or provision Neon from here |
| Temporary Vercel deploy | **Live** (see claim link below; expires ~1 hour from deploy) |
| Temp `/login` | HTTPS 200 |
| Temp `/api/health` | `database: error` until Postgres `DATABASE_URL` is set (SQLite cannot run on Vercel) |

**Nothing is wrong with Safari.** There is no DNS record path for `os.grantsandco.com` until the apex exists and an `os` record is published.

---

## ONLY human actions required (do in order)

### A — Domain (pick ONE)

**Option A1 (keep `os.grantsandco.com`):**  
1. Register / restore **`grantsandco.com`** at a registrar (Squarespace Domains, Namecheap, etc.).  
2. Point nameservers wherever you will manage DNS (Squarespace DNS is fine if that is your registrar).

**Option A2 (faster — use existing brand domain):**  
Use **`os.grantandconsultants.com`** instead (parent already lives on Squarespace). Tell the agent to retarget `NEXT_PUBLIC_APP_URL` to that host after claim.

### B — Claim the Vercel deployment (do this within ~1 hour)

1. Open: https://vercel.com/claim-deployment?code=107b3743-8b4e-46eb-a083-f0f02d07c27e  
2. Sign in to your Vercel account and **claim** the deployment.  
3. Temporary app (proof HTTPS works): https://temporary-prompt-oboe-st5fuuv.vercel.app/login  

### C — Give the agent deploy power

Add to [Cursor environment secrets](https://cursor.com/dashboard/cloud-agents/environments/e/0b257c05-9983-11f1-ba66-0e7d0216e441):

| Name | Value |
|------|--------|
| `VERCEL_TOKEN` | Create at https://vercel.com/account/tokens |
| `NEXT_PUBLIC_APP_URL` | `https://os.grantsandco.com` **or** `https://os.grantandconsultants.com` (match Option A) |
| `PAYMENT_PROVIDER` | `commas` (optional for first login; required for payments) |
| `COMMAS_API_KEY` | From Commas (optional for first login) |

Then start a **new** Cloud Agent follow-up and say **continue**.

### D — DNS record (after B; enter exactly what Vercel shows)

In Vercel → Project → **Settings → Domains** → Add `os.grantsandco.com` (or `os.grantandconsultants.com`).

Then at Squarespace (or your registrar) DNS for that apex, add the record **Vercel prints** (do not invent). Typical shape for a subdomain:

| Field | Value |
|-------|--------|
| Type | `CNAME` |
| Host / Name | `os` |
| Data / Target | **Copy from Vercel Domains UI** (often `cname.vercel-dns.com`) |
| TTL | Default / 1 hr |

SSL: Vercel issues HTTPS automatically once the CNAME validates — no separate cert step.

### E — Production database

In the claimed Vercel project: **Storage / Marketplace → Neon** → connect → enable backups. That sets production `DATABASE_URL` (`postgresql://…`). Agent can migrate + seed Owner after `VERCEL_TOKEN` is available.

---

## Sign in NOW (while production DNS is fixed)

Tunnel (works today; dies when this agent VM stops):

- Set password: regenerate with agent or use the latest SET_PASSWORD_URL in chat  
- Login: https://readily-backing-legs-blog.trycloudflare.com/login  
- Email: `owner@grantsandco.com` · Role: `OWNER`
