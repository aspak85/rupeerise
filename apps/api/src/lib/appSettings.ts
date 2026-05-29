import { prisma } from './prisma';

/**
 * Generic JSON KV store helpers backed by the `AppSetting` Prisma model.
 *
 * Used for admin-configurable runtime settings that don't justify their own
 * dedicated tables — currently:
 *   - "reward_config"  : spin prizes + scratch table + enable flags
 *   - "support_config" : contact links (Telegram bot/agent/admin) + channels
 *
 * Each value is JSON.stringified on write and JSON.parsed on read. A small
 * in-process cache avoids hitting the DB on every request; it is invalidated
 * whenever a key is written through `setSetting()`.
 */

const cache = new Map<string, { value: any; at: number }>();
const TTL_MS = 30_000; // refresh at most every 30s — admin edits invalidate via setSetting

export async function getSetting<T = any>(key: string, fallback: T): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  try {
    const row = await prisma.appSetting.findUnique({ where: { key } });
    if (!row) {
      cache.set(key, { value: fallback, at: Date.now() });
      return fallback;
    }
    const parsed = JSON.parse(row.value);
    cache.set(key, { value: parsed, at: Date.now() });
    return parsed as T;
  } catch (e) {
    // Fall back gracefully if DB is briefly unreachable.
    return fallback;
  }
}

export async function setSetting<T = any>(key: string, value: T): Promise<void> {
  const serialized = JSON.stringify(value);
  await prisma.appSetting.upsert({
    where: { key },
    update: { value: serialized },
    create: { key, value: serialized },
  });
  cache.set(key, { value, at: Date.now() });
}

export function invalidateSetting(key: string) {
  cache.delete(key);
}

/* ────────────────────────── Reward Config ────────────────────────── */

export type RewardConfig = {
  spin: {
    enabled: boolean;
    /** Prize amounts shown on the wheel, in order (8 segments by default). */
    prizes: number[];
    /** Optional weights matching `prizes` length. If absent, equal weight. */
    weights?: number[];
  };
  scratch: {
    enabled: boolean;
    table: { amount: number; weight: number }[];
  };
};

export const DEFAULT_REWARD_CONFIG: RewardConfig = {
  spin: {
    enabled: true,
    prizes: [5, 10, 15, 20, 25, 35, 50, 100],
  },
  scratch: {
    enabled: true,
    table: [
      { amount: 2, weight: 35 },
      { amount: 5, weight: 30 },
      { amount: 10, weight: 20 },
      { amount: 25, weight: 10 },
      { amount: 75, weight: 4 },
      { amount: 200, weight: 1 },
    ],
  },
};

export const getRewardConfig = () =>
  getSetting<RewardConfig>('reward_config', DEFAULT_REWARD_CONFIG);
export const setRewardConfig = (cfg: RewardConfig) =>
  setSetting('reward_config', cfg);

/* ────────────────────────── Support Config ─────────────────────────
 *
 * `contacts` are 1-1 chat links (Telegram username, WhatsApp, email) that
 * users use to reach an actual human.
 *
 * `channels` are broadcast channels (Telegram channel, WhatsApp channel,
 * YouTube, Twitter/X, etc.) that users follow for announcements.
 * ─────────────────────────────────────────────────────────────────── */

export type SupportContact = {
  /** "telegram" | "whatsapp" | "email" | "phone" | "other" */
  kind: string;
  /** Display label, e.g. "Telegram Bot" or "Customer Agent" */
  label: string;
  /** Optional handle/username for display ("@rupeerise_support") */
  handle?: string;
  /** Click-through URL: t.me/..., wa.me/..., mailto:..., tel:... */
  url: string;
  /** Optional one-line note ("Online 9am–11pm IST") */
  note?: string;
};

export type SupportChannel = {
  label: string;
  url: string;
  /** lucide icon name string — frontend resolves at runtime */
  icon?: string;
  note?: string;
};

export type SupportConfig = {
  contacts: SupportContact[];
  channels: SupportChannel[];
};

export const DEFAULT_SUPPORT_CONFIG: SupportConfig = {
  contacts: [
    {
      kind: 'telegram',
      label: 'Telegram Support Bot',
      handle: '@rupeerise_support',
      url: 'https://t.me/rupeerise_support',
      note: 'Instant replies 24/7',
    },
    {
      kind: 'telegram',
      label: 'Customer Agent',
      handle: '@rupeerise_agent',
      url: 'https://t.me/rupeerise_agent',
      note: 'For deposit / withdrawal issues',
    },
    {
      kind: 'telegram',
      label: 'Admin',
      handle: '@rupeerise_admin',
      url: 'https://t.me/rupeerise_admin',
      note: 'For escalations & partnerships',
    },
  ],
  channels: [
    {
      label: 'RupeeRise Official Channel',
      url: 'https://t.me/rupeerise_official',
      icon: 'send',
      note: 'Daily announcements & gift codes',
    },
  ],
};

export const getSupportConfig = () =>
  getSetting<SupportConfig>('support_config', DEFAULT_SUPPORT_CONFIG);
export const setSupportConfig = (cfg: SupportConfig) =>
  setSetting('support_config', cfg);


/* ────────────────────────── Lucky Hit Config ─────────────────────────
 *
 * Knobs for the /lucky-hit colour-prediction game. All amounts are INR.
 *
 *   enabled            — show the page + accept bets at all
 *   minBet / maxBet    — per-bet bounds enforced server-side
 *   roundDurationSec   — slot length (default 180s = 3 min)
 *   lockSeconds        — final window where bets are frozen ("locked" state)
 *   colorPayout        — multiplier for red/black wins (default 1.9×)
 *   luckyHitPayout     — multiplier for lucky-hit wins (default 9×)
 *   redWeight / blackWeight / luckyHitWeight — RNG weights for the result.
 *     The three weights are normalised (any non-negative integers work).
 *     Defaults bias toward an honest split between the two colours plus a
 *     small lucky-hit chance: red 47, black 47, lucky_hit 6 (≈ 6%).
 *
 * Keep this admin-tunable so payouts and house edge can be adjusted without
 * a redeploy. Cached for 30s in-process; admin save invalidates immediately.
 * ─────────────────────────────────────────────────────────────────── */

export type LuckyHitConfig = {
  enabled: boolean;
  minBet: number;
  maxBet: number;
  roundDurationSec: number;
  lockSeconds: number;
  colorPayout: number;
  luckyHitPayout: number;
  redWeight: number;
  blackWeight: number;
  luckyHitWeight: number;
};

export const DEFAULT_LUCKY_HIT_CONFIG: LuckyHitConfig = {
  enabled: true,
  minBet: 10,
  maxBet: 5000,
  roundDurationSec: 180,
  lockSeconds: 30,
  colorPayout: 1.9,
  luckyHitPayout: 9,
  redWeight: 47,
  blackWeight: 47,
  luckyHitWeight: 6,
};

export const getLuckyHitConfig = () =>
  getSetting<LuckyHitConfig>('lucky_hit_config', DEFAULT_LUCKY_HIT_CONFIG);
export const setLuckyHitConfig = (cfg: LuckyHitConfig) =>
  setSetting('lucky_hit_config', cfg);
