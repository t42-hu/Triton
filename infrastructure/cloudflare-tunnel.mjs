import { randomBytes } from 'node:crypto'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const apiBaseUrl = (process.env.CLOUDFLARE_API_BASE_URL || 'https://api.cloudflare.com/client/v4').replace(/\/$/, '')

const required = (name) => {
    const value = process.env[name]?.trim()
    if (!value) {
        throw new Error(`${name} is required when the tunnel profile is enabled.`)
    }
    return value
}

const normalizeDomain = (value) => {
    const input = value.trim().toLowerCase().replace(/\.$/, '')
    const hostname = input.includes('://') ? new URL(input).hostname : input.split('/')[0]

    if (
        !hostname ||
        hostname === 'localhost' ||
        hostname.includes(':') ||
        !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostname)
    ) {
        throw new Error(`APP_DOMAIN must be a public hostname, received: ${value}`)
    }

    return hostname
}

const accountId = required('CLOUDFLARE_ACCOUNT_ID')
const apiToken = required('CLOUDFLARE_API_TOKEN')
const domain = normalizeDomain(required('APP_DOMAIN'))
const environment = (process.env.APP_ENVIRONMENT || 'production')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
const tunnelName =
    process.env.CLOUDFLARE_TUNNEL_NAME?.trim() || `fullstack-starter-${domain.replace(/\./g, '-')}-${environment}`
const originUrl = process.env.CLOUDFLARE_ORIGIN_URL?.trim() || 'http://proxy:80'
const tokenFile = process.env.CLOUDFLARE_TUNNEL_TOKEN_FILE || '/run/cloudflare/tunnel-token'
const managedDnsComment = 'Managed automatically by Fullstack Starter Cloudflare Tunnel'

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function cloudflare(path, options = {}, attempt = 0) {
    const response = await fetch(`${apiBaseUrl}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
            ...options.headers,
        },
        signal: AbortSignal.timeout(20_000),
    })

    if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        await sleep(500 * 2 ** attempt)
        return cloudflare(path, options, attempt + 1)
    }

    const payload = response.status === 204 ? { success: true } : await response.json()

    if (!response.ok || payload.success === false) {
        const details = payload.errors?.map((error) => `${error.code ?? 'unknown'}: ${error.message}`).join('; ')
        throw new Error(
            `Cloudflare API ${options.method || 'GET'} ${path} failed (${response.status})${
                details ? `: ${details}` : ''
            }`,
        )
    }

    return payload
}

async function listAll(path) {
    const separator = path.includes('?') ? '&' : '?'
    const first = await cloudflare(`${path}${separator}page=1&per_page=50`)
    const results = [...(first.result || [])]
    const totalPages = first.result_info?.total_pages || 1

    for (let page = 2; page <= totalPages; page += 1) {
        const response = await cloudflare(`${path}${separator}page=${page}&per_page=50`)
        results.push(...(response.result || []))
    }

    return results
}

async function findZone() {
    const zones = await listAll('/zones?status=active')
    const candidates = zones
        .filter((zone) => zone.account?.id === accountId && (domain === zone.name || domain.endsWith(`.${zone.name}`)))
        .sort((left, right) => right.name.length - left.name.length)

    if (!candidates[0]) {
        throw new Error(
            `No active Cloudflare zone in account ${accountId} matches ${domain}. ` +
                'Add the purchased domain to Cloudflare and activate its nameservers first.',
        )
    }

    return candidates[0]
}

async function findOrCreateTunnel() {
    const tunnels = await listAll(
        `/accounts/${accountId}/cfd_tunnel?is_deleted=false&name=${encodeURIComponent(tunnelName)}`,
    )
    const existing = tunnels.find((tunnel) => tunnel.name === tunnelName)

    if (existing) {
        if (existing.config_src !== 'cloudflare') {
            throw new Error(
                `Tunnel ${tunnelName} already exists but is locally managed. ` +
                    'Choose a different CLOUDFLARE_TUNNEL_NAME.',
            )
        }
        console.log(`Reusing Cloudflare Tunnel: ${tunnelName}`)
        return existing
    }

    const created = await cloudflare(`/accounts/${accountId}/cfd_tunnel`, {
        method: 'POST',
        body: JSON.stringify({
            name: tunnelName,
            config_src: 'cloudflare',
            tunnel_secret: randomBytes(32).toString('base64'),
        }),
    })

    console.log(`Created Cloudflare Tunnel: ${tunnelName}`)
    return created.result
}

async function configureTunnel(tunnelId) {
    await cloudflare(`/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`, {
        method: 'PUT',
        body: JSON.stringify({
            config: {
                ingress: [{ hostname: domain, service: originUrl }, { service: 'http_status:404' }],
            },
        }),
    })
    console.log(`Configured ${domain} -> ${originUrl}`)
}

async function configureDns(zoneId, tunnelId) {
    const target = `${tunnelId}.cfargotunnel.com`
    const records = await listAll(`/zones/${zoneId}/dns_records?name=${encodeURIComponent(domain)}`)
    const addressRecords = records.filter((record) => ['A', 'AAAA', 'CNAME'].includes(record.type))
    const reusable = addressRecords.find((record) => record.type === 'CNAME' && record.content === target)
    const unmanagedConflicts = addressRecords.filter(
        (record) => record.id !== reusable?.id && record.comment !== managedDnsComment,
    )

    if (unmanagedConflicts.length > 0) {
        const summary = unmanagedConflicts.map((record) => `${record.type} ${record.content}`).join(', ')
        throw new Error(
            `Refusing to replace unmanaged DNS records for ${domain}: ${summary}. ` +
                'Remove or move those records deliberately, then start the tunnel again.',
        )
    }

    for (const record of addressRecords) {
        if (record.id !== reusable?.id) {
            await cloudflare(`/zones/${zoneId}/dns_records/${record.id}`, {
                method: 'DELETE',
            })
            console.log(`Removed conflicting ${record.type} record for ${domain}`)
        }
    }

    const record = {
        type: 'CNAME',
        name: domain,
        content: target,
        proxied: true,
        ttl: 1,
        comment: managedDnsComment,
    }

    if (reusable) {
        await cloudflare(`/zones/${zoneId}/dns_records/${reusable.id}`, {
            method: 'PUT',
            body: JSON.stringify(record),
        })
    } else {
        await cloudflare(`/zones/${zoneId}/dns_records`, {
            method: 'POST',
            body: JSON.stringify(record),
        })
    }

    console.log(`Configured proxied DNS: ${domain} -> ${target}`)
}

async function writeTunnelToken(tunnelId) {
    const response = await cloudflare(`/accounts/${accountId}/cfd_tunnel/${tunnelId}/token`)
    const token = response.result

    if (typeof token !== 'string' || token.length < 20) {
        throw new Error('Cloudflare returned an invalid tunnel token.')
    }

    await mkdir(dirname(tokenFile), { recursive: true })
    // The volume is mounted only into the setup job and cloudflared. World-read
    // inside that private volume avoids assuming a UID used by the vendor image.
    await writeFile(tokenFile, `${token}\n`, { mode: 0o444 })
    await chmod(tokenFile, 0o444)
    console.log('Stored the runtime tunnel token without exposing it in logs.')
}

async function main() {
    const zone = await findZone()
    const tunnel = await findOrCreateTunnel()
    await configureTunnel(tunnel.id)
    await configureDns(zone.id, tunnel.id)
    await writeTunnelToken(tunnel.id)
    console.log(`Cloudflare setup complete: https://${domain}`)
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
})
