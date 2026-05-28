import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { issueOtp, verifyOtp } from '../lib/otp';
import { prisma } from '../lib/prisma';
import { signJwt } from '../lib/jwt';
import { ensureWallets } from '../lib/wallet';
import { sendMail, otpEmail } from '../lib/mail';
import { env } from '../lib/env';
import { attachReferralEdges } from '../lib/referrals';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { readRegistrationBonus } from './adminSettings';
import { postLedger } from '../lib/wallet';

const router = Router();

function genReferralCode() {
  return `RR${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/**
 * Password policy: 6–72 chars (bcrypt's hard limit). Frontend additionally
 * encourages a mix of letters + numbers, but we keep server-side rules
 * minimal so legitimate users on shared/public devices aren't locked out.
 */
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 72;

function validatePassword(p: string): string | null {
  if (typeof p !== 'string') return 'Password is required';
  if (p.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters`;
  if (p.length > PASSWORD_MAX) return `Password is too long (max ${PASSWORD_MAX})`;
  return null;
}

async function bumpLogin(userId: string, req: any) {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || undefined;
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date(), lastIp: ip ?? undefined } });
}

function publicUser(u: any) {
  return {
    id: u.id,
    email: u.email,
    phone: u.phone,
    firstName: u.firstName,
    lastName: u.lastName,
    name: u.name,
    role: u.role,
    referralCode: u.referralCode,
    hasPassword: !!u.passwordHash,
  };
}

router.post('/request-otp', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Invalid email' });

  const code = issueOtp(email);
  // Always log in dev for easy local testing
  console.log(`[DEV] OTP for ${email}: ${code}`);

  // In dev mode (no SMTP configured), echo the OTP back so the UI can show it.
  // This is GATED — once SMTP_HOST or RESEND_API_KEY is set, this is omitted.
  const isDevPreview = env.NODE_ENV !== 'production' && !env.SMTP_HOST && !env.RESEND_API_KEY;

  // Fire-and-forget mail delivery. Awaiting it on serverless platforms with
  // a cold mail provider can keep the HTTP socket open for 10+ seconds, which
  // makes the user think "OTP nahi aaya" — they hit the button again, get
  // rate-limited, and lose trust. Returning immediately makes the UX snappy;
  // the actual mail still goes out in the background, and any failure is
  // logged loudly server-side for ops debugging.
  const { text, html } = otpEmail(code);
  void (async () => {
    try {
      const r = await sendMail({ to: email, subject: `RupeeRise login code: ${code}`, text, html });
      console.log(`[mail/otp] async delivery to=${email} delivered=${r.delivered}`);
    } catch (e) {
      console.error('[mail/otp] async send failed:', e);
    }
  })();

  // We optimistically report delivered:true when ANY mail provider is
  // configured. The frontend can show "check your inbox / spam" — if there
  // really was a transport failure, the user retries via the resend button.
  const mailConfigured = !!env.RESEND_API_KEY || (!!env.SMTP_HOST && !!env.SMTP_USER && !!env.SMTP_PASS);
  return res.json({
    success: true,
    delivered: mailConfigured,
    ...(isDevPreview ? { devOtp: code } : {}),
  });
});

/**
 * POST /auth/verify-otp
 *
 * LEGACY auth path. In the new flow:
 *   - New signups go through POST /auth/register (email + password + OTP).
 *   - Returning users with a password go through POST /auth/login.
 *
 * This endpoint is now only used as a one-time migration door for users that
 * already exist from the old OTP-only days but never set a password. They
 * verify their OTP, get a JWT, and the response carries `requiresPasswordSetup
 * = true` so the frontend forces them to /set-password before continuing.
 *
 * For totally new accounts coming through this endpoint we still create the
 * user (so deep-links like referral signups don't break), but we also flag
 * `requiresPasswordSetup = true` so they're sent to set a password.
 */
