#!/usr/bin/env bash
# Idempotent Cloud Agent install for Grants & Co OS.
# Safe to run repeatedly and against cached/partially prepared state.
set -euo pipefail

cd "$(dirname "$0")/.."

# 1. Ensure a local .env exists. Never overwrite an existing one.
#    AUTH_SECRET gets a fresh random value the first time only, so sessions
#    stay stable across reboots within an environment.
if [ ! -f .env ]; then
  cp .env.example .env
  SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
  node -e "const fs=require('fs');const f='.env';let s=fs.readFileSync(f,'utf8');s=s.replace('replace-with-long-random-secret',process.argv[1]);fs.writeFileSync(f,s)" "$SECRET"
  echo "Created .env from .env.example with a generated AUTH_SECRET."
else
  echo ".env already present; leaving it untouched."
fi

# 2. Install dependencies. postinstall runs `prisma generate`.
npm install

# 3. Sync the SQLite schema. `db push` is used instead of `migrate deploy`
#    because the committed migration is older than prisma/schema.prisma.
npx prisma db push

# 4. Load safe demo data (idempotent: the seed clears and re-inserts).
npm run db:seed
