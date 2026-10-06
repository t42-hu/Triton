export function apiUrl(path: string): string {
    const base = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '')
    return `${base}/${path.replace(/^\/?api\//, '').replace(/^\//, '')}`
}
