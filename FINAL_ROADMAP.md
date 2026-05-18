# RupeeRise — FINAL ROADMAP (Self-Contained)

> **Aap akele bhi yeh complete kar sakte ho** — har value, har click, har screenshot detail iss file me hai. Cascade ki zarurat nahi.

---

## ✅ Ho chuka hai (don't redo)

- [x] Saara code complete: auth, profile, admin, payments
- [x] Local builds clean: API TypeScript ✓ + Web Next.js ✓
- [x] Git initialized + committed
- [x] **Code GitHub par live:** <https://github.com/aspak85/rupeerise>
- [x] **Neon Postgres (Singapore region) ready** with all tables created
- [x] Initial migration committed to GitHub

## 🚧 Pending (yeh karne hain)

- [ ] **Step 3**: Render API deploy
- [ ] **Step 4**: Vercel website deploy + `vercel.json` update
- [ ] **Step 5**: GoDaddy DNS configure
- [ ] **Step 6**: Final `WEB_ORIGIN` update on Render

---

## 🔑 IMPORTANT CREDENTIALS (save karke rakho)

```
GitHub:
  Username: aspak85
  Repo URL: https://github.com/aspak85/rupeerise

Neon Database:
  Region: Singapore (ap-southeast-1)
  Pooled URL (for Render):
    postgresql://neondb_owner:npg_3OwXfz1IqRuj@ep-late-math-aojzkrjq-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

Gmail (for OTP delivery):
  SMTP_HOST: smtp.gmail.com
  SMTP_PORT: 587
  SMTP_USER: mob308379@gmail.com
  SMTP_PASS: ksouvnsxqsxrmykb
  MAIL_FROM: RupeeRise <mob308379@gmail.com>

Admin login (apne app me admin access ke liye):
  ADMIN_EMAILS: mob308379@gmail.com
  ADMIN_PASSWORD: shivam85A@
```

> ⚠️ **Yeh credentials sensitive hain.** Yeh file laptop par hi rakho, GitHub par push nahi hogi (`.gitignore` ne block kiya).

---

# STEP 3: Render API Deploy (15 min)

### 3.1 Render account banao

1. Browser me kholo: <https://dashboard.render.com/register>
2. **Sign in with GitHub** dabao
3. `aspak85` account se authorize karo
4. Phone number verify karo (OTP via SMS) — free tier ke liye mandatory hai
5. Dashboard kholega

### 3.2 Blueprint se deploy karo

1. Dashboard me top right **New +** button dabao
2. **Blueprint** option chuno
3. **Connect a repository**: `rupeerise` chuno → **Connect**
4. Render `apps/api/render.yaml` auto-detect karega
5. Service config dikhayega:
   - Service name: `rupeerise-api`
   - Region: Oregon (free tier default)
   - Branch: main
6. **Apply** button dabao
7. Service create ho jayegi → automatically build start hogi (3-5 min)

### 3.3 Environment variables fill karo

⚠️ **Build first time fail hogi** kyunki env vars nahi hain. Don't panic — abhi fill karte hain.

1. Service page kholo (`rupeerise-api` par click)
2. Left sidebar me **Environment** dabao
3. **Add Environment Variable** click karke ek-ek karke yeh sab add karo:

| Key | Value (copy-paste exactly) |
|-----|----------------------------|
| `DATABASE_URL` | `postgresql://neondb_owner:npg_3OwXfz1IqRuj@ep-late-math-aojzkrjq-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require` |
| `WEB_ORIGIN` | `https://rupeerise.vercel.app` |
| `ADMIN_EMAILS` | `mob308379@gmail.com` |
| `ADMIN_PASSWORD` | `shivam85A@` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `mob308379@gmail.com` |
| `SMTP_PASS` | `ksouvnsxqsxrmykb` |
| `MAIL_FROM` | `RupeeRise <mob308379@gmail.com>` |
| `UPI_ID` | `mob308379@upi` *(ya aapka actual UPI)* |
| `RAZORPAY_KEY_ID` | *(empty chod do — optional)* |
| `RAZORPAY_KEY_SECRET` | *(empty chod do — optional)* |

> Note: `JWT_SECRET` ko mat add karna — `render.yaml` se apne aap generate hota hai. Agar dikhe toh leave it.
> Note: `NODE_ENV` aur `PORT` bhi `render.yaml` se aata hai, skip if visible.

4. Sab add karne ke baad **Save Changes** dabao (bottom me)
5. Render apne aap rebuild karega (~3 min)

### 3.4 Build verify karo

