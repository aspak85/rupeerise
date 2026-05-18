import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import {
  getSupportConfig,
  setSupportConfig,
  SupportConfig,
  DEFAULT_SUPPORT_CONFIG,
} from '../lib/appSettings';

const router = Router();
router.use(requireAuth, requireAdmin);

const URL_RE = /^(https?:|mailto:|tel:|t\.me\/|wa\.me\/|whatsapp:)/i;

function sanitizeStr(v: any, max = 200) {
  return v === undefined || v === null ? '' : String(v).slice(0, max).trim();
}

/** GET /admin/support/config — current support config (returns defaults if unset) */
router.get('/config', async (_req, res) => {
  const cfg = await getSupportConfig();
  return res.json(cfg);
});

/** PUT /admin/support/config — replace support config */
router.put('/config', async (req, res) => {
  const body = req.body ?? {};
  const contactsIn = Array.isArray(body?.contacts) ? body.contacts : [];
  const channelsIn = Array.isArray(body?.channels) ? body.channels : [];

  if (contactsIn.length > 10) return res.status(400).json({ error: 'Max 10 contacts' });
  if (channelsIn.length > 10) return res.status(400).json({ error: 'Max 10 channels' });

  const cfg: SupportConfig = {
    contacts: contactsIn.map((c: any) => ({
      kind: ['telegram', 'whatsapp', 'email', 'phone', 'other'].includes(String(c?.kind))
        ? String(c.kind)
        : 'other',
      label: sanitizeStr(c?.label, 60) || 'Contact',
      handle: sanitizeStr(c?.handle, 60) || undefined,
      url: sanitizeStr(c?.url, 300),
      note: sanitizeStr(c?.note, 200) || undefined,
    })).filter((c: any) => !!c.url),
    channels: channelsIn.map((c: any) => ({
      label: sanitizeStr(c?.label, 60) || 'Channel',
      url: sanitizeStr(c?.url, 300),
      icon: sanitizeStr(c?.icon, 30) || undefined,
      note: sanitizeStr(c?.note, 200) || undefined,
    })).filter((c: any) => !!c.url),
  };

  // Soft URL validation — at least look like a URL or known scheme.
  const allValid = [...cfg.contacts, ...cfg.channels].every((x) => URL_RE.test(x.url));
  if (!allValid) {
    return res.status(400).json({ error: 'All URLs must start with http(s)://, mailto:, tel:, t.me/, or wa.me/' });
  }

  await setSupportConfig(cfg);
  return res.json({ ok: true, config: cfg });
});

/** POST /admin/support/reset — restore default support config */
router.post('/reset', async (_req, res) => {
  await setSupportConfig(DEFAULT_SUPPORT_CONFIG);
  return res.json({ ok: true, config: DEFAULT_SUPPORT_CONFIG });
});

export default router;
