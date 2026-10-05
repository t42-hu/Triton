import assert from 'node:assert/strict';
import { test } from 'node:test';
import ICAL from 'ical.js';
import { exportCalendar, foldCalendarLine } from '../src/domain/calendar-export';
import type { DisplayEvent } from '../src/domain/model';
import { fromWall } from '../src/domain/time';

function event(patch: Partial<DisplayEvent> = {}): DisplayEvent {
  return { key: 'one', title: 'Árvíz, tűz; próba\\óra', originalTitle: 'original', kind: 'timed', start: fromWall('2026-10-25T08:00'), end: fromWall('2026-10-25T09:00'), location: 'Terem', sourceId: 'test', profileId: 1, hidden: 0, base: '{}', patch: null, notes: 'Első\nMásodik', ...patch };
}
test('export roundtrip preserves effective text, UTC times and exclusive all-day dates', () => {
  const timed = event(); const allDay = event({ key: 'day', kind: 'allDay', start: fromWall('2026-10-25'), end: fromWall('2026-10-26') });
  const output = exportCalendar({ id: 1, name: 'Me', isOwn: 1 }, [timed, allDay, event({ key: 'hidden', hidden: 1 })], 0);
  const calendar = new ICAL.Component(ICAL.parse(output)); const items = calendar.getAllSubcomponents('vevent');
  assert.equal(items.length, 2);
  const exported = new ICAL.Event(items[0]);
  assert.equal(exported.summary, timed.title); assert.equal(exported.description, timed.notes);
  assert.equal(exported.startDate.toJSDate().getTime(), timed.start);
  assert.equal(items[1].getFirstPropertyValue('dtstart')?.toString(), '2026-10-25');
  assert.equal(items[1].getFirstPropertyValue('dtend')?.toString(), '2026-10-26');
});
test('folded lines meet the byte limit with Hungarian text and emoji', () => {
  const line = 'SUMMARY:' + 'Árvíztűrő🙂'.repeat(40);
  const folded = foldCalendarLine(line);
  assert.equal(folded.replace(/\r\n /g, ''), line);
  for (const part of folded.split('\r\n')) assert.ok(Buffer.byteLength(part) <= 75);
});

test('Triton reimport retains an assessment category even with an arbitrary title', async () => {
  const { expandIcs } = await import('../src/domain/ics-import');
  const output = exportCalendar({ id: 1, name: 'Me', isOwn: 1 }, [event({ title: 'Homework', category: 'assignment' })]);
  const results = [];
  for await (const occurrence of expandIcs(output, { from: '2026-10-01', to: '2026-10-31' }, { signal: new AbortController().signal, progress: () => undefined })) results.push(occurrence);
  assert.equal(results[0]?.category, 'assignment');
});
