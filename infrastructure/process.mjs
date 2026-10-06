import { existsSync } from 'node:fs'

export function pnpmCommand(args, platform = process.platform, env = process.env) {
    if (platform !== 'win32') return { command: 'pnpm', args }
    if (!env.npm_execpath || !existsSync(env.npm_execpath)) throw new Error('Run this command through pnpm on Windows')
    return { command: process.execPath, args: [env.npm_execpath, ...args] }
}
