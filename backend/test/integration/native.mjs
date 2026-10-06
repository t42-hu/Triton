import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { Redis } from 'ioredis'
const base = process.env.TEST_APP_URL
const origin = process.env.TEST_NATIVE_URL
assert.match(process.env.TEST_RUN_ID || '', /^fullstack-test-/)
assert.ok(origin)
const hash = (value) => createHash('sha256').update(value).digest('base64url')
const random = () => randomBytes(32).toString('base64url')
async function call(path, body, headers = {}, method = 'POST') {
    return fetch(base + '/api' + path, {
        method,
        headers: { Origin: origin, 'Content-Type': 'application/json', ...headers },
        ...(method !== 'GET' ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15000),
    })
}
const account = await call(
    '/auth/sign-up/email',
    {
        name: 'Native Test',
        email: `native-${random()}@example.test`,
        password: 'Disposable-native-password-2026!',
    },
    { Origin: base },
)
assert.equal(account.status, 200, await account.clone().text())
const browserCookie = account.headers
    .getSetCookie()
    .map((v) => v.split(';')[0])
    .join('; ')
const issued = account.headers.get('set-auth-token')
assert.ok(issued)
for (const allowed of [origin, 'app://localhost']) {
    const response = await call('/users/me', null, { Origin: allowed, Authorization: `Bearer ${issued}` }, 'GET')
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('access-control-allow-origin'), allowed)
}
assert.equal(
    (await call('/users/me', null, { Authorization: `Bearer ${decodeURIComponent(issued).split('.')[0]}` }, 'GET'))
        .status,
    401,
)
console.log('PASS native signed bearer sessions, exact platform CORS, and unsigned token rejection')

const verifier = random()
const state = random()
assert.equal(
    (await call('/native-auth/start', { challenge: hash(verifier), state }, { Origin: 'https://evil.example.test' }))
        .status,
    403,
)
assert.equal(
    (
        await call('/native-auth/start', {
            challenge: hash(verifier),
            state,
            redirectUri: 'evil://auth/callback',
        })
    ).status,
    400,
)
const start = await call('/native-auth/start', {
    challenge: hash(verifier),
    state,
})
assert.equal(start.status, 201)
const { flow, browserUrl } = await start.json()
assert.equal(new URL(browserUrl).origin, base)
assert.equal((await call('/native-auth/authorize', { flow }, { Origin: base })).status, 401)
assert.equal((await call('/native-auth/authorize', { flow }, { Cookie: browserCookie })).status, 403)
const approved = await call('/native-auth/authorize', { flow }, { Origin: base, Cookie: browserCookie })
assert.equal(approved.status, 201)
const { callbackUrl } = await approved.json()
const callback = new URL(callbackUrl)
assert.equal(callback.protocol, `${process.env.TEST_NATIVE_SCHEME}:`)
assert.equal(callback.searchParams.has('token'), false)
const code = callback.searchParams.get('code')
for (const bad of [{ verifier: random() }, { state: random() }, { code: '0'.repeat(64) }])
    assert.equal(
        (
            await call('/native-auth/exchange', {
                flow,
                code,
                verifier,
                state,
                ...bad,
            })
        ).status,
        400,
    )
assert.equal((await call('/native-auth/authorize', { flow }, { Origin: base, Cookie: browserCookie })).status, 400)
const deliveries = await Promise.all(
    Array.from({ length: 5 }, () => call('/native-auth/exchange', { flow, code, verifier, state })),
)
assert.equal(deliveries.filter((r) => r.status === 201).length, 1)
assert.equal(deliveries.filter((r) => r.status === 400).length, 4)
const { token } = await deliveries.find((r) => r.status === 201).json()
assert.notEqual(token, issued)
assert.equal((await call('/users/me', null, { Authorization: `Bearer ${token}` }, 'GET')).status, 200)
assert.equal((await call('/auth/sign-out', {}, { Authorization: `Bearer ${token}` })).status, 200)
assert.equal((await call('/users/me', null, { Authorization: `Bearer ${token}` }, 'GET')).status, 401)
assert.equal((await call('/users/me', null, { Origin: base, Cookie: browserCookie }, 'GET')).status, 200)
console.log('PASS PKCE/state binding, consent origin, one-time concurrent exchange, and independent native revocation')

const expired = await (await call('/native-auth/start', { challenge: hash(verifier), state })).json()
const redis = new Redis(process.env.TEST_CACHE_URL)
try {
    const key = `native-auth:${process.env.TEST_RUN_ID}:${expired.flow}`
    assert.ok((await redis.ttl(key)) > 0)
    await redis.expire(key, 0)
    assert.equal(
        (await call('/native-auth/authorize', { flow: expired.flow }, { Origin: base, Cookie: browserCookie })).status,
        400,
    )
} finally {
    await redis.quit()
}
console.log('PASS expired browser authorization cannot create a native session')

const resetStart = await (
    await call('/native-auth/start', {
        intent: 'password-reset',
        challenge: hash(verifier),
        state,
    })
).json()
assert.equal(
    (await call('/native-auth/authorize', { flow: resetStart.flow }, { Origin: base, Cookie: browserCookie })).status,
    400,
)
const resetToken = random()
const resetResponse = await call(
    '/native-auth/reset-handoff',
    { flow: resetStart.flow, token: resetToken },
    { Origin: base },
)
assert.equal(resetResponse.status, 201)
const resetCallback = new URL((await resetResponse.json()).callbackUrl)
assert.equal(resetCallback.pathname, '/reset')
assert.equal(resetCallback.searchParams.has('token'), false)
assert.equal(resetCallback.toString().includes(resetToken), false)
const resetBody = {
    flow: resetStart.flow,
    code: resetCallback.searchParams.get('code'),
    state,
    verifier,
}
assert.equal((await call('/native-auth/exchange', { ...resetBody, verifier: random() })).status, 400)
const resetExchange = await call('/native-auth/exchange', resetBody)
assert.equal(resetExchange.status, 201)
assert.deepEqual(await resetExchange.json(), { resetToken })
assert.equal((await call('/native-auth/exchange', resetBody)).status, 400)
console.log('PASS password-reset links carry only one-time PKCE-bound codes and cannot mint sessions')
