import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from './prisma';

export type WalletType = 'deposit' | 'earnings' | 'bonus' | 'referral' | 'withdrawal';
export const WALLET_TYPES: WalletType[] = ['deposit', 'earnings', 'bonus', 'referral', 'withdrawal'];

export async function ensureWallets(userId: string, tx: Prisma.TransactionClient | PrismaClient = prisma) {
  await Promise.all(
    WALLET_TYPES.map((type) =>
      tx.wallet.upsert({
        where: { userId_type: { userId, type } },
        update: {},
        create: { userId, type },
      })
    )
  );
}

export async function getWallets(userId: string) {
  await ensureWallets(userId);
  return prisma.wallet.findMany({ where: { userId } });
}

/**
 * Atomic credit/debit with idempotency. Throws if debit would go negative.
 * Returns the resulting wallet row.
 */
export async function postLedger(opts: {
  userId: string;
  walletType: WalletType;
  amount: number; // positive number; direction decides sign
  direction: 'credit' | 'debit';
  reason: string;
  refId?: string;
  idempotencyKey?: string;
  tx?: Prisma.TransactionClient;
}) {
  const { userId, walletType, amount, direction, reason, refId, idempotencyKey } = opts;
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid amount');

  const run = async (client: Prisma.TransactionClient) => {
    if (idempotencyKey) {
      const existing = await client.transaction.findUnique({ where: { idempotencyKey } });
      if (existing) {
        const wallet = await client.wallet.findUnique({ where: { userId_type: { userId, type: walletType } } });
        return { wallet, transaction: existing, replayed: true };
      }
    }
    await client.wallet.upsert({
      where: { userId_type: { userId, type: walletType } },
      update: {},
      create: { userId, type: walletType },
    });
    const w = await client.wallet.findUnique({ where: { userId_type: { userId, type: walletType } } });
    if (!w) throw new Error('Wallet missing');
    const current = Number(w.balance);
    const next = direction === 'credit' ? current + amount : current - amount;
    if (next < 0) throw new Error(`Insufficient ${walletType} balance`);
    const wallet = await client.wallet.update({
      where: { userId_type: { userId, type: walletType } },
      data: { balance: next },
    });
    const transaction = await client.transaction.create({
      data: {
        userId,
        walletType,
        amount,
        direction,
        reason,
        refId,
        idempotencyKey,
      },
    });
    return { wallet, transaction, replayed: false };
  };

  if (opts.tx) return run(opts.tx);
  return prisma.$transaction(run);
}

export async function walletBalance(userId: string, type: WalletType): Promise<number> {
  const w = await prisma.wallet.findUnique({ where: { userId_type: { userId, type } } });
  return w ? Number(w.balance) : 0;
}
