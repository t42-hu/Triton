import assert from 'node:assert/strict'
import test from 'node:test'
import ICAL from 'ical.js'
import { shareSignature, validShareSignature, CalendarSharing } from '../dist/calendar/calendar-sharing.js'
import { serializeSharedCalendar } from '../dist/calendar/shared-calendar-ics.js'
import { safeRequestPath } from '../dist/observability/logger.js'
import { CalendarResourceSchemas, CalendarShareSelectionSchema } from '@fullstack-starter/shared'

test('work is a persistable event category and can be selected alongside all other share categories', () => {
    assert.equal(CalendarResourceSchemas.events.parse({ calendarId: 'calendar', title: 'Műszak', category: 'work' }).category, 'work')
    const categories = ['lesson', 'event', 'work', 'assignment', 'test', 'exam']
    assert.deepEqual(CalendarShareSelectionSchema.parse({ sourceIds: [], includeManual: true, categories }).categories, categories)
})

test('share signatures cannot be reused on another link or forged with another secret', () => {
    const token = shareSignature('link-a', 'secret-a')
    assert.ok(validShareSignature('link-a', token, 'secret-a'))
    assert.equal(validShareSignature('link-b', token, 'secret-a'), false)
    assert.equal(validShareSignature('link-a', token, 'secret-b'), false)
    for (const forged of ['', token.slice(1), '!'.repeat(43), token + 'x']) assert.equal(validShareSignature('link-a', forged, 'secret-a'), false)
    assert.equal(safeRequestPath(`/api/calendar-share/id/${token}/calendar.ics`), '/api/calendar-share/id/[redacted]/calendar.ics')
})
test('shared ICS preserves Unicode, escapes text injection and retains exclusive all-day dates and stable UIDs', () => {
    const event = { id: 'event', category: 'lesson', title: 'Árvíztűrő '.repeat(20)+'\nBEGIN:VEVENT', location: 'A;B,C', notes: 'Notes\\more\r\nline', kind: 'timed', starts_at: new Date('2026-10-09T08:00Z'), ends_at: new Date('2026-10-09T09:00Z'), start_date: null, end_date: null }
    const content = serializeSharedCalendar('Órarend', [event, { ...event, id: 'day', kind: 'allDay', starts_at: null, ends_at: null, start_date: '2026-10-10', end_date: '2026-10-11' }])
    assert.ok(content.split('\r\n').every(line => Buffer.byteLength(line) <= 75))
    const parsed = new ICAL.Component(ICAL.parse(content))
    const events = parsed.getAllSubcomponents('vevent')
    assert.equal(events.length, 2)
    assert.equal(events[0].getFirstPropertyValue('summary'), event.title)
    assert.equal(events[0].getFirstPropertyValue('description'), event.notes.replace(/\r\n/g,'\n'))
    assert.equal(events[0].getFirstPropertyValue('location'), event.location)
    assert.equal(events[1].getFirstPropertyValue('dtend').toString(), '2026-10-11')
    assert.equal(events[0].getFirstPropertyValue('uid'), 'event@triton42.hu')
})
test('invalid share tokens are rejected before querying the database', async () => {
    const previous = process.env.BETTER_AUTH_SECRET
    process.env.BETTER_AUTH_SECRET = 'x'.repeat(32)
    try {
        const sharing = new CalendarSharing({ transaction() { throw new Error('Must not query') } })
        await assert.rejects(async () => sharing.download('id', 'forged'), { status: 404 })
    } finally { if (previous === undefined) delete process.env.BETTER_AUTH_SECRET; else process.env.BETTER_AUTH_SECRET = previous }
})
