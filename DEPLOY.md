# RupeeRise — Production Deployment Guide (Single Domain)

Full live deploy of the entire stack to **Vercel + Render + Neon**, served under your **single GoDaddy `.in` domain**. Total cost: **$0/month** for personal traffic.

---

## Architecture (single-domain)

```
                           https://yourdomain.in
                                    │
                                    ▼
                          ┌──────────────────┐
                          │     Vercel       │
                          │  Next.js (web)   │
                          └────┬─────────┬───┘
                               │         │ /api/* rewrite
                  static pages │         ▼
                               │   ┌─────────────────────┐
                               │   │  Render (API)        │
                               │   │  rupeerise-api...   │
                               │   └────────┬─────────────┘
                               │            │
                               ▼            ▼
                          (browser)    ┌──────────┐
                                       │   Neon   │
                                       │ Postgres │
                                       └──────────┘
```

The browser only ever talks to `https://yourdomain.in`. Vercel proxies any
request whose path starts with `/api/` to the Render-hosted API. So:

  | Browser request                            | Where it lands                                   |
  |--------------------------------------------|--------------------------------------------------|
  | `GET https://yourdomain.in/`               | Vercel (Next.js home)                            |
  | `GET https://yourdomain.in/dashboard`      | Vercel                                           |
  | `POST https://yourdomain.in/api/auth/login`| Vercel proxy → `rupeerise-api.onrender.com/auth/login` |

| Piece | Host | Free tier | Notes |
|---|---|---|---|
| Frontend | Vercel | unlimited | Custom domain free, auto-SSL |
| API | Render | 750 hrs/mo | Sleeps after 15 min idle (cold start ~30s) |
| DB | Neon | 0.5 GB storage | Plenty for thousands of users |
| Email | Gmail SMTP | 500/day | Free with App Password |
| Payments | Razorpay | per-tx fee | India-friendly |

---

## Step 0 — Prerequisites

- **GitHub account** (free) — Vercel & Render both deploy from GitHub
- **Domain at GoDaddy** (e.g. `rupeerise.in`) — you already have this ✓
- **Gmail account** with 2-Step Verification on (for OTP delivery)
- **Razorpay account** (optional — only if you want instant card/UPI deposits)
- A laptop with **Node.js 20+** and **Git** installed

---

## Step 1 — Push the repo to GitHub

On your laptop, in the project root:

```powershell
# (one-time) initialise git if you haven't already
git init
git add .
git commit -m "Initial RupeeRise commit"
git branch -M main

# create a new private repo on github.com first, then:
git remote add origin https://github.com/YOUR_USERNAME/rupeerise.git
git push -u origin main
```

