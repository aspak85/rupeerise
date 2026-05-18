import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { getRewardConfig, setRewardConfig, RewardConfig, DEFAULT_REWARD_CONFIG } from '../lib/appSettings';

const router = Router();
router.use(requireAuth, requireAdmin);

/** GET /admin/rewards/config — current reward config (returns defaults if unset) */
router.get('/config', async (_req, res) => {
  const cfg = await getRewardConfig();
  return res.json(cfg);
});

/** PUT /admin/rewards/config — replace reward config */
router.put('/config', async (req, res) => {
  const body = req.body ?? {};
  // Validation: keep it strict so a bad admin save doesn't crash users.
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Body must be a reward config object' });
  }

  const spinPrizes = Array.isArray(body?.spin?.prizes) ? body.spin.prizes.map((n: any) => Math.floor(Number(n))) : null;
  if (!spinPrizes || spinPrizes.length < 2 || spinPrizes.length > 16) {
    return res.status(400).json({ error: 'spin.prizes must be a 2–16 element number array' });
  }
  if (spinPrizes.some((n: number) => !Number.isFinite(n) || n < 0)) {
    return res.status(400).json({ error: 'spin.prizes must be non-negative integers' });
  }

  const scratchTable = Array.isArray(body?.scratch?.table) ? body.scratch.table : null;
  if (!scratchTable || scratchTable.length < 1 || scratchTable.length > 20) {
    return res.status(400).json({ error: 'scratch.table must be a 1–20 element array' });
  }
  for (const row of scratchTable) {
    const a = Math.floor(Number(row?.amount));
    const w = Math.floor(Number(row?.weight));
    if (!Number.isFinite(a) || a < 0) return res.status(400).json({ error: 'Each scratch row needs a non-negative amount' });
    if (!Number.isFinite(w) || w < 1) return res.status(400).json({ error: 'Each scratch row needs weight >= 1' });
  }

  const cfg: RewardConfig = {
    spin: {
      enabled: body?.spin?.enabled !== false,
      prizes: spinPrizes,
      weights: Array.isArray(body?.spin?.weights) && body.spin.weights.length === spinPrizes.length
        ? body.spin.weights.map((n: any) => Math.max(1, Math.floor(Number(n))))
        : undefined,
    },
    scratch: {
      enabled: body?.scratch?.enabled !== false,
      table: scratchTable.map((r: any) => ({
        amount: Math.floor(Number(r.amount)),
        weight: Math.max(1, Math.floor(Number(r.weight))),
      })),
    },
  };

  await setRewardConfig(cfg);
  return res.json({ ok: true, config: cfg });
});

/** POST /admin/rewards/reset — restore the built-in defaults */
router.post('/reset', async (_req, res) => {
  await setRewardConfig(DEFAULT_REWARD_CONFIG);
  return res.json({ ok: true, config: DEFAULT_REWARD_CONFIG });
});

export default router;
