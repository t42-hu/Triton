import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'

// Disposable account; exercises the real sync protocol on all three platform identities.
export async function verifyCrossPlatformSyncHttp(pool, origin, secret, prefix) {
    const userId = randomUUID(),
        token = randomUUID(),
        preferenceId = randomUUID()
    const cookie = `${prefix}.session_token=${encodeURIComponent(`${token}.${createHmac('sha256', secret).update(token).digest('base64')}`)}`
    async function request(method, path, body, status = 200) {
        const response = await fetch(`${origin}/api/${path}`, {
            method,
            headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {}),
        })
        assert.equal(response.status, status, `${method} ${path}: ${await response.clone().text()}`)
        return response.json()
    }
    async function snapshot(deviceId) {
        const items = []
        let snapshotToken,
            offset = 0,
            highSequence
        for (;;) {
            const query = new URLSearchParams({
                deviceId,
                limit: '1',
                ...(snapshotToken ? { snapshotToken, offset: String(offset) } : {}),
            })
            const page = await request('GET', `sync/snapshot?${query}`)
            items.push(...page.items)
            snapshotToken = page.snapshotToken
            highSequence = page.highSequence
            if (page.nextOffset === null) break
            offset = page.nextOffset
        }
        await request('POST', 'sync/ack', { deviceId, snapshotToken, sequence: highSequence }, 201)
        return items.find((row) => row.resource === 'preferences')?.record
    }
    await pool.query('INSERT INTO "user"(id,name,email,created_at,updated_at) VALUES($1,$2,$3,now(),now())', [
        userId,
        'Cross-platform sync fixture',
        `${userId}@example.test`,
    ])
    try {
        await pool.query(
            "INSERT INTO session(id,token,user_id,expires_at,created_at,updated_at) VALUES($1,$2,$3,now()+interval '5 minutes',now(),now())",
            [randomUUID(), token, userId],
        )
        const devices = {}
        for (const platform of ['web', 'android', 'ios'])
            devices[platform] = await request('POST', 'sync/devices', { installationId: randomUUID(), platform }, 201)
        const create = {
            deviceId: devices.web.id,
            mutations: [
                {
                    clientMutationId: randomUUID(),
                    resource: 'preferences',
                    operation: 'create',
                    id: preferenceId,
                    data: { theme: 'dark', changeNotifications: true },
                },
            ],
            contents: [],
        }
        await request('POST', 'sync/commit', create, 201)
        await request('POST', 'sync/commit', create, 201) // Same mutation receipt must be safe to replay.
        for (const device of Object.values(devices)) {
            const record = await snapshot(device.id)
            assert.equal(record.theme, 'dark')
            assert.equal(record.changeNotifications, true)
        }
        const baseline = await snapshot(devices.android.id)
        const update = (deviceId, version, data) => ({
            deviceId,
            mutations: [
                {
                    clientMutationId: randomUUID(),
                    resource: 'preferences',
                    operation: 'update',
                    id: preferenceId,
                    version,
                    data,
                },
            ],
            contents: [],
        })
        await request(
            'POST',
            'sync/commit',
            update(devices.android.id, baseline.version, { theme: 'light', changeNotifications: false }),
            201,
        )
        await request('POST', 'sync/commit', update(devices.ios.id, baseline.version, { theme: 'dark' }), 409)
        for (const device of Object.values(devices)) {
            const record = await snapshot(device.id)
            assert.equal(record.theme, 'light')
            assert.equal(record.changeNotifications, false)
        }
        const latest = await snapshot(devices.web.id)
        await request(
            'POST',
            'sync/commit',
            {
                deviceId: devices.web.id,
                mutations: [
                    {
                        clientMutationId: randomUUID(),
                        resource: 'preferences',
                        operation: 'delete',
                        id: preferenceId,
                        version: latest.version,
                    },
                ],
                contents: [],
            },
            201,
        )
        for (const device of Object.values(devices)) assert.equal(await snapshot(device.id), undefined)
    } finally {
        await pool.query('DELETE FROM "user" WHERE id=$1', [userId])
    }
}
