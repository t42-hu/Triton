import assert from 'node:assert/strict'
import test from 'node:test'
import { validateEnvironment } from '../dist/config/environment.js'

const productionEnvironment = {
    NODE_ENV: 'production',
    APP_DOMAIN: 'example.com',
    BETTER_AUTH_SECRET: 'a-production-auth-secret-with-more-than-32-characters',
    BETTER_AUTH_URL: 'https://example.com/api/auth',
    CACHE_URL: 'redis://cache:6379',
    DATABASE_URL: 'postgresql://starter:a-unique-database-password@db:5432/starter',
    RATE_LIMIT_MAX_REQUESTS: '100',
    RATE_LIMIT_WINDOW_SECONDS: '60',
    SEARCH_ENGINE_MASTER_KEY: 'a-unique-search-master-key',
    SEARCH_ENGINE_URL: 'http://search_engine:7700',
}

test('native authentication requires exact origins and a dedicated application scheme', () => {
    const env = {
        ...productionEnvironment,
        NATIVE_AUTH_ENABLED: 'true',
        NATIVE_APP_SCHEME: 'com.example.product',
        NATIVE_TRUSTED_ORIGINS: 'app://localhost',
    }
    assert.equal(validateEnvironment(env), env)
    for (const NATIVE_TRUSTED_ORIGINS of [
        '',
        '*',
        'null',
        'https://*.example.test',
        'unknown://evil',
        'app://localhost/path',
    ])
        assert.throws(() => validateEnvironment({ ...env, NATIVE_TRUSTED_ORIGINS }))
    assert.throws(() => validateEnvironment({ ...env, NATIVE_APP_SCHEME: 'https' }))
})

test('Expo authentication accepts a clone scheme and exact web origin', () => {
    const env = {
        ...productionEnvironment,
        APP_ID: 'test-app',
        EXPO_AUTH_ENABLED: 'true',
        EXPO_WEB_ORIGIN: 'https://expo.example.com',
    }
    assert.equal(validateEnvironment(env), env)
    assert.throws(() => validateEnvironment({ ...env, EXPO_APP_SCHEME: 'https' }))
    assert.throws(() => validateEnvironment({ ...env, EXPO_WEB_ORIGIN: 'https://*.example.com' }))
})

test('accepts a complete production environment', () => {
    assert.equal(validateEnvironment(productionEnvironment), productionEnvironment)
})

test('blank optional mail provider stays disabled in production', () => {
    const env = { ...productionEnvironment, MAIL_PROVIDER: '' }
    assert.equal(validateEnvironment(env), env)
})

test('rejects starter secrets in production', () => {
    assert.throws(
        () =>
            validateEnvironment({
                ...productionEnvironment,
                BETTER_AUTH_SECRET: 'local-development-secret-change-in-production',
                DATABASE_URL: 'postgresql://starter:starter-local-password@db:5432/starter',
                SEARCH_ENGINE_MASTER_KEY: 'starter_dev_master_key',
            }),
        /Invalid production configuration/,
    )
})

test('rejects partially configured optional integrations', () => {
    assert.throws(
        () =>
            validateEnvironment({
                ...productionEnvironment,
                STRIPE_SECRET_KEY: 'sk_test_example',
            }),
        /Stripe must define all of/,
    )
})

test('validates development configuration and exact application origins', () => {
    const env = {
        ...productionEnvironment,
        NODE_ENV: 'development',
        APP_DOMAIN: '',
        APP_URL: 'http://localhost:18080',
    }
    assert.equal(validateEnvironment(env), env)
    for (const APP_URL of [
        'invalid',
        '',
        'http://localhost:18080/path',
        'http://name:secret@localhost:18080',
        'http://localhost:18080?query=1',
    ])
        assert.throws(() => validateEnvironment({ ...env, APP_URL }), /APP_URL/)
    assert.throws(
        () =>
            validateEnvironment({
                ...env,
                SEARCH_ENABLED: 'true',
                SEARCH_ENGINE_URL: '',
            }),
        /enabled search requires/,
    )
    assert.throws(() => validateEnvironment({ ...env, SMTP_USER: 'partial' }), /SMTP credentials/)
    assert.throws(
        () =>
            validateEnvironment({
                ...env,
                TRUSTED_ORIGINS: 'https://*.example.test',
            }),
        /trusted URLs/,
    )
})

test('validates structured log and OpenTelemetry settings', () => {
    assert.equal(
        validateEnvironment({
            ...productionEnvironment,
            LOG_LEVEL: 'debug',
            OTEL_ENABLED: 'true',
            OTEL_SERVICE_NAME: 'starter.backend',
            OTEL_EXPORTER_OTLP_ENDPOINT: 'https://otel.example.test',
        }).LOG_LEVEL,
        'debug',
    )
    assert.throws(() => validateEnvironment({ ...productionEnvironment, LOG_LEVEL: 'verbose' }))
    assert.throws(() =>
        validateEnvironment({
            ...productionEnvironment,
            OTEL_EXPORTER_OTLP_ENDPOINT: 'collector:4318',
        }),
    )
})
