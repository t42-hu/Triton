import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_REMINDERS, EMPTY_EVENT_REMINDERS, effectiveReminders, planReminders, reminderDifference, validateReminderRules, type ReminderEvent } from '../src/domain/reminders';
import { eventReminders, globalReminders, reminderEvents, saveEventReminders, saveGlobalReminders } from '../src/data/reminders';
import { deleteProfile, ownProfile, profiles, saveProfile, updateEvents, visibleEvents } from '../src/data/repository';
import { publishStages, stageSource, type SourceInput } from '../src/data/importer';
import { fromWall } from '../src/domain/time';

const now = fromWall('2026-10-24T08:00');
const global = { ...DEFAULT_REMINDERS, enabled: true };
const event: ReminderEvent = { sourceId: 'source', key: 'one', title: 'Course', originalTitle: 'Course', start: now + 7200000, end: now + 10800000, location: 'A1', kind: 'timed', hidden: 0, isOwn: 1, reminders: EMPTY_EVENT_REMINDERS };

test('global rules apply only to own profile; occurrence rules add, replace and exclude without duplicates', () => {
  assert.equal(planReminders([event], global, now).length, 3);
  assert.equal(planReminders([{ ...event, isOwn: 0 }], global, now).length, 0);
  const custom = { ...event, reminders: { excludeGlobal: false, rules: [{ minutes: 20, profile: 'strong' as const }, { minutes: 10, profile: 'gentle' as const }] } };
  assert.equal(planReminders([custom], global, now).length, 4);
  assert.equal(effectiveReminders(custom, global).find(rule => rule.minutes === 20)?.profile, 'strong');
  assert.equal(planReminders([{ ...custom, isOwn: 0 }], global, now).length, 2);
  assert.equal(planReminders([{ ...custom, reminders: { ...custom.reminders, excludeGlobal: true } }], global, now).length, 2);
  assert.equal(planReminders([custom], { ...global, enabled: false }, now).length, 2);
});

test('scheduling skips hidden/expired offsets and uses absolute instants across DST', () => {
  assert.equal(planReminders([{ ...event, hidden: 1 }], global, now).length, 0);
  assert.deepEqual(planReminders([{ ...event, start: now + 10 * 60000 }], global, now).map(item => item.at), [now + 5 * 60000]);
  const start = Date.parse('2026-10-25T03:15:00+01:00');
  const rules = { enabled: true, rules: [{ minutes: 60, profile: 'standard' as const }] };
  assert.equal(planReminders([{ ...event, start }], rules, start - 7200000)[0].at, Date.parse('2026-10-25T02:15:00+01:00'));
  assert.equal(planReminders([event], global, event.start + 1).length, 0);
});

test('nearest 60 reminders are ordered globally; reconciliation preserves unrelated notifications and cancels edits/deletions', () => {
  const events = Array.from({ length: 100 }, (_, index) => ({ ...event, key: String(index), start: now + (index + 2) * 3600000 }));
  const planned = planReminders(events, global, now);
  assert.equal(planned.length, 60);
  assert.ok(planned.every((item, index) => !index || item.at >= planned[index - 1].at));
  const pending = planned.map(item => ({ id: item.id, fingerprint: item.fingerprint }));
  assert.deepEqual(reminderDifference(planned, pending), { cancel: [], schedule: [] });
  const changed = planReminders([{ ...event, start: event.start + 3600000 }], global, now);
  const original = planReminders([event], global, now);
  const difference = reminderDifference(changed, original.map(item => ({ id: item.id, fingerprint: item.fingerprint })));
  assert.equal(difference.cancel.length, 3); assert.equal(difference.schedule.length, 3);
  assert.deepEqual(reminderDifference([], [{ id: 'timetable-change' }, { id: 'triton-reminder:old' }]).cancel, ['triton-reminder:old']);
});

test('invalid, repeated and oversized rule sets are rejected', () => {
  for (const minutes of [0, -1, 1.5, NaN, Infinity, 10081]) assert.throws(() => validateReminderRules([{ minutes, profile: 'standard' }]));
  assert.throws(() => validateReminderRules([{ minutes: 5, profile: 'gentle' }, { minutes: 5, profile: 'strong' }]));
  assert.throws(() => validateReminderRules(Array.from({ length: 21 }, (_, index) => ({ minutes: index + 1, profile: 'standard' }))));
  validateReminderRules(DEFAULT_REMINDERS.rules);
});

async function publish(input: SourceInput) {
  const stage = await stageSource(input, { date: '2026-10-19', week: 'A' }, { signal: new AbortController().signal, progress: () => undefined });
  await publishStages([stage]);
}
function content(id = 'one') {
  return JSON.stringify({ version: 1, events: [{ id, title: 'Course', kind: 'timed', start: '2026-10-24T10:00:00+02:00', end: '2026-10-24T11:00:00+02:00' }] });
}
test('SQLite rules survive refresh and overrides, follow ownership, and disappear with deleted occurrences/profiles', async () => {
  await saveProfile('Owner'); await saveProfile('Peer');
  const [owner, peer] = await profiles();
  const input: SourceInput = { id: 'reminder-source', profileId: owner.id, content: content(), format: 'json', name: 'test', fromDate: '2026-10-01', toDate: '2026-11-30', isManual: 0 };
  await publish(input);
  const [saved] = await visibleEvents(owner.id, '2026-10-24', 1, false);
  await saveGlobalReminders(global);
  const custom = { excludeGlobal: true, rules: [{ minutes: 10, profile: 'gentle' as const }] };
  await saveEventReminders(saved, custom); await publish(input);
  assert.deepEqual(await eventReminders(saved), custom);
  await updateEvents([{ event: saved, patch: { start: saved.start + 60000, location: 'B2' } }]);
  const plan = planReminders(await reminderEvents(now), await globalReminders(), now);
  assert.equal(plan.length, 1); assert.equal(plan[0].at, saved.start - 9 * 60000); assert.match(plan[0].body, /B2/);
  await ownProfile(peer.id);
  assert.equal(planReminders(await reminderEvents(now), global, now).length, 1);
  await updateEvents([{ event: saved, patch: { hidden: true } }]);
  assert.equal(planReminders(await reminderEvents(now), global, now).length, 0);
  await publish({ ...input, content: content('replacement') });
  assert.deepEqual(await eventReminders(saved), EMPTY_EVENT_REMINDERS);
  await assert.rejects(saveEventReminders(saved, custom), /már nem/);
  await deleteProfile(owner.id); await deleteProfile(peer.id);
  assert.deepEqual(await reminderEvents(now), []);
});
