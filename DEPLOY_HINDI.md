# RupeeRise — Easy Hindi Deploy Guide

Bhai, ghabrana mat. Total **6 steps**, har step mein 5–10 minute. Tu paste karke chal, kuch bhi samajh nahi aaye toh mujhe message kar.

---

## Step 1 — Git install kar (5 min, ek baar ka kaam)

Git nahi hai aapke laptop par. Bina Git ke kuch nahi push hoga.

1. Yeh link kholo: <https://git-scm.com/download/win>
2. **64-bit Git for Windows Setup** download hoga apne aap.
3. Download hone ke baad file pe **double-click** → "Yes" → bas saare options **default** rakho aur **Next → Next → Install** dabate jao.
4. Install hone ke baad **PowerShell band karo aur dobara kholo** (warna `git` command nahi milegi).
5. Verify: PowerShell mein `git --version` likho. Agar version dikhe (jaise `git version 2.45.0`) — Git ready hai.

> **Stuck?** Mujhe bolo, screenshot bhejo — main bata dunga next click kya hai.

---

## Step 2 — GitHub account + repo (5 min)

GitHub free hai. Yahi pe aapka code rahega.

1. <https://github.com/signup> → email/password se sign up karo (use kar sakte ho aapka Gmail).
2. Login ke baad <https://github.com/new> kholo.
3. Form bharo:
   - **Repository name**: `rupeerise`
   - **Private** select karo (taaki sirf aap dekh sako)
   - **Add README/.gitignore** mat tick karo (hum already prepared hain)
4. **Create repository** dabao.
5. GitHub aapko ek page dikhayega "Quick setup". Bas yahi page khula rakho — mujhe bata dena, main aapke laptop par push command run kar dunga.

---

## Step 3 — Mujhe bolo "GitHub repo bana liya" — main aage karta hu

Jab aap Step 1 + 2 complete kar lo, mujhe bas itna message karo:

> "GitHub repo ready, URL hai `https://github.com/MERA_USERNAME/rupeerise`"

Phir main yeh saare commands aapke laptop par chala dunga:

- `git init`
- `git add .`
- `git commit -m "RupeeRise initial commit"`
- `git remote add origin https://github.com/...`
- `git push -u origin main`

Aapko kuch type nahi karna — bas GitHub se ek-baar **Personal Access Token** generate karna padega (password ki jagah). Main exact steps bata dunga jab time aaye.

---

## Step 4 — Neon Postgres database (5 min)

1. <https://console.neon.tech/signup> kholo → **Continue with GitHub** dabao (jo abhi banaya account, wahi).
2. Project banao:
   - Name: `rupeerise`
   - Region: **AWS Mumbai** (sabse fast for India). Agar Mumbai option na ho toh **Singapore** chuno.
   - **Create Project** dabao.
3. Left sidebar mein **Connection Details** dabao.
4. Dropdown se **Pooled connection** select karo (default mein hota hai).
5. Connection string copy karo — kuch aisa dikhega:
   ```
   postgresql://username:password@ep-xyz-123-pooler.ap-south-1.aws.neon.tech/neondb?sslmode=require
   ```
6. **Yeh string mujhe bhej do** (copy-paste kar do chat mein) — main aapke laptop par database setup kar dunga (`prepare:prod` + `migrate dev`).

> Worried about sharing the string? Neon DB password hai, public domain pe nahi hai — but baad mein aap regenerate kar sakte ho Neon dashboard se. Aapki marzi.

---

## Step 5 — Render API (10 min)

1. <https://dashboard.render.com/> kholo → **GitHub se sign in** karo.
2. **Authorize Render** click karo (read access dega aapke repo ka).
3. Top right **New +** → **Blueprint** dabao.
4. **Connect a repository** → `rupeerise` choose karo.
5. Render apne aap `apps/api/render.yaml` detect karega → **Apply**.
6. Service banne ke baad → **Environment** tab kholo.
7. Yeh values bharo (main har ek bata raha hu):

| Key | Kya daalna hai |
|-----|---------------|
| `DATABASE_URL` | Step 4 ka Neon URL paste karo |
| `WEB_ORIGIN` | `https://yourdomain.in,https://www.yourdomain.in` (aapka actual domain) — abhi ke liye `https://rupeerise.vercel.app` bhi add kar do |
| `ADMIN_EMAILS` | Aapka Gmail address (jise admin banana hai) |
| `ADMIN_PASSWORD` | Strong password (min 8 chars) — yaad rakho |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Aapka Gmail (e.g. `mob308379@gmail.com`) |
| `SMTP_PASS` | 16-char Google App Password (next section dekho) |
| `MAIL_FROM` | `RupeeRise <aapkagmail@gmail.com>` |
| `UPI_ID` | Aapka UPI ID (optional, baad mein admin se bhi set kar sakte ho) |

