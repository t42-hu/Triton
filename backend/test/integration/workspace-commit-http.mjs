import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'

export async function verifyWorkspaceCommitHttp(pool, origin, secret, prefix) {
    const users = []
    for (let index = 0; index < 2; index++) {
        const id = randomUUID(),
            token = randomUUID()
        await pool.query('INSERT INTO "user"(id,name,email,created_at,updated_at) VALUES($1,$2,$3,now(),now())', [
            id,
            'Commit fixture',
            `${id}@example.test`,
        ])
        await pool.query(
            "INSERT INTO session(id,token,user_id,expires_at,created_at,updated_at) VALUES($1,$2,$3,now()+interval '5 minutes',now(),now())",
            [randomUUID(), token, id],
        )
        users.push({
            id,
            cookie: `${prefix}.session_token=${encodeURIComponent(`${token}.${createHmac('sha256', secret).update(token).digest('base64')}`)}`,
        })
    }
    const [owner, stranger] = users
    async function request(who, method, path, body, status = 200) {
        const response = await fetch(`${origin}/api/${path}`, {
            method,
            headers: {
                ...(who ? { cookie: who.cookie } : {}),
                ...(body ? { 'content-type': 'application/json' } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
        })
        assert.equal(response.status, status, `${method} ${path}: ${await response.clone().text()}`)
        return response.json()
    }
    const ids = { profile: randomUUID(), calendar: randomUUID(), association: randomUUID(), source: randomUUID(), event: randomUUID(), color: randomUUID() }
    const mutation = (resource, id, data, operation = 'create', version) => ({
        clientMutationId: randomUUID(),
        resource,
        id,
        data,
        operation,
        ...(version ? { version } : {}),
    })
    try {
        await request(null, 'POST', 'sync/commit', {}, 401)
        const device = await request(
            owner,
            'POST',
            'sync/devices',
            { installationId: randomUUID(), platform: 'web' },
            201,
        )
        const other = await request(
            stranger,
            'POST',
            'sync/devices',
            { installationId: randomUUID(), platform: 'web' },
            201,
        )
        const body = {
            deviceId: device.id,
            mutations: [
                mutation('profiles', ids.profile, { name: 'Colored profile' }),
                mutation('calendars', ids.calendar, { name: 'Fixture' }),
                mutation('profile-calendars', ids.association, { profileId: ids.profile, calendarId: ids.calendar }),
                mutation('sources', ids.source, { calendarId: ids.calendar, name: 'Imported', format: 'ics' }),
                mutation('events', ids.event, {
                    calendarId: ids.calendar,
                    sourceId: ids.source,
                    externalUid: 'fixture',
                    title: 'Original',
                    startsAt: '2026-10-09T08:00:00Z',
                    endsAt: '2026-10-09T09:00:00Z',
                }),
                mutation('color-rules', ids.color, { scope: 'series', targetKey: JSON.stringify([ids.profile, 'lesson', 'Original']), calendarId: ids.calendar, color: '#abcdef' }),
            ],
            contents: [{ sourceId: ids.source, content: 'PRIVATE RAW CONTENT' }],
        }
        await request(owner, 'POST', 'sync/commit', body, 201)
        assert.equal(
            (await pool.query('SELECT content FROM calendar_source_content WHERE source_id=$1', [ids.source])).rows[0]
                .content,
            'PRIVATE RAW CONTENT',
        )
        assert.equal(
            (await request(owner, 'GET', `calendar-files/sources/${ids.source}/content`)).content,
            'PRIVATE RAW CONTENT',
        )
        await request(stranger, 'GET', `calendar-files/sources/${ids.source}/content`, undefined, 404)
        const event = await request(owner, 'GET', `calendar/events/${ids.event}`)
        await request(
            owner,
            'POST',
            'sync/commit',
            {
                deviceId: device.id,
                mutations: [mutation('events', ids.event, { title: 'Must roll back' }, 'update', event.version)],
                contents: [{ sourceId: ids.source, version: 999, content: 'Invalid version' }],
            },
            409,
        )
        assert.equal((await request(owner, 'GET', `calendar/events/${ids.event}`)).title, 'Original')
        assert.equal(
            (await request(owner, 'GET', `calendar-files/sources/${ids.source}/content`)).content,
            'PRIVATE RAW CONTENT',
        )
        const profileId = randomUUID()
        await request(
            stranger,
            'POST',
            'sync/commit',
            {
                deviceId: other.id,
                mutations: [mutation('profiles', profileId, { name: 'Must roll back' })],
                contents: [{ sourceId: ids.source, version: 2, content: 'Stolen' }],
            },
            404,
        )
        assert.equal(
            (await pool.query('SELECT count(*) FROM schedule_profile WHERE id=$1', [profileId])).rows[0].count,
            '0',
        )
        await request(owner, 'POST', 'sync/commit', body, 201)
        assert.equal(
            (await pool.query('SELECT count(*) FROM calendar_event WHERE id=$1', [ids.event])).rows[0].count,
            '1',
        )
        const source = await request(owner, 'GET', `calendar/sources/${ids.source}`)
        await request(
            owner,
            'POST',
            'sync/commit',
            {
                deviceId: device.id,
                mutations: [],
                contents: [{ sourceId: ids.source, version: source.version, content: 'UPDATED CONTENT' }],
            },
            201,
        )
        assert.equal(
            (await request(owner, 'GET', `calendar-files/sources/${ids.source}/content`)).content,
            'UPDATED CONTENT',
        )
        const rule = await request(owner, 'GET', `calendar/color-rules/${ids.color}`)
        await request(owner, 'POST', 'sync/commit', {
            deviceId: device.id,
            mutations: [mutation('color-rules', ids.color, { targetKey: '[null,"lesson","Original"]' }, 'update', rule.version)],
            contents: [],
        }, 400)
        assert.equal((await request(owner, 'GET', `calendar/profiles/${ids.profile}`)).name, 'Colored profile')
        const deletions = []
        for (const [resource, id] of [
            ['color-rules', ids.color], ['events', ids.event], ['sources', ids.source],
            ['profile-calendars', ids.association], ['calendars', ids.calendar], ['profiles', ids.profile],
        ]) {
            const record = await request(owner, 'GET', `calendar/${resource}/${id}`)
            deletions.push(mutation(resource, id, undefined, 'delete', record.version))
        }
        await request(owner, 'POST', 'sync/commit', { deviceId: device.id, mutations: deletions, contents: [] }, 201)
        for (const deletion of deletions) await request(owner, 'GET', `calendar/${deletion.resource}/${deletion.id}`, undefined, 404)
        await request(owner, 'GET', `calendar-files/sources/${ids.source}/content`, undefined, 404)
    } finally {
        await pool.query('DELETE FROM "user" WHERE id=ANY($1::text[])', [users.map((user) => user.id)])
    }
}
