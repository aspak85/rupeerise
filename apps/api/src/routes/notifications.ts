import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthedRequest, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.sub },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return res.json({ notifications });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

router.patch('/:id/read', async (req: AuthedRequest, res) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.sub },
      data: { read: true },
    });
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

router.patch('/read-all', async (req: AuthedRequest, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.sub, read: false },
      data: { read: true },
    });
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

export default router;
