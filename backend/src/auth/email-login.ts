import type { BetterAuthPlugin } from 'better-auth'
import { APIError, createAuthEndpoint, createAuthMiddleware } from 'better-auth/api'
import { deleteSessionCookie, expireCookie, setSessionCookie } from 'better-auth/cookies'
import { loginDigest, loginSecret, EMAIL_LOGIN_SECONDS, type EmailLoginStore } from './email-login-store.js'
import type { MailService } from '../mail/mail.service.js'
import { renderEmailLoginEmail } from '../mail/templates/email-login-email.js'

const page = (success: boolean) =>
    new Response(
        `<!doctype html><html lang="hu"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Triton42 – Belépés</title><body style="font-family:system-ui;max-width:480px;margin:15vh auto;padding:24px"><h1>${success ? 'Belépés jóváhagyva' : 'A hivatkozás nem érvényes'}</h1><p>${success ? 'Térj vissza a böngészőhöz vagy az alkalmazáshoz, ahol a belépést elindítottad. Ott automatikusan bejelentkezel.' : 'A hivatkozás lejárt, már felhasználtad, vagy a belépést megszakítottad. Indíts új belépést az alkalmazásban.'}</p></body></html>`,
        {
            status: success ? 200 : 400,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store',
                'Referrer-Policy': 'no-referrer',
                'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
                'X-Content-Type-Options': 'nosniff',
            },
        },
    )

export function emailLogin(
    store: EmailLoginStore,
    mail: Pick<MailService, 'send'>,
    publicOrigin: string,
): BetterAuthPlugin {
    return {
        id: 'email-login',
        schema: { user: { fields: { twoFactorEnabled: { type: 'boolean', defaultValue: true, input: false, required: false } } } },
        hooks: {
            after: [
                {
                    matcher: (ctx) => ctx.path === '/sign-in/email' || ctx.path === '/sign-up/email',
                    handler: createAuthMiddleware(async (ctx) => {
                        const pending = ctx.context.newSession
                        if (!pending) return
                        if (ctx.path === '/sign-in/email' && pending.user.emailVerified && (pending.user as typeof pending.user & { twoFactorEnabled?: boolean }).twoFactorEnabled === false) return
                        // Password success must never expose a usable session before email approval.
                        deleteSessionCookie(ctx, true)
                        await ctx.context.internalAdapter.deleteSession(pending.session.token)
                        ctx.context.setNewSession(null)
                        const cookie = ctx.context.createAuthCookie('two_factor', { maxAge: EMAIL_LOGIN_SECONDS })
                        const previous = await ctx.getSignedCookie(cookie.name, ctx.context.secret)
                        if (previous) await store.cancel(previous)
                        const proof = loginSecret()
                        const token = loginSecret()
                        await store.create(proof, token, pending.user.id, ctx.body?.rememberMe !== false)
                        const url = new URL('/api/auth/two-factor/email/approve', publicOrigin)
                        url.searchParams.set('token', `${loginDigest(proof)}.${token}`)
                        try {
                            await mail.send({
                                to: pending.user.email,
                                subject: 'Triton42 – Bejelentkezés jóváhagyása',
                                ...renderEmailLoginEmail(url.href, pending.user.email),
                            })
                        } catch {
                            await store.cancel(proof)
                            expireCookie(ctx, cookie)
                            throw APIError.from('SERVICE_UNAVAILABLE', {
                                code: 'EMAIL_DELIVERY_FAILED',
                                message: 'Nem sikerült elküldeni a belépési emailt. Próbáld újra később.',
                            })
                        }
                        await ctx.setSignedCookie(cookie.name, proof, ctx.context.secret, cookie.attributes)
                        return ctx.json({
                            twoFactorRedirect: true,
                            twoFactorMethods: ['email-link'],
                            expiresIn: EMAIL_LOGIN_SECONDS,
                        })
                    }),
                },
            ],
        },
        endpoints: {
            approveEmailLogin: createAuthEndpoint('/two-factor/email/approve', { method: 'GET' }, async (ctx) => {
                const token = new URL(ctx.request!.url).searchParams.get('token') || ''
                return page(await store.approve(token))
            }),
            emailLoginStatus: createAuthEndpoint('/two-factor/email/status', { method: 'POST' }, async (ctx) => {
                const cookie = ctx.context.createAuthCookie('two_factor')
                const proof = await ctx.getSignedCookie(cookie.name, ctx.context.secret)
                if (!proof)
                    throw APIError.from('UNAUTHORIZED', {
                        code: 'INVALID_EMAIL_CHALLENGE',
                        message: 'Indíts új belépést.',
                    })
                const result = await store.claim(proof)
                if (result === 'pending') return ctx.json({ pending: true })
                if (!result) {
                    expireCookie(ctx, cookie)
                    throw APIError.from('UNAUTHORIZED', {
                        code: 'EMAIL_CHALLENGE_EXPIRED',
                        message: 'A belépési hivatkozás lejárt. Indíts új belépést.',
                    })
                }
                const user = await ctx.context.internalAdapter.findUserById(result.userId)
                if (!user)
                    throw APIError.from('UNAUTHORIZED', {
                        code: 'INVALID_EMAIL_CHALLENGE',
                        message: 'Indíts új belépést.',
                    })
                const verifiedUser = user.emailVerified
                    ? user
                    : await ctx.context.internalAdapter.updateUser(user.id, { emailVerified: true })
                const session = await ctx.context.internalAdapter.createSession(user.id, !result.remember)
                if (!session)
                    throw APIError.from('INTERNAL_SERVER_ERROR', {
                        code: 'SESSION_CREATION_FAILED',
                        message: 'Nem sikerült bejelentkezni. Indíts új belépést.',
                    })
                await setSessionCookie(ctx, { session, user: verifiedUser })
                expireCookie(ctx, cookie)
                return ctx.json({ pending: false })
            }),
            cancelEmailLogin: createAuthEndpoint('/two-factor/email/cancel', { method: 'POST' }, async (ctx) => {
                const cookie = ctx.context.createAuthCookie('two_factor')
                const proof = await ctx.getSignedCookie(cookie.name, ctx.context.secret)
                if (proof) await store.cancel(proof)
                expireCookie(ctx, cookie)
                return ctx.json({ status: true })
            }),
        },
        rateLimit: [
            { pathMatcher: (path) => path === '/two-factor/email/status', window: 60, max: 40 },
            { pathMatcher: (path) => path === '/two-factor/email/approve', window: 60, max: 20 },
        ],
    }
}
