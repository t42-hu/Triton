import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createServer } from 'node:net'
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stringify } from 'yaml'
import { testCompose, testEnvironment } from './test-environment.mjs'
import { resolveDockerEnvironment } from './compose.mjs'
import { serveStatic } from './static-server.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const privateRoot = resolve(root, '.cache/integration')
const browsers = resolve(process.env.PLAYWRIGHT_BROWSERS_PATH || resolve(root, '.cache/playwright'))
const [mode = 'all', ...args] = process.argv.slice(2)
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
// Never inherit the developer's application/provider settings or load their .env.
const system = Object.fromEntries(
    Object.entries(process.env).filter(([key]) =>
        /^(PATH|Path|HOME|USER|TMPDIR|TMP|TEMP|SystemRoot|COMSPEC|PATHEXT|CI|GITHUB_ACTIONS|DOCKER_HOST|DOCKER_CONTEXT|DOCKER_CONFIG|DOCKER_TLS_VERIFY|DOCKER_CERT_PATH|SSH_AUTH_SOCK|HTTPS_PROXY|HTTP_PROXY|NO_PROXY|NODE_EXTRA_CA_CERTS|npm_execpath|PLAYWRIGHT_DOWNLOAD_HOST|DISPLAY|WAYLAND_DISPLAY|XDG_RUNTIME_DIR|DBUS_SESSION_BUS_ADDRESS|CARGO_HOME|RUSTUP_HOME)$/.test(
            key,
        ),
    ),
)
let active
let interrupted = false
function onSignal() {
    interrupted = true
    const child = active
    child?.kill('SIGTERM')
    if (child) setTimeout(() => child.kill('SIGKILL'), 5000).unref()
}
process.on('SIGINT', onSignal)
process.on('SIGTERM', onSignal)

async function run(command, argv, { env = system, log, capture = false, cleanup = false, timeout = 1_200_000 } = {}) {
    if (interrupted && !cleanup) throw new Error('Test run interrupted')
    if (process.platform === 'win32' && command === 'pnpm.cmd') {
        const cli = process.env.npm_execpath
        if (!cli || !existsSync(cli)) throw new Error('Run test commands through pnpm on Windows')
        argv = [cli, ...argv]
        command = process.execPath
    }
    const output = log ? createWriteStream(log, { flags: 'a', mode: 0o600 }) : null
    let captured = ''
    try {
        await new Promise((ok, fail) => {
            const child = spawn(command, argv, {
                cwd: root,
                env: resolveDockerEnvironment(env),
                stdio: ['ignore', 'pipe', 'pipe'],
            })
            active = child
            const timer = setTimeout(() => {
                child.kill('SIGTERM')
                setTimeout(() => child.kill('SIGKILL'), 5000).unref()
            }, timeout)
            for (const [stream, target] of [
                [child.stdout, process.stdout],
                [child.stderr, process.stderr],
            ])
                stream.on('data', (chunk) => {
                    if (capture) captured += chunk.toString()
                    if (output) output.write(chunk)
                    else if (!capture) target.write(chunk)
                })
            child.once('error', fail)
            child.once('close', (code) => {
                clearTimeout(timer)
                active = undefined
                if (code === 0) ok()
                else fail(new Error(`${command} ${argv[0]} exited ${code}${log ? `; see ${log}` : ''}`))
            })
        })
    } finally {
        if (output) await new Promise((r) => output.end(r))
    }
    return captured.trim()
}
function composeArgs(state, ...command) {
    return [
        'compose',
        '--project-directory',
        root,
        '--env-file',
        state.envFile,
        '--project-name',
        state.project,
        '--file',
        state.composeFile,
        ...command,
    ]
}
async function cleanup(state) {
    const expected = resolve(privateRoot, state.project)
    if (
        !/^fullstack-test-[a-z0-9-]+$/.test(state.project) ||
        state.composeFile !== resolve(expected, 'compose.yaml') ||
        state.envFile !== resolve(expected, 'env') ||
        state.artifacts !== resolve(root, 'test-results/integration', state.project)
    )
        throw new Error('Refusing cleanup outside generated test state')
    const log = resolve(state.artifacts, 'cleanup.log')
    // The private env file is sufficient for cleanup even after a terminated runner.
    await run('docker', composeArgs(state, 'down', '--volumes', '--remove-orphans', '--timeout', '10'), {
        log,
        cleanup: true,
        timeout: 120_000,
    })
    for (const app of ['backend', 'frontend']) {
        try {
            await run('docker', ['image', 'rm', `${state.project}-${app}:test`], {
                log,
                cleanup: true,
                timeout: 60_000,
            })
        } catch {
            /* A failed build might not have created this test image. */
        }
    }
    for (const [kind, command] of [
        ['containers', ['ps', '-aq']],
        ['volumes', ['volume', 'ls', '-q']],
        ['networks', ['network', 'ls', '-q']],
        ['images', ['image', 'ls', '-aq']],
    ]) {
        const remaining = await run(
            'docker',
            [...command, '--filter', `label=com.docker.compose.project=${state.project}`],
            { capture: true, cleanup: true },
        )
        if (remaining) throw new Error(`Test ${kind} remain for ${state.project}`)
    }
    rmSync(expected, { recursive: true, force: true })
    console.log(`Cleaned isolated project ${state.project}`)
}
async function freePort() {
    return new Promise((ok, fail) => {
        const server = createServer()
        server.once('error', fail)
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port
            server.close(() => ok(port))
        })
    })
}

