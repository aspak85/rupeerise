import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { postLedger } from '../lib/wallet';
import { distributePlanCommissions } from '../lib/referrals';

const router = Router();

/** GET /investments — list current user's investments */
router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.sub;
    const rows = await prisma.investment.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      include: { Plan: true },
    });
    return res.json({
      investments: rows.map((i) => ({
        id: i.id,
        planId: i.planId,
        planName: i.Plan.name,
        price: i.Plan.price,
        dailyIncome: i.Plan.dailyIncome,
        durationDays: i.Plan.durationDays,
        startedAt: i.startedAt,
        endsAt: i.endsAt,
        remainingDays: i.remainingDays,
        status: i.status,
      })),
    });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

/** POST /investments — buy a plan using funds from deposit wallet */
router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  const planId = String(req.body?.planId || '').trim();
  if (!planId) return res.status(400).json({ error: 'planId required' });

  try {
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.active) return res.status(404).json({ error: 'Plan not found' });

    const result = await prisma.$transaction(async (tx) => {
      // Debit deposit wallet (postLedger validates balance)
      await postLedger({
        userId,
        walletType: 'deposit',
        amount: plan.price,
        direction: 'debit',
        reason: `plan:purchase:${plan.id}`,
        idempotencyKey: `purchase:${userId}:${plan.id}:${Date.now()}`,
        tx,
      });

      const startedAt = new Date();
      const endsAt = new Date(startedAt.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

      const previousCount = await tx.investment.count({ where: { userId } });
      const isFirstPlan = previousCount === 0;

      const investment = await tx.investment.create({
        data: {
          userId,
          planId: plan.id,
          startedAt,
          endsAt,
          remainingDays: plan.durationDays,
          status: 'active',
        },
      });

      const distribution = await distributePlanCommissions({
        buyerId: userId,
        amount: plan.price,
        investmentId: investment.id,
        isFirstPlan,
        tx,
      });

      return { investment, distribution, isFirstPlan };
    });

    // Send notification to referrer if this user was referred and earned commissions
    try {
      const buyer = await prisma.user.findUnique({
        where: { id: userId },
        select: { referredById: true, firstName: true, name: true, email: true },
      });
      if (buyer?.referredById && result.distribution.distributed.length > 0) {
        const earned = result.distribution.distributed
          .filter((d: any) => d.userId === buyer.referredById)
          .reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
        if (earned > 0) {
          const buyerName = buyer.firstName || buyer.name || buyer.email.split('@')[0];
          await prisma.notification.create({
            data: {
              userId: buyer.referredById,
              title: `Referral commission earned! 🎉`,
              body: `${buyerName} ne ${plan.name} plan kharida! Aapko ₹${earned.toFixed(0)} referral commission mili hai.`,
              read: false,
            },
          }).catch(() => {}); // non-fatal
        }
      }
    } catch {}

    return res.json({
      ok: true,
      investment: result.investment,
      isFirstPlan: result.isFirstPlan,
      commissions: result.distribution.distributed,
    });
  } catch (e: any) {
    console.error(e);
    if (String(e?.message || '').includes('Insufficient')) {
      return res.status(400).json({ error: e.message });
    }
    return res.status(503).json({ error: 'Failed to purchase plan' });
  }
});

export default router;
