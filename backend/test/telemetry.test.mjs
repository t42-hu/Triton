import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import test from 'node:test'

test('compiled ESM exports redacted automatic HTTP and manual traces', { timeout: 15000 }, async () => {
    let received
    const server = createServer((request, response) => {
        const chunks = []
        request.on('data', (chunk) => chunks.push(chunk))
        request.on('end', () => {
            if (request.url !== '/v1/traces') {
                response.writeHead(200).end('ok')
                return
            }
            received = {
                method: request.method,
                path: request.url,
                type: request.headers['content-type'],
                body: Buffer.concat(chunks),
            }
            response.writeHead(200).end()
        })
    })
    await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address()
    assert.ok(address && typeof address === 'object')

    const source = `
    const instrumentation = await import('./backend/dist/observability/instrumentation.js');
    const { createRequire } = await import('node:module');
    const require = createRequire(new URL('./backend/package.json', import.meta.url));
    const api = require('@opentelemetry/api');
    const http = await import('node:http');
    await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:${address.port}/private-token?secret=private-query', (res) => {
        res.resume();
        res.on('end', resolve);
      }).on('error', reject);
    });
    const span = api.trace.getTracer('runtime-test').startSpan('private-span-name');
    span.setAttribute('db.statement', 'private-sql');
    span.recordException(new Error('private-exception'));
    span.end();
    await instrumentation.shutdownTelemetry();
  `
    try {
        const child = spawn(process.execPath, ['--input-type=module', '--eval', source], {
            cwd: process.cwd(),
            env: {
                PATH: process.env.PATH,
                OTEL_TRACES_SAMPLER: 'always_on',
                OTEL_ENABLED: 'true',
                OTEL_SERVICE_NAME: 'fullstack-test',
                OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${address.port}`,
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        })
        let stderr = ''
        child.stderr.on('data', (chunk) => (stderr += chunk))
        const code = await new Promise((resolve, reject) => {
            child.once('error', reject)
            child.once('close', resolve)
        })
        assert.equal(code, 0, stderr)
        assert.equal(received?.method, 'POST')
        assert.equal(received?.path, '/v1/traces')
        assert.match(received?.type || '', /application\/json/)
        assert.ok(received?.body.length > 0)
        const body = received.body.toString()
        assert.doesNotMatch(body, /private-token|private-query|private-span-name|private-sql|private-exception/)
        assert.match(body, /instrumentation-http/)
        assert.match(body, /runtime-test/)
    } finally {
        await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
    }
})