router.post('/verify-otp', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || '').trim();
  const ref = req.body?.referralCode ? String(req.body.referralCode).trim().toUpperCase() : undefined;
  const phone = req.body?.phone ? String(req.body.phone).replace(/\D/g, '') : undefined;
  const firstName = req.body?.firstName ? String(req.body.firstName).trim().slice(0, 40) : undefined;
  const lastName = req.body?.lastName ? String(req.body.lastName).trim().slice(0, 40) : undefined;

  if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Invalid input' });
  if (!verifyOtp(email, code)) return res.status(401).json({ error: 'Invalid or expired OTP' });

  try {
    let user = await prisma.user.findUnique({ where: { email } });
    const isNewAccount = !user;

    if (!user) {
      // optional referral lookup (case-insensitive)
      let referredById: string | undefined;
      if (ref) {
        const refUser = await prisma.user.findFirst({ where: { referralCode: ref } });
        if (refUser) referredById = refUser.id;
      }
      // generate unique referralCode (retry on collision)
      let genCode = genReferralCode();
      for (let i = 0; i < 4; i++) {
        const exists = await prisma.user.findUnique({ where: { referralCode: genCode } });
        if (!exists) break;
        genCode = genReferralCode();
      }
      const combinedName = [firstName, lastName].filter(Boolean).join(' ').trim() || undefined;
      user = await prisma.user.create({
        data: {
          email,
          phone: phone || undefined,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          name: combinedName,
          referralCode: genCode,
          referredById,
        },
      });
      await ensureWallets(user.id);
      if (referredById) {
        try { await attachReferralEdges({ childId: user.id, directParentId: referredById }); } catch (e) { console.error('attachReferralEdges failed', e); }
      }
    } else {
      // Block users that already have a password from using OTP login.
      // They must use /auth/login or /auth/forgot-password instead.
      if (user.passwordHash) {
        return res.status(409).json({
          error: 'This account already has a password. Use email + password to sign in, or use Forgot Password.',
          code: 'PASSWORD_LOGIN_REQUIRED',
        });
      }
      const patch: any = {};
      if (firstName && !user.firstName) patch.firstName = firstName;
      if (lastName && !user.lastName) patch.lastName = lastName;
      if (phone && !user.phone) patch.phone = phone;
      if ((firstName || lastName) && !user.name) {
        const combined = [firstName || user.firstName, lastName || user.lastName].filter(Boolean).join(' ').trim();
        if (combined) patch.name = combined;
      }
      if (Object.keys(patch).length) {
        user = await prisma.user.update({ where: { id: user.id }, data: patch });
      }
    }

    if ((user as any).status === 'blocked') {
      return res.status(403).json({ error: 'Account blocked. Contact support.' });
    }

    await bumpLogin(user.id, req);

    const admins = env.ADMIN_EMAILS.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const shouldBeAdmin = admins.includes(email);
    if (shouldBeAdmin && user.role !== 'admin') {
      user = await prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } });
    }

    const token = signJwt({ sub: user.id, role: user.role as any });
    return res.json({
      token,
      isNewAccount,
      requiresPasswordSetup: !user.passwordHash,
      user: publicUser(user),
    });
  } catch (e: any) {
    console.error(e);
    return res.status(503).json({ error: 'Database unavailable. Set DATABASE_URL and run migrations.' });
  }
});

/**
 * POST /auth/register
 *
 * Full first-time signup: email + password + OTP code (+ optional referral).
 * The OTP is the same one issued by /auth/request-otp. Combining password +
 * OTP in a single endpoint means a new user reaches the dashboard with their
 * password already set — no "set password later" step needed.
 *
 * If the email already exists, we 409 — the user should /auth/login instead.
 */
