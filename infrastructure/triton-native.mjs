import { createHash } from 'node:crypto'
import { cpSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repository = fileURLToPath(new URL('../', import.meta.url))
const excludedNames = new Set([
    'node_modules',
    '.git',
    '.env',
    '.expo',
    '.next',
    'dist',
    'build',
    'Pods',
    'output',
    'test-results',
    'playwright-report',
])

/** Copies build inputs without secrets, dependencies, or generated native projects. */
function isBuildInput(source) {
    const name = basename(source)
    if (['ios', 'android'].includes(name) && source === join(repository, 'frontend/universal', name)) return false
    return !excludedNames.has(name) && !name.startsWith('.env.')
}

/** Runs a build command and propagates its failure to the caller. */
function runCommand(command, args, cwd) {
    const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: process.env })
    if (result.error) throw result.error
    if (result.status !== 0) process.exit(result.status ?? 1)
}

/** Stages the workspace when dependency build scripts cannot handle spaces in paths. */
function stageWorkspace() {
    if (!/\s/.test(repository)) return repository
    const identity = createHash('sha256').update(repository).digest('hex').slice(0, 12)
    const destination = join(tmpdir(), `triton42-native-${identity}`)
    mkdirSync(destination, { recursive: true })
    cpSync(repository, destination, { recursive: true, filter: isBuildInput })
    runCommand('pnpm', ['install', '--frozen-lockfile'], destination)
    return destination
}

const [platform = 'stage', ...args] = process.argv.slice(2)
if (!['stage', 'ios', 'android'].includes(platform)) throw new Error('Use stage, ios, or android')
const workspace = stageWorkspace()
const application = resolve(workspace, 'frontend/universal')
if (platform === 'stage') console.log(application)
else runCommand('pnpm', ['exec', 'expo', `run:${platform}`, '--port', '8083', ...args], application)
