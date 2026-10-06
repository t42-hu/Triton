import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import nextConfig from '../frontend/next.config.mjs'

/** Reads the universal application's release identity. */
function readApplicationConfig() {
    return JSON.parse(readFileSync(new URL('../frontend/universal/app.json', import.meta.url), 'utf8')).expo
}

test('all platforms use v2.0 and retain the native database identity', () => {
    const app = readApplicationConfig()
    assert.equal(app.name, 'Triton42')
    assert.equal(app.version, '2.0.0')
    assert.equal(app.ios.buildNumber, '9')
    assert.equal(app.android.versionCode, 7)
    assert.equal(app.ios.bundleIdentifier, 'hu.t42.triton')
    assert.equal(app.android.package, 'hu.t42.triton')
    assert.equal(app.web.output, 'single')
})

test('Next.js serves the universal app and preserves its SQLite isolation headers', async () => {
    const rewrites = await nextConfig.rewrites()
    assert.deepEqual(rewrites.beforeFiles[0], { source: '/', destination: '/triton/index.html' })
    assert.ok(rewrites.afterFiles.some((route) => route.source === '/api/:path*'))
    assert.ok(
        rewrites.beforeFiles.some(
            (route) => route.source === '/favicon-v15.ico' && route.destination === '/triton/favicon-v15.ico',
        ),
    )
    const headers = await nextConfig.headers()
    assert.ok(
        headers[0].headers.some(
            (header) => header.key === 'Cross-Origin-Embedder-Policy' && header.value === 'require-corp',
        ),
    )
    assert.ok(
        headers[0].headers.some(
            (header) => header.key === 'Cross-Origin-Opener-Policy' && header.value === 'same-origin',
        ),
    )
})

test('both reverse proxies support SQLite workers and remote calendar imports', () => {
    const configurations = ['../proxy/nginx.conf', '../proxy/nginx.dev.conf']
    for (const configuration of configurations) {
        const content = readFileSync(new URL(configuration, import.meta.url), 'utf8')
        assert.ok(content.includes("'wasm-unsafe-eval'"))
        assert.ok(content.includes("worker-src 'self' blob:"))
        assert.ok(content.includes("connect-src 'self' ws: wss: https:"))
    }
})
