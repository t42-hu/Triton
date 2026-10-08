import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

const accountId = '0123456789abcdef0123456789abcdef'
const tunnelId = '11111111-2222-3333-4444-555555555555'

test('provisions a tunnel, ingress, DNS record, and private token file', async () => {
    const calls = []
    const server = createServer(async (request, response) => {
        const chunks = []
        for await (const chunk of request) chunks.push(chunk)
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null
        calls.push({ method: request.method, url: request.url, body })

        const send = (result) => {
            response.setHeader('content-type', 'application/json')
            response.end(
                JSON.stringify({
                    success: true,
                    result,
                    result_info: { total_pages: 1 },
                }),
            )
        }

        if (request.url.startsWith('/zones?')) {
            send([{ id: 'zone-id', name: 'example.com', account: { id: accountId } }])
        } else if (request.method === 'GET' && request.url.startsWith(`/accounts/${accountId}/cfd_tunnel?`)) {
            send([])
        } else if (request.method === 'POST' && request.url === `/accounts/${accountId}/cfd_tunnel`) {
            send({ id: tunnelId, name: body.name, config_src: 'cloudflare' })
        } else if (
            request.method === 'PUT' &&
            request.url === `/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`
        ) {
            send({ config: body.config })
        } else if (request.method === 'GET' && request.url.startsWith('/zones/zone-id/dns_records?')) {
            send([
                {
                    id: 'old-a',
                    type: 'A',
                    name: 'app.example.com',
                    content: '192.0.2.1',
                    comment: 'Managed automatically by Fullstack Starter Cloudflare Tunnel',
                },
            ])
        } else if (request.method === 'DELETE' && request.url === '/zones/zone-id/dns_records/old-a') {
            send({ id: 'old-a' })
        } else if (request.method === 'POST' && request.url === '/zones/zone-id/dns_records') {
            send({ id: 'new-cname', ...body })
        } else if (request.method === 'GET' && request.url === `/accounts/${accountId}/cfd_tunnel/${tunnelId}/token`) {
            send('test-runtime-token-that-is-long-enough')
        } else {
            response.statusCode = 404
            response.end(
                JSON.stringify({
                    success: false,
                    errors: [{ code: 1000, message: 'Unexpected test request' }],
                }),
            )
        }
    })

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    const directory = await mkdtemp(join(tmpdir(), 'cloudflare-tunnel-test-'))
    const tokenFile = join(directory, 'tunnel-token')

    try {
        const child = spawn(process.execPath, ['infrastructure/cloudflare-tunnel.mjs'], {
            cwd: new URL('..', import.meta.url),
            env: {
                ...process.env,
                APP_DOMAIN: 'app.example.com',
                MOBILE_APP_DOMAIN: 'mobile.app.example.com',
                APP_ENVIRONMENT: 'test',
                CLOUDFLARE_ACCOUNT_ID: accountId,
                CLOUDFLARE_API_TOKEN: 'test-api-token',
                CLOUDFLARE_API_BASE_URL: `http://127.0.0.1:${address.port}`,
                CLOUDFLARE_TUNNEL_TOKEN_FILE: tokenFile,
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        })

        let stderr = ''
        child.stderr.on('data', (chunk) => {
            stderr += chunk
        })
        const exitCode = await new Promise((resolve) => child.on('close', resolve))

        assert.equal(exitCode, 0, stderr)
        assert.equal(await readFile(tokenFile, 'utf8'), 'test-runtime-token-that-is-long-enough\n')
        assert.ok(
            calls.some(
                (call) =>
                    call.method === 'PUT' &&
                    call.body.config.ingress[0].hostname === 'app.example.com' &&
                    call.body.config.ingress[0].service === 'http://proxy:80' &&
                    call.body.config.ingress[1].hostname === 'mobile.app.example.com' &&
                    call.body.config.ingress[1].service === 'http://proxy:8082',
            ),
        )
        assert.ok(
            calls.some(
                (call) =>
                    call.method === 'POST' &&
                    call.url === '/zones/zone-id/dns_records' &&
                    call.body.content === `${tunnelId}.cfargotunnel.com` &&
                    call.body.proxied === true,
            ),
        )
        assert.ok(
            calls.some(
                (call) =>
                    call.method === 'POST' &&
                    call.body?.name === 'mobile.app.example.com' &&
                    call.body.proxied === true,
            ),
        )
    } finally {
        server.close()
        await rm(directory, { recursive: true, force: true })
    }
})

test('refuses to replace an unmanaged DNS record', async () => {
    const calls = []
    const server = createServer((request, response) => {
        calls.push({ method: request.method, url: request.url })
        response.setHeader('content-type', 'application/json')

        let result
        if (request.url.startsWith('/zones?')) {
            result = [{ id: 'zone-id', name: 'example.com', account: { id: accountId } }]
        } else if (request.url.startsWith(`/accounts/${accountId}/cfd_tunnel?`)) {
            result = [
                {
                    id: tunnelId,
                    name: 'fullstack-starter-app-example-com-test',
                    config_src: 'cloudflare',
                },
            ]
        } else if (
            request.method === 'PUT' &&
            request.url === `/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`
        ) {
            result = {}
        } else if (request.method === 'GET' && request.url.startsWith('/zones/zone-id/dns_records?')) {
            result = [
                {
                    id: 'customer-a',
                    type: 'A',
                    name: 'app.example.com',
                    content: '192.0.2.50',
                },
            ]
        } else {
            response.statusCode = 404
            response.end(
                JSON.stringify({
                    success: false,
                    errors: [{ code: 1000, message: 'Unexpected test request' }],
                }),
            )
            return
        }

        response.end(
            JSON.stringify({
                success: true,
                result,
                result_info: { total_pages: 1 },
            }),
        )
    })

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()

    try {
        const child = spawn(process.execPath, ['infrastructure/cloudflare-tunnel.mjs'], {
            cwd: new URL('..', import.meta.url),
            env: {
                ...process.env,
                APP_DOMAIN: 'app.example.com',
                APP_ENVIRONMENT: 'test',
                CLOUDFLARE_ACCOUNT_ID: accountId,
                CLOUDFLARE_API_TOKEN: 'test-api-token',
                CLOUDFLARE_API_BASE_URL: `http://127.0.0.1:${address.port}`,
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        })

        let stderr = ''
        child.stderr.on('data', (chunk) => {
            stderr += chunk
        })
        const exitCode = await new Promise((resolve) => child.on('close', resolve))

        assert.equal(exitCode, 1)
        assert.match(stderr, /Refusing to replace unmanaged DNS records/)
        assert.equal(
            calls.some((call) => call.method === 'DELETE'),
            false,
        )
    } finally {
        server.close()
    }
})