1. **Logs** tab kholo (left sidebar)
2. Yeh sequence dikhna chahiye:
   ```
   ==> Build successful 🎉
   ==> Starting service with 'npm run start:prod'
   [start-prod] Found prisma/migrations — running migrate deploy
   [start-prod] Booting API…
   ==> Detected service running on port 10000
   ==> Your service is live 🎉
   ```
3. **Service URL** (top me): kuch aisa hoga `https://rupeerise-api.onrender.com`

### 3.5 Health check karo

Browser me kholo: `https://rupeerise-api.onrender.com/health`

Yeh aana chahiye:
```json
{"status":"ok","service":"rupeerise-api","time":"2026-..."}
```

Agar 30 sec wait karna pade — Render free tier ka cold start hai, normal hai. Refresh karo.

### 3.6 Render URL save karo

Render URL note karo — agle step me chahiye. Example:
```
https://rupeerise-api.onrender.com
```

---

## ⚠️ Step 3 me kuch galat ho gaya?

**Build fail?**
- Logs tab kholo, error padho
- Most common: kisi env var ki value typo (extra space, missing quote)
- Fix karo → Manual Deploy → Deploy latest commit

**Service crash?**
- Logs me `P1001` ya `Can't reach database` aaye → DATABASE_URL galat hai, verify pooled URL
- `Cannot find module` → build script issue, contact me via new trial

**OTP not arriving?**
- Logs me `[DEV] OTP for x@y = 123456` dikhega — SMTP fail hone par fallback
- Gmail SMTP setup check karo

---

# STEP 4: Vercel Frontend Deploy (15 min)

### 4.1 vercel.json update karna hai

`apps/web/vercel.json` me Render URL daalna padega. **Aap yeh khud edit karenge** ya `git` se push karenge:

#### Option A: GitHub web par directly edit (easiest, no laptop needed)

1. <https://github.com/aspak85/rupeerise/blob/main/apps/web/vercel.json> kholo
2. Top right pencil icon **(✏️ Edit this file)** dabao
3. File me yeh line dhoondo:
   ```json
   "destination": "https://REPLACE_ME_API_HOST/:path*"
   ```
4. Replace karo with apna Render URL (no `https://`, no trailing slash):
   ```json
   "destination": "https://rupeerise-api.onrender.com/:path*"
   ```
5. Page neeche scroll karke commit message likho: `chore: point vercel proxy at Render`
6. **Commit changes** dabao

#### Option B: Laptop par edit + push (if comfortable)

```powershell
# apps\web\vercel.json me REPLACE_ME_API_HOST ko rupeerise-api.onrender.com se replace karo
# Phir:
cd C:\Users\Aspak Mansuri\CascadeProjects\RupeeRise
& "C:\Program Files\Git\bin\git.exe" add apps/web/vercel.json
& "C:\Program Files\Git\bin\git.exe" commit -m "chore: point vercel proxy at Render"
& "C:\Program Files\Git\bin\git.exe" push origin main
```

### 4.2 Vercel account banao

1. <https://vercel.com/signup> kholo
2. **Continue with GitHub** dabao
3. `aspak85` se authorize karo
4. Authorize all repositories OR sirf `rupeerise` repo grant karo

### 4.3 Import project

