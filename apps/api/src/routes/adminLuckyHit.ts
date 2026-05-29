import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import {
  getLuckyHitConfig,
  setLuckyHitConfig,
  DEFAULT_LUCKY_HIT_CONFIG,
  type LuckyHitConfig,
} from '../lib/appSettings';
import { settleExpiredRounds, getOrCreateCurrentRound } from '../lib/luckyHit';

const router = Router();
router.use(requireAuth, requireAdmin);

/* ─── Config ─────────────────────────────────────────────── */

/** GET /admin/lucky-hit/config — current config (with defaults if unset). */
router.get('/config', async (_req, res) => {
  res.json(await getLuckyHitConfig());
});

function clampInt(v: any, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function clampNum(v: any, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** PUT /admin/lucky-hit/config — replace the whole config. Strict validation. */
router.put('/config', async (req, res) => {
  const body = req.body ?? {};
  if (typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Body must be a config object' });
  }

  const cfg: LuckyHitConfig = {
    enabled: body.enabled !== false,
    minBet: clampInt(body.minBet, 1, 100000, DEFAULT_LUCKY_HIT_CONFIG.minBet),
    maxBet: clampInt(body.maxBet, 1, 1000000, DEFAULT_LUCKY_HIT_CONFIG.maxBet),
    // Keep round duration aligned to whole seconds and at least 60s so the
    // lock window has room to operate; cap at 30 min to prevent runaway slots.
    roundDurationSec: clampInt(body.roundDurationSec, 60, 1800, DEFAULT_LUCKY_HIT_CONFIG.roundDurationSec),
    lockSeconds: clampInt(body.lockSeconds, 5, 300, DEFAULT_LUCKY_HIT_CONFIG.lockSeconds),
    colorPayout: clampNum(body.colorPayout, 1, 100, DEFAULT_LUCKY_HIT_CONFIG.colorPayout),
    luckyHitPayout: clampNum(body.luckyHitPayout, 1, 1000, DEFAULT_LUCKY_HIT_CONFIG.luckyHitPayout),
    redWeight: clampInt(body.redWeight, 0, 1000, DEFAULT_LUCKY_HIT_CONFIG.redWeight),
    blackWeight: clampInt(body.blackWeight, 0, 1000, DEFAULT_LUCKY_HIT_CONFIG.blackWeight),
    luckyHitWeight: clampInt(body.luckyHitWeight, 0, 1000, DEFAULT_LUCKY_HIT_CONFIG.luckyHitWeight),
  };

  if (cfg.minBet > cfg.maxBet) {
    return res.status(400).json({ error: 'minBet cannot exceed maxBet' });
  }
  if (cfg.lockSeconds >= cfg.roundDurationSec) {
    return res.status(400).json({ error: 'lockSeconds must be less than roundDurationSec' });
  }
  if (cfg.redWeight + cfg.blackWeight + cfg.luckyHitWeight === 0) {
    return res.status(400).json({ error: 'At least one weight must be > 0' });
  }

  await setLuckyHitConfig(cfg);
  return res.json({ ok: true, config: cfg });
});

/** POST /admin/lucky-hit/reset — restore the built-in defaults. */
router.post('/reset', async (_req, res) => {
  await setLuckyHitConfig(DEFAULT_LUCKY_HIT_CONFIG);
  return res.json({ ok: true, config: DEFAULT_LUCKY_HIT_CONFIG });
});

/* ─── Rounds & bets ──────────────────────────────────────── */

/**
 * GET /admin/lucky-hit/rounds — most recent rounds with bet counts.
 * Settles overdue rounds first so the table is current.
 */
router.get('/rounds', async (req, res) => {
  try {
    await settleExpiredRounds();
    const take = Math.min(200, Math.max(1, Number(req.query?.take) || 50));
    const rows = await prisma.luckyHitRound.findMany({
      orderBy: { startedAt: 'desc' },
      take,
    });
    return res.json({
      rounds: rows.map((r) => ({
        id: r.id,
        period: r.period,
        startedAt: r.startedAt,
        endsAt: r.endsAt,
        status: r.status,
        result: r.result,
        redTotal: Number(r.redTotal),
        blackTotal: Number(r.blackTotal),
        luckyHitTotal: Number(r.luckyHitTotal),
        betCount: r.betCount,
      })),
    });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Failed to load rounds' });
  }
});

/**
 * GET /admin/lucky-hit/rounds/:id/bets — every bet on a single round
 * (for support / audit). Limited to 500 to keep the response bounded.
 */
router.get('/rounds/:id/bets', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id required' });
    const bets = await prisma.luckyHitBet.findMany({
      where: { roundId: id },
      orderBy: { createdAt: 'asc' },
      take: 500,
      include: {
        Round: { select: { period: true, result: true, status: true } },
      },
    });
    // Pull user emails for quick recognition without exposing internal ids.
    const userIds = Array.from(new Set(bets.map((b) => b.userId)));
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return res.json({
      bets: bets.map((b) => ({
        id: b.id,
        createdAt: b.createdAt,
        userId: b.userId,
        userEmail: byId.get(b.userId)?.email || null,
        userName: [byId.get(b.userId)?.firstName, byId.get(b.userId)?.lastName].filter(Boolean).join(' ') || null,
        side: b.side,
        amount: Number(b.amount),
        status: b.status,
        payout: Number(b.payout),
        walletSource: b.walletSource,
        period: b.Round.period,
      })),
    });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Failed to load bets' });
  }
});

/**
 * POST /admin/lucky-hit/rounds/:id/force-result
 *   body: { result: "red" | "black" | "lucky_hit" | null }
 * Sets (or clears) the admin-forced result on a round that hasn't settled
 * yet. When that round naturally ends, settlement uses this value instead
 * of the weighted RNG. The forced value is stored on the round row for
 * audit even after settlement (it's just no longer consulted).
 */
