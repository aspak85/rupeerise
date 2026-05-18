import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { buildReferralTree, FIRST_PLAN_BONUS_PCT, LEVEL_PCT } from '../lib/referrals';

const router = Router();

router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.sub;
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
    const tree = await buildReferralTree(userId);
    const earningsAgg = await prisma.transaction.aggregate({
      where: { userId, walletType: 'referral', direction: 'credit' },
      _sum: { amount: true },
    });
    return res.json({
      code: me?.referralCode,
      counts: tree.counts,
      tree,
      totalReferralEarnings: Number(earningsAgg._sum.amount ?? 0),
      rates: { firstPlanBonusPct: FIRST_PLAN_BONUS_PCT, levelPct: LEVEL_PCT },
    });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

router.get('/leaderboard', requireAuth, async (_req, res) => {
  try {
    // Top earners by lifetime referral credits
    const rows = await prisma.transaction.groupBy({
      by: ['userId'],
      where: { walletType: 'referral', direction: 'credit' },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 20,
    });
    const userIds = rows.map((r) => r.userId);
    const users = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, phone: true, name: true } })
      : [];
    const map = new Map(users.map((u) => [u.id, u]));
    return res.json({
      leaderboard: rows.map((r, i) => ({
        rank: i + 1,
        user: map.get(r.userId),
        amount: Number(r._sum.amount ?? 0),
      })),
    });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

export default router;
