import assert from 'node:assert/strict'
import test from 'node:test'
import { Readable } from 'node:stream'
import { StorageController } from '../dist/storage/storage.controller.js'

test('private storage exposes only validated avatar keys without requiring local bucket creation', async () => {
    const keys = []
    const controller = new StorageController({
        getObject: async (key) => {
            keys.push(key)
            return { Body: Readable.from(Buffer.from('avatar')), ContentLength: 6 }
        },
    })
    const filename = '12345678-1234-1234-1234-123456789abc.webp'
    const image = await controller.image('account-42', filename)
    assert.equal(image.getHeaders().type, 'image/webp')
    assert.deepEqual(keys, [`images/profile-images/account-42/${filename}`])
    for (const [userId, file] of [
        ['../calendar', filename],
        ['account-42', '../import.json'],
        ['account-42', 'file.pdf'],
    ]) {
        await assert.rejects(controller.image(userId, file), { status: 404 })
    }
    assert.equal(keys.length, 1)
})
