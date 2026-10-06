import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const directory = resolve('frontend/src/lib/api/generated')
function snapshot(path = directory) {
    const files = new Map()
    for (const entry of readdirSync(path, { withFileTypes: true })) {
        const name = join(path, entry.name)
        if (entry.isDirectory()) {
            for (const [key, value] of snapshot(name)) files.set(key, value)
        } else files.set(name, readFileSync(name, 'utf8'))
    }
    return files
}
const before = snapshot()
const result = spawnSync('pnpm', ['exec', 'orval', '--config', 'orval.config.mjs', '--formatter', 'prettier'], {
    stdio: 'inherit',
    env: { ...process.env, CI: 'true' },
})
if (result.error || result.status !== 0) throw new Error('Could not regenerate the API client.')
const after = snapshot()
if (before.size !== after.size || [...after].some(([name, value]) => before.get(name) !== value)) {
    console.error('Generated API client is stale; run pnpm api:generate')
    process.exitCode = 1
}
