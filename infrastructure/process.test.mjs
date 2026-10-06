import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { pnpmCommand } from './process.mjs'
test('Windows pnpm invocation uses Node directly and preserves literal arguments', () => {
    const cli = fileURLToPath(import.meta.url)
    const args = ['exec', 'electron-builder', '--config', 'space & literal/config.json']
    assert.deepEqual(pnpmCommand(args, 'win32', { npm_execpath: cli }), {
        command: process.execPath,
        args: [cli, ...args],
    })
    assert.throws(() => pnpmCommand(args, 'win32', {}), /through pnpm/)
    assert.deepEqual(pnpmCommand(args, 'darwin'), { command: 'pnpm', args })
})
