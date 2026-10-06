#!/bin/sh
set -eu

pnpm --filter @fullstack-starter/shared build
exec pnpm --parallel \
  --filter @fullstack-starter/shared \
  --filter @fullstack-starter/backend \
  dev
