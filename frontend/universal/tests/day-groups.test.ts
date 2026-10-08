import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupByBudapestDate } from '../src/domain/day-groups';

test('deadline groups use Budapest dates across midnight and preserve every item', () => {
  const events = [
    { id: 'evening', start: Date.parse('2026-10-08T21:30:00Z') },
    { id: 'midnight', start: Date.parse('2026-10-08T22:30:00Z') },
    { id: 'morning', start: Date.parse('2026-10-09T06:00:00Z') },
  ];
  assert.deepEqual(groupByBudapestDate(events), [
    { date: '2026-10-08', items: [events[0]] },
    { date: '2026-10-09', items: [events[1], events[2]] },
  ]);
  assert.deepEqual(groupByBudapestDate([]), []);
});

test('deadline dates stay correct at both Budapest daylight-saving transitions', () => {
  const events = [
    { start: Date.parse('2026-03-28T23:30:00Z') },
    { start: Date.parse('2026-03-29T01:30:00Z') },
    { start: Date.parse('2026-10-25T00:30:00Z') },
    { start: Date.parse('2026-10-25T01:30:00Z') },
  ];
  assert.deepEqual(groupByBudapestDate(events), [
    { date: '2026-03-29', items: [events[0], events[1]] },
    { date: '2026-10-25', items: [events[2], events[3]] },
  ]);
});
