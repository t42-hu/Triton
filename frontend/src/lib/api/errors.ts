export type ApiErrorKind =
    | 'aborted'
    | 'forbidden'
    | 'http'
    | 'invalid-response'
    | 'network'
    | 'offline'
    | 'rate-limited'
    | 'server'
    | 'session-expired'
    | 'timeout'
    | 'validation'

type ApiErrorOptions = {
    kind: ApiErrorKind
    message: string
    status?: number
    code?: string
    requestId?: string
    details?: string[]
    retryable?: boolean
    cause?: unknown
}

export class ApiError extends Error {
    readonly kind: ApiErrorKind
    readonly status?: number
    readonly code?: string
    readonly requestId?: string
    readonly details?: string[]
    readonly retryable: boolean

    constructor(options: ApiErrorOptions) {
        super(options.message, { cause: options.cause })
        this.name = 'ApiError'
        this.kind = options.kind
        this.status = options.status
        this.code = options.code
        this.requestId = options.requestId
        this.details = options.details
        this.retryable = options.retryable ?? false
    }
}

export function apiErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof ApiError) {
        if (error.kind === 'offline') return 'You appear to be offline. Check your connection and try again.'
        if (error.kind === 'timeout') return 'The request took too long. Check your connection and try again.'
        if (error.kind === 'network') return 'Could not reach the server. Check your connection and try again.'
        if (error.kind === 'session-expired') return 'Your session expired. Please log in again.'
        if (error.kind === 'invalid-response')
            return error.requestId
                ? `The server returned an unexpected response. Please try again. (Reference: ${error.requestId})`
                : 'The server returned an unexpected response. Please try again.'
        const message = error.message || fallback
        return error.requestId ? `${message} (Reference: ${error.requestId})` : message
    }
    return error instanceof Error && error.message ? error.message : fallback
}
