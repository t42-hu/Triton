import sharp from 'sharp'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
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
function totp(secret) {
    let bits = ''
    for (const c of secret.toUpperCase())
        bits += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c).toString(2).padStart(5, '0')
    const bytes = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)))
    const step = Buffer.alloc(8)
    step.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)))
    const h = createHmac('sha1', bytes).update(step).digest()
    const offset = h[19] & 15
    return String((h.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0')
}
const password = 'Account-Check-2026-42!'
const email = `triton.account.${Date.now()}@example.test`
let result = await call('/auth/sign-up/email', { email, password, name: 'Account check' })
assert.equal(result.r.status, 200)
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
result = await call('/auth/two-factor/enable', { password })
assert.equal(result.r.status, 200)
const codes = result.data.backupCodes
const secret = new URL(result.data.totpURI).searchParams.get('secret')
result = await call('/auth/two-factor/verify-totp', { code: totp(secret) })
assert.equal(result.r.status, 200)
result = await call('/auth/get-session')
assert.equal(result.data.user.twoFactorEnabled, true)
await call('/auth/sign-out', {})
cookie = ''
bearer = ''
result = await call('/auth/sign-in/email', { email, password })
assert.equal(result.data.twoFactorRedirect, true)
assert.equal(result.r.headers.get('set-auth-token'), null)
result = await call('/auth/get-session')
assert.equal(result.data, null)
result = await call('/auth/two-factor/verify-totp', {
    code: String((Number(totp(secret)) + 1) % 1000000).padStart(6, '0'),
})
assert.notEqual(result.r.status, 200)
result = await call('/auth/two-factor/verify-backup-code', { code: codes[0] })
assert.equal(result.r.status, 200)
assert.ok(result.r.headers.get('set-auth-token'))
result = await call('/auth/two-factor/verify-backup-code', { code: codes[0] })
assert.notEqual(result.r.status, 200, 'Recovery codes must be single-use')
result = await call('/auth/change-password', {
    currentPassword: password,
    newPassword: password + '2',
    revokeOtherSessions: true,
})
assert.equal(result.r.status, 200)
result = await call('/auth/delete-user', { password: password + '2' })
assert.equal(result.r.status, 200)
console.log(
    'PASS: avatar upload/removal, rename, account data cascade, TOTP enrollment, password-only session denied, incorrect OTP denied, recovery login, bearer issuance, password change, disposable account deletion.',
)
