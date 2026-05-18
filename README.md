# RupeeRise — Daily Reward Investment Platform

A premium fintech monorepo containing a luxury landing page, full user dashboard, separate admin console, and a complete investment + referral + withdrawal engine.

```
RupeeRise/
├─ apps/
│  ├─ web/    # Next.js 16 + Tailwind 4 + Framer Motion (user UI + admin UI)
│  └─ api/    # Express 4 + Prisma + PostgreSQL (REST API)
├─ DEPLOY.md       # Production deploy guide (Vercel + Render + Neon)
└─ package.json    # npm workspaces
```

> **Going to production?** See [`DEPLOY.md`](./DEPLOY.md) for a step-by-step guide to deploy this stack to your own domain on the free tier.

---

## Architecture (Core MVP)

### User flow
1. **Sign up / login** at `/login` — **email + OTP**. Phone is optional. The OTP is mailed via SMTP if configured, and is also printed to the API console in dev mode.
2. **Deposit** funds at `/wallet` — submit a UPI/UTR or Razorpay request → admin approves → `deposit` wallet credited.
3. **Buy plan** at `/plans` — debits `deposit` wallet, creates investment, distributes referral commissions.
4. **Daily claim** at `/dashboard` — once per IST day, credits sum of `dailyIncome` of active plans to `earnings` wallet.
5. **Withdraw** at `/withdraw` — Sunday-only (IST), ₹300 min, 5% fee, debits earnings/referral/bonus, awaits admin payout.

### Referral engine (3 levels)
- First plan purchase → direct referrer instantly receives **45%** of plan price into `referral` wallet.
- Every plan purchase → ongoing **L1 = 10% / L2 = 5% / L3 = 2%** to ancestors.
- Tree visible at `/referrals` with leaderboard.

### Admin flow
- Separate URL: `/admin/login`. Emails in `ADMIN_EMAILS` env are auto-promoted to admin role on OTP login.
- Admin shell at `/admin` includes: Overview, Users, Deposits, Withdrawals, Plans (CRUD).
- **No admin links are ever rendered on the public/user surface.** Type the URL manually.

### Wallets
Five wallets per user (auto-provisioned at signup):
| Wallet     | Used for |
|------------|----------|
| deposit    | Funded by approved deposits, debited on plan purchase |
| earnings   | Credited on daily claim, debited on withdrawal |
| referral   | Credited from referral engine, debited on withdrawal |
| bonus      | Credited from gamification/admin grants, debited on withdrawal |
| withdrawal | Reserved (mirrors withdrawn funds) |

All wallet movements go through `postLedger()` (atomic, idempotent via `idempotencyKey`).

---

## Local development

### 1. Prerequisites
- Node.js 20+
- PostgreSQL 14+ (local or hosted)
- Optional: Razorpay sandbox keys for live deposit gateway

### 2. Environment

`apps/api/.env` (copy from `.env.example`):
```bash
DATABASE_URL="postgresql://user:password@localhost:5432/rupeerise?schema=public"
JWT_SECRET="replace_me_with_a_long_random_string"
PORT=4000

# Comma-separated emails auto-elevated to admin on OTP login.
# These are the ONLY accounts that can log in at /admin/login.
ADMIN_EMAILS="admin@example.com"

# Email / SMTP for OTP delivery. If unset, OTP is printed to the API console (dev mode).
# Gmail App Password example:
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="you@gmail.com"
SMTP_PASS="abcd efgh ijkl mnop"   # 16-char Gmail App Password
MAIL_FROM="RupeeRise <you@gmail.com>"

# Optional gateway
RAZORPAY_KEY_ID=""
RAZORPAY_KEY_SECRET=""
```

`apps/web/.env.local`:
```bash
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

### 3. Install + DB
```bash
# Install everything
npm install

# Generate the Prisma client (resolves all the "name/status/lastIp/deposit does not exist" type errors)
cd apps/api
npx prisma generate

# Apply schema to your DB
npx prisma migrate dev --name init
```

The first `GET /plans` call automatically seeds the four default plans (Starter / Silver / Gold / VIP Elite).

### 4. Run dev servers
From the repo root:
```bash
npm run dev
```
This starts the API on `http://localhost:4000` and the web app on `http://localhost:3000`.

