import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export function socketName(directory) {
    return `fullstack-${createHash('sha256').update(realpathSync(directory)).digest('hex').slice(0, 16)}`
}

export function workspace(directory = root) {
    const socket = socketName(directory)
    const run = (args, options = {}) => {
        const result = spawnSync('tmux', ['-L', socket, '-f', '/dev/null', ...args], {
            encoding: 'utf8',
            ...options,
        })
        if (result.error)
            throw new Error('tmux is required. On macOS: brew install tmux; on Linux use your package manager.')
        if (result.status !== 0 && !options.allowFailure) {
            throw new Error(result.stderr?.trim() || 'tmux command failed')
        }
        return result
    }
    return {
        socket,
        exists: () => run(['has-session', '-t', '=dev'], { allowFailure: true }).status === 0,
        run,
        create(
            logCommand = (service) => [
                process.execPath,
                resolve(directory, 'infrastructure/compose.mjs'),
                'development',
                'logs',
                '--follow',
                '--tail',
                '100',
                service,
            ],
        ) {
            run(['new-session', '-d', '-s', 'dev', '-n', 'workspace', '-c', directory, '-x', '160', '-y', '48'])
            try {
                run(['set-option', '-t', 'dev', 'mouse', 'on'])
                run(['set-window-option', '-t', 'dev:0', 'remain-on-exit', 'on'])
                run(['set-window-option', '-t', 'dev:0', 'pane-border-status', 'top'])
                run(['set-window-option', '-t', 'dev:0', 'pane-border-format', '#{pane_index}: #{pane_title}'])
                run(['select-pane', '-t', 'dev:0.0', '-T', 'Development shell'])
                for (const [index, service] of ['backend', 'frontend'].entries()) {
                    run(['split-window', '-t', 'dev:0', '-c', directory, ...logCommand(service)])
                    run(['select-pane', '-t', `dev:0.${index + 1}`, '-T', `${service} logs`])
                }
                run(['select-layout', '-t', 'dev:0', 'main-vertical'])
                run(['select-pane', '-t', 'dev:0.0'])
            } catch (error) {
                run(['kill-session', '-t', '=dev'], { allowFailure: true })
                throw error
            }
        },
    }
}

function main() {
    const args = process.argv.slice(2)
    const action = args.find((arg) => !arg.startsWith('--')) ?? 'start'
    if (
        args.some((arg) => !['start', 'status', 'stop', '--detached', '--no-start', '--ensure-services'].includes(arg))
    ) {
        throw new Error('Usage: pnpm dev:tmux [start|status|stop] [--detached] [--no-start]')
    }
    const session = workspace()
    const exists = session.exists()
    if (action === 'status') {
        console.log(exists ? `Running (${session.socket})` : 'No development workspace running.')
        return
    }
    if (action === 'stop') {
        if (exists) session.run(['kill-session', '-t', '=dev'])
        console.log('Workspace stopped. Docker services are unchanged; use pnpm dev:down to stop them.')
        return
    }
    if ((!exists || args.includes('--ensure-services')) && !args.includes('--no-start')) {
        const result = spawnSync(
            process.execPath,
            ['infrastructure/compose.mjs', 'development', 'up', '--detach', '--wait'],
            { cwd: root, stdio: 'inherit' },
        )
        if (result.error || result.status !== 0)
            throw new Error('Development services failed to start; workspace attachment cancelled.')
    }
    if (!exists) session.create()
    if (args.includes('--detached') || !process.stdin.isTTY || !process.stdout.isTTY) {
        console.log(`Workspace ready. Attach from a terminal: tmux -L ${session.socket} attach -t dev`)
    } else {
        session.run(['attach-session', '-t', '=dev'], {
            stdio: 'inherit',
            env: { ...process.env, TMUX: '' },
        })
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        main()
    } catch (error) {
        console.error(error.message)
        process.exitCode = 1
    }
}
