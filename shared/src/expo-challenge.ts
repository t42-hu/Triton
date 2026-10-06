export function challengeReturnUrl(value: string, allowed: readonly string[], state: string) {
    if (!/^[a-f0-9-]{36}$/i.test(state)) throw new Error('Invalid security check state')
    const url = new URL(value)
    if (url.username || url.password || url.search || url.hash || !allowed.includes(url.href))
        throw new Error('Untrusted security check return URL')
    return url
}
export function challengeToken(callback: string, returnUrl: string, state: string) {
    const url = new URL(callback)
    const data = new URLSearchParams(url.hash.slice(1))
    url.hash = ''
    if (url.href !== new URL(returnUrl).href || data.get('state') !== state)
        throw new Error('Invalid security check response')
    const token = data.get('captcha')
    if (!token || token.length > 2048) throw new Error('Missing security check token')
    return token
}
