import assert from 'node:assert/strict'
import test from 'node:test'
import pg from 'pg'
import { PostgresPasswordChangeStore } from '../dist/auth/password-change-store.js'
import { loginSecret } from '../dist/auth/email-login-store.js'

test('Postgres password confirmation: atomic, expiry, replacement, stale hashes and session revocation', { skip: process.env.TEST_EMAIL_STORE_DB !== 'true' }, async () => {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
    try {
        // Isolated connection-local tables; real users and credentials are never changed.
        await pool.query('CREATE TEMP TABLE verification (LIKE public.verification INCLUDING ALL)')
        await pool.query('CREATE TEMP TABLE account (id text PRIMARY KEY, user_id text, password text, updated_at timestamptz)')
        await pool.query('CREATE TEMP TABLE "user" (id text PRIMARY KEY, email text)')
        await pool.query('CREATE TEMP TABLE session (id text PRIMARY KEY, user_id text)')
        await pool.query(`INSERT INTO "user" VALUES ('u', 'fixture@example.test'); INSERT INTO account VALUES ('a', 'u', 'old-hash', now()); INSERT INTO session VALUES ('original', 'u'), ('other', 'u'); INSERT INTO verification VALUES ('unrelated', 'unrelated', 'not-json', now() + interval '1 day', now(), now())`)
        const store = new PostgresPasswordChangeStore(pool)
        const change = { userId: 'u', email: 'fixture@example.test', accountId: 'a', oldHash: 'old-hash', newHash: 'new-hash', sessionId: 'original' }
        const first = loginSecret(), second = loginSecret()
        assert.equal(await store.create(first, change), true)
        assert.equal((await pool.query('SELECT password FROM account')).rows[0].password, 'old-hash')
        assert.equal(await store.confirm(loginSecret()), false)
        await store.create(second, change)
        assert.equal(await store.confirm(first), false)
        await pool.query("UPDATE verification SET expires_at = now() - interval '1 second' WHERE identifier LIKE 'password-change-%'")
        assert.equal(await store.confirm(second), false)
        await store.create(first, change)
        await pool.query("UPDATE account SET password = 'reset-hash'")
        assert.equal(await store.confirm(first), false, 'password reset invalidates pending approvals')
        assert.equal(await store.create(first, change), false, 'stale requests cannot be stored')
        await pool.query("UPDATE account SET password = 'old-hash'")
        await store.create(first, change)
        await pool.query(`INSERT INTO verification VALUES ('login', 'email-login-fixture', '{"userId":"u"}', now() + interval '1 day', now(), now())`)
        assert.deepEqual(await Promise.all([store.confirm(first), store.confirm(first)]), [true, false])
        assert.equal((await pool.query('SELECT password FROM account')).rows[0].password, 'new-hash')
        assert.deepEqual((await pool.query('SELECT id FROM session')).rows, [{ id: 'original' }])
        assert.deepEqual((await pool.query('SELECT id FROM verification')).rows, [{ id: 'unrelated' }])
        await store.create(second, { ...change, oldHash: 'new-hash' })
        await pool.query(`UPDATE "user" SET email = 'changed@example.test'`)
        assert.equal(await store.confirm(second), false, 'email changes invalidate pending approvals')
    } finally { await pool.end() }
})
