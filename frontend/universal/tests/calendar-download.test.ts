import assert from 'node:assert/strict';
import { test } from 'node:test';
import { downloadNeptunCalendar, neptunCalendarUrl } from '../../src/lib/calendar-import';
import { readCalendarResponse, MAX_CALENDAR_BYTES } from '../src/data/calendar-response';

const feed = 'https://neptun.uni-obuda.hu/ujhallgato/api/Calendar/CalendarExportFileToSyncronization?id=1234567890abcdef.ics';
const valid = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n';

test('server import accepts only the exact HTTPS Neptun export and never follows redirects', async t => {
  assert.equal(neptunCalendarUrl(feed), feed);
  for (const url of [feed.replace('https:', 'http:'), feed.replace('neptun.uni-obuda.hu', 'localhost'), feed.replace('neptun.uni-obuda.hu', 'neptun.uni-obuda.hu.evil.test'), feed.replace('/ujhallgato/', '/admin/'), feed + '&redirect=elsewhere', feed + '#fragment', feed.replace('https://', 'https://user:secret@'), feed.replace('.hu/', '.hu:444/')]) {
    assert.throws(() => neptunCalendarUrl(url));
  }
  t.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
    assert.equal(_url, feed); assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store');
    assert.equal(options.credentials, 'omit');
    return new Response(valid);
  });
  assert.equal(await downloadNeptunCalendar(feed), valid);
});

test('native and server readers explain revoked links and reject oversized streamed feeds', async () => {
  await assert.rejects(readCalendarResponse(new Response(JSON.stringify({ notification: [{ description: 'korábbiak érvényüket vesztették' }] }), { status: 500 })), /már érvénytelen/);
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MAX_CALENDAR_BYTES + 1)); controller.close(); } });
  await assert.rejects(readCalendarResponse(new Response(stream)), /5 MB/);
  await assert.rejects(readCalendarResponse(new Response('<html>login</html>')), /ICS/);
});
