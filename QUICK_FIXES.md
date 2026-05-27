# RupeeRise Quick Fixes - Action Items

## 🔴 CRITICAL - Do These Now

### 1. Update Render Environment Variables ⚡

**Go to:** https://dashboard.render.com/

**Service:** rupeerise-api → **Environment** tab

**Update These Variables:**

```
SMTP_PASS = zvjhgahdizjzigbn   [CHANGED FROM: ksouvnsxqsxrmykb]
```

**Verify All These Exist:**
```
DATABASE_URL = postgresql://neondb_owner:npg_3OwXfz1IqRuj@ep-late-math-aojzkrjq-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
JWT_SECRET = [keep existing auto-generated value]
WEB_ORIGIN = https://rupeerise.vercel.app
ADMIN_EMAILS = mob308379@gmail.com
ADMIN_PASSWORD = shivam85A@
SMTP_HOST = smtp.gmail.com
SMTP_PORT = 587
SMTP_USER = mob308379@gmail.com
SMTP_PASS = zvjhgahdizjzigbn
MAIL_FROM = RupeeRise <mob308379@gmail.com>
UPI_ID = mob308379@upi
```

**After updating:** Click **Save Changes** → Render will redeploy

---

### 2. Update Vercel Cache Headers (Performance Fix)

**File:** `apps/web/vercel.json`

**Replace the entire content with:**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://rupeerise-api.onrender.com/:path*"
    }
  ],
  "headers": [
    {
      "source": "/static/:path*",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/:path*.(js|css|woff|woff2|ttf|otf|eot|svg)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/:path*",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=3600, s-maxage=3600"
        }
      ]
    }
  ]
}
```

**How to update:**
```bash
git clone https://github.com/aspak85/rupeerise.git
cd rupeerise
# Edit apps/web/vercel.json with above content
git add apps/web/vercel.json
git commit -m "perf: add cache headers to vercel.json"
git push origin main
```

**Vercel will auto-redeploy** after push

---

### 3. Test SMTP Email Delivery ✉️

**Go to:** https://rupeerise.vercel.app/login

**Step 1:** Click **Sign Up** tab

**Step 2:** Fill in:
- Name: Test User
- Email: mob308379@gmail.com (your Gmail)
- Password: TestPass@123
- Phone: 9999999999

**Step 3:** Click **Send Verification OTP**

**Step 4:** Check Gmail inbox for email with subject:
```
RupeeRise login code: 123456
```

**If NOT in inbox:**
- Check **Spam** folder
- Check **Render Logs**: https://dashboard.render.com → rupeerise-api → Logs
- Look for: `[mail] sent to=mob308379@gmail.com` (success) or `SMTP` errors

---

## 🟡 MEDIUM - Do These Next

### 4. Add Vercel Analytics (Optional)

**Install package:**
```bash
cd apps/web
npm install @vercel/analytics
```

**Update** `apps/web/src/app/layout.tsx`:

Add at top:
```typescript
import { Analytics } from '@vercel/analytics/react';
```

Add before closing `</body>` tag:
```typescript
export default function RootLayout({...}) {
  return (
    <html>
      <body>
        <ParticlesBG />
        <AuthProvider>
          {children}
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}
```

Push to Git:
```bash
git add .
git commit -m "feat: add vercel analytics"
git push origin main
```

---

### 5. Add Keep-Alive Pings to Render (Warm Up API)

**File:** Create `apps/web/src/lib/health-check.ts`

```typescript
export function startHealthCheck() {
  // Ping API every 5 minutes to keep it warm (prevent Render cold start)
  setInterval(async () => {
    try {
      await fetch('/api/health');
    } catch (e) {
      // Silent fail, just keeping connection warm
    }
  }, 5 * 60 * 1000); // 5 minutes
}
```

**Update** `apps/web/src/app/layout.tsx`:

Add import:
```typescript
import { startHealthCheck } from '@/lib/health-check';
```

Add to AuthProvider component or useEffect:
```typescript
'use client';

useEffect(() => {
  startHealthCheck();
}, []);
```

---

## 🟢 NICE TO HAVE - Admin Panel Updates

### What changes do you want?

Tell me:
1. ❓ New admin pages/sections?
2. ❓ New user management features?
3. ❓ UI redesign?
4. ❓ New reports/analytics?
5. ❓ Payment/deposit approvals faster?

Once you tell me, I'll:
- ✅ Create new admin components
- ✅ Add new pages at `/admin/*`
- ✅ Integrate with API
- ✅ Style with Tailwind

---

## ✅ Complete Testing Checklist

After doing steps 1-3 above:

**Test 1 - API Health:**
```bash
curl https://rupeerise-api.onrender.com/health
# Should return: {"status":"ok",...}
```

**Test 2 - Signup Flow:**
1. Go to https://rupeerise.vercel.app/login
2. Sign Up with test email
3. Send OTP - should arrive in 30 seconds
4. Enter OTP - should log in successfully

**Test 3 - Admin Access:**
1. Go to https://rupeerise.vercel.app/admin/login
2. Enter: mob308379@gmail.com + OTP
3. Should see admin dashboard

**Test 4 - Dashboard:**
1. Go to https://rupeerise.vercel.app/dashboard
2. Should show: Wallets, Investments, Recent Activity
3. All data should load (no 500 errors)

---

## 🚀 Production Readiness

**When everything above is done:**
- [ ] SMTP working (OTP emails arriving)
- [ ] Vercel cache headers applied (pages load fast)
- [ ] Render variables correct (including new SMTP_PASS)
- [ ] Keep-alive ping running (Render stays warm)
- [ ] Admin panel accessible
- [ ] Full signup→login flow working

**Next:** Ready for custom domain (GoDaddy DNS setup from FINAL_ROADMAP.md Step 5)

---

## 📞 If Something Breaks

**Step 1:** Check Render Logs
```
https://dashboard.render.com → rupeerise-api → Logs
```

**Step 2:** Check Vercel Logs
```
https://vercel.com/dashboard → rupeerise → Deployments → latest → Logs
```

**Step 3:** Check Browser Console (F12)
```
DevTools → Console tab → look for red errors
```

**Step 4:** Test API directly
```
https://rupeerise-api.onrender.com/health
https://rupeerise.vercel.app/api/health (via proxy)
```

