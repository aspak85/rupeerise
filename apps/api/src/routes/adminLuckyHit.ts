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
import { settleExpiredRounds } from '../lib/luckyHit';

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

export default router;
