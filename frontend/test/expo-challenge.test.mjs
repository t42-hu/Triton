import assert from 'node:assert/strict'
import test from 'node:test'
import { challengeReturnUrl, challengeToken } from '../../shared/dist/index.js'
const state = '12345678-1234-1234-1234-123456789abc'
const target = 'sample-app://captcha'
test('CAPTCHA return targets are exact and callbacks must match state', () => {
    assert.equal(challengeReturnUrl(target, [target], state).href, target)
    for (const bad of ['https://evil.test/', 'sample-app://other', `${target}?redirect=evil`, `${target}#token`])
        assert.throws(() => challengeReturnUrl(bad, [target], state))
    assert.throws(() => challengeReturnUrl(target, [target], 'invalid'))
    assert.equal(challengeToken(`${target}#state=${state}&captcha=one-use-token`, target, state), 'one-use-token')
    assert.throws(() => challengeToken(`${target}#state=wrong&captcha=token`, target, state))
    assert.throws(() => challengeToken(`other-app://captcha#state=${state}&captcha=token`, target, state))
    assert.throws(() => challengeToken(`${target}#state=${state}`, target, state))
})
