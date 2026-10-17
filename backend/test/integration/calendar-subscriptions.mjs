import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { CalendarService } from '../../dist/calendar/calendar.service.js'
import { CalendarSharing } from '../../dist/calendar/calendar-sharing.js'
import { CalendarSubscriptions } from '../../dist/calendar/calendar-subscriptions.js'

/** Real PostgreSQL triggers, leases, domain writes and public-share serialization; no client participates. */
export async function verifyCalendarSubscriptions(pool) {
    const user = randomUUID(),
        oldSecret = process.env.BETTER_AUTH_SECRET
    process.env.BETTER_AUTH_SECRET ||= 'subscription-integration-signing-secret-32'
    await pool.query('INSERT INTO "user"(id,name,email,created_at,updated_at) VALUES($1,$2,$3,now(),now())', [
        user,
        'Subscription test',
        `${user}@example.test`,
    ])
    const calendar = new CalendarService({ pool }),
        sharing = new CalendarSharing(calendar)
    const create = (resource, data) => calendar.transaction((db) => calendar.create(db, user, resource, data))
    const update = (resource, id, data) => calendar.transaction((db) => calendar.update(db, user, resource, id, data))
    const get = (resource, id) => calendar.transaction((db) => calendar.get(db, user, resource, id))
    let calls = 0,
        content = '',
        notModified = false,
        fail = false,
        duringDownload
    const download = {
        download: async (_url, _validators) => {
            calls++
            if (notModified) assert.equal(_validators.etag, '"test-version"')
            if (duringDownload) await duringDownload()
            if (fail) throw Error('temporary network error')
            return { content: notModified ? undefined : content, etag: '"test-version"', lastModified: null }
        },
    }
    const worker = new CalendarSubscriptions(calendar, download, sharing),
        other = new CalendarSubscriptions(calendar, download, sharing)
    const feed = (hour) =>
        `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${hour === null ? '' : `BEGIN:VEVENT\r\nUID:shift-1@wagetrackr.eu\r\nDTSTART:20261016T${hour}0000Z\r\nDTEND:20261016T${String(Number(hour) + 1).padStart(2, '0')}0000Z\r\nSUMMARY:Work\r\nEND:VEVENT\r\n`}END:VCALENDAR\r\n`
    const due = async (id) =>
        pool.query(
            "UPDATE calendar_subscription_job SET next_attempt_at=now()-interval '1 second' WHERE source_id=$1",
            [id],
        )
    const events = async (source) =>
        (
            await pool.query('SELECT * FROM calendar_event WHERE source_id=$1 AND deleted_at IS NULL ORDER BY id', [
                source,
            ])
        ).rows
    try {
        const own = await create('calendars', { name: 'Own' }),
            profile = await create('profiles', { name: 'Own', isOwn: true })
        await create('profile-calendars', { profileId: profile.id, calendarId: own.id })
        const source = await create('sources', {
            calendarId: own.id,
            name: 'External',
            format: 'ics',
            coverageFrom: '2026-10-01',
            coverageTo: '2026-10-31',
        })
        const connection = await create('source-connections', {
            sourceId: source.id,
            url: 'https://calendar.example.test/feed.ics',
            autoSync: false,
        })
        content = feed('08')
        await Promise.all([worker.tick(), other.tick()])
        assert.equal(calls, 1, 'parallel workers must download once')
        let [event] = await events(source.id)
        assert.equal(event.category, 'work')
        assert.equal(event.starts_at.toISOString(), '2026-10-16T08:00:00.000Z')
        const stableId = event.id,
            sourceVersion = (await get('sources', source.id)).version
        notModified = true
        await due(source.id)
        await worker.tick()
        assert.equal((await get('sources', source.id)).version, sourceVersion, '304 must not rebuild source')
        assert.equal((await events(source.id))[0].version, event.version, '304 must not rewrite event')
        const override = await create('overrides', { eventId: event.id, occurrenceKey: '', title: 'Local override' })
        await assert.rejects(
            update('events', event.id, { version: event.version, title: 'Stale client' }),
            (error) => error.getStatus?.() === 400,
        )
        await assert.rejects(calendar.transaction(db => calendar.remove(db,user,'events',event.id,{version:event.version})),error => error.getStatus?.()===400)
        notModified = false
        content = feed('10')
        await due(source.id)
        await worker.tick()
        ;[event] = await events(source.id)
        assert.equal(event.id, stableId)
        assert.equal(event.starts_at.toISOString(), '2026-10-16T10:00:00.000Z')
        assert.equal((await get('overrides', override.id)).title, 'Local override')
        const share = await sharing.create(user, {
            calendarId: own.id,
            selection: { sourceIds: [source.id], includeManual: false, categories: ['work'] },
        })
        const shareUrl = new URL(share.url),
            token = shareUrl.pathname.split('/')[4]
        const first = await sharing.download(share.id, token)
        assert.match(first, /SUMMARY:Local override/)
        assert.equal(await sharing.download(share.id, token), first, 'unchanged feed bytes and DTSTAMP must be stable')
        const peer = await create('calendars', { name: 'Peer' }),
            peerProfile = await create('profiles', { name: 'Peer', isOwn: false })
        await create('profile-calendars', { profileId: peerProfile.id, calendarId: peer.id })
        const peerSource = await create('sources', {
            calendarId: peer.id,
            name: 'Shared',
            format: 'ics',
            coverageFrom: '2026-10-01',
            coverageTo: '2026-10-31',
        })
        await create('source-connections', { sourceId: peerSource.id, url: share.url, autoSync: false })
        await worker.tick()
        assert.equal((await events(peerSource.id))[0].starts_at.toISOString(), '2026-10-16T10:00:00.000Z')
        content = feed('11')
        await due(source.id)
        await worker.tick()
        await worker.tick()
        assert.equal(
            (await events(peerSource.id))[0].starts_at.toISOString(),
            '2026-10-16T11:00:00.000Z',
            'server-only change must reach peer',
        )
        await pool.query("UPDATE calendar_subscription_job SET lease_token='abandoned',lease_until=now()-interval '1 second',next_attempt_at=now() WHERE source_id=$1", [source.id])
        await worker.tick()
        assert.equal((await pool.query('SELECT lease_token FROM calendar_subscription_job WHERE source_id=$1',[source.id])).rows[0].lease_token,null)
        const beforeFailure = (await get('source-connections', connection.id)).lastSuccessAt
        fail = true
        await due(source.id)
        await worker.tick()
        fail = false
        assert.equal((await get('source-connections', connection.id)).lastSuccessAt, beforeFailure)
        assert.equal((await events(source.id)).length, 1)
        content = feed(null)
        await due(source.id)
        await worker.tick()
        await worker.tick()
        assert.equal((await events(source.id)).length, 0, 'valid empty feed must delete final event')
        assert.equal((await events(peerSource.id)).length, 0, 'empty shared feed must clear recipient too')
        content = feed('12')
        await due(source.id)
        await worker.tick()
        await worker.tick()
        await sharing.revoke(user, share.id)
        await worker.tick()
        assert.equal((await events(peerSource.id)).length, 1, 'revocation must retain last successful events')
        const peerConnection = (
            await pool.query('SELECT last_error FROM calendar_source_connection WHERE source_id=$1', [peerSource.id])
        ).rows[0]
        assert.ok(peerConnection.last_error)
        // A response arriving after a disconnect must not publish, even across worker processes.
        duringDownload = async () => {
            const current = await get('source-connections', connection.id)
            await update('source-connections', connection.id, { version: current.version, url: null, autoSync: false })
        }
        content = feed('13')
        await due(source.id)
        await worker.tick()
        duringDownload = undefined
        assert.equal((await events(source.id))[0].starts_at.toISOString(), '2026-10-16T12:00:00.000Z')
        // Cycles are rejected without HTTP recursion or destructive publication.
        const current = await get('source-connections', connection.id)
        await update('source-connections', connection.id, { version: current.version, url: share.url })
        await worker.tick()
        assert.match((await get('source-connections', connection.id)).lastError, /körkörös/)
        assert.equal((await events(source.id)).length, 1)
        console.log(
            'PASS subscription leases, 304, updates, overrides, stale clients, peer propagation, empty feeds, errors, revocation, disconnect and cycles',
        )
    } finally {
        await worker.onModuleDestroy()
        await other.onModuleDestroy()
        await pool.query('DELETE FROM "user" WHERE id=$1', [user])
        process.env.BETTER_AUTH_SECRET = oldSecret
    }
}
