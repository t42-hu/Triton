import { applicationOrigin, trustedOrigins } from '@fullstack-starter/shared'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { bearer, captcha } from 'better-auth/plugins'
import { expo } from '@better-auth/expo'
import type { DatabaseService } from '../database/database.service.js'
import type { MailService } from '../mail/mail.service.js'
import { renderResetPasswordEmail } from '../mail/templates/reset-password-email.js'

export const createAuth = (databaseService: DatabaseService, mailService: MailService) => {
    const appName = process.env.APP_NAME?.trim() || 'Fullstack Starter'
    const appDomain = process.env.APP_DOMAIN?.trim()
    const authBaseUrl = `${applicationOrigin(process.env)}/api/auth`
    const allowedOrigins = trustedOrigins(process.env)
    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY?.trim()
    const turnstileAllowedHostnames = [
        ...(appDomain ? [appDomain] : []),
        ...(process.env.NODE_ENV === 'production' ? [] : ['localhost']),
    ]
    const socialProviders = {
        ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
            ? {
                  google: {
                      clientId: process.env.GOOGLE_CLIENT_ID,
                      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                  },
              }
            : {}),
        ...(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
            ? {
                  microsoft: {
                      clientId: process.env.MICROSOFT_CLIENT_ID,
                      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
                      tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
                  },
              }
            : {}),
        ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
            ? {
                  github: {
                      clientId: process.env.GITHUB_CLIENT_ID,
                      clientSecret: process.env.GITHUB_CLIENT_SECRET,
                  },
              }
            : {}),
        ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
            ? {
                  facebook: {
                      clientId: process.env.FACEBOOK_CLIENT_ID,
                      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
                  },
              }
            : {}),
    }

    return betterAuth({
        basePath: '/api/auth',
        baseURL: authBaseUrl,
        trustedOrigins: allowedOrigins,
        secret: process.env.BETTER_AUTH_SECRET,
        advanced: { cookiePrefix: process.env.APP_ID || 'fullstack-starter' },
        database: drizzleAdapter(databaseService.db, {
            provider: 'pg',
        }),
        user: {
            fields: {
                image: 'profileImage',
            },
        },
        emailAndPassword: {
            enabled: true,
            revokeSessionsOnPasswordReset: true,
            sendResetPassword: async ({ user, url }) => {
                const email = await renderResetPasswordEmail({
                    appName,
                    resetUrl: url,
                    userName: user.name,
                })

                await mailService.send({
                    to: user.email,
                    subject: `Reset your ${appName} password`,
                    ...email,
                })
            },
        },
        plugins: [
            ...(process.env.EXPO_AUTH_ENABLED === 'true' ? [expo()] : []),
            ...(process.env.NATIVE_AUTH_ENABLED === 'true' ? [bearer({ requireSignature: true })] : []),
            ...(turnstileSecret
                ? [
                      captcha({
                          provider: 'cloudflare-turnstile',
                          secretKey: turnstileSecret,
                          allowedHostnames: turnstileAllowedHostnames,
                      }),
                  ]
                : []),
        ],
        socialProviders,
    })
}
