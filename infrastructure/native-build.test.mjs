import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { cleanGeneratedConflicts, nativeBuildSettings } from './native-build.mjs'

test('native public settings omit server secrets and require explicit secure endpoints', () => {
    const env = {
        APP_ID: 'sample-native',
        APP_URL: 'https://app.example.test',
        NATIVE_API_URL: 'https://api.example.test/api',
        DATABASE_URL: 'postgres://secret',
        BETTER_AUTH_SECRET: 'secret',
        NEXT_PUBLIC_UNREVIEWED: 'not-allowed',
    }
    const settings = nativeBuildSettings(env)
    assert.equal(settings.NEXT_PUBLIC_API_URL, env.NATIVE_API_URL)
    assert.equal(settings.NEXT_PUBLIC_NATIVE_SCHEME, env.APP_ID)
    assert.equal(settings.DATABASE_URL, undefined)
    assert.equal(settings.BETTER_AUTH_SECRET, undefined)
    assert.equal(settings.NEXT_PUBLIC_UNREVIEWED, undefined)
    for (const NATIVE_API_URL of [
        'http://api.example.test/api',
        'https://user:secret@api.example.test/api',
        'https://api.example.test/api?secret=true',
    ])
        assert.throws(() => nativeBuildSettings({ ...env, NATIVE_API_URL }))
    assert.throws(() => nativeBuildSettings({ ...env, NATIVE_APP_SCHEME: 'https' }))
    assert.throws(() => nativeBuildSettings({}))
    assert.throws(() =>
        nativeBuildSettings({
            ...env,
            NATIVE_API_URL: 'http://localhost:4000/api',
        }),
    )
    assert.ok(nativeBuildSettings({ ...env, NATIVE_API_URL: 'http://localhost:4000/api' }, true))
})

test('native bundles remove synchronization conflict copies', () => {
    const folder = mkdtempSync(resolve(tmpdir(), 'fullstack-native-conflicts-'))
    try {
        mkdirSync(resolve(folder, 'nested'))
        writeFileSync(resolve(folder, 'index.html'), 'current')
        writeFileSync(resolve(folder, 'index 2.html'), 'stale')
        writeFileSync(resolve(folder, 'nested/chunk 3.js'), 'stale')
        cleanGeneratedConflicts(folder)
        assert.ok(existsSync(resolve(folder, 'index.html')))
        assert.equal(existsSync(resolve(folder, 'index 2.html')), false)
        assert.equal(existsSync(resolve(folder, 'nested/chunk 3.js')), false)
    } finally {
        rmSync(folder, { recursive: true, force: true })
    }
})
