import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

/**
 * GET /me/statement
 * Aggregate the user's full activity (deposits, withdrawals, ledger txns, investments,
 * daily claims, rewards) into one chronological statement for the user dashboard
 * and PDF/CSV exports.
 *
 * Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD&type=deposit|withdrawal|earnings|all
 */
router.get('/', async (req: AuthedRequest, res) => {
  const userId = req.user!.sub;
  const fromStr = String(req.query.from || '').trim();
  const toStr = String(req.query.to || '').trim();
  const type = String(req.query.type || 'all');

  const from = fromStr ? new Date(fromStr) : undefined;
  const to = toStr ? new Date(toStr + 'T23:59:59') : undefined;
  const dateRange: any = {};
  if (from && !Number.isNaN(from.getTime())) dateRange.gte = from;
  if (to && !Number.isNaN(to.getTime())) dateRange.lte = to;
  const dateFilter = Object.keys(dateRange).length ? { createdAt: dateRange } : {};

  try {
    const [deposits, withdrawals, transactions, investments, dailyClaims, dailyRewards, wallets, plansList] = await Promise.all([
      prisma.deposit.findMany({ where: { userId, ...dateFilter }, orderBy: { createdAt: 'desc' } }),
      prisma.withdrawal.findMany({ where: { userId, ...dateFilter }, orderBy: { createdAt: 'desc' } }),
      prisma.transaction.findMany({ where: { userId, ...dateFilter }, orderBy: { createdAt: 'desc' }, take: 500 }),
      prisma.investment.findMany({ where: { userId, ...(from || to ? { startedAt: dateRange } : {}) }, orderBy: { startedAt: 'desc' } }),
      prisma.dailyClaim.findMany({ where: { userId, ...(from || to ? { claimedAt: dateRange } : {}) }, orderBy: { claimedAt: 'desc' }, take: 200 }),
      prisma.dailyReward.findMany({ where: { userId, ...dateFilter }, orderBy: { createdAt: 'desc' }, take: 200 }),
      prisma.wallet.findMany({ where: { userId } }),
      prisma.plan.findMany(),
    ]);

    const planById = new Map(plansList.map((p) => [p.id, p]));

    // Build a unified chronological event list
    type Event = {
      kind: 'deposit' | 'withdrawal' | 'investment' | 'claim' | 'spin' | 'scratch' | 'ledger';
      id: string;
      at: string;
      title: string;
      amount: number;
      direction: 'credit' | 'debit' | 'info';
      status?: string;
      ref?: string | null;
      details?: any;
    };
    const events: Event[] = [];

    for (const d of deposits) {
      events.push({
        kind: 'deposit', id: d.id, at: d.createdAt.toISOString(),
        title: `Deposit via ${d.method.replace('_', ' ')}`,
        amount: Number(d.amount),
        direction: d.status === 'approved' ? 'credit' : 'info',
        status: d.status,
        ref: d.utr || d.gatewayRef || null,
        details: { method: d.method, note: d.note },
      });
    }
    for (const w of withdrawals) {
      events.push({
        kind: 'withdrawal', id: w.id, at: w.createdAt.toISOString(),
        title: `Withdrawal · ${w.method}`,
        amount: Number(w.amount),
        direction: w.status === 'approved' ? 'debit' : 'info',
        status: w.status,
        ref: w.payoutRef || null,
        details: { feePercent: w.feePercent, netAmount: Number(w.netAmount) },
      });
    }
    for (const inv of investments) {
      const plan = planById.get(inv.planId);
      events.push({
        kind: 'investment', id: inv.id, at: inv.startedAt.toISOString(),
        title: `Plan purchased · ${plan?.name ?? inv.planId}`,
        amount: plan ? Number(plan.price) : 0,
        direction: 'debit',
        status: inv.status,
        details: { dailyIncome: plan?.dailyIncome, durationDays: plan?.durationDays, remainingDays: inv.remainingDays },
      });
    }
    for (const c of dailyClaims) {
      events.push({
        kind: 'claim', id: c.id, at: c.claimedAt.toISOString(),
        title: 'Daily claim', amount: Number(c.amount), direction: 'credit',
      });
    }
    for (const r of dailyRewards) {
      events.push({
        kind: r.type as 'spin' | 'scratch', id: r.id, at: r.createdAt.toISOString(),
        title: r.type === 'spin' ? 'Daily Spin reward' : 'Scratch card reward',
        amount: Number(r.amount), direction: 'credit',
      });
    }
    for (const t of transactions) {
      // Most ledger entries are already represented by their parent (deposit/withdrawal/etc.)
      // Only surface ledger-only events that don't have a parent — referrals, manual adjustments, etc.
      const surfaced = ['ref:l1', 'ref:l2', 'ref:l3', 'ref:firstplan', 'admin:adjust', 'bonus'].some((p) => t.reason.startsWith(p));
      if (!surfaced) continue;
      events.push({
        kind: 'ledger', id: t.id, at: t.createdAt.toISOString(),
        title: humanizeReason(t.reason),
        amount: Number(t.amount),
        direction: t.direction === 'credit' ? 'credit' : 'debit',
        details: { walletType: t.walletType, reason: t.reason, refId: t.refId },
      });
    }

    events.sort((a, b) => (a.at < b.at ? 1 : -1));

    // Summary tallies
    const sum = (arr: number[]) => arr.reduce((s, n) => s + n, 0);
    const summary = {
      totalDepositsApproved: sum(deposits.filter((d) => d.status === 'approved').map((d) => Number(d.amount))),
      totalWithdrawalsApproved: sum(withdrawals.filter((w) => w.status === 'approved').map((w) => Number(w.netAmount))),
      totalInvested: sum(investments.map((i) => Number(planById.get(i.planId)?.price ?? 0))),
      totalEarnings: sum(dailyClaims.map((c) => Number(c.amount))) + sum(dailyRewards.map((r) => Number(r.amount))),
      pendingDeposits: deposits.filter((d) => d.status === 'pending').length,
      pendingWithdrawals: withdrawals.filter((w) => w.status === 'pending').length,
    };

    const wallet: Record<string, number> = {};
    for (const w of wallets) wallet[w.type] = Number(w.balance);

    const filtered = type === 'all' ? events : events.filter((e) => {
      if (type === 'deposit') return e.kind === 'deposit';
      if (type === 'withdrawal') return e.kind === 'withdrawal';
      if (type === 'earnings') return ['claim', 'spin', 'scratch', 'ledger'].includes(e.kind);
      return true;
    });

    return res.json({
      summary,
      wallets: wallet,
      events: filtered,
      total: filtered.length,
    });
  } catch (e) {
    console.error(e);
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

function humanizeReason(r: string) {
  const map: Record<string, string> = {
    'ref:firstplan': 'First-plan referral bonus',
    'ref:l1': 'Level-1 referral commission',
    'ref:l2': 'Level-2 referral commission',
    'ref:l3': 'Level-3 referral commission',
    'admin:adjust': 'Manual adjustment by admin',
    bonus: 'Bonus credit',
  };
  for (const k of Object.keys(map)) if (r.startsWith(k)) return map[k];
  return r;
}

export default router;
