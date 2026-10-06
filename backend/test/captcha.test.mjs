import assert from 'node:assert/strict'
import test from 'node:test'
import { captcha } from 'better-auth/plugins'

test('email authentication requires CAPTCHA and verifies provider responses and hostname', async (t) => {
    let calls = 0
    let verified = true
    let hostname = 'app.example.test'
    t.mock.method(globalThis, 'fetch', async (url, init) => {
        assert.equal(String(url), 'https://challenges.cloudflare.com/turnstile/v0/siteverify')
        assert.equal(JSON.parse(init.body).response, 'one-use-token')
        calls++
        return Response.json({ success: verified, hostname })
    })
    const plugin = captcha({
        provider: 'cloudflare-turnstile',
        secretKey: 'test-secret',
        allowedHostnames: ['app.example.test'],
    })
    const context = { options: { basePath: '/api/auth' }, logger: { error() {} } }
    for (const endpoint of ['sign-in/email', 'sign-up/email']) {
        const url = `https://app.example.test/api/auth/${endpoint}`
        const missing = await plugin.onRequest(new Request(url, { method: 'POST' }), context)
        assert.equal(missing.response.status, 400)
        const request = new Request(url, { method: 'POST', headers: { 'x-captcha-response': 'one-use-token' } })
        verified = true
        hostname = 'app.example.test'
        assert.equal(await plugin.onRequest(request, context), undefined)
        verified = false
        assert.equal((await plugin.onRequest(request, context)).response.status, 403)
        verified = true
        hostname = 'untrusted.example.test'
        assert.equal((await plugin.onRequest(request, context)).response.status, 403)
    }
    assert.equal(calls, 6)
})