router.post('/register', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || '').trim();
  const password = String(req.body?.password || '');
  const ref = req.body?.referralCode ? String(req.body.referralCode).trim().toUpperCase() : undefined;
  const phone = req.body?.phone ? String(req.body.phone).replace(/\D/g, '') : undefined;
  const firstName = req.body?.firstName ? String(req.body.firstName).trim().slice(0, 40) : undefined;
  const lastName = req.body?.lastName ? String(req.body.lastName).trim().slice(0, 40) : undefined;

  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Invalid email' });
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Invalid OTP — request a new one' });
  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });
  if (!verifyOtp(email, code)) return res.status(401).json({ error: 'Invalid or expired OTP' });

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({
        error: 'An account with this email already exists. Please sign in instead.',
        code: 'EMAIL_EXISTS',
      });
    }

    let referredById: string | undefined;
    if (ref) {
      const refUser = await prisma.user.findFirst({ where: { referralCode: ref } });
      if (refUser) referredById = refUser.id;
    }

    let genCode = genReferralCode();
    for (let i = 0; i < 4; i++) {
      const exists = await prisma.user.findUnique({ where: { referralCode: genCode } });
      if (!exists) break;
      genCode = genReferralCode();
    }

    const combinedName = [firstName, lastName].filter(Boolean).join(' ').trim() || undefined;
    const passwordHash = await bcrypt.hash(password, 10);

    let user = await prisma.user.create({
      data: {
        email,
        phone: phone || undefined,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        name: combinedName,
        passwordHash,
        referralCode: genCode,
        referredById,
      },
    });
    await ensureWallets(user.id);
    if (referredById) {
      try { await attachReferralEdges({ childId: user.id, directParentId: referredById }); } catch (e) { console.error('attachReferralEdges failed', e); }
    }

    // Welcome bonus — credited once per email at registration. The
    // idempotency key (`signup-bonus:<userId>`) means the bonus can never be
    // double-credited even if a registration request is replayed. Existing
    // users that come in via legacy /verify-otp do NOT trigger this path, so
    // each Gmail can claim the bonus exactly once across the platform.
    try {
      const bonus = await readRegistrationBonus();
      if (bonus.enabled && bonus.amount > 0) {
        await postLedger({
          userId: user.id,
          walletType: 'bonus',
          amount: bonus.amount,
          direction: 'credit',
          reason: 'signup_bonus',
          idempotencyKey: `signup-bonus:${user.id}`,
        });
      }
    } catch (e) {
      console.error('signup bonus credit failed', e);
    }

    // Auto-promote to admin if the email is in ADMIN_EMAILS.
    const admins = env.ADMIN_EMAILS.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (admins.includes(email)) {
      user = await prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } });
    }

    await bumpLogin(user.id, req);
    const token = signJwt({ sub: user.id, role: user.role as any });

    // Send welcome notification to user's inbox
    try {
      const displayName = combinedName || firstName || email.split('@')[0] || 'there';
      await prisma.notification.create({
        data: {
          userId: user.id,
          title: `Welcome to RupeeRise, ${displayName}! 🎉`,
          body: `Your account is ready! Deposit funds, buy a plan, and start claiming daily income. Refer friends to earn big commissions!`,
          read: false,
        },
      }).catch(() => {}); // non-fatal
    } catch {}

    return res.json({ token, isNewAccount: true, user: publicUser(user) });
  } catch (e) {
    console.error('register error:', e);
    return res.status(503).json({ error: 'Could not create account right now' });
  }
});

/**
 * POST /auth/login
 *
 * Email + password login for returning users. If the account exists but has
 * no password (legacy OTP-only signup), we 409 with code `OTP_LOGIN_REQUIRED`
 * and the frontend redirects them to the OTP login → set-password flow.
 */
router.post('/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!EMAIL_RE.test(email) || password.length < 1) {
    return res.status(400).json({ error: 'Invalid email or password' });
  }

  try {
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    if (!user.passwordHash) {
      return res.status(409).json({
        error: 'No password set yet. Sign in with the OTP we email you, then set a password.',
        code: 'OTP_LOGIN_REQUIRED',
      });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    if ((user as any).status === 'blocked') {
      return res.status(403).json({ error: 'Account blocked. Contact support.' });
    }

    // Keep admin role in sync with ADMIN_EMAILS env (in case env was edited).
    const admins = env.ADMIN_EMAILS.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (admins.includes(email) && user.role !== 'admin') {
      user = await prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } });
    }

    await bumpLogin(user.id, req);
    const token = signJwt({ sub: user.id, role: user.role as any });
    return res.json({ token, user: publicUser(user) });
  } catch (e) {
    console.error('login error:', e);
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

/**
 * POST /auth/forgot-password
 *
 * Issues an OTP to the email address. We always return 200 even if the email
 * is not registered, to avoid leaking which addresses have accounts.
 */
router.post('/forgot-password', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Invalid email' });

  // Generic success response — never reveal whether the email is registered.
  const respond = (extra: any = {}) =>
    res.json({ success: true, message: 'If an account exists for this email, an OTP has been sent.', ...extra });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Still pretend we sent it — but skip the actual email send.
      return respond();
    }
    const code = issueOtp(email);
    console.log(`[DEV] PASSWORD-RESET OTP for ${email}: ${code}`);

    const subject = `RupeeRise password reset code: ${code}`;
    const text = `Your password reset code is ${code}. It is valid for 5 minutes. If you didn't request this, ignore this email.`;
    const html = `
      <div style="font-family:Inter,system-ui,Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#FFD700;margin:0 0 8px">Password reset</h2>
        <p style="color:#374151;line-height:1.5">Use the code below to reset your RupeeRise password. It is valid for 5 minutes.</p>
        <div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;background:#0F172A;color:#FFD700;padding:18px;border-radius:12px;margin:16px 0">${code}</div>
        <p style="color:#6b7280;font-size:13px">If you didn't request this, please ignore this email.</p>
      </div>`;

    let delivered = false;
    try {
      const r = await sendMail({ to: email, subject, text, html });
      delivered = r.delivered;
    } catch (e) {
      console.error('Mail send failed:', e);
    }
    const isDevPreview = env.NODE_ENV !== 'production' && !env.SMTP_HOST;
    return respond({ delivered, ...(isDevPreview ? { devOtp: code } : {}) });
  } catch (e) {
    console.error('forgot-password error:', e);
    return respond();
  }
});

