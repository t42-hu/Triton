import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { CalendarService } from '../../dist/calendar/calendar.service.js'
import { CalendarActions } from '../../dist/calendar/calendar.actions.js'
import { CalendarSync } from '../../dist/calendar/calendar.sync.js'
import { CalendarFiles } from '../../dist/calendar/calendar.files.js'

export async function verifyCalendarBackend(pool) {
    const users = [randomUUID(), randomUUID(), randomUUID(), randomUUID()]
    const [owner, reader, guest, stranger] = users
    for (const id of users)
        await pool.query('INSERT INTO "user"(id,name,email,created_at,updated_at) VALUES($1,$2,$3,now(),now())', [
            id,
            'Calendar API test',
            `${id}@example.test`,
        ])
    const service = new CalendarService({ pool }),
        actions = new CalendarActions(service),
        sync = new CalendarSync(service)
    const create = (who, resource, data) => service.transaction((db) => service.create(db, who, resource, data))
    const get = (who, resource, id) => service.transaction((db) => service.get(db, who, resource, id))
    const update = (who, resource, id, data) => service.transaction((db) => service.update(db, who, resource, id, data))
    const remove = (who, resource, id, version) =>
        service.transaction((db) => service.remove(db, who, resource, id, { version }))
    const denied = (promise, status) => assert.rejects(promise, (error) => error.getStatus?.() === status)
    try {
        const calendar = await create(owner, 'calendars', { name: 'Private schedule' })
        const eventData = {
            calendarId: calendar.id,
            title: 'Private title',
            notes: 'Private notes',
            startsAt: '2026-10-08T09:00:00Z',
            endsAt: '2026-10-08T10:00:00Z',
            color: '#ffee00',
        }
        const event = await create(owner, 'events', eventData)
        await denied(get(stranger, 'events', event.id), 404)
        await denied(create(stranger, 'events', eventData), 404)
        await denied(create(owner, 'events', { ...eventData, ownerUserId: stranger }), 400)
        await denied(create(owner, 'events', { ...eventData, endsAt: eventData.startsAt }), 400)
        const invitation = await actions.invite(owner, { calendarId: calendar.id, userId: reader, role: 'reader' })
        assert.equal(invitation.tokenHash, undefined)
        await denied(
            actions.respondInvitation(stranger, invitation.id, { version: invitation.version, response: 'accepted' }),
            404,
        )
        await actions.respondInvitation(reader, invitation.id, { version: invitation.version, response: 'accepted' })
        assert.equal((await get(reader, 'events', event.id)).notes, eventData.notes)
        await denied(update(reader, 'events', event.id, { version: event.version, title: 'Denied' }), 403)
        const member = (
            await service.transaction((db) => service.list(db, owner, 'members', { calendarId: calendar.id }))
        ).items[0]
        const busy = await update(owner, 'members', member.id, { version: member.version, role: 'busy_only' })
        const redacted = await get(reader, 'events', event.id)
        assert.equal(redacted.title, undefined)
        assert.equal(redacted.notes, undefined)
        assert.equal(redacted.color, undefined)
        assert.equal(redacted.startsAt, new Date(eventData.startsAt).toISOString())
        const link = await create(owner, 'attachments', {
            eventId: event.id,
            kind: 'link',
            name: 'Material',
            url: 'https://example.test/document',
        })
        await denied(get(reader, 'attachments', link.id), 404)
        await denied(
            create(reader, 'attachments', {
                eventId: event.id,
                kind: 'link',
                name: 'Denied',
                url: 'https://example.test',
            }),
            403,
        )
        await update(owner, 'events', event.id, { version: event.version, title: 'Changed' })
        await denied(update(owner, 'events', event.id, { version: event.version, title: 'Stale' }), 409)
        const meeting = await actions.createMeeting(owner, {
            event: { ...eventData, title: 'Meeting' },
            participantUserIds: [guest],
        })
        assert.equal((await get(guest, 'events', meeting.event.id)).title, 'Meeting')
        await denied(get(guest, 'events', event.id), 404)
        await denied(get(guest, 'calendars', calendar.id), 404)
        await actions.respondMeeting(guest, meeting.meeting.id, {
            version: meeting.participants[0].version,
            response: 'accepted',
        })
        await denied(
            update(guest, 'events', meeting.event.id, { version: meeting.event.version, title: 'Denied' }),
            404,
        )
        const device = await create(owner, 'devices', { installationId: randomUUID(), platform: 'web' })
        const mutation = {
            clientMutationId: randomUUID(),
            resource: 'tasks',
            operation: 'create',
            data: { title: 'Offline task' },
        }
        const first = await sync.push(owner, { deviceId: device.id, mutations: [mutation] })
        assert.deepEqual(await sync.push(owner, { deviceId: device.id, mutations: [mutation] }), first)
        await denied(
            sync.push(owner, { deviceId: device.id, mutations: [{ ...mutation, data: { title: 'Different' } }] }),
            409,
        )
        const rolled = randomUUID()
        await denied(
            sync.push(owner, {
                deviceId: device.id,
                mutations: [
                    { ...mutation, clientMutationId: rolled, data: { title: 'Must roll back' } },
                    {
                        clientMutationId: randomUUID(),
                        resource: 'events',
                        operation: 'update',
                        id: event.id,
                        version: 1,
                        data: { title: 'Stale' },
                    },
                ],
            }),
            409,
        )
        assert.equal(
            (await pool.query('SELECT id FROM sync_mutation WHERE client_mutation_id=$1', [rolled])).rowCount,
            0,
        )
        let page = await sync.snapshot(owner, { deviceId: device.id, limit: 1 })
        const token = page.snapshotToken,
            high = page.highSequence,
            snapshot = []
        await denied(sync.ack(owner, { deviceId: device.id, sequence: high, snapshotToken: token }), 409)
        const changed = await get(owner, 'events', event.id)
        await update(owner, 'events', event.id, { version: changed.version, title: 'After snapshot' })
        snapshot.push(...page.items)
        while (page.nextOffset !== null) {
            page = await sync.snapshot(owner, {
                deviceId: device.id,
                snapshotToken: token,
                offset: page.nextOffset,
                limit: 200,
            })
            snapshot.push(...page.items)
        }
        assert.equal(
            snapshot.find((item) => item.resource === 'events' && item.record.id === event.id).record.title,
            'Changed',
        )
        await sync.ack(owner, { deviceId: device.id, sequence: high, snapshotToken: token })
        const delta = await sync.pull(owner, { deviceId: device.id, after: high })
        assert.equal(delta.requiresSnapshot, false)
        assert.equal(delta.changes.find((c) => c.id === event.id).record.title, 'After snapshot')
        await denied(sync.ack(owner, { deviceId: device.id, sequence: String(BigInt(delta.nextSequence) + 100n) }), 400)
        await sync.ack(owner, { deviceId: device.id, sequence: delta.nextSequence })
        await denied(sync.snapshot(stranger, { deviceId: device.id }), 404)
        const guestDevice = await create(guest, 'devices', { installationId: randomUUID(), platform: 'ios' })
        const guestPage = await sync.snapshot(guest, { deviceId: guestDevice.id, limit: 200 })
        await remove(owner, 'participants', meeting.participants[0].id, 2)
        await denied(
            sync.ack(guest, {
                deviceId: guestDevice.id,
                sequence: guestPage.highSequence,
                snapshotToken: guestPage.snapshotToken,
            }),
            409,
        )
        assert.equal((await sync.pull(guest, { deviceId: guestDevice.id, after: '0' })).requiresSnapshot, true)
        await denied(get(guest, 'events', meeting.event.id), 404)
        const objects = new Map()
        const storage = {
            putObject: async ({ key, body }) => objects.set(key, body),
            deleteObject: async (key) => objects.delete(key),
            getObject: async (key) => ({
                Body: Readable.from([objects.get(key)]),
                ContentLength: objects.get(key).length,
            }),
        }
        const files = new CalendarFiles(service, storage, { scan: async () => ({ status: 'clean' }) })
        const attachment = await files.upload(owner, event.id, {
            buffer: Buffer.from('private file'),
            originalname: 'notes.txt',
            mimetype: 'text/plain',
            size: 12,
        })
        assert.equal(attachment.storageKey, undefined)
        assert.equal((await files.download(owner, attachment.id)).size, 12)
        await denied(files.download(reader, attachment.id), 404)
        const source = await create(owner, 'sources', { calendarId: calendar.id, name: 'Import', format: 'ics' })
        const imported = {
            externalUid: 'stable-uid',
            title: 'Imported',
            startsAt: eventData.startsAt,
            endsAt: eventData.endsAt,
        }
        const published = await files.publish(owner, source.id, {
            version: source.version,
            content: 'ICS input',
            coverageFrom: '2026-10-01',
            coverageTo: '2026-10-31',
            events: [imported],
        })
        const importedRow = (
            await service.transaction((db) => service.list(db, owner, 'events', { sourceId: source.id }))
        ).items[0]
        const override = await create(owner, 'overrides', { eventId: importedRow.id, notes: 'Personal annotation' })
        await files.publish(owner, source.id, {
            version: published.source.version,
            content: 'Updated input',
            coverageFrom: '2026-10-01',
            coverageTo: '2026-10-31',
            events: [{ ...imported, title: 'Updated import' }],
        })
        assert.equal((await get(owner, 'events', importedRow.id)).title, 'Updated import')
        assert.equal((await get(owner, 'overrides', override.id)).notes, 'Personal annotation')
        const count = objects.size
        await denied(
            files.publish(owner, source.id, {
                version: 1,
                content: 'Stale input',
                coverageFrom: '2026-10-01',
                coverageTo: '2026-10-31',
                events: [],
            }),
            409,
        )
        assert.equal(objects.size, count)
        const emailInvite = await actions.invite(owner, {
            calendarId: calendar.id,
            email: `${stranger}@example.test`,
            role: 'reader',
        })
        await denied(
            actions.respondInvitation(stranger, emailInvite.id, { version: emailInvite.version, response: 'accepted' }),
            404,
        )
        await pool.query('UPDATE "user" SET email_verified=true WHERE id=$1', [stranger])
        await actions.respondInvitation(stranger, emailInvite.id, {
            version: emailInvite.version,
            response: 'accepted',
        })
        const privatePalette = await create(owner, 'palettes', { name: 'Private' })
        await denied(
            create(stranger, 'palette-colors', { presetId: privatePalette.id, role: 'default', color: '#ff0000' }),
            404,
        )
        const revoked = await remove(owner, 'members', busy.id, busy.version)
        assert.ok(revoked.deletedAt)
        await denied(get(reader, 'events', event.id), 404)
        console.log(
            'PASS calendar backend permissions, invitations, meetings, conflicts, sync retries and revocation, private files, atomic imports',
        )
    } finally {
        for (const id of users) await pool.query('DELETE FROM "user" WHERE id=$1', [id])
    }
}
