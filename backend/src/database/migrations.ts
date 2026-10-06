import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { Pool } from 'pg'

const folder = fileURLToPath(new URL('../../drizzle', import.meta.url))
const lockId = '78416823849320'

export async function runMigrations(pool: Pool) {
    const client = await pool.connect()
    try {
        await client.query('SET search_path TO public')
        await client.query("SET lock_timeout = '60s'")
        await client.query('SELECT pg_advisory_lock($1)', [lockId])
        const {
            rows: [state],
        } = await client.query(
            "select to_regclass('public.user') as users, to_regclass('starter.__drizzle_migrations') as journal",
        )
        if (state.users && !state.journal)
            throw new Error(
                'Unmanaged database detected. Back up and review a migration before adopting it. No data was changed.',
            )
        await migrate(drizzle(client), {
            migrationsFolder: folder,
            migrationsSchema: 'starter',
        })
    } finally {
        try {
            await client.query('SELECT pg_advisory_unlock($1)', [lockId])
        } finally {
            client.release()
        }
    }
}
