import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { publishWebExport } from './triton-web.mjs'

test('publishing a web export preserves the mounted directory while replacing stale files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'triton-web-export-'))
    try {
        const source = join(root, 'export')
        const destination = join(root, 'public')
        await mkdir(source)
        await mkdir(destination)
        await writeFile(join(source, 'index.html'), 'current export')
        await writeFile(join(destination, 'index.html'), 'old export')
        await writeFile(join(destination, 'stale.js'), 'old bundle')
        const before = await stat(destination)
        await publishWebExport(source, destination)
        assert.equal((await stat(destination)).ino, before.ino)
        assert.equal(await readFile(join(destination, 'index.html'), 'utf8'), 'current export')
        await assert.rejects(stat(join(destination, 'stale.js')), { code: 'ENOENT' })
    } finally {
        await rm(root, { recursive: true, force: true })
    }
})
