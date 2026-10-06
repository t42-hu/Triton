import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { socketName, workspace } from './tmux.mjs'

const available = spawnSync('tmux', ['-V']).status === 0

test('checkout sockets distinguish clones and resolve symlink aliases', () => {
    const directory = mkdtempSync(join(tmpdir(), 'tmux-identity-'))
    try {
        const alias = `${directory}-alias`
        symlinkSync(directory, alias)
        try {
            assert.equal(socketName(directory), socketName(alias))
            assert.notEqual(socketName(directory), socketName(tmpdir()))
        } finally {
            rmSync(alias)
        }
    } finally {
        rmSync(directory, { recursive: true })
    }
})

test(
    'real tmux creates isolated panes, preserves literal arguments, and stops only its workspace',
    { skip: !available },
    () => {
        const first = mkdtempSync(join(tmpdir(), "tmux space ' $()-"))
        const second = mkdtempSync(join(tmpdir(), 'tmux-other-'))
        const sessions = [workspace(first), workspace(second)]
        try {
            for (const session of sessions) {
                assert.equal(session.exists(), false)
                session.create((service) => [
                    process.execPath,
                    '-e',
                    'setInterval(() => {}, 1000)',
                    `${service} $(exit 1) ' literal`,
                ])
                assert.equal(session.exists(), true)
                const panes = session
                    .run(['list-panes', '-t', 'dev:0', '-F', '#{pane_title}|#{pane_current_path}|#{pane_dead}'])
                    .stdout.trim()
                    .split('\n')
                assert.equal(panes.length, 3)
                assert.ok(panes.some((pane) => pane.startsWith('backend logs|')))
                assert.ok(panes.some((pane) => pane.startsWith('frontend logs|')))
                assert.ok(panes.every((pane) => pane.endsWith('|0')))
            }
            sessions[0].run(['kill-session', '-t', '=dev'])
            assert.equal(sessions[0].exists(), false)
            assert.equal(sessions[1].exists(), true)
        } finally {
            for (const session of sessions) session.run(['kill-server'], { allowFailure: true })
            for (const directory of [first, second]) rmSync(directory, { recursive: true, force: true })
        }
    },
)

test(
    'dev:up ensures services again when a workspace already exists and propagates startup failures',
    { skip: !available },
    () => {
        const directory = mkdtempSync(join(tmpdir(), 'tmux-startup-'))
        const session = workspace(directory)
        try {
            mkdirSync(join(directory, 'infrastructure'))
            cpSync(new URL('./tmux.mjs', import.meta.url), join(directory, 'infrastructure/tmux.mjs'))
            writeFileSync(
                join(directory, 'infrastructure/compose.mjs'),
                `
      import { appendFileSync } from 'node:fs';
      if (process.argv[3] === 'up') {
        appendFileSync('starts.txt', 'started\\n');
        if (process.env.TEST_START_FAILURE) process.exit(1);
      } else setInterval(() => {}, 1000);
    `,
            )
            const start = (failure = false) =>
                spawnSync(process.execPath, ['infrastructure/tmux.mjs', 'start', '--ensure-services', '--detached'], {
                    cwd: directory,
                    encoding: 'utf8',
                    env: { ...process.env, TEST_START_FAILURE: failure ? '1' : '' },
                })
            assert.equal(start(true).status, 1)
            assert.equal(session.exists(), false)
            assert.equal(start().status, 0)
            assert.equal(start().status, 0)
            assert.equal(readFileSync(join(directory, 'starts.txt'), 'utf8').trim().split('\n').length, 3)
            assert.equal(session.run(['list-panes', '-t', 'dev:0']).stdout.trim().split('\n').length, 3)
            assert.equal(start(true).status, 1)
            assert.equal(session.exists(), true)
        } finally {
            session.run(['kill-server'], { allowFailure: true })
            rmSync(directory, { recursive: true, force: true })
        }
    },
)
