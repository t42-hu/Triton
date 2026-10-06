import { cp, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const exportedApp = fileURLToPath(new URL('../frontend/universal/dist/', import.meta.url))
const publicApp = fileURLToPath(new URL('../frontend/public/triton/', import.meta.url))

await rm(publicApp, { recursive: true, force: true })
await mkdir(publicApp, { recursive: true })
await cp(exportedApp, publicApp, { recursive: true })
console.log('Published Triton42 web export into the Next.js frontend.')
