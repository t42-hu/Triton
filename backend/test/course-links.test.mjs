import assert from 'node:assert/strict'
import test from 'node:test'
import { CalendarService } from '../dist/calendar/calendar.service.js'

test('course-link conflicts are scoped to the account, profile, and course', async () => {
    const service = new CalendarService({})
    const calls = []
    const db = {
        query: async (sql, parameters) => {
            calls.push({ sql, parameters })
            return { rows: [{ id: 'existing' }] }
        },
    }
    await assert.rejects(
        service.ensureSingleCourseLink(db, 'account', { profileId: 'profile', subjectKey: 'lms:physics' }),
        { status: 409 },
    )
    assert.deepEqual(calls[0].parameters, ['account', 'profile', 'lms:physics', null])
    assert.match(calls[0].sql, /deleted_at IS NULL/)
    await service.ensureSingleCourseLink(db, 'account', { profileId: 'profile', subjectKey: 'physics' })
    assert.equal(calls.length, 1)
    await service.ensureSingleCourseLink(
        { query: async () => ({ rows: [] }) },
        'account',
        { profileId: 'profile', subjectKey: 'lms:physics' },
        'edited-link',
    )
})
