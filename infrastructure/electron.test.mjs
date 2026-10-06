import assert from 'node:assert/strict'
import test from 'node:test'
import { electronSettings } from './electron.mjs'

const source = {
    APP_ID: 'sample-desktop',
    APP_NAME: 'Sample Desktop',
    APP_VERSION: '1.2.3',
    APP_URL: 'https://app.example.test',
    NATIVE_API_URL: 'https://api.example.test/api',
    NATIVE_APP_SCHEME: 'sample-desktop',
    ELECTRON_MAINTAINER: 'Sample Team <desktop@example.test>',
    DATABASE_URL: 'postgres://secret',
}

test('Electron identity follows the clone and public settings omit backend secrets', () => {
    const settings = electronSettings(source)
    assert.deepEqual(settings, {
        appId: 'sample-desktop',
        appName: 'Sample Desktop',
        appVersion: '1.2.3',
        maintainer: 'Sample Team <desktop@example.test>',
        bundleId: 'com.example.sampledesktop',
        apiUrl: 'https://api.example.test/api',
        webUrl: 'https://app.example.test',
        scheme: 'sample-desktop',
        development: false,
    })
    assert.equal(settings.DATABASE_URL, undefined)
    assert.throws(() => electronSettings({ ...source, ELECTRON_BUNDLE_ID: 'bad/id' }))
    assert.throws(() => electronSettings({ ...source, ELECTRON_BUNDLE_ID: 'com.example.invalid_id' }))
    assert.throws(() => electronSettings({ ...source, APP_VERSION: '1.2' }))
    assert.throws(() => electronSettings({ ...source, ELECTRON_MAINTAINER: 'wrong' }))
    assert.throws(() => electronSettings({ ...source, NATIVE_API_URL: 'http://api.example.test/api' }))
    assert.ok(
        electronSettings(
            { ...source, NATIVE_API_URL: 'http://localhost:8080/api', APP_URL: 'http://localhost:8080' },
            true,
        ),
    )
})
