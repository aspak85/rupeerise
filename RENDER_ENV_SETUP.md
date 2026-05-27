# Render Environment Setup Guide

> **Render Dashboard:** https://dashboard.render.com/

## Quick Setup Instructions

### Go to Your Render Service:
1. Dashboard → `rupeerise-api` service
2. Click **Environment** tab on the left
3. Add/Update these variables exactly:

| Key | Value | Notes |
|-----|-------|-------|
| `NODE_ENV` | `production` | Already set by render.yaml |
| `PORT` | `10000` | Already set by render.yaml |
| `DATABASE_URL` | `postgresql://neondb_owner:npg_3OwXfz1IqRuj@ep-late-math-aojzkrjq-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require` | From Neon console |
| `JWT_SECRET` | *(auto-generated, don't change)* | Keep existing value |
| `WEB_ORIGIN` | `https://rupeerise.vercel.app` | Update after custom domain |
| `ADMIN_EMAILS` | `mob308379@gmail.com` | Admin access |
| `ADMIN_PASSWORD` | `shivam85A@` | Admin password |
| `SMTP_HOST` | `smtp.gmail.com` | Gmail SMTP host |
| `SMTP_PORT` | `587` | Gmail SMTP port |
| `SMTP_USER` | `mob308379@gmail.com` | Sender email |
| `SMTP_PASS` | `zvjhgahdizjzigbn` | **[NEW PASSWORD]** |
| `MAIL_FROM` | `RupeeRise <mob308379@gmail.com>` | Mail from format |
| `UPI_ID` | `mob308379@upi` | Default UPI channel |

### After Adding Variables:

1. Click **Save Changes** button at bottom
2. Render will automatically redeploy (check Logs tab)
3. Wait for `==> Your service is live` message
4. Test: `https://rupeerise-api.onrender.com/health`

---

## ✅ Verify Setup is Working

### 1. Check API Health:
```bash
curl https://rupeerise-api.onrender.com/health
# Should return: {"status":"ok","service":"rupeerise-api","time":"..."}
```

### 2. Test OTP Endpoint:
```bash
curl -X POST https://rupeerise-api.onrender.com/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
# Should return: {"success":true,"delivered":true}
```

### 3. Check Gmail Inbox:
- Look for email with subject: `RupeeRise login code: xxxxxx`
- If not in inbox, check **Spam** folder
- If still not arriving, check Render Logs for SMTP errors

---

## 🔍 Troubleshooting

### OTP Not Arriving in Email?

**Check Render Logs:**
1. Service page → **Logs** tab
2. Search for: `[mail]` or `OTP` or `SMTP`
3. Look for messages like:
   - `[mail] creating transporter...` - Good, SMTP configured
   - `[mail] sent to=...` - Success!
   - `[mail/brevo]` or `[mail/resend]` - Using alternative provider
   - `[DEV MAIL]` - SMTP not working, showing OTP in logs

**Common Issues:**
- ❌ `SMTP_PASS` wrong → OTP printed to logs only
- ❌ `SMTP_HOST` missing → OTP printed to logs only  
- ❌ Gmail account has 2FA but no App Password → Authentication fails

**Fix:**
1. Verify `SMTP_PASS` is exactly: `zvjhgahdizjzigbn`
2. Verify Gmail has 2-Step Verification enabled
3. Verify you created an App Password (not regular password)

---

## 🚀 Production Deployment Checklist

Before going live:

- [ ] All environment variables are set in Render
- [ ] `DATABASE_URL` points to Neon pooled connection
- [ ] `SMTP_PASS` is the correct new password: `zvjhgahdizjzigbn`
- [ ] `/health` endpoint returns `{"status":"ok"}`
- [ ] Test signup → OTP arrives in email
- [ ] Test login → JWT token returned
- [ ] Test admin access with `mob308379@gmail.com`

---

## 📝 After First Deployment

Once Vercel + Render + Neon are all live:

1. Update `WEB_ORIGIN` in Render to include your custom domain
2. Test full signup flow at `https://your-domain.in`
3. Monitor Render logs for any errors
4. Set up uptime monitoring: `https://rupeerise-api.onrender.com/health`

