#!/bin/sh
set -e

if [ "$MODE" = "worker" ]; then
  echo "Starting BullMQ worker..."
  exec npx tsx src/lib/jobs/worker.ts
else
  echo "Running database migrations..."
  npx prisma db push
  echo "Starting Next.js app..."
  exec npm run start
fi
