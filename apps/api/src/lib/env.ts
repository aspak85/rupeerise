export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? '4000'),
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || 'dev_secret_do_not_use_in_prod',
  REDIS_URL: process.env.REDIS_URL,
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  MAIL_FROM: process.env.MAIL_FROM,
  ADMIN_EMAILS: process.env.ADMIN_EMAILS || '',
  // Plaintext admin password from .env. Hashed (bcrypt) into User.passwordHash
  // for each email in ADMIN_EMAILS on every API boot. Change the .env value
  // and restart the API to rotate the password.
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
  UPI_ID: process.env.UPI_ID || 'rupeerise@upi',
};
