export const isNative = process.env.NEXT_PUBLIC_NATIVE === 'true'

/** Installed by Electron's isolated preload before rendering the application. */
export interface NativePlatform {
    secureStorage: {
        get(key: string): Promise<string | null>
        set(key: string, value: string): Promise<void>
        remove(key: string): Promise<void>
    }
    openExternal(url: string): Promise<void>
    onDeepLink(listener: (url: string) => void): Promise<() => void>
    getLaunchUrl(): Promise<string | null>
}
declare global {
    interface Window {
        fullstackNative?: NativePlatform
    }
}
let browserLinksInstalled = false
export function nativePlatform() {
    if (typeof window === 'undefined') return
    if (isNative && window.fullstackNative && !browserLinksInstalled) {
        browserLinksInstalled = true
        const platform = window.fullstackNative
        if (platform)
            document.addEventListener('click', (event) => {
                const link = (event.target as Element | null)?.closest?.('a[href]')
                if (!link) return
                const url = new URL(link.getAttribute('href')!, location.href)
                if (url.protocol === location.protocol && url.host === location.host) return
                event.preventDefault()
                void platform
                    .openExternal(url.toString())
                    .catch(() => window.dispatchEvent(new Event('fullstack-browser-error')))
            })
    }
    return window.fullstackNative
}
export function requireNativePlatform() {
    const platform = nativePlatform()
    if (!platform) throw new Error('Native integration is unavailable. Please update the app.')
    return platform
}
export const nativeStorageKey = (name: string) =>
    `${process.env.NEXT_PUBLIC_APP_ID}:${process.env.NEXT_PUBLIC_API_URL}:${name}`

let token: string | null = null
let loaded: Promise<void> | undefined
export async function sessionToken() {
    if (!isNative) return null
    loaded ??= (async () => {
        token = (await nativePlatform()?.secureStorage.get(nativeStorageKey('session'))) ?? null
    })()
    try {
        await loaded
    } catch (error) {
        loaded = undefined
        window.dispatchEvent(new Event('fullstack-storage-error'))
        throw error
    }
    return token
}
export async function setSessionToken(value: string | null) {
    await sessionToken()
    if (token === value) return
    const storage = nativePlatform()?.secureStorage
    if (value) await storage?.set(nativeStorageKey('session'), value)
    else await storage?.remove(nativeStorageKey('session'))
    token = value
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('fullstack-session-change'))
}
