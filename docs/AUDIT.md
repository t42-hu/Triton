# Starter audit

This document records the current approved cleanup and its validation. See
[features](./FEATURES.md) for the supported services and
[improvements](./IMPROVEMENTS.md) for optional work.

## Approved cleanup and fixes

- Removed the previous product's migration bundle, upgrade command, and
  wage-specific test scenario. Kept normal Drizzle migrations, the one-shot
  migrator, the locking runner, and active tests. An unmanaged database is
  refused without changing its rows; integration coverage checks this guard.
- Removed unused UI/homepage components and their unused dependencies, obsolete
  native tool caches, an unused Expo splash asset, unused per-service Docker
  ignore files, and six obsolete environment variables. Existing databases and
  `.DS_Store` files were not removed.
- Replaced marketing content with an environment-branded starting page. Removed
  obsolete documentation and unrelated framework ignore rules.
- Fixed native session loss when a session response body is cancelled or
  malformed. Only an explicit absent session clears the matching stored token.
- Corrected Electron/Expo bundle-ID defaults and validation; Windows Electron
  commands now invoke the pnpm CLI through Node without shell interpolation.
  Next.js also handles repository paths containing spaces.
- Added Expo's hosted CAPTCHA flow, exact callback/state checks, and the
  existing backend's CAPTCHA header. Provider verification remains server-side.
- Added a public-only Expo environment snapshot for EAS builds. Cloud config can
  load it without `.env`; upload exclusions keep private files out. Shared code
  builds automatically for Expo commands and after EAS dependency installation.
  Expo start/export clears Metro so changed environment values are embedded.
- System Stats startup reuses an existing host agent. Pairing refreshes only an
  unpaired agent, using logs written after restart. Renovate follows
  electron-builder. Unused Docker builder cache was pruned.

The Nest API uses a Redis sliding-window limiter. Better Auth keeps its own
separate auth limiter, as agreed. Review shared auth limiting before scaling
beyond one API instance.

## Validation

- Full `pnpm verify`: passed formatting, types, lint, generated API drift,
  49 unit/infrastructure tests, and API/web/Expo production builds.
- `pnpm audit --audit-level low` and `pnpm peers check`: passed.
- `pnpm test:template --verify`: passed fresh installation, full verification,
  clone identity, private-file exclusions, and customized/conflicting updates.
  A follow-up template test also excludes generated Expo identity snapshots.
- Expo cloud-config tests: passed loading without `.env`, excluding secrets,
  respecting upload rules, and validating bundle ID and build number.
- CAPTCHA tests: passed exact destination/state validation and backend rejection
  of missing, rejected, or wrong-hostname tokens using a mocked provider.
- System Stats tests: passed agent reuse, profile selection, existing pairing,
  and fresh pairing-log/browser behavior with mocked Docker commands.
- Unsigned macOS Electron package: built successfully. Windows command dispatch
  is regression-tested; home/registration navigation and preload availability
  also passed in the packaged Mac app. This does not prove Windows execution.
- `pnpm test:native --scanner --browser-container`: passed database/queue/API,
  account recovery from a restored database, local mail/storage, native auth,
  real ClamAV, and all 30 Chromium/Firefox/mobile-WebKit browser tests.
- Actual production and development Compose definitions/Dockerfiles: passed
  core service startup, Meilisearch health, blank optional provider settings,
  HTTP account flows, and Expo custom-origin registration. These runs used
  disposable secrets/databases/ports and were cleaned up afterwards.
- Expo browser smoke: passed environment branding, email submission, rejected
  callback destinations, hosted CAPTCHA popup, state-bound return, and the API
  token header. The UI ran in Chromium with mocked API/Turnstile responses;
  actual provider verification is a separate external test.

## Remaining external checks and security limits

Real-device iOS/Android behavior, EAS cloud signing, and signed desktop installers
require platform accounts and device testing. Browser emulation is not proof of
a mobile release. Live OAuth, mail providers, R2/S3, Stripe checkout, Turnstile,
Cloudflare DNS/tunnels, and System Stats cloud delivery are not covered by
mocked or local-provider tests.

The earlier image audit reported advisories in the optional System Stats image,
older search/tunnel/local-provider images, PostgreSQL's entrypoint toolchain,
and an esbuild binary included through backend dependencies. Those findings
are not cleared by a clean JavaScript advisory check. Image upgrades remain
separate work requiring compatibility checks, especially persisted search data.

System Stats is opt-in in Compose and is enabled by the requested `start.sh`
workflow. It mounts the Docker socket and communicates with its vendor; a
read-only socket mount still exposes the Docker API. Choose one owning clone
per host. Stopping that clone also stops its monitoring agent.

This is a source and functional audit, not a forensic Git-history scan or an
independent penetration test. Product deployments still need their own domain,
TLS, provider configuration, backups, alerting, and release credentials.
