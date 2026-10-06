import assert from 'node:assert/strict'
import test from 'node:test'
import { findStatsAgent, statsProfiles } from './statsd.mjs'
test('clones reuse the existing host agent while retaining other service profiles', () => {
    const agent = findStatsAgent(() => ({ status: 0, stdout: 'abc123\tother-dev\texelban/statsd:latest\n' }))
    assert.deepEqual(agent, { id: 'abc123', project: 'other-dev' })
    assert.equal(statsProfiles('search,statsd,scanner', 'new-dev', agent), 'search,scanner')
    assert.equal(statsProfiles('statsd', 'other-dev', agent), 'statsd')
    assert.equal(statsProfiles('statsd', 'new-dev', null), 'statsd')
    assert.equal(
        findStatsAgent(() => ({ status: 0, stdout: '' })),
        null,
    )
    assert.throws(() => findStatsAgent(() => ({ status: 1, stdout: '' })), /inspect/)
    assert.throws(
        () =>
            findStatsAgent(() => ({ status: 0, stdout: 'a\tx\texelban/statsd:latest\nb\ty\texelban/statsd:latest\n' })),
        /Multiple/,
    )
})

test('statsd.sh reuses the host agent and refreshes only an unpaired agent', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { spawnSync } = await import('node:child_process')
    const directory = mkdtempSync(join(tmpdir(), 'fullstack-statsd-test-'))
    try {
        mkdirSync(join(directory, 'infrastructure'))
        mkdirSync(join(directory, 'bin'))
        cpSync(new URL('../statsd.sh', import.meta.url), join(directory, 'statsd.sh'))
        cpSync(new URL('./statsd.mjs', import.meta.url), join(directory, 'infrastructure/statsd.mjs'))
        writeFileSync(join(directory, '.env'), 'STATSD_ENABLED=false\n')
        const mock = `#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const name = path.basename(process.argv[1])
const args = process.argv.slice(2)
fs.appendFileSync('calls', JSON.stringify([name, ...args]) + '\\n')
if (name === 'uname') console.log('Darwin')
if (name === 'docker') {
    if (args[0] === 'ps') console.log('abc123\\towner-dev\\texelban/statsd:latest')
    if (args[0] === 'exec') console.log('AUTHORIZATION: ' + (process.env.TEST_PAIRED === 'yes' ? 'Authorized' : 'Not Authorized'))
    if (args[0] === 'logs') console.log('https://auth.system-stats.com/device?code=disposable-test')
}
`
        for (const name of ['docker', 'open', 'uname'])
            writeFileSync(join(directory, 'bin', name), mock, { mode: 0o755 })
        for (const paired of ['yes', 'no']) {
            writeFileSync(join(directory, 'calls'), '')
            const result = spawnSync('bash', ['statsd.sh'], {
                cwd: directory,
                encoding: 'utf8',
                env: { ...process.env, PATH: `${join(directory, 'bin')}:${process.env.PATH}`, TEST_PAIRED: paired },
            })
            assert.equal(result.status, 0, result.stderr)
            assert.match(readFileSync(join(directory, '.env'), 'utf8'), /STATSD_ENABLED=true/)
            const calls = readFileSync(join(directory, 'calls'), 'utf8')
                .trim()
                .split('\n')
                .map((line) => JSON.parse(line))
            assert.equal(
                calls.some((call) => call.includes('compose')),
                false,
            )
            assert.equal(
                calls.some((call) => call[1] === 'restart'),
                paired === 'no',
            )
            assert.equal(
                calls.some((call) => call[0] === 'open'),
                paired === 'no',
            )
            if (paired === 'no')
                assert.ok(
                    calls.some((call) => call[1] === 'logs' && call.includes('--since') && call.includes('--tail')),
                )
        }
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
})
