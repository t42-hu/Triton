import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

/** Runs against real PostgreSQL, alongside the existing migration/payment tests. */
export async function verifyCalendarSchema(pool) {
    const reject = (query, code = '23514') => assert.rejects(pool.query(query), (error) => error.code === code)
    const row = async (query) => (await pool.query(query)).rows[0]
    await pool.query(`INSERT INTO "user" (id,name,email,created_at,updated_at) VALUES
        ('schema_owner','Owner','schema-owner@example.test',now(),now()),
        ('schema_guest','Guest','schema-guest@example.test',now(),now())`)
    await reject(
        `INSERT INTO "user" (id,name,email,created_at,updated_at) VALUES ('duplicate_email','Other','SCHEMA-OWNER@example.test',now(),now())`,
        '23505',
    )
    await pool.query(
        `INSERT INTO calendar(id,owner_user_id,name) VALUES ('schema_cal','schema_owner','Shared'),('schema_other_cal','schema_guest','Other')`,
    )
    await pool.query(
        `INSERT INTO calendar_member(id,calendar_id,user_id,role) VALUES ('schema_membership','schema_cal','schema_guest','busy_only')`,
    )
    await reject(
        `INSERT INTO calendar_member(calendar_id,user_id,role) VALUES ('schema_cal','schema_guest','editor')`,
        '23505',
    )
    await reject(
        `INSERT INTO calendar_member(calendar_id,user_id,role) VALUES ('schema_other_cal','schema_owner','invalid')`,
    )
    await reject(
        `INSERT INTO calendar_invitation(calendar_id,invited_by_user_id,token_hash,expires_at) VALUES ('schema_cal','schema_owner','token',now()+interval '1 day')`,
    )
    await pool.query(
        `INSERT INTO calendar_source(id,calendar_id,name,format,coverage_from,coverage_to) VALUES ('schema_source','schema_cal','Import','ics','2026-10-01','2026-12-31')`,
    )
    await pool.query(
        `INSERT INTO calendar_source_connection(id,source_id,url,auto_sync) VALUES ('schema_connection','schema_source','https://example.test/private.ics?token=secret',true)`,
    )
    await pool.query(
        `INSERT INTO calendar_source_revision(id,source_id,content_hash,storage_key,is_current) VALUES ('schema_revision','schema_source','hash','private/source.ics',true)`,
    )
    await reject(
        `INSERT INTO calendar_source_revision(source_id,content_hash,storage_key,is_current) VALUES ('schema_source','other','private/other.ics',true)`,
        '23505',
    )
    await pool.query(`INSERT INTO calendar_event(id,calendar_id,source_id,external_uid,title,notes,color,starts_at,ends_at)
        VALUES ('schema_event','schema_cal','schema_source','stable-ics-uid','Meeting','Shared note','#facc15','2026-10-08T08:00:00Z','2026-10-08T09:00:00Z')`)
    await reject(
        `INSERT INTO calendar_event(calendar_id,source_id,title,starts_at,ends_at) VALUES ('schema_other_cal','schema_source','Wrong source',now(),now()+interval '1 hour')`,
        '23503',
    )
    await reject(
        `INSERT INTO calendar_event(calendar_id,title,starts_at,ends_at) VALUES ('schema_cal','Bad interval',now(),now())`,
    )
    await reject(
        `INSERT INTO calendar_event(calendar_id,title,kind,start_date,end_date) VALUES ('schema_cal','Bad dates','allDay','2026-10-08','2026-10-08')`,
    )
    await pool.query(
        `INSERT INTO calendar_event(id,calendar_id,title,kind,start_date,end_date) VALUES ('schema_all_day','schema_cal','All day','allDay','2026-10-08','2026-10-09')`,
    )
    await pool.query(
        `INSERT INTO event_recurrence(event_id,rule,week_pattern,anchor_date,anchor_week) VALUES ('schema_event','FREQ=WEEKLY;INTERVAL=2','A','2026-10-05','A')`,
    )
    await pool.query(
        `INSERT INTO event_exception(event_id,occurrence_key,title,starts_at,ends_at) VALUES ('schema_event','2026-10-22T08:00:00Z','Moved','2026-10-22T10:00:00Z','2026-10-22T11:00:00Z')`,
    )
    await reject(`INSERT INTO event_exception(event_id,occurrence_key,starts_at) VALUES ('schema_event','bad',now())`)
    await pool.query(
        `INSERT INTO event_attachment(id,event_id,kind,name,url) VALUES ('schema_link','schema_event','link','Shared document','https://example.test/document')`,
    )
    await pool.query(
        `INSERT INTO event_attachment(id,event_id,kind,name,storage_key,mime_type,size_bytes) VALUES ('schema_file','schema_event','file','Document.pdf','events/document.pdf','application/pdf',1024)`,
    )
    await reject(`INSERT INTO event_attachment(event_id,kind,name) VALUES ('schema_event','link','Missing URL')`)
    await reject(
        `INSERT INTO event_attachment(event_id,kind,name,url) VALUES ('schema_event','link','Invalid URL','javascript:alert(1)')`,
    )
    await reject(
        `INSERT INTO event_attachment(event_id,kind,name,storage_key,mime_type,size_bytes) VALUES ('schema_event','file','Bad file','file','text/plain',-1)`,
    )
    await pool.query(
        `INSERT INTO meeting(id,event_id,organizer_user_id,status) VALUES ('schema_meeting','schema_event','schema_owner','published')`,
    )
    await pool.query(
        `INSERT INTO meeting_participant(id,meeting_id,user_id) VALUES ('schema_participant','schema_meeting','schema_guest')`,
    )
    await reject(
        `INSERT INTO meeting_participant(meeting_id,user_id,response) VALUES ('schema_meeting','schema_guest','accepted')`,
        '23505',
    )
    await pool.query(
        `INSERT INTO user_event_override(id,user_id,event_id,notes) VALUES ('schema_private_note','schema_guest','schema_event','Private note')`,
    )
    await pool.query(
        `INSERT INTO user_task(id,user_id,event_id,title,due_at) VALUES ('schema_task','schema_guest','schema_event','Prepare',now())`,
    )
    await pool.query(
        `INSERT INTO user_notebook_link(user_id,event_id,title,url) VALUES ('schema_guest','schema_event','Private link','https://example.test/private')`,
    )
    await pool.query(`INSERT INTO user_reminder_setting(user_id,enabled) VALUES ('schema_guest',true)`)
    await pool.query(
        `INSERT INTO user_reminder_rule(user_id,event_id,minutes) VALUES ('schema_guest','schema_event',20)`,
    )
    await reject(
        `INSERT INTO user_reminder_rule(user_id,event_id,minutes) VALUES ('schema_guest','schema_event',20)`,
        '23505',
    )
    await reject(`INSERT INTO user_reminder_rule(user_id,minutes) VALUES ('schema_guest',0)`)
    await pool.query(
        `INSERT INTO user_color_preset(id,user_id,name) VALUES ('schema_palette','schema_guest','My colors')`,
    )
    await pool.query(
        `INSERT INTO user_color_preset_color(user_id,preset_id,role,color) VALUES ('schema_guest','schema_palette','primary','#aabbcc')`,
    )
    await reject(
        `INSERT INTO user_color_preset_color(user_id,preset_id,role,color) VALUES ('schema_owner','schema_palette','secondary','#aabbcc')`,
        '23503',
    )
    await reject(`INSERT INTO user_color_rule(user_id,scope,target_key) VALUES ('schema_guest','occurrence','bad')`)
    await pool.query(
        `INSERT INTO user_color_rule(user_id,scope,target_key,event_id,color) VALUES ('schema_guest','event','schema_event','schema_event','#aabbcc')`,
    )
    await pool.query(`INSERT INTO user_preference(user_id,theme) VALUES ('schema_guest','system')`)
    await pool.query(
        `INSERT INTO schedule_profile(id,user_id,name,is_own) VALUES ('schema_profile','schema_guest','Me',true)`,
    )
    await reject(`INSERT INTO schedule_profile(user_id,name,is_own) VALUES ('schema_guest','Another me',true)`, '23505')
    await reject(
        `INSERT INTO schedule_profile_calendar(user_id,profile_id,calendar_id) VALUES ('schema_owner','schema_profile','schema_cal')`,
        '23503',
    )
    await pool.query(
        `INSERT INTO user_device(id,user_id,installation_id,platform) VALUES ('schema_device','schema_guest','installation','android')`,
    )
    await pool.query(`INSERT INTO user_device_preference(user_id,device_id) VALUES ('schema_guest','schema_device')`)
    await reject(`INSERT INTO sync_cursor(device_id,user_id) VALUES ('schema_device','schema_owner')`, '23503')
    await pool.query(`INSERT INTO sync_cursor(device_id,user_id) VALUES ('schema_device','schema_guest')`)
    await pool.query(
        `INSERT INTO sync_mutation(user_id,device_id,client_mutation_id,request_hash,result) VALUES ('schema_guest','schema_device','request','hash','{}')`,
    )
    await reject(
        `INSERT INTO sync_mutation(user_id,device_id,client_mutation_id,request_hash,result) VALUES ('schema_guest','schema_device','request','hash','{}')`,
        '23505',
    )
    console.log('PASS calendar/event/attachment/meeting/color/device constraints and ownership')

    assert.deepEqual(
        await row(`SELECT user_id,calendar_id,event_id FROM sync_change WHERE entity_id='schema_private_note'`),
        { user_id: 'schema_guest', calendar_id: null, event_id: null },
    )
    assert.equal(
        (await row(`SELECT user_id FROM sync_change WHERE entity_id='schema_connection'`)).user_id,
        'schema_owner',
    )
    assert.equal(
        (await row(`SELECT calendar_id FROM sync_change WHERE entity_id='schema_event' ORDER BY sequence DESC LIMIT 1`))
            .calendar_id,
        'schema_cal',
    )
    assert.equal((await row(`SELECT event_id FROM sync_change WHERE entity_id='schema_link'`)).event_id, 'schema_event')
    assert.deepEqual(
        await row(`SELECT event_id,affected_user_id FROM sync_change WHERE entity_id='schema_participant'`),
        { event_id: 'schema_event', affected_user_id: 'schema_guest' },
    )
    const before = await row(`SELECT version,created_at FROM calendar_event WHERE id='schema_event'`)
    const updated = (
        await pool.query(
            `UPDATE calendar_event SET title='Updated',version=999 WHERE id='schema_event' AND version=$1 RETURNING version,created_at`,
            [before.version],
        )
    ).rows[0]
    assert.equal(updated.version, before.version + 1)
    assert.deepEqual(updated.created_at, before.created_at)
    assert.equal(
        (
            await pool.query(`UPDATE calendar_event SET title='Stale' WHERE id='schema_event' AND version=$1`, [
                before.version,
            ])
        ).rowCount,
        0,
    )
    await reject(`UPDATE calendar_event SET calendar_id='schema_other_cal' WHERE id='schema_event'`)
    await pool.query(`UPDATE calendar_member SET deleted_at=now() WHERE id='schema_membership'`)
    assert.deepEqual(
        await row(
            `SELECT operation,affected_user_id FROM sync_change WHERE entity_id='schema_membership' ORDER BY sequence DESC LIMIT 1`,
        ),
        { operation: 'delete', affected_user_id: 'schema_guest' },
    )
    console.log('PASS shared/private change scopes, revocation notices and optimistic versions')

    const client = await pool.connect()
    try {
        await client.query('BEGIN')
        await client.query(`UPDATE calendar_event SET notes='Rolled back' WHERE id='schema_event'`)
        await client.query('ROLLBACK')
        assert.equal((await row(`SELECT notes FROM calendar_event WHERE id='schema_event'`)).notes, 'Shared note')
        assert.equal((await row(`SELECT count(*)::int n FROM sync_change WHERE entity_id='schema_event'`)).n, 2)
    } finally {
        client.release()
    }
    console.log('PASS data and change-log rollback are atomic')

    const first = await pool.connect(),
        second = await pool.connect()
    try {
        await first.query('BEGIN')
        await first.query(`UPDATE calendar_event SET notes='First transaction' WHERE id='schema_event'`)
        const firstSeq = (await first.query(`SELECT max(sequence)::text seq FROM sync_change`)).rows[0].seq
        await second.query('BEGIN')
        let secondFinished = false
        const blockedWrite = second.query(
            `UPDATE calendar_event SET notes='Second transaction' WHERE id='schema_all_day'`,
        )
        blockedWrite.then(() => {
            secondFinished = true
        })
        await delay(30)
        assert.equal(secondFinished, false, 'a later writer must wait for the first transaction to commit')
        await first.query('COMMIT')
        await blockedWrite
        await second.query('COMMIT')
        assert.ok(BigInt((await row(`SELECT max(sequence)::text seq FROM sync_change`)).seq) > BigInt(firstSeq))
    } finally {
        await first.query('ROLLBACK')
        await second.query('ROLLBACK')
        first.release()
        second.release()
    }
    console.log('PASS concurrent writes produce commit-ordered sync positions')

    await pool.query(`DELETE FROM calendar WHERE id='schema_cal'`)
    assert.equal((await row(`SELECT count(*)::int n FROM calendar_event WHERE calendar_id='schema_cal'`)).n, 0)
    assert.equal((await row(`SELECT count(*)::int n FROM event_attachment WHERE event_id='schema_event'`)).n, 0)
    assert.equal((await row(`SELECT event_id FROM user_task WHERE id='schema_task'`)).event_id, null)
    assert.equal(
        (await row(`SELECT operation FROM sync_change WHERE entity_id='schema_cal' ORDER BY sequence DESC LIMIT 1`))
            .operation,
        'delete',
    )
    console.log('PASS physical cascade preserves deletion notices and detached personal tasks')
    await pool.query(`DELETE FROM "user" WHERE id IN ('schema_owner','schema_guest')`)
}
