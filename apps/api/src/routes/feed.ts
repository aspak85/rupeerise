import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const router = Router();

const SEED_DEPOSITS = [
  ['Aarav S.', 'Mumbai', 5000], ['Diya R.', 'Pune', 2500], ['Kabir P.', 'Delhi', 10000],
  ['Isha M.', 'Bengaluru', 1500], ['Anaya K.', 'Surat', 3000], ['Vihaan T.', 'Indore', 7500],
  ['Ananya G.', 'Chennai', 500], ['Reyansh B.', 'Hyderabad', 25000], ['Aadhya N.', 'Ahmedabad', 1000],
  ['Arjun L.', 'Jaipur', 12000], ['Saanvi D.', 'Lucknow', 800], ['Krish V.', 'Kolkata', 50000],
];
const SEED_WITHDRAWS = [
  ['Rahul J.', 'Mumbai', 3200], ['Priya S.', 'Delhi', 1800], ['Sneha K.', 'Pune', 6500],
  ['Aditya M.', 'Bengaluru', 2400], ['Kavya R.', 'Hyderabad', 9100], ['Manav P.', 'Surat', 1200],
  ['Pooja T.', 'Indore', 4400], ['Vivek N.', 'Chennai', 15300], ['Tara B.', 'Jaipur', 750],
  ['Nikhil G.', 'Kolkata', 22500], ['Riya D.', 'Lucknow', 5800], ['Ayaan V.', 'Ahmedabad', 11200],
];

/**
 * GET /feed/live?kind=deposit|withdraw|all&take=12
 *
 * Returns a marketing-friendly "live" feed. We pull active rows from the
 * FeedEntry table; if the table is empty (or DB hiccups), we fall back to a
 * shuffled seed list so the UI is never blank. Each render is reshuffled and
 * paired with a fresh random "x minutes ago" so the feed always feels live.
 */
router.get('/live', async (req, res) => {
  const kind = String(req.query.kind || 'all');
  const take = Math.max(1, Math.min(50, Number(req.query.take || 12) || 12));
  let entries: Array<{ kind: string; username: string; city: string | null; amount: number }> = [];
  try {
    const rows = await prisma.feedEntry.findMany({
      where: {
        active: true,
        ...(kind === 'deposit' || kind === 'withdraw' ? { kind } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    entries = rows.map((r) => ({ kind: r.kind, username: r.username, city: r.city, amount: r.amount }));
  } catch {
    /* fall through */
  }

  if (!entries.length) {
    const pool: Array<[string, string, number, string]> = [];
    if (kind !== 'withdraw') for (const [u, c, a] of SEED_DEPOSITS) pool.push([u as string, c as string, a as number, 'deposit']);
    if (kind !== 'deposit') for (const [u, c, a] of SEED_WITHDRAWS) pool.push([u as string, c as string, a as number, 'withdraw']);
    entries = pool.map(([username, city, amount, k]) => ({ kind: k, username, city, amount }));
  }

  // Light shuffle so each refresh feels fresh.
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }

  const items = entries.slice(0, take).map((e) => ({
    ...e,
    minutesAgo: Math.floor(1 + Math.random() * 55),
  }));
  return res.json({ items });
});

// ----- Admin CRUD -----
const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

function sanitize(body: any) {
  const k = String(body?.kind || 'deposit').toLowerCase();
  return {
    kind: k === 'withdraw' ? 'withdraw' : 'deposit',
    username: String(body?.username ?? '').trim().slice(0, 40),
    city: body?.city ? String(body.city).trim().slice(0, 40) : null,
    amount: Math.max(0, Math.floor(Number(body?.amount ?? 0))),
    active: body?.active === undefined ? true : !!body.active,
    sortOrder: Number.isFinite(Number(body?.sortOrder)) ? Number(body.sortOrder) : 0,
  };
}

adminRouter.get('/', async (_req, res) => {
  const items = await prisma.feedEntry.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
  return res.json({ items });
});

adminRouter.post('/', async (req, res) => {
  const data = sanitize(req.body);
  if (!data.username || !data.amount) return res.status(400).json({ error: 'username and amount are required' });
  const created = await prisma.feedEntry.create({ data });
  return res.json({ item: created });
});

adminRouter.patch('/:id', async (req, res) => {
  const id = String(req.params.id);
  const exists = await prisma.feedEntry.findUnique({ where: { id } });
  if (!exists) return res.status(404).json({ error: 'Feed entry not found' });
  const patch: any = {};
  const b = req.body ?? {};
  if (b.kind !== undefined) {
    const k = String(b.kind).toLowerCase();
    patch.kind = k === 'withdraw' ? 'withdraw' : 'deposit';
  }
  if (b.username !== undefined) patch.username = String(b.username).trim().slice(0, 40);
  if (b.city !== undefined) patch.city = b.city ? String(b.city).trim().slice(0, 40) : null;
  if (b.amount !== undefined) patch.amount = Math.max(0, Math.floor(Number(b.amount) || 0));
  if (b.active !== undefined) patch.active = !!b.active;
  if (b.sortOrder !== undefined && Number.isFinite(Number(b.sortOrder))) patch.sortOrder = Number(b.sortOrder);
  const updated = await prisma.feedEntry.update({ where: { id }, data: patch });
  return res.json({ item: updated });
});

adminRouter.delete('/:id', async (req, res) => {
  const id = String(req.params.id);
  const exists = await prisma.feedEntry.findUnique({ where: { id } });
  if (!exists) return res.status(404).json({ error: 'Feed entry not found' });
  await prisma.feedEntry.delete({ where: { id } });
  return res.json({ ok: true });
});

export { adminRouter as adminFeedRouter };
export default router;
