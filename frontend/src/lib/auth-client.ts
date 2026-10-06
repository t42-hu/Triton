import { apiUrl } from './api/url'
import { createAuthClient } from 'better-auth/react'
import { apiFetch } from './api/fetch'

function resolveAuthUrl(): string {
    const configuredUrl = process.env.NEXT_PUBLIC_AUTH_URL?.trim() || apiUrl('/auth')

    if (/^https?:\/\//i.test(configuredUrl)) {
        return configuredUrl
    }

    const origin =
        typeof window === 'undefined' ? process.env.NEXT_PUBLIC_APP_URL || 'http://localhost' : window.location.origin

    return new URL(configuredUrl, origin).toString()
}

export const authClient = createAuthClient({
    baseURL: resolveAuthUrl(),
    fetchOptions: { customFetchImpl: apiFetch },
})
