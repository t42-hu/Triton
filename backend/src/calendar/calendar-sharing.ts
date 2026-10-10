import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { CalendarShareCreateSchema, type CalendarShareSelection } from '@fullstack-starter/shared'
import { requireCalendar } from './calendar.access.js'
import { CalendarService, parse } from './calendar.service.js'
import { serializeSharedCalendar, type SharedEvent } from './shared-calendar-ics.js'

type ShareRow = { id: string; calendar_id: string; name: string; created_at: Date; revoked_at: Date | null; selection: CalendarShareSelection | null; available: boolean }
/** Recheck the owner's profile on every download, including links created before this restriction. */
const shareable = (calendar: string, owner: string) => `EXISTS (
    SELECT 1 FROM schedule_profile_calendar pc JOIN schedule_profile p ON p.id=pc.profile_id AND p.user_id=pc.user_id
    WHERE pc.calendar_id=${calendar} AND pc.user_id=${owner} AND pc.deleted_at IS NULL AND p.deleted_at IS NULL
    AND p.is_own=true AND (p.linked_user_id IS NULL OR p.linked_user_id=${owner}))
    AND NOT EXISTS (SELECT 1 FROM schedule_profile_calendar pc JOIN schedule_profile p ON p.id=pc.profile_id AND p.user_id=pc.user_id
    WHERE pc.calendar_id=${calendar} AND pc.user_id=${owner} AND pc.deleted_at IS NULL AND p.deleted_at IS NULL
    AND (p.is_own=false OR (p.linked_user_id IS NOT NULL AND p.linked_user_id<>${owner})))`

