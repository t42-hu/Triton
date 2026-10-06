# Triton42 universal frontend

`frontend/universal` contains the complete existing Expo SDK 57 application for
web, iOS, and Android. Its screens, SQLite database, reminders, ICS import/export,
assets, gestures, and appearance are shared across all three platforms.

Next.js serves the exported web application at `/` and proxies `/api` to the
NextStack NestJS backend. The existing account foundation remains available at
`/login`, `/register`, and `/profile`. Triton42 keeps its existing offline data
model; this migration does not require an account or add server synchronization.

```bash
pnpm install --frozen-lockfile
pnpm expo:dev
pnpm expo:ios
pnpm expo:android
pnpm expo:check
pnpm test:triton
pnpm --filter @fullstack-starter/frontend build
```

`pnpm expo:prepare` generates native projects from the existing app configuration.
For signed cloud builds, run `pnpm exec eas build --platform ios` or
`pnpm exec eas build --platform android` inside `frontend/universal` using the
existing EAS project and its preview/production profiles.

The application remains version 1.0.5 and keeps `hu.t42.triton` on both native
platforms so installing the migrated build preserves existing SQLite data.
Browser data is scoped to the origin: a different host or port starts with a
separate database. Keep the existing public origin during a production cutover.

Next.js sends COOP/COEP headers required by the Expo SQLite web worker. Both
Next.js development and production builds export the universal application into
`frontend/public/triton` before serving it. This output is generated and ignored
by Git; do not edit it.

See [migration verification](./TRITON42_MIGRATION.md) for build and behavior checks.
References: [Expo monorepos](https://docs.expo.dev/guides/monorepos/) and
[Next.js rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites).
