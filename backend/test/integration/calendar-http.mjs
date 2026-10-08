import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'

// Seeds short-lived signed sessions without CAPTCHA/email traffic, then removes every fixture.
export async function verifyCalendarHttp(pool, origin, secret, cookiePrefix, cleanupObjects = async () => {}) {
    const identities = []
    for (let i = 0; i < 2; i++) {
        const id = randomUUID(),
            token = randomUUID()
        await pool.query('INSERT INTO "user"(id,name,email,created_at,updated_at) VALUES($1,$2,$3,now(),now())', [
            id,
            'Calendar HTTP fixture',
            `${id}@example.test`,
        ])
        await pool.query(
            "INSERT INTO session(id,token,user_id,expires_at,created_at,updated_at) VALUES($1,$2,$3,now()+interval '5 minutes',now(),now())",
            [randomUUID(), token, id],
        )
        const signed = encodeURIComponent(`${token}.${createHmac('sha256', secret).update(token).digest('base64')}`)
        identities.push({
            id,
            signed,
            cookie: `${cookiePrefix}.session_token=${signed}; __Secure-${cookiePrefix}.session_token=${signed}`,
        })
    }
    const [owner, guest] = identities
    const request = async (who, method, path, body, status = 200) => {
        const response = await fetch(`${origin}/api/${path}`, {
            method,
            headers: {
                ...(who ? { cookie: who.cookie } : {}),
                ...(body ? { 'content-type': 'application/json' } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
        })
        assert.equal(response.status, status, `${method} ${path}: ${await response.clone().text()}`)
        if (who && status < 300) assert.equal(response.headers.get('cache-control'), 'private, no-store')
        return response.json()
    }
    try {
        await request(null, 'GET', 'calendar/calendars', undefined, 401)
        const calendar = await request(owner, 'POST', 'calendar/calendars', { name: 'HTTP fixture' }, 201)
        if (process.env.NATIVE_AUTH_ENABLED === 'true') {
            const native = await fetch(`${origin}/api/calendar/calendars/${calendar.id}`, {
                headers: { authorization: `Bearer ${owner.signed}` },
            })
            assert.equal(native.status, 200, await native.clone().text())
            assert.equal((await native.json()).id, calendar.id)
            const unsigned = await fetch(`${origin}/api/calendar/calendars/${calendar.id}`, {
                headers: { authorization: `Bearer ${owner.signed.split('.')[0]}` },
            })
            assert.equal(unsigned.status, 401)
        }

        const event = await request(
            owner,
            'POST',
            'calendar/events',
            {
                calendarId: calendar.id,
                title: 'HTTP event',
                notes: 'Shared notes',
                startsAt: '2026-10-09T08:00:00Z',
                endsAt: '2026-10-09T09:00:00Z',
            },
            201,
        )
        await request(guest, 'GET', `calendar/events/${event.id}`, undefined, 404)
        const invite = await request(
            owner,
            'POST',
            'calendar-actions/invitations',
            { calendarId: calendar.id, userId: guest.id, role: 'reader' },
            201,
        )
        await request(
            guest,
            'POST',
            `calendar-actions/invitations/${invite.id}/respond`,
            { version: invite.version, response: 'accepted' },
            201,
        )
        assert.equal((await request(guest, 'GET', `calendar/events/${event.id}`)).notes, 'Shared notes')
        await request(guest, 'PATCH', `calendar/events/${event.id}`, { version: event.version, title: 'Denied' }, 403)
        await request(owner, 'PATCH', `calendar/events/${event.id}`, { version: event.version, title: 'HTTP update' })
        await request(owner, 'PATCH', `calendar/events/${event.id}`, { version: event.version, title: 'Stale' }, 409)
        await request(
            owner,
            'POST',
            'calendar/events',
            { calendarId: calendar.id, title: 'Bad', ownerUserId: guest.id },
            400,
        )
        const device = await request(
            owner,
            'POST',
            'sync/devices',
            { installationId: randomUUID(), platform: 'web' },
            201,
        )
        const snapshot = await request(owner, 'GET', `sync/snapshot?deviceId=${device.id}&limit=200`)
        assert.equal(snapshot.nextOffset, null)
        await request(
            owner,
            'POST',
            'sync/ack',
            { deviceId: device.id, sequence: snapshot.highSequence, snapshotToken: snapshot.snapshotToken },
            201,
        )
        const mutation = {
            clientMutationId: randomUUID(),
            resource: 'tasks',
            operation: 'create',
            data: { title: 'HTTP offline task' },
        }
        const pushed = await request(owner, 'POST', 'sync/push', { deviceId: device.id, mutations: [mutation] }, 201)
        assert.deepEqual(
            await request(owner, 'POST', 'sync/push', { deviceId: device.id, mutations: [mutation] }, 201),
            pushed,
        )
        assert.ok(
            (
                await request(owner, 'GET', `sync/pull?deviceId=${device.id}&after=${snapshot.highSequence}`)
            ).changes.some((c) => c.id === pushed.results[0].record.id),
        )
        const form = new FormData()
        form.set('file', new Blob(['HTTP private attachment']), 'fixture.txt')
        const uploaded = await fetch(`${origin}/api/calendar-files/events/${event.id}`, {
            method: 'POST',
            headers: { cookie: owner.cookie },
            body: form,
        })
        assert.equal(uploaded.status, 201, await uploaded.clone().text())
        const attachment = await uploaded.json()
        assert.equal(attachment.storageKey, undefined)
        const download = await fetch(`${origin}/api/calendar-files/attachments/${attachment.id}`, {
            headers: { cookie: guest.cookie },
        })
        assert.equal(download.status, 200)
        assert.equal(await download.text(), 'HTTP private attachment')
        await request(null, 'GET', `calendar-files/attachments/${attachment.id}`, undefined, 401)
        console.log('PASS live HTTP session auth, sharing, conflicts, sync, multipart upload and authorized download')
    } finally {
        // The caller can remove blobs here; disposable integration stacks destroy their storage volume.
        const keys = (
            await pool.query('SELECT storage_key FROM event_attachment WHERE uploaded_by_user_id=ANY($1::text[])', [
                identities.map((i) => i.id),
            ])
        ).rows
            .map((r) => r.storage_key)
            .filter(Boolean)
        try {
            await cleanupObjects(keys)
        } finally {
            for (const identity of identities) await pool.query('DELETE FROM "user" WHERE id=$1', [identity.id])
        }
    }
}
