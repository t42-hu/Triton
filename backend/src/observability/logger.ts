import { context, trace } from '@opentelemetry/api'
import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Options as PinoHttpOptions } from 'pino-http'
import { currentRequestId, normalizeRequestId } from './request-context.js'

const sensitivePaths = [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers["set-cookie"]',
    'req.headers["x-api-key"]',
    'req.headers["x-captcha-response"]',
    'res.headers["set-cookie"]',
    '*.password',
    '*.newPassword',
    '*.token',
    '*.secret',
    '*.email',
    '*.authorization',
    '*.cookie',
]

function traceBindings(): Record<string, string> {
    const spanContext = trace.getSpan(context.active())?.spanContext()
    const requestId = currentRequestId()
    return {
        ...(requestId ? { requestId } : {}),
        ...(spanContext ? { traceId: spanContext.traceId, spanId: spanContext.spanId } : {}),
    }
}

export function safeRequestPath(rawUrl?: string): string {
    if (!rawUrl) return '/'
    let pathname: string
    try {
        pathname = new URL(rawUrl, 'http://internal').pathname
    } catch {
        return '/invalid-url'
    }
    return pathname
        .replace(/(\/calendar-share\/[^/]+\/)[^/]+(?=\/calendar\.ics)/gi, '$1[redacted]')
        .replace(/(\/reset-password\/)[^/]+/gi, '$1[redacted]')
        .replace(/(\/verify-email\/)[^/]+/gi, '$1[redacted]')
}

export function createPinoHttpOptions(): PinoHttpOptions {
    return {
        level: process.env.LOG_LEVEL || 'info',
        base: {
            service: process.env.OTEL_SERVICE_NAME || 'fullstack-backend',
            environment: process.env.NODE_ENV || 'development',
        },
        mixin: traceBindings,
        redact: { paths: sensitivePaths, censor: '[Redacted]' },
        quietReqLogger: true,
        wrapSerializers: false,
        serializers: {
            req(request: IncomingMessage) {
                return {
                    method: request.method,
                    path: safeRequestPath(request.url),
                }
            },
            res(response: ServerResponse) {
                return { statusCode: response.statusCode }
            },
            err(error: unknown) {
                // Provider error messages and nested causes can contain recipient data,
                // SQL values, or signed URLs. Preserve stack frames, not raw messages.
                return error instanceof Error
                    ? {
                          type: error.name,
                          stack: error.stack
                              ?.split('\n')
                              .filter((line) => /^\s+at /.test(line))
                              .join('\n'),
                      }
                    : { type: 'UnknownError' }
            },
        },
        genReqId(request, response) {
            const existing = normalizeRequestId(
                (request as IncomingMessage & { id?: string }).id ?? request.headers['x-request-id'],
            )
            const requestId = existing ?? randomUUID()
            response.setHeader('x-request-id', requestId)
            return requestId
        },
        autoLogging: {
            ignore: (request) => safeRequestPath(request.url) === '/api/health/live',
        },
        customLogLevel(_request, response, error) {
            if (error || response.statusCode >= 500) return 'error'
            if (response.statusCode >= 400) return 'warn'
            return 'info'
        },
        customSuccessMessage(request, response) {
            return `${request.method || 'HTTP'} request ${response.statusCode >= 400 ? 'failed' : 'completed'}`
        },
        customErrorMessage(request) {
            return `${request.method || 'HTTP'} request failed`
        },
    }
}