> If `git push` asks for credentials, generate a [Personal Access Token](https://github.com/settings/tokens) (classic, scope: `repo`) and use it as your password.

---

## Step 2 — Create the Postgres database (Neon)

1. Go to <https://console.neon.tech/> and sign in with GitHub (free, no card).
2. **Create a new Project** → name it `rupeerise` → region: **AWS ap-south-1 (Mumbai)** if available, else Singapore.
3. After creation, click **Connection Details** in the left sidebar.
4. Make sure the dropdown reads **"Pooled connection"** (recommended for serverless API).
5. Copy the connection string. It looks like:
   ```
   postgresql://USER:PASSWORD@ep-xxx-yyy-pooler.ap-south-1.aws.neon.tech/neondb?sslmode=require
   ```
6. **Save this string somewhere safe** — you'll paste it into Render in Step 3.

### Switch the schema to PostgreSQL + generate the initial migration

The repo ships with `provider = "sqlite"` so local dev works zero-config. Before deploying you need to flip it to PostgreSQL and create a migration. Two short commands:

```powershell
cd apps\api

# 1. Flip schema.prisma from sqlite -> postgresql (idempotent)
npm run prepare:prod

# 2. Put your Neon URL in apps\api\.env first:
#       DATABASE_URL="postgresql://USER:PASS@ep-xxx-pooler.ap-south-1.aws.neon.tech/neondb?sslmode=require"
#    Then generate the migration against Neon:
npx prisma migrate dev --name init

# 3. Commit the migration + the schema flip and push.
git add apps\api\prisma\schema.prisma apps\api\prisma\migrations
git commit -m "feat: switch to postgresql and add initial migration"
git push
```

> If you'd rather keep developing locally on SQLite and **skip** the migration step, you can — `apps/api/scripts/start-prod.cjs` will fall back to `prisma db push` on the first Render deploy. But you must still run `npm run prepare:prod` so the schema targets postgresql before pushing.

---

## Step 3 — Deploy the API (Render)

1. Go to <https://dashboard.render.com/> and sign in (free, GitHub login).
2. Click **New +** → **Blueprint**.
3. Select your `rupeerise` GitHub repo.
4. Render auto-detects `apps/api/render.yaml` and proposes a service named **`rupeerise-api`**. Click **Apply**.
5. Once created, open the service → **Environment** tab and fill in:

| Key | Value |
|---|---|
| `DATABASE_URL` | (paste pooled connection string from Neon, Step 2) |
| `WEB_ORIGIN` | `https://yourdomain.in,https://www.yourdomain.in,https://rupeerise.vercel.app` |
| `ADMIN_EMAILS` | your own email (auto-promoted to admin on first login) |
| `ADMIN_PASSWORD` | a strong password for `admin@rupeerise.local` (used for `/admin/login`) |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_USER` | `you@gmail.com` |
| `SMTP_PASS` | 16-char Gmail App Password — see below |
| `MAIL_FROM` | `RupeeRise <you@gmail.com>` |
| `RAZORPAY_KEY_ID` | (from Razorpay dashboard, optional) |
| `RAZORPAY_KEY_SECRET` | (from Razorpay dashboard, optional) |
| `UPI_ID` | `yourbusiness@upi` (only used as fallback if no payment channels are set up in admin) |

> `JWT_SECRET` is auto-generated by Render via `render.yaml` — don't override it.

6. Click **Save Changes** → Render rebuilds and redeploys (~3 min).
7. **Copy the public URL Render gave you** — it will look like `https://rupeerise-api.onrender.com`. You will paste this into `apps/web/vercel.json` in the next step.
8. Visit `https://rupeerise-api.onrender.com/health` — you should see `{"status":"ok",...}`. **API is live!**

### Gmail App Password setup (5 min, free)

1. Visit <https://myaccount.google.com/security>
2. Enable **2-Step Verification** if you haven't already.
3. Go to <https://myaccount.google.com/apppasswords>.
4. App name: `RupeeRise`. Click **Create**. Copy the 16-character password (no spaces).
5. Paste it into Render as `SMTP_PASS`.

---

## Step 4 — Wire up the Vercel rewrite, then deploy the frontend

### 4a — Edit `apps/web/vercel.json` with your real Render host

Open `apps/web/vercel.json` on your laptop. Replace `REPLACE_ME_API_HOST` with the host name (no `https://`, no trailing slash) Render gave you in Step 3:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://rupeerise-api.onrender.com/:path*"
    }
  ]
}
```

Commit + push:

```powershell
git add apps\web\vercel.json
git commit -m "chore: point Vercel /api proxy at Render host"
git push
```

### 4b — Import the project on Vercel

1. Go to <https://vercel.com/new> and sign in with GitHub.
2. **Import** the `rupeerise` repo.
3. **Root Directory** → click *Edit* → select `apps/web`.
4. Framework preset → **Next.js** (auto-detected).
5. **Environment Variables**:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `/api` *(yes, just the relative path — the rewrite does the rest)* |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | same key id as `RAZORPAY_KEY_ID` on Render |
| `NEXT_PUBLIC_SITE_URL` | `https://yourdomain.in` |
| `NEXT_PUBLIC_BRAND_NAME` | `RupeeRise` |

6. Click **Deploy**. Wait ~2 min for the first build.
7. Vercel gives you a preview URL like `https://rupeerise.vercel.app`. Open it.
8. **Smoke test the proxy:** visit `https://rupeerise.vercel.app/api/health` — you should see the same `{"status":"ok",...}` JSON. If you do, the Vercel → Render rewrite is working ✓
9. Try `/login` → enter your `ADMIN_EMAILS` address → request OTP → check your Gmail. Verify OTP and you should land on `/admin`.

---

## Step 5 — Point your GoDaddy `.in` domain at Vercel

Only the **frontend** needs a domain. The API stays on `rupeerise-api.onrender.com` and is invisible to users — they only ever see `https://yourdomain.in`.

### 5a — Add the domain in Vercel

1. In your Vercel project → **Settings** → **Domains** → **Add**.
2. Enter your apex domain (e.g. `rupeerise.in`) → click **Add**.
3. Vercel will then prompt you to also add the `www.rupeerise.in` redirect — click **Add** there too.
4. Vercel now shows the DNS records you need to set at GoDaddy:
   - For `@` (apex): **A record** → `76.76.21.21`
   - For `www`: **CNAME** → `cname.vercel-dns.com`

### 5b — Set DNS records in GoDaddy

1. Sign in at <https://dcc.godaddy.com/control/portfolio> and click your domain.
2. Click **DNS** → **Manage DNS** (or **DNS Records**).
3. **Delete** any default `Parked` / forwarding A records pointing at GoDaddy's parking IPs. Keep MX records (email) and any TXT records you've added — only touch A and CNAME for `@` and `www`.
4. Click **Add New Record** twice:

   | Type | Name | Value | TTL |
   |------|------|-------|-----|
   | `A` | `@` | `76.76.21.21` | 600 (or default) |
   | `CNAME` | `www` | `cname.vercel-dns.com` | 600 |

5. Click **Save**. GoDaddy starts propagating immediately; full propagation can take 5–60 minutes.

### 5c — Wait for SSL + verify

