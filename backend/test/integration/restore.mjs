import 'reflect-metadata'
import assert from 'node:assert/strict'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { createAuth } from '../../dist/auth/auth.js'
import * as schema from '../../dist/database/database.schema.js'
import { UserService } from '../../dist/user/user.service.js'
const url = new URL(process.env.TEST_DATABASE_URL || 'invalid:')
assert.ok(url.pathname.endsWith('_test'), 'Select a disposable restored database ending in _test')
assert.ok(process.env.TEST_LOGIN_PASSWORD, 'Provide the disposable account password')
const pool = new Pool({
    connectionString: url.toString(),
    options: '-c search_path=public',
})
try {
    const database = { pool, db: drizzle(pool, { schema }) }
    const auth = createAuth(database, { send: async () => {} })
    const {
        rows: [user],
    } = await pool.query('select id,email from public."user" order by created_at limit 1')
    assert.ok(user, 'The backup must contain a disposable account')
    const response = await auth.api.signInEmail({
        body: { email: user.email, password: process.env.TEST_LOGIN_PASSWORD },
        asResponse: true,
    })
    assert.equal(response.status, 200)
    const profile = await new UserService(database, {}).getCurrentUser(user.id)
    assert.equal(profile.id, user.id)
    console.log('PASS restored database supports real authentication and profile retrieval')
} finally {
    await pool.end()
}
