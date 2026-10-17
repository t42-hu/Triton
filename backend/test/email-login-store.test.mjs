import assert from 'node:assert/strict'
import test from 'node:test'
import pg from 'pg'
import { PostgresEmailLoginStore, loginDigest, loginSecret } from '../dist/auth/email-login-store.js'

test(
    'Postgres email challenges are atomic, expire, and do not parse unrelated verification data',
    { skip: process.env.TEST_EMAIL_STORE_DB !== 'true' },
    async () => {
        const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
        try {
            // Connection-local table shadows public.verification; no application data is touched.
            await pool.query('CREATE TEMP TABLE verification (LIKE public.verification INCLUDING ALL)')
            await pool.query(
                "INSERT INTO verification VALUES ('unrelated', 'unrelated', 'not-json', now() + interval '1 day', now(), now())",
            )
            const store = new PostgresEmailLoginStore(pool),
                proof = loginSecret(),
                token = loginSecret()
            await store.create(proof, token, 'test-user', false)
            assert.equal(await store.claim('wrong-proof'), null)
            assert.equal(await store.claim(proof), 'pending')
            assert.equal(await store.approve(`${loginDigest(proof)}.${loginSecret()}`), false)
            const linkToken = `${loginDigest(proof)}.${token}`
            assert.deepEqual(await Promise.all([store.approve(linkToken), store.approve(linkToken)]), [true, false])
            const claims = await Promise.all([store.claim(proof), store.claim(proof)])
            assert.equal(claims.filter((value) => value?.userId === 'test-user').length, 1)
            assert.equal(claims.filter((value) => value === null).length, 1)
            await store.create(proof, token, 'test-user', true)
            await pool.query(
                "UPDATE verification SET expires_at = now() - interval '1 minute' WHERE identifier <> 'unrelated'",
            )
            assert.equal(await store.approve(linkToken), false)
            assert.equal(await store.claim(proof), null)
            await store.cancel(proof)
            assert.equal((await pool.query('SELECT count(*) FROM verification')).rows[0].count, '1')
        } finally {
            await pool.end()
        }
    },
)
