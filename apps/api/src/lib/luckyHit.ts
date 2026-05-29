/**
 * Lucky Hit / Color Prediction game — round scheduling + settlement.
 *
 * Design notes:
 *  - Rounds are aligned to wall-clock minutes in IST so every player sees the
 *    same "Period" code regardless of which API replica answered them.
 *  - Round records are created LAZILY: the first bet/state read inside a slot
 *    upserts the row by `period`. We never run a background scheduler.
 *  - Settlement is also LAZY: any read or write that lands after `endsAt`
 *    walks all expired-but-unsettled rounds, picks a weighted-random result,
 *    transitions to `status='settled'`, and credits winners' earnings wallets
 *    via `postLedger()` inside one Prisma `$transaction` per round.
 *  - The `walletSource` column on `LuckyHitBet` records which wallet was
 *    debited at bet time so future audit/refund logic can trace funds back.
 */

import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { getLuckyHitConfig, type LuckyHitConfig } from './appSettings';
import { postLedger } from './wallet';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Floor the given UTC instant to the start of its 3-min slot (IST aligned). */
function slotStartIST(now: Date, durationSec: number): Date {
  const ms = now.getTime();
  const istMs = ms + IST_OFFSET_MS;
  const slotMs = durationSec * 1000;
  const flooredIst = Math.floor(istMs / slotMs) * slotMs;
  return new Date(flooredIst - IST_OFFSET_MS);
}

