import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import plansRouter from './routes/plans.js';
import authRouter from './routes/auth.js';
import walletsRouter from './routes/wallets.js';
import depositsRouter from './routes/deposits.js';
import meRouter from './routes/me.js';
import investmentsRouter from './routes/investments.js';
import claimsRouter from './routes/claims.js';
import referralsRouter from './routes/referrals.js';
import withdrawalsRouter from './routes/withdrawals.js';
import rewardsRouter from './routes/rewards.js';
import adminRouter from './routes/admin.js';
import adminChannelsRouter from './routes/adminPaymentChannels.js';
import statementRouter from './routes/statement.js';
import exportsRouter from './routes/exports.js';
import giftCodesRouter from './routes/giftCodes.js';
import supportRouter from './routes/support.js';
import adminGiftCodesRouter from './routes/adminGiftCodes.js';
import adminRewardsRouter from './routes/adminRewards.js';
import adminSupportRouter from './routes/adminSupport.js';
import postersRouter, { adminPostersRouter } from './routes/posters.js';
import feedRouter, { adminFeedRouter } from './routes/feed.js';
import adminSettingsRouter from './routes/adminSettings.js';
import notificationsRouter from './routes/notifications.js';
import luckyHitRouter from './routes/luckyHit.js';
import adminLuckyHitRouter from './routes/adminLuckyHit.js';
import { ensurePlansSeeded } from './lib/plans.js';
import { ensureChannelsSeeded } from './lib/paymentChannels.js';
import { ensureAdminBootstrap } from './lib/adminBootstrap.js';

const app = express();
app.use(helmet());

// CORS — comma-separated whitelist via WEB_ORIGIN env var.
// In production set WEB_ORIGIN to e.g. "https://yourdomain.com,https://www.yourdomain.com"
// In development this defaults to localhost:3000 (and any localhost port).
const allowedOrigins = (process.env.WEB_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // server-to-server / curl
      if (allowedOrigins.includes(origin)) return cb(null, true);
      // In dev, allow any localhost/127.0.0.1 origin (covers Next dev server,
      // browser-preview proxies on 127.0.0.1:<random-port>, LAN testing, etc.)
      if (
        process.env.NODE_ENV !== 'production' &&
        /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(origin)
      ) {
        return cb(null, true);
      }
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
// Increase JSON body limit to 10MB to support base64 poster images
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'rupeerise-api', time: new Date().toISOString() });
});

// Public
app.use('/plans', plansRouter);
app.use('/auth', authRouter);

// Authed user — register more specific /me/* routes BEFORE /me itself.
app.use('/me/statement', statementRouter);
app.use('/me', meRouter);
app.use('/wallets', walletsRouter);
app.use('/deposits', depositsRouter);
app.use('/investments', investmentsRouter);
app.use('/claims', claimsRouter);
app.use('/referrals', referralsRouter);
app.use('/withdrawals', withdrawalsRouter);
app.use('/rewards', rewardsRouter);
app.use('/redeem', giftCodesRouter); // POST /redeem and GET /redeem/history
app.use('/support', supportRouter);  // GET /support/config
app.use('/posters', postersRouter);  // GET /posters (public)
app.use('/feed', feedRouter);        // GET /feed/live (public)
app.use('/notifications', notificationsRouter);
app.use('/lucky-hit', luckyHitRouter);

// Public settings (read-only, specific keys only)
app.get('/settings/:key', async (req: any, res: any) => {
  const ALLOWED_PUBLIC_KEYS = ['deposit_config'];
  const key = String(req.params?.key || '').trim();
  if (!ALLOWED_PUBLIC_KEYS.includes(key)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { prisma } = await import('./lib/prisma.js');
    const row = await prisma.appSetting.findUnique({ where: { key } });
    if (!row) return res.json({ key, value: null });
    let value: any = row.value;
    try { value = JSON.parse(row.value); } catch {}
    return res.json({ key, value });
  } catch { return res.json({ key, value: null }); }
});

// Admin only
app.use('/admin/payment-channels', adminChannelsRouter);
app.use('/admin/gift-codes', adminGiftCodesRouter);
app.use('/admin/rewards', adminRewardsRouter);
app.use('/admin/support', adminSupportRouter);
app.use('/admin/posters', adminPostersRouter);
app.use('/admin/feed', adminFeedRouter);
app.use('/admin/settings', adminSettingsRouter);
app.use('/admin/lucky-hit', adminLuckyHitRouter);
app.use('/admin/exports', exportsRouter);
app.use('/admin', adminRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.path });
});

// PORT resolution is defensive: Render sometimes passes the var with surrounding
// whitespace or as an empty string when the dashboard env tab is misconfigured.
// We never want app.listen() to receive NaN — that crashes the whole process.
const rawPort = (process.env.PORT ?? '').trim();
const parsedPort = rawPort.length ? Number(rawPort) : NaN;
const port =
  Number.isFinite(parsedPort) && parsedPort > 0 && parsedPort < 65536
    ? parsedPort
    : 10000;
console.log(`[boot] PORT env='${rawPort}' parsed=${parsedPort} using=${port}`);
app.listen(port, async () => {
  console.log(`API listening on http://localhost:${port}`);
  // Auto-seed defaults on boot (idempotent). Failures are non-fatal so the
  // API stays up even if the DB is briefly unreachable.
  try {
    await ensurePlansSeeded();
    await ensureChannelsSeeded();
    await ensureAdminBootstrap();
    // Force Lucky Hit config to 15s rounds on every boot. Any stale 180s/30s
    // saved value from earlier deploys is overwritten. Admin edits persist
    // until next redeploy (intentional — operator wants 15s hard-coded).
    const { setLuckyHitConfig, DEFAULT_LUCKY_HIT_CONFIG } = await import('./lib/appSettings.js');
    await setLuckyHitConfig(DEFAULT_LUCKY_HIT_CONFIG);
    console.log('[boot] seeded plans + channels + admin + lucky-hit 20s config');
  } catch (e) {
    console.warn('[boot] seed skipped:', (e as Error).message);
  }
});
