import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export function findStatsAgent(run = spawnSync) {
    // Compose's service label also discovers agents started before this helper existed.
    const result = run(
        'docker',
        [
            'ps',
            '--filter',
            'label=com.docker.compose.service=statsd',
            '--format',
            '{{.ID}}\t{{.Label "com.docker.compose.project"}}\t{{.Image}}',
        ],
        { encoding: 'utf8' },
    )
    if (result.error || result.status !== 0) throw new Error('Could not inspect running System Stats agents')
    const agents = result.stdout
        .trim()
        .split('\n')
        .filter((line) => /^(?:docker.io\/)?exelban\/statsd(?::|@|$)/.test(line.split('\t')[2] || ''))
        .map((line) => {
            const [id, project] = line.split('\t')
            return { id, project }
        })
    if (agents.length > 1)
        throw new Error('Multiple System Stats agents are running. Choose one host agent before starting another.')
    return agents[0] || null
}
export function statsProfiles(profiles, project, agent) {
    return profiles
        .split(',')
        .filter((profile) => profile !== 'statsd' || !agent || agent.project === project)
        .join(',')
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const agent = findStatsAgent()
    if (agent) process.stdout.write(agent.id)
}