### 5. Smoke test
1. Open `http://localhost:3000` → landing page.
2. Click **Login** → enter `admin@example.com` (matches `ADMIN_EMAILS`) → tap **Send OTP to Email**.
3. Look at the API terminal — it logs `[DEV] OTP for admin@example.com: 123456` and the `[DEV MAIL]` block.
4. Enter that OTP — you're routed to `/admin` (because email is in `ADMIN_EMAILS`).
5. Test the user side: open an incognito window, sign up with any other email, deposit → admin approves → buy plan → claim daily → request withdrawal on Sunday.

> **Tip:** To enable real email delivery in dev, set `SMTP_HOST/PORT/USER/PASS` (e.g. a Gmail App Password) in `apps/api/.env`. With that set, OTPs are emailed to the user's inbox instead of just the console.

---

## Production deployment

### API → Railway / Render
1. Provision a Postgres add-on, copy the `DATABASE_URL`.
2. Set env: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAILS`, `SMTP_HOST/PORT/USER/PASS/MAIL_FROM`, optional `RAZORPAY_KEY_ID/SECRET`.
3. Build command: `npm install && npx prisma generate && npx prisma migrate deploy && npx tsc -p tsconfig.json`.
4. Start command: `node apps/api/dist/index.js` (or just `npm --workspace @rupeerise/api start`).

### Web → Vercel
1. Project root: `apps/web`.
2. Env: `NEXT_PUBLIC_API_URL` = your deployed API URL.
3. Framework preset: Next.js (auto).

### Hardening checklist before go-live
- [ ] Configure SMTP (Gmail App Password / SendGrid / Resend / Postmark) so OTPs reach inboxes — already wired via `lib/mail.ts`.
- [ ] Move JWT to `httpOnly` cookies + CSRF token if exposing to public production.
- [ ] Wire actual UPI / Razorpay webhooks to auto-approve deposits instead of manual UTR.
- [ ] Add rate limits (e.g. `express-rate-limit`) on `/auth/*` and `/withdrawals`.
- [ ] Configure stricter CORS (`WEB_ORIGIN`) in `apps/api/src/index.ts`.
- [ ] Run `prisma migrate deploy` (not `dev`) in production.
- [ ] Rotate `JWT_SECRET` and add a token-revocation list if needed.

---

## REST API surface

Public:
- `GET  /health`
- `GET  /plans`
- `POST /auth/request-otp`
- `POST /auth/verify-otp`

Authed (Bearer JWT):
- `GET  /me`, `PATCH /me`
- `GET  /wallets`
- `POST /deposits`, `GET /deposits`
- `POST /deposits/razorpay/order`
- `POST /investments`, `GET /investments`
- `GET  /claims/status`, `POST /claims`
- `GET  /referrals/me`, `GET /referrals/leaderboard`
- `POST /withdrawals`, `GET /withdrawals`

Admin (Bearer JWT + `role=admin`):
- `GET  /admin/stats`, `GET /admin/activity`
- `GET  /admin/users`, `PATCH /admin/users/:id`, `POST /admin/users/:id/adjust`
- `GET  /admin/deposits`, `POST /admin/deposits/:id/approve|reject`
- `GET  /admin/withdrawals`, `POST /admin/withdrawals/:id/approve|reject`
- `GET  /admin/plans`, `POST /admin/plans`, `PATCH /admin/plans/:id`, `DELETE /admin/plans/:id`

---

## What's NOT in this MVP (but the schema/architecture supports adding)
- Spin wheel / scratch cards / festival missions UI
- Telegram bot, WhatsApp notifications, AI support chat
- KYC document upload (toggle exists, file upload is the next step)
- PWA install + Android shell wrapping
- SMS OTP delivery (email-OTP is in place; SMS would be additive)
- Google / OAuth one-tap (email-OTP is the current passwordless path)

These are intentionally deferred. The data model (`ActivityLog`, `Notification`, `bonus` wallet, VIP table) is already in place to host them.
