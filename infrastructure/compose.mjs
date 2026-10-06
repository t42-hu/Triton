import { cloneIdentity, loadEnvironment, resolveEnvironment } from './config.mjs'
import { findStatsAgent, statsProfiles } from './statsd.mjs'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { delimiter, dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const composeFiles = {
    development: 'docker-compose.dev.yml',
    production: 'docker-compose.prod.yml',
}

export function normalizeProjectName(value) {
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^[^a-z0-9]+/, '')
        .replace(/-+$/g, '')

    return normalized || 'fullstack'
}

export function resolveProjectName(environment, cwd = process.cwd()) {
    if (process.env.COMPOSE_PROJECT_NAME?.trim()) {
        return normalizeProjectName(process.env.COMPOSE_PROJECT_NAME)
    }

    const baseName = process.env.COMPOSE_PROJECT_BASENAME?.trim() || cloneIdentity(cwd, process.env.APP_ID)
    const suffix = environment === 'development' ? 'dev' : 'prod'
    return `${normalizeProjectName(baseName)}-${suffix}`
}

export function buildComposeArguments(environment, arguments_) {
    const composeFile = composeFiles[environment]
    if (!composeFile) {
        throw new Error('Environment must be "development" or "production".')
    }

    return ['compose', '--project-name', resolveProjectName(environment), '--file', composeFile, ...arguments_]
}

export function resolveDockerEnvironment(
    environment = process.env,
    platform = process.platform,
    fileExists = existsSync,
) {
    const helperName = platform === 'win32' ? 'docker-credential-desktop.exe' : 'docker-credential-desktop'
    const helperPaths =
        {
            darwin: [`/Applications/Docker.app/Contents/Resources/bin/${helperName}`],
            win32: [`C:\\Program Files\\Docker\\Docker\\resources\\bin\\${helperName}`],
        }[platform] ?? []

    const pathValue = environment.PATH ?? environment.Path ?? ''
    const pathDirectories = pathValue.split(delimiter).filter(Boolean)

    if (pathDirectories.some((directory) => fileExists(resolve(directory, helperName)))) {
        return environment
    }

    const helperPath = helperPaths.find(fileExists)
    if (!helperPath) {
        return environment
    }

    return {
        ...environment,
        PATH: [dirname(helperPath), pathValue].filter(Boolean).join(delimiter),
    }
}

const [environment, ...arguments_] = process.argv.slice(2)

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    if (!environment || arguments_.length === 0) {
        console.error('Usage: node infrastructure/compose.mjs <development|production> <compose arguments...>')
        process.exitCode = 2
    } else {
        loadEnvironment(process.env.ENV_FILE || '.env')
        Object.assign(process.env, resolveEnvironment(environment))
        let dockerArguments
        try {
            dockerArguments = buildComposeArguments(environment, arguments_)
        } catch (error) {
            console.error(error instanceof Error ? error.message : String(error))
            process.exitCode = 2
        }

        if (dockerArguments) {
            if (arguments_.includes('up') && process.env.STATSD_ENABLED === 'true') {
                const agent = findStatsAgent()
                process.env.COMPOSE_PROFILES = statsProfiles(
                    process.env.COMPOSE_PROFILES || '',
                    resolveProjectName(environment),
                    agent,
                )
                if (agent && agent.project !== resolveProjectName(environment)) {
                    if (arguments_.includes('statsd') || arguments_.includes('--profile=statsd'))
                        throw new Error('A host System Stats agent already exists. Use ./statsd.sh to access it.')
                    console.log('Reusing the System Stats agent already running on this Docker host.')
                }
            }
            const child = spawn('docker', dockerArguments, {
                env: resolveDockerEnvironment(),
                stdio: 'inherit',
            })

            child.once('error', (error) => {
                console.error(`Could not start Docker: ${error.message}`)
                process.exitCode = 1
            })

            child.once('exit', (code, signal) => {
                if (signal) {
                    process.kill(process.pid, signal)
                    return
                }
                process.exitCode = code ?? 1
            })
        }
    }
}
