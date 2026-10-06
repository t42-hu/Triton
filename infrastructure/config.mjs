import { createHash } from 'node:crypto'
import { basename, resolve } from 'node:path'
import { existsSync } from 'node:fs'

export function loadEnvironment(path = '.env') {
    if (existsSync(path)) process.loadEnvFile(path)
}

export function cloneIdentity(cwd, explicit) {
    const slug =
        (explicit || basename(cwd))
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .replace(/^[^a-z]+/, '') || 'fullstack'
    if (explicit && !/^[a-z][a-z0-9-]{2,47}$/.test(explicit))
        throw new Error('APP_ID must be 3-48 lowercase letters, numbers or hyphens, starting with a letter')
    return explicit
        ? slug
        : `${slug.slice(0, 37)}-${createHash('sha256').update(resolve(cwd)).digest('hex').slice(0, 10)}`
}

export function localDatabaseUrl(source) {
    const user = source.POSTGRES_USER || 'starter'
    const password = source.POSTGRES_PASSWORD || ''
    const database = source.POSTGRES_DB || 'starter'
    const port = source.DEV_POSTGRES_PORT || '5432'
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@localhost:${port}/${encodeURIComponent(database)}`
}

export function resolveEnvironment(mode, source = process.env, cwd = process.cwd()) {
    const env = { ...source }
    env.APP_ID = cloneIdentity(cwd, env.APP_ID)
    env.APP_DOMAIN = (mode === 'production' ? env.PROD_APP_DOMAIN : env.DEV_APP_DOMAIN) || env.APP_DOMAIN || ''
    const port = mode === 'production' ? env.PROD_HTTP_PORT || '8080' : env.DEV_HTTP_PORT || '8080'
    env.APP_URL = env.APP_DOMAIN ? `https://${env.APP_DOMAIN}` : env.APP_URL || `http://localhost:${port}`
    const url = new URL(env.APP_URL)
    if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
    )
        throw new Error('APP_URL must be an HTTP(S) origin without credentials or a path')
    env.APP_URL = url.origin
    env.NEXT_PUBLIC_APP_URL = env.APP_URL
    env.NEXT_PUBLIC_APP_NAME = env.APP_NAME || 'Fullstack Starter'
    env.BETTER_AUTH_URL = `${env.APP_URL}/api/auth`
    env.COMPOSE_DATABASE_URL = `postgresql://${encodeURIComponent(env.POSTGRES_USER || 'starter')}:${encodeURIComponent(env.POSTGRES_PASSWORD || '')}@db:5432/${encodeURIComponent(env.POSTGRES_DB || 'starter')}`
    for (const key of [
        'SEARCH_ENABLED',
        'VIRUS_SCAN_ENABLED',
        'LOCAL_SERVICES_ENABLED',
        'STATSD_ENABLED',
        'EXPO_AUTH_ENABLED',
    ]) {
        env[key] ||= 'false'
        if (!['true', 'false'].includes(env[key])) throw new Error(`${key} must be true or false`)
    }
    const profiles = new Set((env.COMPOSE_PROFILES || '').split(',').filter(Boolean))
    if (env.SEARCH_ENABLED === 'true') profiles.add('search')
    if (env.VIRUS_SCAN_ENABLED === 'true') profiles.add('scanner')
    if (env.STATSD_ENABLED === 'true') profiles.add('statsd')
    if (mode === 'development' && env.LOCAL_SERVICES_ENABLED === 'true') {
        profiles.add('local')
        env.MAIL_PROVIDER ||= 'smtp'
        env.SMTP_HOST ||= 'mailpit'
        env.SMTP_PORT ||= '1025'
        const localStorage = ![
            env.R2_ENDPOINT,
            env.R2_ACCESS_KEY_ID,
            env.R2_SECRET_ACCESS_KEY,
            env.R2_BUCKET,
            env.R2_PUBLIC_URL,
        ].some(Boolean)
        if (localStorage) {
            env.R2_ENDPOINT = 'http://storage:8333'
            env.R2_REGION ||= 'us-east-1'
            env.R2_ACCESS_KEY_ID ||= 'local-development'
            env.R2_SECRET_ACCESS_KEY ||= 'local-development'
            env.R2_BUCKET ||= 'uploads'
            env.R2_PUBLIC_URL ||= `${env.APP_URL}/api/files`
            env.R2_FORCE_PATH_STYLE = 'true'
            env.STORAGE_AUTO_CREATE_BUCKET = 'true'
        }
    }
    env.COMPOSE_PROFILES = [...profiles].join(',')
    return env
}
