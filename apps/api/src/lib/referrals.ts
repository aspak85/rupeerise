import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { postLedger } from './wallet';

export const FIRST_PLAN_BONUS_PCT = 45; // referrer gets 45% of first plan amount
export const LEVEL_PCT: Record<number, number> = { 1: 10, 2: 5, 3: 2 };

/**
 * Bigger plan = bigger referral kick. Returns multipliers applied on top of LEVEL_PCT.
 * Encourages users to bring high-ticket invitees.
 * Threshold is `plan price`.
 */
export function tierMultiplier(planAmount: number): number {
  if (planAmount >= 100000) return 1.6;   // Emperor   → +60%
  if (planAmount >= 50000)  return 1.4;   // Tycoon    → +40%
  if (planAmount >= 25000)  return 1.25;  // Elite Pro → +25%
  if (planAmount >= 10000)  return 1.1;   // VIP Elite → +10%
  return 1.0;
}

/**
 * On user registration with a referrer, materialize multi-level referral edges (up to 3).
 */
export async function attachReferralEdges(opts: { childId: string; directParentId: string; tx?: Prisma.TransactionClient }) {
  const client = opts.tx ?? prisma;
  // Walk up the chain to compute L1/L2/L3 ancestors.
  const ancestors: { parentId: string; level: number }[] = [];
  let currentParent: string | null = opts.directParentId;
  let level = 1;
  while (currentParent && level <= 3) {
    ancestors.push({ parentId: currentParent, level });
    const grand: { referredById: string | null } | null = await client.user.findUnique({
      where: { id: currentParent },
      select: { referredById: true },
    });
    currentParent = grand?.referredById ?? null;
    level++;
  }
  for (const a of ancestors) {
    await client.referralEdge.upsert({
      where: { childId: opts.childId },
      update: {},
      create: { childId: opts.childId, parentId: a.parentId, level: a.level },
    });
    // upsert by childId is unique; only the L1 edge is stored. To support multi-level,
    // we model using a materialized table keyed by (childId, level).
    if (a.level > 1) break; // keep db model: childId is unique. We compute deeper levels on the fly.
  }
}

/**
 * Distribute referral commissions on a plan purchase.
 * - First plan: 45% to direct referrer (one-time per child).
 * - Always: L1 10%, L2 5%, L3 2% on deposit/plan amount → referrer wallet.
 */
export async function distributePlanCommissions(opts: {
  buyerId: string;
  amount: number; // plan price in INR
  investmentId: string;
  isFirstPlan: boolean;
  tx?: Prisma.TransactionClient;
}) {
  const client = opts.tx ?? prisma;
  const buyer = await client.user.findUnique({ where: { id: opts.buyerId } });
  if (!buyer || !buyer.referredById) return { distributed: [] as Array<{ to: string; amount: number; level: number; kind: string }> };

  const distributed: Array<{ to: string; amount: number; level: number; kind: string }> = [];

  // Walk up to 3 levels
  const ancestors: { id: string; level: number }[] = [];
  let cur: string | null = buyer.referredById;
  let level = 1;
  while (cur && level <= 3) {
    ancestors.push({ id: cur, level });
    const u: { referredById: string | null } | null = await client.user.findUnique({
      where: { id: cur },
      select: { referredById: true },
    });
    cur = u?.referredById ?? null;
    level++;
  }

  const mult = tierMultiplier(opts.amount);

  // First plan instant bonus to L1
  if (opts.isFirstPlan && ancestors.length > 0) {
    const direct = ancestors[0]!;
    const amt = Math.round((opts.amount * FIRST_PLAN_BONUS_PCT * mult) / 100);
    if (amt > 0) {
      await postLedger({
        userId: direct.id,
        walletType: 'referral',
        amount: amt,
        direction: 'credit',
        reason: `referral:first_plan_bonus${mult > 1 ? `:x${mult}` : ''}`,
        refId: opts.investmentId,
        idempotencyKey: `firstbonus:${opts.investmentId}`,
        tx: opts.tx,
      });
      distributed.push({ to: direct.id, amount: amt, level: 1, kind: 'first_plan_bonus' });
    }
  }

  // Ongoing L1/L2/L3 commissions
  for (const a of ancestors) {
    const pct = LEVEL_PCT[a.level] ?? 0;
    if (pct <= 0) continue;
    const amt = Math.round((opts.amount * pct * mult) / 100);
    if (amt <= 0) continue;
    await postLedger({
      userId: a.id,
      walletType: 'referral',
      amount: amt,
      direction: 'credit',
      reason: `referral:level${a.level}`,
      refId: opts.investmentId,
      idempotencyKey: `lvl${a.level}:${opts.investmentId}`,
      tx: opts.tx,
    });
    distributed.push({ to: a.id, amount: amt, level: a.level, kind: `level${a.level}` });
  }

  return { distributed };
}

/**
 * Build the user's referral tree (up to 3 levels) by walking children.
 */
export async function buildReferralTree(rootId: string) {
  const directs = await prisma.user.findMany({ where: { referredById: rootId }, select: { id: true, phone: true, name: true, createdAt: true } });
  const l1Ids = directs.map((d) => d.id);
  const l2 = l1Ids.length
    ? await prisma.user.findMany({ where: { referredById: { in: l1Ids } }, select: { id: true, phone: true, name: true, createdAt: true, referredById: true } })
    : [];
  const l2Ids = l2.map((d) => d.id);
  const l3 = l2Ids.length
    ? await prisma.user.findMany({ where: { referredById: { in: l2Ids } }, select: { id: true, phone: true, name: true, createdAt: true, referredById: true } })
    : [];
  return {
    level1: directs,
    level2: l2,
    level3: l3,
    counts: { l1: directs.length, l2: l2.length, l3: l3.length },
  };
}
