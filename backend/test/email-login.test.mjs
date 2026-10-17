import assert from 'node:assert/strict'
import test from 'node:test'
import { betterAuth } from 'better-auth'
import { memoryAdapter } from 'better-auth/adapters/memory'
import { bearer } from 'better-auth/plugins/bearer'
import { accountSecurity } from '../dist/auth/account-security.js'
import { emailLogin } from '../dist/auth/email-login.js'
import { loginDigest } from '../dist/auth/email-login-store.js'

class TestStore {
    records = new Map()
    async create(proof, token, userId, remember) {
        this.records.set(loginDigest(proof), {
            userId,
            remember,
            tokenHash: loginDigest(token),
            approved: false,
            expires: Date.now() + 600000,
        })
    }
    async approve(token) {
        const [key, secret, extra] = token.split('.')
        const record = this.records.get(key)
        if (
            !record ||
            extra ||
            record.expires <= Date.now() ||
            record.approved ||
            record.tokenHash !== loginDigest(secret || '')
        )
            return false
        record.approved = true
        return true
    }
    async claim(proof) {
        const key = loginDigest(proof),
            record = this.records.get(key)
        if (!record || record.expires <= Date.now()) return null
        if (!record.approved) return 'pending'
        this.records.delete(key)
        return record
    }
    async cancel(proof) {
        this.records.delete(loginDigest(proof))
    }
}
function fixture() {
    const database = { user: [], session: [], account: [], verification: [] }
    const changes = new Map()
    const passwords = {
        async create(token, change) { changes.clear(); changes.set(token, change); return true },
        async cancel(token) { changes.delete(token) },
        async confirm(token) {
            const change = changes.get(token); changes.delete(token)
            if (!change) return false
            const account = database.account.find(a => a.id === change.accountId)
            if (account.password !== change.oldHash) return false
            account.password = change.newHash
            database.session = database.session.filter(s => s.userId !== change.userId || s.id === change.sessionId)
            return true
        },
    }
    const store = new TestStore(),
        sent = []
    let failMail = false
    const auth = betterAuth({
        baseURL: 'http://localhost:4042',
        basePath: '/api/auth',
        secret: 'test-only-secret-at-least-thirty-two-characters',
        database: memoryAdapter(database),
        emailAndPassword: { enabled: true },
        rateLimit: { enabled: false },
        plugins: [
            accountSecurity(passwords, { send: async mail => { if (failMail) throw Error('SMTP unavailable'); sent.push(mail) } }, 'http://localhost:4042'),
            emailLogin(
                store,
                {
                    send: async (mail) => {
                        if (failMail) throw Error('SMTP unavailable')
                        sent.push(mail)
                    },
                },
                'http://localhost:4042',
            ),
            bearer({ requireSignature: true }),
        ],
    })
    function client() {
        const cookies = new Map()
        return {
            cookies,
            async call(path, body, form = false) {
                const response = await auth.handler(
                    new Request(`http://localhost:4042/api/auth${path}`, {
                        method: body === undefined ? 'GET' : 'POST',
                        headers: {
                            Origin: 'http://localhost:4042',
                            Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
                            'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json',
                        },
                        ...(body === undefined ? {} : { body: form ? '' : JSON.stringify(body) }),
                    }),
                )
                for (const header of response.headers.getSetCookie()) {
                    const [name, ...parts] = header.split(';')[0].split('=')
                    if (header.toLowerCase().includes('max-age=0')) cookies.delete(name)
                    else cookies.set(name, parts.join('='))
                }
                return {
                    response,
                    data: response.headers.get('content-type')?.includes('application/json')
                        ? await response.json()
                        : await response.text(),
                }
            },
        }
    }
    const link = () =>
        sent
            .at(-1)
            .text.match(/http:\/\/localhost:4042\/api\/auth\/two-factor\/email\/approve\?token=[^\s]+/)[0]
            .replace('http://localhost:4042/api/auth', '')
    return {
        auth,
        store,
        changes,
        database,
        sent,
        client,
        link,
        fail: () => {
            failMail = true
        },
    }
}
const credentials = { email: 'email-login@example.test', password: 'Test-password-only-42', name: 'Test account' }

