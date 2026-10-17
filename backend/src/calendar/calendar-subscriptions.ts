import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { createHash, randomUUID } from 'node:crypto'
import { expandIcs, wallTime, addDays, type Occurrence } from '@fullstack-starter/shared/calendar-import'
import { CalendarService } from './calendar.service.js'
import { CalendarSharing } from './calendar-sharing.js'
import { CalendarDownload, CalendarDownloadError, subscriptionUrl } from './calendar-download.js'
import { encodeRow } from './calendar.catalog.js'
import type { Query } from './calendar.access.js'

type Claim = {
    source_id: string
    url: string
    generation: number
    lease_token: string
    failures: number
    etag: string | null
    last_modified: string | null
    owner_user_id: string
    calendar_id: string
    version: number
    coverage_from: string | null
    coverage_to: string | null
    content: string | null
    content_hash: string | null
}
export type SubscriptionResult = { sourceId: string; status: 'success' | 'failed' | 'skipped'; changed?: boolean }
const hash = (content: string) => createHash('sha256').update(content).digest('hex')
export function internalCalendarShare(input: string): { id: string; token: string } | null {
    const url = subscriptionUrl(input)
    if (url.origin !== 'https://mobile.triton42.hu' || url.search) return null
    const match = /^\/api\/calendar-share\/([a-f0-9-]{36})\/([A-Za-z0-9_-]{43})\/calendar\.ics$/.exec(url.pathname)
    return match ? { id: match[1], token: match[2] } : null
}
export function subscriptionEvent(item: Occurrence) {
    return {
        externalUid: item.key,
        title: item.title,
        location: item.location,
        notes: item.notes || '',
        category: item.category || 'lesson',
        kind: item.kind,
        timezone: 'Europe/Budapest',
        ...(item.kind === 'allDay'
            ? {
                  startDate: wallTime(item.start).slice(0, 10),
                  endDate: wallTime(item.end).slice(0, 10),
                  startsAt: null,
                  endsAt: null,
              }
            : {
                  startsAt: new Date(item.start).toISOString(),
                  endsAt: new Date(item.end).toISOString(),
                  startDate: null,
                  endDate: null,
              }),
    }
}
@Injectable()
export class CalendarSubscriptions implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(CalendarSubscriptions.name)
    private timer?: ReturnType<typeof setInterval>
    private running?: Promise<void>
    private stopping = false
    constructor(
        readonly calendar: CalendarService,
        readonly download: CalendarDownload,
        readonly sharing: CalendarSharing,
    ) {}
    onModuleInit() {
        if (process.env.CALENDAR_SUBSCRIPTIONS_ENABLED === 'false') return
        const run = () => {
            void this.tick().catch(() =>
                this.logger.error('Calendar subscription sweep failed; retained data will be retried.'),
            )
        }
        this.timer = setInterval(run, 10000)
        this.timer.unref()
        run()
    }
    async onModuleDestroy() {
        this.stopping = true
        if (this.timer) clearInterval(this.timer)
        await this.running
    }
    tick(): Promise<void> {
        if (this.running) return this.running
        this.running = this.sweep().finally(() => {
            this.running = undefined
        })
        return this.running
    }
    private async sweep() {
        // Repairs legacy subscriptions too; random initial scheduling avoids a migration burst.
        await this.calendar.database.pool.query(`INSERT INTO calendar_subscription_job(source_id,next_attempt_at)
            SELECT c.source_id,now()+random()*interval '15 minutes' FROM calendar_source_connection c JOIN calendar_source s ON s.id=c.source_id
            WHERE c.url IS NOT NULL AND c.deleted_at IS NULL AND s.deleted_at IS NULL AND s.format='ics' ON CONFLICT DO NOTHING`)
        await Promise.all(
            Array.from({ length: 5 }, async () => {
                for (let count = 0; count < 20 && !this.stopping; count++) {
                    const claim = await this.claim()
                    if (!claim) break
                    await this.process(claim)
                }
            }),
        )
    }
    async refresh(userId: string): Promise<SubscriptionResult[]> {
        const { rows } = await this.calendar.database.pool.query<{ source_id: string }>(
            `SELECT c.source_id FROM calendar_source_connection c
            JOIN calendar_source s ON s.id=c.source_id JOIN calendar a ON a.id=s.calendar_id WHERE a.owner_user_id=$1 AND a.deleted_at IS NULL AND s.deleted_at IS NULL AND c.deleted_at IS NULL AND c.url IS NOT NULL AND s.format='ics'`,
            [userId],
        )
        const results: SubscriptionResult[] = []
        // Manual checks share the same leases and a one-minute cooldown to bound abuse.
        for (const row of rows) {
            await this.calendar.database.pool.query(
                'INSERT INTO calendar_subscription_job(source_id) VALUES($1) ON CONFLICT DO NOTHING',
                [row.source_id],
            )
            const claim = await this.claim(row.source_id, userId)
            results.push(claim ? await this.process(claim) : { sourceId: row.source_id, status: 'skipped' })
        }
        return results
    }
    private claim(sourceId?: string, userId?: string): Promise<Claim | null> {
        // Always acquire the domain lock before row locks: matches the domain trigger lock ordering.
        return this.calendar.transaction(async (db) => {
            const { rows } = await db.query(
                `SELECT j.source_id FROM calendar_subscription_job j
                JOIN calendar_source_connection c ON c.source_id=j.source_id JOIN calendar_source s ON s.id=j.source_id JOIN calendar a ON a.id=s.calendar_id
                WHERE c.url IS NOT NULL AND c.deleted_at IS NULL AND s.deleted_at IS NULL AND a.deleted_at IS NULL AND s.format='ics'
                AND (j.lease_until IS NULL OR j.lease_until<now()) AND (($1::text IS NULL AND j.next_attempt_at<=now()) OR
                    ($1::text=j.source_id AND a.owner_user_id=$2 AND (c.last_attempt_at IS NULL OR c.last_attempt_at<now()-interval '1 minute')))
                ORDER BY j.next_attempt_at LIMIT 1 FOR UPDATE OF j SKIP LOCKED`,
                [sourceId ?? null, userId ?? null],
            )
            if (!rows[0]) return null
            const id = rows[0].source_id,
                token = randomUUID()
            await db.query(
                "UPDATE calendar_subscription_job SET lease_token=$2,lease_until=now()+interval '2 minutes' WHERE source_id=$1",
                [id, token],
            )
            await db.query('UPDATE calendar_source_connection SET last_attempt_at=now() WHERE source_id=$1', [id])
            return (
                await db.query<Claim>(
                    `SELECT j.*,c.url,s.calendar_id,s.version,s.coverage_from::text,s.coverage_to::text,a.owner_user_id,sc.content,sc.content_hash
                FROM calendar_subscription_job j JOIN calendar_source_connection c ON c.source_id=j.source_id JOIN calendar_source s ON s.id=j.source_id
                JOIN calendar a ON a.id=s.calendar_id LEFT JOIN calendar_source_content sc ON sc.source_id=s.id WHERE j.source_id=$1`,
                    [id],
                )
            ).rows[0]
        })
    }
    private async process(claim: Claim): Promise<SubscriptionResult> {
        try {
            const internal = internalCalendarShare(claim.url)
            if (internal) await this.bindDependency(claim, internal.id)
            const response = internal
                ? { content: await this.sharing.download(internal.id, internal.token), etag: null, lastModified: null }
                : await this.download.download(claim.url, { etag: claim.etag, lastModified: claim.last_modified })
            const content = response.content ?? claim.content
            if (content === null) throw new Error('A naptár korábbi tartalma nem található; teljes letöltés szükséges.')
            if (!/^VERSION:2\.0\s*$/im.test(content)) throw new Error('Hiányzó ICS VERSION:2.0.')
            const today = wallTime(Date.now()).slice(0, 10)
            const from = claim.coverage_from || addDays(today, -90)
            const to =
                claim.coverage_to && claim.coverage_to > addDays(today, 180) ? claim.coverage_to : addDays(today, 365)
            const changed = hash(content) !== claim.content_hash || to !== claim.coverage_to
            const events: ReturnType<typeof subscriptionEvent>[] = []
            if (changed) {
                const signal = AbortSignal.timeout(45000)
                for await (const item of expandIcs(content, { from, to }, { signal, progress: () => undefined })) {
                    if (events.length >= 5000)
                        throw new Error('A naptár több mint 5000 alkalmat tartalmaz a feldolgozott időszakban.')
                    events.push(subscriptionEvent(item))
                }
            }
            const applied = await this.calendar.transaction(async (db) => {
                if (!(await this.current(db, claim))) return false
                await db.query("SELECT set_config('triton.subscription_worker','true',true)")
                let summary = ''
                if (changed) {
                    summary = await this.publish(db, claim, events)
                    await db.query(
                        `INSERT INTO calendar_source_content(source_id,content,content_hash) VALUES($1,$2,$3)
                        ON CONFLICT(source_id) DO UPDATE SET content=excluded.content,content_hash=excluded.content_hash,updated_at=now()`,
                        [claim.source_id, content, hash(content)],
                    )
                    await this.calendar.update(db, claim.owner_user_id, 'sources', claim.source_id, {
                        version: claim.version,
                        coverageFrom: from,
                        coverageTo: to,
                    })
                }
                await db.query(
                    'UPDATE calendar_source_connection SET last_success_at=now(),last_error=NULL,last_change=$2 WHERE source_id=$1',
                    [claim.source_id, summary],
                )
                await db.query(
                    `UPDATE calendar_subscription_job SET lease_until=NULL,lease_token=NULL,published_at=now(),failures=0,etag=$2,last_modified=$3,
                    next_attempt_at=now()+interval '15 minutes'+random()*interval '30 seconds' WHERE source_id=$1`,
                    [claim.source_id, response.etag, response.lastModified],
                )
                return true
            })
            return { sourceId: claim.source_id, status: applied ? 'success' : 'skipped', changed: applied && changed }
        } catch (error) {
            const message =
                error instanceof Error &&
                /^(A |Az |Csak |Hiányzó |Hibás |Érvénytelen |Nem |Ismétlődő |Túl |VCALENDAR)/.test(error.message)
                    ? error.message.replace(/(?:https?|webcal):\/\/\S+/gi, '[naptárlink]').slice(0, 300)
                    : 'A naptár frissítése nem sikerült.'
            await this.calendar.transaction(async (db) => {
                if (!(await this.current(db, claim))) return
                const delay = Math.max(
                    Math.min(3600000, 60000 * 2 ** Math.min(claim.failures, 6)),
                    error instanceof CalendarDownloadError ? error.retryAfter : 0,
                )
                await db.query(
                    "UPDATE calendar_subscription_job SET failures=failures+1,lease_until=NULL,lease_token=NULL,etag=NULL,last_modified=NULL,next_attempt_at=now()+$2*interval '1 millisecond' WHERE source_id=$1",
                    [claim.source_id, delay],
                )
                await db.query('UPDATE calendar_source_connection SET last_error=$2 WHERE source_id=$1', [
                    claim.source_id,
                    `${message} A korábbi adatok megmaradtak; automatikusan újrapróbáljuk.`,
                ])
            })
            this.logger.warn({ sourceId: claim.source_id, message }, 'Subscription refresh failed')
            return { sourceId: claim.source_id, status: 'failed' }
        } finally {
            await this.calendar.database.pool.query(
                'UPDATE calendar_subscription_job SET lease_token=NULL,lease_until=NULL WHERE source_id=$1 AND lease_token=$2',
                [claim.source_id, claim.lease_token],
            )
        }
    }
    private async current(db: Query, claim: Claim) {
        return !!(
            await db.query(
                `SELECT 1 FROM calendar_subscription_job j JOIN calendar_source s ON s.id=j.source_id
            JOIN calendar_source_connection c ON c.source_id=s.id JOIN calendar a ON a.id=s.calendar_id
            WHERE j.source_id=$1 AND j.lease_token=$2 AND j.generation=$3 AND s.version=$4 AND c.url=$5
            AND j.lease_until>now() AND c.deleted_at IS NULL AND s.deleted_at IS NULL AND a.deleted_at IS NULL`,
                [claim.source_id, claim.lease_token, claim.generation, claim.version, claim.url],
            )
        ).rowCount
    }
    private async bindDependency(claim: Claim, shareId: string) {
        await this.calendar.transaction(async (db) => {
            const upstream = (await db.query('SELECT calendar_id FROM calendar_share WHERE id=$1', [shareId])).rows[0]
            if (!upstream) throw new Error('A megosztási link nem érhető el.')
            const cycle = await db.query(
                `WITH RECURSIVE chain(calendar_id,path) AS (
                SELECT $1::text,ARRAY[$1::text] UNION ALL
                SELECT sh.calendar_id,path||sh.calendar_id FROM chain t JOIN calendar_source s ON s.calendar_id=t.calendar_id AND s.deleted_at IS NULL
                JOIN calendar_subscription_job j ON j.source_id=s.id JOIN calendar_share sh ON sh.id=j.upstream_share_id
                WHERE NOT sh.calendar_id=ANY(path) AND cardinality(path)<16)
                SELECT 1 FROM chain WHERE calendar_id=$2 OR cardinality(path)>=16 LIMIT 1`,
                [upstream.calendar_id, claim.calendar_id],
            )
            if (cycle.rowCount) throw new Error('A naptármegosztások körkörös vagy túl hosszú láncot alkotnak.')
            await db.query(
                'UPDATE calendar_subscription_job SET upstream_share_id=$2 WHERE source_id=$1 AND lease_token=$3',
                [claim.source_id, shareId, claim.lease_token],
            )
        })
    }
    private async publish(db: Query, claim: Claim, events: ReturnType<typeof subscriptionEvent>[]) {
        const existing = (await db.query('SELECT * FROM calendar_event WHERE source_id=$1', [claim.source_id])).rows
        const byUid = new Map(existing.map((row) => [row.external_uid, row]))
        const keys = new Set(events.map((row) => row.externalUid))
        let added = 0,
            changed = 0,
            removed = 0
        for (const event of events) {
            const old = byUid.get(event.externalUid)
            if (!old) {
                await this.calendar.create(db, claim.owner_user_id, 'events', {
                    ...event,
                    calendarId: claim.calendar_id,
                    sourceId: claim.source_id,
                })
                added++
                continue
            }
            const previous = encodeRow('events', old)
            const fields = Object.fromEntries(Object.entries(event).filter(([key]) => key !== 'externalUid'))
            if (!old.deleted_at && Object.entries(fields).every(([key, value]) => previous[key] === value)) continue
            if (old.deleted_at) await db.query('UPDATE calendar_event SET deleted_at=NULL WHERE id=$1', [old.id])
            const version = (await db.query('SELECT version FROM calendar_event WHERE id=$1', [old.id])).rows[0].version
            await this.calendar.update(db, claim.owner_user_id, 'events', old.id, { ...fields, version })
            changed++
        }
        for (const old of existing)
            if (!old.deleted_at && !keys.has(old.external_uid)) {
                await this.calendar.remove(db, claim.owner_user_id, 'events', old.id, { version: old.version })
                removed++
            }
        return added || changed || removed ? `Új: ${added}, módosult: ${changed}, törölt: ${removed} alkalom.` : ''
    }
}
