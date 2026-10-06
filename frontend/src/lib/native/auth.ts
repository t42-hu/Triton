import { parseApiResponse } from '../api/api-helper'
import { startNativeAuth, exchangeNativeAuth } from '../api/generated/client'
import { NativeStartResponseSchema, NativeExchangeResponseSchema } from '@fullstack-starter/shared'
import { nativeStorageKey, requireNativePlatform, setSessionToken } from './platform'

const random = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    return btoa(String.fromCharCode(...bytes))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '')
}
const base64url = (buffer: ArrayBuffer) =>
    btoa(String.fromCharCode(...new Uint8Array(buffer)))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '')
async function beginNativeFlow(intent: 'sign-in' | 'password-reset') {
    const platform = requireNativePlatform()
    const verifier = random()
    const state = random()
    const challenge = base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
    const { flow, browserUrl } = parseApiResponse(
        await startNativeAuth({ challenge, state, intent }),
        NativeStartResponseSchema,
    )
    if (new URL(browserUrl).origin !== new URL(process.env.NEXT_PUBLIC_APP_URL!).origin)
        throw new Error('Invalid browser sign-in address')
    await platform.secureStorage.set(
        nativeStorageKey('pending'),
        JSON.stringify({
            flow,
            state,
            verifier,
            intent,
            expires: Date.now() + 300000,
        }),
    )
    return {
        browserUrl,
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/native/reset?${new URLSearchParams({ flow })}`,
    }
}
export async function beginNativeSignIn() {
    const { browserUrl } = await beginNativeFlow('sign-in')
    await requireNativePlatform().openExternal(browserUrl)
}
export async function prepareNativePasswordReset() {
    return beginNativeFlow('password-reset')
}

export async function handleNativeDeepLink(value: string): Promise<string> {
    const platform = requireNativePlatform()
    const url = new URL(value)
    if (
        url.protocol !== `${process.env.NEXT_PUBLIC_NATIVE_SCHEME}:` ||
        url.host !== 'auth' ||
        url.username ||
        url.password ||
        url.hash
    )
        throw new Error('Invalid application link')
    if (!['/callback', '/reset'].includes(url.pathname)) throw new Error('Unsupported application link')
    const raw = await platform.secureStorage.get(nativeStorageKey('pending'))
    if (!raw) throw new Error('No browser sign-in is pending')
    const pending = JSON.parse(raw)
    if (
        Date.now() > pending.expires ||
        pending.intent !== (url.pathname === '/reset' ? 'password-reset' : 'sign-in') ||
        pending.state !== url.searchParams.get('state') ||
        pending.flow !== url.searchParams.get('flow')
    )
        throw new Error('Invalid or expired browser sign-in')
    const code = url.searchParams.get('code')
    if (!code) throw new Error('Missing native authorization code')
    const data = parseApiResponse(
        await exchangeNativeAuth({
            flow: pending.flow,
            verifier: pending.verifier,
            state: pending.state,
            code,
        }),
        NativeExchangeResponseSchema,
    )
    if (url.pathname === '/reset') {
        if (typeof data.resetToken !== 'string' || !/^[A-Za-z0-9_-]{16,256}$/.test(data.resetToken))
            throw new Error('Invalid reset response')
        await platform.secureStorage.remove(nativeStorageKey('pending'))
        return `/reset-password?${new URLSearchParams({ token: data.resetToken })}`
    }
    const { token } = data
    if (typeof token !== 'string' || !token.includes('.')) throw new Error('Invalid session response')
    await setSessionToken(token)
    await platform.secureStorage.remove(nativeStorageKey('pending'))
    return '/profile'
}
