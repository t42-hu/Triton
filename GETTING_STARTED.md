# Getting started

Install Docker with Compose v2.20+, tmux (`brew install tmux` on macOS), and
Node from `.node-version`. Use pnpm 11.8.0 (pinned in package.json). For
services-only startup without tmux, use `pnpm dev:services:up`.

```bash
./start.sh
```

Cross-platform equivalent:

```bash
node infrastructure/setup.mjs init
pnpm install --frozen-lockfile
pnpm project:doctor
./statsd.sh
pnpm dev:up
```

Initialization creates `.env` only when missing, chooses currently free local
ports, and generates clone identity and unique secrets. It never overwrites an
existing `.env`. Check the printed application URL; the default is
`http://localhost:8080`. A port can be claimed by another process after setup;
edit its `DEV_*_PORT` if necessary. Do not copy `.env` between independent clones.
The fallback identity hashes the checkout path so equal folder names are distinct.
`COMPOSE_PROJECT_NAME` overrides identity when adopting an existing installation.

`APP_NAME` is the common display name. `APP_URL` optionally specifies a public
origin. `DEV_APP_DOMAIN`/`PROD_APP_DOMAIN` override `APP_DOMAIN`; a configured
domain yields HTTPS URLs. The Compose wrapper derives auth, API host configuration,
encoded database credentials, profiles, and public branding. Public app name/URL
and the Better Auth URL come from `APP_NAME` and `APP_URL`; old
`NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_URL`, and `BETTER_AUTH_URL` entries
in an existing `.env` are ignored by the wrapper.

Initialization generates the host-side `DATABASE_URL` from `POSTGRES_USER`,
`POSTGRES_PASSWORD`, `POSTGRES_DB`, and the selected development database port.
If you change those settings later, update `DATABASE_URL` as well for host-side
database tools. An existing PostgreSQL volume does not automatically create a new
user or database when these values change; migrate its data and roles deliberately.

Host port bindings are configured in `.env`. `DEV_BIND_ADDRESS` controls the
development web proxy, `DEV_INTERNAL_BIND_ADDRESS` controls the direct frontend,
backend, database, cache, and optional development service ports, and
`PROD_BIND_ADDRESS` controls the production web proxy. They default to `127.0.0.1`.
To open development from another device, set `DEV_BIND_ADDRESS=0.0.0.0` and set
`APP_URL` to an address that device can reach, such as
`http://192.168.1.10:8080`; then recreate the proxy with `pnpm dev:services:up`.
`0.0.0.0` is a bind address, not a browser URL. Leave
`DEV_INTERNAL_BIND_ADDRESS` on loopback unless you deliberately need direct
network access to those development services. If you do, use `0.0.0.0` so
host-side tools can still connect through localhost; exposing direct backend or
data ports bypasses the proxy and requires your own network controls. For
production, keep the proxy on loopback when using the Cloudflare tunnel, or set
`PROD_BIND_ADDRESS` to the intended host interface behind a trusted TLS ingress
and configure the public `APP_DOMAIN` or `APP_URL` separately.

For extra exact web origins, set comma-separated `TRUSTED_ORIGINS` (include the port). Avoid wildcards.
Use `NEXT_PUBLIC_API_URL` for a separate API origin and optionally
`NEXT_PUBLIC_AUTH_URL` for a separate auth endpoint. Public settings are bundled
at frontend build time. Rebuild after changing them in production.

## Local services

`LOCAL_SERVICES_ENABLED=true` starts Mailpit and SeaweedFS. With no external
storage configuration, the wrapper wires an S3 bucket and profile-image serving
through the API. Mailpit captures mail instead of sending it to real recipients;
its UI defaults to `http://localhost:8025`. Use `MAIL_PROVIDER=ses` for AWS,
`smtp` for another SMTP server, or `disabled` to disable password reset.
Set all external storage credentials together; partial configuration fails early.
The API advertises feature availability so disabled integrations do not show
usable actions. Never enable local automatic bucket creation in production.

`SEARCH_ENABLED=true` starts Meilisearch; otherwise search is unavailable and
does not block the core application. `VIRUS_SCAN_ENABLED=true` starts ClamAV and
requires clean scans before uploads. Enabled scanners fail closed on errors.
When explicitly disabled, image validation/optimization remains enabled but
there is no malware scan. Production operators should enable scanning when their
upload policy requires it. A scanner's initial signature download can take time.

