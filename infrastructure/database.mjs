import { spawn } from 'node:child_process'
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { loadEnvironment, resolveEnvironment } from './config.mjs'
import { buildComposeArguments, resolveDockerEnvironment } from './compose.mjs'

const [action, mode = 'development', filename] = process.argv.slice(2)
function run(args, stdio = 'inherit') {
    const child = spawn('docker', args, {
        env: resolveDockerEnvironment(),
        stdio,
    })
    const done = new Promise((resolve, reject) => {
        child.once('error', reject)
        child.once('exit', (code) =>
            code === 0 ? resolve() : reject(new Error(`Database command exited with ${code}`)),
        )
    })
    return { child, done }
}
try {
    if (!['backup', 'restore'].includes(action))
        throw new Error('Usage: pnpm db:backup|db:restore <development|production> [file.dump]')
    loadEnvironment(process.env.ENV_FILE || '.env')
    Object.assign(process.env, resolveEnvironment(mode))
    const user = process.env.POSTGRES_USER || 'starter'
    const database = process.env.POSTGRES_DB || 'starter'
    const compose = buildComposeArguments(mode, ['exec', '-T', 'db'])
    if (action === 'backup') {
        mkdirSync('backups', { recursive: true, mode: 0o700 })
        const path = resolve(filename || `backups/${process.env.APP_ID}-${mode}-${Date.now()}.dump`)
        if (existsSync(path)) throw new Error('Backup already exists; choose a new filename')
        const partial = `${path}.partial`
        const { child, done } = run(
            [...compose, 'pg_dump', '-U', user, '-d', database, '--format=custom', '--no-owner'],
            ['ignore', 'pipe', 'inherit'],
        )
        try {
            await Promise.all([pipeline(child.stdout, createWriteStream(partial, { flags: 'wx', mode: 0o600 })), done])
            renameSync(partial, path)
            console.log(`Backup written: ${path}`)
        } catch (error) {
            child.kill()
            rmSync(partial, { force: true })
            throw error
        }
    } else {
        const target = process.env.RESTORE_DATABASE
        if (!filename || !existsSync(filename)) throw new Error('Provide an existing backup file')
        if (!target || !/^[a-z][a-z0-9_]{2,62}$/.test(target) || target === database)
            throw new Error('Set RESTORE_DATABASE to a NEW database name (never the active application database)')
        await run([...compose, 'createdb', '-U', user, target]).done
        const { child, done } = run(
            [
                ...compose,
                'pg_restore',
                '-U',
                user,
                '-d',
                target,
                '--no-owner',
                '--exit-on-error',
                '--single-transaction',
            ],
            ['pipe', 'inherit', 'inherit'],
        )
        await Promise.all([pipeline(createReadStream(filename), child.stdin), done])
        console.log(`Backup restored into ${target}. Validate it before changing application connections.`)
    }
} catch (error) {
    console.error(error.message)
    process.exitCode = 1
}
