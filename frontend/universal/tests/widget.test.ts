import { test } from 'node:test';
import assert from 'node:assert/strict';
import { widgetAgenda, widgetBoundaries, widgetClockAnchor, widgetData } from '../src/domain/widget';
import { fromWall } from '../src/domain/time';
import type { DisplayEvent } from '../src/domain/model';

const at = (time: string) => fromWall(`2026-10-15T${time}:00`);
const event = (patch: Partial<DisplayEvent> = {}): DisplayEvent => ({ key: 'a', title: 'Matematika', originalTitle: 'Matematika', sourceId: 's', profileId: 1, start: at('10:00'), end: at('11:00'), location: 'BA.101', kind: 'timed', hidden: 0, base: '', patch: null, ...patch });
test('widget keeps current and upcoming events, removes ended/hidden ones and does not expose private fields', () => {
  const data = widgetData([event({ key: 'hidden', hidden: 1 }), event({ key: 'ended', start: at('08:00'), end: at('09:00') }), event({ notes: 'private', base: 'private' }), event({ key: 'next', start: at('12:00'), end: at('13:00') })], at('10:30'));
  assert.deepEqual(widgetAgenda(data, at('10:30')).events.map(item => item.start), [at('10:00'), at('12:00')]);
  assert.equal(JSON.stringify(data).includes('private'), false);
  assert.equal(widgetAgenda(data, at('11:00')).events.length, 1);
  assert.ok(widgetBoundaries(data, at('10:30')).includes(at('11:00')));
});
test('all-day events last until next Budapest midnight and expired snapshots never show yesterday', () => {
  const data = widgetData([event({ kind: 'allDay', start: fromWall('2026-10-15'), end: fromWall('2026-10-16') })], at('23:59'));
  assert.equal(widgetAgenda(data, at('23:59')).events[0].time, 'Egész nap');
  assert.equal(widgetAgenda(data, fromWall('2026-10-16')).events.length, 0);
  assert.equal(widgetAgenda(data, fromWall('2026-10-24')).day, undefined);
});
test('DST transition uses calendar-day boundaries rather than 24-hour arithmetic', () => {
  const data = widgetData([], fromWall('2026-10-25'));
  assert.equal(data.days[0].end - data.days[0].start, 25 * 3600000);
  assert.ok(widgetBoundaries(data, data.updated).includes(fromWall('2026-10-26')));
  const before = fromWall('2026-10-25T01:30:00'), after = fromWall('2026-10-25T04:30:00');
  assert.equal(before - widgetClockAnchor(before), 1.5 * 3600000);
  assert.equal(after - widgetClockAnchor(after), 4.5 * 3600000);
});