test('password and email approval are both required; email browser never receives a session', async () => {
    const f = fixture(),
        original = f.client(),
        emailBrowser = f.client()
    const signup = await original.call('/sign-up/email', credentials)
    assert.equal(signup.response.status, 200)
    assert.equal(signup.data.twoFactorRedirect, true)
    assert.equal(signup.response.headers.get('set-auth-token'), null)
    assert.equal((await original.call('/get-session')).data, null)
    assert.equal((await original.call('/two-factor/email/status', {})).data.pending, true)
    assert.equal((await emailBrowser.call('/two-factor/email/status', {})).response.status, 401)
    const link = f.link()
    assert.equal((await emailBrowser.call(link.replace(/.$/, 'x'))).response.status, 400)
    const approved = await emailBrowser.call(link)
    assert.equal(approved.response.status, 200)
    assert.equal(approved.response.headers.get('set-auth-token'), null)
    assert.equal((await emailBrowser.call('/get-session')).data, null)
    assert.equal((await emailBrowser.call(link)).response.status, 400)
    const claimed = await original.call('/two-factor/email/status', {})
    assert.equal(claimed.response.status, 200)
    assert.ok(claimed.response.headers.get('set-auth-token'))
    assert.equal((await original.call('/get-session')).data.user.emailVerified, true)
    assert.equal((await original.call('/two-factor/email/status', {})).response.status, 401)
    await original.call('/sign-out', {})
    const login = await original.call('/sign-in/email', credentials)
    assert.equal(login.data.twoFactorRedirect, true)
    assert.equal(login.response.headers.get('set-auth-token'), null)
    assert.equal(f.sent.length, 2)
    assert.notEqual(f.link(), link)
    assert.equal((await original.call('/get-session')).data, null)
})

test('cancellation, expiry and replacement invalidate the email link', async () => {
    const f = fixture(),
        client = f.client(),
        mail = f.client()
    await client.call('/sign-up/email', credentials)
    const cancelled = f.link()
    await client.call('/two-factor/email/cancel', {})
    assert.equal((await mail.call(cancelled)).response.status, 400)
    await client.call('/sign-in/email', credentials)
    const old = f.link()
    await client.call('/sign-in/email', credentials)
    assert.equal((await mail.call(old)).response.status, 400)
    for (const record of f.store.records.values()) record.expires = 0
    assert.equal((await mail.call(f.link())).response.status, 400)
    assert.equal((await client.call('/two-factor/email/status', {})).response.status, 401)
})

test('delivery failure fails closed and invalid passwords send no mail', async () => {
    const f = fixture(),
        client = f.client()
    await client.call('/sign-up/email', credentials)
    await client.call('/two-factor/email/cancel', {})
    assert.equal(
        (await client.call('/sign-in/email', { ...credentials, password: 'incorrect-password' })).response.status,
        401,
    )
    assert.equal(f.sent.length, 1)
    f.fail()
    assert.equal((await client.call('/sign-in/email', credentials)).response.status, 503)
    assert.equal((await client.call('/get-session')).data, null)
    assert.equal(f.store.records.size, 0)
})

async function signedIn(f) {
    const client = f.client()
    await client.call('/sign-up/email', { ...credentials, twoFactorEnabled: false })
    await f.client().call(f.link())
    await client.call('/two-factor/email/status', {})
    return client
}

