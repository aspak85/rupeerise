import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const router = Router();
router.use(requireAuth, requireAdmin);

/** Convert an array of records to a CSV string. Quotes any field that needs escaping. */
function toCsv(rows: Record<string, any>[], headers: string[]): string {
  const escape = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map((h) => escape(r[h])).join(','));
  return lines.join('\r\n');
}

function setCsvHeaders(res: any, filename: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
}

const todayStamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

/** GET /admin/exports/users.csv */
router.get('/users.csv', async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      Wallets: true,
      Investments: true,
      _count: { select: { Deposits: true, Withdrawals: true } },
    },
  });
  const rows = users.map((u) => {
    const walletMap: Record<string, number> = {};
    for (const w of u.Wallets) walletMap[w.type] = Number(w.balance);
    return {
      id: u.id,
      createdAt: u.createdAt.toISOString(),
      email: u.email,
      firstName: u.firstName ?? '',
      lastName: u.lastName ?? '',
      phone: u.phone ?? '',
      role: u.role,
      status: u.status,
      kycVerified: u.kycVerified,
      referralCode: u.referralCode,
      referredById: u.referredById ?? '',
      lastLoginAt: u.lastLoginAt?.toISOString() ?? '',
      depositWallet: walletMap.deposit ?? 0,
      earningsWallet: walletMap.earnings ?? 0,
      bonusWallet: walletMap.bonus ?? 0,
      referralWallet: walletMap.referral ?? 0,
      withdrawalWallet: walletMap.withdrawal ?? 0,
      investmentsCount: u.Investments.length,
      depositsCount: u._count.Deposits,
      withdrawalsCount: u._count.Withdrawals,
    };
  });
  const csv = toCsv(rows, [
    'id', 'createdAt', 'email', 'firstName', 'lastName', 'phone', 'role', 'status', 'kycVerified',
    'referralCode', 'referredById', 'lastLoginAt',
    'depositWallet', 'earningsWallet', 'bonusWallet', 'referralWallet', 'withdrawalWallet',
    'investmentsCount', 'depositsCount', 'withdrawalsCount',
  ]);
  setCsvHeaders(res, `rupeerise_users_${todayStamp()}.csv`);
  return res.send(csv);
});

/** GET /admin/exports/deposits.csv?status=pending|approved|rejected|all */
router.get('/deposits.csv', async (req, res) => {
  const status = String(req.query.status || 'all');
  const where: any = {};
  if (status !== 'all') where.status = status;
  const deps = await prisma.deposit.findMany({
    where,
    include: { User: { select: { email: true, firstName: true, lastName: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const rows = deps.map((d) => ({
    id: d.id,
    createdAt: d.createdAt.toISOString(),
    userEmail: d.User.email,
    userName: [d.User.firstName, d.User.lastName].filter(Boolean).join(' '),
    userPhone: d.User.phone ?? '',
    amount: Number(d.amount),
    method: d.method,
    utr: d.utr ?? '',
    gatewayRef: d.gatewayRef ?? '',
    status: d.status,
    reviewedAt: d.reviewedAt?.toISOString() ?? '',
    reviewedBy: d.reviewedBy ?? '',
    note: d.note ?? '',
  }));
  const csv = toCsv(rows, [
    'id', 'createdAt', 'userEmail', 'userName', 'userPhone', 'amount', 'method', 'utr', 'gatewayRef',
    'status', 'reviewedAt', 'reviewedBy', 'note',
  ]);
  setCsvHeaders(res, `rupeerise_deposits_${status}_${todayStamp()}.csv`);
  return res.send(csv);
});

/** GET /admin/exports/withdrawals.csv?status=pending|approved|rejected|all */
router.get('/withdrawals.csv', async (req, res) => {
  const status = String(req.query.status || 'all');
  const where: any = {};
  if (status !== 'all') where.status = status;
  const ws = await prisma.withdrawal.findMany({
    where,
    include: { User: { select: { email: true, firstName: true, lastName: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const rows = ws.map((w) => ({
    id: w.id,
    createdAt: w.createdAt.toISOString(),
    userEmail: w.User.email,
    userName: [w.User.firstName, w.User.lastName].filter(Boolean).join(' '),
    userPhone: w.User.phone ?? '',
    amount: Number(w.amount),
    feePercent: w.feePercent,
    netAmount: Number(w.netAmount),
    method: w.method,
    accountJson: w.accountJson,
    status: w.status,
    payoutRef: w.payoutRef ?? '',
  }));
  const csv = toCsv(rows, [
    'id', 'createdAt', 'userEmail', 'userName', 'userPhone',
    'amount', 'feePercent', 'netAmount', 'method', 'accountJson', 'status', 'payoutRef',
  ]);
  setCsvHeaders(res, `rupeerise_withdrawals_${status}_${todayStamp()}.csv`);
  return res.send(csv);
});

/** GET /admin/exports/investments.csv */
router.get('/investments.csv', async (_req, res) => {
  const invs = await prisma.investment.findMany({
    include: {
      User: { select: { email: true, firstName: true, lastName: true } },
      Plan: { select: { name: true, price: true, dailyIncome: true, durationDays: true } },
    },
    orderBy: { startedAt: 'desc' },
  });
  const rows = invs.map((i) => ({
    id: i.id,
    startedAt: i.startedAt.toISOString(),
    endsAt: i.endsAt.toISOString(),
    userEmail: i.User.email,
    userName: [i.User.firstName, i.User.lastName].filter(Boolean).join(' '),
    plan: i.Plan.name,
    price: i.Plan.price,
    dailyIncome: i.Plan.dailyIncome,
    durationDays: i.Plan.durationDays,
    remainingDays: i.remainingDays,
    status: i.status,
  }));
  const csv = toCsv(rows, [
    'id', 'startedAt', 'endsAt', 'userEmail', 'userName',
    'plan', 'price', 'dailyIncome', 'durationDays', 'remainingDays', 'status',
  ]);
  setCsvHeaders(res, `rupeerise_investments_${todayStamp()}.csv`);
  return res.send(csv);
});

export default router;
