import { Pool } from 'pg'
import { runMigrations } from './migrations.js'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
try {
    await runMigrations(pool)
    console.log('Database migrations completed')
} catch (error) {
    console.error(error instanceof Error ? error.message : 'Migration failed')
    process.exitCode = 1
} finally {
    await pool.end()
}
