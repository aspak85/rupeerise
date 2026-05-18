import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { env } from './env';
import { ensureWallets } from './wallet';

/**
 * Bootstrap admin accounts from environment variables.
 *
 * Runs once on API boot. For every email in `ADMIN_EMAILS`:
 *   - creates the user with role="admin" if missing,
 *   - hashes `ADMIN_PASSWORD` (bcrypt) and saves it as `passwordHash`,
 *   - ensures wallets are provisioned.
 *
 * Rotating the password is as simple as changing `ADMIN_PASSWORD` in .env
 * and restarting the API — the new hash overwrites the old one.
 *
 * This is idempotent: re-running with the same password is a no-op (we skip
 * the hash compute & write).
 */
function genReferralCode() {
  return `RR${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function ensureAdminBootstrap(): Promise<void> {
  const emails = env.ADMIN_EMAILS.split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) return;
  const password = env.ADMIN_PASSWORD;
  if (!password) {
    console.warn('[admin-bootstrap] ADMIN_PASSWORD is empty — password login disabled. Set it in .env to enable.');
    return;
  }

  for (const email of emails) {
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Create the admin user with a guaranteed-unique referral code.
      let code = genReferralCode();
      for (let i = 0; i < 4; i++) {
        const exists = await prisma.user.findUnique({ where: { referralCode: code } });
        if (!exists) break;
        code = genReferralCode();
      }
      const hash = await bcrypt.hash(password, 10);
      user = await prisma.user.create({
        data: {
          email,
          role: 'admin',
          referralCode: code,
          passwordHash: hash,
        },
      });
      await ensureWallets(user.id);
      console.log(`[admin-bootstrap] created admin user: ${email}`);
      continue;
    }

    // Existing user — ensure role + password hash are current.
    const patch: any = {};
    if (user.role !== 'admin') patch.role = 'admin';
    const matches = user.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!matches) {
      patch.passwordHash = await bcrypt.hash(password, 10);
    }
    if (Object.keys(patch).length > 0) {
      await prisma.user.update({ where: { id: user.id }, data: patch });
      console.log(`[admin-bootstrap] updated admin user: ${email} (${Object.keys(patch).join(', ')})`);
    }
    await ensureWallets(user.id);
  }
}
