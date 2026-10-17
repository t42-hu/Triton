import type { BetterAuthPlugin } from 'better-auth'
import { APIError, createAuthEndpoint, createAuthMiddleware, getAuthoritativeSessionFromCtx, sensitiveSessionMiddleware } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import { z } from 'zod'
import { loginSecret } from './email-login-store.js'
import type { PasswordChangeStore } from './password-change-store.js'
import type { MailService } from '../mail/mail.service.js'

const passwordBody = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(8).max(128) })
const invalidPassword = () => APIError.from('BAD_REQUEST', { code: 'INVALID_PASSWORD', message: 'A jelenlegi jelszó nem megfelelő.' })
const page = (title: string, content: string, status = 200) => new Response(
    `<!doctype html><html lang="hu"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Triton42 – Jelszócsere</title><body style="font-family:system-ui;max-width:480px;margin:15vh auto;padding:24px"><h1>${title}</h1>${content}</body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'", 'X-Content-Type-Options': 'nosniff' } },
)

export function accountSecurity(store: PasswordChangeStore, mail: Pick<MailService, 'send'>, origin: string): BetterAuthPlugin {
    return {
        id: 'account-security',
        hooks: { before: [{
            matcher: ctx => ctx.path === '/change-password',
            handler: createAuthMiddleware(async ctx => {
                const session = await getAuthoritativeSessionFromCtx(ctx)
                if (!session) throw APIError.from('UNAUTHORIZED', { code: 'UNAUTHORIZED', message: 'Jelentkezz be újra.' })
                const parsed = passwordBody.safeParse(ctx.body)
                if (!parsed.success) throw APIError.from('BAD_REQUEST', { code: 'INVALID_PASSWORD_LENGTH', message: 'Az új jelszó 8–128 karakter legyen.' })
                const { currentPassword, newPassword } = parsed.data
                const account = (await ctx.context.internalAdapter.findAccounts(session.user.id)).find(a => a.providerId === 'credential' && a.password)
                if (!account?.password || !await ctx.context.password.verify({ hash: account.password, password: currentPassword })) throw invalidPassword()
                const token = loginSecret()
                const created = await store.create(token, { userId: session.user.id, email: session.user.email, accountId: account.id,
                    oldHash: account.password, newHash: await ctx.context.password.hash(newPassword), sessionId: session.session.id })
                if (!created) throw invalidPassword()
                const url = new URL('/api/auth/password-change/confirm', origin)
                url.searchParams.set('token', token)
                try {
                    await mail.send({ to: session.user.email, subject: 'Triton42 – Jelszócsere megerősítése',
                        text: `Az új jelszó csak a jóváhagyásod után lép életbe. A megerősítéshez nyisd meg ezt a hivatkozást:\n${url.href}\n\n10 percig érvényes, egyszer használható. Ha nem te kezdeményezted, ne hagyd jóvá.`,
                        html: `<div lang="hu" style="font-family:system-ui;padding:24px"><h1>Jelszócsere megerősítése</h1><p>Az új jelszó csak a jóváhagyásod után lép életbe.</p><p><a href="${url.href}">Jelszócsere jóváhagyása</a></p><p>A hivatkozás 10 percig érvényes, egyszer használható. Ha nem te kezdeményezted, ne hagyd jóvá.</p></div>` })
                } catch {
                    await store.cancel(token)
                    throw APIError.from('SERVICE_UNAVAILABLE', { code: 'EMAIL_DELIVERY_FAILED', message: 'Nem sikerült elküldeni a megerősítő emailt. A jelszavad nem változott meg.' })
                }
                // Short-circuit Better Auth's immediate password update.
                return ctx.json({ pending: true, expiresIn: 600 })
            }),
        }] },
        endpoints: {
            confirmPasswordChange: createAuthEndpoint('/password-change/confirm', { method: ['GET', 'POST'], metadata: { allowedMediaTypes: ['application/x-www-form-urlencoded', 'application/json'] } }, async ctx => {
                const token = new URL(ctx.request!.url).searchParams.get('token') || ''
                if (!/^[a-f0-9]{64}$/.test(token)) return page('Érvénytelen hivatkozás', '<p>Indíts új jelszócserét a fiókbeállításokban.</p>', 400)
                // Email link scanners may fetch GET links. Only an explicit form submission applies the password.
                if (ctx.request!.method === 'GET') return page('Jelszócsere jóváhagyása', `<p>Az alábbi gombbal lép életbe az új jelszó. A többi eszközről kijelentkeztetünk.</p><form method="post" action="?token=${token}"><button type="submit" style="padding:14px 20px">Új jelszó megerősítése</button></form>`)
                const success = await store.confirm(token)
                return page(success ? 'Jelszó megváltoztatva' : 'A hivatkozás már nem érvényes', success ? '<p>Mostantól az új jelszavaddal léphetsz be. A többi eszközről kijelentkeztettünk.</p>' : '<p>A hivatkozás lejárt, már felhasználtad, vagy újabb jelszócserét indítottál. Indíts új kérelmet a fiókbeállításokban.</p>', success ? 200 : 400)
            }),
            emailTwoFactorSettings: createAuthEndpoint('/two-factor/email/settings', {
                method: 'POST', use: [sensitiveSessionMiddleware], body: z.object({ enabled: z.boolean(), password: z.string().min(1).max(128) }),
            }, async ctx => {
                const { session } = ctx.context
                const account = (await ctx.context.internalAdapter.findAccounts(session.user.id)).find(a => a.providerId === 'credential' && a.password)
                if (!account?.password || !await ctx.context.password.verify({ hash: account.password, password: ctx.body.password })) throw invalidPassword()
                const user = await ctx.context.internalAdapter.updateUser(session.user.id, { twoFactorEnabled: ctx.body.enabled })
                await setSessionCookie(ctx, { session: session.session, user })
                return ctx.json({ twoFactorEnabled: ctx.body.enabled })
            }),
        },
        rateLimit: [
            { pathMatcher: p => p === '/change-password' || p === '/two-factor/email/settings', window: 60, max: 5 },
            { pathMatcher: p => p === '/password-change/confirm', window: 60, max: 20 },
        ],
    }
}
