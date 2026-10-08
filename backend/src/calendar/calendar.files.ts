import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { createHash, randomUUID } from 'node:crypto'
import { ImportPublishSchema } from '@fullstack-starter/shared'
import { CalendarService, parse } from './calendar.service.js'
import { requireCalendar, requireEvent } from './calendar.access.js'
import { encodeRow } from './calendar.catalog.js'
import { StorageService } from '../storage/storage.service.js'
import { VirusScannerService } from '../virusscanner/virusscanner.service.js'

@Injectable()
export class CalendarFiles {
    constructor(
        readonly calendar: CalendarService,
        readonly storage: StorageService,
        readonly scanner: VirusScannerService,
    ) {}
    async upload(userId: string, eventId: string, file?: Express.Multer.File) {
        if (!file?.buffer?.length) throw new BadRequestException('A nonempty file is required')
        await requireEvent(this.calendar.database.pool, userId, eventId, true)
        if (process.env.VIRUS_SCAN_ENABLED === 'true' && (await this.scanner.scan(file.buffer)).status !== 'clean')
            throw new BadRequestException('Attachment failed virus scan')
        const key = `calendar-attachments/${eventId}/${randomUUID()}`
        await this.storage.putObject({
            key,
            body: file.buffer,
            contentType: 'application/octet-stream',
            cacheControl: 'private, no-store',
        })
        try {
            return await this.calendar.transaction(async (db) => {
                await requireEvent(db, userId, eventId, true)
                return encodeRow(
                    'attachments',
                    await this.calendar.insert(db, 'attachments', {
                        id: randomUUID(),
                        eventId,
                        uploadedByUserId: userId,
                        kind: 'file',
                        name:
                            Array.from(file.originalname)
                                .filter((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
                                .join('')
                                .slice(0, 200) || 'attachment',
                        storageKey: key,
                        mimeType: file.mimetype,
                        sizeBytes: file.size,
                        contentHash: createHash('sha256').update(file.buffer).digest('hex'),
                    }),
                )
            })
        } catch (error) {
            await this.storage.deleteObject(key).catch(() => undefined)
            throw error
        }
    }
    async download(userId: string, id: string) {
        const row = await this.calendar.transaction(async (db) => {
            await this.calendar.get(db, userId, 'attachments', id)
            const row = (await db.query('SELECT * FROM event_attachment WHERE id=$1', [id])).rows[0]
            if (row.kind !== 'file') throw new NotFoundException('File not found')
            return row
        })
        const object = await this.storage.getObject(row.storage_key)
        return { body: object.Body, name: row.name, size: object.ContentLength }
    }
    /** Raw subscriptions remain private to their calendar owner. */
    async sourceContent(userId: string, sourceId: string) {
        const revision = await this.calendar.transaction(async (db) => {
            const source = await this.calendar.get(db, userId, 'sources', sourceId)
            await requireCalendar(db, userId, source?.calendarId, 'owner')
            return (
                await db.query(
                    'SELECT storage_key FROM calendar_source_revision WHERE source_id=$1 AND is_current=true AND deleted_at IS NULL',
                    [sourceId],
                )
            ).rows[0]
        }, false)
        if (!revision) return { content: null }
        const object = await this.storage.getObject(revision.storage_key)
        return { content: (await object.Body?.transformToString()) ?? null }
    }
    async publish(userId: string, sourceId: string, raw: unknown) {
        const body = parse(ImportPublishSchema, raw)
        const source = await this.calendar.transaction(async (db) => {
            const source = await this.calendar.get(db, userId, 'sources', sourceId)
            await requireCalendar(db, userId, source?.calendarId, 'owner')
            return source!
        })
        if (body.coverageTo < body.coverageFrom) throw new BadRequestException('Invalid coverage interval')
        const uids = new Set<string>()
        for (const event of body.events) {
            if (!event.externalUid || uids.has(event.externalUid))
                throw new BadRequestException('Each imported event needs a unique externalUid')
            uids.add(event.externalUid)
            this.calendar.validateEvent({ ...event, kind: event.kind || 'timed' })
        }
        const key = `calendar-imports/${sourceId}/${randomUUID()}`
        await this.storage.putObject({
            key,
            body: Buffer.from(body.content),
            contentType: 'application/octet-stream',
            cacheControl: 'private, no-store',
        })
        try {
            return await this.calendar.transaction(async (db) => {
                await requireCalendar(db, userId, source.calendarId, 'owner')
                const current = (
                    await db.query('SELECT * FROM calendar_source WHERE id=$1 AND deleted_at IS NULL', [sourceId])
                ).rows[0]
                if (!current || current.version !== body.version) throw new ConflictException('Source version conflict')
                const existing = (await db.query('SELECT * FROM calendar_event WHERE source_id=$1', [sourceId])).rows
                const byUid = new Map(existing.map((row) => [row.external_uid, row]))
                for (const event of body.events) {
                    const old = byUid.get(event.externalUid)
                    if (old) {
                        // Restore the stable identity before updating; imported overrides remain linked.
                        if (old.deleted_at)
                            await db.query('UPDATE calendar_event SET deleted_at=NULL WHERE id=$1', [old.id])
                        const refreshed = (await db.query('SELECT version FROM calendar_event WHERE id=$1', [old.id]))
                            .rows[0]
                        const data = { ...event }
                        delete data.externalUid
                        await this.calendar.update(db, userId, 'events', old.id, {
                            ...data,
                            version: refreshed.version,
                        })
                    } else
                        await this.calendar.create(db, userId, 'events', {
                            ...event,
                            calendarId: source.calendarId,
                            sourceId,
                        })
                }
                for (const old of existing)
                    if (!old.deleted_at && !uids.has(old.external_uid))
                        await this.calendar.remove(db, userId, 'events', old.id, { version: old.version })
                await db.query(
                    'UPDATE calendar_source_revision SET is_current=false WHERE source_id=$1 AND is_current=true',
                    [sourceId],
                )
                const revision = encodeRow(
                    'source-revisions',
                    await this.calendar.insert(db, 'source-revisions', {
                        id: randomUUID(),
                        sourceId,
                        contentHash: createHash('sha256').update(body.content).digest('hex'),
                        storageKey: key,
                        isCurrent: true,
                    }),
                )
                const updated = await this.calendar.update(db, userId, 'sources', sourceId, {
                    version: body.version,
                    coverageFrom: body.coverageFrom,
                    coverageTo: body.coverageTo,
                })
                return { source: updated, revision, eventCount: body.events.length }
            })
        } catch (error) {
            await this.storage.deleteObject(key).catch(() => undefined)
            throw error
        }
    }
}
