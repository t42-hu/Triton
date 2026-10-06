import assert from 'node:assert/strict'
import test from 'node:test'
import {
    buildComposeArguments,
    normalizeProjectName,
    resolveDockerEnvironment,
    resolveProjectName,
} from './compose.mjs'

test('normalizes a cloned directory into a valid Compose project name', () => {
    assert.equal(normalizeProjectName(' My Product! '), 'my-product')
    assert.match(resolveProjectName('development', '/tmp/My Product'), /^my-product-[a-f0-9]{10}-dev$/)
    assert.match(resolveProjectName('production', '/tmp/My Product'), /^my-product-[a-f0-9]{10}-prod$/)
})

test('builds environment-specific Compose arguments', () => {
    const arguments_ = buildComposeArguments('development', ['up', '--detach'])

    assert.equal(arguments_[0], 'compose')
    assert.ok(arguments_.includes('docker-compose.dev.yml'))
    assert.deepEqual(arguments_.slice(-2), ['up', '--detach'])
})

test('adds Docker Desktop credential helper directory on macOS when needed', () => {
    const helperPath = '/Applications/Docker.app/Contents/Resources/bin/docker-credential-desktop'
    const environment = resolveDockerEnvironment(
        { PATH: '/usr/local/bin:/usr/bin' },
        'darwin',
        (path) => path === helperPath,
    )

    assert.equal(environment.PATH, '/Applications/Docker.app/Contents/Resources/bin:/usr/local/bin:/usr/bin')
})

test('does not change the environment when the helper is already on PATH', () => {
    const original = { PATH: '/usr/local/bin:/usr/bin' }
    const environment = resolveDockerEnvironment(
        original,
        'darwin',
        (path) => path === '/usr/local/bin/docker-credential-desktop',
    )

    assert.equal(environment, original)
})
