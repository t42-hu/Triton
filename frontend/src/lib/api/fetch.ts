import { apiUrl } from './url'
import { ApiError } from './errors'
import { isNative, sessionToken, setSessionToken } from '../native/platform'

export const apiFetch: typeof fetch = async (input, init) => {
    const callerSignal = init?.signal || (input instanceof Request ? input.signal : undefined)
    const timeout = AbortSignal.timeout(15_000)
    const signal = callerSignal ? AbortSignal.any([callerSignal, timeout]) : timeout
    const execute = (options: RequestInit) =>
        fetch(input, { ...options, signal }).catch((cause: unknown) => {
            if (timeout.aborted)
                throw new ApiError({
                    kind: 'timeout',
                    message: 'Request timed out',
                    retryable: true,
                    cause,
                })
            if (callerSignal?.aborted)
                throw new ApiError({
                    kind: 'aborted',
                    message: 'Request cancelled',
                    cause,
                })
            const offline = typeof navigator !== 'undefined' && navigator.onLine === false
            throw new ApiError({
                kind: offline ? 'offline' : 'network',
                message: offline ? 'Device is offline' : 'Could not reach the server',
                retryable: true,
                cause,
            })
        })

    if (!isNative) return execute({ credentials: 'include', ...init })
    const url = new URL(input instanceof Request ? input.url : input.toString())
    const base = new URL(apiUrl('/'))
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname))
        throw new Error('Refusing to send a native session outside its configured API')
    const headers = new Headers(input instanceof Request ? input.headers : undefined)
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value))
    headers.delete('cookie')
    headers.delete('authorization')
    const token = await sessionToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const response = await execute({
        ...init,
        headers,
        credentials: 'omit',
        redirect: 'error',
    })
    const issued = response.headers.get('set-auth-token')
    if (response.ok && issued) await setSessionToken(issued)
    if (response.status === 401 || (response.ok && url.pathname.endsWith('/auth/sign-out')))
        if ((await sessionToken()) === token) await setSessionToken(null)
    if (response.status === 401 && typeof window !== 'undefined')
        window.dispatchEvent(new Event('fullstack-session-expired'))
    if (response.ok && url.pathname.endsWith('/auth/get-session')) {
        let data: unknown
        try {
            data = await response.clone().json()
        } catch {
            // Cancellation or malformed JSON is not evidence of an expired session.
            return response
        }
        if (data === null && (await sessionToken()) === token) await setSessionToken(null)
    }
    return response
}
