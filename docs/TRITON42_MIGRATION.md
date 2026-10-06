# Triton42 migration

## Source and layout

Baseline: Triton `feature/triton42-branding`, commit `5d2935d`.
Template: NextStack commit `ee44c094c97e6e1720a324fa3b69a5a7dc1f2581`.

- `frontend/universal`: existing Expo web/iOS/Android application and its tests.
- `frontend`: Next.js hosting and account foundation; `/` serves Triton42.
- `backend` and `shared`: NextStack API, authentication, database, and contracts.
- `infrastructure`: build, Docker, isolated environment, and verification tools.

No application screen or domain logic is rewritten during this migration.
Native identifiers, schemes, notification configuration, and database names are
preserved. Existing account/backend capabilities remain separate from the
application's offline SQLite persistence.

## Running alongside another NextStack clone

Run `pnpm project:init` on the target machine before starting services. It probes
available ports, creates independent secrets, and generates a unique `APP_ID`.
Compose derives its project name from that ID, isolating containers, networks,
and volumes. Never reuse another clone's `.env` or Compose project name.

The MacBook checkout is `/Users/boss/Desktop/Code/Personal Projects/Triton42`.
Its development instance uses frontend 3042, API 4042, proxy 8042, PostgreSQL
5442, and Redis 6382. Its Compose project ID is `triton42-d9102d`.
Metro defaults to 8083 in root Expo scripts. To override Metro,
run Expo directly from `frontend/universal` with `--port <free-port>`.

The MacBook currently runs Next.js and the API on the host, with PostgreSQL,
Redis, and an Nginx proxy in independent containers. Open `http://localhost:8042`.
The optional virus scanner is disabled for this local instance. Building Docker
images on the Mac was blocked by its locked credential-helper keychain; the
frontend development and production Docker builds were verified on Linux.

Native dependency scripts fail when the checkout path contains spaces. Use
`pnpm expo:ios`, `pnpm expo:android`, or `pnpm native:stage`: the wrapper copies
build inputs to a stable temporary directory without spaces, excluding secrets
and generated projects, and installs the frozen workspace dependencies there.

## Verification

Verified on 2026-10-05:

- All three platforms retain app version 1.0.5, iOS build 8, and Android version
  code 6. Both native identifiers remain `hu.t42.triton`.
- Of 148 application source files, 147 are byte-identical to the baseline. The
  sole difference relocates the shared stylesheet import. All 27 assets match.
- Workspace lint and type checks pass. The baseline run passed 51 foundation
  tests, 63 application tests, and two Cloudflare tests. The final migration
  suite also passes its added proxy/SQLite compatibility test (three total).
- OpenAPI/client consistency check passes. Next.js production builds pass on
  Linux and macOS. Expo web export passes on both machines.
- The production frontend Docker image builds and serves the app with HTTP 200,
  SQLite isolation headers, and a valid `application/wasm` SQLite binary.
- The MacBook proxy serves Triton42 and the API health endpoint reports `ok`.
  A fresh browser database initializes and shows mandatory profile onboarding.
- Desktop and phone browser layouts, profile/import dialogs, date picker, time
  editing, and settings were inspected. Phone layout has no outer overflow.
- Release iOS and Android builds succeed and are installed on the iPhone 17
  simulator and Android emulator. Existing native profiles and Android calendar
  data remain available after installation.

These checks cover builds, retained application code, automated behavior tests,
and representative UI flows. Every background-notification delivery condition
and physical-device gesture was not replayed. Browser SQLite data is scoped to
the browser origin; a new development URL starts a separate database. Retaining
the existing public origin preserves that origin's data. Account-based calendar
synchronization is not introduced by this migration.

When copying exported web output, include every generated directory: WASM asset
paths contain literal `node_modules` segments. A blanket exclusion of that name
silently removes SQLite binaries. Prefer `pnpm build` in `frontend` on the target
machine so the complete web export is generated locally.
