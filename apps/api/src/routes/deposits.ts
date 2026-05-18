import { Router } from 'express';
import crypto from 'crypto';
import { env } from '../lib/env';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { postLedger } from '../lib/wallet';
import { listActiveChannels, getDefaultChannel } from '../lib/paymentChannels';

// Razorpay is loaded lazily via createRequire to stay compatible with our ESM build.
import { createRequire } from 'module';
const localRequire = createRequire(import.meta.url);
let Razorpay: any;
try { Razorpay = localRequire('razorpay'); } catch { Razorpay = null; }

const router = Router();

const isRazorpayLive = () => Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && Razorpay);

/** GET /deposits/config — what payment options are visible on the wallet page. */
router.get('/config', requireAuth, async (_req, res) => {
  let channels: Array<{ id: string; kind: string; label: string; value: string; payeeName: string; note: string | null; isDefault: boolean }> = [];
  let defaultChannel: typeof channels[number] | null = null;
  try {
    const rows = await listActiveChannels();
    channels = rows.map((c) => ({
      id: c.id, kind: c.kind, label: c.label, value: c.value, payeeName: c.payeeName, note: c.note, isDefault: c.isDefault,
    }));
    const def = await getDefaultChannel();
    defaultChannel = def ? { id: def.id, kind: def.kind, label: def.label, value: def.value, payeeName: def.payeeName, note: def.note, isDefault: def.isDefault } : null;
  } catch {
    /* fall through to defaults */
  }

  // If DB has nothing yet, fall back to env.UPI_ID so the wallet page still works.
  if (!defaultChannel) {
    defaultChannel = {
      id: 'env-default', kind: 'upi', label: 'Primary UPI',
      value: env.UPI_ID, payeeName: 'RupeeRise', note: null, isDefault: true,
    };
    channels = [defaultChannel];
  }

  return res.json({
    razorpay: {
      enabled: isRazorpayLive(),
      keyId: isRazorpayLive() ? env.RAZORPAY_KEY_ID : null,
    },
    // Legacy: keep upiId for any consumers that haven't migrated yet.
    upiId: defaultChannel.value,
    defaultChannel,
    channels,
    minDeposit: 100,
  });
});

/** Razorpay order creation (gateway path). Stubs when keys missing. */
router.post('/razorpay/order', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  const amount = Math.floor(Number(req.body?.amount ?? 0));
  if (!Number.isFinite(amount) || amount < 100) return res.status(400).json({ error: 'Minimum deposit is INR 100' });

  if (!isRazorpayLive()) {
    return res.status(503).json({
      stub: true,
      error: 'Razorpay not configured on the server. Use UPI/UTR for now, or set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the API .env to enable card/UPI checkout.',
    });
  }

  try {
    const client = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
    const order = await client.orders.create({
      amount: amount * 100,
      currency: 'INR',
      receipt: `rr_dep_${Date.now()}`,
      notes: { userId },
    });

    // Pre-create a pending Deposit row tied to the order so verify can find it idempotently.
    const dep = await prisma.deposit.create({
      data: {
        userId,
        amount,
        method: 'razorpay',
        gatewayRef: order.id,
        status: 'pending',
        note: 'Razorpay order created',
      },
    });

    return res.json({ keyId: env.RAZORPAY_KEY_ID, order, depositId: dep.id });
  } catch (e: any) {
    console.error(e);
    return res.status(502).json({ error: 'Failed to create Razorpay order' });
  }
});

/**
 * POST /deposits/razorpay/verify
 * Verify Razorpay payment signature and auto-credit the deposit wallet.
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
router.post('/razorpay/verify', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body ?? {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment fields' });
  }
  if (!env.RAZORPAY_KEY_SECRET) {
    return res.status(503).json({ error: 'Razorpay not configured on server' });
  }

  // Verify HMAC signature: hmac_sha256(secret, order_id + '|' + payment_id)
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expected !== razorpay_signature) {
    return res.status(401).json({ error: 'Signature mismatch — payment cannot be verified' });
  }

  try {
    // Find the pending deposit tied to this order
    const dep = await prisma.deposit.findFirst({
      where: { userId, gatewayRef: razorpay_order_id, method: 'razorpay' },
    });
    if (!dep) return res.status(404).json({ error: 'Deposit record not found' });
    if (dep.status === 'approved') {
      return res.json({ ok: true, replayed: true, deposit: dep });
    }

    // Credit deposit wallet atomically and mark deposit approved.
    await prisma.$transaction(async (tx) => {
      await postLedger({
        userId,
        walletType: 'deposit',
        amount: Number(dep.amount),
        direction: 'credit',
        reason: 'deposit:razorpay',
        refId: dep.id,
        idempotencyKey: `dep:${dep.id}`,
        tx,
      });
      await tx.deposit.update({
        where: { id: dep.id },
        data: {
          status: 'approved',
          utr: razorpay_payment_id,
          reviewedAt: new Date(),
          reviewedBy: 'razorpay_auto',
          note: 'Auto-approved by Razorpay signature verification',
        },
      });
    });

    const fresh = await prisma.deposit.findUnique({ where: { id: dep.id } });
    return res.json({ ok: true, deposit: fresh });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to verify payment' });
  }
});

/** POST /deposits — submit a manual deposit (UPI/UTR) request for admin approval */
router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  const amount = Math.floor(Number(req.body?.amount ?? 0));
  const method = String(req.body?.method || 'manual_utr');
  const utr = req.body?.utr ? String(req.body.utr).slice(0, 64) : undefined;
  const note = req.body?.note ? String(req.body.note).slice(0, 240) : undefined;

  if (!Number.isFinite(amount) || amount < 100) return res.status(400).json({ error: 'Minimum deposit is ₹100' });
  if (!['manual_utr', 'upi', 'razorpay'].includes(method)) return res.status(400).json({ error: 'Invalid method' });

  try {
    const dep = await prisma.deposit.create({
      data: { userId, amount, method, utr, note, status: 'pending' },
    });
    return res.json({ ok: true, deposit: dep });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Failed to submit deposit' });
  }
});

/** GET /deposits — current user's deposits */
router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.sub;
    const rows = await prisma.deposit.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
    return res.json({ deposits: rows });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

export default router;
