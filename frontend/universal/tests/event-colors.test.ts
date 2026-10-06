import assert from 'node:assert/strict';
import { test } from 'node:test';
import { colorSeriesKey, DEFAULT_EVENT_COLORS, urgencyColor, validateUrgencyRules } from '../src/domain/event-colors';

test('lesson urgency includes exact thresholds and stops when the lesson ends', () => {
  const now = 1000000; const minute = 60000; const rules = DEFAULT_EVENT_COLORS.lesson;
  assert.equal(urgencyColor(now + 61 * minute, now + 120 * minute, now, rules), rules.green);
  assert.equal(urgencyColor(now + 60 * minute, now + 120 * minute, now, rules), rules.yellow);
  assert.equal(urgencyColor(now + 10 * minute, now + 120 * minute, now, rules), rules.red);
  assert.equal(urgencyColor(now - minute, now + minute, now, rules), rules.red);
  assert.equal(urgencyColor(now - minute, now, now, rules), undefined);
});
test('deadlines have a one-week horizon, exact three-day and 24-hour thresholds', () => {
  const rules = DEFAULT_EVENT_COLORS.deadline;
  assert.equal(urgencyColor(10081 * 60000, 0, 0, rules, true), undefined);
  assert.equal(urgencyColor(10080 * 60000, 0, 0, rules, true), rules.green);
  assert.equal(urgencyColor(4320 * 60000, 0, 0, rules, true), rules.yellow);
  assert.equal(urgencyColor(1440 * 60000, 0, 0, rules, true), rules.red);
  assert.equal(urgencyColor(-1, 0, 0, rules, true), undefined);
});
test('color series keeps lecture, practice groups and profiles separate', () => {
  const practice = { profileId: 1, originalTitle: 'Matematika - IMA_GY_02 - Tanóra' };
  assert.equal(colorSeriesKey(practice), colorSeriesKey({ ...practice, originalTitle: 'Új cím IMA_GY_02' }));
  assert.notEqual(colorSeriesKey(practice), colorSeriesKey({ ...practice, originalTitle: 'Matematika IMA_EA' }));
  assert.notEqual(colorSeriesKey(practice), colorSeriesKey({ ...practice, originalTitle: 'Matematika IMA_GY_03' }));
  assert.notEqual(colorSeriesKey(practice), colorSeriesKey({ ...practice, profileId: 2 }));
});
test('invalid thresholds and colors cannot be persisted', () => {
  assert.throws(() => validateUrgencyRules({ ...DEFAULT_EVENT_COLORS.lesson, yellowMinutes: 10 }));
  assert.throws(() => validateUrgencyRules({ ...DEFAULT_EVENT_COLORS.deadline, greenMinutes: 1 }));
  assert.throws(() => validateUrgencyRules({ ...DEFAULT_EVENT_COLORS.lesson, red: 'red' }));
  validateUrgencyRules(DEFAULT_EVENT_COLORS.lesson);
});

test('occurrence countdown overrides series rules while the base series color stays intact', async () => {
  const { eventAppearance, colorOccurrenceKey } = await import('../src/domain/event-colors');
  const event = { profileId: 1, originalTitle: 'IMA_GY_02', title: 'Renamed', sourceId: 'source', key: 'one', start: 20 * 60000, end: 60 * 60000, kind: 'timed' as const, location: '', hidden: 0, base: '{}', patch: null };
  const colors = { ...DEFAULT_EVENT_COLORS, series: { [colorSeriesKey(event)]: { color: '#c084fc', urgency: { ...DEFAULT_EVENT_COLORS.lesson, redMinutes: 30 } } }, occurrences: { [colorOccurrenceKey(event)]: { ...DEFAULT_EVENT_COLORS.lesson, redMinutes: 5 } } };
  assert.deepEqual(eventAppearance(event, colors, 0), { color: '#c084fc', urgency: colors.lesson.yellow });
  assert.equal(eventAppearance({ ...event, key: 'other' }, colors, 0).urgency, colors.lesson.red);
});