try {
    if (mode === 'install') {
        await run(pnpm, ['exec', 'playwright', 'install', ...args, 'chromium', 'firefox', 'webkit'], {
            env: { ...system, PLAYWRIGHT_BROWSERS_PATH: browsers },
        })
    } else if (mode === 'cleanup') {
        if (existsSync(privateRoot))
            for (const entry of readdirSync(privateRoot)) {
                const file = resolve(privateRoot, entry, 'state.json')
                if (existsSync(file)) {
                    const state = JSON.parse(readFileSync(file, 'utf8'))
                    if (!Number.isSafeInteger(state.pid) || state.pid <= 0)
                        throw new Error('Invalid test runner PID in cleanup state')
                    try {
                        process.kill(state.pid, 0)
                        console.log(`Skipping active test runner ${state.pid}`)
                        continue
                    } catch (error) {
                        if (error.code !== 'ESRCH') throw error
                    }
                    await cleanup(state)
                }
            }
    } else {
        if (!['all', 'browser', 'api'].includes(mode)) throw new Error('Use all, browser, api, install, or cleanup')
        const scanner = args.includes('--scanner')
        const browserContainer = args.includes('--browser-container')
        const native = args.includes('--native')
        if (mode === 'api' && browserContainer) throw new Error('--browser-container requires browser tests')
        const playwrightArgs = args.filter((arg) => !['--scanner', '--browser-container', '--native'].includes(arg))
        const project = `fullstack-test-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
        const privateDir = resolve(privateRoot, project)
        const artifacts = resolve(root, 'test-results/integration', project)
        mkdirSync(privateDir, { recursive: true, mode: 0o700 })
        mkdirSync(artifacts, { recursive: true })
        const port = await freePort()
        const nativePort = native ? await freePort() : null
        const env = {
            ...system,
            ...testEnvironment(project, port, scanner),
            PLAYWRIGHT_BROWSERS_PATH: browsers,
            ...(native
                ? {
                      NATIVE_AUTH_ENABLED: 'true',
                      NATIVE_APP_SCHEME: project,
                      NATIVE_TRUSTED_ORIGINS: `http://localhost:${nativePort},app://localhost`,
                      NATIVE_API_URL: `http://localhost:${port}/api`,
                      NATIVE_OUTPUT_DIR: resolve(privateDir, 'native'),
                  }
                : {}),
        }
        const state = {
            project,
            pid: process.pid,
            artifacts,
            composeFile: resolve(privateDir, 'compose.yaml'),
            envFile: resolve(privateDir, 'env'),
        }
        writeFileSync(state.composeFile, stringify(testCompose(root, project, port, scanner, browserContainer)), {
            mode: 0o600,
        })
        writeFileSync(
            state.envFile,
            Object.entries(env)
                .filter(([key]) => !Object.hasOwn(system, key))
                .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
                .join('\n'),
            { mode: 0o600 },
        )
        writeFileSync(resolve(privateDir, 'state.json'), JSON.stringify(state), {
            mode: 0o600,
        })
        const compose = (...command) =>
            run('docker', composeArgs(state, ...command), {
                env,
                log: resolve(artifacts, 'compose.log'),
            })
        console.log(`Isolated project: ${project}\nReports: ${artifacts}`)
        let failed = false
        let nativeServer
        try {
            await run('docker', ['info', '--format', '{{.ServerVersion}}'], {
                capture: true,
            })
            await run(pnpm, ['build:shared'], { env })
            await run(pnpm, ['--filter', '@fullstack-starter/backend', 'build'], {
                env,
            })
            await compose('config', '--quiet')
            console.log('Building and starting release images with isolated local providers…')
            if (native) {
                await run(process.execPath, ['infrastructure/native-build.mjs', '--isolated', '--development'], { env })
                nativeServer = await serveStatic(env.NATIVE_OUTPUT_DIR, nativePort)
            }
            await compose('up', '--build', '--detach', '--wait', '--wait-timeout', scanner ? '360' : '180')
            const hostPort = async (service, inside) =>
                Number(
                    (await run('docker', composeArgs(state, 'port', service, String(inside)), { env, capture: true }))
                        .split(':')
                        .at(-1),
                )
            const database = new URL('postgresql://localhost/platform_test')
            database.username = 'starter'
            database.password = env.POSTGRES_PASSWORD
            database.port = String(await hostPort('db', 5432))
            const testEnv = {
                ...env,
                TEST_DATABASE_URL: database.toString(),
                TEST_CACHE_URL: `redis://localhost:${await hostPort('cache', 6379)}`,
                TEST_APP_URL: env.APP_URL,
                TEST_MAIL_URL: `http://localhost:${await hostPort('mailpit', 8025)}`,
                TEST_LOCAL_SERVICES: 'true',
                TEST_ARTIFACTS: artifacts,
                TEST_RUN_ID: project,
                ...(native
                    ? {
                          TEST_NATIVE_URL: `http://localhost:${nativePort}`,
                          TEST_NATIVE_SCHEME: project,
                      }
                    : {}),
            }
            const appDatabase = new URL(database)
            appDatabase.pathname = '/starter'
            testEnv.TEST_APP_DATABASE_URL = appDatabase.toString()
            testEnv.TEST_STRIPE_WEBHOOK_SECRET = env.STRIPE_WEBHOOK_SECRET
            if (browserContainer)
                testEnv.TEST_BROWSER_WS_ENDPOINT = `ws://127.0.0.1:${await hostPort('browser', 3000)}/`
            if (mode !== 'browser') {
                for (const name of ['platform_test'])
                    await compose('exec', '-T', 'db', 'createdb', '-U', 'starter', name)
                for (const name of ['database', 'queue', 'http', ...(native ? ['native'] : [])])
                    await run(process.execPath, [`backend/test/integration/${name}.mjs`], { env: testEnv })
                // Snapshot the HTTP-created account after its reset, then prove it can log in from a restored DB.
                await compose(
                    'exec',
                    '-T',
                    'db',
                    'pg_dump',
                    '-U',
                    'starter',
                    '-d',
                    'starter',
                    '--format=custom',
                    '--file=/tmp/restore.dump',
                )
                await compose('exec', '-T', 'db', 'createdb', '-U', 'starter', 'restoration_test')
                await compose(
                    'exec',
                    '-T',
                    'db',
                    'pg_restore',
                    '-U',
                    'starter',
                    '-d',
                    'restoration_test',
                    '--no-owner',
                    '--exit-on-error',
                    '--single-transaction',
                    '/tmp/restore.dump',
                )
                database.pathname = '/restoration_test'
                await run(process.execPath, ['backend/test/integration/restore.mjs'], {
                    env: {
                        ...testEnv,
                        TEST_DATABASE_URL: database.toString(),
                        TEST_LOGIN_PASSWORD: 'Disposable-review-password-2026!-reset',
                    },
                })
                if (scanner)
                    await run(process.execPath, ['backend/test/integration/scanner.mjs'], {
                        env: {
                            ...testEnv,
                            TEST_SCANNER_PORT: String(await hostPort('virus_scanner', 3310)),
                        },
                    })
            }
            if (mode !== 'api')
                await run(pnpm, ['exec', 'playwright', 'test', ...playwrightArgs], {
                    env: testEnv,
                })
            console.log('Integration checks passed.')
        } catch (error) {
            failed = true
            console.error(error.message)
        } finally {
            if (nativeServer) {
                nativeServer.closeAllConnections()
                await new Promise((resolve) => nativeServer.close(resolve))
            }
            try {
                await run('docker', composeArgs(state, 'logs', '--no-color', '--tail', '250'), {
                    env,
                    log: resolve(artifacts, 'services.log'),
                    cleanup: true,
                    timeout: 30_000,
                })
            } catch {
                /* Cleanup still runs if log collection fails. */
            }
            await cleanup(state)
        }
        if (failed || interrupted) process.exitCode = 1
    }
} catch (error) {
    console.error(error.message)
    process.exitCode = 1
}