1. Back in Vercel → **Settings** → **Domains**, both records turn green with "Valid Configuration" once DNS propagates.
2. Vercel auto-issues a free SSL certificate (Let's Encrypt). This usually finishes within a minute of DNS being valid.
3. Open `https://yourdomain.in` — landing page should load over HTTPS.
4. Open `https://yourdomain.in/api/health` — confirms the proxy is still wired up under your custom domain.

### 5d — Update Render `WEB_ORIGIN`

Now that you know the final domain:

1. Render dashboard → `rupeerise-api` → **Environment**.
2. Edit `WEB_ORIGIN` to: `https://yourdomain.in,https://www.yourdomain.in`
   (you can drop the `rupeerise.vercel.app` entry now if you like)
3. Save → Render redeploys (~2 min).

That's it — you're live on your real domain.

---

## Step 6 — Smoke test the live site

Open `https://yourdomain.in` and run through the checklist:

**Auth flow**

- [ ] Landing page loads with no console errors (F12 → Console)
- [ ] `/login` → Sign Up tab → fill name + email + password + 10-digit phone → click *Send Verification OTP*
- [ ] OTP arrives in your Gmail (or check Render Logs tab if not)
- [ ] Enter OTP → account is created → you land on `/dashboard`
- [ ] Sign out → on `/login` enter the same email + password → you sign in instantly (no OTP)
- [ ] *Forgot password* flow: receive OTP, set new password, log in with new password

**Profile**

- [ ] `/profile` loads with header (name, email, KYC, balances)
- [ ] Edit first name + phone → click *Save changes* → green check appears
- [ ] **Statement** section lists recent activity, CSV + PDF download work
- [ ] **Deposits / Withdrawals** tabs render history (empty is fine)
- [ ] **Gift codes** → enter a test code (admin can mint one) → balance goes up
- [ ] **Security** → change password → log out → log in with new password

**Admin**

- [ ] Open `/admin/login` → enter `admin@rupeerise.local` + `ADMIN_PASSWORD` → land on `/admin`
- [ ] OR sign in via `/login` with your `ADMIN_EMAILS` address → also lands on `/admin`
- [ ] `/admin/payment-channels` → create a UPI channel → set as default
- [ ] User wallet → see the UPI QR with the channel you set
- [ ] `/admin/users` → Export CSV downloads a file
- [ ] `/admin/gift-codes` → mint a code → redeem it from a user account

---

## Common Issues

### `/api/...` returns 502 / 504
- Render free tier sleeps after 15 min idle → first request after a quiet spell takes ~30s. Refresh once.
- Open `https://rupeerise-api.onrender.com/health` directly — if that's also down, the API is genuinely cold/crashed; check Render Logs.

### `/api/...` returns 404 in production
- Make sure `apps/web/vercel.json` has the `https://rupeerise-api.onrender.com` host filled in (no trailing slash).
- After editing `vercel.json`, you must `git push` so Vercel rebuilds.

### CORS errors in browser console
- With the single-domain proxy you should never see CORS errors (requests look same-origin to the browser).
- If you do, you're calling the API directly. Check `NEXT_PUBLIC_API_URL` is `/api` on Vercel, not the Render URL.

### "Account blocked" / no admin access
- Make sure your email is in `ADMIN_EMAILS` on Render (comma-separated, no spaces).
- Or use `/admin/login` with `admin@rupeerise.local` + `ADMIN_PASSWORD`.

### OTP email not arriving
- Check Render Logs tab. Without `SMTP_HOST`, OTPs print to logs as `[DEV] OTP for x@y = 123456`.
- If using Gmail, the App Password must be exactly 16 chars (no spaces). Re-generate if unsure.
- Check spam folder; first-time senders often land there.

### Prisma migration errors on first deploy
- The new `start-prod.cjs` script auto-falls-back to `prisma db push` when no migrations exist, so first deploy should always work.
- If you later see `P3009` errors after schema changes, run `npx prisma migrate dev --name <change>` locally and push the new migration folder.

### Razorpay test mode
- Use **test keys** (`rzp_test_...`) until you've completed Razorpay KYC.
- Test cards: <https://razorpay.com/docs/payments/payments/test-card-details/>

---

## Going from staging to live (real money)

1. Razorpay dashboard → switch to **Live** mode → complete KYC.
2. Generate **live API keys**.
3. Update `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` on Render → Save.
4. Update `NEXT_PUBLIC_RAZORPAY_KEY_ID` on Vercel → redeploy (Deployments → ⋮ → Redeploy).
5. Test with a real ₹1 payment from your own card to validate end-to-end.

## Daily ops & maintenance

- **Real-time logs**: Render → service → Logs · Vercel → deployment → Functions → Logs
- **DB browser**: `cd apps\api && npx prisma studio` (with prod `DATABASE_URL` in `.env`) opens a web UI for your live data
- **Backups**: Neon free tier keeps automatic point-in-time backups for 7 days. Pro plan extends this to 30 days.
- **Scaling out of the free tier**: see *Upgrading later* below.

---

## Upgrading later

- **No cold starts** → upgrade Render API to Starter ($7/mo).
- **More DB** → Neon Pro ($19/mo) or Supabase.
- **Better email** → Resend ($0–20/mo, much higher deliverability than Gmail).
- **Background jobs** → add a Render Cron Job for daily reward claims.

---

**That's it. You're live.** If something breaks, check Render & Vercel logs first — both have great real-time log viewers.
