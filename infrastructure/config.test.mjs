import assert from 'node:assert/strict'
import test from 'node:test'
import { cloneIdentity, localDatabaseUrl, resolveEnvironment } from './config.mjs'

test('same-named clones have distinct default identities', () => {
    assert.notEqual(cloneIdentity('/one/Fullstack'), cloneIdentity('/two/Fullstack'))
    assert.equal(cloneIdentity('/one/Fullstack', 'my-product'), 'my-product')
    assert.throws(() => cloneIdentity('/one', 'Invalid ID'), /APP_ID/)
})
test('custom ports consistently determine public/auth URLs', () => {
    const env = resolveEnvironment('development', { DEV_HTTP_PORT: '18080', APP_NAME: 'Acme' }, '/tmp/acme')
    assert.equal(env.APP_URL, 'http://localhost:18080')
    assert.equal(env.BETTER_AUTH_URL, 'http://localhost:18080/api/auth')
    assert.equal(env.NEXT_PUBLIC_APP_NAME, 'Acme')
})
test('local database URL follows configured user, password, database, and port', () => {
    const url = new URL(
        localDatabaseUrl({
            POSTGRES_USER: 'student@example',
            POSTGRES_PASSWORD: 'a:/@?#% x',
            POSTGRES_DB: 'my db',
            DEV_POSTGRES_PORT: '15432',
        }),
    )
    assert.equal(decodeURIComponent(url.username), 'student@example')
    assert.equal(decodeURIComponent(url.password), 'a:/@?#% x')
    assert.equal(decodeURIComponent(url.pathname), '/my db')
    assert.equal(url.port, '15432')
})
test('application identity fields override obsolete derived values', () => {
    const env = resolveEnvironment('development', {
        APP_NAME: 'New Product',
        APP_URL: 'https://product.example',
        NEXT_PUBLIC_APP_NAME: 'Old Name',
        NEXT_PUBLIC_APP_URL: 'https://old.example',
        BETTER_AUTH_URL: 'https://old.example/api/auth',
    })
    assert.equal(env.NEXT_PUBLIC_APP_NAME, 'New Product')
    assert.equal(env.NEXT_PUBLIC_APP_URL, 'https://product.example')
    assert.equal(env.BETTER_AUTH_URL, 'https://product.example/api/auth')
})
test('database credentials are encoded without changing their values', () => {
    const env = resolveEnvironment(
        'production',
        {
            POSTGRES_USER: 'name@example',
            POSTGRES_PASSWORD: 'a:/@?#% x',
            POSTGRES_DB: 'my db',
        },
        '/tmp/acme',
    )
    const url = new URL(env.COMPOSE_DATABASE_URL)
    assert.equal(decodeURIComponent(url.username), 'name@example')
    assert.equal(decodeURIComponent(url.password), 'a:/@?#% x')
    assert.equal(decodeURIComponent(url.pathname), '/my db')
})
test('feature profiles and local providers are derived explicitly', () => {
    const source = {
        LOCAL_SERVICES_ENABLED: 'true',
        SEARCH_ENABLED: 'true',
        VIRUS_SCAN_ENABLED: 'true',
        STATSD_ENABLED: 'true',
    }
    const env = resolveEnvironment('development', source, '/tmp/acme')
    assert.equal(env.COMPOSE_PROFILES, 'search,scanner,statsd,local')
    assert.equal(env.SMTP_HOST, 'mailpit')
    assert.equal(env.STORAGE_AUTO_CREATE_BUCKET, 'true')
    assert.equal(resolveEnvironment('production', source, '/tmp/acme').R2_ENDPOINT, undefined)
    assert.throws(() => resolveEnvironment('development', { SEARCH_ENABLED: 'yes' }), /SEARCH_ENABLED/)
    assert.throws(() => resolveEnvironment('production', { STATSD_ENABLED: 'yes' }), /STATSD_ENABLED/)
    assert.ok(!resolveEnvironment('production', { STATSD_ENABLED: '' }).COMPOSE_PROFILES.includes('statsd'))
})
test('domain overrides and explicit external providers are preserved', () => {
    const env = resolveEnvironment('development', {
        DEV_APP_DOMAIN: 'dev.example.com',
        LOCAL_SERVICES_ENABLED: 'true',
        R2_ENDPOINT: 'https://objects.example.com',
        MAIL_PROVIDER: 'ses',
    })
    assert.equal(env.APP_URL, 'https://dev.example.com')
    assert.equal(env.R2_ENDPOINT, 'https://objects.example.com')
    assert.equal(env.MAIL_PROVIDER, 'ses')
})

test('long checkout names still yield valid application identities', () => {
    const id = cloneIdentity('/tmp/' + 'a'.repeat(100))
    assert.ok(id.length <= 48)
    assert.equal(cloneIdentity('/tmp/unused', id), id)
})
