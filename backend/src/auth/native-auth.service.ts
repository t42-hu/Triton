import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { AuthService } from '@thallesp/nestjs-better-auth'
import { createHash, createHmac, randomBytes } from 'node:crypto'
import { applicationOrigin, NativeExchangeSchema, NativeStartSchema } from '@fullstack-starter/shared'
import { CacheService } from '../cache/cache.service.js'
import type { createAuth } from './auth.js'

type Flow = {
    intent: 'sign-in' | 'password-reset'
    challenge: string
    state: string
    userId?: string
    codeHash?: string
    resetToken?: string
}
const hash = (value: string) => createHash('sha256').update(value).digest('base64url')

@Injectable()
export class NativeAuthService {
    constructor(
        private readonly cache: CacheService,
        private readonly auth: AuthService<ReturnType<typeof createAuth>>,
    ) {}

    private enabled() {
        if (process.env.NATIVE_AUTH_ENABLED !== 'true') throw new NotFoundException()
    }
    private key(flow: string) {
        if (!/^[a-f0-9]{64}$/.test(flow)) throw new BadRequestException('Invalid native sign-in request')
        return `native-auth:${process.env.APP_ID}:${flow}`
    }
    async start(body: unknown) {
        this.enabled()
        const parsed = NativeStartSchema.safeParse(body)
        if (!parsed.success) throw new BadRequestException('Invalid native sign-in request')
        const flow = randomBytes(32).toString('hex')
        await this.cache.set(this.key(flow), JSON.stringify(parsed.data), 300)
        const url = new URL(
            parsed.data.intent === 'password-reset' ? '/forgot-password' : '/native/connect',
            applicationOrigin(process.env),
        )
        if (parsed.data.intent === 'password-reset') url.searchParams.set('native', '1')
        url.searchParams.set('flow', flow)
        return { flow, browserUrl: url.toString(), expiresIn: 300 }
    }
    async authorize(flow: string, userId: string) {
        this.enabled()
        const key = this.key(flow)
        const raw = await this.cache.get(key)
        if (!raw) throw new BadRequestException('Sign-in request expired')
        const value = JSON.parse(raw) as Flow
        if (value.intent !== 'sign-in' || value.codeHash)
            throw new BadRequestException('Sign-in request already approved')
        return this.approve(flow, key, raw, { ...value, userId })
    }
    async resetHandoff(flow: string, resetToken: string) {
        this.enabled()
        if (!/^[A-Za-z0-9_-]{16,256}$/.test(resetToken)) throw new BadRequestException('Invalid reset link')
        const key = this.key(flow)
        const raw = await this.cache.get(key)
        if (!raw) throw new BadRequestException('App reset request expired')
        const value = JSON.parse(raw) as Flow
        if (value.intent !== 'password-reset' || value.codeHash)
            throw new BadRequestException('Invalid app reset request')
        return this.approve(flow, key, raw, { ...value, resetToken })
    }
    private async approve(flow: string, key: string, raw: string, value: Flow) {
        const code = randomBytes(32).toString('hex')
        const updated = JSON.stringify({ ...value, codeHash: hash(code) })
        const accepted = await this.cache.client.eval(
            "if redis.call('GET',KEYS[1]) == ARGV[1] then redis.call('SET',KEYS[1],ARGV[2],'EX',60); return 1 else return 0 end",
            1,
            key,
            raw,
            updated,
        )
        if (!accepted) throw new BadRequestException('Sign-in request already consumed')
        const callback = new URL(
            `${process.env.NATIVE_APP_SCHEME}://auth/${value.intent === 'password-reset' ? 'reset' : 'callback'}`,
        )
        callback.search = new URLSearchParams({
            flow,
            code,
            state: value.state,
        }).toString()
        return { callbackUrl: callback.toString() }
    }
    async exchange(body: unknown) {
        this.enabled()
        const parsed = NativeExchangeSchema.safeParse(body)
        if (!parsed.success) throw new BadRequestException('Invalid native sign-in exchange')
        const { flow, code, state, verifier } = parsed.data
        const key = this.key(flow)
        const raw = await this.cache.get(key)
        const value: Flow | null = raw ? JSON.parse(raw) : null
        if (
            !value ||
            !(value.intent === 'password-reset' ? value.resetToken : value.userId) ||
            value.state !== state ||
            value.challenge !== hash(verifier) ||
            value.codeHash !== hash(code)
        )
            throw new BadRequestException('Invalid or expired native sign-in exchange')
        const consumed = await this.cache.client.eval(
            "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end",
            1,
            key,
            raw!,
        )
        if (!consumed) throw new BadRequestException('Sign-in request already consumed')
        if (value.intent === 'password-reset') return { resetToken: value.resetToken! }
        const context = await this.auth.instance.$context
        // A new session lets native logout revoke this device without logging out the browser.
        const session = await context.internalAdapter.createSession(value.userId!)
        if (!session) throw new BadRequestException('Could not create native session')
        const signature = createHmac('sha256', context.secret).update(session.token).digest('base64')
        return {
            token: encodeURIComponent(`${session.token}.${signature}`),
            expiresAt: session.expiresAt.toISOString(),
        }
    }
}
