import 'reflect-metadata'
import assert from 'node:assert/strict'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import Stripe from 'stripe'
import { runMigrations } from '../../dist/database/migrations.js'
import { PaymentService } from '../../dist/payment/payment.service.js'
import * as schema from '../../dist/database/database.schema.js'

const url = new URL(process.env.TEST_DATABASE_URL || 'invalid:')
assert.ok(url.pathname.endsWith('_test'), 'TEST_DATABASE_URL must select a disposable database ending in _test')
const pool = new Pool({
    connectionString: url.toString(),
    options: '-c search_path=public',
})
try {
    await pool.query('CREATE TABLE "user" (id text primary key)')
    await pool.query('INSERT INTO "user" VALUES (\'preserved\')')
    await assert.rejects(runMigrations(pool), /Unmanaged database/)
    assert.equal((await pool.query('SELECT id FROM "user"')).rows[0].id, 'preserved')
    await pool.query('DROP TABLE "user"')
    console.log('PASS unmanaged database refusal preserves data')
    await Promise.all([runMigrations(pool), runMigrations(pool), runMigrations(pool)])
    const tables = (
        await pool.query("select tablename from pg_tables where schemaname='public' order by tablename")
    ).rows.map((r) => r.tablename)
    assert.deepEqual(tables, [
        'account',
        'billing_customer',
        'payment',
        'payment_event',
        'session',
        'user',
        'verification',
    ])
    console.log('PASS concurrent migrations and clean schema')
    await pool.query(
        'INSERT INTO "user" (id,name,email,created_at,updated_at) VALUES ($1,$2,$3,now(),now()),($4,$2,$5,now(),now())',
        ['user_one', 'Same Name', 'one@example.test', 'user_two', 'two@example.test'],
    )
    console.log('PASS duplicate display names')
    await pool.query("INSERT INTO billing_customer VALUES ('user_one','cus_test')")
    await pool.query('CREATE TABLE product_effect (id text primary key)')
    let fail = false
    const handler = {
        async handle(event, tx) {
            await tx.execute(sql`insert into product_effect (id) values (${event.id})`)
            if (fail) throw new Error('simulated product failure')
        },
    }
    const payment = new PaymentService({ db: drizzle(pool, { schema }) }, handler)
    process.env.STRIPE_SECRET_KEY = 'sk_test_disposable'
    let customersCreated = 0
    const checkoutKeys = []
    payment.client = {
        customers: {
            create: async () => {
                customersCreated++
                return { id: 'cus_second' }
            },
        },
        checkout: {
            sessions: {
                create: async (body, options) => {
                    assert.equal(body.customer, 'cus_second')
                    checkoutKeys.push(options.idempotencyKey)
                    return { id: 'cs_repeat' }
                },
            },
        },
    }
    process.env.STRIPE_ALLOWED_PRICE_IDS = 'price_allowed'
    await Promise.all(
        Array.from({ length: 6 }, () =>
            payment.createCheckoutSession(
                {
                    priceId: 'price_allowed',
                    requestId: 'c4c91dc4-309e-431f-84a7-0d8f18c0ac0f',
                },
                'user_two',
                'two@example.test',
            ),
        ),
    )
    assert.equal(customersCreated, 1)
    assert.equal(new Set(checkoutKeys).size, 1)
    assert.equal(
        (await pool.query("select stripe_customer_id from billing_customer where user_id='user_two'")).rows[0]
            .stripe_customer_id,
        'cus_second',
    )
    payment.client = undefined
    console.log('PASS concurrent customer linkage and repeated checkout idempotency keys')
    const event = (id, type, status) => ({
        id,
        type,
        data: {
            object: {
                id: 'cs_test',
                customer: 'cus_test',
                metadata: { userId: 'user_one' },
                payment_status: status,
                currency: 'eur',
                amount_total: 1234,
            },
        },
    })
    const paid = event('evt_paid', 'checkout.session.completed', 'paid')
    await Promise.all(Array.from({ length: 8 }, () => payment.handleWebhookEvent(paid)))
    assert.equal((await pool.query('select count(*)::int as count from product_effect')).rows[0].count, 1)
    await payment.handleWebhookEvent(event('evt_late', 'checkout.session.async_payment_failed', 'unpaid'))
    assert.equal((await pool.query('select status from payment')).rows[0].status, 'paid')
    console.log('PASS concurrent webhook deduplication and out-of-order delivery')
    fail = true
    await assert.rejects(() => payment.handleWebhookEvent(event('evt_retry', 'test.event', 'unpaid')), /simulated/)
    assert.equal(
        (await pool.query("select count(*)::int as count from payment_event where id='evt_retry'")).rows[0].count,
        0,
    )
    assert.equal(
        (await pool.query("select count(*)::int as count from product_effect where id='evt_retry'")).rows[0].count,
        0,
    )
    fail = false
    await payment.handleWebhookEvent(event('evt_retry', 'test.event', 'unpaid'))
    console.log('PASS transactional rollback and retry')
    process.env.STRIPE_SECRET_KEY = 'sk_test_disposable'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_disposable'
    const payload = JSON.stringify(paid)
    const signature = Stripe.webhooks.generateTestHeaderString({
        payload,
        secret: process.env.STRIPE_WEBHOOK_SECRET,
    })
    assert.equal(payment.constructWebhookEvent(payload, signature).id, paid.id)
    assert.throws(() => payment.constructWebhookEvent(payload + ' ', signature), /Invalid Stripe signature/)
    console.log('PASS webhook signature and payload-tampering checks')

    await runMigrations(pool)
    console.log('PASS repeated migration preserves current data')
} finally {
    await pool.end()
}
