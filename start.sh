#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")"
node infrastructure/setup.mjs init
pnpm install --frozen-lockfile
pnpm project:doctor
./statsd.sh
pnpm dev:up
