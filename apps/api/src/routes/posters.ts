import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const router = Router();

/**
 * Public list of active posters for the landing-page carousel.
 * No auth required — anyone visiting the marketing site sees these.
 */
router.get('/', async (_req, res) => {
  try {
    const rows = await prisma.poster.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    if (rows.length) return res.json({ posters: rows });
  } catch {
    /* fall through to defaults */
  }
  // Sensible default slides so the landing page never looks empty.
  return res.json({
    posters: [
      {
        id: 'd1',
        title: 'Welcome bonus ₹100 free',
        subtitle: 'Sign up with your Gmail and instantly get ₹100 credited to your bonus wallet.',
        imageUrl: null,
        gradient: 'from-yellow-500/40 via-amber-500/15 to-transparent',
        ctaHref: '/login?signup=1',
        ctaLabel: 'Claim ₹100',
        active: true,
        sortOrder: 0,
      },
      {
        id: 'd2',
        title: 'Daily income from ₹500',
        subtitle: 'Pick a plan, claim every 24h, withdraw on Sunday — it is that simple.',
        imageUrl: null,
        gradient: 'from-emerald-500/40 via-green-500/15 to-transparent',
        ctaHref: '#plans',
        ctaLabel: 'View plans',
        active: true,
        sortOrder: 1,
      },
      {
        id: 'd3',
        title: 'Refer & earn 45%',
        subtitle: 'Invite friends — earn 45% on their first plan + lifetime tiered commissions.',
        imageUrl: null,
        gradient: 'from-fuchsia-500/40 via-pink-500/15 to-transparent',
        ctaHref: '#referrals',
        ctaLabel: 'Start referring',
        active: true,
        sortOrder: 2,
      },
    ],
  });
});

// --- Admin CRUD below ---
const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

function sanitize(body: any) {
  return {
    title: String(body?.title ?? '').trim().slice(0, 80),
    subtitle: body?.subtitle ? String(body.subtitle).trim().slice(0, 200) : null,
    imageUrl: body?.imageUrl ? String(body.imageUrl).trim().slice(0, 500) : null,
    gradient: String(body?.gradient ?? 'from-yellow-500/30 via-amber-500/10 to-transparent').trim().slice(0, 200),
    ctaHref: body?.ctaHref ? String(body.ctaHref).trim().slice(0, 500) : null,
    ctaLabel: body?.ctaLabel ? String(body.ctaLabel).trim().slice(0, 40) : null,
    active: body?.active === undefined ? true : !!body.active,
    sortOrder: Number.isFinite(Number(body?.sortOrder)) ? Number(body.sortOrder) : 0,
  };
}

adminRouter.get('/', async (_req, res) => {
  const posters = await prisma.poster.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  return res.json({ posters });
});

adminRouter.post('/', async (req, res) => {
  const data = sanitize(req.body);
  if (!data.title) return res.status(400).json({ error: 'title is required' });
  const created = await prisma.poster.create({ data });
  return res.json({ poster: created });
});

adminRouter.patch('/:id', async (req, res) => {
  const id = String(req.params.id);
  const exists = await prisma.poster.findUnique({ where: { id } });
  if (!exists) return res.status(404).json({ error: 'Poster not found' });
  const patch: any = {};
  const b = req.body ?? {};
  if (b.title !== undefined) patch.title = String(b.title).trim().slice(0, 80);
  if (b.subtitle !== undefined) patch.subtitle = b.subtitle ? String(b.subtitle).trim().slice(0, 200) : null;
  if (b.imageUrl !== undefined) patch.imageUrl = b.imageUrl ? String(b.imageUrl).trim().slice(0, 500) : null;
  if (b.gradient !== undefined) patch.gradient = String(b.gradient).trim().slice(0, 200);
  if (b.ctaHref !== undefined) patch.ctaHref = b.ctaHref ? String(b.ctaHref).trim().slice(0, 500) : null;
  if (b.ctaLabel !== undefined) patch.ctaLabel = b.ctaLabel ? String(b.ctaLabel).trim().slice(0, 40) : null;
  if (b.active !== undefined) patch.active = !!b.active;
  if (b.sortOrder !== undefined && Number.isFinite(Number(b.sortOrder))) patch.sortOrder = Number(b.sortOrder);
  const updated = await prisma.poster.update({ where: { id }, data: patch });
  return res.json({ poster: updated });
});

adminRouter.delete('/:id', async (req, res) => {
  const id = String(req.params.id);
  const exists = await prisma.poster.findUnique({ where: { id } });
  if (!exists) return res.status(404).json({ error: 'Poster not found' });
  await prisma.poster.delete({ where: { id } });
  return res.json({ ok: true });
});

export { adminRouter as adminPostersRouter };
export default router;
