import { writeFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createApiContract } from '../backend/dist/openapi-contract.js'
import { format, resolveConfig } from 'prettier'

const target = resolve('openapi.json')
const generated = await format(JSON.stringify(await createApiContract()), {
    ...(await resolveConfig(target)),
    filepath: target,
})
if (process.argv.includes('--check')) {
    if (readFileSync(target, 'utf8') !== generated) {
        console.error('openapi.json is stale; run pnpm api:generate')
        process.exitCode = 1
    }
} else {
    writeFileSync(target, generated)
    console.log('Generated openapi.json from Nest routes and shared Zod schemas.')
}
