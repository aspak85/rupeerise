import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { postLedger } from '../lib/wallet';
import { isWithdrawalDayIST } from '../lib/time';

const router = Router();

const MIN_AMOUNT = 300;
const FEE_PCT = 5;

/** GET /withdrawals — list current user's withdrawal requests */
router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.sub;
    const rows = await prisma.withdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json({
      withdrawals: rows.map((w) => ({
        id: w.id,
        amount: Number(w.amount),
        netAmount: Number(w.netAmount),
        feePercent: w.feePercent,
        method: w.method,
        status: w.status,
        createdAt: w.createdAt,
      })),
    });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

/** POST /withdrawals — create a withdrawal request (Sunday-only, ₹300 min, 5% fee) */
router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  const amount = Math.floor(Number(req.body?.amount ?? 0));
  const method = String(req.body?.method || 'upi'); // upi|bank
  const account = req.body?.account ?? {};

  if (!isWithdrawalDayIST()) {
    return res.status(400).json({ error: 'Withdrawals are only allowed on Sundays and Tuesdays (IST)' });
  }
  if (!Number.isFinite(amount) || amount < MIN_AMOUNT) {
    return res.status(400).json({ error: `Minimum withdrawal is ₹${MIN_AMOUNT}` });
  }
  if (!['upi', 'bank'].includes(method)) {
    return res.status(400).json({ error: 'Invalid method' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Funds drawn from earnings + referral + bonus combined logical pool by debiting earnings first, then referral.
      // For simplicity & correctness, sum balances across earnings/referral/bonus and require >= amount.
      const wallets = await tx.wallet.findMany({ where: { userId, type: { in: ['earnings', 'referral', 'bonus'] } } });
      const total = wallets.reduce((s, w) => s + Number(w.balance), 0);
      if (total < amount) throw new Error('Insufficient withdrawable balance');

      // Debit in priority order: earnings → referral → bonus
      let remaining = amount;
      const order: Array<'earnings' | 'referral' | 'bonus'> = ['earnings', 'referral', 'bonus'];
      const idemBase = `wd:${userId}:${Date.now()}`;
      let i = 0;
      for (const t of order) {
        if (remaining <= 0) break;
        const w = wallets.find((x) => x.type === t);
        const bal = w ? Number(w.balance) : 0;
        if (bal <= 0) continue;
        const take = Math.min(bal, remaining);
        await postLedger({
          userId,
          walletType: t,
          amount: take,
          direction: 'debit',
          reason: 'withdrawal:request',
          idempotencyKey: `${idemBase}:${i++}`,
          tx,
        });
        remaining -= take;
      }

      const fee = Math.round((amount * FEE_PCT) / 100);
      const net = amount - fee;
      const wd = await tx.withdrawal.create({
        data: {
          userId,
          amount,
          feePercent: FEE_PCT,
          netAmount: net,
          method,
          accountJson: JSON.stringify(account),
          status: 'pending',
        },
      });
      return wd;
    });

    return res.json({ ok: true, withdrawal: result });
  } catch (e: any) {
    console.error(e);
    if (String(e?.message || '').includes('Insufficient')) {
      return res.status(400).json({ error: e.message });
    }
    return res.status(503).json({ error: 'Failed to create withdrawal' });
  }
});

export default router;
