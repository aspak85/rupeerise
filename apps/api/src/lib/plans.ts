import { prisma } from './prisma';

// Plans tuned so big investors see attractive total-returns and higher daily %.
// Total return ratio increases gently with tier to incentivise larger investments.
//   Starter:    750  / 500   = 1.50x
//   Silver:    4950  / 2000  = 2.48x
//   Gold:     19200  / 5000  = 3.84x
//   VIP Elite 63000  / 10000 = 6.30x
//   Elite Pro 240000 / 25000 = 9.60x  (NEW)
//   Tycoon   600000  / 50000 = 12.0x  (NEW)
//   Emperor 1500000  / 100000= 15.0x  (NEW)
export const DEFAULT_PLANS = [
  { name: 'Starter',    price:    500, dailyIncome:    25, durationDays:  30 },
  { name: 'Silver',     price:   2000, dailyIncome:   110, durationDays:  45 },
  { name: 'Gold',       price:   5000, dailyIncome:   320, durationDays:  60 },
  { name: 'VIP Elite',  price:  10000, dailyIncome:   700, durationDays:  90 },
  { name: 'Elite Pro',  price:  25000, dailyIncome:  2000, durationDays: 120 },
  { name: 'Tycoon',     price:  50000, dailyIncome:  4000, durationDays: 150 },
  { name: 'Emperor',    price: 100000, dailyIncome:  8333, durationDays: 180 },
];

export async function ensurePlansSeeded() {
  // For each known DEFAULT_PLAN, upsert by unique-ish name so adding new tiers
  // on an existing DB doesn't require a manual wipe.
  for (const p of DEFAULT_PLANS) {
    const existing = await prisma.plan.findFirst({ where: { name: p.name } });
    if (existing) {
      // refresh economics but never wipe `active`
      await prisma.plan.update({
        where: { id: existing.id },
        data: { price: p.price, dailyIncome: p.dailyIncome, durationDays: p.durationDays },
      });
    } else {
      await prisma.plan.create({ data: { ...p, active: true } });
    }
  }
}
