import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import {
  getOrCreateCurrentRound,
  recentSettledRounds,
  settleExpiredRounds,
  debitBetAcrossWallets,
} from '../lib/luckyHit';

const router = Router();

const SIDES = new Set(['red', 'black', 'lucky_hit']);

/**
 * GET /lucky-hit/state — single roundtrip the UI calls every ~1s while the
 * round is open. Returns:
 *   • current round + countdown
 *   • last 30 settled results (red/black/lucky_hit dots)
 *   • the public game config (min/max bet, payouts, enable flag)
 *
 * Settles any expired rounds first so the history reflects reality even on
 * sites with very low traffic where settlement could otherwise lag forever.
 */
router.get('/state', requireAuth, async (_req: AuthedRequest, res) => {
  try {
    await settleExpiredRounds();
    const { round, cfg } = await getOrCreateCurrentRound();
    const history = await recentSettledRounds(30);
    return res.json({
      enabled: cfg.enabled,
      round,
      history,
      config: {
        minBet: cfg.minBet,
        maxBet: cfg.maxBet,
        colorPayout: cfg.colorPayout,
        luckyHitPayout: cfg.luckyHitPayout,
        roundDurationSec: cfg.roundDurationSec,
        lockSeconds: cfg.lockSeconds,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Lucky Hit unavailable' });
  }
});

/**
 * POST /lucky-hit/bet — place a bet on the current open round.
 *   body: { side: "red"|"black"|"lucky_hit", amount: number }
 *
 * Validates → settles backlog → re-reads the round inside a Prisma tx →
 * debits deposit-then-bonus → inserts the bet row → bumps the live totals.
 * Everything is one $transaction so a user can never lose money without
 * having a bet recorded (or vice-versa).
 */
router.post('/bet', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  const side = String(req.body?.side || '').trim().toLowerCase();
  const amountRaw = Number(req.body?.amount);
  const amount = Number.isFinite(amountRaw) ? Math.floor(amountRaw) : NaN;

  if (!SIDES.has(side)) return res.status(400).json({ error: 'Invalid side' });
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive integer' });
  }

  try {
    // Settle anything overdue before we read the current round, so the round
    // we bet on is genuinely live.
    await settleExpiredRounds();
    const { round, cfg } = await getOrCreateCurrentRound();

    if (!cfg.enabled) return res.status(403).json({ error: 'Lucky Hit is currently disabled' });
    if (amount < cfg.minBet) {
      return res.status(400).json({ error: `Minimum bet is ₹${cfg.minBet}` });
    }
    if (amount > cfg.maxBet) {
      return res.status(400).json({ error: `Maximum bet is ₹${cfg.maxBet}` });
    }
    if (round.status !== 'open') {
      return res.status(400).json({ error: 'Betting is closed for this round' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Re-read round inside the tx to defeat the open→locked race window.
      const fresh = await tx.luckyHitRound.findUnique({ where: { id: round.id } });
      if (!fresh || fresh.status !== 'open') {
        throw new Error('Round closed');
      }

      // Allocate the bet id up front so debit idempotency keys are stable.
      const bet = await tx.luckyHitBet.create({
        data: {
          userId,
          roundId: fresh.id,
          side,
          amount,
          walletSource: 'deposit', // updated below after we know what was debited
          status: 'pending',
        },
      });

      const source = await debitBetAcrossWallets(tx, userId, amount, fresh.period, bet.id);

      // Bump the live totals + counter on the round so the score panel updates.
      const totalField =
        side === 'red' ? 'redTotal' : side === 'black' ? 'blackTotal' : 'luckyHitTotal';
      const updated = await tx.luckyHitRound.update({
        where: { id: fresh.id },
        data: {
          [totalField]: { increment: amount },
          betCount: { increment: 1 },
        } as any,
      });

      const finalBet = await tx.luckyHitBet.update({
        where: { id: bet.id },
        data: { walletSource: source },
      });

      return { bet: finalBet, round: updated };
    });

    return res.json({
      ok: true,
      bet: {
        id: result.bet.id,
        side: result.bet.side,
        amount: Number(result.bet.amount),
        status: result.bet.status,
        walletSource: result.bet.walletSource,
        createdAt: result.bet.createdAt,
      },
      round: {
        id: result.round.id,
        period: result.round.period,
        redTotal: Number(result.round.redTotal),
        blackTotal: Number(result.round.blackTotal),
        luckyHitTotal: Number(result.round.luckyHitTotal),
        betCount: result.round.betCount,
      },
    });
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.includes('Insufficient')) {
      return res.status(400).json({ error: 'Wallet balance too low for this bet' });
    }
    if (msg === 'Round closed') {
      return res.status(400).json({ error: 'Betting is closed for this round' });
    }
    console.error(e);
    return res.status(503).json({ error: 'Bet failed' });
  }
});

/**
 * GET /lucky-hit/my-bets — current user's bet history (newest first).
 * Used by the "My Lucky Hit Record" panel on the user page.
 */
router.get('/my-bets', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.sub;
    const take = Math.min(100, Math.max(1, Number(req.query?.take) || 30));
    // Settle first so a freshly-resolved bet appears with its real status.
    await settleExpiredRounds();
    const rows = await prisma.luckyHitBet.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
      include: { Round: { select: { period: true, result: true, status: true } } },
    });
    return res.json({
      bets: rows.map((b) => ({
        id: b.id,
        createdAt: b.createdAt,
        side: b.side,
        amount: Number(b.amount),
        status: b.status,
        payout: Number(b.payout),
        walletSource: b.walletSource,
        period: b.Round.period,
        roundResult: b.Round.result,
        roundStatus: b.Round.status,
      })),
    });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Failed to load bets' });
  }
});

export default router;
