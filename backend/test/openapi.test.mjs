import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createApiContract } from '../dist/openapi-contract.js'

const recorded = JSON.parse(readFileSync(new URL('../../openapi.json', import.meta.url), 'utf8'))

test('Nest routes and checked-in OpenAPI document agree', async () => {
    const fresh = await createApiContract()
    assert.deepEqual(fresh, recorded)
    const routes = Object.entries(fresh.paths).flatMap(([path, methods]) =>
        Object.keys(methods).map((method) => `${method} ${path}`),
    )
    assert.equal(routes.length, 32)
    assert.ok(routes.includes('get /api/sync/snapshot'))
    assert.deepEqual(fresh.paths['/api/calendar/{resource}'].get.security, [{ session: [] }, { nativeToken: [] }])
    assert.ok(routes.includes('patch /api/users/me'))
    assert.ok(routes.includes('post /api/native-auth/exchange'))
    assert.ok(routes.every((route) => !route.includes('/api/auth/')))
})

test('native request defaults and upload media types match runtime behavior', () => {
    const start = recorded.paths['/api/native-auth/start'].post.requestBody.content['application/json'].schema
    assert.ok(!start.required.includes('intent'))
    assert.ok(start.required.includes('challenge'))
    const upload = recorded.paths['/api/profile-images/optimize'].post.requestBody.content['multipart/form-data'].schema
    assert.equal(upload.properties.file.format, 'binary')
    assert.deepEqual(recorded.paths['/api/users/me'].get.security, [{ session: [] }, { nativeToken: [] }])
})
