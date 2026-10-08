import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventDrop } from '../src/domain/event-drag';
import { fromWall, wallTime } from '../src/domain/time';
import type { DisplayEvent } from '../src/domain/model';
import { createManualEvent } from '../src/data/manual-event';
import { saveProfile, deleteProfile, updateEvents, visibleEvents } from '../src/data/repository';
const grid = { firstDate: '2026-10-05', days: 7, dayWidth: 180, zoom: 1, startMinute: 420, endMinute: 1200 };
const event = { kind: 'timed', start: fromWall('2026-10-07T13:00'), end: fromWall('2026-10-07T14:00') } as DisplayEvent;
test('dragging moves across days and five-minute time slots while retaining duration', () => {
  const drop = eventDrop(event, '2026-10-07', 180, 38, grid);
  assert.equal(wallTime(drop.start), '2026-10-08T13:40:00');
  assert.equal(drop.end - drop.start, 3600000);
  assert.equal(drop.y, 40);
  assert.equal(wallTime(eventDrop(event, '2026-10-07', 0, 5, grid).start), '2026-10-07T13:05:00');
  assert.equal(wallTime(eventDrop(event, '2026-10-07', 0, -5, grid).start), '2026-10-07T12:55:00');
  assert.equal(eventDrop(event, '2026-10-07', 0, 90, { ...grid, zoom: 2 }).y, 90);
});
test('drops clamp at both ends of the displayed week and time grid', () => {
  assert.equal(wallTime(eventDrop(event, '2026-10-07', -9999, -9999, grid).start), '2026-10-05T07:00:00');
  const last = eventDrop(event, '2026-10-07', 9999, 9999, grid);
  assert.equal(wallTime(last.start), '2026-10-11T19:00:00');
  assert.equal(wallTime(last.end), '2026-10-11T20:00:00');
  assert.equal(wallTime(eventDrop(event, '2026-10-07', 500, 0, { ...grid, firstDate: '2026-10-07', days: 1 }).start), '2026-10-07T13:00:00');
});
test('all-day drops keep calendar-day boundaries across DST', () => {
  const allDay = { ...event, kind: 'allDay' as const, start: fromWall('2026-10-24'), end: fromWall('2026-10-25') };
  const drop = eventDrop(allDay, '2026-10-24', 180, 400, { ...grid, firstDate: '2026-10-19' });
  assert.equal(wallTime(drop.start), '2026-10-25T00:00:00');
  assert.equal(wallTime(drop.end), '2026-10-26T00:00:00');
  assert.equal(drop.y, 0);
  const twoDays = { ...allDay, end: fromWall('2026-10-26') };
  const bounded = eventDrop(twoDays, '2026-10-24', 9999, 0, { ...grid, firstDate: '2026-10-19' });
  assert.equal(wallTime(bounded.start), '2026-10-24T00:00:00');
  assert.equal(wallTime(bounded.end), '2026-10-26T00:00:00');
});
test('moving one occurrence persists and preserves existing notes, categories and location patches', async () => {
  const profileId = await saveProfile('Drag test');
  const saved = await createManualEvent(profileId, { id: 'drag', title: 'Course', kind: 'timed', start: '2026-10-07T13:00:00+02:00', end: '2026-10-07T14:00:00+02:00' }, { date: '2026-10-05', week: 'A' });
  await updateEvents([{ event: saved, patch: { notes: 'Keep my notes', location: 'BA.F.08', category: 'exam' } }]);
  const [patched] = await visibleEvents(profileId, '2026-10-07', 1, false);
  const drop = eventDrop(patched, '2026-10-07', 180, -60, grid);
  await updateEvents([{ event: patched, patch: { start: drop.start, end: drop.end } }]);
  const [moved] = await visibleEvents(profileId, '2026-10-08', 1, false);
  assert.equal(moved.notes, 'Keep my notes'); assert.equal(moved.location, 'BA.F.08'); assert.equal(moved.category, 'exam');
  assert.equal(wallTime(moved.start), '2026-10-08T12:00:00');
  assert.equal((await visibleEvents(profileId, '2026-10-07', 1, false)).length, 0);
  await deleteProfile(profileId);
});
