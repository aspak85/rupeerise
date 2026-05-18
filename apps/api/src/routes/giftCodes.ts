import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { postLedger } from '../lib/wallet';

const router = Router();

const CODE_RE = /^[A-Z0-9-]{4,32}$/;

/**
 * POST /redeem
 * Body: { code: string }
 * Atomically:
 *   1. Validate the code exists, is active, has remaining claims, not expired.
 *   2. Ensure this user has not already claimed it (unique GiftClaim row).
 *   3. Increment claimsCount, create GiftClaim, credit bonus wallet via postLedger.
 *   4. Auto-disable the code when claimsCount reaches maxClaims.
 *
 * All four steps run inside a single $transaction so partial credits cannot occur.
 */
router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  const raw = String(req.body?.code || '').trim().toUpperCase();
  if (!CODE_RE.test(raw)) {
    return res.status(400).json({ error: 'Invalid code format' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const gift = await tx.giftCode.findUnique({ where: { code: raw } });
      if (!gift) return { ok: false as const, code: 'NOT_FOUND', message: 'Gift code does not exist' };
      if (gift.status !== 'active') return { ok: false as const, code: 'DISABLED', message: 'This code has been disabled' };
      if (gift.expiresAt && gift.expiresAt.getTime() < Date.now()) {
        return { ok: false as const, code: 'EXPIRED', message: 'This code has expired' };
      }
      if (gift.claimsCount >= gift.maxClaims) {
        return { ok: false as const, code: 'EXHAUSTED', message: 'This code has been fully redeemed' };
      }

      // Has this user already claimed?
      const already = await tx.giftClaim.findUnique({
        where: { giftCodeId_userId: { giftCodeId: gift.id, userId } },
      });
      if (already) {
        return {
          ok: false as const,
          code: 'ALREADY_CLAIMED',
          message: 'You have already redeemed this code',
          amount: already.amount,
        };
      }

      // Atomically increment counter (fails to "exhaust" if counter is at cap).
      const nextCount = gift.claimsCount + 1;
      const updated = await tx.giftCode.update({
        where: { id: gift.id },
        data: {
          claimsCount: nextCount,
          // Auto-flip to "exhausted" so the next user sees a clear status.
          status: nextCount >= gift.maxClaims ? 'exhausted' : gift.status,
        },
      });

      await tx.giftClaim.create({
        data: { giftCodeId: gift.id, userId, amount: gift.amount },
      });

      await postLedger({
        userId,
        walletType: 'bonus',
        amount: gift.amount,
        direction: 'credit',
        reason: 'gift_code',
        refId: gift.id,
        idempotencyKey: `gift:${gift.id}:${userId}`,
        tx,
      });

      return {
        ok: true as const,
        amount: gift.amount,
        code: updated.code,
        message: `+${gift.amount} INR credited to Bonus Wallet`,
      };
    });

    if (!result.ok) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (e: any) {
    console.error('redeem error:', e);
    return res.status(503).json({ ok: false, code: 'SERVER_ERROR', message: 'Could not redeem right now' });
  }
});

/** GET /redeem/history — current user's redemption history */
router.get('/history', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  try {
    const claims = await prisma.giftClaim.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { GiftCode: { select: { code: true, notes: true } } },
    });
    return res.json({
      claims: claims.map((c) => ({
        id: c.id,
        code: c.GiftCode.code,
        amount: c.amount,
        notes: c.GiftCode.notes,
        claimedAt: c.createdAt,
      })),
    });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

export default router;
