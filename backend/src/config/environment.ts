import { z } from 'zod'
import {
    applicationOrigin,
    HttpUrlSchema,
    trustedOrigins,
    NativeOriginSchema,
    NativeSchemeSchema,
} from '@fullstack-starter/shared'

const optional = z.string().optional()
const flag = z.enum(['true', 'false']).optional()
const schema = z
    .object({
        NODE_ENV: z.enum(['development', 'test', 'production']).optional(),
        NATIVE_AUTH_ENABLED: flag,
        NATIVE_APP_SCHEME: optional,
        NATIVE_TRUSTED_ORIGINS: optional,
        EXPO_AUTH_ENABLED: flag,
        EXPO_APP_SCHEME: optional,
        EXPO_WEB_ORIGIN: HttpUrlSchema.or(z.literal('')).optional(),
        APP_DOMAIN: z
            .string()
            .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/)
            .or(z.literal(''))
            .optional(),
        APP_ID: z
            .string()
            .regex(/^[a-z][a-z0-9-]{2,47}$/)
            .optional(),
        APP_URL: HttpUrlSchema.refine((value) => {
            if (!URL.canParse(value)) return false
            const url = new URL(value)
            return !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash
        }, 'must be an origin without credentials, path, query, or fragment').optional(),
        BETTER_AUTH_URL: HttpUrlSchema.optional(),
        BETTER_AUTH_SECRET: z.string().min(32),
        DATABASE_URL: z.url().refine((value) => /^postgres(?:ql)?:\/\//.test(value)),
        CACHE_URL: z.url().refine((value) => /^rediss?:\/\//.test(value)),
        RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().optional(),
        RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().optional(),
        LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
        OTEL_ENABLED: flag,
        OTEL_SERVICE_NAME: z
            .string()
            .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/)
            .or(z.literal(''))
            .optional(),
        OTEL_EXPORTER_OTLP_ENDPOINT: HttpUrlSchema.or(z.literal('')).optional(),
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: HttpUrlSchema.or(z.literal('')).optional(),
        SEARCH_ENABLED: flag,
        VIRUS_SCAN_ENABLED: flag,
        SEARCH_ENGINE_URL: optional,
        SEARCH_ENGINE_MASTER_KEY: optional,
        VIRUS_SCANNER_HOST: optional,
        VIRUS_SCANNER_PORT: optional,
        MAIL_PROVIDER: z.enum(['disabled', 'smtp', 'ses', '']).optional(),
        MAIL_FROM: optional,
        SMTP_HOST: optional,
        SMTP_PORT: optional,
        AWS_ACCESS_KEY_ID: optional,
        AWS_SECRET_ACCESS_KEY: optional,
        R2_ENDPOINT: optional,
        R2_REGION: optional,
        R2_ACCESS_KEY_ID: optional,
        R2_SECRET_ACCESS_KEY: optional,
        R2_BUCKET: optional,
        R2_PUBLIC_URL: optional,
        STRIPE_SECRET_KEY: optional,
        STRIPE_WEBHOOK_SECRET: optional,
        STRIPE_ALLOWED_PRICE_IDS: optional,
        GOOGLE_CLIENT_ID: optional,
        GOOGLE_CLIENT_SECRET: optional,
        GITHUB_CLIENT_ID: optional,
        GITHUB_CLIENT_SECRET: optional,
        MICROSOFT_CLIENT_ID: optional,
        MICROSOFT_CLIENT_SECRET: optional,
        FACEBOOK_CLIENT_ID: optional,
        FACEBOOK_CLIENT_SECRET: optional,
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: optional,
        TURNSTILE_SECRET_KEY: optional,
    })
    .passthrough()
    .superRefine((env, ctx) => {
        const issue = (key: string, message: string) => ctx.addIssue({ code: 'custom', path: [key], message })
        const group = (name: string, keys: string[]) => {
            const count = keys.filter((key) => Boolean(env[key])).length
            if (count && count !== keys.length)
                issue(
                    keys.find((key) => !env[key])!,
                    `${name} must define all of: ${keys.join(', ')}`,
                )
        }
        if (env.NATIVE_AUTH_ENABLED === 'true') {
            if (!NativeSchemeSchema.safeParse(env.NATIVE_APP_SCHEME).success)
                issue('NATIVE_APP_SCHEME', 'must be a unique application URL scheme')
            if (!env.NATIVE_TRUSTED_ORIGINS?.trim())
                issue('NATIVE_TRUSTED_ORIGINS', 'must list exact native application origins')
        }
        if (
            env.EXPO_AUTH_ENABLED === 'true' &&
            !NativeSchemeSchema.safeParse(env.EXPO_APP_SCHEME || env.APP_ID).success
        )
            issue('EXPO_APP_SCHEME', 'must be a unique application URL scheme')
        for (const provider of ['GOOGLE', 'GITHUB', 'MICROSOFT', 'FACEBOOK'])
            group(`${provider} login`, [`${provider}_CLIENT_ID`, `${provider}_CLIENT_SECRET`])
        group('Stripe', ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_ALLOWED_PRICE_IDS'])
        group('Turnstile', ['NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY'])
        group('R2 storage', ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_URL'])
        group('SMTP credentials', ['SMTP_USER', 'SMTP_PASSWORD'])
        group('SES credentials', ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'])
        for (const key of ['R2_ENDPOINT', 'R2_PUBLIC_URL'])
            if (env[key] && !HttpUrlSchema.safeParse(env[key]).success) issue(key, 'must be an HTTP(S) URL')
        if (
            env.MAIL_PROVIDER &&
            env.MAIL_PROVIDER !== 'disabled' &&
            (!env.MAIL_FROM || (/@example\.com>?$/.test(env.MAIL_FROM) && env.NODE_ENV === 'production'))
        )
            issue('MAIL_FROM', 'must be a configured sender')
        if (
            env.MAIL_PROVIDER === 'smtp' &&
            (!env.SMTP_HOST || !z.coerce.number().int().min(1).max(65535).safeParse(env.SMTP_PORT).success)
        )
            issue('SMTP_HOST', 'SMTP requires a host and valid port')
        if (
            env.SEARCH_ENABLED === 'true' &&
            (!HttpUrlSchema.safeParse(env.SEARCH_ENGINE_URL).success || !env.SEARCH_ENGINE_MASTER_KEY)
        )
            issue('SEARCH_ENGINE_URL', 'enabled search requires URL and master key')
        if (
            env.VIRUS_SCAN_ENABLED === 'true' &&
            (!env.VIRUS_SCANNER_HOST ||
                !z.coerce.number().int().min(1).max(65535).safeParse(env.VIRUS_SCANNER_PORT).success)
        )
            issue('VIRUS_SCANNER_HOST', 'enabled scanning requires host and valid port')
        if (env.NODE_ENV === 'production') {
            if (/local-development|change-before-production|replace-with/.test(env.BETTER_AUTH_SECRET))
                issue('BETTER_AUTH_SECRET', 'must not use a starter secret')
            let password = ''
            try {
                password = decodeURIComponent(new URL(env.DATABASE_URL).password)
            } catch {
                /* Report without exposing credentials. */
            }
            if (password.length < 16 || /starter[-_]local[-_]password|change-this|replace-with/.test(password))
                issue('DATABASE_URL', 'must use a unique password with at least 16 characters')
            if (
                env.SEARCH_ENABLED === 'true' &&
                (!env.SEARCH_ENGINE_MASTER_KEY ||
                    env.SEARCH_ENGINE_MASTER_KEY.length < 16 ||
                    /starter_dev_master_key/.test(env.SEARCH_ENGINE_MASTER_KEY))
            )
                issue('SEARCH_ENGINE_MASTER_KEY', 'must use a unique search key')
            if (env.STORAGE_AUTO_CREATE_BUCKET === 'true')
                issue('STORAGE_AUTO_CREATE_BUCKET', 'is for development only')
        }
        try {
            const strings = env as Record<string, string | undefined>
            applicationOrigin(strings)
            for (const origin of trustedOrigins(strings)) {
                if (
                    !(env.EXPO_AUTH_ENABLED === 'true' && origin === `${env.EXPO_APP_SCHEME || env.APP_ID}://`) &&
                    !NativeOriginSchema.safeParse(origin).success
                )
                    throw new Error()
            }
        } catch {
            issue('APP_URL', 'application and trusted URLs must be exact allowed origins')
        }
    })

export function validateEnvironment(environment: Record<string, unknown>): Record<string, unknown> {
    const result = schema.safeParse(environment)
    if (result.success) return environment
    const details = result.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; ')
    throw new Error(`Invalid ${environment.NODE_ENV || 'development'} configuration: ${details}`)
}
