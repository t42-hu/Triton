import sharp from 'sharp'
import assert from 'node:assert/strict'
// Run only against a disposable development/test environment with CAPTCHA disabled.
const base = (process.env.TEST_APP_URL || 'http://localhost:4042').replace(/\/$/, '') + '/api'
let cookie = ''
let bearer = ''
async function call(path, body, auth = true) {
    const r = await fetch(base + path, {
        method: body ? 'POST' : 'GET',
        headers: {
            'Content-Type': 'application/json',
            Origin: process.env.TEST_ORIGIN || 'http://localhost:3042',
            ...(auth && bearer ? { Authorization: `Bearer ${bearer}` } : {}),
            ...(cookie ? { Cookie: cookie } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const data = await r.json()
    const issued = r.headers.get('set-auth-token')
    const cookies = r.headers.getSetCookie()
    cookie =
        cookies
            .filter((c) => c.split(';')[0].split('=')[1])
            .map((c) => c.split(';')[0])
            .join('; ') || cookie
    if (issued) bearer = issued
    return { r, data }
}
async function approveLatestEmail(email) {
    const inbox = process.env.TEST_MAILPIT_URL || 'http://localhost:8025'
    const messages = await (await fetch(`${inbox}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json()
    assert.ok(messages.messages.length, 'Expected a login email in Mailpit')
    const message = await (await fetch(`${inbox}/api/v1/message/${messages.messages[0].ID}`)).json()
    const url = new URL(message.Text.match(/https?:\/\/[^\s]+\/api\/auth\/two-factor\/email\/approve\?token=[^\s]+/)[0])
    const target = new URL(url.pathname + url.search, base)
    const approved = await fetch(target)
    assert.equal(approved.status, 200)
    assert.equal(approved.headers.get('set-auth-token'), null)
    assert.equal((await fetch(target)).status, 400, 'Email links must be single-use')
    const result = await call('/auth/two-factor/email/status', {})
    assert.equal(result.r.status, 200)
    assert.ok(result.r.headers.get('set-auth-token'))
}
const password = 'Account-Check-2026-42!'
const email = `triton.account.${Date.now()}@example.test`
let result = await call('/auth/sign-up/email', { email, password, name: 'Account check' })
assert.equal(result.r.status, 200)
assert.equal(result.data.twoFactorRedirect, true)
assert.equal(result.r.headers.get('set-auth-token'), null)
assert.equal((await call('/auth/get-session')).data, null)
await approveLatestEmail(email)
result = await call('/calendar/calendars', { name: 'Account deletion fixture' })
assert.equal(result.r.status, 201)
const calendarId = result.data.id
result = await call('/calendar/events', {
    calendarId,
    title: 'Account event',
    startsAt: '2026-10-08T08:00:00Z',
    endsAt: '2026-10-08T09:00:00Z',
})
assert.equal(result.r.status, 201)
const form = new FormData()
form.append(
    'file',
    new Blob(
        [
            await sharp({ create: { width: 64, height: 64, channels: 4, background: '#4682b4' } })
                .png()
                .toBuffer(),
        ],
        { type: 'image/png' },
    ),
    'fixture.png',
)
const upload = await fetch(base + '/profile-images/optimize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearer}`, Origin: process.env.TEST_ORIGIN || 'http://localhost:3042' },
    body: form,
})
assert.equal(upload.status, 201, await upload.clone().text())
const image = await upload.json()
let profile = await fetch(base + '/users/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Renamed account', imageKey: image.key }),
})
assert.equal(profile.status, 200)
assert.equal((await profile.json()).name, 'Renamed account')
result = await call('/auth/get-session')
assert.equal(result.data.user.name, 'Renamed account')
assert.equal(result.data.user.image, image.publicUrl)
profile = await fetch(base + '/users/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageKey: null }),
})
assert.equal(profile.status, 200)
assert.equal((await profile.json()).profileImage, null)
await call('/auth/sign-out', {})
cookie = ''
bearer = ''
result = await call('/auth/sign-in/email', { email, password })
assert.equal(result.data.twoFactorRedirect, true)
assert.equal(result.r.headers.get('set-auth-token'), null)
assert.equal((await call('/auth/get-session')).data, null)
assert.equal((await call('/auth/two-factor/email/status', {})).data.pending, true)
await approveLatestEmail(email)
result = await call('/auth/change-password', {
    currentPassword: password,
    newPassword: password + '2',
    revokeOtherSessions: true,
})
assert.equal(result.r.status, 200)
assert.equal(result.data.pending, true)
const inbox = process.env.TEST_MAILPIT_URL || 'http://localhost:8025'
const messages = await (await fetch(`${inbox}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json()
const message = await (await fetch(`${inbox}/api/v1/message/${messages.messages[0].ID}`)).json()
const confirmation = new URL(message.Text.match(/https?:\/\/[^\s]+\/api\/auth\/password-change\/confirm\?token=[^\s]+/)[0])
const target = new URL(confirmation.pathname + confirmation.search, base)
assert.equal((await fetch(target)).status, 200)
// The explicit POST is required; scanning the link must leave the old password valid.
assert.equal((await call('/auth/two-factor/email/settings', { enabled: false, password })).r.status, 200)
const confirm = () => fetch(target, { method: 'POST', headers: { Origin: process.env.TEST_ORIGIN || 'http://localhost:3042', 'Content-Type': 'application/x-www-form-urlencoded' }, body: '' })
assert.equal((await confirm()).status, 200)
assert.equal((await confirm()).status, 400)
result = await call('/auth/delete-user', { password: password + '2' })
assert.equal(result.r.status, 200)
console.log(
    'PASS: avatar upload/removal, rename, account data cascade, email approval, password-only session denied, single-use links, bearer issuance, password change, disposable account deletion.',
)
