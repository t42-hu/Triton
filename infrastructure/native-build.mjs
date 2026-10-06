import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'
import { cloneIdentity, loadEnvironment } from './config.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
export function cleanGeneratedConflicts(folder) {
    if (!existsSync(folder)) return
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
        const path = resolve(folder, entry.name)
        if (entry.isDirectory()) cleanGeneratedConflicts(path)
        else if (/ \d+(?=\.[^.]+$)/.test(entry.name)) rmSync(path)
    }
}
export function nativeBuildSettings(source, development = false) {
    const appId = cloneIdentity(root, source.APP_ID)
    const api = new URL(
        source.NATIVE_API_URL ||
            `${source.APP_DOMAIN ? `https://${source.APP_DOMAIN}` : source.APP_URL || 'https://example.invalid'}/api`,
    )
    const web = new URL(source.APP_DOMAIN ? `https://${source.APP_DOMAIN}` : source.APP_URL || api.origin)
    for (const url of [api, web]) {
        const local = ['localhost', '127.0.0.1', '[::1]', '10.0.2.2'].includes(url.hostname)
        if (
            url.username ||
            url.password ||
            url.search ||
            url.hash ||
            (url.protocol !== 'https:' && !(development && local && url.protocol === 'http:'))
        )
            throw new Error(
                'Native builds require HTTPS endpoints; --development permits explicit local HTTP endpoints',
            )
        if (url.hostname === 'example.invalid')
            throw new Error('Set NATIVE_API_URL and APP_URL for your hosted backend')
    }
    if (api.pathname.replace(/\/$/, '') !== '/api' || web.pathname !== '/')
        throw new Error('NATIVE_API_URL must end in /api and APP_URL must be an origin')
    const scheme = source.NATIVE_APP_SCHEME || appId
    if (
        !/^[a-z][a-z0-9.-]{2,80}$/.test(scheme) ||
        ['http', 'https', 'file', 'javascript', 'data', 'app'].includes(scheme)
    )
        throw new Error('NATIVE_APP_SCHEME must be an application-specific URL scheme')
    return {
        NEXT_PUBLIC_NATIVE: 'true',
        NEXT_PUBLIC_NATIVE_SCHEME: scheme,
        NEXT_PUBLIC_APP_ID: appId,
        NEXT_PUBLIC_APP_NAME: source.APP_NAME || 'Fullstack Starter',
        NEXT_PUBLIC_APP_URL: web.origin,
        NEXT_PUBLIC_API_URL: api.toString().replace(/\/$/, ''),
        NEXT_PUBLIC_AUTH_URL: `${api.toString().replace(/\/$/, '')}/auth`,
        NEXT_PUBLIC_APP_DESCRIPTION: source.NEXT_PUBLIC_APP_DESCRIPTION || '',
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: source.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '',
    }
}

export async function buildNative(source, { development = false, output = resolve(root, 'frontend/out-native') } = {}) {
    if (
        output !== resolve(root, 'frontend/out-native') &&
        !(output.startsWith(resolve(root, '.cache/integration') + sep) && output.endsWith(`${sep}native`))
    )
        throw new Error('Native output must be frontend/out-native or a generated integration artifact directory')
    const settings = nativeBuildSettings(source, development)
    // Stage under frontend so Node and Turbopack resolve installed dependencies on every OS.
    const cache = resolve(root, 'frontend/.cache/native-build')
    mkdirSync(cache, { recursive: true })
    const stage = mkdtempSync(resolve(cache, 'build-'))
    try {
        for (const name of ['src', 'public', 'globals.css', 'postcss.config.mjs', 'tsconfig.json', 'package.json'])
            cpSync(resolve(root, 'frontend', name), resolve(stage, name), {
                recursive: true,
                filter: (path) => path !== resolve(root, 'frontend/src/proxy.ts'),
            })
        writeFileSync(
            resolve(stage, 'next.config.mjs'),
            `export default ${JSON.stringify({
                output: 'export',
                trailingSlash: true,
                images: { unoptimized: true },
                turbopack: { root },
            })};\n`,
        )
        const environment = Object.fromEntries(
            Object.entries(process.env).filter(([key]) =>
                /^(PATH|Path|HOME|USER|TMPDIR|TMP|TEMP|SystemRoot|COMSPEC|CI)$/.test(key),
            ),
        )
        await new Promise((ok, fail) => {
            const child = spawn(
                process.execPath,
                [resolve(root, 'frontend/node_modules/next/dist/bin/next'), 'build', stage],
                {
                    cwd: root,
                    env: { ...environment, ...settings, NEXT_TELEMETRY_DISABLED: '1' },
                    stdio: 'inherit',
                },
            )
            let interrupted = false
            const cancel = () => {
                interrupted = true
                child.kill('SIGTERM')
            }
            process.once('SIGTERM', cancel)
            process.once('SIGINT', cancel)
            child.on('error', fail)
            child.on('exit', (code) => {
                process.removeListener('SIGTERM', cancel)
                process.removeListener('SIGINT', cancel)
                if (code === 0 && !interrupted) ok()
                else fail(new Error(`Native frontend build failed (${code})`))
            })
        })
        const exported = resolve(stage, 'out')
        cleanGeneratedConflicts(exported)
        const secrets = Object.entries(source)
            .filter(
                ([key, value]) =>
                    /SECRET|PASSWORD|DATABASE_URL|ACCESS_KEY/.test(key) &&
                    typeof value === 'string' &&
                    value.length >= 12,
            )
            .map(([, value]) => value)
        function inspect(folder) {
            for (const entry of readdirSync(folder, { withFileTypes: true })) {
                const path = resolve(folder, entry.name)
                if (entry.isDirectory()) inspect(path)
                else if (/\.(html|js|json|txt|map)$/.test(entry.name)) {
                    const body = readFileSync(path, 'utf8')
                    if (secrets.some((value) => body.includes(value)))
                        throw new Error('A server secret was found in the native artifact')
                }
            }
        }
        inspect(exported)
        mkdirSync(dirname(output), { recursive: true })
        rmSync(output, { recursive: true, force: true })
        cpSync(exported, output, { recursive: true })
        cleanGeneratedConflicts(output)
        writeFileSync(
            resolve(output, 'native-manifest.json'),
            JSON.stringify(
                {
                    appId: settings.NEXT_PUBLIC_APP_ID,
                    appName: settings.NEXT_PUBLIC_APP_NAME,
                    apiUrl: settings.NEXT_PUBLIC_API_URL,
                    webUrl: settings.NEXT_PUBLIC_APP_URL,
                    scheme: settings.NEXT_PUBLIC_NATIVE_SCHEME,
                    development,
                },
                null,
                2,
            ) + '\n',
        )
        console.log(`Native frontend exported to ${output}`)
    } finally {
        rmSync(stage, { recursive: true, force: true })
    }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    const args = process.argv.slice(2)
    if (args.some((arg) => !['--development', '--isolated'].includes(arg)))
        throw new Error('Use --development for local HTTP or --isolated to skip .env')
    if (!args.includes('--isolated')) loadEnvironment(resolve(root, '.env'))
    if (!existsSync(resolve(root, 'shared/dist/index.js'))) throw new Error('Run pnpm build:shared first')
    await buildNative(process.env, {
        development: args.includes('--development'),
        ...(process.env.NATIVE_OUTPUT_DIR ? { output: resolve(process.env.NATIVE_OUTPUT_DIR) } : {}),
    })
}
