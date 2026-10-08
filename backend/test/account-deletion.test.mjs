import assert from 'node:assert/strict'
import test from 'node:test'
import { accountDeletionHooks } from '../dist/auth/account-deletion.js'
import { ProfileImageService } from '../dist/profile-image/profile-image.service.js'

test('account file cleanup waits for successful deletion and keeps simultaneous requests isolated', async () => {
    const removed = [],
        images = []
    const hooks = accountDeletionHooks(
        { pool: { query: async (_sql, [id]) => ({ rows: [{ storage_key: `owned/${id}` }] }) } },
        { deleteByPublicUrl: async (image, id) => images.push([image, id]) },
        { deleteObject: async (key) => removed.push(key) },
    )
    const first = new Request('https://app.test/delete'),
        second = new Request('https://app.test/delete')
    await hooks.beforeDelete({ id: 'first' }, first)
    await hooks.beforeDelete({ id: 'second' }, second)
    assert.deepEqual(removed, [])
    await hooks.afterDelete({ id: 'second', image: 'second-image' }, second)
    assert.deepEqual(removed, ['owned/second'])
    await hooks.afterDelete({ id: 'first', image: 'first-image' }, first)
    assert.deepEqual(removed, ['owned/second', 'owned/first'])
    assert.deepEqual(images, [
        ['second-image', 'second'],
        ['first-image', 'first'],
    ])
})

test('image cleanup cannot remove another account image even when an image URL is supplied directly', async () => {
    const removed = []
    const service = new ProfileImageService(
        { getKeyFromPublicUrl: (value) => value, deleteObject: async (key) => removed.push(key) },
        {},
        { warn() {} },
    )
    await service.deleteByPublicUrl('images/profile-images/victim/avatar.webp', 'owner')
    await service.deleteByPublicUrl('images/profile-images/owner/avatar.webp', 'owner')
    assert.deepEqual(removed, ['images/profile-images/owner/avatar.webp'])
})
