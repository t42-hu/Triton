import { ForbiddenException, NotFoundException } from '@nestjs/common'
import type { PoolClient } from 'pg'
import type { CalendarResource } from '@fullstack-starter/shared'
import { resources, type DomainRow } from './calendar.catalog.js'

export type Query = Pick<PoolClient, 'query'>
export type CalendarAccess = 'owner' | 'editor' | 'reader' | 'busy_only'
// Expressions use trusted catalog identifiers and bind the authenticated user as $1.
export const calendarVisible = (column: string, full = false) => `EXISTS (
    SELECT 1 FROM calendar ac WHERE ac.id=${column} AND ac.deleted_at IS NULL AND (
    ac.owner_user_id=$1 OR EXISTS(SELECT 1 FROM calendar_member am WHERE am.calendar_id=ac.id
        AND am.user_id=$1 AND am.deleted_at IS NULL ${full ? "AND am.role<>'busy_only'" : ''})))`
export const eventVisible = (column: string, full = false) => `EXISTS (
    SELECT 1 FROM calendar_event ae JOIN calendar ac ON ac.id=ae.calendar_id
    WHERE ae.id=${column} AND ae.deleted_at IS NULL AND ac.deleted_at IS NULL AND (
    ${calendarVisible('ae.calendar_id', full)} OR EXISTS(SELECT 1 FROM meeting mt
    WHERE mt.event_id=ae.id AND mt.deleted_at IS NULL AND (mt.organizer_user_id=$1 OR
    EXISTS(SELECT 1 FROM meeting_participant mp WHERE mp.meeting_id=mt.id AND mp.user_id=$1 AND mp.deleted_at IS NULL)))))`
export function visibility(resource: CalendarResource, alias = 'r'): string {
    const def = resources[resource]
    if (def.access === 'user') return `${alias}.user_id=$1`
    if (def.access === 'calendar-root') return calendarVisible(`${alias}.id`)
    if (def.access === 'calendar') return calendarVisible(`${alias}.calendar_id`, true)
    if (def.access === 'event')
        return eventVisible(
            resource === 'events' ? `${alias}.id` : `${alias}.event_id`,
            !['events', 'recurrences', 'exceptions'].includes(resource),
        )
    if (def.access === 'member')
        return `(${alias}.user_id=$1 OR EXISTS(SELECT 1 FROM calendar c WHERE c.id=${alias}.calendar_id AND c.deleted_at IS NULL AND c.owner_user_id=$1))`
    if (def.access === 'invitation')
        return `(${alias}.invited_by_user_id=$1 OR ${alias}.invited_user_id=$1 OR lower(${alias}.invited_email)=(SELECT lower(email) FROM "user" WHERE id=$1 AND email_verified=true))`
    if (def.access === 'source-owner' || def.access === 'source-revision')
        return `EXISTS(SELECT 1 FROM calendar_source s JOIN calendar c ON c.id=s.calendar_id WHERE s.id=${alias}.source_id AND s.deleted_at IS NULL AND c.deleted_at IS NULL AND c.owner_user_id=$1)`
    if (def.access === 'meeting') return eventVisible(`${alias}.event_id`, true)
    return `EXISTS(SELECT 1 FROM meeting m WHERE m.id=${alias}.meeting_id AND m.deleted_at IS NULL AND ${eventVisible('m.event_id', true)})`
}
export async function calendarAccess(db: Query, userId: string, calendarId: unknown): Promise<CalendarAccess> {
    const { rows } = await db.query(
        `SELECT CASE WHEN c.owner_user_id=$1 THEN 'owner' ELSE m.role END role
        FROM calendar c LEFT JOIN calendar_member m ON m.calendar_id=c.id AND m.user_id=$1 AND m.deleted_at IS NULL
        WHERE c.id=$2 AND c.deleted_at IS NULL`,
        [userId, calendarId],
    )
    if (!rows[0]?.role) throw new NotFoundException('Calendar not found')
    return rows[0].role
}
export async function requireCalendar(
    db: Query,
    userId: string,
    calendarId: unknown,
    permission: 'read' | 'full' | 'edit' | 'owner' = 'read',
) {
    const role = await calendarAccess(db, userId, calendarId)
    if (
        (permission === 'owner' && role !== 'owner') ||
        (permission === 'edit' && !['owner', 'editor'].includes(role)) ||
        (permission === 'full' && role === 'busy_only')
    )
        throw new ForbiddenException('Insufficient calendar permission')
    return role
}
export async function requireEvent(db: Query, userId: string, eventId: unknown, edit = false): Promise<DomainRow> {
    const { rows } = await db.query(
        `SELECT r.* FROM calendar_event r WHERE r.id=$2 AND r.deleted_at IS NULL AND ${eventVisible('r.id', !edit)}`,
        [userId, eventId],
    )
    if (!rows[0]) throw new NotFoundException('Event not found')
    if (edit) await requireCalendar(db, userId, rows[0].calendar_id, 'edit')
    return rows[0]
}
export async function requireMeetingOrganizer(db: Query, userId: string, meetingId: unknown): Promise<DomainRow> {
    const { rows } = await db.query(
        `SELECT m.* FROM meeting m JOIN calendar_event e ON e.id=m.event_id JOIN calendar c ON c.id=e.calendar_id WHERE m.id=$1 AND m.organizer_user_id=$2 AND m.deleted_at IS NULL AND e.deleted_at IS NULL AND c.deleted_at IS NULL`,
        [meetingId, userId],
    )
    if (!rows[0]) throw new NotFoundException('Meeting not found')
    return rows[0]
}
