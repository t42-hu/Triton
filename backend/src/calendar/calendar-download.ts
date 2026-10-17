import { Injectable } from '@nestjs/common'
import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import { BlockList, isIP } from 'node:net'

const blocked = new BlockList()
for (const [address, prefix] of [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
] as const)
    blocked.addSubnet(address, prefix, 'ipv4')
const globalV6 = new BlockList()
globalV6.addSubnet('2000::', 3, 'ipv6')
for (const [address, prefix] of [
    ['2001::', 23],
    ['2001:db8::', 32],
    ['2002::', 16],
    ['3fff::', 20],
] as const)
    blocked.addSubnet(address, prefix, 'ipv6')
export function publicCalendarAddress(address: string): boolean {
    const family = isIP(address)
    return family === 4
        ? !blocked.check(address, 'ipv4')
        : family === 6 && globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6')
}
export function subscriptionUrl(input: string): URL {
    let url: URL
    try {
        url = new URL(input.trim().replace(/^webcal:/i, 'https:'))
    } catch {
        throw new Error('Érvénytelen naptárlink.')
    }
    if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        (url.port && url.port !== '443') ||
        input.length > 4096
    )
        throw new Error('Csak jelszó nélküli HTTPS naptárlink használható.')
    url.hash = ''
    return url
}
export type CalendarDownloadResult = {
    content?: string
    etag: string | null
    lastModified: string | null
    retryAfter?: number
}
export class CalendarDownloadError extends Error {
    constructor(
        message: string,
        readonly retryAfter = 0,
    ) {
        super(message)
    }
}
@Injectable()
export class CalendarDownload {
    async download(
        input: string,
        validators: { etag?: string | null; lastModified?: string | null } = {},
    ): Promise<CalendarDownloadResult> {
        const signal = AbortSignal.timeout(30000)
        let url = subscriptionUrl(input)
        for (let redirects = 0; redirects <= 3; redirects++) {
            signal.throwIfAborted()
            const hostname = url.hostname.replace(/^\[|\]$/g, '')
            const records = isIP(hostname)
                ? [{ address: hostname, family: isIP(hostname) }]
                : await Promise.race([
                      lookup(hostname, { all: true }),
                      new Promise<never>((_, reject) =>
                          signal.addEventListener(
                              'abort',
                              () => reject(new Error('A naptár letöltése túllépte az időkorlátot.')),
                              { once: true },
                          ),
                      ),
                  ])
            if (!records.length || records.some((row) => !publicCalendarAddress(row.address)))
                throw new Error('A naptárlink nem nyilvános hálózati címre mutat.')
            const address = records.find(row => row.family === 4) ?? records[0]
            const result = await new Promise<{
                location?: string
                status: number
                body: string
                etag: string | null
                lastModified: string | null
                retryAfter: number
            }>((resolve, reject) => {
                const req = request(
                    url,
                    {
                        signal,
                        agent: false,
                        family: address.family,
                        lookup: (_host, options, callback) => {
                            if (typeof options === 'object' && options.all)
                                callback(null, [{ address: address.address, family: address.family }])
                            else callback(null, address.address, address.family)
                        },
                        headers: {
                            Accept: 'text/calendar',
                            'Accept-Encoding': 'identity',
                            'User-Agent': 'Triton42-Calendar/1.0',
                            ...(validators.etag ? { 'If-None-Match': validators.etag } : {}),
                            ...(validators.lastModified ? { 'If-Modified-Since': validators.lastModified } : {}),
                        },
                    },
                    (res) => {
                        const chunks: Buffer[] = []
                        let bytes = 0
                        const length = Number(res.headers['content-length'] || 0)
                        if (
                            length > 1000000 ||
                            (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity')
                        ) {
                            res.destroy()
                            reject(new Error('A naptár túl nagy vagy nem támogatott tömörítésű.'))
                            return
                        }
                        res.on('data', (chunk: Buffer) => {
                            bytes += chunk.length
                            if (bytes > 1000000) {
                                res.destroy(new Error('size limit'))
                                return
                            }
                            chunks.push(chunk)
                        })
                        res.on('error', () => reject(new Error('A naptár letöltése megszakadt.')))
                        res.on('end', () => {
                            const retry = res.headers['retry-after']
                            const retryAfter = retry
                                ? /^\d+$/.test(retry)
                                    ? Number(retry) * 1000
                                    : Math.max(0, Date.parse(retry) - Date.now())
                                : 0
                            resolve({
                                status: res.statusCode || 500,
                                location: res.headers.location,
                                body: Buffer.concat(chunks).toString('utf8'),
                                etag: res.headers.etag || null,
                                lastModified: res.headers['last-modified'] || null,
                                retryAfter: Number.isFinite(retryAfter) ? Math.min(retryAfter, 86400000) : 0,
                            })
                        })
                    },
                )
                req.on('error', () => reject(new Error('A naptár biztonságos letöltése nem sikerült.')))
                req.end()
            })
            if ([301, 302, 303, 307, 308].includes(result.status) && result.location) {
                const next = subscriptionUrl(new URL(result.location, url).href)
                if (next.origin !== url.origin) validators = {}
                url = next
                continue
            }
            if (result.status === 304)
                return {
                    etag: result.etag || validators.etag || null,
                    lastModified: result.lastModified || validators.lastModified || null,
                }
            if (result.status !== 200)
                throw new CalendarDownloadError(`A naptár nem érhető el (HTTP ${result.status}).`, result.retryAfter)
            if (!/^BEGIN:VCALENDAR\s/im.test(result.body) || !/END:VCALENDAR\s*$/i.test(result.body.trim()))
                throw new Error('A link nem teljes ICS naptárat adott vissza.')
            return { content: result.body, etag: result.etag, lastModified: result.lastModified }
        }
        throw new Error('Túl sok naptár-átirányítás.')
    }
}