router.post('/rounds/:id/force-result', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id required' });
    const raw = req.body?.result;
    const result =
      raw === null || raw === '' || raw === undefined
        ? null
        : String(raw).trim().toLowerCase();
    if (result !== null && !['red', 'black', 'lucky_hit'].includes(result)) {
      return res.status(400).json({ error: 'result must be red, black, lucky_hit, or null' });
    }
    const round = await prisma.luckyHitRound.findUnique({ where: { id } });
    if (!round) return res.status(404).json({ error: 'Round not found' });
    if (round.status === 'settled') {
      return res.status(400).json({ error: 'Round already settled — override would be ignored' });
    }
    const updated = await prisma.luckyHitRound.update({
      where: { id },
      data: { forcedResult: result },
    });
    return res.json({
      ok: true,
      roundId: updated.id,
      period: updated.period,
      forcedResult: updated.forcedResult,
    });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Force-result failed' });
  }
});

/**
 * POST /admin/lucky-hit/rounds/:id/settle-now
 *   body: { result?: "red" | "black" | "lucky_hit" }
 * Ends a round immediately. If `result` is provided it's stored as the
 * forced result first; otherwise an existing forced result (or RNG) decides
 * the outcome. Used when the admin wants to "open the cards" right now —
 * the matching `endsAt` rewrite causes `settleExpiredRounds()` to settle
 * this round on the same request.
 */
router.post('/rounds/:id/settle-now', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id required' });
    const raw = req.body?.result;
    const result =
      raw === null || raw === '' || raw === undefined
        ? null
        : String(raw).trim().toLowerCase();
    if (result !== null && !['red', 'black', 'lucky_hit'].includes(result)) {
      return res.status(400).json({ error: 'result must be red, black, lucky_hit, or null' });
    }
    const round = await prisma.luckyHitRound.findUnique({ where: { id } });
    if (!round) return res.status(404).json({ error: 'Round not found' });
    if (round.status === 'settled') {
      return res.status(400).json({ error: 'Round already settled' });
    }
    // Force the round into the "expired" zone and (optionally) override the
    // result. The 1-second offset guarantees `endsAt < now` even on clock
    // skew between the API box and the DB.
    await prisma.luckyHitRound.update({
      where: { id },
      data: {
        endsAt: new Date(Date.now() - 1000),
        ...(result ? { forcedResult: result } : {}),
      },
    });
    await settleExpiredRounds();
    const after = await prisma.luckyHitRound.findUnique({ where: { id } });
    return res.json({
      ok: true,
      round: after && {
        id: after.id,
        period: after.period,
        status: after.status,
        result: after.result,
        forcedResult: after.forcedResult,
        settledAt: after.settledAt,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Settle-now failed' });
  }
});

/**
 * GET /admin/lucky-hit/live-activity — combined stream the admin "Live
 * Activity" panel polls every few seconds. Bundles current round + recent
 * bets + recent deposits + recent withdrawals so the UI only needs one
 * endpoint to keep the dashboard live.
 *
 * Query: ?take=N (default 30, max 100) caps every list independently.
 */
router.get('/live-activity', async (req, res) => {
  try {
    const take = Math.min(100, Math.max(5, Number(req.query?.take) || 30));
    // Always settle first so just-finished rounds appear with their results.
    await settleExpiredRounds();
    const [{ round: current }, bets, deposits, withdrawals] = await Promise.all([
      getOrCreateCurrentRound(),
      prisma.luckyHitBet.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        include: {
          Round: {
            select: { period: true, result: true, status: true, forcedResult: true },
          },
        },
      }),
      prisma.deposit.findMany({ orderBy: { createdAt: 'desc' }, take }),
      prisma.withdrawal.findMany({ orderBy: { createdAt: 'desc' }, take }),
    ]);

    // Resolve user emails for the activity rows in one shot.
    const userIds = new Set<string>();
    for (const b of bets) userIds.add(b.userId);
    for (const d of deposits) userIds.add(d.userId);
    for (const w of withdrawals) userIds.add(w.userId);
    const users = userIds.size
      ? await prisma.user.findMany({
          where: { id: { in: Array.from(userIds) } },
          select: { id: true, email: true, firstName: true, lastName: true },
        })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    const labelFor = (uid: string) => {
      const u = byId.get(uid);
      if (!u) return null;
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
      return name || u.email.split('@')[0];
    };

    return res.json({
      currentRound: current,
      bets: bets.map((b) => ({
        id: b.id,
        createdAt: b.createdAt,
        userId: b.userId,
        userLabel: labelFor(b.userId),
        userEmail: byId.get(b.userId)?.email || null,
        side: b.side,
        amount: Number(b.amount),
        status: b.status,
        payout: Number(b.payout),
        walletSource: b.walletSource,
        period: b.Round.period,
        roundStatus: b.Round.status,
        roundResult: b.Round.result,
        forcedResult: b.Round.forcedResult,
      })),
      deposits: deposits.map((d) => ({
        id: d.id,
        createdAt: d.createdAt,
        userId: d.userId,
        userLabel: labelFor(d.userId),
        amount: Number(d.amount),
        method: d.method,
        utr: d.utr,
        status: d.status,
      })),
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        createdAt: w.createdAt,
        userId: w.userId,
        userLabel: labelFor(w.userId),
        amount: Number(w.amount),
        netAmount: Number(w.netAmount),
        method: w.method,
        status: w.status,
      })),
    });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Live activity unavailable' });
  }
});

export default router;
