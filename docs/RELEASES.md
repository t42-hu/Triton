# Reproducible releases

Use the Node version in `.node-version` and the pnpm version in `packageManager`.
Container bases and services are pinned by digest. Renovate covers the pnpm
workspace, frontend/backend Dockerfiles, Compose services, GitHub Actions,
Expo and Electron packages. Install the Renovate GitHub app for this repository (and each clone) to
activate `.github/renovate.json`; the config alone cannot create PRs. Updates
are scheduled weekly, related minor/patch framework updates are grouped, and
automatic merging is disabled. Review each PR and its CI results before merging.
CI audits development and production packages at high severity or above.
Test dependency/image updates, including database restoration for major database
changes.

The release workflow runs verification, then builds amd64/arm64 web images,
produces SBOM/provenance metadata, and pushes commit-tagged images to GHCR on a
`v*` tag or manual dispatch. Set GitHub repository variables `APP_ID`, `APP_NAME`,
`APP_URL`, `APP_DOMAIN`, `APP_DESCRIPTION`, and `TURNSTILE_SITE_KEY` for frontend
build-time public configuration. Keep backend credentials in deployment secrets;
never put them into frontend build arguments. The workflow records immutable
image digests in its summary. It has not been executed remotely merely by adding
this file.

Set `BACKEND_IMAGE` and `FRONTEND_IMAGE` to those digest references in `.env`:

```bash
node infrastructure/compose.mjs production pull backend frontend migrate
node infrastructure/compose.mjs production up --no-build --detach --wait
```

`pnpm prod:up` intentionally builds local images. Use the `--no-build` command
above when deploying prebuilt images. Keep previous digests and a database backup
for rollback; see [DATABASE.md](./DATABASE.md) for schema compatibility.

Production packaging derives a dedicated deployment lockfile from the workspace
lockfile. Injected workspace packages are synchronized after their build scripts.

Development containers mount source directories, not dependency volumes. This
makes `pnpm dev:rebuild` actually refresh dependencies after a lockfile change.
Changes to app configuration files, CSS at the frontend package root, or image
configuration also need a rebuild. TypeScript files under `src` reload normally. Nginx refreshes Docker service DNS
so container recreation does not leave stale upstream addresses.

ClamAV's verified 1.5.4 Docker image is AMD64-only, so its optional profile uses
explicit emulation on ARM hosts. Other selected service images support ARM.
Do not expose the internal tunnel listener (8081) publicly: it trusts Cloudflare's
client-IP header. Published listener 80 overwrites forwarded client headers.
Only proxy 80 is published in production. `PROD_BIND_ADDRESS` selects its
host interface and defaults to loopback. A Cloudflare tunnel does not require a
public host bind. For another trusted TLS ingress, set `PROD_BIND_ADDRESS` to the
interface that ingress can reach and route it to the published proxy port.
Keep listener 8081 private because it trusts Cloudflare's client-IP header.
Set `APP_DOMAIN` or `APP_URL` to the client-visible HTTPS origin separately;
a bind address is not a browser URL.

The Expo app can be built for iOS and Android with EAS after connecting an Expo
account and configuring store signing. See [EXPO.md](./EXPO.md).
Electron desktop builds use `desktop.yml`; see [ELECTRON.md](./ELECTRON.md)
for identity, installers, signing requirements, and artifacts.
