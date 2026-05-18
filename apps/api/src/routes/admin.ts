import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { postLedger } from '../lib/wallet';
import { env } from '../lib/env';
import { sendMail, otpEmail } from '../lib/mail';

const router = Router();

router.use(requireAuth, requireAdmin);

/* ---------------- PLATFORM SETTINGS ---------------- */

/** GET /admin/settings/status — show which integrations are configured. */
router.get('/settings/status', (_req, res) => {
  const smtpHostConfigured = !!env.SMTP_HOST;
  const smtpAuthConfigured = !!(env.SMTP_USER && env.SMTP_PASS);
  const razorpayConfigured = !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
  return res.json({
    smtp: {
      configured: smtpHostConfigured && smtpAuthConfigured,
      host: env.SMTP_HOST || null,
      port: env.SMTP_PORT,
      user: env.SMTP_USER ? maskEmail(env.SMTP_USER) : null,
      mailFrom: env.MAIL_FROM,
      // Best-effort vendor detection so the UI can show a friendly badge
      vendor: detectMailVendor(env.SMTP_HOST),
    },
    razorpay: {
      configured: razorpayConfigured,
      keyId: razorpayConfigured ? env.RAZORPAY_KEY_ID : null,
      mode: env.RAZORPAY_KEY_ID?.startsWith('rzp_live') ? 'live' : env.RAZORPAY_KEY_ID?.startsWith('rzp_test') ? 'test' : null,
    },
    admins: env.ADMIN_EMAILS.split(',').map((s) => s.trim()).filter(Boolean),
  });
});

/** POST /admin/settings/test-mail — send a real test mail to verify SMTP. */
router.post('/settings/test-mail', async (req: AuthedRequest, res) => {
  const to = String(req.body?.to || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res.status(400).json({ error: 'Provide a valid recipient email' });
  }
  // Use a fake "test" code to reuse the OTP template look-and-feel.
  const fakeCode = String(Math.floor(100000 + Math.random() * 900000));
  const { text, html } = otpEmail(fakeCode);
  try {
    const r = await sendMail({
      to,
      subject: 'RupeeRise SMTP test mail',
      text: `This is a test email from your RupeeRise admin console. Sample OTP shown below.\n\n${text}`,
      html,
    });
    return res.json({
      ok: true,
      delivered: r.delivered,
      preview: r.preview ?? null,
      message: r.delivered
        ? `Mail accepted by SMTP. Check ${to} (and the spam folder).`
        : 'No SMTP configured — the API console printed the mail instead. Add SMTP_HOST/USER/PASS in apps/api/.env to send for real.',
    });
  } catch (e: any) {
    return res.status(502).json({ error: e?.message || 'SMTP send failed' });
  }
});

function maskEmail(email: string) {
  const [u, d] = email.split('@');
  if (!d) return email;
  const head = u.length <= 3 ? u : u.slice(0, 2) + '***' + u.slice(-1);
  return `${head}@${d}`;
}

function detectMailVendor(host?: string): 'gmail' | 'brevo' | 'sendgrid' | 'mailtrap' | 'other' | null {
  if (!host) return null;
  const h = host.toLowerCase();
  if (h.includes('gmail')) return 'gmail';
  if (h.includes('brevo') || h.includes('sendinblue')) return 'brevo';
  if (h.includes('sendgrid')) return 'sendgrid';
  if (h.includes('mailtrap')) return 'mailtrap';
  return 'other';
}

