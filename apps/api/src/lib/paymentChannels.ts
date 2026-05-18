import { prisma } from './prisma';
import { env } from './env';

let seededOnce = false;

/**
 * Make sure at least one PaymentChannel exists, falling back to env.UPI_ID
 * (default "rupeerise@upi"). Idempotent.
 */
export async function ensureChannelsSeeded() {
  if (seededOnce) return;
  try {
    const count = await prisma.paymentChannel.count();
    if (count === 0) {
      await prisma.paymentChannel.create({
        data: {
          kind: 'upi',
          label: 'Primary UPI',
          value: env.UPI_ID || 'rupeerise@upi',
          payeeName: 'RupeeRise',
          isDefault: true,
          active: true,
          sortOrder: 0,
        },
      });
    }
    seededOnce = true;
  } catch {
    /* DB unavailable — let routes return their own fallback */
  }
}

/** Returns the default active channel, or null. */
export async function getDefaultChannel() {
  await ensureChannelsSeeded();
  return prisma.paymentChannel.findFirst({
    where: { active: true, isDefault: true },
    orderBy: { sortOrder: 'asc' },
  }).then((c) =>
    c ?? prisma.paymentChannel.findFirst({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
  );
}

/** All visible (active) channels for the user wallet page. */
export async function listActiveChannels() {
  await ensureChannelsSeeded();
  return prisma.paymentChannel.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
}
