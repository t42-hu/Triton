import assert from 'node:assert/strict';
import { test } from 'node:test';
import { expandIcs } from '../src/domain/ics-import';
import { expandJson, parseJson } from '../src/domain/json-import';
import { addDays, fromWall, monday, wallTime, weekAt } from '../src/domain/time';
import { commonKeys, eventIdentity, patchForTarget } from '../src/domain/comparison';
import { dayLayout } from '../src/features/calendar-layout';
import type { DisplayEvent, Occurrence } from '../src/domain/model';

const range = { from: '2026-09-01', to: '2026-12-31' };
const anchor = { date: '2026-09-07', week: 'A' as const };
const control = () => ({ signal: new AbortController().signal, progress: () => undefined });
async function collect(generator: AsyncGenerator<Occurrence>) { const values: Occurrence[] = []; for await (const item of generator) values.push(item); return values; }
function calendar(body: string) { return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR`; }
function event(fields: string) { return `BEGIN:VEVENT\r\n${fields}\r\nEND:VEVENT`; }
const base = 'UID:course\r\nSUMMARY:Analysis\r\nLOCATION:A1\r\nDTSTART:20260907T060000Z\r\nDTEND:20260907T073000Z';
const jsonEvent = { id: 'course', title: 'Analízis', kind: 'timed', start: '2026-10-19T08:00:00+02:00', end: '2026-10-19T09:30:00+02:00', location: 'A1', recurrence: { frequency: 'weekly', weeks: 'all', until: '2026-11-09' } };
function json(events: unknown[]) { return JSON.stringify({ version: 1, events }); }
function display(item: Occurrence): DisplayEvent { return { ...item, sourceId: '1', profileId: 1, hidden: 0, base: JSON.stringify(item), patch: null }; }

test('Budapest conversion and A/B weeks do not drift across DST or year boundaries', () => {
  assert.equal(wallTime(fromWall('2026-10-26T08:00')), '2026-10-26T08:00:00');
  assert.equal(fromWall('2026-03-30') - fromWall('2026-03-29'), 23 * 3600000);
  assert.throws(() => fromWall('2026-03-29T02:30'));
  assert.equal(monday('2026-09-13'), '2026-09-07');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(weekAt('2026-09-14', anchor), 'B');
});
test('weekly JSON keeps wall clock times over DST and supports A-only recurrence', async () => {
  const events = await collect(expandJson(json([jsonEvent]), range, anchor, control()));
  assert.equal(events.length, 4); assert.ok(events.every(item => wallTime(item.start).slice(11, 16) === '08:00'));
  const alternate = await collect(expandJson(json([{ ...jsonEvent, recurrence: { ...jsonEvent.recurrence, weeks: 'A' } }]), range, anchor, control()));
  assert.equal(alternate.length, 2);
});
test('JSON rejects duplicate IDs, invalid dates and malformed values', () => {
  assert.throws(() => parseJson(json([jsonEvent, jsonEvent])));
  assert.throws(() => parseJson(json([{ ...jsonEvent, start: '2026-02-30T08:00:00Z' }])));
  assert.throws(() => parseJson(json([{ ...jsonEvent, end: jsonEvent.start }])));
  assert.throws(() => parseJson(json([{ ...jsonEvent, start: '2026-10-19T24:00:00Z' }])));
});
test('ICS handles RRULE EXDATE and a moved RECURRENCE-ID with stable identity', async () => {
  const master = event(`${base}\r\nRRULE:FREQ=WEEKLY;COUNT=4\r\nEXDATE:20260914T060000Z`);
  const moved = event('UID:course\r\nRECURRENCE-ID:20260921T060000Z\r\nSUMMARY:Analysis\r\nLOCATION:B2\r\nDTSTART:20260922T080000Z\r\nDTEND:20260922T093000Z');
  const events = await collect(expandIcs(calendar(master + '\r\n' + moved), range, control()));
  assert.equal(events.length, 3); assert.equal(events[1].location, 'B2'); assert.match(events[1].key, /2026-09-21/);
});
test('ICS all-day exclusive end, floating time and multi-day events', async () => {
  const content = calendar(event('UID:holiday\r\nSUMMARY:Szünet\r\nDTSTART;VALUE=DATE:20260910\r\nDTEND;VALUE=DATE:20260913') + '\r\n' + event('UID:floating\r\nSUMMARY:Meeting\r\nDTSTART:20260907T080000\r\nDTEND:20260908T090000'));
  const events = await collect(expandIcs(content, range, control()));
  assert.equal(events[0].kind, 'allDay'); assert.equal(wallTime(events[0].end).slice(0, 10), '2026-09-13');
  assert.equal(wallTime(events[1].start).slice(11, 16), '08:00');
});
test('canceled imports abort rather than return partial success', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(collect(expandJson(json([jsonEvent]), range, anchor, { signal: controller.signal, progress: () => undefined })), /megszakítva/);
});
test('common events use effective values and ignore hidden events and unknown rooms', async () => {
  const [item] = await collect(expandIcs(calendar(event(base)), range, control()));
  const first = display(item); const second = { ...first, sourceId: '2' };
  assert.equal(commonKeys([first], [second]).size, 1);
  assert.equal(commonKeys([first], [{ ...second, location: 'B' }]).size, 0);
  assert.equal(commonKeys([first], [{ ...second, hidden: 1 }]).size, 0);
  assert.equal(commonKeys([{ ...first, location: '' }], [{ ...second, location: '' }]).size, 0);
  assert.equal(commonKeys([first], [{ ...second, kind: 'allDay' }]).size, 1);
  assert.notEqual(eventIdentity({ sourceId: 'ab', key: 'c' }), eventIdentity({ sourceId: 'a', key: 'bc' }));
});
test('bulk edits retain dates; overlapping events occupy separate lanes', async () => {
  const [item] = await collect(expandIcs(calendar(event(base)), range, control()));
  const first = display(item); const target = { ...first, start: fromWall('2026-09-14T08:00'), end: fromWall('2026-09-14T09:30') };
  const patch = patchForTarget({ start: fromWall('2026-09-07T10:00'), end: fromWall('2026-09-07T11:30') }, target);
  assert.equal(wallTime(patch.start!), '2026-09-14T10:00:00');
  const overnight = patchForTarget({ end: fromWall('2026-09-07T11:30') }, { ...target, end: fromWall('2026-09-15T09:30') });
  assert.equal(wallTime(overnight.end!), '2026-09-15T11:30:00');
  const positioned = dayLayout([first, { ...first, key: 'second' }], '2026-09-07');
  assert.equal(positioned[0].lanes, 2); assert.equal(positioned[1].lane, 1);
});
test('ICS RDATE periods keep their explicit durations', async () => {
  const body = event(`${base}\r\nRDATE;VALUE=PERIOD:20260908T060000Z/PT3H`);
  const items = await collect(expandIcs(calendar(body), range, control()));
  assert.equal(items.length, 2); assert.equal(items[1].end - items[1].start, 3 * 3600000);
});
test('moved exceptions outside the original window remain visible and canceled occurrences disappear', async () => {
  const master = event(`${base}\r\nRRULE:FREQ=WEEKLY;COUNT=4`);
  const moved = event('UID:course\r\nRECURRENCE-ID:20260928T060000Z\r\nSUMMARY:Moved\r\nDTSTART:20260908T080000Z\r\nDTEND:20260908T093000Z');
  const canceled = event('UID:course\r\nRECURRENCE-ID:20260914T060000Z\r\nSUMMARY:Canceled\r\nSTATUS:CANCELLED\r\nDTSTART:20260914T060000Z\r\nDTEND:20260914T073000Z');
  const items = await collect(expandIcs(calendar([master,moved,canceled].join('\r\n')), { from: '2026-09-01', to: '2026-09-15' }, control()));
  assert.equal(items.length, 2); assert.equal(items[1].title, 'Moved');
});

test('invalid out-of-range ICS masters also reject the entire import', async () => {
  const invalid = calendar(event('UID:bad\r\nDTSTART:20270907T080000Z\r\nRRULE:FREQ=WEEKLY;COUNT=2'));
  await assert.rejects(collect(expandIcs(invalid, range, control())), /eseménynév/);
});
test('embedded VTIMEZONE keeps recurring Budapest local hours across DST', async () => {
  const zone = ['BEGIN:VTIMEZONE', 'TZID:Europe/Budapest', 'BEGIN:DAYLIGHT', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'END:DAYLIGHT', 'BEGIN:STANDARD', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'END:STANDARD', 'END:VTIMEZONE'].join('\r\n');
  const body = event('UID:zoned\r\nSUMMARY:Zoned\r\nDTSTART;TZID=Europe/Budapest:20261019T080000\r\nDTEND;TZID=Europe/Budapest:20261019T093000\r\nRRULE:FREQ=WEEKLY;COUNT=3');
  const items = await collect(expandIcs(calendar(zone + '\r\n' + body), range, control()));
  assert.equal(items.length, 3); assert.ok(items.every(item => wallTime(item.start).slice(11, 16) === '08:00'));
  await assert.rejects(collect(expandIcs(calendar(body), range, control())), /VTIMEZONE/);
});
