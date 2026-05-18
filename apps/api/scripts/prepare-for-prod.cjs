#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Flip apps/api/prisma/schema.prisma from SQLite -> PostgreSQL ahead of a
 * production deploy. Idempotent: running this twice is a no-op.
 *
 * Usage (from apps/api):
 *   npm run prepare:prod
 *
 * After running, generate the initial migration against your Neon URL:
 *   npx prisma migrate dev --name init
 *
 * Then commit `prisma/migrations` and push to GitHub.
 */
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const original = fs.readFileSync(schemaPath, 'utf8');

if (/provider\s*=\s*"postgresql"/.test(original)) {
  console.log('[prepare:prod] schema.prisma already targets PostgreSQL — nothing to do.');
  process.exit(0);
}

if (!/provider\s*=\s*"sqlite"/.test(original)) {
  console.error('[prepare:prod] Could not find a `provider = "sqlite"` line in schema.prisma.');
  console.error('               Edit the file manually and set: provider = "postgresql"');
  process.exit(1);
}

const updated = original.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');
fs.writeFileSync(schemaPath, updated);

console.log('[prepare:prod] OK — schema.prisma now targets PostgreSQL.');
console.log('');
console.log('Next steps:');
console.log('  1. Put your Neon URL in apps/api/.env as DATABASE_URL=...');
console.log('  2. Run:  npx prisma migrate dev --name init');
console.log('  3. git add prisma/migrations apps/api/prisma/schema.prisma');
console.log('  4. git commit -m "chore: switch prisma to postgresql for prod"');
console.log('  5. git push');
