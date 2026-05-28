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

    // Get all referred user IDs across all levels
    const allReferredIds = [
      ...tree.level1.map((u: any) => u.id),
      ...tree.level2.map((u: any) => u.id),
      ...tree.level3.map((u: any) => u.id),
    ];

    // Fetch latest active investment for each referred user
    const investments = allReferredIds.length > 0 ? await prisma.investment.findMany({
      where: { userId: { in: allReferredIds }, status: 'active' },
      include: { Plan: { select: { name: true, price: true, dailyIncome: true } } },
      orderBy: { startedAt: 'desc' },
    }) : [];

    // Group by userId - take the latest active plan
    const planByUser: Record<string, { planName: string; price: number; dailyIncome: number }> = {};
    for (const inv of investments) {
      if (!planByUser[inv.userId]) {
        planByUser[inv.userId] = {
          planName: inv.Plan.name,
          price: inv.Plan.price,
          dailyIncome: inv.Plan.dailyIncome,
        };
      }
    }

    // Attach plan info to each member
    const enrichMember = (m: any) => ({ ...m, activePlan: planByUser[m.id] || null });

    return res.json({
      code: me?.referralCode,
      counts: tree.counts,
      tree: {
        level1: tree.level1.map(enrichMember),
        level2: tree.level2.map(enrichMember),
        level3: tree.level3.map(enrichMember),
      },
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
