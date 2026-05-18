import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { ensureWallets } from '../lib/wallet';

const router = Router();

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.sub;
    await ensureWallets(userId);
    const userRaw = await prisma.user.findUnique({
      where: { id: userId },
      // Pull passwordHash so we can compute hasPassword, but never expose it
      // in the response — strip below.
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        kycVerified: true,
        referralCode: true,
        referredById: true,
        createdAt: true,
        lastLoginAt: true,
        passwordHash: true,
      },
    });
    if (!userRaw) return res.status(404).json({ error: 'User not found' });
    if (userRaw.status === 'blocked') return res.status(403).json({ error: 'Account blocked' });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...rest } = userRaw;
    const user = { ...rest, hasPassword: !!passwordHash };

    const wallets = await prisma.wallet.findMany({ where: { userId } });
    const totals = wallets.reduce(
      (acc, w) => {
        const v = Number(w.balance);
        acc.byType[w.type] = v;
        acc.total += v;
        return acc;
      },
      { byType: {} as Record<string, number>, total: 0 }
    );

    const activeInvestments = await prisma.investment.count({ where: { userId, status: 'active' } });
    const totalWithdrawn = await prisma.transaction.aggregate({
      where: { userId, walletType: 'withdrawal', direction: 'debit' },
      _sum: { amount: true },
    });

    return res.json({
      user,
      wallets,
      totals,
      stats: {
        activeInvestments,
        totalWithdrawn: Number(totalWithdrawn._sum.amount ?? 0),
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

/**
 * PATCH /me — update editable profile fields. Email cannot be changed via
 * this endpoint (would require re-verification flow); only name + phone +
 * firstName + lastName are mutable here.
 */
router.patch('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.sub;
    const { name, firstName, lastName, phone } = req.body ?? {};
    const data: any = {};
    if (typeof name === 'string') data.name = name.slice(0, 80);
    if (typeof firstName === 'string') data.firstName = firstName.replace(/[^a-zA-Z\s]/g, '').slice(0, 40);
    if (typeof lastName === 'string') data.lastName = lastName.replace(/[^a-zA-Z\s]/g, '').slice(0, 40);
    if (typeof phone === 'string') {
      const digits = phone.replace(/\D/g, '');
      if (digits.length && digits.length !== 10) {
        return res.status(400).json({ error: 'Phone must be a 10-digit Indian mobile number' });
      }
      data.phone = digits || null;
    }
    // Auto-rebuild combined name when first/last are updated and name was empty.
    if ((data.firstName || data.lastName) && !data.name) {
      const existing = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
      const fn = data.firstName ?? existing?.firstName ?? '';
      const ln = data.lastName ?? existing?.lastName ?? '';
      const combined = [fn, ln].filter(Boolean).join(' ').trim();
      if (combined) data.name = combined;
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, firstName: true, lastName: true, phone: true },
    });
    return res.json({ user });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

export default router;