test('2FA can be disabled and enabled only with the current password; signup cannot bypass it', async () => {
    const f = fixture(), client = await signedIn(f)
    assert.equal((await client.call('/get-session')).data.user.twoFactorEnabled, true)
    assert.equal((await f.client().call('/two-factor/email/settings', { enabled: false, password: credentials.password })).response.status, 401)
    assert.equal((await client.call('/two-factor/email/settings', { enabled: false, password: 'incorrect-password' })).response.status, 400)
    assert.equal((await client.call('/two-factor/email/settings', { enabled: false, password: credentials.password })).response.status, 200)
    assert.equal((await client.call('/get-session')).data.user.twoFactorEnabled, false)
    // Generic user updates cannot bypass the protected setting.
    await client.call('/update-user', { twoFactorEnabled: true })
    assert.equal((await client.call('/get-session')).data.user.twoFactorEnabled, false)
    await client.call('/sign-out', {})
    const count = f.sent.length
    assert.equal((await client.call('/sign-in/email', credentials)).data.twoFactorRedirect, undefined)
    assert.ok((await client.call('/get-session')).data.user)
    assert.equal(f.sent.length, count)
    await client.call('/two-factor/email/settings', { enabled: true, password: credentials.password })
    await client.call('/sign-out', {})
    assert.equal((await client.call('/sign-in/email', credentials)).data.twoFactorRedirect, true)
})

for (const enabled of [true, false]) test(`password changes require email approval with 2FA ${enabled}`, async () => {
    const f = fixture(), client = await signedIn(f)
    await client.call('/two-factor/email/settings', { enabled, password: credentials.password })
    const oldHash = f.database.account[0].password
    const body = { currentPassword: credentials.password, newPassword: 'New-test-password-43', revokeOtherSessions: true }
    assert.equal((await f.client().call('/change-password', body)).response.status, 401)
    assert.equal((await client.call('/change-password', { ...body, currentPassword: 'wrong-password' })).response.status, 400)
    const result = await client.call('/change-password', body)
    assert.equal(result.response.status, 200)
    assert.equal(result.data.pending, true)
    assert.equal(f.database.account[0].password, oldHash)
    const pending = [...f.changes.values()][0]
    assert.notEqual(pending.newHash, body.newPassword)
    const link = f.sent.at(-1).text.match(/http:\/\/localhost:4042[^\s]+/)[0].replace('http://localhost:4042/api/auth', '')
    assert.equal((await f.client().call(link)).response.status, 200)
    assert.equal(f.database.account[0].password, oldHash, 'GET and email scanners cannot apply the password')
    assert.equal((await f.client().call(link, {}, true)).response.status, 200)
    assert.notEqual(f.database.account[0].password, oldHash)
    assert.equal((await f.client().call(link, {}, true)).response.status, 400)
    assert.equal((await f.client().call('/sign-in/email', credentials)).response.status, 401)
    assert.equal((await f.client().call('/sign-in/email', { ...credentials, password: body.newPassword })).response.status, 200)
})

test('failed password confirmation email leaves the current password unchanged', async () => {
    const f = fixture(), client = await signedIn(f), oldHash = f.database.account[0].password
    f.fail()
    assert.equal((await client.call('/change-password', { currentPassword: credentials.password, newPassword: 'Another-test-password-44' })).response.status, 503)
    assert.equal(f.database.account[0].password, oldHash)
    assert.equal(f.changes.size, 0)
})


test('native challenge cookies require trusted Origin and issue a bearer after email approval', async () => {
    const f = fixture(), client = f.client()
    await client.call('/sign-up/email', credentials)
    const cookie = [...client.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
    const poll = origin => f.auth.handler(new Request('http://localhost:4042/api/auth/two-factor/email/status', {
        method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: '{}',
    }))
    assert.equal((await poll()).status, 403)
    assert.equal((await poll('https://untrusted.example')).status, 403)
    assert.equal((await (await poll('http://localhost:4042')).json()).pending, true)
    await f.client().call(f.link())
    const approved = await poll('http://localhost:4042')
    assert.equal(approved.status, 200)
    assert.equal((await approved.json()).pending, false)
    assert.ok(approved.headers.get('set-auth-token'))
})
