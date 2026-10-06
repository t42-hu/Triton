import { z } from 'zod'
import { nativeOrigins } from './native-config.js'

export const HttpUrlSchema = z.url().refine((value) => {
    try {
        return ['http:', 'https:'].includes(new URL(value).protocol)
    } catch {
        return false
    }
}, 'must be an HTTP(S) URL')
export const FeatureFlagSchema = z.enum(['true', 'false']).default('false')

export function applicationOrigin(env: Record<string, string | undefined>): string {
    const domain =
        (env.NODE_ENV === 'production' ? env.PROD_APP_DOMAIN : env.DEV_APP_DOMAIN)?.trim() || env.APP_DOMAIN?.trim()
    const localPort =
        env.NODE_ENV === 'production'
            ? env.PROD_HTTP_PORT || env.DEV_HTTP_PORT
            : env.DEV_HTTP_PORT || env.PROD_HTTP_PORT
    return new URL(
        domain
            ? `https://${domain}`
            : env.APP_URL ||
                  (localPort ? `http://localhost:${localPort}` : '') ||
                  env.NEXT_PUBLIC_APP_URL ||
                  env.BETTER_AUTH_URL ||
                  'http://localhost:8080',
    ).origin
}

export function trustedOrigins(env: Record<string, string | undefined>): string[] {
    return [
        ...new Set([
            applicationOrigin(env),
            ...nativeOrigins(env),
            ...(env.EXPO_AUTH_ENABLED === 'true' ? [`${env.EXPO_APP_SCHEME || env.APP_ID}://`] : []),
            ...(env.EXPO_AUTH_ENABLED === 'true' && env.NODE_ENV !== 'production' ? ['http://localhost:8081'] : []),
            ...(env.EXPO_AUTH_ENABLED === 'true' && env.EXPO_WEB_ORIGIN ? [env.EXPO_WEB_ORIGIN] : []),
            ...(env.TRUSTED_ORIGINS || '')
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean),
        ]),
    ]
}

export function integrationFeatures(env: Record<string, string | undefined>) {
    return {
        search: env.SEARCH_ENABLED === 'true',
        uploads: Boolean(
            env.R2_ENDPOINT && env.R2_BUCKET && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_PUBLIC_URL,
        ),
        passwordReset: env.MAIL_PROVIDER === 'smtp' || env.MAIL_PROVIDER === 'ses',
        payments: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && env.STRIPE_ALLOWED_PRICE_IDS),
    }
}
