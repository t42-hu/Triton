import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'

const base = process.env.TEST_APP_URL || 'http://localhost:18080'
const origin = new URL(base).origin
const localServices = process.env.TEST_LOCAL_SERVICES !== 'false'
let cookie = ''
async function request(path, { method = 'GET', body, authenticated = false, headers = {} } = {}) {
    return fetch(base + path, {
        method,
        redirect: 'manual',
        signal: AbortSignal.timeout(15000),
        headers: {
            Origin: origin,
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...(authenticated ? { Cookie: cookie } : {}),
            ...headers,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    })
}
async function check(name, action) {
    try {
        await action()
        console.log('PASS', name)
    } catch (error) {
        console.log('FAIL', name, error.message)
        process.exitCode = 1
    }
}

await check('home page and security headers', async () => {
    const r = await request('/')
    assert.equal(r.status, 200)
    assert.ok(r.headers.get('content-security-policy'))
    assert.ok((await r.text()).includes('Fullstack Starter'))
})
await check('readiness', async () => {
    const r = await request('/api/health')
    assert.equal(r.status, 200)
    assert.deepEqual(await r.json(), { status: 'ok' })
})
await check('request correlation and stable errors', async () => {
    const requestId = 'integration-request-1'
    const ok = await request('/api/config', {
        headers: { 'x-request-id': requestId },
    })
    assert.equal(ok.headers.get('x-request-id'), requestId)
    const missing = await request('/api/does-not-exist', {
        headers: { 'x-request-id': requestId },
    })
    assert.equal(missing.status, 404)
    assert.equal(missing.headers.get('x-request-id'), requestId)
    assert.deepEqual(await missing.json(), {
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Cannot GET /api/does-not-exist',
        requestId,
    })
    const replaced = await request('/api/config', {
        headers: { 'x-request-id': 'invalid request id' },
    })
    assert.match(replaced.headers.get('x-request-id'), /^[0-9a-f]{8}-[0-9a-f-]{27}$/)
})
await check('public configuration', async () => {
    const r = await request('/api/config')
    assert.equal(r.status, 200)
    const config = await r.json()
    assert.deepEqual(config.socialProviders, [])
    assert.equal(config.features.passwordReset, localServices)
    assert.equal(config.features.uploads, localServices)
})
await check('unauthenticated API protection', async () => {
    assert.equal((await request('/api/users/me')).status, 401)
})
await check('unauthenticated profile redirect', async () => {
    const r = await request('/profile')
    assert.equal(r.status, 307)
    assert.ok(r.headers.get('location').includes('/login'))
})
const email = `review-${Date.now()}@example.test`
const password = 'Disposable-review-password-2026!'
await check('email registration and session cookie', async () => {
    const r = await request('/api/auth/sign-up/email', {
        method: 'POST',
        body: { name: 'Review User', email, password },
    })
    assert.equal(r.status, 200)
    cookie = r.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; ')
    assert.ok(cookie)
    assert.equal((await r.json()).user.email, email)
})
await check('authenticated profile read', async () => {
    const r = await request('/api/users/me', { authenticated: true })
    assert.equal(r.status, 200)
    assert.equal((await r.json()).name, 'Review User')
})
await check('profile validation', async () => {
    const r = await request('/api/users/me', {
        method: 'PATCH',
        authenticated: true,
        body: { name: 'x' },
    })
    assert.equal(r.status, 400)
})
await check('profile update', async () => {
    const r = await request('/api/users/me', {
        method: 'PATCH',
        authenticated: true,
        body: { name: 'Review Updated' },
    })
    assert.equal(r.status, 200)
    assert.equal((await r.json()).name, 'Review Updated')
})
await check('reject foreign image ownership', async () => {
    const r = await request('/api/users/me', {
        method: 'PATCH',
        authenticated: true,
        body: { imageKey: 'profile-images/someone-else/test.webp' },
    })
    assert.equal(r.status, 400)
})
await check('reject unsigned Stripe webhook', async () => {
    assert.equal(
        (
            await request('/api/payments/webhooks/stripe', {
                method: 'POST',
                body: {},
            })
        ).status,
        400,
    )
})
if (process.env.TEST_STRIPE_WEBHOOK_SECRET)
    await check('signed HTTP webhook, concurrent replay, tampering, and expiry', async () => {
        assert.match(process.env.TEST_RUN_ID || '', /^fullstack-test-/)
        const { Pool } = await import('pg')
        const pool = new Pool({
            connectionString: process.env.TEST_APP_DATABASE_URL,
        })
        const id = `evt_${randomUUID()}`
        const payload = JSON.stringify({
            id,
            object: 'event',
            type: 'integration.signature_test',
            data: { object: { id: 'isolated' } },
        })
        const sign = (time) =>
            `t=${time},v1=${createHmac('sha256', process.env.TEST_STRIPE_WEBHOOK_SECRET).update(`${time}.${payload}`).digest('hex')}`
        const now = Math.floor(Date.now() / 1000)
        const send = (body, signature) =>
            fetch(base + '/api/payments/webhooks/stripe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'stripe-signature': signature,
                },
                body,
                signal: AbortSignal.timeout(15000),
            })
        try {
            assert.equal((await send(payload + ' ', sign(now))).status, 400)
            assert.equal((await send(payload, sign(now - 600))).status, 400)
            assert.equal(
                (await pool.query('select count(*)::int as count from payment_event where id = $1', [id])).rows[0]
                    .count,
                0,
            )
            const responses = await Promise.all(Array.from({ length: 4 }, () => send(payload, sign(now))))
            for (const response of responses) {
                assert.equal(response.status, 201, await response.clone().text())
                assert.deepEqual(await response.json(), { received: true })
            }
            const { rows } = await pool.query('select processed_at from payment_event where id = $1', [id])
            assert.equal(rows.length, 1)
            assert.ok(rows[0].processed_at)
        } finally {
            await pool.end()
        }
    })
