import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import ICAL from 'ical.js'
import { z } from 'zod'
import {
    CalendarResourceSchema,
    CalendarListSchema,
    CalendarDeleteSchema,
    type CalendarResource,
} from '@fullstack-starter/shared'
import { DatabaseService } from '../database/database.service.js'
import {
    columns,
    decodeInput,
    encodeRow,
    inputSchema,
    resources,
    tableName,
    type DomainRow,
} from './calendar.catalog.js'
import {
    eventVisible,
    requireCalendar,
    requireEvent,
    requireMeetingOrganizer,
    visibility,
    type Query,
} from './calendar.access.js'

export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
    const result = schema.safeParse(value)
    if (!result.success)
        throw new BadRequestException({ message: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) })
    return result.data
}
export const quote = (value: string) => `"${value}"`
@Injectable()
export class CalendarService {
    constructor(readonly database: DatabaseService) {}
    async transaction<T>(work: (db: PoolClient) => Promise<T>, write = true): Promise<T> {
        const db = await this.database.pool.connect()
        try {
            await db.query(write ? 'BEGIN' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
            if (write) await db.query('SELECT pg_advisory_xact_lock(78416823849321)')
            const result = await work(db)
            await db.query('COMMIT')
            return result
        } catch (error) {
            await db.query('ROLLBACK')
            const code = (error as { code?: string }).code
            if (code === '23505') throw new ConflictException('Record already exists')
            if (['23503', '23514', '22007', '22008', '22P02'].includes(code || ''))
                throw new BadRequestException('Invalid record or relationship')
            throw error
        } finally {
            db.release()
        }
    }
    resource(value: string) {
        return parse(CalendarResourceSchema, value)
    }
    async get(
        db: Query,
        userId: string,
        resource: CalendarResource,
        id: string,
        required = true,
    ): Promise<DomainRow | null> {
        const result = await db.query(
            `SELECT r.* ${resource === 'events' || resource === 'recurrences' || resource === 'exceptions' ? `, ${eventVisible(resource === 'events' ? 'r.id' : 'r.event_id', true)} AS __full` : ''} FROM ${quote(tableName(resource))} r WHERE r.id=$2 AND r.deleted_at IS NULL AND ${visibility(resource)}`,
            [userId, id],
        )
        if (!result.rows[0]) {
            if (required) throw new NotFoundException('Record not found')
            return null
        }
        return this.project(db, userId, resource, result.rows[0])
    }
    async project(db: Query, userId: string, resource: CalendarResource, row: DomainRow) {
        const encoded = encodeRow(resource, row)
        if (resource === 'events' || resource === 'recurrences' || resource === 'exceptions') {
            const full =
                row.__full ??
                (
                    await db.query(`SELECT ${eventVisible('$2', true)} allowed`, [
                        userId,
                        resource === 'events' ? row.id : row.event_id,
                    ])
                ).rows[0].allowed
            if (!full) {
                const timing = [
                    'id',
                    'calendarId',
                    'eventId',
                    'version',
                    'createdAt',
                    'updatedAt',
                    'kind',
                    'startsAt',
                    'endsAt',
                    'startDate',
                    'endDate',
                    'timezone',
                    'blocksTime',
                ]
                const extra =
                    resource === 'recurrences'
                        ? ['rule', 'untilAt', 'anchorDate', 'anchorWeek', 'weekPattern']
                        : resource === 'exceptions'
                          ? ['occurrenceKey', 'canceled']
                          : []
                return Object.fromEntries(
                    [...timing, ...extra].filter((key) => key in encoded).map((key) => [key, encoded[key]]),
                )
            }
        }
        return encoded
    }
    async list(db: Query, userId: string, resource: CalendarResource, raw: unknown) {
        const query = parse(CalendarListSchema, raw)
        const values: unknown[] = [userId]
        const clauses = [`r.deleted_at IS NULL`, visibility(resource)]
        for (const [key, value] of Object.entries(query)) {
            if (value === undefined || key === 'limit') continue
            if (key === 'afterId') {
                values.push(value)
                clauses.push(`r.id>$${values.length}`)
                continue
            }
            const col = columns(resource)[key]
            if (!col) throw new BadRequestException(`Unsupported filter: ${key}`)
            values.push(value)
            clauses.push(`r.${quote(col.name)}=$${values.length}`)
        }
        values.push(query.limit + 1)
        const { rows } = await db.query(
            `SELECT r.* ${resource === 'events' || resource === 'recurrences' || resource === 'exceptions' ? `, ${eventVisible(resource === 'events' ? 'r.id' : 'r.event_id', true)} AS __full` : ''} FROM ${quote(tableName(resource))} r WHERE ${clauses.join(' AND ')} ORDER BY r.id LIMIT $${values.length}`,
            values,
        )
        return {
            items: await Promise.all(rows.slice(0, query.limit).map((row) => this.project(db, userId, resource, row))),
            nextAfterId: rows.length > query.limit ? rows[query.limit - 1].id : null,
        }
    }
    async authorizeWrite(db: Query, userId: string, resource: CalendarResource, row: DomainRow) {
        const def = resources[resource]
        if (def.access === 'user') {
            if (row.user_id !== userId) throw new NotFoundException('Record not found')
            return
        }
        if (def.access === 'calendar-root') return requireCalendar(db, userId, row.id, 'owner')
        if (def.access === 'member' || def.access === 'invitation')
            return requireCalendar(db, userId, row.calendar_id, 'owner')
        if (def.access === 'calendar') return requireCalendar(db, userId, row.calendar_id, 'edit')
        if (def.access === 'source-owner') {
            const { rows } = await db.query(
                'SELECT calendar_id FROM calendar_source WHERE id=$1 AND deleted_at IS NULL',
                [row.source_id],
            )
            return requireCalendar(db, userId, rows[0]?.calendar_id, 'owner')
        }
        if (def.access === 'event') return requireEvent(db, userId, resource === 'events' ? row.id : row.event_id, true)
        if (def.access === 'meeting') return requireMeetingOrganizer(db, userId, row.id)
        if (def.access === 'participant') return requireMeetingOrganizer(db, userId, row.meeting_id)
        throw new ForbiddenException('Read-only resource')
    }
    async references(db: Query, userId: string, resource: CalendarResource, data: DomainRow) {
        for (const [key, parent] of [
            ['profileId', 'profiles'],
            ['presetId', 'palettes'],
            ['deviceId', 'devices'],
        ] as const) {
            if (data[key]) await this.get(db, userId, parent, String(data[key]))
        }
        if (data.calendarId)
            await requireCalendar(db, userId, data.calendarId, resources[resource].access === 'user' ? 'read' : 'edit')
        if (data.eventId) await requireEvent(db, userId, data.eventId, resources[resource].access === 'event')
        if (data.sourceId) {
            const source = await this.get(db, userId, 'sources', String(data.sourceId))
            if (data.calendarId && source?.calendarId !== data.calendarId)
                throw new BadRequestException('Source belongs to a different calendar')
            if (resource === 'source-connections') await requireCalendar(db, userId, source?.calendarId, 'owner')
        }
        if (data.linkedUserId) {
            const { rowCount } = await db.query('SELECT id FROM "user" WHERE id=$1', [data.linkedUserId])
            if (!rowCount) throw new BadRequestException('Unknown linked user')
        }
        if (resource === 'recurrences' && typeof data.rule === 'string') {
            try {
                ICAL.Recur.fromString(data.rule)
            } catch {
                throw new BadRequestException('Invalid recurrence rule')
            }
        }
    }
    validateEvent(data: DomainRow) {
        const allDay = data.kind === 'allDay'
        if (
            allDay
                ? !data.startDate ||
                  !data.endDate ||
                  data.startsAt ||
                  data.endsAt ||
                  String(data.endDate) <= String(data.startDate)
                : !data.startsAt ||
                  !data.endsAt ||
                  data.startDate ||
                  data.endDate ||
                  new Date(String(data.endsAt)) <= new Date(String(data.startsAt))
        )
            throw new BadRequestException('Event requires a valid exclusive-end time or date interval')
    }
    async insert(db: Query, resource: CalendarResource, data: DomainRow): Promise<DomainRow> {
        const fields = decodeInput(resource, data)
        const keys = Object.keys(fields)
        const { rows } = await db.query(
            `INSERT INTO ${quote(tableName(resource))} (${keys.map(quote).join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`,
            Object.values(fields),
        )
        return rows[0]
    }
    async create(db: Query, userId: string, resource: CalendarResource, raw: unknown) {
        if (resources[resource].create === false)
            throw new BadRequestException('Use the invitation or meeting action endpoint')
        const data: DomainRow = parse(inputSchema(resource), raw)
        await this.references(db, userId, resource, data)
        if (resource === 'events') this.validateEvent({ ...data, kind: data.kind || 'timed' })
        data.id ||= randomUUID()
        const cols = columns(resource)
        if (cols.userId) data.userId = userId
        if (cols.ownerUserId) data.ownerUserId = userId
        if (cols.createdByUserId) data.createdByUserId = userId
        if (cols.uploadedByUserId) data.uploadedByUserId = userId
        const row = await this.insert(db, resource, data)
        return this.project(db, userId, resource, row)
    }
    async update(db: Query, userId: string, resource: CalendarResource, id: string, raw: unknown) {
        const def = resources[resource]
        if (def.update === false) throw new BadRequestException('Use the response action endpoint')
        const schema = inputSchema(resource)
            .partial()
            .omit({ id: true })
            .extend({ version: CalendarDeleteSchema.shape.version })
        const data: DomainRow = parse(schema, raw)
        for (const key of def.immutable) if (key in data) throw new BadRequestException(`Immutable field: ${key}`)
        const { rows } = await db.query(
            `SELECT * FROM ${quote(tableName(resource))} WHERE id=$1 AND deleted_at IS NULL`,
            [id],
        )
        if (!rows[0]) throw new NotFoundException('Record not found')
        await this.authorizeWrite(db, userId, resource, rows[0])
        const full = { ...encodeRow(resource, rows[0]), ...data }
        await this.references(db, userId, resource, full)
        if (resource === 'events') this.validateEvent(full)
        const version = data.version
        delete data.version
        if (!Object.keys(data).length) throw new BadRequestException('No changes provided')
        const fields = decodeInput(resource, data),
            keys = Object.keys(fields)
        const result = await db.query(
            `UPDATE ${quote(tableName(resource))} SET ${keys.map((k, i) => `${quote(k)}=$${i + 3}`).join(',')} WHERE id=$1 AND version=$2 RETURNING *`,
            [id, version, ...Object.values(fields)],
        )
        if (!result.rows[0]) throw new ConflictException('Version conflict; refresh the record')
        return this.project(db, userId, resource, result.rows[0])
    }
    async remove(db: Query, userId: string, resource: CalendarResource, id: string, raw: unknown) {
        if (resources[resource].remove === false) throw new BadRequestException('Read-only resource')
        const { version } = parse(CalendarDeleteSchema, raw)
        const { rows } = await db.query(
            `SELECT * FROM ${quote(tableName(resource))} WHERE id=$1 AND deleted_at IS NULL`,
            [id],
        )
        if (!rows[0]) throw new NotFoundException('Record not found')
        await this.authorizeWrite(db, userId, resource, rows[0])
        const changed = await db.query(
            `UPDATE ${quote(tableName(resource))} SET deleted_at=now() WHERE id=$1 AND version=$2 RETURNING *`,
            [id, version],
        )
        if (!changed.rows[0]) throw new ConflictException('Version conflict; refresh the record')
        await this.cascade(db, resource, id)
        return encodeRow(resource, changed.rows[0])
    }
    async cascade(db: Query, resource: CalendarResource, id: string) {
        const children: [CalendarResource, string][] =
            resource === 'calendars'
                ? [
                      ['events', 'calendar_id'],
                      ['sources', 'calendar_id'],
                      ['members', 'calendar_id'],
                      ['invitations', 'calendar_id'],
                  ]
                : resource === 'events'
                  ? [
                        ['recurrences', 'event_id'],
                        ['exceptions', 'event_id'],
                        ['attachments', 'event_id'],
                        ['meetings', 'event_id'],
                        ['overrides', 'event_id'],
                        ['event-reminder-settings', 'event_id'],
                        ['reminder-rules', 'event_id'],
                        ['color-rules', 'event_id'],
                    ]
                  : resource === 'meetings'
                    ? [['participants', 'meeting_id']]
                    : resource === 'sources'
                      ? [
                            ['events', 'source_id'],
                            ['source-connections', 'source_id'],
                            ['source-revisions', 'source_id'],
                        ]
                      : resource === 'profiles'
                        ? [['profile-calendars', 'profile_id']]
                        : resource === 'palettes'
                          ? [['palette-colors', 'preset_id']]
                          : resource === 'devices'
                            ? [['device-preferences', 'device_id']]
                            : []
        for (const [child, key] of children) {
            const { rows } = await db.query(
                `UPDATE ${quote(tableName(child))} SET deleted_at=now() WHERE ${quote(key)}=$1 AND deleted_at IS NULL RETURNING id`,
                [id],
            )
            for (const row of rows) await this.cascade(db, child, row.id)
        }
    }
}
