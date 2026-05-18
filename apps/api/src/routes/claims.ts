import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { postLedger } from '../lib/wallet';
import { todayKeyIST, msUntilNextISTMidnight } from '../lib/time';

const router = Router();

async function computeDailyTotal(userId: string) {
  const active = await prisma.investment.findMany({
    where: { userId, status: 'active', remainingDays: { gt: 0 } },
    include: { Plan: true },
  });
  return active.reduce((sum, inv) => sum + inv.Plan.dailyIncome, 0);
}

/** GET /claims/status — has user claimed today? + countdown to next IST midnight */
router.get('/status', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.sub;
    const dayKey = todayKeyIST();
    const today = await prisma.dailyClaim.findUnique({
      where: { userId_dayKey: { userId, dayKey } },
    });
    const dailyTotal = await computeDailyTotal(userId);
    return res.json({
      claimedToday: !!today,
      todayAmount: today ? Number(today.amount) : 0,
      pendingAmount: today ? 0 : dailyTotal,
      dayKey,
      msUntilNext: msUntilNextISTMidnight(),
    });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

/** POST /claims — claim today's earnings (idempotent per IST day) */
router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  const dayKey = todayKeyIST();
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.dailyClaim.findUnique({ where: { userId_dayKey: { userId, dayKey } } });
      if (existing) return { alreadyClaimed: true, amount: Number(existing.amount) };

      const active = await tx.investment.findMany({
        where: { userId, status: 'active', remainingDays: { gt: 0 } },
        include: { Plan: true },
      });
      if (active.length === 0) return { alreadyClaimed: false, amount: 0, noPlans: true };
      const total = active.reduce((s, inv) => s + inv.Plan.dailyIncome, 0);
      if (total <= 0) return { alreadyClaimed: false, amount: 0 };

      // Decrement remainingDays; complete plans that hit 0
      for (const inv of active) {
        const next = inv.remainingDays - 1;
        await tx.investment.update({
          where: { id: inv.id },
          data: { remainingDays: next, status: next <= 0 ? 'completed' : 'active' },
        });
      }

      await tx.dailyClaim.create({ data: { userId, dayKey, amount: total } });
      await postLedger({
        userId,
        walletType: 'earnings',
        amount: total,
        direction: 'credit',
        reason: 'daily_claim',
        refId: dayKey,
        idempotencyKey: `claim:${userId}:${dayKey}`,
        tx,
      });
      return { alreadyClaimed: false, amount: total };
    });
    return res.json(result);
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Failed to claim' });
  }
});

export default router;
