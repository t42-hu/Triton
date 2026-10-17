import assert from 'node:assert/strict'
import test from 'node:test'
import { publicCalendarAddress, subscriptionUrl } from '../dist/calendar/calendar-download.js'
import { internalCalendarShare, subscriptionEvent } from '../dist/calendar/calendar-subscriptions.js'
import { expandIcs } from '@fullstack-starter/shared/calendar-import'
import { RateLimitService } from '../dist/rate-limit/rate-limit.service.js'
import { CacheService } from '../dist/cache/cache.service.js'

test('calendar downloader rejects nonpublic destinations and credential-bearing URLs', () => {
    for (const address of [
        '127.0.0.1',
        '10.1.2.3',
        '172.16.0.1',
        '192.168.1.1',
        '169.254.169.254',
        '100.64.0.1',
        '0.0.0.0',
        '224.0.0.1',
        '::1',
        '::ffff:127.0.0.1',
        'fc00::1',
        'fe80::1',
        '2001:db8::1',
        '2002:7f00:1::',
    ])
        assert.equal(publicCalendarAddress(address), false, address)
    for (const address of ['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111'])
        assert.equal(publicCalendarAddress(address), true, address)
    for (const url of ['http://example.com', 'https://user:pass@example.com', 'https://example.com:8443'])
        assert.throws(() => subscriptionUrl(url))
    assert.equal(subscriptionUrl('webcal://example.com/calendar.ics#x').href, 'https://example.com/calendar.ics')
    assert.equal(internalCalendarShare('https://other.test/api/calendar-share/a/b/calendar.ics'), null)
})
test('shared parser accepts a complete empty calendar and rejects truncated and malformed replacements', async () => {
    const range = { from: '2026-10-01', to: '2026-10-31' },
        control = { signal: new AbortController().signal, progress: () => {} }
    const collect = async (content) => {
        const result = []
        for await (const item of expandIcs(content, range, control)) result.push(item)
        return result
    }
    assert.deepEqual(await collect('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n'), [])
    await assert.rejects(collect('BEGIN:VCALENDAR\r\nVERSION:2.0'))
    await assert.rejects(collect('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:bad\r\nEND:VEVENT\r\nEND:VCALENDAR'))
    const [event] = await collect(
        'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:shift-1@wagetrackr.eu\r\nDTSTART:20261016T080000Z\r\nDTEND:20261016T090000Z\r\nSUMMARY:Munka\r\nEND:VEVENT\r\nEND:VCALENDAR',
    )
    assert.equal(event.category, 'work')
    assert.equal(subscriptionEvent(event).startsAt, '2026-10-16T08:00:00.000Z')
})
test('calendar-download fallback stays bounded while authentication paths retain Redis failures', async () => {
    const service = new RateLimitService({
        consumeRollingWindow: async () => {
            throw Error('MISCONF')
        },
    })
    for (let i = 0; i < 120; i++) assert.equal((await service.consume('calendar', true)).allowed, true)
    assert.equal((await service.consume('calendar', true)).allowed, false)
    await assert.rejects(service.consume('auth'), /MISCONF/)
})
test('readiness detects AOF failures even when PING responds successfully', async () => {
    const health = CacheService.prototype.health
    await assert.rejects(
        health.call({ client: { ping: async () => 'PONG', info: async () => 'aof_last_write_status:err\r\n' } }),
        /persistence/,
    )
    await health.call({
        client: {
            ping: async () => 'PONG',
            info: async () => 'aof_last_write_status:ok\r\nrdb_last_bgsave_status:ok\r\n',
        },
    })
})
