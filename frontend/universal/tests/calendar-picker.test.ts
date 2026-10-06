import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarDays, shiftCalendarMonth } from '../src/domain/calendar-picker';

test('calendar starts on Monday and includes leap-day with surrounding month dates', () => {
  const days = calendarDays('2024-02');
  assert.equal(days.length, 42);
  assert.equal(days[0], '2024-01-29');
  assert.equal(days[41], '2024-03-10');
  assert.ok(days.includes('2024-02-29'));
});

test('month navigation crosses year boundaries without skipping February', () => {
  assert.equal(shiftCalendarMonth('2026-12', 1), '2027-01');
  assert.equal(shiftCalendarMonth('2026-01', -1), '2025-12');
  assert.equal(shiftCalendarMonth('2024-01', 1), '2024-02');
});
