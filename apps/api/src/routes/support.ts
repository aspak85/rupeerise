import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getSupportConfig } from '../lib/appSettings';

const router = Router();

/**
 * GET /support/config — public (auth-gated to prevent scraping) endpoint that
 * returns the current support contacts + channels for rendering on the user
 * support page. Admin updates via /admin/support/config.
 */
router.get('/config', requireAuth, async (_req, res) => {
  const cfg = await getSupportConfig();
  return res.json(cfg);
});

export default router;