await check('reject unconfigured checkout price', async () => {
    assert.equal(
        (
            await request('/api/payments/checkout/sessions', {
                method: 'POST',
                authenticated: true,
                body: { priceId: 'price_unknown', requestId: crypto.randomUUID() },
            })
        ).status,
        400,
    )
})
await check('logout revokes session', async () => {
    assert.equal(
        (
            await request('/api/auth/sign-out', {
                method: 'POST',
                authenticated: true,
                body: {},
            })
        ).status,
        200,
    )
    assert.equal((await request('/api/users/me', { authenticated: true })).status, 401)
})
await check('email login', async () => {
    const r = await request('/api/auth/sign-in/email', {
        method: 'POST',
        body: { email, password },
    })
    assert.equal(r.status, 200)
    assert.equal((await r.json()).user.email, email)
    cookie = r.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; ')
})

await check('authenticated frontend route uses clone-specific cookie', async () => {
    assert.equal((await request('/profile', { authenticated: true })).status, 200)
})
await check('reject untrusted origin', async () => {
    const r = await request('/api/auth/sign-in/email', {
        method: 'POST',
        body: { email, password },
        headers: { Origin: 'https://untrusted.example.test' },
    })
    assert.equal(r.status, 403)
})
if (localServices)
    await check('local S3 upload, profile association, serving, and removal', async () => {
        const sharp = (await import('sharp')).default
        const png = await sharp({
            create: { width: 10, height: 10, channels: 3, background: '#4080ff' },
        })
            .png()
            .toBuffer()
        const form = new FormData()
        form.append('file', new Blob([png], { type: 'image/png' }), 'test.png')
        const response = await fetch(base + '/api/profile-images/optimize', {
            method: 'POST',
            headers: { Origin: origin, Cookie: cookie },
            body: form,
        })
        assert.equal(response.status, 201, await response.clone().text())
        const { key, publicUrl } = await response.json()
        assert.equal(new URL(publicUrl).origin, origin)
        assert.equal(
            (
                await request('/api/users/me', {
                    method: 'PATCH',
                    body: { imageKey: key },
                    authenticated: true,
                })
            ).status,
            200,
        )
        const image = await fetch(publicUrl)
        assert.equal(image.status, 200)
        assert.equal(image.headers.get('content-type'), 'image/webp')
        // A real uploaded key belonging to another authenticated account must fail.
        const other = await request('/api/auth/sign-up/email', {
            method: 'POST',
            body: {
                name: 'Other Account',
                email: `owner-${randomUUID()}@example.test`,
                password,
            },
        })
        assert.equal(other.status, 200)
        const otherCookie = other.headers
            .getSetCookie()
            .map((value) => value.split(';')[0])
            .join('; ')
        assert.equal(
            (
                await request('/api/users/me', {
                    method: 'PATCH',
                    body: { imageKey: key },
                    headers: { Cookie: otherCookie },
                })
            ).status,
            400,
        )
        assert.equal((await fetch(publicUrl)).status, 200, 'Rejected ownership must not remove the original image')
        assert.equal(
            (
                await request('/api/users/me', {
                    method: 'PATCH',
                    body: { imageKey: null },
                    authenticated: true,
                })
            ).status,
            200,
        )
        const invalid = new FormData()
        invalid.append('file', new Blob(['fake'], { type: 'image/png' }), 'fake.png')
        assert.equal(
            (
                await fetch(base + '/api/profile-images/optimize', {
                    method: 'POST',
                    headers: { Origin: origin, Cookie: cookie },
                    body: invalid,
                })
            ).status,
            400,
        )
        for (const [mime, content, expected] of [
            ['text/plain', png, 400],
            ['image/png', Buffer.alloc(5 * 1024 * 1024 + 1), 413],
        ]) {
            const rejected = new FormData()
            rejected.append('file', new Blob([content], { type: mime }), 'rejected.png')
            assert.equal(
                (
                    await fetch(base + '/api/profile-images/optimize', {
                        method: 'POST',
                        headers: { Origin: origin, Cookie: cookie },
                        body: rejected,
                        signal: AbortSignal.timeout(15000),
                    })
                ).status,
                expected,
                `Reject ${mime} upload of ${content.length} bytes`,
            )
        }
    })
