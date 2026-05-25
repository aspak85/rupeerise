// Defensive read: hosting dashboards (Render, Vercel) often inject env values
// with a trailing newline when users paste from text editors. `\n` at the end
// of a hostname or URL breaks DNS lookups and HTTP parsing, so we trim every
// string value before exposing it to the app.
const s = (v: string | undefined): string | undefined =>
  v == null ? undefined : v.trim();
const sd = (v: string | undefined, fallback: string): string =>
  (v == null ? fallback : v.trim()) || fallback;

export const env = {
  NODE_ENV: sd(process.env.NODE_ENV, 'development'),
  PORT: Number((process.env.PORT ?? '4000').trim() || '4000'),
  DATABASE_URL: s(process.env.DATABASE_URL),
  JWT_SECRET: sd(process.env.JWT_SECRET, 'dev_secret_do_not_use_in_prod'),
  REDIS_URL: s(process.env.REDIS_URL),
  RAZORPAY_KEY_ID: s(process.env.RAZORPAY_KEY_ID),
  RAZORPAY_KEY_SECRET: s(process.env.RAZORPAY_KEY_SECRET),
  SMTP_HOST: s(process.env.SMTP_HOST),
  SMTP_PORT: Number((process.env.SMTP_PORT ?? '587').trim() || '587'),
  SMTP_USER: s(process.env.SMTP_USER),
  SMTP_PASS: s(process.env.SMTP_PASS),
  MAIL_FROM: s(process.env.MAIL_FROM),
  // Resend HTTP API key. NOTE: Resend's free tier in 'test mode' only lets
  // you send to your own verified email — you must verify a custom domain
  // before sending to arbitrary users. Use Brevo below if you don't have a
  // domain handy.
  RESEND_API_KEY: s(process.env.RESEND_API_KEY),
  // Brevo (formerly Sendinblue) HTTP API — BEST CHOICE for Render free tier
  // because (a) it's HTTP (no SMTP outbound block), (b) the free 300/day
  // tier only requires verifying a single sender email (no domain), so any
  // Gmail user can be up and running in 5 minutes.
  // Sign up: https://app.brevo.com/  -> SMTP & API -> API Keys
  BREVO_API_KEY: s(process.env.BREVO_API_KEY),
  BREVO_SENDER_EMAIL: s(process.env.BREVO_SENDER_EMAIL),
  BREVO_SENDER_NAME: sd(process.env.BREVO_SENDER_NAME, 'RupeeRise'),
  ADMIN_EMAILS: sd(process.env.ADMIN_EMAILS, ''),
  // Plaintext admin password from .env. Hashed (bcrypt) into User.passwordHash
  // for each email in ADMIN_EMAILS on every API boot. Change the .env value
  // and restart the API to rotate the password.
  ADMIN_PASSWORD: sd(process.env.ADMIN_PASSWORD, ''),
  UPI_ID: sd(process.env.UPI_ID, 'rupeerise@upi'),
};
