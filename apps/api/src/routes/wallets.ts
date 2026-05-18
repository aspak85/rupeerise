import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.sub;
    const wallets = await prisma.wallet.findMany({ where: { userId } });
    return res.json({ wallets });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

export default router;