`STATSD_ENABLED=true` starts the optional System Stats host/container monitoring
agent. Follow its account-pairing link in `pnpm dev:logs statsd` (or
`pnpm prod:logs statsd`). It uses host networking and Docker-socket access, so
run only one copy per Docker host. See [observability](./docs/OBSERVABILITY.md)
for its security and Docker Desktop limits.

`./start.sh` runs `./statsd.sh` before opening tmux: it sets this flag in `.env`,
starts the agent, prints the last 20 log lines, and opens the pairing link in
your browser on macOS or Linux. Pair promptly: unused device codes expire after
about five minutes. Rerunning `./statsd.sh` refreshes the code if the agent is
still unpaired; a paired agent keeps its existing account link.

The `migrate` service applies migrations before the backend starts. Database,
cache, and development service ports bind to loopback. See
[DATABASE.md](./docs/DATABASE.md) before upgrading an existing database.

```bash
pnpm dev:logs
pnpm dev:rebuild
pnpm dev:down
pnpm verify
pnpm audit --audit-level high
```

## Production

Set a real application domain/URL, unique database/auth/search secrets, and only
the integrations you use. `LOCAL_SERVICES_ENABLED` never enables local providers
in production. Set `MAIL_PROVIDER` explicitly for production mail. For Cloudflare,
provide the account and scoped API token documented in
[CLOUDFLARE_TUNNEL.md](./CLOUDFLARE_TUNNEL.md), then run:

```bash
pnpm prod:tunnel:up
```

Use [RELEASES.md](./docs/RELEASES.md) for immutable prebuilt images and
[DATABASE.md](./docs/DATABASE.md) for backups and recovery. Use the pnpm Compose
wrapper for all environments; raw Compose lacks the derived configuration.
The proxy's public bind address is loopback by default; remote access is through
the configured tunnel. No developer account credentials are needed for local
email/password registration, reset, and profile uploads.

## Persistent terminal workspace with tmux

Install tmux using `brew install tmux` on macOS or your Linux package manager
(Windows developers can use WSL). Complete the normal `.env` setup first, then:

```bash
pnpm dev:up                    # Ensure Docker services are running and attach
pnpm dev:tmux                  # Reconnect, or start services and create workspace
pnpm dev:services:up           # Start services without tmux
pnpm dev:tmux --detached       # Start without attaching
pnpm dev:tmux --no-start       # Open panes for already-running services
pnpm dev:tmux:status
pnpm dev:tmux:stop             # Close this checkout's terminal workspace
```

The workspace contains a development shell and live backend/frontend logs.
Running the command again reconnects to the existing workspace. Each checkout
uses its own tmux socket; your personal tmux configuration and other projects
are unaffected. Run these commands from a terminal for interactive attachment.
With the default bindings, press `Ctrl-b`, then `d` to detach; `Ctrl-b`, then an
arrow key to change panes; or `Ctrl-b`, then `z` to zoom the active pane. Mouse
selection and scrolling are enabled. See the
[official tmux guide](https://github.com/tmux/tmux/wiki/Getting-Started).

Detaching keeps the shell and logs running. Stopping the workspace closes its
shell processes; Docker services keep running until `pnpm dev:down`. If a log
pane exits, its error remains visible: fix the service issue, then stop and
reopen the workspace. This is a local development tool, not a deployment or
production process supervisor. `pnpm dev:up` (and `start.sh`) now requires tmux. For automation or a
services-only workflow, use `pnpm dev:services:up`. Noninteractive `dev:up`
creates a detached workspace; `pnpm dev:up --detached` also avoids attachment.

The unit suite checks clone isolation and, when tmux is installed, starts two
real disposable workspaces to verify pane creation and independent cleanup.

## Products that can receive template updates

Use [Copier generation and updates](docs/TEMPLATE_UPDATES.md) to create new
products with a recorded upstream revision and reviewable future upgrades.

System Stats is shared per Docker host. `./statsd.sh` reuses a running agent
from another clone and only refreshes pairing when that agent is unpaired.
`pnpm dev:up` and `pnpm prod:up` skip creating another agent while one exists.
Stopping the clone that owns the agent stops host monitoring; start it again
from the chosen owner or run `./statsd.sh` from another clone.