/** Format a slot start as "YYYYMMDD-HHMM" using the IST clock face. */
function periodCode(slotStart: Date): string {
  const ist = new Date(slotStart.getTime() + IST_OFFSET_MS);
  const yyyy = ist.getUTCFullYear();
  const mm = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(ist.getUTCDate()).padStart(2, '0');
  const hh = String(ist.getUTCHours()).padStart(2, '0');
  const mi = String(ist.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}`;
}

/** Public-friendly round shape returned by the API. */
export type RoundDTO = {
  id: string;
  period: string;
  startedAt: string;
  endsAt: string;
  status: 'open' | 'locked' | 'settled';
  result: 'red' | 'black' | 'lucky_hit' | null;
  /** Admin-forced result (admin UI only — set on the round before it settles). */
  forcedResult?: 'red' | 'black' | 'lucky_hit' | null;
  redTotal: number;
  blackTotal: number;
  luckyHitTotal: number;
  betCount: number;
  /** ms remaining until the round flips state (lock or settle). */
  msRemaining: number;
};

function toDTO(r: any, now: Date, lockSeconds: number): RoundDTO {
  const endsMs = new Date(r.endsAt).getTime();
  // While "open", the next transition is into "locked" (lockSeconds before end).
  const lockMs = endsMs - lockSeconds * 1000;
  const msRemaining =
    r.status === 'settled'
      ? 0
      : r.status === 'open'
      ? Math.max(0, lockMs - now.getTime())
      : Math.max(0, endsMs - now.getTime());
  return {
    id: r.id,
    period: r.period,
    startedAt: new Date(r.startedAt).toISOString(),
    endsAt: new Date(r.endsAt).toISOString(),
    status: r.status,
    result: r.result ?? null,
    forcedResult: r.forcedResult ?? null,
    redTotal: Number(r.redTotal),
    blackTotal: Number(r.blackTotal),
    luckyHitTotal: Number(r.luckyHitTotal),
    betCount: r.betCount,
    msRemaining,
  };
}

/**
 * Settle one round: pick a weighted-random result, mark every winning bet,
 * credit each winner's earnings wallet. Idempotent — exits early if the
 * round was already settled by a concurrent caller.
 */
async function settleRound(roundId: string, cfg: LuckyHitConfig): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const round = await tx.luckyHitRound.findUnique({ where: { id: roundId } });
    if (!round || round.status === 'settled') return;

    // Admin override wins over RNG. Anything else (null / unknown string) falls
    // back to the weighted random pick so a stale value can't break the game.
    const FORCED = new Set(['red', 'black', 'lucky_hit']);
    const result =
      round.forcedResult && FORCED.has(round.forcedResult)
        ? (round.forcedResult as 'red' | 'black' | 'lucky_hit')
        : pickResult(cfg);
    const settledAt = new Date();
    const colorMul = cfg.colorPayout;
    const luckyMul = cfg.luckyHitPayout;

    // Settle every bet on the round.
    const bets = await tx.luckyHitBet.findMany({ where: { roundId } });
    for (const b of bets) {
      const won = b.side === result;
      const mul = result === 'lucky_hit' ? luckyMul : colorMul;
      const payout = won ? Number(b.amount) * mul : 0;
      await tx.luckyHitBet.update({
        where: { id: b.id },
        data: {
          status: won ? 'won' : 'lost',
          payout,
          settledAt,
        },
      });
      if (won && payout > 0) {
        await postLedger({
          userId: b.userId,
          walletType: 'earnings',
          amount: payout,
          direction: 'credit',
          reason: result === 'lucky_hit' ? 'lucky_hit_win' : 'lucky_hit_color_win',
          refId: round.period,
          // One credit per (bet) — not per (user, round) — so a user betting
          // both colours can only win on the side that matched.
          idempotencyKey: `lucky_hit:win:${b.id}`,
          tx,
        });
      }
    }

    await tx.luckyHitRound.update({
      where: { id: roundId },
      data: { status: 'settled', result, settledAt },
    });
  });
}

/**
 * Pick a weighted-random result. Falls back to 'red' if all weights are zero
 * so the game keeps working even if an admin saves a degenerate config.
 */
function pickResult(cfg: LuckyHitConfig): 'red' | 'black' | 'lucky_hit' {
  const r = Math.max(0, Math.floor(cfg.redWeight));
  const b = Math.max(0, Math.floor(cfg.blackWeight));
  const l = Math.max(0, Math.floor(cfg.luckyHitWeight));
  const total = r + b + l;
  if (total <= 0) return 'red';
  let n = Math.random() * total;
  if ((n -= r) < 0) return 'red';
  if ((n -= b) < 0) return 'black';
  return 'lucky_hit';
}

/**
 * Settle every round whose `endsAt` is in the past and is not yet settled.
 * Run this before any read/write so the state seen by callers is consistent.
 */
export async function settleExpiredRounds(): Promise<number> {
  const cfg = await getLuckyHitConfig();
  const now = new Date();
  const expired = await prisma.luckyHitRound.findMany({
    where: { status: { not: 'settled' }, endsAt: { lte: now } },
    select: { id: true },
    orderBy: { startedAt: 'asc' },
    take: 50, // batch — protects against an unbounded backlog after long DB outages
  });
  for (const r of expired) {
    try {
      await settleRound(r.id, cfg);
    } catch (e) {
      console.error('[lucky-hit] settle failed', r.id, (e as Error).message);
    }
  }
  return expired.length;
}

/**
 * Return the round currently in progress for `now`, creating it if missing.
 * Also flips an "open" round into "locked" when we cross into the lock window
 * so subsequent bets are rejected without an extra DB roundtrip.
 */
export async function getOrCreateCurrentRound(): Promise<{
  round: RoundDTO;
  cfg: LuckyHitConfig;
}> {
  const cfg = await getLuckyHitConfig();
  const now = new Date();
  const startedAt = slotStartIST(now, cfg.roundDurationSec);
  const endsAt = new Date(startedAt.getTime() + cfg.roundDurationSec * 1000);
  const period = periodCode(startedAt);

  // Idempotent create — concurrent requests within the same slot all converge.
  const round = await prisma.luckyHitRound.upsert({
    where: { period },
    create: { period, startedAt, endsAt, status: 'open' },
    update: {},
  });

  // Promote open → locked once we're inside the lock window.
  const lockAt = endsAt.getTime() - cfg.lockSeconds * 1000;
  let current = round;
  if (current.status === 'open' && now.getTime() >= lockAt) {
    current = await prisma.luckyHitRound.update({
      where: { id: current.id },
      data: { status: 'locked' },
    });
  }

  return { round: toDTO(current, now, cfg.lockSeconds), cfg };
}

/**
 * Return the most recent N settled rounds (newest first) — feeds the
 * red/black history dot strip on the user page.
 */
export async function recentSettledRounds(take = 30): Promise<RoundDTO[]> {
  const rows = await prisma.luckyHitRound.findMany({
    where: { status: 'settled' },
    orderBy: { startedAt: 'desc' },
    take,
  });
  const cfg = await getLuckyHitConfig();
  const now = new Date();
  return rows.map((r) => toDTO(r, now, cfg.lockSeconds));
}

/**
 * Atomically debit the bet amount from the user's deposit wallet first, then
 * fall back to the bonus wallet for any shortfall. Returns which wallet
 * absorbed the bet so the bet row can record its source. Throws when the
 * combined balance is insufficient — caller surfaces that as a 400.
 */
export async function debitBetAcrossWallets(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
  refId: string,
  betId: string
): Promise<'deposit' | 'bonus' | 'split'> {
  const [deposit, bonus] = await Promise.all([
    tx.wallet.findUnique({ where: { userId_type: { userId, type: 'deposit' } } }),
    tx.wallet.findUnique({ where: { userId_type: { userId, type: 'bonus' } } }),
  ]);
  const depositBal = deposit ? Number(deposit.balance) : 0;
  const bonusBal = bonus ? Number(bonus.balance) : 0;
  if (depositBal + bonusBal < amount) {
    throw new Error('Insufficient deposit + bonus balance');
  }

  if (depositBal >= amount) {
    await postLedger({
      userId,
      walletType: 'deposit',
      amount,
      direction: 'debit',
      reason: 'lucky_hit_bet',
      refId,
      idempotencyKey: `lucky_hit:bet:${betId}:deposit`,
      tx,
    });
    return 'deposit';
  }

  if (depositBal === 0) {
    await postLedger({
      userId,
      walletType: 'bonus',
      amount,
      direction: 'debit',
      reason: 'lucky_hit_bet',
      refId,
      idempotencyKey: `lucky_hit:bet:${betId}:bonus`,
      tx,
    });
    return 'bonus';
  }

  // Partial split — drain deposit, take the remainder from bonus.
  if (depositBal > 0) {
    await postLedger({
      userId,
      walletType: 'deposit',
      amount: depositBal,
      direction: 'debit',
      reason: 'lucky_hit_bet',
      refId,
      idempotencyKey: `lucky_hit:bet:${betId}:deposit`,
      tx,
    });
  }
  const remainder = amount - depositBal;
  await postLedger({
    userId,
    walletType: 'bonus',
    amount: remainder,
    direction: 'debit',
    reason: 'lucky_hit_bet',
    refId,
    idempotencyKey: `lucky_hit:bet:${betId}:bonus`,
    tx,
  });
  return 'split';
}

export { toDTO as roundToDTO };