/** GET /admin/stats — top-level platform stats */
router.get('/stats', async (_req, res) => {
  try {
    const [users, activeInvestments, totalDepositsApproved, totalWithdrawalsApproved, pendingDeposits, pendingWithdrawals] = await Promise.all([
      prisma.user.count(),
      prisma.investment.count({ where: { status: 'active' } }),
      prisma.deposit.aggregate({ where: { status: 'approved' }, _sum: { amount: true } }),
      prisma.withdrawal.aggregate({ where: { status: 'approved' }, _sum: { netAmount: true } }),
      prisma.deposit.count({ where: { status: 'pending' } }),
      prisma.withdrawal.count({ where: { status: 'pending' } }),
    ]);
    return res.json({
      users,
      activeInvestments,
      totalDeposits: Number(totalDepositsApproved._sum.amount ?? 0),
      totalWithdrawals: Number(totalWithdrawalsApproved._sum.netAmount ?? 0),
      pendingDeposits,
      pendingWithdrawals,
    });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

/* ---------------- USERS ---------------- */
router.get('/users', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const where = q
      ? {
          OR: [
            { email: { contains: q.toLowerCase() } },
            { phone: { contains: q } },
            { referralCode: { contains: q.toUpperCase() } },
          ],
        }
      : {};
    const users = await prisma.user.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
        role: true,
        status: true,
        kycVerified: true,
        referralCode: true,
        referredById: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
    return res.json({ users });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

router.patch('/users/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { status, kycVerified, role } = req.body ?? {};
    const data: any = {};
    if (status === 'active' || status === 'blocked') data.status = status;
    if (typeof kycVerified === 'boolean') data.kycVerified = kycVerified;
    if (role === 'user' || role === 'admin') data.role = role;
    const u = await prisma.user.update({ where: { id }, data, select: { id: true, status: true, role: true, kycVerified: true } });
    return res.json({ user: u });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Failed to update user' });
  }
});

/** Manual wallet adjustment by admin (e.g. correct balance, refund). */
router.post('/users/:id/adjust', async (req: AuthedRequest, res) => {
  try {
    const id = req.params.id;
    const { walletType, amount, direction, reason } = req.body ?? {};
    if (!['deposit', 'earnings', 'bonus', 'referral', 'withdrawal'].includes(walletType)) return res.status(400).json({ error: 'Invalid walletType' });
    if (!['credit', 'debit'].includes(direction)) return res.status(400).json({ error: 'Invalid direction' });
    const amt = Math.abs(Number(amount));
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const result = await postLedger({
      userId: id,
      walletType,
      amount: amt,
      direction,
      reason: `admin_adjust:${reason || 'manual'}`,
      idempotencyKey: `adjust:${id}:${walletType}:${direction}:${Date.now()}`,
    });
    return res.json({ ok: true, result });
  } catch (e: any) {
    console.error(e);
    return res.status(400).json({ error: e?.message || 'Adjust failed' });
  }
});

/* ---------------- DEPOSITS ---------------- */
router.get('/deposits', async (req, res) => {
  try {
    const status = String(req.query.status || 'pending');
    const rows = await prisma.deposit.findMany({
      where: status === 'all' ? {} : { status },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { User: { select: { id: true, phone: true, email: true, name: true } } },
    });
    return res.json({ deposits: rows });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

router.post('/deposits/:id/approve', async (req: AuthedRequest, res) => {
  try {
    const id = req.params.id;
    const adminId = req.user!.sub;
    const result = await prisma.$transaction(async (tx) => {
      const dep = await tx.deposit.findUnique({ where: { id } });
      if (!dep) throw new Error('Deposit not found');
      if (dep.status !== 'pending') throw new Error('Deposit not pending');
      const updated = await tx.deposit.update({
        where: { id },
        data: { status: 'approved', reviewedBy: adminId, reviewedAt: new Date() },
      });
      await postLedger({
        userId: dep.userId,
        walletType: 'deposit',
        amount: Number(dep.amount),
        direction: 'credit',
        reason: 'deposit:approved',
        refId: dep.id,
        idempotencyKey: `dep_approve:${dep.id}`,
        tx,
      });
      return updated;
    });
    return res.json({ ok: true, deposit: result });
  } catch (e: any) {
    console.error(e);
    return res.status(400).json({ error: e?.message || 'Approve failed' });
  }
});

router.post('/deposits/:id/reject', async (req: AuthedRequest, res) => {
  try {
    const id = req.params.id;
    const adminId = req.user!.sub;
    const note = req.body?.note ? String(req.body.note).slice(0, 240) : null;
    const dep = await prisma.deposit.update({
      where: { id },
      data: { status: 'rejected', reviewedBy: adminId, reviewedAt: new Date(), note: note ?? undefined },
    });
    return res.json({ ok: true, deposit: dep });
  } catch (e) {
    console.error(e);
    return res.status(400).json({ error: 'Reject failed' });
  }
});

/* ---------------- WITHDRAWALS ---------------- */
router.get('/withdrawals', async (req, res) => {
  try {
    const status = String(req.query.status || 'pending');
    const rows = await prisma.withdrawal.findMany({
      where: status === 'all' ? {} : { status },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { User: { select: { id: true, phone: true, email: true, name: true } } },
    });
    return res.json({ withdrawals: rows });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

router.post('/withdrawals/:id/approve', async (req, res) => {
  try {
    const id = req.params.id;
    const payoutRef = req.body?.payoutRef ? String(req.body.payoutRef).slice(0, 80) : null;
    const wd = await prisma.withdrawal.update({
      where: { id },
      data: { status: 'approved', payoutRef: payoutRef ?? undefined },
    });
    return res.json({ ok: true, withdrawal: wd });
  } catch (e) {
    console.error(e);
    return res.status(400).json({ error: 'Approve failed' });
  }
});

router.post('/withdrawals/:id/reject', async (req, res) => {
  try {
    const id = req.params.id;
    // Refund the user: re-credit the gross amount back to earnings wallet (admin discretion)
    const result = await prisma.$transaction(async (tx) => {
      const wd = await tx.withdrawal.findUnique({ where: { id } });
      if (!wd) throw new Error('Withdrawal not found');
      if (wd.status !== 'pending') throw new Error('Withdrawal not pending');
      const updated = await tx.withdrawal.update({ where: { id }, data: { status: 'rejected' } });
      await postLedger({
        userId: wd.userId,
        walletType: 'earnings',
        amount: Number(wd.amount),
        direction: 'credit',
        reason: 'withdrawal:rejected_refund',
        refId: wd.id,
        idempotencyKey: `wd_refund:${wd.id}`,
        tx,
      });
      return updated;
    });
    return res.json({ ok: true, withdrawal: result });
  } catch (e: any) {
    console.error(e);
    return res.status(400).json({ error: e?.message || 'Reject failed' });
  }
});

/* ---------------- PLANS CRUD ---------------- */
router.get('/plans', async (_req, res) => {
  try {
    const plans = await prisma.plan.findMany({ orderBy: { price: 'asc' } });
    return res.json({ plans });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

router.post('/plans', async (req, res) => {
  try {
    const { name, price, dailyIncome, durationDays, active } = req.body ?? {};
    if (typeof name !== 'string' || !Number.isFinite(+price) || !Number.isFinite(+dailyIncome) || !Number.isFinite(+durationDays)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }
    const plan = await prisma.plan.create({
      data: { name: name.slice(0, 60), price: Math.max(0, +price), dailyIncome: Math.max(0, +dailyIncome), durationDays: Math.max(1, +durationDays), active: !!active },
    });
    return res.json({ plan });
  } catch (e) {
    console.error(e);
    return res.status(400).json({ error: 'Create failed' });
  }
});

router.patch('/plans/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { name, price, dailyIncome, durationDays, active } = req.body ?? {};
    const data: any = {};
    if (typeof name === 'string') data.name = name.slice(0, 60);
    if (Number.isFinite(+price)) data.price = Math.max(0, +price);
    if (Number.isFinite(+dailyIncome)) data.dailyIncome = Math.max(0, +dailyIncome);
    if (Number.isFinite(+durationDays)) data.durationDays = Math.max(1, +durationDays);
    if (typeof active === 'boolean') data.active = active;
    const plan = await prisma.plan.update({ where: { id }, data });
    return res.json({ plan });
  } catch (e) {
    console.error(e);
    return res.status(400).json({ error: 'Update failed' });
  }
});

router.delete('/plans/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await prisma.plan.update({ where: { id }, data: { active: false } });
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(400).json({ error: 'Delete failed' });
  }
});

/* ---------------- ACTIVITY ---------------- */
router.get('/activity', async (_req, res) => {
  try {
    const [recentDeposits, recentWithdrawals, recentUsers] = await Promise.all([
      prisma.deposit.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { User: { select: { email: true, phone: true } } } }),
      prisma.withdrawal.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { User: { select: { email: true, phone: true } } } }),
      prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, email: true, phone: true, createdAt: true } }),
    ]);
    return res.json({ recentDeposits, recentWithdrawals, recentUsers });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

export default router;
