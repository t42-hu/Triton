import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { parse } from 'yaml'
import { resolveEnvironment } from './config.mjs'

export function testEnvironment(project, port, scanner = false) {
    if (!/^fullstack-test-[a-z0-9-]+$/.test(project)) throw new Error('Invalid isolated test project')
    return resolveEnvironment('development', {
        APP_ID: project,
        APP_NAME: 'Fullstack Starter',
        APP_URL: `http://localhost:${port}`,
        POSTGRES_USER: 'starter',
        POSTGRES_DB: 'starter',
        POSTGRES_PASSWORD: randomBytes(24).toString('hex'),
        BETTER_AUTH_SECRET: randomBytes(48).toString('hex'),
        SEARCH_ENGINE_MASTER_KEY: randomBytes(24).toString('hex'),
        LOCAL_SERVICES_ENABLED: 'true',
        SEARCH_ENABLED: 'false',
        VIRUS_SCAN_ENABLED: String(scanner),
        MAIL_FROM: 'Fullstack Test <noreply@example.test>',
        RATE_LIMIT_MAX_REQUESTS: '1000',
        // Signature verification is entirely local; this is not a usable provider key.
        STRIPE_SECRET_KEY: 'sk_test_isolated_not_a_real_key',
        STRIPE_WEBHOOK_SECRET: `whsec_${randomBytes(32).toString('hex')}`,
        STRIPE_ALLOWED_PRICE_IDS: 'price_isolated_not_a_real_price',
    })
}

export function testCompose(root, project, port, scanner = false, browserContainer = false) {
    const production = parse(readFileSync(resolve(root, 'docker-compose.prod.yml'), 'utf8'), { merge: true })
    const development = parse(readFileSync(resolve(root, 'docker-compose.dev.yml'), 'utf8'), { merge: true })
    const services = Object.fromEntries(
        ['proxy', 'frontend', 'backend', 'migrate', 'db', 'cache'].map((name) => [name, production.services[name]]),
    )
    for (const name of ['mailpit', 'storage', ...(scanner ? ['virus_scanner'] : [])])
        services[name] = development.services[name]
    for (const service of Object.values(services)) {
        delete service.profiles
        service.networks = ['starter']
        service.restart = 'no'
        delete service.ports
    }
    services.proxy.ports = [`127.0.0.1:${port}:80`]
    services.db.ports = ['127.0.0.1::5432']
    services.cache.ports = ['127.0.0.1::6379']
    services.mailpit.ports = ['127.0.0.1::8025']
    if (scanner) services.virus_scanner.ports = ['127.0.0.1::3310']
    services.backend.image = `${project}-backend:test`
    services.migrate.image = services.backend.image
    // Both services execute the same release artifact. Building it twice with
    // different Compose labels leaves an untagged image after every test run.
    delete services.migrate.build
    services.migrate.pull_policy = 'never'
    services.frontend.image = `${project}-frontend:test`
    // Use release images; only the API mode differs to allow isolated local S3/mail.
    services.backend.environment.NODE_ENV = 'development'
    services.backend.depends_on.mailpit = { condition: 'service_healthy' }
    services.backend.depends_on.storage = { condition: 'service_healthy' }
    if (scanner)
        services.backend.depends_on.virus_scanner = {
            condition: 'service_healthy',
        }
    if (browserContainer) {
        const version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).devDependencies[
            '@playwright/test'
        ]
        if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Pin an exact Playwright version for container browsers')
        services.browser = {
            image: `mcr.microsoft.com/playwright:v${version}-noble`,
            init: true,
            user: 'pwuser',
            working_dir: '/home/pwuser',
            command: ['npx', '--yes', `playwright@${version}`, 'run-server', '--port', '3000', '--host', '0.0.0.0'],
            ports: ['127.0.0.1::3000'],
            networks: ['starter'],
            restart: 'no',
            shm_size: '1gb',
            healthcheck: {
                test: [
                    'CMD',
                    'node',
                    '-e',
                    "fetch('http://127.0.0.1:3000').then(()=>process.exit(0)).catch(()=>process.exit(1))",
                ],
                interval: '2s',
                timeout: '3s',
                retries: 60,
            },
        }
    }
    const volumes = Object.fromEntries(
        ['db-data', 'redis-data', 'storage-data', ...(scanner ? ['virus-scanner-data'] : [])].map((name) => [
            name,
            null,
        ]),
    )
    return { services, volumes, networks: { starter: { driver: 'bridge' } } }
}
