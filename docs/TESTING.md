# Repeatable tests

Run from the repository root with the pinned Node/pnpm versions and a running
Docker engine with Compose v2. Allow several GB of free space in Docker's virtual
disk for application builds and browser images. No application `.env` or cloud
provider credentials are needed.

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm test:install
pnpm test:integration
```

`verify` covers formatting, types, lint, unit/infrastructure tests, and application
builds. `test:integration` creates a unique `fullstack-test-*` deployment with
random secrets, loopback-only ports, PostgreSQL, Redis, Mailpit, and SeaweedFS.
It builds the production Dockerfiles and runs the applications as non-root with
read-only root filesystems. The API uses development mode to enable local mail
and storage; authentication origin validation remains active. This is not a test
of production TLS/cookie policy or live provider accounts.

Each run has separate accounts, databases, storage, containers, and networks.
The runner does not load your `.env` or inherit application/provider credentials.
Stripe signature verification uses a generated local signing secret and a
deliberately unusable API key; no checkout/provider API call is made.

## Coverage

- Fresh, repeated, and concurrent migrations, refusal of unmanaged databases,
  and duplicate display names.
- Real database billing transactions, deduplication, rollback/retry, customer
  linkage, and out-of-order event handling; provider API calls are mocked.
- HTTP webhook signatures, tampering, expired timestamps, and concurrent replay.
- Queue retry/backoff, job-ID deduplication, retention, and graceful draining.
- Request-ID/error-contract behavior, log redaction, and request context carried
  into queue jobs.
- HTTP authentication, custom-port origins, profile validation, upload ownership,
  MIME/type/size rejection, local object storage, and email password resets.
- Database dump/restore followed by real authentication and profile retrieval.
- Playwright registration, login/logout, profile editing, image upload/removal,
  navigation, responsive layout, password reset, and invalid/reused reset tokens.
  Six web flows cover these behaviors plus offline/non-JSON errors and request
  timeouts. Four additional native-browser flows include session preservation
  during connectivity loss. Together these run as 30 tests across Chromium,
  Firefox, and mobile WebKit emulation with `pnpm test:native`.
  Uncaught browser JavaScript errors fail tests.

Mobile emulation is not an iOS device or Electron test. Live OAuth, Stripe,
SES/R2, Turnstile, and Cloudflare require separately configured provider tests.

## Focused runs and container browsers

```bash
pnpm test:api
pnpm test:e2e --project=chromium
pnpm test:integration --scanner
pnpm test:integration --browser-container
pnpm test:native --browser-container
```

`--scanner` adds real ClamAV clean/EICAR tests and enables scanning for image
uploads. It needs more memory/startup time and is optional in the default CI job.
`test:native` adds a separately built/served static frontend and native transport,
callback, and reset tests; see [NATIVE.md](./NATIVE.md). The CI job runs this
superset of the web suite. Platform adapters in browser tests are fakes; actual
Electron desktop acceptance belongs to the packaging steps. Expo has its own
typecheck and web export; see [EXPO.md](./EXPO.md).
Browser flags such as `--project=firefox` or `--grep=reset` are forwarded to
Playwright. Every command still creates and removes its own deployment.

`--browser-container` runs all browser engines in the official Linux Playwright
image, pinned to the root dependency version. It does not need `test:install` on
the host. The runner creates a non-root browser server, binds its endpoint to
loopback, and connects using Playwright's loopback forwarding. The browser
container is removed with the rest of the deployment. The first run downloads
the browser image and matching Playwright package. See the upstream
[container workflow](https://playwright.dev/docs/docker).

Use this option on macOS 27 if Playwright Firefox cannot launch. An upstream
[macOS 27 Firefox issue](https://github.com/microsoft/playwright/issues/42082)
reports a similar startup failure. Chromium and mobile WebKit can also be tested
directly on macOS:

```bash
pnpm test:e2e --project=chromium --project=mobile-webkit
```

Host browser binaries default to `.cache/playwright`. If a synchronized workspace
causes download-lock failures, use an ordinary local cache for both commands:

```bash
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/fullstack-playwright pnpm test:install
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/fullstack-playwright pnpm test:e2e --project=chromium
```

## Reports, cleanup, and CI

Reports are stored in `test-results/integration/<run-id>/`: HTML and JUnit
results, failed-test traces/screenshots/videos, Compose build logs, service logs,
and cleanup logs. Artifacts contain disposable test credentials/session data;
they are ignored by Git. Private generated configuration lives under
`.cache/integration/<run-id>/` with restricted permissions and is deleted after
cleanup. Browser binaries and reusable Docker build caches are retained.

```bash
pnpm exec playwright show-report test-results/integration/<run-id>/report
pnpm exec playwright show-trace <path-to-trace.zip>
pnpm test:cleanup
```

Success, ordinary failures, and SIGINT/SIGTERM enter cleanup. It removes only the
generated project's containers, networks, data volumes, and application image
tags, then verifies no project resources remain. After force-killing a process
or losing Docker, run `test:cleanup` when Docker is available. It uses saved test
state and skips live runner PIDs; it never prunes unrelated application data.

GitHub Actions runs the integration job after the verification job, installs
the pinned browser engines/system dependencies, runs the full default suite,
attempts cleanup even after failures, and retains reports for seven days.
The workflow requires no provider secrets and works for pull requests from forks.
Repository branch-protection settings should require both jobs separately.

## Expo checks

`pnpm expo:check` checks the React Native client types. `pnpm expo:export`
builds the Expo web app. Native device and store builds require the platform
toolchains or an Expo Application Services account; see [EXPO.md](./EXPO.md).

## Electron desktop checks

`pnpm electron:prepare` exports the desktop web UI and writes public clone
configuration. `pnpm electron:package` creates an unpacked app, and
`pnpm electron:make` creates installers for the host platform. The desktop CI
workflow checks all three operating systems. See [ELECTRON.md](./ELECTRON.md).

Focused regressions also cover cancelled native session responses, Expo public
cloud-config export and upload exclusions, CAPTCHA callback/state validation,
backend CAPTCHA provider/hostname rejection, Windows pnpm dispatch, and System
Stats host-agent reuse. `docs/AUDIT.md` distinguishes automated/local checks
from real-provider and native-device release checks.
