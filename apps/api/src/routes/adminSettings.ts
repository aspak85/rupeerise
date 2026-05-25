import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const router = Router();
router.use(requireAuth, requireAdmin);

const KEY = 'registration_bonus';
const DEFAULT = { enabled: true, amount: 100 };

async function readBonus(): Promise<{ enabled: boolean; amount: number }> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
    if (!row) return DEFAULT;
    const parsed = JSON.parse(row.value);
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT.enabled,
      amount: Number.isFinite(Number(parsed.amount)) ? Math.max(0, Math.floor(Number(parsed.amount))) : DEFAULT.amount,
    };
  } catch {
    return DEFAULT;
  }
}

router.get('/registration-bonus', async (_req, res) => {
  const bonus = await readBonus();
  return res.json({ bonus });
});

router.put('/registration-bonus', async (req, res) => {
  const enabled = !!req.body?.enabled;
  const amountRaw = Number(req.body?.amount);
  const amount = Number.isFinite(amountRaw) ? Math.max(0, Math.min(100000, Math.floor(amountRaw))) : DEFAULT.amount;
  const value = JSON.stringify({ enabled, amount });
  await prisma.appSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value },
    update: { value },
  });
  return res.json({ bonus: { enabled, amount } });
});

export { readBonus as readRegistrationBonus };
export default router;
