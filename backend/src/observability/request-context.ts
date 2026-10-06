import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import { trace } from '@opentelemetry/api'
import type { NextFunction, Request, Response } from 'express'

export type RequestContext = {
    requestId: string
}

const requestContext = new AsyncLocalStorage<RequestContext>()
const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

export function normalizeRequestId(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined
    const candidate = value.trim()
    return requestIdPattern.test(candidate) ? candidate : undefined
}

export function currentRequestId(): string | undefined {
    return requestContext.getStore()?.requestId
}

export function runWithRequestContext<T>(context: RequestContext, callback: () => T): T {
    return requestContext.run(context, callback)
}

export function requestContextMiddleware(
    request: Request & { id?: string },
    response: Response,
    next: NextFunction,
): void {
    const requestId = normalizeRequestId(request.header('x-request-id')) ?? randomUUID()
    request.id = requestId
    trace.getActiveSpan()?.setAttribute('request.id', requestId)
    response.setHeader('x-request-id', requestId)
    requestContext.run({ requestId }, next)
}
