# Modernization direction

The existing TypeScript, React/Next.js, NestJS, PostgreSQL, Drizzle, Better Auth,
Redis/BullMQ, pnpm workspace, and Docker stack is a strong learning platform.
Keep clear module boundaries and build complete features through this stack.
Professional engineering means being able to explain, test, operate, upgrade,
and recover the system you ship.

## Implemented foundation

1. Playwright and isolated integration tests cover accounts, uploads, billing,
   database recovery, browser flows, and the desktop authentication contract.
2. Electron packages the web UI for desktop; Expo provides a separate React
   Native mobile UI sharing backend accounts. See [Electron](./ELECTRON.md),
   [Expo](./EXPO.md), and [native authentication](./NATIVE.md).
3. Copier generates isolated clones and supports reviewed template upgrades.
   See [template updates](./TEMPLATE_UPDATES.md).
4. Shared Zod contracts, OpenAPI, and Orval generate the typed web client;
   CI checks generated output. See [API contract](./API_CONTRACT.md).
5. Pino logs and optional OpenTelemetry correlate requests and jobs while
   redacting credentials. See [observability](./OBSERVABILITY.md).
6. Renovate groups dependency and container updates. Install its GitHub app
   for each repository to enable update PRs. Automatic merging is disabled.

## Deferred choices

7. OpenTofu requires a selected hosting provider and deployment design.
   It has not been added.

TanStack Query can be added when product screens need coordinated caching and
invalidation. The generated API client already provides typed requests.
Turborepo is worth evaluating only when measured build times justify another
build layer. Signed native release tests, monitoring, and recovery rehearsals
are product-specific release gates, detailed in [improvements](./IMPROVEMENTS.md).

These recommendations do not authorize additional implementation work.
