import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stageSource, publishStages, discardStages } from '../src/data/importer';
import { profiles, saveProfile, updateEvents, visibleEvents, deleteProfile } from '../src/data/repository';
import { getDatabase, readSetting } from '../src/data/database';
const anchor = { date: '2026-09-07', week: 'A' as const };
const event = { id: 'course', title: 'Analízis', kind: 'timed', start: '2026-09-07T08:00:00+02:00', end: '2026-09-07T09:30:00+02:00', location: 'A1' };
const content = (events: unknown[]) => JSON.stringify({ version: 1, events });
const control = () => ({ signal: new AbortController().signal, progress: () => undefined });

test('profile names reject duplicates on create and rename, including concurrent saves and Hungarian case', async () => {
  const results = await Promise.allSettled([saveProfile(' Árvíz '), saveProfile('árvíz')]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const [profile] = await profiles();
  await assert.rejects(saveProfile('Árvíz'), /már létezik/);
  await assert.rejects(saveProfile('A\u0301rvíz'), /már létezik/);
  await saveProfile('Másik');
  const other = (await profiles()).find(item => item.name === 'Másik');
  assert.ok(other);
  await assert.rejects(saveProfile('ÁRVÍZ', other.id), /már létezik/);
  await saveProfile('ÁRVÍZ', profile.id);
  assert.equal((await profiles()).length, 2);
  await deleteProfile(other.id);
  await deleteProfile(profile.id);
});

test('staged imports publish atomically, preserve field patches and delete orphan overrides', async () => {
  await saveProfile('Teszt'); const [profile] = await profiles();
  const input = { id: `${profile.id}:import`, profileId: profile.id, format: 'json' as const, content: content([event]), name: 'test', fromDate: '2026-09-01', toDate: '2026-12-31', isManual: 0 };
  const first = await stageSource(input, anchor, control());
  assert.equal((await visibleEvents(profile.id, '2026-09-07', 7, false)).length, 0);
  await publishStages([first]);
  const [original] = await visibleEvents(profile.id, '2026-09-07', 7, false);
  await updateEvents([{ event: original, patch: { location: 'B2' } }]);
  const next = await stageSource({ ...input, content: content([{ ...event, title: 'Új név' }]) }, anchor, control());
  await publishStages([next]);
  const [changed] = await visibleEvents(profile.id, '2026-09-07', 7, false);
  assert.equal(changed.location, 'B2'); assert.equal(changed.title, 'Új név');
  await assert.rejects(stageSource({ ...input, content: '{invalid' }, anchor, control()));
  assert.equal((await visibleEvents(profile.id, '2026-09-07', 7, false))[0].location, 'B2');
  const empty = await stageSource({ ...input, content: content([]) }, anchor, control());
  assert.equal(empty.lostOverrides, 1); await publishStages([empty]);
  const returned = await stageSource(input, anchor, control()); await publishStages([returned]);
  assert.equal((await visibleEvents(profile.id, '2026-09-07', 7, false))[0].location, 'A1');
  const discarded = await stageSource({ ...input, content: content([]) }, anchor, control()); await discardStages([discarded]);
  assert.equal((await visibleEvents(profile.id, '2026-09-07', 7, false)).length, 1);
  await deleteProfile(profile.id);
});
test('A/B regeneration publishes all sources and anchor together', async () => {
  await saveProfile('AB'); const [profile] = await profiles();
  const input = { id: `${profile.id}:manual:test`, profileId: profile.id, format: 'json' as const, content: content([{ ...event, recurrence: { frequency: 'weekly', weeks: 'A', until: '2026-09-30' } }]), name: 'AB', fromDate: '2026-09-01', toDate: '2026-09-30', isManual: 1 };
  await publishStages([await stageSource(input, anchor, control())]);
  const changedAnchor = { ...anchor, week: 'B' as const };
  const rebuilt = await stageSource(input, changedAnchor, control());
  assert.equal(rebuilt.added, 2); assert.equal(rebuilt.removed, 2);
  await publishStages([rebuilt], changedAnchor);
  assert.equal((await visibleEvents(profile.id, '2026-09-07', 7, false)).length, 0);
  assert.equal((await visibleEvents(profile.id, '2026-09-14', 7, false)).length, 1);
  assert.deepEqual(await readSetting('anchor', anchor), changedAnchor);
  await deleteProfile(profile.id);
});

test('cancel after committed staging batches leaves the active source intact and removes staging rows', async () => {
  await saveProfile('Cancel'); const [profile] = await profiles();
  const input = { id: `${profile.id}:import`, profileId: profile.id, format: 'json' as const, content: content([event]), name: 'cancel', fromDate: '2026-09-01', toDate: '2026-12-31', isManual: 0 };
  await publishStages([await stageSource(input, anchor, control())]);
  const controller = new AbortController();
  const many = Array.from({ length: 400 }, (_, index) => ({ ...event, id: `event-${index}` }));
  const progress = (count: number) => { if (count >= 200) controller.abort(); };
  await assert.rejects(stageSource({ ...input, content: content(many) }, anchor, { signal: controller.signal, progress }), /megszakítva/);
  assert.equal((await visibleEvents(profile.id, '2026-09-07', 7, false)).length, 1);
  const rows = await (await getDatabase()).getFirstAsync<{ count: number }>('SELECT count(*) count FROM events WHERE sourceId=?', input.id);
  assert.equal(rows?.count, 1);
  await deleteProfile(profile.id);
});
