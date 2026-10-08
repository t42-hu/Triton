import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { createHash, randomUUID } from 'node:crypto'
import {
    CalendarResourceSchemas,
    SyncAckSchema,
    SyncPullSchema,
    SyncPushSchema,
    SyncSnapshotSchema,
} from '@fullstack-starter/shared'
import { CalendarService, parse, quote } from './calendar.service.js'
import { resourceByTable, resourceNames, tableName } from './calendar.catalog.js'
import { calendarVisible, eventVisible, visibility, type Query } from './calendar.access.js'

const stable = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
    if (value && typeof value === 'object')
        return `{${Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, v]) => `${JSON.stringify(key)}:${stable(v)}`)
            .join(',')}}`
    return JSON.stringify(value)
}
@Injectable()
export class CalendarSync {
    constructor(readonly calendar: CalendarService) {}
    register(userId: string, raw: unknown) {
        const body = parse(CalendarResourceSchemas.devices.omit({ id: true }), raw)
        return this.calendar.transaction(async (db) => {
            const prior = (
                await db.query('SELECT * FROM user_device WHERE user_id=$1 AND installation_id=$2', [
                    userId,
                    body.installationId,
                ])
            ).rows[0]
            if (!prior) return this.calendar.create(db, userId, 'devices', body)
            if (prior.platform !== body.platform) throw new ConflictException('Installation platform cannot change')
            if (prior.deleted_at || prior.revoked_at) {
                await db.query('UPDATE user_device SET deleted_at=NULL,revoked_at=NULL,push_token=NULL WHERE id=$1', [
                    prior.id,
                ])
                await db.query('UPDATE sync_cursor SET requires_full_sync=true WHERE device_id=$1', [prior.id])
            }
            const latest = (await db.query('SELECT version FROM user_device WHERE id=$1', [prior.id])).rows[0]
            return this.calendar.update(db, userId, 'devices', prior.id, {
                version: latest.version,
                name: body.name ?? prior.name,
                pushToken: body.pushToken ?? null,
            })
        })
    }
    async device(db: Query, userId: string, id: string) {
        const { rows } = await db.query(
            'SELECT id FROM user_device WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL AND revoked_at IS NULL',
            [id, userId],
        )
        if (!rows[0]) throw new NotFoundException('Active device not found')
        await db.query('INSERT INTO sync_cursor(device_id,user_id) VALUES($1,$2) ON CONFLICT(device_id) DO NOTHING', [
            id,
            userId,
        ])
        return (await db.query('SELECT * FROM sync_cursor WHERE device_id=$1 AND user_id=$2', [id, userId])).rows[0]
    }
    async high(db: Query) {
        return String((await db.query('SELECT coalesce(max(sequence),0)::text high FROM sync_change')).rows[0].high)
    }
    async accessChanged(db: Query, userId: string, after: string) {
        const { rowCount } = await db.query(
            `SELECT 1 FROM sync_change WHERE sequence>$1 AND affected_user_id=$2 AND entity_type IN ('calendar_member','meeting_participant') LIMIT 1`,
            [after, userId],
        )
        return !!rowCount
    }
    snapshot(userId: string, raw: unknown) {
        const body = parse(SyncSnapshotSchema, raw)
        return this.calendar.transaction(async (db) => {
            await this.device(db, userId, body.deviceId)
            await db.query('DELETE FROM sync_snapshot WHERE expires_at<now()')
            let snapshot
            if (body.snapshotToken)
                snapshot = (
                    await db.query(
                        'SELECT * FROM sync_snapshot WHERE id=$1 AND user_id=$2 AND device_id=$3 AND expires_at>now()',
                        [body.snapshotToken, userId, body.deviceId],
                    )
                ).rows[0]
            else {
                if (body.offset !== 0) throw new BadRequestException('A new snapshot starts at offset zero')
                const high = await this.high(db),
                    items = []
                for (const resource of resourceNames) {
                    const { rows } = await db.query(
                        `SELECT r.* ${['events', 'recurrences', 'exceptions'].includes(resource) ? `, ${eventVisible(resource === 'events' ? 'r.id' : 'r.event_id', true)} AS __full` : ''} FROM ${quote(tableName(resource))} r WHERE r.deleted_at IS NULL AND ${visibility(resource)} ORDER BY r.id`,
                        [userId],
                    )
                    for (const row of rows)
                        items.push({ resource, record: await this.calendar.project(db, userId, resource, row) })
                    if (items.length > 50000) throw new BadRequestException('Snapshot exceeds server limit')
                }
                snapshot = (
                    await db.query(
                        `INSERT INTO sync_snapshot(id,user_id,device_id,high_sequence,total_items,items,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval '15 minutes') RETURNING *`,
                        [randomUUID(), userId, body.deviceId, high, items.length, JSON.stringify(items)],
                    )
                ).rows[0]
            }
            if (!snapshot) throw new ConflictException('Snapshot expired; start a new snapshot')
            if (await this.accessChanged(db, userId, String(snapshot.high_sequence)))
                throw new ConflictException('Access changed; start a new snapshot')
            if (body.offset > snapshot.served_through || body.offset > snapshot.total_items)
                throw new BadRequestException('Snapshot pages must be fetched in order')
            const end = Math.min(body.offset + body.limit, snapshot.total_items)
            await db.query('UPDATE sync_snapshot SET served_through=greatest(served_through,$2) WHERE id=$1', [
                snapshot.id,
                end,
            ])
            return {
                snapshotToken: snapshot.id,
                highSequence: String(snapshot.high_sequence),
                items: snapshot.items.slice(body.offset, end),
                nextOffset: end < snapshot.total_items ? end : null,
                totalItems: snapshot.total_items,
            }
        })
    }
    pull(userId: string, raw: unknown) {
        const body = parse(SyncPullSchema, raw)
        return this.calendar.transaction(async (db) => {
            const cursor = await this.device(db, userId, body.deviceId),
                high = await this.high(db)
            if (cursor.requires_full_sync || (await this.accessChanged(db, userId, String(cursor.last_sequence)))) {
                await db.query('UPDATE sync_cursor SET requires_full_sync=true WHERE device_id=$1', [body.deviceId])
                return {
                    requiresSnapshot: true,
                    changes: [],
                    nextSequence: String(cursor.last_sequence),
                    highSequence: high,
                    hasMore: false,
                }
            }
            if (
                BigInt(body.after) < BigInt(cursor.last_sequence) ||
                BigInt(body.after) > BigInt(cursor.last_delivered_sequence)
            )
                throw new BadRequestException('Cursor was not acknowledged or delivered to this device')
            const { rows } = await db.query(
                'SELECT * FROM sync_change WHERE sequence>$1 AND sequence<=$2 ORDER BY sequence LIMIT $3',
                [body.after, high, body.limit],
            )
            const changes = []
            for (const change of rows) {
                let allowed = change.user_id === userId || change.affected_user_id === userId
                if (!allowed && change.entity_type === 'calendar_invitation') {
                    allowed = !!(
                        await db.query(
                            `SELECT r.id FROM calendar_invitation r WHERE r.id=$2 AND ${visibility('invitations')}`,
                            [userId, change.entity_id],
                        )
                    ).rowCount
                }
                if (!allowed && (change.event_id || change.calendar_id)) {
                    const result = await db.query(
                        `SELECT (${eventVisible('$2', false)} OR ${calendarVisible('$3', false)}) allowed`,
                        [userId, change.event_id, change.calendar_id],
                    )
                    allowed = result.rows[0].allowed
                    // The owner still needs its calendar deletion tombstone.
                    if (!allowed && change.entity_type === 'calendar' && change.operation === 'delete')
                        allowed = !!(
                            await db.query('SELECT id FROM calendar WHERE id=$1 AND owner_user_id=$2', [
                                change.entity_id,
                                userId,
                            ])
                        ).rowCount
                }
                if (!allowed) continue
                const resource = resourceByTable.get(change.entity_type)
                if (!resource) continue
                const record = await this.calendar.get(db, userId, resource, change.entity_id, false)
                // Do not expose identifiers of other users' private event-linked rows.
                if (
                    !record &&
                    change.operation !== 'delete' &&
                    change.user_id !== userId &&
                    change.affected_user_id !== userId
                )
                    continue
                changes.push({
                    sequence: String(change.sequence),
                    resource,
                    id: change.entity_id,
                    operation: record ? 'upsert' : 'delete',
                    record,
                })
            }
            const next = rows.length ? String(rows[rows.length - 1].sequence) : high
            await db.query(
                'UPDATE sync_cursor SET last_delivered_sequence=greatest(last_delivered_sequence,$2) WHERE device_id=$1',
                [body.deviceId, next],
            )
            return {
                requiresSnapshot: false,
                changes,
                nextSequence: next,
                highSequence: high,
                hasMore: BigInt(next) < BigInt(high),
            }
        })
    }
    ack(userId: string, raw: unknown) {
        const body = parse(SyncAckSchema, raw)
        return this.calendar.transaction(async (db) => {
            const cursor = await this.device(db, userId, body.deviceId)
            if (body.snapshotToken) {
                const snapshot = (
                    await db.query(
                        'SELECT * FROM sync_snapshot WHERE id=$1 AND user_id=$2 AND device_id=$3 AND expires_at>now()',
                        [body.snapshotToken, userId, body.deviceId],
                    )
                ).rows[0]
                if (
                    !snapshot ||
                    snapshot.served_through !== snapshot.total_items ||
                    String(snapshot.high_sequence) !== body.sequence ||
                    (await this.accessChanged(db, userId, String(snapshot.high_sequence)))
                )
                    throw new ConflictException('Incomplete, expired, or invalidated snapshot')
                if (BigInt(body.sequence) < BigInt(cursor.last_sequence))
                    throw new ConflictException('Snapshot is older than the device cursor')
                await db.query(
                    'UPDATE sync_cursor SET last_sequence=$2,last_delivered_sequence=$2,last_synced_at=now(),requires_full_sync=false WHERE device_id=$1',
                    [body.deviceId, body.sequence],
                )
            } else {
                if (
                    cursor.requires_full_sync ||
                    BigInt(body.sequence) < BigInt(cursor.last_sequence) ||
                    BigInt(body.sequence) > BigInt(cursor.last_delivered_sequence)
                )
                    throw new BadRequestException('Invalid acknowledgement')
                await db.query('UPDATE sync_cursor SET last_sequence=$2,last_synced_at=now() WHERE device_id=$1', [
                    body.deviceId,
                    body.sequence,
                ])
            }
            return { sequence: body.sequence }
        })
    }
    push(userId: string, raw: unknown) {
        const body = parse(SyncPushSchema, raw)
        return this.calendar.transaction(async (db) => {
            await this.device(db, userId, body.deviceId)
            const results = []
            for (const mutation of body.mutations) {
                const hash = createHash('sha256').update(stable(mutation)).digest('hex')
                const prior = (
                    await db.query(
                        'SELECT request_hash,result FROM sync_mutation WHERE user_id=$1 AND device_id=$2 AND client_mutation_id=$3',
                        [userId, body.deviceId, mutation.clientMutationId],
                    )
                ).rows[0]
                if (prior) {
                    if (prior.request_hash !== hash)
                        throw new ConflictException('Mutation ID reused with different content')
                    const current = await this.calendar.get(
                        db,
                        userId,
                        mutation.resource,
                        String(prior.result.id),
                        false,
                    )
                    if (!current && !prior.result.deletedAt)
                        throw new NotFoundException('Previously mutated record is no longer accessible')
                    const replay = current
                        ? Object.fromEntries(Object.entries(prior.result).filter(([key]) => key in current))
                        : { id: prior.result.id, version: prior.result.version, deletedAt: prior.result.deletedAt }
                    results.push({ clientMutationId: mutation.clientMutationId, record: replay })
                    continue
                }
                if (mutation.operation !== 'create' && (!mutation.id || !mutation.version))
                    throw new BadRequestException('Updates and deletes require id and version')
                const record =
                    mutation.operation === 'create'
                        ? await this.calendar.create(db, userId, mutation.resource, {
                              ...mutation.data,
                              ...(mutation.id ? { id: mutation.id } : {}),
                          })
                        : mutation.operation === 'update'
                          ? await this.calendar.update(db, userId, mutation.resource, mutation.id!, {
                                ...mutation.data,
                                version: mutation.version,
                            })
                          : await this.calendar.remove(db, userId, mutation.resource, mutation.id!, {
                                version: mutation.version,
                            })
                await db.query(
                    'INSERT INTO sync_mutation(user_id,device_id,client_mutation_id,request_hash,result) VALUES($1,$2,$3,$4,$5)',
                    [userId, body.deviceId, mutation.clientMutationId, hash, JSON.stringify(record)],
                )
                results.push({ clientMutationId: mutation.clientMutationId, record })
            }
            return { results }
        })
    }
}
