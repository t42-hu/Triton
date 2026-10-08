import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { createHash, randomUUID } from 'node:crypto'
import {
    CalendarInviteSchema,
    CalendarInviteResponseSchema,
    MeetingCreateSchema,
    MeetingInviteSchema,
    MeetingResponseSchema,
} from '@fullstack-starter/shared'
import type { Query } from './calendar.access.js'
import { requireCalendar, requireMeetingOrganizer } from './calendar.access.js'
import { CalendarService, parse } from './calendar.service.js'
import { encodeRow } from './calendar.catalog.js'

@Injectable()
export class CalendarActions {
    constructor(readonly calendar: CalendarService) {}
    invite(userId: string, raw: unknown) {
        const body = parse(CalendarInviteSchema, raw)
        return this.calendar.transaction(async (db) => {
            await requireCalendar(db, userId, body.calendarId, 'owner')
            const { rows } = await db.query(
                'SELECT id,email,email_verified FROM "user" WHERE ' + (body.userId ? 'id=$1' : 'lower(trim(email))=$1'),
                [body.userId || body.email!.trim().toLowerCase()],
            )
            if (body.userId && !rows[0]) throw new NotFoundException('User not found')
            if (rows[0]?.id === userId) throw new BadRequestException('Cannot invite yourself')
            const row = await this.calendar.insert(db, 'invitations', {
                id: randomUUID(),
                calendarId: body.calendarId,
                invitedByUserId: userId,
                invitedUserId: body.userId ? rows[0]?.id : rows[0]?.email_verified ? rows[0].id : null,
                invitedEmail: body.email?.trim().toLowerCase() || null,
                role: body.role,
                tokenHash: createHash('sha256').update(randomUUID()).digest('hex'),
                expiresAt: new Date(Date.now() + body.expiresInDays * 86400000),
            })
            return encodeRow('invitations', row)
        })
    }
    respondInvitation(userId: string, id: string, raw: unknown) {
        const body = parse(CalendarInviteResponseSchema, raw)
        return this.calendar.transaction(async (db) => {
            const { rows } = await db.query(
                `SELECT i.* FROM calendar_invitation i JOIN calendar c ON c.id=i.calendar_id WHERE i.id=$2 AND i.deleted_at IS NULL AND c.deleted_at IS NULL AND (i.invited_user_id=$1 OR lower(i.invited_email)=(SELECT lower(email) FROM "user" WHERE id=$1 AND email_verified=true))`,
                [userId, id],
            )
            const invitation = rows[0]
            if (!invitation) throw new NotFoundException('Invitation not found')
            if (
                invitation.version !== body.version ||
                invitation.status !== 'pending' ||
                invitation.expires_at <= new Date()
            )
                throw new ConflictException('Invitation expired, changed, or already answered')
            if (body.response === 'accepted')
                await db.query(
                    `INSERT INTO calendar_member(calendar_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT(calendar_id,user_id) DO UPDATE SET role=excluded.role,deleted_at=NULL`,
                    [invitation.calendar_id, userId, invitation.role],
                )
            const result = await db.query(
                'UPDATE calendar_invitation SET status=$2,responded_at=now() WHERE id=$1 RETURNING *',
                [id, body.response],
            )
            return encodeRow('invitations', result.rows[0])
        })
    }
    async addParticipants(db: Query, userId: string, meetingId: string, userIds: string[]) {
        const result = []
        for (const recipient of new Set(userIds)) {
            if (recipient === userId) continue
            const { rowCount } = await db.query('SELECT id FROM "user" WHERE id=$1', [recipient])
            if (!rowCount) throw new BadRequestException('Unknown participant')
            const { rows } = await db.query(
                `INSERT INTO meeting_participant(meeting_id,user_id,invited_by_user_id) VALUES($1,$2,$3) ON CONFLICT(meeting_id,user_id) DO UPDATE SET deleted_at=NULL,response=CASE WHEN meeting_participant.deleted_at IS NOT NULL THEN 'pending' ELSE meeting_participant.response END,invited_by_user_id=excluded.invited_by_user_id RETURNING *`,
                [meetingId, recipient, userId],
            )
            result.push(encodeRow('participants', rows[0]))
        }
        return result
    }
    createMeeting(userId: string, raw: unknown) {
        const body = parse(MeetingCreateSchema, raw)
        return this.calendar.transaction(async (db) => {
            const event = await this.calendar.create(db, userId, 'events', body.event)
            const meeting = encodeRow(
                'meetings',
                await this.calendar.insert(db, 'meetings', {
                    id: body.id || randomUUID(),
                    eventId: event.id,
                    organizerUserId: userId,
                    status: body.status,
                }),
            )
            return {
                event,
                meeting,
                participants: await this.addParticipants(db, userId, String(meeting.id), body.participantUserIds),
            }
        })
    }
    inviteMeeting(userId: string, id: string, raw: unknown) {
        const body = parse(MeetingInviteSchema, raw)
        return this.calendar.transaction(async (db) => {
            await requireMeetingOrganizer(db, userId, id)
            return { participants: await this.addParticipants(db, userId, id, body.userIds) }
        })
    }
    respondMeeting(userId: string, id: string, raw: unknown) {
        const body = parse(MeetingResponseSchema, raw)
        return this.calendar.transaction(async (db) => {
            await this.calendar.get(db, userId, 'meetings', id)
            const { rows } = await db.query(
                `UPDATE meeting_participant SET response=$3,responded_at=now() WHERE meeting_id=$1 AND user_id=$2 AND version=$4 AND deleted_at IS NULL RETURNING *`,
                [id, userId, body.response, body.version],
            )
            if (!rows[0]) throw new ConflictException('Participant missing or version conflict')
            return encodeRow('participants', rows[0])
        })
    }
}
