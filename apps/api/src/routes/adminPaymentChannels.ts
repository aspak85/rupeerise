import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { ensureChannelsSeeded } from '../lib/paymentChannels';

const router = Router();
router.use(requireAuth, requireAdmin);

const VALID_KINDS = new Set(['upi', 'bank', 'crypto', 'other']);

function sanitize(body: any) {
  return {
    kind: VALID_KINDS.has(body?.kind) ? String(body.kind) : 'upi',
    label: String(body?.label ?? '').trim().slice(0, 80),
    value: String(body?.value ?? '').trim().slice(0, 200),
    payeeName: String(body?.payeeName ?? 'RupeeRise').trim().slice(0, 80),
    note: body?.note ? String(body.note).trim().slice(0, 240) : null,
    metaJson: body?.metaJson ? String(body.metaJson).slice(0, 2000) : null,
    active: body?.active === undefined ? true : !!body.active,
    isDefault: !!body?.isDefault,
    sortOrder: Number.isFinite(Number(body?.sortOrder)) ? Number(body.sortOrder) : 0,
  };
}

/** GET /admin/payment-channels */
router.get('/', async (_req, res) => {
  await ensureChannelsSeeded();
  const channels = await prisma.paymentChannel.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return res.json({ channels });
});

/** POST /admin/payment-channels */
router.post('/', async (req, res) => {
  const data = sanitize(req.body);
  if (!data.label || !data.value) return res.status(400).json({ error: 'label and value are required' });

  // If this row should be default, clear the flag from any others first.
  if (data.isDefault) {
    await prisma.paymentChannel.updateMany({ data: { isDefault: false }, where: {} });
  }

  const created = await prisma.paymentChannel.create({ data });
  return res.json({ channel: created });
});

/** PATCH /admin/payment-channels/:id */
router.patch('/:id', async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.paymentChannel.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Channel not found' });

  const patch: any = {};
  const b = req.body ?? {};
  if (b.kind !== undefined && VALID_KINDS.has(b.kind)) patch.kind = String(b.kind);
  if (b.label !== undefined) patch.label = String(b.label).trim().slice(0, 80);
  if (b.value !== undefined) patch.value = String(b.value).trim().slice(0, 200);
  if (b.payeeName !== undefined) patch.payeeName = String(b.payeeName).trim().slice(0, 80);
  if (b.note !== undefined) patch.note = b.note ? String(b.note).trim().slice(0, 240) : null;
  if (b.metaJson !== undefined) patch.metaJson = b.metaJson ? String(b.metaJson).slice(0, 2000) : null;
  if (b.active !== undefined) patch.active = !!b.active;
  if (b.sortOrder !== undefined && Number.isFinite(Number(b.sortOrder))) patch.sortOrder = Number(b.sortOrder);

  // Default flag is exclusive — if setting true, clear others.
  if (b.isDefault === true) {
    await prisma.paymentChannel.updateMany({ data: { isDefault: false }, where: { NOT: { id } } });
    patch.isDefault = true;
  } else if (b.isDefault === false) {
    patch.isDefault = false;
  }

  const updated = await prisma.paymentChannel.update({ where: { id }, data: patch });
  return res.json({ channel: updated });
});

/** DELETE /admin/payment-channels/:id */
router.delete('/:id', async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.paymentChannel.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Channel not found' });
  await prisma.paymentChannel.delete({ where: { id } });
  // If we just deleted the default, promote the first remaining channel.
  if (existing.isDefault) {
    const next = await prisma.paymentChannel.findFirst({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    if (next) await prisma.paymentChannel.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  return res.json({ ok: true });
});

export default router;
