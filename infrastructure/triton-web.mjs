import { cp, mkdir, readdir, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const exportedApp = fileURLToPath(new URL('../frontend/universal/dist/', import.meta.url))
const publicApp = fileURLToPath(new URL('../frontend/public/triton/', import.meta.url))

/** Preserve the directory inode so Docker bind mounts see each new export. */
export async function publishWebExport(source = exportedApp, destination = publicApp) {
    await mkdir(destination, { recursive: true })
    await Promise.all(
        (await readdir(destination)).map((name) => rm(join(destination, name), { recursive: true, force: true })),
    )
    await cp(source, destination, { recursive: true })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await publishWebExport()
    console.log('Published Triton42 web export into the Next.js frontend.')
}
