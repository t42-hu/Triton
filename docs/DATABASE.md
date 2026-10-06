# Database lifecycle

Compose runs the `migrate` service once before starting the API. The migrator
holds a PostgreSQL advisory lock on the same connection used for migration;
concurrent deployments serialize. Errors stop startup. Application replicas do
not migrate unless `RUN_DATABASE_MIGRATIONS=true` is explicitly enabled for
host-based development.

Generate migrations after editing `backend/src/database/database.schema.ts`:

```bash
pnpm db:generate
pnpm --filter @fullstack-starter/backend build
pnpm db:migrate
```

Commit SQL and metadata together. Never use `db:push` on production. Fresh
installations use the clean `backend/drizzle` history and the `starter` migration
journal. `migrate.ts` is the one-shot Compose command; `migrations.ts` is the
shared, lock-protected runner. Both are needed.

An existing user table without this starter's migration journal is refused
without changing its data. Importing another product's database requires its
own reviewed migration. Keep `APP_ID` and any explicit `COMPOSE_PROJECT_NAME`
stable once a deployment has data: they identify cookies and Compose resources.

## Backups and recovery

```bash
pnpm db:backup production
RESTORE_DATABASE=restore_check pnpm db:restore production backups/example.dump
```

Backups use PostgreSQL custom format, include all schemas, are mode 0600, and
are excluded from Git and Docker contexts. Restore always creates a NEW database;
it rejects the active database name and fails if the destination already exists.
A failed restore may leave an empty destination database for inspection.

Schedule backups using your platform scheduler, copy them to encrypted external
storage, define retention, and regularly restore-test them. Local backups alone
do not protect against losing the host. Object-storage contents need their own
backup/versioning policy; the database stores references, not image bytes.

For recovery, validate the restored database (schema, row counts, login and
product invariants), stop writes, update the connection, and restart a compatible
application image. A previous image is safe only with a compatible schema.
Destructive schema changes require an expand/migrate/contract release plan;
there is no automatic destructive down migration.