/** A per-link signature prevents guessing; the database row remains the revocation authority. */
export function shareSignature(id: string, secret: string): string {
    return createHmac('sha256', secret).update(`calendar-share:v1:${id}`).digest('base64url')
}
export function validShareSignature(id: string, token: string, secret: string): boolean {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false
    return timingSafeEqual(Buffer.from(token), Buffer.from(shareSignature(id, secret)))
}
@Injectable()
export class CalendarSharing {
    constructor(readonly calendar: CalendarService) {}
    private secret() {
        const secret = process.env.BETTER_AUTH_SECRET
        if (!secret || secret.length < 32) throw new Error('Missing calendar sharing signing secret')
        return secret
    }
    private present(row: ShareRow) {
        return { id: row.id, calendarId: row.calendar_id, name: row.name, createdAt: row.created_at,
            revokedAt: row.revoked_at, selection: row.selection, available: row.available, url: row.revoked_at || !row.available ? null :
                `https://mobile.triton42.hu/api/calendar-share/${row.id}/${shareSignature(row.id, this.secret())}/calendar.ics` }
    }
    list(userId: string) {
        return this.calendar.transaction(async db => {
            const { rows } = await db.query<ShareRow>(`SELECT s.id,s.calendar_id,c.name,s.created_at,s.revoked_at,s.selection,(${shareable('c.id', 's.owner_user_id')}) AS available
                FROM calendar_share s JOIN calendar c ON c.id=s.calendar_id
                WHERE s.owner_user_id=$1 AND c.owner_user_id=$1 AND c.deleted_at IS NULL ORDER BY s.created_at DESC`, [userId])
            return rows.map(row => this.present(row))
        }, false)
    }
    options(userId: string) {
        return this.calendar.transaction(async db => {
            const calendars = await db.query<{ id: string; name: string }>(`SELECT c.id,c.name FROM calendar c
                WHERE c.owner_user_id=$1 AND c.deleted_at IS NULL AND ${shareable('c.id', '$1')} ORDER BY c.name`, [userId])
            const sources = await db.query<{ id: string; calendar_id: string; name: string; type: string; event_count: number }>(`SELECT s.id,s.calendar_id,s.name,
                CASE WHEN sc.url IS NOT NULL AND sc.deleted_at IS NULL THEN 'link' ELSE s.format END AS type,
                (SELECT count(*)::int FROM calendar_event e WHERE e.source_id=s.id AND e.deleted_at IS NULL) AS event_count
                FROM calendar_source s LEFT JOIN calendar_source_connection sc ON sc.source_id=s.id
                WHERE s.calendar_id=ANY($1::text[]) AND s.deleted_at IS NULL ORDER BY s.name`, [calendars.rows.map(row => row.id)])
            return calendars.rows.map(calendar => ({ calendarId: calendar.id, name: calendar.name,
                sources: sources.rows.filter(source => source.calendar_id === calendar.id).map(source => ({ id: source.id, name: source.name, type: source.type, eventCount: source.event_count })) }))
        }, false)
    }
    create(userId: string, input: unknown) {
        const { calendarId, selection } = parse(CalendarShareCreateSchema, input)
        return this.calendar.transaction(async db => {
            await requireCalendar(db, userId, calendarId, 'owner')
            const eligible = await db.query(`SELECT id FROM calendar c WHERE c.id=$1 AND ${shareable('c.id', '$2')}`, [calendarId, userId])
            if (!eligible.rows.length) throw new BadRequestException('Csak a saját profilodhoz tartozó órarend osztható meg.')
            const sources = await db.query(`SELECT id FROM calendar_source WHERE id=ANY($1::text[]) AND calendar_id=$2 AND deleted_at IS NULL AND format<>'manual'`, [selection.sourceIds, calendarId])
            if (sources.rows.length !== selection.sourceIds.length) throw new BadRequestException('A kiválasztott import nem tartozik a saját órarendedhez.')
            const { rows } = await db.query<ShareRow>(`INSERT INTO calendar_share(id,owner_user_id,calendar_id,selection)
                VALUES ($1,$2,$3,$4) RETURNING *, (SELECT name FROM calendar WHERE id=$3) AS name, true AS available`, [randomUUID(), userId, calendarId, JSON.stringify(selection)])
            return this.present(rows[0])
        })
    }
    revoke(userId: string, id: string) {
        return this.calendar.transaction(async db => {
            const { rows } = await db.query(`UPDATE calendar_share s SET revoked_at=COALESCE(revoked_at,now())
                WHERE s.id=$1 AND s.owner_user_id=$2 AND EXISTS(SELECT 1 FROM calendar c WHERE c.id=s.calendar_id AND c.owner_user_id=$2 AND c.deleted_at IS NULL)
                RETURNING s.id`, [id, userId])
            if (!rows.length) throw new NotFoundException('A megosztási link nem található.')
            return { revoked: true }
        })
    }
    download(id: string, token: string) {
        if (!validShareSignature(id, token, this.secret())) throw new NotFoundException('A megosztási link nem érhető el.')
        return this.calendar.transaction(async db => {
            const { rows } = await db.query<{ calendar_id: string; owner_user_id: string; name: string; selection: CalendarShareSelection | null }>(`SELECT s.calendar_id,s.owner_user_id,c.name,s.selection
                FROM calendar_share s JOIN calendar c ON c.id=s.calendar_id
                WHERE s.id=$1 AND s.revoked_at IS NULL AND c.deleted_at IS NULL AND c.owner_user_id=s.owner_user_id AND ${shareable('c.id', 's.owner_user_id')}`, [id])
            const share = rows[0]
            if (!share) throw new NotFoundException('A megosztási link nem érhető el.')
            const selection = share.selection ?? { categories: ['lesson','event','work','assignment','test','exam'], sourceIds: null, includeManual: true }
            const events = await db.query<SharedEvent>(`SELECT e.id, e.category,
                COALESCE(o.title,e.title) AS title, COALESCE(o.location,e.location) AS location,
                COALESCE(o.notes,e.notes) AS notes,
                CASE WHEN o.starts_at IS NOT NULL THEN 'timed' WHEN o.start_date IS NOT NULL THEN 'allDay' ELSE e.kind END AS kind,
                COALESCE(o.starts_at,e.starts_at) AS starts_at,
                COALESCE(o.ends_at,e.ends_at) AS ends_at,
                COALESCE(o.start_date,e.start_date) AS start_date,
                COALESCE(o.end_date,e.end_date) AS end_date
                FROM calendar_event e LEFT JOIN calendar_source src ON src.id=e.source_id AND src.calendar_id=e.calendar_id LEFT JOIN user_event_override o ON o.event_id=e.id AND o.user_id=$2 AND o.occurrence_key='' AND o.deleted_at IS NULL
                WHERE e.calendar_id=$1 AND e.deleted_at IS NULL AND COALESCE(o.hidden,false)=false
                AND e.category=ANY($3::text[]) AND (e.source_id IS NULL OR src.deleted_at IS NULL)
                AND (($4::boolean AND (e.source_id IS NULL OR src.format='manual')) OR
                    (src.format<>'manual' AND ($5::text[] IS NULL OR e.source_id=ANY($5::text[]))))
                ORDER BY COALESCE(o.starts_at,e.starts_at),COALESCE(o.start_date,e.start_date),e.id`, [share.calendar_id, share.owner_user_id, selection.categories, selection.includeManual, selection.sourceIds])
            return serializeSharedCalendar(share.name, events.rows)
        }, false)
    }
}
