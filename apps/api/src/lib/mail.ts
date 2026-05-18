import { env } from './env';
import { createRequire } from 'module';

// nodemailer is CommonJS — load it via createRequire so it works under our
// tsx/ESM build (a bare `require()` is undefined in ESM modules).
const localRequire = createRequire(import.meta.url);
let nodemailer: any;
try {
  nodemailer = localRequire('nodemailer');
} catch (e) {
  console.warn('[mail] nodemailer not installed — emails will fall back to console logs.');
  nodemailer = null;
}

let transporter: any = null;
function getTransporter() {
  if (!nodemailer) return null;
  if (transporter) return transporter;
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465, // 465 = SSL, 587/25 = STARTTLS
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return transporter;
}

export type SendMailOpts = { to: string; subject: string; text: string; html?: string };

export async function sendMail({ to, subject, text, html }: SendMailOpts): Promise<{ delivered: boolean; preview?: string }> {
  const t = getTransporter();
  const from = env.MAIL_FROM || 'RupeeRise <no-reply@rupeerise.local>';
  if (!t) {
    // Dev fallback: log to console so devs can grab the OTP
    console.log('\n[DEV MAIL]');
    console.log(`From: ${from}`);
    console.log(`To:   ${to}`);
    console.log(`Subj: ${subject}`);
    console.log(text);
    console.log('[/DEV MAIL]\n');
    return { delivered: false };
  }
  const info = await t.sendMail({ from, to, subject, text, html: html || undefined });
  return { delivered: true, preview: info?.messageId };
}

export function otpEmail(code: string) {
  const text = [
    `Your RupeeRise verification code is: ${code}`,
    '',
    'This code expires in 5 minutes.',
    'If you did not request this, you can safely ignore this email.',
    '',
    '— RupeeRise',
  ].join('\n');
  const html = `
    <div style="font-family: Inter, Arial, sans-serif; background:#0b1220; color:#e5e7eb; padding:32px;">
      <div style="max-width:480px; margin:0 auto; background:rgba(15,23,42,0.6); border:1px solid rgba(255,215,0,0.25); border-radius:24px; padding:32px;">
        <div style="font-size:14px; letter-spacing:0.2em; color:#fbbf24; text-transform:uppercase;">RupeeRise</div>
        <h2 style="color:#fff; margin-top:8px;">Your login code</h2>
        <p style="color:#cbd5e1;">Use the code below to finish signing in. It expires in 5 minutes.</p>
        <div style="margin:24px 0; padding:16px 20px; background:#000; border:1px solid rgba(255,215,0,0.4); border-radius:16px; text-align:center;">
          <span style="font-family: monospace; font-size:32px; letter-spacing:8px; color:#ffd700;">${code}</span>
        </div>
        <p style="color:#94a3b8; font-size:12px;">Did not request this? Ignore this email.</p>
      </div>
    </div>`;
  return { text, html };
}
