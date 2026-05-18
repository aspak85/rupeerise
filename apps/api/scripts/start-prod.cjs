#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Production startup wrapper for Render.
 *
 *  1. Try `prisma migrate deploy` (the standard, audit-trail-friendly path).
 *  2. If that fails because there is no migration history yet (P3005 "The
 *     database schema is not empty" or P1014 "table does not exist", or simply
 *     "no migrations to apply" against an empty DB), fall back to
 *     `prisma db push --accept-data-loss` so the very first deploy succeeds
 *     without any local migration step.
 *  3. Then start the compiled API.
 *
 * After the first successful deploy, generate proper migrations locally with
 * `npx prisma migrate dev --name <change>` and commit the
 * `prisma/migrations/` folder so subsequent deploys use migrate deploy.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const migrationsDir = path.join(cwd, 'prisma', 'migrations');
const hasMigrations = fs.existsSync(migrationsDir) &&
  fs.readdirSync(migrationsDir).some((d) => fs.statSync(path.join(migrationsDir, d)).isDirectory());

function run(cmd, args) {
  console.log(`[start-prod] $ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  return r.status ?? 1;
}

if (hasMigrations) {
  console.log('[start-prod] Found prisma/migrations — running migrate deploy');
  const code = run('npx', ['prisma', 'migrate', 'deploy']);
  if (code !== 0) {
    console.error('[start-prod] migrate deploy failed; trying db push as a recovery.');
    run('npx', ['prisma', 'db', 'push', '--accept-data-loss']);
  }
} else {
  console.log('[start-prod] No migrations folder yet — using db push for first deploy.');
  console.log('[start-prod] (Generate proper migrations later with: npx prisma migrate dev --name init)');
  run('npx', ['prisma', 'db', 'push', '--accept-data-loss']);
}

console.log('[start-prod] Booting API…');
require('../dist/index.js');
