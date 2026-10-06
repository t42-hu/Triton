import 'reflect-metadata'
import assert from 'node:assert/strict'
import test from 'node:test'
import { applicationOrigin, trustedOrigins } from '@fullstack-starter/shared'
import { RateLimitGuard } from '../dist/rate-limit/rate-limit.guard.js'

test('auth and CORS share exact configurable origins', () => {
    const env = {
        APP_URL: 'http://localhost:18080',
        TRUSTED_ORIGINS: 'http://localhost:13000,http://localhost:18080',
    }
    assert.equal(applicationOrigin(env), 'http://localhost:18080')
    assert.deepEqual(trustedOrigins(env), ['http://localhost:18080', 'http://localhost:13000'])
})
test('direct host startup derives its origin from the selected local port', () => {
    const env = {
        DEV_HTTP_PORT: '18081',
        NEXT_PUBLIC_APP_URL: 'http://localhost:8080',
        BETTER_AUTH_URL: 'http://localhost:8080/api/auth',
    }
    assert.equal(applicationOrigin(env), 'http://localhost:18081')
    assert.deepEqual(trustedOrigins(env), ['http://localhost:18081'])
})
test('liveness does not touch Redis or consume quotas', async () => {
    const guard = new RateLimitGuard({
        consume() {
            throw new Error('Redis unavailable')
        },
    })
    const context = {
        getType: () => 'http',
        switchToHttp: () => ({
            getRequest: () => ({ method: 'GET', path: '/api/health/live' }),
            getResponse: () => ({}),
        }),
    }
    assert.equal(await guard.canActivate(context), true)
})
test('readiness consumes a quota and rejects excess requests', async () => {
    const consumedKeys = []
    const guard = new RateLimitGuard({
        consume: async (key) => {
            consumedKeys.push(key)
            return { allowed: false, limit: 1, count: 2, resetSeconds: 30 }
        },
    })
    for (const url of ['/api/health', '/api/health?details=1']) {
        const headers = {}
        const context = {
            getType: () => 'http',
            switchToHttp: () => ({
                getRequest: () => ({ method: 'GET', path: '/api/health', url, ip: '192.0.2.1' }),
                getResponse: () => ({
                    setHeader: (key, value) => {
                        headers[key] = value
                    },
                }),
            }),
        }
        await assert.rejects(() => guard.canActivate(context), { status: 429 })
        assert.equal(headers['Retry-After'], '30')
        assert.equal(headers['X-RateLimit-Remaining'], '0')
    }
    assert.deepEqual(consumedKeys, ['rate-limit:192.0.2.1:GET:_api_health', 'rate-limit:192.0.2.1:GET:_api_health'])
})
test('ordinary routes still enforce rate limits', async () => {
    const guard = new RateLimitGuard({
        consume: async () => ({
            allowed: false,
            limit: 1,
            count: 1,
            resetSeconds: 60,
        }),
    })
    const headers = {}
    const context = {
        getType: () => 'http',
        switchToHttp: () => ({
            getRequest: () => ({
                method: 'GET',
                path: '/api/config',
                ip: '127.0.0.1',
            }),
            getResponse: () => ({
                setHeader: (k, v) => {
                    headers[k] = v
                },
            }),
        }),
    }
    await assert.rejects(() => guard.canActivate(context), /Rate limit exceeded/)
    assert.equal(headers['Retry-After'], '60')
})
