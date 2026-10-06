# What this starter includes

Run `./start.sh` to create a private `.env`, a clone-specific identity and secrets,
install dependencies, and start the local application. Edit `frontend/src`,
`backend/src`, and `shared/src` for the product. Public branding, ports, domains,
and optional providers come from environment variables. External providers still
require their own accounts, credentials, and callback/domain setup.

| Area                 | Included behavior                                                                                            | Service or configuration                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Web                  | Responsive Next.js/React pages, error/loading states, metadata, robots and sitemap                           | Next.js behind Nginx                                         |
| API                  | NestJS modules, validated environment, typed shared Zod contracts, OpenAPI and generated Orval client        | Node.js/NestJS                                               |
| Accounts             | Email/password registration, login, logout, password reset when mail is available, sessions, profile editing | Better Auth, PostgreSQL, Redis                               |
| Social login         | Google, Microsoft, GitHub, Facebook when each provider's credentials are complete                            | Provider credentials and callback registration               |
| Database             | Drizzle schema, serialized startup migrations, backup/restore, unmanaged database protection                 | PostgreSQL 16                                                |
| Cache and jobs       | Rate limits, Socket.IO coordination, BullMQ queues with retries and retention                                | Redis 7                                                      |
| Images               | Authenticated upload, validation, WebP optimization, owner checks and serving                                | Local SeaweedFS S3 in development or configured R2/S3        |
| Malware scanning     | Scan uploads and fail closed while enabled; real ClamAV profile                                              | ClamAV (enabled in the example environment)                  |
| Mail                 | Local captured mail or configured SMTP/AWS SES; disabled cleanly when unset                                  | Mailpit in development, SMTP or SES in production            |
| Payments             | Stripe checkout, signed webhooks and transactional event deduplication                                       | Stripe when all keys and allowed price IDs are set           |
| Search               | Optional health-checked search service                                                                       | Meilisearch with `SEARCH_ENABLED=true`                       |
| Abuse protection     | Per-route Redis rate limiting and optional challenge                                                         | Redis and Cloudflare Turnstile                               |
| Public access        | Reverse proxy, security headers, optional tunnel/DNS setup                                                   | Nginx and Cloudflare Tunnel                                  |
| Observability        | Redacted structured logs, request/job correlation, stable client errors, optional trace export               | Pino and OpenTelemetry OTLP                                  |
| Host monitoring      | Optional host/container metrics sent to a System Stats dashboard; agent pairs from its logs                  | exelban/statsd (`STATSD_ENABLED=true`)                       |
| Expo app             | React Native iOS/Android/web starter with secure session storage and email authentication                    | Expo SDK 57, Better Auth                                     |
| Desktop              | Packaged web UI, native auth/deep links, OS-backed session storage, and installer builds                     | Electron 44, electron-builder                                |
| Clone maintenance    | Unique ports, containers, volumes and cookies; versioned clone/update workflow                               | Setup scripts, Docker Compose and Copier                     |
| Development          | Persistent panes for shell and service logs; `pnpm dev:up` starts services and attaches                      | tmux                                                         |
| Quality and delivery | Format/type/lint/build checks, isolated API/browser/native tests, dependency updates and release workflows   | Prettier, ESLint, Playwright, GitHub Actions, Renovate, GHCR |

The development stack starts PostgreSQL, Redis, the web/API containers, Nginx,
Mailpit, and SeaweedFS by default. Search and ClamAV follow their feature flags.
Production starts PostgreSQL, Redis, a one-shot migration container, API, web,
and Nginx; search and ClamAV remain profile-controlled. Production does not
silently start local mail or object storage. Blank optional provider settings
leave those features unavailable without preventing core startup.
The System Stats agent is also opt-in in both stacks and should run only once
per Docker host.

Use `pnpm dev:up` for the tmux workspace, `pnpm dev:services:up` without tmux,
`pnpm prod:up` for local production Compose, `pnpm verify` for fast checks, and
`pnpm test:native --scanner --browser-container` for the broad isolated suite.
See [Getting started](../GETTING_STARTED.md), [Testing](./TESTING.md),
[Releases](./RELEASES.md), [Expo](./EXPO.md), and [Electron](./ELECTRON.md)
for prerequisites and limits.
