import { apiFetch } from '@/lib/api/fetch'
import type { z } from 'zod'
import { ApiError, type ApiErrorKind } from './errors'

type ErrorPayload = {
    code?: unknown
    message?: unknown
    requestId?: unknown
    details?: unknown
}

async function responseBody(response: Response): Promise<unknown> {
    const text = await response.text()
    if (!text) return undefined
    try {
        return JSON.parse(text) as unknown
    } catch {
        return text
    }
}

function errorKind(status: number, code?: string): ApiErrorKind {
    if (status === 400 || code === 'VALIDATION_ERROR') return 'validation'
    if (status === 401) return 'session-expired'
    if (status === 403) return 'forbidden'
    if (status === 429) return 'rate-limited'
    if (status >= 500) return 'server'
    return 'http'
}

function responseError(response: Response, body: unknown): ApiError {
    const payload = body && typeof body === 'object' ? (body as ErrorPayload) : undefined
    const code = typeof payload?.code === 'string' ? payload.code : undefined
    const requestId =
        (typeof payload?.requestId === 'string' && payload.requestId) ||
        response.headers.get('x-request-id') ||
        undefined
    const details = Array.isArray(payload?.details)
        ? payload.details.filter((value): value is string => typeof value === 'string')
        : undefined
    const message =
        (typeof payload?.message === 'string' && payload.message) || `Request failed with status ${response.status}`
    return new ApiError({
        kind: errorKind(response.status, code),
        status: response.status,
        code,
        requestId,
        details,
        message,
        retryable: response.status === 408 || response.status === 429 || response.status >= 500,
    })
}

export function parseApiResponse<T>(value: unknown, schema: z.ZodType<T>): T {
    const parsed = schema.safeParse(value)
    if (!parsed.success) {
        throw new ApiError({
            kind: 'invalid-response',
            message: 'Invalid server response',
        })
    }
    return parsed.data
}

export async function apiRequest<T>(url: string, schema: z.ZodType<T>, options?: RequestInit): Promise<T> {
    const headers = new Headers(options?.headers)
    const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData
    if (options?.body && !isFormData && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    const response = await apiFetch(url, {
        ...options,
        credentials: 'include',
        headers,
    })

    if (response.status === 204) {
        return undefined as T
    }

    const result = await responseBody(response)

    if (!response.ok) {
        throw responseError(response, result)
    }

    const parsed = schema.safeParse(result)

    if (!parsed.success) {
        throw new ApiError({
            kind: 'invalid-response',
            message: 'Invalid server response',
            requestId: response.headers.get('x-request-id') || undefined,
        })
    }

    return parsed.data
}