8. **Save Changes** dabao → Render apne aap rebuild karega (~3 min wait).
9. Service ka URL copy karo (kuch aisa: `https://rupeerise-api.onrender.com`).
10. Test: `https://rupeerise-api.onrender.com/health` browser mein kholo. `{"status":"ok"}` dikhna chahiye.

### Gmail App Password kaise banao (5 min)

1. <https://myaccount.google.com/security> kholo
2. **2-Step Verification** ON karo (agar nahi hai)
3. <https://myaccount.google.com/apppasswords> kholo
4. App ka naam likho `RupeeRise` → **Create**
5. 16-character password milega (jaise `abcd efgh ijkl mnop`)
6. **Spaces hata ke** copy karo: `abcdefghijklmnop`
7. Yeh `SMTP_PASS` mein paste karo Render mein

---

## Step 6 — Vercel website (10 min)

1. **Mujhe bolo Render URL kya hai** (jaise `https://rupeerise-api.onrender.com`)
2. Main `apps/web/vercel.json` mein woh URL daal dunga aur GitHub pe push kar dunga.
3. Phir <https://vercel.com/signup> → GitHub se sign up
4. <https://vercel.com/new> → `rupeerise` repo import
5. **Root Directory** = `apps/web` (Edit dabao, change karo)
6. **Environment Variables** add karo:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | `/api` (sirf yeh — relative path) |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Render mein `RAZORPAY_KEY_ID` jo daala wahi (ya khali chod do) |
| `NEXT_PUBLIC_SITE_URL` | `https://yourdomain.in` |
| `NEXT_PUBLIC_BRAND_NAME` | `RupeeRise` |

7. **Deploy** dabao → wait ~2 min
8. Vercel ek URL dega (jaise `https://rupeerise.vercel.app`) — kholo
9. Test: `https://rupeerise.vercel.app/api/health` → `{"status":"ok"}` aana chahiye

---

## Step 7 — GoDaddy domain connect (10 min + 30 min wait)

Aapka `.in` GoDaddy domain Vercel se connect karenge.

1. **Vercel mein**:
   - Project → **Settings** → **Domains** → **Add**
   - Aapka domain likho (jaise `rupeerise.in`) → Add
   - `www.rupeerise.in` add karne ko bole toh wo bhi add karo

2. **GoDaddy mein**:
   - <https://dcc.godaddy.com/control/portfolio> → aapka domain click karo
   - **DNS** → **Manage DNS**
   - Purane "Parked" wale A records DELETE kar do
   - **Add New Record** dabake yeh do records add karo:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `76.76.21.21` | 600 |
| CNAME | `www` | `cname.vercel-dns.com` | 600 |

3. **Save** dabao → 30 min wait karo (DNS propagate hone mein time lagta hai)
4. Vercel mein domain ke aage **green tick** aa jayega → SSL automatic ho jayega
5. `https://rupeerise.in` kholo → **YOUR APP IS LIVE!** 🎉

---

## Final step — Render mein WEB_ORIGIN update

Live hone ke baad:

1. Render → service → **Environment**
2. `WEB_ORIGIN` ko update karo: `https://rupeerise.in,https://www.rupeerise.in`
3. Save → Render redeploy

Done! Ab live hai poora app.

---

## 🆘 Help chahiye?

Kahin bhi atak jao, **mujhe screenshot bhejo + ye batao "Step X par hu, ye dikha"**. Main exact next click bata dunga.

**Kya nahi kar sakta main aapke liye:**
- Aapke email/password se accounts banana (bas yeh part aapko khud karna hoga)
- Aapke GoDaddy account mein log in karna
- Gmail App Password generate karna

**Kya kar sakta hu main:**
- Aapke laptop par sare git/npm/build commands chalana
- Code mein koi bhi change/fix karna
- Deploy mein error aaye toh debug karna
- Hindi/English mein step samjhana

Ek-ek karke chalte hain. **Step 1 + 2 complete karo aur mujhe bata do** — phir aage badhenge.