/**
 * POST /auth/reset-password
 *
 * Verifies the OTP and sets a new password. Returns a fresh JWT so the user
 * is auto-signed-in after a successful reset.
 */
router.post('/reset-password', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const code = String(req.body?.code || '').trim();
  const password = String(req.body?.password || '');

  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Invalid email' });
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Invalid OTP' });
  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });
  if (!verifyOtp(email, code)) return res.status(401).json({ error: 'Invalid or expired OTP' });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'No account found for this email' });
    if ((user as any).status === 'blocked') {
      return res.status(403).json({ error: 'Account blocked. Contact support.' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    await bumpLogin(updated.id, req);
    const token = signJwt({ sub: updated.id, role: updated.role as any });
    return res.json({ token, user: publicUser(updated) });
  } catch (e) {
    console.error('reset-password error:', e);
    return res.status(503).json({ error: 'Could not reset password right now' });
  }
});

/**
 * POST /auth/set-password (auth required)
 *
 * One-time setter for legacy users that signed up via OTP and never had a
 * password. If they already have one, force them through /change-password.
 */
router.post('/set-password', requireAuth, async (req: AuthedRequest, res) => {
  const password = String(req.body?.password || '');
  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.passwordHash) {
      return res.status(409).json({
        error: 'You already have a password. Use Change Password instead.',
        code: 'PASSWORD_ALREADY_SET',
      });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const updated = await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    return res.json({ ok: true, user: publicUser(updated) });
  } catch (e) {
    console.error('set-password error:', e);
    return res.status(503).json({ error: 'Could not save password right now' });
  }
});

/**
 * POST /auth/change-password (auth required)
 *
 * Verifies the current password, then swaps it. This is the standard
 * profile-page flow.
 */
router.post('/change-password', requireAuth, async (req: AuthedRequest, res) => {
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  const pwErr = validatePassword(newPassword);
  if (pwErr) return res.status(400).json({ error: pwErr });

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.passwordHash) {
      return res.status(409).json({ error: 'No password set yet — use Set Password instead.' });
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'New password must be different from the current one' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    return res.json({ ok: true });
  } catch (e) {
    console.error('change-password error:', e);
    return res.status(503).json({ error: 'Could not update password right now' });
  }
});

/**
 * GET /auth/check?email=
 *
 * Lightweight pre-login probe: tells the frontend whether the email exists
 * AND whether it has a password set. Used by the /login page to route
 * legacy OTP-only users into the right flow.
 *
 * IMPORTANT: To prevent email enumeration, in production we always return
 * `{ exists: true, hasPassword: true }` for any well-formed email. The real
 * answer only flows through in dev so the UI flow is testable locally.
 */
router.get('/check', async (req, res) => {
  const email = String(req.query?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Invalid email' });

  // Anti-enumeration: in production, always say yes.
  if (env.NODE_ENV === 'production') {
    return res.json({ exists: true, hasPassword: true });
  }
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, passwordHash: true } });
    return res.json({ exists: !!user, hasPassword: !!user?.passwordHash });
  } catch (e) {
    return res.json({ exists: true, hasPassword: true });
  }
});

/**
 * POST /auth/admin-login
 * Password-based login for admin users only. The email MUST be in ADMIN_EMAILS
 * and the password MUST match the bcrypt hash stored on the user (set by the
 * admin bootstrap on API boot from `ADMIN_PASSWORD` in .env).
 */
router.post('/admin-login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!EMAIL_RE.test(email) || password.length < 6) {
    return res.status(400).json({ error: 'Invalid email or password' });
  }

  // Strict allowlist — only emails configured in ADMIN_EMAILS can attempt
  // password login at all. Everyone else gets a generic error so we don't
  // leak which addresses are admins.
  const admins = env.ADMIN_EMAILS.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!admins.includes(email)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Admin password not initialised — set ADMIN_PASSWORD in the API .env and restart.' });
    }
    if ((user as any).status === 'blocked') {
      return res.status(403).json({ error: 'Account blocked. Contact support.' });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    // Track last-login + ensure role is admin (in case ADMIN_EMAILS was edited).
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || undefined;
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastIp: ip, role: 'admin' },
    });

    const token = signJwt({ sub: updated.id, role: 'admin' });
    return res.json({ token, user: publicUser(updated) });
  } catch (e) {
    console.error('admin-login error:', e);
    return res.status(503).json({ error: 'Database unavailable' });
  }
});

export default router;
