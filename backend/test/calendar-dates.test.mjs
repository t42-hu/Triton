import assert from 'node:assert/strict'
import { test } from 'node:test'
import { encodeRow } from '../dist/calendar/calendar.catalog.js'

test('calendar coverage dates stay plain dates across server time zones while timestamps stay instants', () => {
    const previous = process.env.TZ
    try {
        for (const timezone of ['UTC', 'Europe/Budapest', 'America/Los_Angeles']) {
            process.env.TZ = timezone
            const result = encodeRow('sources', {
                coverage_from: new Date(2026, 8, 7),
                coverage_to: new Date(2026, 11, 20),
                created_at: new Date('2026-09-07T10:30:00.000Z'),
            })
            assert.equal(result.coverageFrom, '2026-09-07')
            assert.equal(result.coverageTo, '2026-12-20')
            assert.equal(result.createdAt, '2026-09-07T10:30:00.000Z')
        }
    } finally {
        if (previous === undefined) delete process.env.TZ
        else process.env.TZ = previous
    }
})
