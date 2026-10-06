import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'

config({
    path: fileURLToPath(new URL('../.env', import.meta.url)),
    quiet: true,
})

process.env.NEXT_PUBLIC_APP_ID ||= process.env.APP_ID
if (process.env.APP_NAME) process.env.NEXT_PUBLIC_APP_NAME = process.env.APP_NAME
const appDomain =
    (process.env.NODE_ENV === 'production' ? process.env.PROD_APP_DOMAIN : process.env.DEV_APP_DOMAIN) ||
    process.env.APP_DOMAIN
process.env.NEXT_PUBLIC_APP_DOMAIN ||= appDomain
const localPort =
    process.env.NODE_ENV === 'production'
        ? process.env.PROD_HTTP_PORT || process.env.DEV_HTTP_PORT
        : process.env.DEV_HTTP_PORT || process.env.PROD_HTTP_PORT
process.env.NEXT_PUBLIC_APP_URL =
    (appDomain ? `https://${appDomain}` : process.env.APP_URL) ||
    (localPort ? `http://localhost:${localPort}` : '') ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:8080'

const backendUrl = (process.env.BACKEND_INTERNAL_URL || 'http://localhost:4000').replace(/\/$/, '')

export default {
    output: 'standalone',
    outputFileTracingRoot: fileURLToPath(new URL('..', import.meta.url)),
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
                    { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
                ],
            },
        ]
    },
    async rewrites() {
        return {
            beforeFiles: [
                { source: '/', destination: '/triton/index.html' },
                { source: '/explore', destination: '/triton/index.html' },
                { source: '/_expo/:path*', destination: '/triton/_expo/:path*' },
                { source: '/assets/:path*', destination: '/triton/assets/:path*' },
                { source: '/favicon.ico', destination: '/triton/favicon.ico' },
                { source: '/favicon-v15.ico', destination: '/triton/favicon-v15.ico' },
            ],
            afterFiles: [{ source: '/api/:path*', destination: `${backendUrl}/api/:path*` }],
            fallback: [],
        }
    },
}