if (localServices)
    await check('password reset delivery through Mailpit and new-password login', async () => {
        const reset = await request('/api/auth/request-password-reset', {
            method: 'POST',
            body: { email, redirectTo: origin + '/reset-password' },
        })
        assert.equal(reset.status, 200)
        const mail = process.env.TEST_MAIL_URL || 'http://localhost:18025'
        let message
        for (let i = 0; i < 20; i++) {
            const messages = await (await fetch(mail + '/api/v1/messages')).json()
            message = messages.messages.find((m) => m.To.some((t) => t.Address === email))
            if (message) break
            await new Promise((r) => setTimeout(r, 250))
        }
        assert.ok(message, 'Reset email must be delivered locally')
        const detail = await (await fetch(mail + '/api/v1/message/' + message.ID)).json()
        const link = (detail.Text || detail.HTML).match(/https?:[^\s<>"']+\/api\/auth\/reset-password\/[^\s<>"']+/)?.[0]
        assert.ok(link, 'Reset link in email')
        const redirect = await fetch(link.replaceAll('&amp;', '&'), {
            redirect: 'manual',
        })
        const target = new URL(redirect.headers.get('location'))
        assert.equal(target.origin, origin)
        const token = target.searchParams.get('token')
        assert.ok(token)
        const newPassword = password + '-reset'
        assert.equal(
            (
                await request('/api/auth/reset-password', {
                    method: 'POST',
                    body: { token, newPassword },
                })
            ).status,
            200,
        )
        assert.equal(
            (
                await request('/api/auth/sign-in/email', {
                    method: 'POST',
                    body: { email, password: newPassword },
                })
            ).status,
            200,
        )
        assert.equal(
            (
                await request('/api/auth/sign-in/email', {
                    method: 'POST',
                    body: { email, password },
                })
            ).status,
            401,
        )
    })
await check('liveness stays outside request quotas while readiness is limited', async () => {
    for (let i = 0; i < 105; i++) assert.equal((await request('/api/health/live')).status, 200)
    const readiness = await request('/api/health')
    assert.equal(readiness.status, 200)
    assert.equal(readiness.headers.get('x-ratelimit-limit'), '1000')
    assert.ok(Number(readiness.headers.get('x-ratelimit-remaining')) < 1000)
})
