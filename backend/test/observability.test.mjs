import assert from 'node:assert/strict'
import test from 'node:test'
import { BadRequestException } from '@nestjs/common'
import pino from 'pino'
import { ApiExceptionFilter } from '../dist/observability/api-exception.filter.js'
import { createPinoHttpOptions, safeRequestPath } from '../dist/observability/logger.js'
import { normalizeRequestId, requestContextMiddleware } from '../dist/observability/request-context.js'

test('request identifiers are bounded and sensitive URL values are omitted', () => {
    assert.equal(normalizeRequestId('web-01:test'), 'web-01:test')
    assert.equal(normalizeRequestId('contains spaces'), undefined)
    assert.equal(normalizeRequestId('x'.repeat(129)), undefined)
    assert.equal(
        safeRequestPath('/api/auth/reset-password/private-token?email=user@example.com'),
        '/api/auth/reset-password/[redacted]',
    )
})

test('request context accepts a valid ID and returns it to the caller', async () => {
    const headers = {}
    const request = { header: () => 'test-request-42' }
    const response = { setHeader: (key, value) => (headers[key] = value) }
    await new Promise((resolve) => requestContextMiddleware(request, response, resolve))
    assert.equal(request.id, 'test-request-42')
    assert.equal(headers['x-request-id'], 'test-request-42')
})

test('Pino redacts credential and personal fields defensively', () => {
    let output = ''
    const options = createPinoHttpOptions()
    const logger = pino(
        { redact: options.redact, serializers: { err: options.serializers.err } },
        { write: (line) => (output += line) },
    )
    logger.info(
        {
            req: { headers: { authorization: 'Bearer secret', cookie: 'session=x' } },
            input: { email: 'person@example.test', password: 'private-password' },
            err: new Error('provider-private-recipient@example.test'),
        },
        'Provider operation failed',
    )
    assert.doesNotMatch(output, /secret|session=x|person@example|private-password/)
    assert.match(output, /\[Redacted\]/)
    assert.doesNotMatch(output, /provider-private-recipient/)
})

test('HTTP exceptions use the stable public error contract', () => {
    let status
    let body
    const headers = {}
    const response = {
        headersSent: false,
        setHeader: (key, value) => (headers[key] = value),
        status(value) {
            status = value
            return this
        },
        json(value) {
            body = value
        },
    }
    const host = {
        getType: () => 'http',
        switchToHttp: () => ({
            getRequest: () => ({
                id: 'request-7',
                method: 'POST',
                path: '/api/example',
            }),
            getResponse: () => response,
        }),
    }
    new ApiExceptionFilter({ setContext() {}, error() {} }).catch(
        new BadRequestException(['email must be valid']),
        host,
    )
    assert.equal(status, 400)
    assert.deepEqual(body, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        requestId: 'request-7',
        details: ['email must be valid'],
    })
    assert.equal(headers['x-request-id'], 'request-7')
})
