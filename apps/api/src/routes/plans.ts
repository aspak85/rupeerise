import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { ensurePlansSeeded, DEFAULT_PLANS } from '../lib/plans';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    await ensurePlansSeeded();
    const rows = await prisma.plan.findMany({ where: { active: true }, orderBy: { price: 'asc' } });
    const plans = rows.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      daily_income: p.dailyIncome,
      duration_days: p.durationDays,
      total_return: p.dailyIncome * p.durationDays,
      active: p.active,
    }));
    res.json({ plans });
  } catch {
    // Fallback when DB is unavailable so the public landing page still renders
    const plans = DEFAULT_PLANS.map((p) => ({
      id: p.name.toLowerCase(),
      name: p.name,
      price: p.price,
      daily_income: p.dailyIncome,
      duration_days: p.durationDays,
      total_return: p.dailyIncome * p.durationDays,
      active: true,
    }));
    res.json({ plans, fallback: true });
  }
});

export default router;
