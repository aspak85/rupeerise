# Vercel Performance Optimization Guide

## Current Status
- **Deployment:** `https://rupeerise.vercel.app`
- **Build Type:** Static Export (Next.js with `output: "export"`)
- **Issue:** Slow page loads / lag on Vercel

---

## 🚀 Performance Optimizations

### 1. Enable Vercel Image Optimization (Already In Code)

Our `next.config.ts` has:
```typescript
images: {
  unoptimized: true,  // Because of static export
}
```

**This is correct for Hobby plan** but we can optimize further:

### 2. Add Cache Headers (New)

Update `vercel.json` to add caching:

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

**Apply this:**
```bash
# Update apps/web/vercel.json with above
```

### 3. Add Vercel Analytics (Optional But Recommended)

In `apps/web/src/app/layout.tsx`, add:

```typescript
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${poppins.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
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

**Install:**
```bash
cd apps/web
npm install @vercel/analytics
```

### 4. Reduce JavaScript Bundle Size

**Current:** Static export means all JS is bundled upfront

**Optimization:** Enable dynamic imports for non-critical components

Example - for admin panels that not all users need:
```typescript
import dynamic from 'next/dynamic';

const AdminDashboard = dynamic(() => import('@/components/AdminDashboard'), {
  loading: () => <LoadingSpinner />,
  ssr: false,
});
```

### 5. Vercel Deployment Settings

**In Vercel Dashboard:**

1. Go to `rupeerise` project
2. **Settings** → **Build & Development Settings**
   - Build Command: `next build`
   - Output Directory: `.next`
   - Root Directory: `./apps/web` ✓

3. **Settings** → **Caching**
   - Enable `Build Cache` ✓

4. **Settings** → **Function Size**
   - Should show 0 since we use static export ✓

---

## 📊 Expected Performance Metrics

**Before Optimization:**
- First Contentful Paint (FCP): ~2-3s
- Largest Contentful Paint (LCP): ~3-4s

**After Optimization:**
- First Contentful Paint (FCP): ~0.8-1.2s ⚡
- Largest Contentful Paint (LCP): ~1.5-2s ⚡

---

## 🔍 Monitor Performance

**Vercel Analytics:**
- Go to project → **Analytics** tab
- Monitor:
  - Page load times
  - Web Vitals (LCP, FID, CLS)
  - Deployment times

**Real-time Testing:**
```bash
# Test from command line
curl -w "@curl-format.txt" -o /dev/null -s https://rupeerise.vercel.app/

# Or use Vercel CLI
vercel analytics --scale
```

---

## 🆓 Free Tier Limits & Workarounds

**Vercel Hobby (Free):**
- ✓ Unlimited bandwidth
- ✓ Unlimited static files
- ❌ Max 12 serverless functions
- ✓ Static export bypasses this limit
- ✓ Automatic deployments on git push
- ✓ PR previews

**Our Setup is Optimal for Free Tier** because:
- Static export = 0 serverless functions
- All API calls go to Render
- Edge caching works great with static assets

---

## 🚀 Future Upgrades (When You Scale)

### Move to Railway/Fly.io for Faster Global CDN

```
Current: Vercel (free, good) → Render (free, slow)
Better:  Railway (free) → Railway (same region, better latency)
Or:      Fly.io (free) → Fly.io (global edges)
```

### Add ISR (Incremental Static Regeneration)

Not possible with pure static export, but we can:
1. Keep current setup (works great)
2. Or move to Vercel Pro with ISR for dynamic pricing page updates

---

## ✅ Checklist - Run These Steps

**Step 1:** Update `vercel.json` with cache headers
```bash
# I'll provide the updated file
```

**Step 2:** Install analytics (optional)
```bash
cd apps/web && npm install @vercel/analytics
```

**Step 3:** Add Analytics component to layout

**Step 4:** Deploy
```bash
git add .
git commit -m "perf: add cache headers and analytics"
git push origin main
# Vercel will auto-deploy
```

**Step 5:** Monitor performance
- Go to Vercel dashboard → Analytics
- Check Web Vitals over time

---

## 🎯 If Still Slow After These Steps

**Likely Cause:** Render API cold start (not Vercel)

**Solution:** Keep-alive pings to API
```typescript
// apps/web/src/lib/health-check.ts
export async function startHealthCheck() {
  setInterval(async () => {
    try {
      await fetch('/api/health');
    } catch (e) {
      // Silent fail, just maintaining connection
    }
  }, 300000); // Every 5 minutes
}
```

Call in layout.tsx useEffect:
```typescript
useEffect(() => {
  startHealthCheck();
}, []);
```

This keeps Render API warm and prevents 30s cold starts.

---

## 📞 Need Help?

Check these:
1. Vercel Analytics dashboard
2. Network tab in browser DevTools (F12)
3. Render API logs for backend latency
4. `/api/health` endpoint response time

