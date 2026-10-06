import { spawn } from 'node:child_process'
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { pnpmCommand } from './process.mjs'
import { loadEnvironment } from './config.mjs'
import { buildNative, nativeBuildSettings } from './native-build.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const desktop = resolve(root, 'desktop')

export function electronSettings(source, development = false) {
    const native = nativeBuildSettings(source, development)
    const appId = native.NEXT_PUBLIC_APP_ID
    const appName = source.APP_NAME || 'Fullstack Starter'
    const appVersion = source.APP_VERSION || '0.1.0'
    const maintainer = source.ELECTRON_MAINTAINER?.trim() || undefined
    const bundleId = source.ELECTRON_BUNDLE_ID || `com.example.${appId.replaceAll('-', '')}`
    if (!/^[a-zA-Z][a-zA-Z0-9-]*(\.[a-zA-Z][a-zA-Z0-9-]*){2,}$/.test(bundleId) || bundleId.length > 180)
        throw new Error('ELECTRON_BUNDLE_ID must be a reverse-DNS identifier')
    if (
        !appName ||
        appName.length > 50 ||
        /[<>:"/\\|?*]/.test(appName) ||
        [...appName].some((char) => char.charCodeAt(0) < 32)
    )
        throw new Error('APP_NAME must be a portable application name of 1–50 characters')
    if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(appVersion))
        throw new Error('APP_VERSION must contain three numeric parts')
    if (maintainer && !/^[^<>\s][^<>]* <[^@\s<>]+@[^@\s<>]+>$/.test(maintainer))
        throw new Error('ELECTRON_MAINTAINER must be Name <email@example.com>')
    if (process.platform === 'linux' && !maintainer)
        throw new Error('Set ELECTRON_MAINTAINER=Name <email@example.com> for Linux packages')
    return {
        appId,
        appName,
        appVersion,
        ...(maintainer ? { maintainer } : {}),
        bundleId,
        apiUrl: native.NEXT_PUBLIC_API_URL,
        webUrl: native.NEXT_PUBLIC_APP_URL,
        scheme: native.NEXT_PUBLIC_NATIVE_SCHEME,
        development,
    }
}

export async function prepareElectron(source, development = false) {
    const settings = electronSettings(source, development)
    await buildNative(source, { development })
    const renderer = resolve(desktop, 'renderer')
    rmSync(renderer, { recursive: true, force: true })
    cpSync(resolve(root, 'frontend/out-native'), renderer, { recursive: true })
    const generated = resolve(desktop, '.generated')
    mkdirSync(generated, { recursive: true })
    writeFileSync(resolve(generated, 'config.json'), `${JSON.stringify(settings, null, 2)}\n`)
    await sharp(resolve(root, source.ELECTRON_ICON || 'frontend/public/logo.svg'))
        .resize(1024, 1024, { fit: 'contain', background: '#00000000' })
        .png()
        .toFile(resolve(generated, 'icon.png'))
    return settings
}

async function runDesktop(command) {
    await new Promise((resolveRun, reject) => {
        const environment = { ...process.env }
        delete environment.ELECTRON_RUN_AS_NODE
        const invocation = pnpmCommand(['--filter', 'fullstack-starter-desktop', command])
        const child = spawn(invocation.command, invocation.args, {
            cwd: root,
            env: environment,
            stdio: 'inherit',
        })
        child.once('error', reject)
        child.once('exit', (code) =>
            code === 0 ? resolveRun() : reject(new Error(`Electron ${command} exited ${code}`)),
        )
    })
}

export async function electronMain(args = process.argv.slice(2), source = process.env) {
    const [mode = 'prepare', ...flags] = args
    if (
        !['prepare', 'dev', 'package', 'make'].includes(mode) ||
        flags.some((flag) => !['--development', '--isolated'].includes(flag))
    )
        throw new Error('Use prepare, dev, package, or make; optional --development and --isolated')
    if (!flags.includes('--isolated')) loadEnvironment(resolve(root, '.env'))
    const development = mode === 'dev' || flags.includes('--development')
    await prepareElectron(source, development)
    if (mode !== 'prepare') await runDesktop(mode === 'dev' ? 'start' : mode)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await electronMain()
