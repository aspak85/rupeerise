import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { postLedger } from '../lib/wallet';
import { todayKeyIST, msUntilNextISTMidnight } from '../lib/time';
import { getRewardConfig } from '../lib/appSettings';

const router = Router();

/**
 * Spin & scratch prize tables are admin-configurable via /admin/rewards/config.
 * The values returned by `getRewardConfig()` are cached in-process for ~30s and
 * invalidated when the admin saves new config.
 */

async function pickSpinPrize() {
  const cfg = await getRewardConfig();
  const prizes = cfg.spin.prizes;
  const weights = cfg.spin.weights && cfg.spin.weights.length === prizes.length
    ? cfg.spin.weights
    : null;
  if (!weights) {
    const idx = Math.floor(Math.random() * prizes.length);
    return { index: idx, amount: prizes[idx], totalSegments: prizes.length };
  }
  const total = weights.reduce((s, w) => s + w, 0);
  let n = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    if ((n -= weights[i]) <= 0) return { index: i, amount: prizes[i], totalSegments: prizes.length };
  }
  return { index: 0, amount: prizes[0], totalSegments: prizes.length };
}

async function pickScratchPrize() {
  const cfg = await getRewardConfig();
  const table = cfg.scratch.table;
  const total = table.reduce((s, r) => s + r.weight, 0);
  let n = Math.random() * total;
  for (const r of table) {
    if ((n -= r.weight) <= 0) return r.amount;
  }
  return table[0].amount;
}

/** GET /rewards/status — what's available today (also exposes the live prize table for the UI wheel) */
router.get('/status', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.sub;
    const dayKey = todayKeyIST();
    const [spin, scratch, cfg] = await Promise.all([
      prisma.dailyReward.findUnique({ where: { userId_type_dayKey: { userId, type: 'spin', dayKey } } }),
      prisma.dailyReward.findUnique({ where: { userId_type_dayKey: { userId, type: 'scratch', dayKey } } }),
      getRewardConfig(),
    ]);
    return res.json({
      dayKey,
      msUntilNext: msUntilNextISTMidnight(),
      spin: {
        enabled: cfg.spin.enabled,
        available: cfg.spin.enabled && !spin,
        claimedAmount: spin ? Number(spin.amount) : 0,
        prizes: cfg.spin.prizes,
      },
      scratch: {
        enabled: cfg.scratch.enabled,
        available: cfg.scratch.enabled && !scratch,
        claimedAmount: scratch ? Number(scratch.amount) : 0,
        maxPrize: Math.max(...cfg.scratch.table.map((r) => r.amount)),
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

/** POST /rewards/spin — once per IST day; credits bonus wallet */
router.post('/spin', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  const dayKey = todayKeyIST();
  try {
    const cfg = await getRewardConfig();
    if (!cfg.spin.enabled) return res.status(403).json({ error: 'Spin wheel is currently disabled' });
    const prize = await pickSpinPrize();
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.dailyReward.findUnique({
        where: { userId_type_dayKey: { userId, type: 'spin', dayKey } },
      });
      if (existing) {
        return { alreadyClaimed: true, amount: Number(existing.amount), index: Number(JSON.parse(existing.meta || '{"index":0}').index), totalSegments: prize.totalSegments };
      }
      await tx.dailyReward.create({
        data: {
          userId,
          type: 'spin',
          dayKey,
          amount: prize.amount,
          meta: JSON.stringify({ index: prize.index }),
        },
      });
      await postLedger({
        userId,
        walletType: 'bonus',
        amount: prize.amount,
        direction: 'credit',
        reason: 'spin_wheel',
        refId: dayKey,
        idempotencyKey: `spin:${userId}:${dayKey}`,
        tx,
      });
      return { alreadyClaimed: false, amount: prize.amount, index: prize.index, totalSegments: prize.totalSegments };
    });
    return res.json(result);
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Spin failed' });
  }
});

/** POST /rewards/scratch — once per IST day; credits bonus wallet */
router.post('/scratch', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  const dayKey = todayKeyIST();
  try {
    const cfg = await getRewardConfig();
    if (!cfg.scratch.enabled) return res.status(403).json({ error: 'Scratch card is currently disabled' });
    const amount = await pickScratchPrize();
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.dailyReward.findUnique({
        where: { userId_type_dayKey: { userId, type: 'scratch', dayKey } },
      });
      if (existing) {
        return { alreadyClaimed: true, amount: Number(existing.amount) };
      }
      await tx.dailyReward.create({
        data: { userId, type: 'scratch', dayKey, amount },
      });
      await postLedger({
        userId,
        walletType: 'bonus',
        amount,
        direction: 'credit',
        reason: 'scratch_card',
        refId: dayKey,
        idempotencyKey: `scratch:${userId}:${dayKey}`,
        tx,
      });
      return { alreadyClaimed: false, amount };
    });
    return res.json(result);
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Scratch failed' });
  }
});

export default router;
