import { z } from 'zod'

export const NativeSchemeSchema = z
    .string()
    .regex(/^[a-z][a-z0-9.-]{2,80}$/)
    .refine(
        (value) => !['http', 'https', 'file', 'javascript', 'data', 'app'].includes(value),
        'Use an application-specific URL scheme',
    )
export const NativeOriginSchema = z.string().refine((value) => {
    try {
        const url = new URL(value)
        if (url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) return false
        if (url.protocol === 'app:') return value === 'app://localhost'
        return ['http:', 'https:'].includes(url.protocol) && url.origin === value && !url.hostname.includes('*')
    } catch {
        return false
    }
}, 'Use an exact HTTP(S) or app://localhost origin')
export function nativeOrigins(env: Record<string, string | undefined>): string[] {
    return env.NATIVE_AUTH_ENABLED === 'true'
        ? (env.NATIVE_TRUSTED_ORIGINS || '')
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean)
        : []
}
export const NativeStartSchema = z
    .object({
        intent: z.enum(['sign-in', 'password-reset']).default('sign-in'),
        challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        state: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    })
    .strict()
export const NativeExchangeSchema = z
    .object({
        flow: z.string().regex(/^[a-f0-9]{64}$/),
        code: z.string().regex(/^[a-f0-9]{64}$/),
        verifier: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
        state: NativeStartSchema.shape.state,
    })
    .strict()

export const NativeStartResponseSchema = z.object({
    flow: z.string().regex(/^[a-f0-9]{64}$/),
    browserUrl: z.url(),
    expiresIn: z.number().int().positive(),
})
export const NativeCallbackResponseSchema = z.object({ callbackUrl: z.url() })
export const NativeExchangeResponseSchema = z.object({
    token: z.string().optional(),
    resetToken: z.string().optional(),
    expiresAt: z.iso.datetime().optional(),
})
