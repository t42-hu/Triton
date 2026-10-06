# Optional improvements after the starter audit

The current stack is a capable general-purpose starter. Add complexity when a
product's deployment, performance, or native requirements justify it. These are
recommendations, not changes required to start coding.

1. **Make the first real deployment reproducible.** Choose a host and write its
   infrastructure as code (OpenTofu is one option), private secret delivery,
   TLS ingress, backups, a restore rehearsal, and a rollback procedure. The
   existing Compose deployment is suitable for a single host, but no generic
   template can choose your domain, cloud account, retention policy, and alert
   destinations. [Docker's production guidance](https://docs.docker.com/compose/how-tos/production/)
   and [Compose secrets](https://docs.docker.com/reference/compose-file/secrets/)
   explain the deployment-specific choices.
2. **Add real-device release gates when publishing native apps.** Run signed or
   unsigned Android and iOS builds and exercise deep links, credential storage,
   offline behavior, and upgrades on actual Expo devices. Test Electron deep
   links and secure storage on each desktop operating system you distribute.
   Browser emulation does not prove a platform release.
3. **Keep dependency and container updates reviewable.** Install the Renovate app
   for each generated repository, require CI for its PRs, and review major
   framework and native toolchain updates individually. CI now audits build
   tools as well as production packages. Prioritize the older Meilisearch image
   after an index backup and upgrade rehearsal, and review Cloudflared and
   Nginx image updates against current advisories. Meilisearch is pinned at
   1.12 while [upstream is at 1.54](https://github.com/meilisearch/meilisearch/releases),
   so a direct persisted-data upgrade needs care. Cloudflared's pinned 2026.5.2
   image predates [upstream 2026.9.3](https://github.com/cloudflare/cloudflared/releases).
4. **Add product-specific monitoring.** Choose an OTLP collector and alerting
   destination, then measure latency, error rate, queue depth, migration failures,
   failed scans, storage availability, and backup age. Keep telemetry disabled
   until a destination and data-retention policy are chosen.
5. **Slim the development Docker builds.** The current dev Dockerfiles install
   the complete workspace dependency graph in both API and web images. This
   costs build time and Docker disk space. Package-filtered installs or a
   shared development base image are worth testing. Builds of the
   images should be measured before adopting a filtered install; keep runtime
   dependencies and workspace package builds in the resulting image.
6. **Use TanStack Query only if the product needs shared client caching.** The
   generated typed API client is enough for simple screens. As data mutations,
   pagination, optimistic updates, and cross-screen invalidation grow, add query
   hooks around that client rather than introducing a second API contract.
7. **Sign and notarize desktop releases.** Unsigned Electron artifacts are useful
   for CI and local testing, but distributing them requires product-owned Apple
   and Windows signing identities. Rehearse installation and upgrades before
   enabling publication. [Electron signing](https://www.electronjs.org/docs/latest/tutorial/code-signing)
8. **Add a desktop update channel when distribution needs it.** Choose an
   update host and rollback policy before adding automatic update code.
