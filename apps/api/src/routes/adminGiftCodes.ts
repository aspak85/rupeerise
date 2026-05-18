import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const router = Router();
router.use(requireAuth, requireAdmin);

const CODE_RE = /^[A-Z0-9-]{4,32}$/;

function generateCode(prefix = 'RR'): string {
  // Easy-to-read alphanumerics only (no 0/O, 1/I confusion).
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += alpha[Math.floor(Math.random() * alpha.length)];
  return `${prefix}-${s}`;
}

/** GET /admin/gift-codes — list all codes with claim count + computed status */
router.get('/', async (_req, res) => {
  try {
    const codes = await prisma.giftCode.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { _count: { select: { Claims: true } } },
    });
    return res.json({
      codes: codes.map((g) => ({
        id: g.id,
        code: g.code,
        amount: g.amount,
        maxClaims: g.maxClaims,
        claimsCount: g.claimsCount,
        remaining: Math.max(0, g.maxClaims - g.claimsCount),
        expiresAt: g.expiresAt,
        status: g.status,
        notes: g.notes,
        createdAt: g.createdAt,
      })),
    });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

/** POST /admin/gift-codes — create a new code (auto-generated if `code` omitted) */
router.post('/', async (req: AuthedRequest, res) => {
  const amount = Math.floor(Number(req.body?.amount));
  const maxClaims = Math.max(1, Math.floor(Number(req.body?.maxClaims ?? 1)));
  let code = String(req.body?.code || '').trim().toUpperCase();
  const notes = req.body?.notes ? String(req.body.notes).slice(0, 200) : undefined;
  let expiresAt: Date | undefined = undefined;
  if (req.body?.expiresAt) {
    const t = new Date(String(req.body.expiresAt));
    if (!isNaN(t.getTime())) expiresAt = t;
  }

  if (!Number.isFinite(amount) || amount < 1) {
    return res.status(400).json({ error: 'Amount must be a positive integer' });
  }
  if (code && !CODE_RE.test(code)) {
    return res.status(400).json({ error: 'Code must be 4–32 chars (A-Z, 0-9, dash)' });
  }
  if (!code) {
    // Generate a unique code with up to 5 retries on collision.
    for (let i = 0; i < 5; i++) {
      const candidate = generateCode();
      const existing = await prisma.giftCode.findUnique({ where: { code: candidate } });
      if (!existing) { code = candidate; break; }
    }
    if (!code) return res.status(503).json({ error: 'Could not generate a unique code, try again' });
  } else {
    const existing = await prisma.giftCode.findUnique({ where: { code } });
    if (existing) return res.status(409).json({ error: 'Code already exists, choose a different one' });
  }

  try {
    const created = await prisma.giftCode.create({
      data: {
        code,
        amount,
        maxClaims,
        expiresAt,
        notes,
        createdBy: req.user!.sub,
      },
    });
    return res.json({ ok: true, code: created });
  } catch (e: any) {
    console.error(e);
    return res.status(503).json({ error: 'Failed to create code' });
  }
});

/** PATCH /admin/gift-codes/:id — update amount / maxClaims / status / notes / expiry */
router.patch('/:id', async (req, res) => {
  const id = String(req.params.id);
  const data: any = {};
  if (req.body?.amount !== undefined) {
    const a = Math.floor(Number(req.body.amount));
    if (!Number.isFinite(a) || a < 1) return res.status(400).json({ error: 'Invalid amount' });
    data.amount = a;
  }
  if (req.body?.maxClaims !== undefined) {
    const m = Math.max(1, Math.floor(Number(req.body.maxClaims)));
    data.maxClaims = m;
  }
  if (req.body?.status !== undefined) {
    const s = String(req.body.status);
    if (!['active', 'disabled', 'exhausted'].includes(s)) return res.status(400).json({ error: 'Invalid status' });
    data.status = s;
  }
  if (req.body?.notes !== undefined) {
    data.notes = req.body.notes ? String(req.body.notes).slice(0, 200) : null;
  }
  if (req.body?.expiresAt !== undefined) {
    if (!req.body.expiresAt) data.expiresAt = null;
    else {
      const t = new Date(String(req.body.expiresAt));
      if (isNaN(t.getTime())) return res.status(400).json({ error: 'Invalid expiry date' });
      data.expiresAt = t;
    }
  }
  try {
    const updated = await prisma.giftCode.update({ where: { id }, data });
    return res.json({ ok: true, code: updated });
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ error: 'Code not found' });
    console.error(e);
    return res.status(503).json({ error: 'Update failed' });
  }
});

/** DELETE /admin/gift-codes/:id — hard delete (claims cascade away) */
router.delete('/:id', async (req, res) => {
  try {
    await prisma.giftCode.delete({ where: { id: String(req.params.id) } });
    return res.json({ ok: true });
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ error: 'Code not found' });
    console.error(e);
    return res.status(503).json({ error: 'Delete failed' });
  }
});

/** GET /admin/gift-codes/:id/claims — list users who redeemed a specific code */
router.get('/:id/claims', async (req, res) => {
  try {
    const claims = await prisma.giftClaim.findMany({
      where: { giftCodeId: String(req.params.id) },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    // Hydrate with user emails for display.
    const userIds = claims.map((c) => c.userId);
    const users = userIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, firstName: true, lastName: true } })
      : [];
    const map = new Map(users.map((u) => [u.id, u]));
    return res.json({
      claims: claims.map((c) => ({
        id: c.id,
        userId: c.userId,
        userEmail: map.get(c.userId)?.email || null,
        userName: [map.get(c.userId)?.firstName, map.get(c.userId)?.lastName].filter(Boolean).join(' ') || null,
        amount: c.amount,
        claimedAt: c.createdAt,
      })),
    });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

export default router;