1. Dashboard me **Add New...** → **Project** dabao (ya kholo: <https://vercel.com/new>)
2. `rupeerise` repo dhoondho → **Import** dabao
3. Configure project page kholega:

   - **Project Name**: `rupeerise` (default chod do)
   - **Framework Preset**: Next.js (auto-detect)
   - **Root Directory**: ⚠️ **Change to `apps/web`** — **Edit** button dabake select karo `apps/web`
   - **Build Command**: default chod do (`next build`)
   - **Output Directory**: default

### 4.4 Environment variables add karo

Project page par **Environment Variables** section expand karo. Yeh add karo:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | `/api` |
| `NEXT_PUBLIC_SITE_URL` | `https://yourdomain.in` *(aapka actual GoDaddy domain — baad me update kar sakte ho)* |
| `NEXT_PUBLIC_BRAND_NAME` | `RupeeRise` |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | *(empty chod do)* |

> Important: `NEXT_PUBLIC_API_URL` ki value **`/api`** hi rakhni hai (sirf yeh — relative path). Render URL daalne ki zarurat nahi.

### 4.5 Deploy

1. **Deploy** button dabao (bottom me)
2. Build start hoga (~2 min)
3. "Congratulations 🎉" page dikhega
4. Preview URL: `https://rupeerise.vercel.app` (ya `https://rupeerise-aspak85.vercel.app`)

### 4.6 Test karo

1. Vercel preview URL kholo: `https://rupeerise.vercel.app`
2. Landing page dikhna chahiye
3. **Crucial test:** `https://rupeerise.vercel.app/api/health` kholo
   - Yeh same Render health JSON dikhana chahiye
   - Agar dikhe → proxy working ✓
   - Agar 404 aaye → vercel.json me typo, Step 4.1 dobara check karo

4. **Login flow test:**
   - `/login` kholo → **Sign Up** tab
   - Apna name, email (`mob308379@gmail.com`), password, phone number bharo
   - **Send Verification OTP** dabao
   - Gmail inbox check karo → 6-digit OTP aayega (spam folder bhi check karna)
   - OTP daalo → account create → `/admin` page khulega (kyunki aap admin ho)

5. Agar yeh sab kaam kar gaya → **DEPLOYED ✓** (preview URL par)

---

## ⚠️ Step 4 me issue?

**`/api/health` 404 aa raha?**
- `apps/web/vercel.json` me Render URL sahi nahi hai
- GitHub me directly file kholo aur verify karo `destination` me `rupeerise-api.onrender.com` likha hai
- Edit karke fix karo, Vercel apne aap redeploy karega

**Login page kholne par error?**
- Browser console F12 dabake check karo
- Common: `NEXT_PUBLIC_API_URL` `/api` ki jagah Render URL daal diya → fix karo Vercel env vars me, redeploy karo

**OTP email nahi aaya?**
- Render Logs tab me search karo `OTP for mob308379` → wahan dikhega 6-digit code
- Yeh emergency backup hai, but ideally Gmail me aana chahiye

---

# STEP 5: GoDaddy Domain Connect (15 min + 30 min wait)

### 5.1 Vercel me domain add karo

1. Vercel project page → **Settings** → **Domains**
2. **Add** button dabao
3. Apna domain likho (jaise `rupeerise.in`) → **Add**
4. Vercel prompt karega `www.rupeerise.in` ko bhi add karne ka → **Add** dabao
5. Vercel DNS records dikhayega jo aapko GoDaddy me daalne hain:
   - For `@` (apex): **A record** → `76.76.21.21`
   - For `www`: **CNAME** → `cname.vercel-dns.com`

### 5.2 GoDaddy me DNS records add karo

1. <https://dcc.godaddy.com/control/portfolio> kholo
2. Apna `.in` domain (`rupeerise.in`) par click karo
3. **DNS** ya **Manage DNS** option dabao
4. Existing records dikhenge. **Delete kar do** yeh:
   - Koi bhi `A @` record jo `Parked` IP par jaa raha hai
   - Koi bhi `CNAME www` jo `_domainconnect` ya similar par hai
   - **MX records aur TXT records mat chedna** (email-related hain)
5. **Add New Record** dabao do baar aur yeh fill karo:

   Pehla record:
   | Field | Value |
   |-------|-------|
   | Type | `A` |
   | Name | `@` |
   | Value | `76.76.21.21` |
   | TTL | `600 seconds` (ya `1 Hour` default) |

   Dusra record:
   | Field | Value |
   |-------|-------|
   | Type | `CNAME` |
   | Name | `www` |
   | Value | `cname.vercel-dns.com` |
   | TTL | `600 seconds` |

6. **Save** dabao dono pe
7. GoDaddy will show "DNS changes saved"

### 5.3 DNS propagation wait karo

- Average wait: **15-30 min**
- Max: 60 min (rare)
- Check tool: <https://dnschecker.org/#A/rupeerise.in> — global propagation status dikhayega

### 5.4 Vercel par SSL auto-issue hoga

1. Vercel **Settings → Domains** par wapas jao
2. Refresh karte raho → domain ke aage **green tick "Valid Configuration"** aa jayega
3. SSL certificate apne aap issue hoga (~1-2 min after DNS valid)

### 5.5 Final test

1. Browser me kholo: `https://rupeerise.in`
2. **Landing page lock icon (HTTPS) ke saath load hona chahiye** 🎉
3. `https://rupeerise.in/api/health` → `{"status":"ok"}` aana chahiye
4. `https://www.rupeerise.in` → automatic redirect to `https://rupeerise.in`

---

## ⚠️ Step 5 me issue?

**DNS green nahi ho raha (1 hour ke baad bhi)?**
- GoDaddy me records double-check karo: `A @` `76.76.21.21` aur `CNAME www` `cname.vercel-dns.com`
- TTL agar 1 hour ya zyada hai toh wait karo
- Old A/CNAME records purane parked IPs ke conflict kar rahe ho sakte hain — delete kar do

**SSL pending?**
- DNS valid hote hi Vercel apne aap karta hai
- Wait karo 5-10 min more, ya **Refresh** click karte raho

---

# STEP 6: Render WEB_ORIGIN Final Update (2 min)

Domain live hone ke baad:

1. <https://dashboard.render.com/> kholo
2. `rupeerise-api` service kholo
3. **Environment** tab kholo
4. `WEB_ORIGIN` variable edit karo
5. Value update karo:
   ```
   https://rupeerise.in,https://www.rupeerise.in
   ```
6. **Save Changes** dabao
7. Render auto-redeploy karega (~2 min)

🎉 **DEPLOY COMPLETE!**

---

# 🎯 FINAL VERIFICATION CHECKLIST

Live site par test karo: `https://rupeerise.in`

**Auth flow:**
- [ ] Landing page loads (HTTPS green lock)
- [ ] `/login` → Sign Up tab → email + password + OTP → account create
- [ ] Sign out → wapas login (email + password directly, no OTP) → works
- [ ] *Forgot password* flow: OTP receive → reset → login with new password

**User pages:**
- [ ] `/dashboard` shows balances, recent activity
- [ ] `/profile` shows account info, statement, deposits, withdrawals
- [ ] `/plans` lists investment plans
- [ ] `/wallet` shows UPI QR with admin's configured channel

**Admin pages:**
- [ ] `/admin/login` → `admin@rupeerise.local` + `shivam85A@` → land on admin dashboard
- [ ] Ya `/login` se aapke admin Gmail se login → `/admin` redirect
- [ ] `/admin/users` → users list dikhta hai
- [ ] `/admin/payment-channels` → create UPI channel → set default
- [ ] User wallet me wo UPI QR show karta hai

---

# 🔄 AGAR CASCADE CREDITS KHATAM HO JAYEIN

## Option 1: Doosre trial account me continue karo

1. Apne doosre Windsurf trial account me sign in karo
2. Same folder kholo: `C:\Users\Aspak Mansuri\CascadeProjects\RupeeRise`
3. Cascade chat me bolo: "Continue RupeeRise deployment from FINAL_ROADMAP.md, I have completed steps X, currently at Step Y"
4. Main wahin se uthake start kar dunga

## Option 2: Khud manually finish karo

Yeh roadmap **completely self-contained** hai:
- Har value copy-paste ready hai
- Har screen ka description hai
- Har possible issue ka solution hai

Step 3 → 4 → 5 → 6 karte jao. Maximum 1 hour ka kaam hai.

## Option 3: Doosre AI tool ka istemal

- ChatGPT (free): ek question puchho aur RoadMap se context paste karo
- Claude.ai (free): same approach
- GitHub Copilot Chat: same

Bas yeh batao: "Yeh hai mera roadmap [paste FINAL_ROADMAP.md], main Step X par hu, error aa raha hai Y" — wo help karega.

---

# 💾 BACKUP YOUR WORK

Sab kuch GitHub par safe hai already, but extra safety ke liye:

1. Apne `apps/api/.env` file ka backup le lo (kahin save karke rakho) — secrets isme hain
2. Saare passwords + URLs is roadmap me hain — print karke rakho ya cloud me save

GitHub repo `aspak85/rupeerise` me clone karke kahin se bhi access kar sakte ho:
```
git clone https://github.com/aspak85/rupeerise.git
```

---

# 📞 COMMON COMMANDS REFERENCE

### Git commands (laptop par)

Git path: `C:\Program Files\Git\bin\git.exe`

```powershell
# Pull latest changes
& "C:\Program Files\Git\bin\git.exe" pull

# Make a change, then commit and push
& "C:\Program Files\Git\bin\git.exe" add .
& "C:\Program Files\Git\bin\git.exe" commit -m "your message"
& "C:\Program Files\Git\bin\git.exe" push origin main
```

### Run app locally

```powershell
# API
cd C:\Users\Aspak Mansuri\CascadeProjects\RupeeRise\apps\api
npm install
npm run dev

# Web (in another terminal)
cd C:\Users\Aspak Mansuri\CascadeProjects\RupeeRise\apps\web
npm install
npm run dev
```

### Check Render API health

```
https://rupeerise-api.onrender.com/health
```

### Check Vercel proxy

```
https://rupeerise.vercel.app/api/health
```

### Check live site (after Step 5)

```
https://rupeerise.in
https://rupeerise.in/api/health
```

---

**Bhai, aap relax karo. Yeh complete roadmap hai — koi bhi step kahin bhi finish kar sakte ho. Sab kuch document hai.**

**Best of luck. Aapka app live hone wala hai. 🚀**
